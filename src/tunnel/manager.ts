/**
 * Starting, reusing and stopping tunnels.
 *
 * Every sherlock command is a separate short-lived process, so a tunnel cannot
 * live for the lifetime of one invocation — starting a port-forward per query
 * would add seconds to every command. Instead the first command that needs a
 * tunnel starts a detached supervisor, later commands reuse it, and the
 * supervisor shuts itself down once the tunnel has gone unused.
 */

import { spawn } from 'node:child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ensureTunnelsDir } from '../config/paths';
import { resolveTunnelConfig } from './config';
import { isPortAccepting } from './net';
import { killProcessTree } from './process';
import {
    clearState,
    isProcessAlive,
    listTunnelStates,
    lockPath,
    readLogTail,
    readState,
    touchLastUsed,
} from './state';
import type { TunnelConfig, TunnelState } from './types';

/** Where a running tunnel can be reached locally */
export interface TunnelEndpoint {
    host: string;
    port: number;
}

/** Extra time beyond the tunnel's own ready timeout to allow for supervisor startup */
const SUPERVISOR_STARTUP_GRACE_MS = 5000;

/** How often to re-read the state file while waiting for a tunnel to come up */
const POLL_INTERVAL_MS = 100;

/**
 * A compiled single-file executable runs its entry script from Bun's embedded
 * filesystem. Those paths stat successfully like real files, so they have to be
 * recognised by prefix rather than by existence.
 */
export function isEmbeddedScriptPath(scriptPath: string): boolean {
    return scriptPath.includes('$bunfs') || scriptPath.includes('~BUN');
}

/**
 * How the running sherlock re-invokes itself to launch a supervisor.
 *
 * A compiled binary is its own interpreter; running from source needs the
 * script path passed to `bun`.
 */
function selfInvocation(): { command: string; prefixArgs: string[] } {
    const scriptArg = process.argv[1];

    if (scriptArg && !isEmbeddedScriptPath(scriptArg)) {
        try {
            if (fs.statSync(scriptArg).isFile()) {
                return { command: process.execPath, prefixArgs: [path.resolve(scriptArg)] };
            }
        } catch {
            // Not a real script on disk.
        }
    }

    return { command: process.execPath, prefixArgs: [] };
}

/** A tunnel is usable only if its supervisor is alive and the port still answers */
async function isUsable(state: TunnelState): Promise<boolean> {
    if (!state.ready || state.error) return false;
    if (!isProcessAlive(state.supervisorPid)) return false;
    return isPortAccepting(state.port, state.host);
}

/**
 * Clean up after a tunnel whose supervisor died without tidying up, so a stale
 * state file cannot strand an orphaned forwarding process holding the port.
 */
async function reapDeadTunnel(state: TunnelState): Promise<void> {
    if (state.childPid > 0 && isProcessAlive(state.childPid)) {
        await killProcessTree(state.childPid);
    }
    clearState(state.name);
}

/**
 * Take the startup lock, or report that another process holds it.
 *
 * A lock older than the whole startup budget is assumed to belong to a process
 * that died mid-start, and gets broken rather than blocking the tunnel forever.
 */
function acquireLock(connectionName: string, staleAfterMs: number): boolean {
    ensureTunnelsDir();
    const file = lockPath(connectionName);

    try {
        fs.closeSync(fs.openSync(file, 'wx', 0o600));
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }

    try {
        const ageMs = Date.now() - fs.statSync(file).mtimeMs;
        if (ageMs > staleAfterMs) {
            fs.unlinkSync(file);
            fs.closeSync(fs.openSync(file, 'wx', 0o600));
            return true;
        }
    } catch {
        // Lost a race with whoever else is breaking or holding the lock.
    }

    return false;
}

function releaseLock(connectionName: string): void {
    try {
        fs.unlinkSync(lockPath(connectionName));
    } catch {
        // Already released, usually by the supervisor itself.
    }
}

/** Wait for the supervisor to publish a ready tunnel, or fail with its error */
async function waitForReadyState(connectionName: string, timeoutMs: number): Promise<TunnelState> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const state = readState(connectionName);

        if (state?.error) {
            clearState(connectionName);
            throw new Error(state.error);
        }
        if (state?.ready) return state;

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    const tail = readLogTail(connectionName);
    clearState(connectionName);
    throw new Error(
        `Timed out waiting for tunnel "${connectionName}" to start.` +
            (tail ? `\n\nLast output:\n${tail}` : '')
    );
}

/** Launch the detached supervisor that owns the forwarding process */
function spawnSupervisor(connectionName: string, configPath?: string): void {
    const { command, prefixArgs } = selfInvocation();
    const args = [...prefixArgs, 'tunnel', '__supervise', '--name', connectionName];
    // Absolute, because the supervisor does not run in the caller's directory.
    if (configPath) args.push('--config', path.resolve(configPath));

    const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        // The supervisor outlives this process, so it must not hold a working
        // directory open, and must not pick up a project-local config from one.
        cwd: path.parse(process.cwd()).root,
    });
    child.unref();
}

/**
 * Make sure a tunnel for this connection is up, and return the local endpoint it
 * forwards. Reuses a healthy existing tunnel; starts one otherwise.
 */
