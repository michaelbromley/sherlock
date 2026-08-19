/**
 * The tunnel supervisor.
 *
 * Runs as a detached background process, one per tunnelled connection. It owns
 * the forwarding command, publishes the local port once it is accepting
 * connections, and shuts everything down once no sherlock command has used the
 * tunnel for the configured idle period.
 *
 * This is what `sherlock tunnel __supervise` runs. It is never invoked directly
 * by users.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'fs';
import { ensureTunnelsDir } from '../config/paths';
import { getConnectionConfig } from '../config';
import {
    resolveTunnelConfig,
    applyPortPlaceholder,
    matchEndpoint,
    type DiscoveredEndpoint,
} from './config';
import { findFreePort, waitForPort, TUNNEL_HOST } from './net';
import { killProcessTree } from './process';
import {
    clearState,
    lockPath,
    logPath,
    readLastUsed,
    readLogFull,
    readLogTail,
    writeState,
} from './state';
import type { TunnelState } from './types';

/** How often the supervisor checks whether it should shut down */
const HEARTBEAT_MS = 2000;

/** How often to re-read the log while waiting for the command to announce its endpoint */
const DISCOVERY_POLL_MS = 100;

/**
 * Watch the forwarding command's output until it announces the endpoint it
 * bound. Tools that pick their own address and port print it on startup, which
 * is the only way to learn where to connect.
 */
async function discoverEndpoint(
    connectionName: string,
    pattern: RegExp,
    deadline: number,
    childExited: () => boolean
): Promise<DiscoveredEndpoint | null> {
    for (;;) {
        const found = matchEndpoint(pattern, readLogFull(connectionName));
        if (found) return found;

        // Check for death only after one last read, so output flushed just
        // before the process exited is not missed.
        if (childExited() || Date.now() >= deadline) return null;

        await new Promise((resolve) => setTimeout(resolve, DISCOVERY_POLL_MS));
    }
}

/** Explain a failed startup in terms of what the tunnel was actually waiting for */
function failureReason(
    childExited: boolean,
    childExitInfo: string,
    port: number,
    readyTimeoutMs: number,
    endpointPattern?: RegExp
): string {
    if (childExited) return `Tunnel command ${childExitInfo}`;

    if (endpointPattern && port === 0) {
        return (
            `Tunnel command did not print a local endpoint matching ` +
            `${endpointPattern.source} within ${readyTimeoutMs}ms. ` +
            `Check "endpointPattern" against the command's actual output below.`
        );
    }

    return `Tunnel did not start accepting connections on port ${port} within ${readyTimeoutMs}ms`;
}

/**
 * Point at the fix when a tunnel failed because sudo had nobody to ask.
 *
 * The forwarding process runs detached with no controlling terminal so it can
 * outlive the command that started it, which means sudo can never prompt.
 */
export function withSudoHint(message: string, output: string): string {
    const needsSudo = /sudo:.*(terminal is required|no tty present|password is required|askpass)/i;
    if (!needsSudo.test(output)) return message;

    return (
        `${message}\n\n` +
        `The tunnel runs in the background with no terminal, so sudo cannot prompt for a password. ` +
        `Either grant the command passwordless sudo in /etc/sudoers, or use "sudo -A" with ` +
        `SUDO_ASKPASS set to a helper that supplies the password without a terminal. ` +
        `Many forwarding tools also have a flag that avoids root entirely ` +
        `(northflank has --skipHostnames).`
    );
}

/** Release the startup lock, letting waiting commands stop polling */
function releaseLock(connectionName: string): void {
    try {
        fs.unlinkSync(lockPath(connectionName));
    } catch {
        // Already released.
    }
}

/**
 * Run the supervisor for a connection. Returns the process exit code.
 *
 * Never resolves while the tunnel is healthy — the heartbeat loop is the
 * process's main body.
 */
