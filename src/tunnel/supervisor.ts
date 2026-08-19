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
import { resolveTunnelConfig, applyPortPlaceholder } from './config';
import { findFreePort, waitForPort } from './net';
import { killProcessTree } from './process';
import {
    clearState,
    lockPath,
    logPath,
    readLastUsed,
    readLogTail,
    writeState,
} from './state';
import type { TunnelState } from './types';

/** How often the supervisor checks whether it should shut down */
const HEARTBEAT_MS = 2000;

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
    const port = tunnel.localPort ?? (await findFreePort());
    const command = applyPortPlaceholder(tunnel.command, port);

    const logFile = logPath(connectionName);
    // Truncate on each start so the log always describes the current tunnel.
    const logFd = fs.openSync(logFile, 'w', 0o600);
    fs.writeSync(logFd, `[sherlock] starting tunnel for "${connectionName}" on port ${port}\n`);
    fs.writeSync(logFd, `[sherlock] ${command}\n\n`);

    // Everything known about the tunnel before the forwarding process exists.
    // `childPid` is filled in once it does; -1 marks a tunnel that never started.
    const stateBase = {
        name: connectionName,
        port,
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

    // Wait for the forwarding process to start accepting, bailing out early if
    // it dies so the user sees the tool's own error rather than a timeout.
    const ready = await waitForPort(port, tunnel.readyTimeoutMs, () => childExited);

    if (!ready) {
        const reason = childExited
            ? `Tunnel command ${childExitInfo}`
            : `Tunnel did not start accepting connections on port ${port} within ${tunnel.readyTimeoutMs}ms`;
        const tail = readLogTail(connectionName);
        fail(tail ? `${reason}\n\nLast output:\n${tail}` : reason);
        releaseLock(connectionName);
        await killProcessTree(childPid);
        try {
            fs.closeSync(logFd);
        } catch {
            // Already closed.
        }
        return 1;
    }

    writeState({ ...baseState, ready: true });
    releaseLock(connectionName);
    fs.writeSync(logFd, `[sherlock] tunnel ready on 127.0.0.1:${port}\n`);

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
