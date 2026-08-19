/**
 * Killing forwarding processes.
 *
 * Forwarding tools frequently spawn helpers of their own (an `ssh` child, a
 * proxy binary), so signalling only the process we launched can leave the port
 * held open. The supervisor starts the command detached, which puts it in its
 * own process group, and everything here targets that whole group.
 */

import { spawnSync } from 'node:child_process';
import { isProcessAlive } from './state';

/** Grace period between asking a process tree to stop and forcing it */
const TERM_GRACE_MS = 3000;

const isWindows = process.platform === 'win32';

/** Send a signal to a process group, reporting whether anything received it */
function signalGroup(pid: number, signal: NodeJS.Signals): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false;

    if (isWindows) {
        // Windows has no process groups in the POSIX sense; taskkill /T walks
        // the child tree instead. /F is required to end a detached process.
        const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
        return result.status === 0;
    }

    try {
        // A negative PID targets the whole process group.
        process.kill(-pid, signal);
        return true;
    } catch {
        // The group may already be gone, or the leader may have died leaving no
        // group. Fall back to the single process.
        try {
            process.kill(pid, signal);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Stop a forwarding process tree: SIGTERM, wait briefly, then SIGKILL.
 * Returns true if the tree is gone by the time we return.
 */
export async function killProcessTree(pid: number): Promise<boolean> {
    if (!isProcessAlive(pid)) return true;

    signalGroup(pid, 'SIGTERM');

    const deadline = Date.now() + TERM_GRACE_MS;
    while (Date.now() < deadline) {
        if (!isProcessAlive(pid)) return true;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    signalGroup(pid, 'SIGKILL');

    // Give the kernel a moment to reap before reporting the outcome.
    await new Promise((resolve) => setTimeout(resolve, 100));
    return !isProcessAlive(pid);
}
