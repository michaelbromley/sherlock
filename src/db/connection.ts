/**
 * Database connection handling
 * Manages creating and using database connections
 */

import { SQL } from 'bun';
import { resolveConnection, PUBLIC_KEY_RETRIEVAL_PARAM } from '../config';
import { startTunnelKeepalive } from '../tunnel/manager';
import type { ResolvedConnectionConfig } from '../config/types';
import { DB_TYPES, parseBoolParam } from '../db-types';
import { MssqlAdapter, type SqlAdapter } from './mssql-adapter';

/** Re-export SqlAdapter so callers can use it as a type */
export type { SqlAdapter };

/**
 * Create a connection from resolved config.
 * Returns a SqlAdapter (either a Bun SQL wrapper or MssqlAdapter).
 */
export async function createConnection(config: ResolvedConnectionConfig): Promise<SqlAdapter> {
    if (config.type === DB_TYPES.MSSQL) {
        return MssqlAdapter.connect(config.url);
    }

    // Wrap Bun.SQL to match SqlAdapter interface
    const sql = openBunSql(config);
    return {
        unsafe: (query: string) => (sql.unsafe(query) as Promise<unknown[]>).catch(explainConnectError),
        close: () => sql.close(),
    };
}

/**
 * Bun.SQL reads `allowPublicKeyRetrieval` only from its constructor options,
 * not from the URL, so move it out of the URL.
 */
function openBunSql(config: ResolvedConnectionConfig): SQL {
    if (config.type !== DB_TYPES.MYSQL) return new SQL(config.url);

    let parsed: URL;
    try {
        parsed = new URL(config.url);
    } catch {
        // Leave the error to Bun.SQL, which reports unparseable URLs itself
        return new SQL(config.url);
    }
    const allowPublicKeyRetrieval = parseBoolParam(parsed.searchParams.get(PUBLIC_KEY_RETRIEVAL_PARAM)) === true;
    parsed.searchParams.delete(PUBLIC_KEY_RETRIEVAL_PARAM);
    // The Bun runtime supports this option, but the pinned bun-types predate it
    const options = { allowPublicKeyRetrieval } as Bun.SQL.PostgresOrMySQLOptions;
    return new SQL(parsed.toString(), options);
}

/**
 * Replace Bun's MySQL public key error, which names a Bun option, with one
 * that names the sherlock settings that fix it.
 */
function explainConnectError(error: unknown): never {
    if ((error as { code?: string } | null)?.code === 'ERR_MYSQL_PUBLIC_KEY_RETRIEVAL_NOT_ALLOWED') {
        throw new Error(
            'MySQL needs TLS or the server\'s RSA public key to log in this user (caching_sha2_password). ' +
            'Set "ssl": true on the connection, or add ?ssl-mode=REQUIRED to the URL. ' +
            'If the server does not support TLS, set "allowPublicKeyRetrieval": true, or add ' +
            '?allowPublicKeyRetrieval=true to the URL. Without TLS, anyone who can intercept the ' +
            'connection can substitute their own key and read the password.'
        );
    }
    throw error;
}

/**
 * Execute a command with a pre-resolved connection config
 * Skips the name-based config lookup — used for ad hoc --url connections
 */
export async function withConnectionFromConfig<T>(
    config: ResolvedConnectionConfig,
    handler: (sql: SqlAdapter, dbType: string) => Promise<T>
): Promise<T> {
    let sql: SqlAdapter | null = null;

    try {
        sql = await createConnection(config);
        return await handler(sql, config.type);
    } finally {
        if (sql) {
            await sql.close();
        }
    }
}

/**
 * Execute a command with a database connection
 * Automatically handles connection lifecycle (open/close)
 */
export async function withConnection<T>(
    connectionName: string,
    configPath: string | undefined,
    handler: (sql: SqlAdapter, dbType: string) => Promise<T>
): Promise<T> {
    let sql: SqlAdapter | null = null;
    let stopKeepalive: (() => void) | null = null;

    try {
        const config = await resolveConnection(connectionName, configPath);
        stopKeepalive = startTunnelKeepalive(connectionName);
        sql = await createConnection(config);
        return await handler(sql, config.type);
    } finally {
        stopKeepalive?.();
        if (sql) {
            await sql.close();
        }
    }
}