export async function ensureTunnel(
    connectionName: string,
    tunnelConfig: TunnelConfig,
    configPath?: string
): Promise<TunnelEndpoint> {
    const tunnel = resolveTunnelConfig(connectionName, tunnelConfig);
    const startupBudgetMs = tunnel.readyTimeoutMs + SUPERVISOR_STARTUP_GRACE_MS;

    const existing = readState(connectionName);
    if (existing) {
        if (await isUsable(existing)) {
            touchLastUsed(connectionName);
            return { host: existing.host, port: existing.port };
        }
        // Either a failure left over from a previous invocation, or a supervisor
        // that died. Both are worth retrying from scratch.
        await reapDeadTunnel(existing);
    }

    if (!acquireLock(connectionName, startupBudgetMs)) {
        // Another sherlock process is already starting this tunnel; wait for it.
        const state = await waitForReadyState(connectionName, startupBudgetMs);
        touchLastUsed(connectionName);
        return { host: state.host, port: state.port };
    }

    try {
        // Marks the tunnel as in use from the moment it starts, so a slow first
        // query cannot be reaped by the idle timeout before it even runs.
        touchLastUsed(connectionName);
        spawnSupervisor(connectionName, configPath);
        const state = await waitForReadyState(connectionName, startupBudgetMs);
        touchLastUsed(connectionName);
        return { host: state.host, port: state.port };
    } finally {
        releaseLock(connectionName);
    }
}

/** Upper bound on how long an in-flight query waits between idle-countdown resets */
const MAX_KEEPALIVE_INTERVAL_MS = 30_000;

/** Lower bound, so a tiny idle timeout cannot turn into a busy loop */
const MIN_KEEPALIVE_INTERVAL_MS = 1_000;

/**
 * How often to signal use while a query runs. Signalling must happen several
 * times per idle period, otherwise a short idle timeout would expire between
 * two signals and take the tunnel down mid-query.
 */
export function keepaliveIntervalFor(idleTimeoutMs: number): number {
    // A malformed state file must not produce a NaN interval, which setInterval
    // would treat as "immediately, forever".
    if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs <= 0) return MAX_KEEPALIVE_INTERVAL_MS;

    const target = Math.floor(idleTimeoutMs / 3);
    return Math.max(MIN_KEEPALIVE_INTERVAL_MS, Math.min(MAX_KEEPALIVE_INTERVAL_MS, target));
}

/**
 * Keep resetting a tunnel's idle countdown for as long as a query is running,
 * and return a function that stops doing so.
 *
 * Use is otherwise only recorded when the connection is opened, so without this
 * a query that runs longer than the idle timeout would have its own tunnel shut
 * down underneath it.
 *
 * No-ops for connections that have no tunnel.
 */
export function startTunnelKeepalive(connectionName: string): () => void {
    const state = readState(connectionName);
    if (state === null) return () => undefined;

    touchLastUsed(connectionName);
    const timer = setInterval(
        () => touchLastUsed(connectionName),
        keepaliveIntervalFor(state.idleTimeoutMs)
    );
    // Must not hold the process open once the query is done.
    timer.unref?.();

    return () => clearInterval(timer);
}

export interface StopResult {
    name: string;
    stopped: boolean;
    detail?: string;
}

/** Stop a single tunnel by connection name */
export async function stopTunnel(connectionName: string): Promise<StopResult> {
    const state = readState(connectionName);
    if (!state) {
        return { name: connectionName, stopped: false, detail: 'no tunnel running' };
    }

    // Ask the supervisor to shut down, so it kills the forwarding process and
    // clears its own state. Killing the tree directly is the fallback for a
    // supervisor that has already died.
    if (isProcessAlive(state.supervisorPid)) {
        try {
            process.kill(state.supervisorPid, 'SIGTERM');
        } catch {
            // Raced with the supervisor exiting on its own.
        }
    }

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        if (!isProcessAlive(state.supervisorPid) && readState(connectionName) === null) {
            return { name: connectionName, stopped: true };
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    await reapDeadTunnel(state);
    if (isProcessAlive(state.supervisorPid)) {
        await killProcessTree(state.supervisorPid);
    }

    return { name: connectionName, stopped: true, detail: 'forced' };
}

/** Stop every running tunnel */
export async function stopAllTunnels(): Promise<StopResult[]> {
    const states = listTunnelStates();
    const results: StopResult[] = [];
    for (const state of states) {
        results.push(await stopTunnel(state.name));
    }
    return results;
}

export interface TunnelStatus {
    name: string;
    host: string;
    port: number;
    running: boolean;
    ready: boolean;
    startedAt: string;
    command: string;
    logFile: string;
    error?: string;
}

/** Report on every tunnel with recorded state */
export async function listTunnels(): Promise<TunnelStatus[]> {
    const statuses: TunnelStatus[] = [];

    for (const state of listTunnelStates()) {
        const running = isProcessAlive(state.supervisorPid);
        statuses.push({
            name: state.name,
            host: state.host,
            port: state.port,
            running,
            ready: running && state.ready && (await isPortAccepting(state.port, state.host)),
            startedAt: state.startedAt,
            command: state.command,
            logFile: state.logFile,
            error: state.error,
        });
    }

    return statuses.sort((a, b) => a.name.localeCompare(b.name));
}