export async function runSupervisor(connectionName: string, configPath?: string): Promise<number> {
    ensureTunnelsDir();

    const connConfig = getConnectionConfig(connectionName, configPath);
    if (!connConfig.tunnel) {
        console.error(`Connection "${connectionName}" has no tunnel configured.`);
        releaseLock(connectionName);
        return 1;
    }

    const tunnel = resolveTunnelConfig(connectionName, connConfig.tunnel);

    // Either sherlock dictates the endpoint, or the command picks one and we
    // read it back out of the command's output once it starts up.
    const discovering = tunnel.endpointPattern !== undefined;
    const dictatedPort = discovering ? 0 : tunnel.localPort ?? (await findFreePort());
    const command = discovering ? tunnel.command : applyPortPlaceholder(tunnel.command, dictatedPort);

    const logFile = logPath(connectionName);
    // Truncate on each start so the log always describes the current tunnel.
    const logFd = fs.openSync(logFile, 'w', 0o600);
    fs.writeSync(
        logFd,
        `[sherlock] starting tunnel for "${connectionName}"` +
            (discovering ? ', reading endpoint from output\n' : ` on port ${dictatedPort}\n`)
    );
    fs.writeSync(logFd, `[sherlock] ${command}\n\n`);

    // Everything known about the tunnel before the forwarding process exists.
    // `childPid` is filled in once it does; -1 marks a tunnel that never started.
    const stateBase = {
        name: connectionName,
        host: TUNNEL_HOST,
        port: dictatedPort,
        supervisorPid: process.pid,
        childPid: -1,
        startedAt: new Date().toISOString(),
        idleTimeoutMs: tunnel.idleTimeoutMs,
        ready: false,
        command,
        logFile,
    } satisfies TunnelState;

    const fail = (error: string): void => writeState({ ...stateBase, error });

    let child: ChildProcess;
    try {
        child = spawn(command, {
            shell: true,
            // Own process group, so the whole forwarding tree can be signalled
            // and so closing the terminal does not take the tunnel down.
            detached: true,
            stdio: ['ignore', logFd, logFd],
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        fs.writeSync(logFd, `[sherlock] failed to start: ${message}\n`);
        fs.closeSync(logFd);
        fail(`Failed to start tunnel command: ${message}`);
        releaseLock(connectionName);
        return 1;
    }

    const childPid = child.pid;
    if (childPid === undefined) {
        fs.closeSync(logFd);
        fail('Tunnel command produced no process');
        releaseLock(connectionName);
        return 1;
    }

    let childExited = false;
    let childExitInfo = '';
    child.once('exit', (code, signal) => {
        childExited = true;
        childExitInfo = signal ? `killed by ${signal}` : `exited with code ${code}`;
    });

    const baseState: TunnelState = { ...stateBase, childPid };
    writeState(baseState);

    const shutdown = async (exitCode: number) => {
        await killProcessTree(childPid);
        clearState(connectionName);
        try {
            fs.closeSync(logFd);
        } catch {
            // Already closed.
        }
        process.exit(exitCode);
    };

    process.on('SIGTERM', () => void shutdown(0));
    process.on('SIGINT', () => void shutdown(0));

    // One budget covers discovering the endpoint and waiting for it to accept,
    // so a tool that announces itself slowly cannot double the startup wait.
    const deadline = Date.now() + tunnel.readyTimeoutMs;

    let endpoint = { host: TUNNEL_HOST, port: dictatedPort };
    if (tunnel.endpointPattern) {
        const discovered = await discoverEndpoint(
            connectionName,
            tunnel.endpointPattern,
            deadline,
            () => childExited
        );
        if (discovered) {
            endpoint = discovered;
            fs.writeSync(
                logFd,
                `[sherlock] found endpoint ${endpoint.host}:${endpoint.port} in command output\n`
            );
        }
    }

    // Wait for the forwarding process to start accepting, bailing out early if
    // it dies so the user sees the tool's own error rather than a timeout.
    const ready =
        endpoint.port > 0 &&
        (await waitForPort(endpoint.port, endpoint.host, deadline, () => childExited));

    if (!ready) {
        const reason = failureReason(
            childExited,
            childExitInfo,
            endpoint.port,
            tunnel.readyTimeoutMs,
            tunnel.endpointPattern
        );
        const tail = readLogTail(connectionName);
        fail(withSudoHint(tail ? `${reason}\n\nLast output:\n${tail}` : reason, tail));
        releaseLock(connectionName);
        await killProcessTree(childPid);
        try {
            fs.closeSync(logFd);
        } catch {
            // Already closed.
        }
        return 1;
    }

    writeState({ ...baseState, ...endpoint, ready: true });
    releaseLock(connectionName);
    fs.writeSync(logFd, `[sherlock] tunnel ready on ${endpoint.host}:${endpoint.port}\n`);

    // Main loop: hold the tunnel open until the forwarding process dies or the
    // tunnel goes unused for long enough.
    const startedAtMs = Date.parse(baseState.startedAt);
    for (;;) {
        await new Promise((resolve) => setTimeout(resolve, HEARTBEAT_MS));

        if (childExited) {
            fs.writeSync(logFd, `[sherlock] tunnel command ${childExitInfo}; shutting down\n`);
            await shutdown(1);
            return 1;
        }

        const idleMs = Date.now() - readLastUsed(connectionName, startedAtMs);
        if (idleMs >= tunnel.idleTimeoutMs) {
            fs.writeSync(logFd, `[sherlock] idle for ${Math.round(idleMs / 1000)}s; shutting down\n`);
            await shutdown(0);
            return 0;
        }
    }
}
