/**
 * On-disk state for running tunnels.
 *
 * Tunnels outlive the `sherlock` process that started them, so everything a
 * later invocation needs to find, reuse, or stop a tunnel lives in these files:
 *
 *   <config>/tunnels/<slug>.json   state, written only by the supervisor
 *   <config>/tunnels/<slug>.used   touched by every command that uses the tunnel
 *   <config>/tunnels/<slug>.lock   held while a tunnel is starting up
 *   <config>/tunnels/<slug>.log    stdout/stderr of the forwarding command
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getTunnelsDir, ensureTunnelsDir } from '../config/paths';
import type { TunnelState } from './types';

/** File permissions for state files (owner read/write only) */
const SECURE_FILE_MODE = 0o600;

/**
 * Turn a connection name into a filename-safe slug.
 *
 * Connection names are free-form, so the readable part is sanitised for display
 * and a hash of the original is appended to keep distinct names distinct (both
 * `prod db` and `prod/db` sanitise to `prod_db`).
 */
export function tunnelSlug(connectionName: string): string {
    const readable = connectionName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
    const digest = crypto.createHash('sha256').update(connectionName).digest('hex').slice(0, 8);
    return `${readable}-${digest}`;
}

export function statePath(connectionName: string): string {
    return path.join(getTunnelsDir(), `${tunnelSlug(connectionName)}.json`);
}

export function lastUsedPath(connectionName: string): string {
    return path.join(getTunnelsDir(), `${tunnelSlug(connectionName)}.used`);
}

export function lockPath(connectionName: string): string {
    return path.join(getTunnelsDir(), `${tunnelSlug(connectionName)}.lock`);
}

export function logPath(connectionName: string): string {
    return path.join(getTunnelsDir(), `${tunnelSlug(connectionName)}.log`);
}

function isTunnelState(data: unknown): data is TunnelState {
    if (typeof data !== 'object' || data === null) return false;
    const s = data as TunnelState;
    return (
        typeof s.name === 'string' &&
        typeof s.host === 'string' &&
        typeof s.port === 'number' &&
        typeof s.supervisorPid === 'number' &&
        typeof s.childPid === 'number' &&
        typeof s.ready === 'boolean'
    );
}

/** Read a tunnel's state, or null if there is no valid state file */
export function readState(connectionName: string): TunnelState | null {
    const file = statePath(connectionName);
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return isTunnelState(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Write a tunnel's state. Written to a temp file and renamed so a reader never
 * sees a half-written file.
 */
export function writeState(state: TunnelState): void {
    ensureTunnelsDir();
    const file = statePath(state.name);
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state, null, 2), { encoding: 'utf-8', mode: SECURE_FILE_MODE });
    fs.renameSync(temp, file);
}

/** Remove a tunnel's state, last-used marker and lock. Leaves the log for debugging. */
export function clearState(connectionName: string): void {
    for (const file of [statePath(connectionName), lastUsedPath(connectionName), lockPath(connectionName)]) {
        try {
            fs.unlinkSync(file);
        } catch {
            // Already gone, which is the outcome we wanted anyway.
        }
    }
}

/** Record that a command just used this tunnel, resetting its idle countdown */
export function touchLastUsed(connectionName: string): void {
    ensureTunnelsDir();
    const file = lastUsedPath(connectionName);
    try {
        fs.writeFileSync(file, '', { encoding: 'utf-8', mode: SECURE_FILE_MODE });
    } catch {
        // A tunnel that can't record use will idle out early. Not worth failing a query over.
    }
}

/**
 * When this tunnel was last used, in epoch milliseconds. Falls back to the
 * state file's own timestamp so a tunnel that has never been used still gets a
 * full idle period rather than being reaped immediately.
 */
export function readLastUsed(connectionName: string, fallback: number): number {
    try {
        return fs.statSync(lastUsedPath(connectionName)).mtimeMs;
    } catch {
        return fallback;
    }
}

/**
 * Whether a process exists.
 *
 * `EPERM` means it exists but belongs to someone else, which still counts as
 * alive. This cannot distinguish our process from an unrelated one that reused
 * the PID, so callers pair it with a check that the tunnel port still answers.
 */
export function isProcessAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
}

/**
 * A tunnel's log from `offset` bytes onwards, for matching against an endpoint
 * pattern. The offset skips sherlock's own header so only the forwarding
 * command's output is considered.
 */
export function readLogFrom(connectionName: string, offset: number): string {
    try {
        const content = fs.readFileSync(logPath(connectionName));
        return content.subarray(offset).toString('utf-8');
    } catch {
        return '';
    }
}

/** Last few lines of a tunnel's log, for reporting why it failed to start */
export function readLogTail(connectionName: string, maxLines = 15): string {
    try {
        const content = fs.readFileSync(logPath(connectionName), 'utf-8').trimEnd();
        if (!content) return '';
        return content.split('\n').slice(-maxLines).join('\n');
    } catch {
        return '';
    }
}

/** State files for every tunnel that has recorded state, running or not */
export function listTunnelStates(): TunnelState[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(getTunnelsDir());
    } catch {
        return [];
    }

    const states: TunnelState[] = [];
    for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        try {
            const parsed = JSON.parse(fs.readFileSync(path.join(getTunnelsDir(), entry), 'utf-8'));
            if (isTunnelState(parsed)) states.push(parsed);
        } catch {
            // Skip unreadable or half-written state files.
        }
    }
    return states;
}
