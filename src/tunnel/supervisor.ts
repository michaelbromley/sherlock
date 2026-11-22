/**
 * The tunnel supervisor.
 *
 * Runs as a detached background process, one per tunnelled connection. It asks
 * the connection's tunnel provider to open the forward, publishes the local
 * port once it is accepting connections, and shuts everything down once no
 * sherlock command has used the tunnel for the configured idle period.
 *
 * This is what `sherlock tunnel __supervise` runs. It is never invoked directly
 * by users.
 */

import * as fs from 'fs';
import { ensureTunnelsDir } from '../config/paths';
import { getConnectionConfig } from '../config';
import { findFreePort, waitForPort, TUNNEL_HOST } from './net';
import { killProcessTree } from './process';
import { resolveTunnel, type OpenTunnel } from './providers';
import {
    clearState,
    logPath,
    readLastUsed,
    releaseLock,
    readLogFrom,
    readLogTail,
    writeState,
} from './state';
import type { TunnelState } from './types';
import { errorMessage, isSherlockError } from '../errors';

/** How often the supervisor checks whether it should shut down */
const HEARTBEAT_MS = 2000;

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
        `Many forwarding tools also have a flag that avoids root entirely, and a tunnel ` +
        `provider ("provider" in the tunnel block) never needs root.`
    );
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

    const tunnel = resolveTunnel(connectionName, connConfig.tunnel);

    const logFile = logPath(connectionName);
    // Truncate on each start so the log always describes the current tunnel.
    const logFd = fs.openSync(logFile, 'w', 0o600);
    const log = (line: string): void => {
        fs.writeSync(logFd, `[sherlock] ${line}\n`);
    };
    const closeLog = (): void => {
        try {
            fs.closeSync(logFd);
        } catch {
            // Already closed.
        }
    };
    log(`starting ${tunnel.providerId} tunnel for "${connectionName}"`);

    // Everything known about the tunnel before it is open. `childPid` and the
    // endpoint are filled in once it is; -1 marks a tunnel with no process.
    const stateBase = {
        name: connectionName,
        host: TUNNEL_HOST,
        port: 0,
        supervisorPid: process.pid,
        childPid: -1,
        startedAt: new Date().toISOString(),
        idleTimeoutMs: tunnel.idleTimeoutMs,
        ready: false,
        command: tunnel.inspect().target.summary,
        provider: tunnel.providerId,
        logFile,
    } satisfies TunnelState;

    /**
     * Record why the tunnel failed, with the tail of its log, and give up. A
     * classified error, such as a provider rejecting the login, keeps its code;
     * anything else is TUNNEL_FAILED.
     */
    const fail = (error: unknown): number => {
        const reason = errorMessage(error);
        const tail = readLogTail(connectionName);
        const classified = isSherlockError(error) ? error : null;
        writeState({
            ...stateBase,
            // A classified error says what went wrong; the log tail is for one that does not.
            error: classified ? reason : withSudoHint(tail ? `${reason}\n\nLast output:\n${tail}` : reason, tail),
            errorCode: classified?.code ?? 'TUNNEL_FAILED',
            ...(classified?.fix !== undefined && { errorFix: classified.fix }),
            // Each code has its own details keys; TUNNEL_FAILED's are these two.
            errorDetails: classified ? { provider: tunnel.providerId, ...classified.details } : { provider: tunnel.providerId, logFile },
        });
        releaseLock(connectionName);
        closeLog();
        return 1;
    };

    // One budget covers opening the tunnel and waiting for it to accept, so a
    // provider that starts slowly cannot double the startup wait.
    const deadline = Date.now() + tunnel.readyTimeoutMs;

    let open: OpenTunnel;
    try {
        open = await tunnel.open({
            connectionName,
            deadline,
            log,
            logFd,
            logOffset: () => fs.fstatSync(logFd).size,
            readLog: (offset) => readLogFrom(connectionName, offset),
            findFreePort,
        });
    } catch (error) {
        log(`failed to start: ${errorMessage(error)}`);
        return fail(error);
    }

    const baseState: TunnelState = {
        ...stateBase,
        ...open.endpoint,
        childPid: open.childPid ?? -1,
        command: open.description,
    };
    writeState(baseState);

    const shutdown = async (exitCode: number) => {
        await open.close().catch(() => undefined);
        // A provider that ran a process may have left part of its tree behind.
        if (open.childPid !== undefined) await killProcessTree(open.childPid);
        clearState(connectionName);
        closeLog();
        process.exit(exitCode);
    };

    process.on('SIGTERM', () => void shutdown(0));
    process.on('SIGINT', () => void shutdown(0));

    // Wait for the forward to start accepting, bailing out early if it dies so
    // the user sees the provider's own error rather than a timeout.
    const { host, port } = open.endpoint;
    const ready = await waitForPort(port, host, deadline, () => open.exitReason() !== null);

    if (!ready) {
        const reason =
            open.exitReason() ??
            `Tunnel did not start accepting connections on port ${port} within ${tunnel.readyTimeoutMs}ms`;
        await open.close().catch(() => undefined);
        return fail(reason);
    }

    writeState({ ...baseState, ready: true });
    releaseLock(connectionName);
    log(`tunnel ready on ${host}:${port}`);

    // Main loop: hold the tunnel open until the forward stops or the tunnel
    // goes unused for long enough.
    const startedAtMs = Date.parse(baseState.startedAt);
    for (;;) {
        await new Promise((resolve) => setTimeout(resolve, HEARTBEAT_MS));

        const exited = open.exitReason();
        if (exited !== null) {
            log(`${exited}; shutting down`);
            await shutdown(1);
            return 1;
        }

        const idleMs = Date.now() - readLastUsed(connectionName, startedAtMs);
        if (idleMs >= tunnel.idleTimeoutMs) {
            log(`idle for ${Math.round(idleMs / 1000)}s; shutting down`);
            await shutdown(0);
            return 0;
        }
    }
}
