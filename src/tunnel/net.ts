/**
 * Local port helpers for tunnel management.
 */

import * as net from 'node:net';

/** Loopback address every tunnel forwards to */
export const TUNNEL_HOST = '127.0.0.1';

/** How long a single connect attempt is allowed to hang before counting as closed */
const PROBE_TIMEOUT_MS = 1000;

/**
 * Ask the OS for a free local port.
 *
 * There is an unavoidable gap between us releasing the port and the forwarding
 * process binding it, so a busy machine can still lose the race. Callers should
 * treat "tunnel failed to come up" as retryable rather than fatal.
 */
export function findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, TUNNEL_HOST, () => {
            const address = server.address();
            if (address === null || typeof address === 'string') {
                server.close();
                reject(new Error('Could not determine a free local port'));
                return;
            }
            const { port } = address;
            server.close(() => resolve(port));
        });
    });
}

/** Whether something is currently accepting TCP connections on a local port */
export function isPortAccepting(port: number, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let settled = false;

        const finish = (accepting: boolean) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(accepting);
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        socket.connect(port, TUNNEL_HOST);
    });
}

/**
 * Poll a local port until something accepts on it. `shouldAbort` lets the caller
 * bail out early — the supervisor uses it to stop waiting once the forwarding
 * process has died, so a crashed tunnel reports its real error immediately
 * instead of after the full timeout.
 */
export async function waitForPort(
    port: number,
    timeoutMs: number,
    shouldAbort?: () => boolean
): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const intervalMs = 100;

    while (Date.now() < deadline) {
        if (shouldAbort?.()) return false;
        if (await isPortAccepting(port)) return true;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return false;
}
