/**
 * How long to wait for a database to answer when connecting.
 *
 * A tunnel accepts connections locally even when its far end is gone, so
 * without a limit a dead tunnel looks like a database that is thinking. The
 * drivers' own defaults are long (30s for Bun.SQL), and a command that runs
 * several connections multiplies them. A short limit, and an error that names
 * the tunnel, turns that into an answer.
 */

import { parseDuration } from '../tunnel/config';
import type { ResolvedConnectionConfig } from '../config/types';

/** How long a connection may take to open when the connection does not say */
export const DEFAULT_CONNECT_TIMEOUT = '10s';

/** The connect timeout in milliseconds: the connection's own, or the default */
export function connectTimeoutFor(config: ResolvedConnectionConfig): number {
    return config.connectTimeoutMs ?? parseDuration(DEFAULT_CONNECT_TIMEOUT);
}

/** Bun.SQL takes the connect timeout in whole seconds */
export function connectTimeoutSeconds(ms: number): number {
    return Math.max(1, Math.ceil(ms / 1000));
}

const TIMEOUT_CODES = new Set([
    'ERR_POSTGRES_CONNECTION_TIMEOUT',
    'ERR_MYSQL_CONNECTION_TIMEOUT',
    'ERR_REDIS_CONNECTION_TIMEOUT',
]);

/** Whether an error says the connection could not be opened in time */
export function isConnectTimeoutError(error: unknown): boolean {
    const { code, name, message } = (error ?? {}) as { code?: unknown; name?: unknown; message?: unknown };
    if (typeof code === 'string' && TIMEOUT_CODES.has(code)) return true;
    // mssql: a ConnectionError with code ETIMEOUT, "Failed to connect to host:port in 10000ms"
    return name === 'ConnectionError' && code === 'ETIMEOUT' ||
        (typeof message === 'string' && /failed to connect to .* in \d+ms/i.test(message));
}

/**
 * Whether the far end closed the connection before it was established. A
 * tunnel's local port accepts, so through a tunnel this means the forward
 * dropped it.
 */
function isClosedBeforeEstablished(error: unknown): boolean {
    const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
    return code === 'ERR_POSTGRES_CONNECTION_FAILED' || code === 'ERR_MYSQL_CONNECTION_FAILED' ||
        (typeof message === 'string' && /closed before the connection was established/i.test(message));
}

function formatMs(ms: number): string {
    return ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`;
}

/**
 * Replace a connect timeout with an error that says what to check. Through a
 * tunnel the likely cause is the tunnel itself, not the database.
 */
export function explainConnectTimeout(error: unknown, config: ResolvedConnectionConfig): unknown {
    const name = config.connectionName;
    const nextSteps = name
        ? `Restart the tunnel with 'sherlock tunnel stop ${name}' and try again, or run 'sherlock doctor ${name}'.`
        : '';

    if (config.tunnelled && isClosedBeforeEstablished(error)) {
        return new Error(
            `The tunnel accepted the connection and then closed it before the database answered, so ` +
            `the tunnel's far end is the problem: the forward may have lost its link, or a proxy or ` +
            `firewall may be blocking it. ${nextSteps}`.trim()
        );
    }

    if (!isConnectTimeoutError(error)) return error;

    const waited = formatMs(connectTimeoutFor(config));
    const setting = 'Raise "connectTimeout" on the connection if the database is just slow to answer.';

    if (config.tunnelled && name) {
        return new Error(
            `The database did not answer within ${waited}. The connection goes through a tunnel, which ` +
            `accepted the connection locally, so the tunnel's far end is the likely problem: the ` +
            `forward may have lost its link, or a proxy or firewall may be blocking it. ` +
            `${nextSteps} ${setting}`
        );
    }

    return new Error(
        `The database did not answer within ${waited}. Check that the host and port are right and ` +
        `reachable from this machine` +
        (name ? `, or run 'sherlock doctor ${name}'` : '') +
        `. ${setting}`
    );
}
