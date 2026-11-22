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
import { SherlockError } from '../errors';

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

const REFUSED_CODES = new Set([
    'ERR_POSTGRES_CONNECTION_REFUSED',
    'ERR_MYSQL_CONNECTION_REFUSED',
    'ERR_REDIS_CONNECTION_CLOSED',
]);

/**
 * Whether an error says nothing was listening, or the host does not resolve.
 * Bun reports both as "Failed to connect", and Redis as "Max reconnection
 * attempts reached", without saying where.
 */
function isRefused(error: unknown): boolean {
    const { code, name, message } = (error ?? {}) as { code?: unknown; name?: unknown; message?: unknown };
    if (typeof code === 'string' && REFUSED_CODES.has(code)) return true;
    // mssql: ESOCKET, "Failed to connect to host:port - ..."
    return name === 'ConnectionError' && code === 'ESOCKET' ||
        (typeof message === 'string' && (
            /^(failed to connect|max reconnection attempts reached)$/i.test(message.trim()) ||
            // Bun, when no socket can be opened at all: no route, or the network refused it
            /^FailedToOpenSocket\b/.test(message)
        ));
}

/** The host and port of a connection URL, never its credentials */
function endpointOf(url: string): { host: string; port?: number } | null {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname) return null;
        return parsed.port ? { host: parsed.hostname, port: Number(parsed.port) } : { host: parsed.hostname };
    } catch {
        return null;
    }
}

/**
 * Replace a failed connection with an error that says where it failed and
 * what to check. Through a tunnel the likely cause is the tunnel itself, not
 * the database. Errors that are not about reaching the server pass through.
 */
export function explainConnectFailure(error: unknown, config: ResolvedConnectionConfig): unknown {
    const name = config.connectionName;
    const endpoint = endpointOf(config.url);
    const where = endpoint ? (endpoint.port ? `${endpoint.host}:${endpoint.port}` : endpoint.host) : null;
    const tunnelFix = name
        ? `Restart the tunnel with 'sherlock tunnel stop ${name}' and try again, or run 'sherlock doctor ${name}'.`
        : undefined;
    const tunnelDetails = { provider: config.tunnelProvider, ...endpoint };

    if (config.tunnelled && isClosedBeforeEstablished(error)) {
        return new SherlockError(
            'TUNNEL_DOWN',
            `The tunnel accepted the connection and then closed it before the database answered, so ` +
            `the tunnel's far end is the problem: the forward may have lost its link, or a proxy or ` +
            `firewall may be blocking it.`,
            { fix: tunnelFix, details: tunnelDetails, cause: error }
        );
    }

    if (isRefused(error)) {
        if (config.tunnelled) {
            return new SherlockError(
                'TUNNEL_DOWN',
                `Could not connect to the tunnel${where ? ` on ${where}` : ''}: it is no longer accepting connections.`,
                { fix: tunnelFix, details: tunnelDetails, cause: error }
            );
        }
        return new SherlockError(
            'CONNECT_REFUSED',
            `Could not connect to ${where ?? 'the database'}: nothing answered there, or the host name does not resolve.`,
            {
                fix: `Check the host and port${name ? `, or run 'sherlock doctor ${name}'` : ''}. ` +
                    `A database that is only reachable through a port-forward needs a "tunnel" on the connection.`,
                details: { ...endpoint },
                cause: error,
            }
        );
    }

    if (!isConnectTimeoutError(error)) return error;

    const timeoutMs = connectTimeoutFor(config);
    const waited = formatMs(timeoutMs);
    const setting = 'Raise "connectTimeout" on the connection if the database is just slow to answer.';
    const details = { ...endpoint, timeoutMs };

    if (config.tunnelled && name) {
        return new SherlockError(
            'CONNECT_TIMEOUT',
            `The database did not answer within ${waited}. The connection goes through a tunnel, which ` +
            `accepted the connection locally, so the tunnel's far end is the likely problem: the ` +
            `forward may have lost its link, or a proxy or firewall may be blocking it.`,
            { fix: `${tunnelFix} ${setting}`, details, cause: error }
        );
    }

    return new SherlockError(
        'CONNECT_TIMEOUT',
        `The database did not answer within ${waited}.`,
        {
            fix: `Check that the host and port are right and reachable from this machine` +
                (name ? `, or run 'sherlock doctor ${name}'` : '') + `. ${setting}`,
            details,
            cause: error,
        }
    );
}
