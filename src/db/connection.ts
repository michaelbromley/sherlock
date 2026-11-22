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
import { parseDuration } from '../tunnel/config';
import { connectTimeoutFor, connectTimeoutSeconds, explainConnectTimeout } from './connect-timeout';
import {
    DEFAULT_STATEMENT_TIMEOUT,
    explainTimeout,
    isUnknownVariableError,
    readOnlyWrapper,
    runWrapped,
    type MysqlTimeoutVariable,
    type StatementRunner,
} from './read-only';

/** Re-export SqlAdapter so callers can use it as a type */
export type { SqlAdapter };

/** Per-invocation overrides of the connection's own settings */
export interface ConnectionOptions {
    /** Statement timeout in milliseconds, overriding the connection's */
    statementTimeoutMs?: number;
}

/** The statement timeout to use: an override, the connection's own, or the default */
function statementTimeoutFor(config: ResolvedConnectionConfig, options?: ConnectionOptions): number {
    return options?.statementTimeoutMs
        ?? config.statementTimeoutMs
        ?? parseDuration(DEFAULT_STATEMENT_TIMEOUT);
}

/**
 * Create a connection from resolved config.
 * Returns a SqlAdapter (either a Bun SQL wrapper or MssqlAdapter).
 *
 * Every statement run through the adapter is read-only at the database level
 * as well as by sherlock's guard: see `./read-only`.
 */
export async function createConnection(
    config: ResolvedConnectionConfig,
    options?: ConnectionOptions
): Promise<SqlAdapter> {
    const timeoutMs = statementTimeoutFor(config, options);

    if (config.type === DB_TYPES.MSSQL) {
        const adapter = await MssqlAdapter.connect(config.url, {
            requestTimeoutMs: timeoutMs,
            connectTimeoutMs: connectTimeoutFor(config),
        }).catch((error) => {
            throw explainConnectTimeout(error, config);
        });
        return {
            unsafe: (query: string) => adapter.unsafe(query).catch((error) => {
                throw explainTimeout(error, timeoutMs);
            }),
            close: () => adapter.close(),
        };
    }

    const sql = openBunSql(config);

    if (config.type === DB_TYPES.SQLITE) {
        // A local file: no transaction or timeout needed, but the connection
        // itself refuses writes. Bun.SQL holds one connection for SQLite, so
        // setting the pragma once covers every later statement.
        let readOnly: Promise<unknown> | null = null;
        return {
            unsafe: async (query: string) => {
                readOnly ??= sql.unsafe('PRAGMA query_only = ON');
                await readOnly;
                return (await sql.unsafe(query)) as unknown[];
            },
            close: () => sql.close(),
        };
    }

    // MySQL and MariaDB name the timeout variable differently. Try MySQL's
    // first and remember which one the server knows.
    let mysqlVariable: MysqlTimeoutVariable = 'max_execution_time';

    const runReadOnly = async (query: string): Promise<unknown[]> => {
        const wrapper = readOnlyWrapper(config.type, timeoutMs, mysqlVariable);
        if (!wrapper) return (await sql.unsafe(query)) as unknown[];

        // MySQL is opened with a single connection (see openBunSql), so every
        // statement already shares one session.
        if (config.type === DB_TYPES.MYSQL) {
            return runWrapped(sql as unknown as StatementRunner, wrapper, query);
        }

        // Elsewhere, reserve a connection so the transaction and the statement
        // are guaranteed to share a session.
        const reserved = await sql.reserve();
        try {
            return await runWrapped(reserved, wrapper, query);
        } finally {
            reserved.release();
        }
    };

    // Statements are run one at a time. On a single connection, two wrapped
    // statements running at once would interleave inside one transaction.
    let queue: Promise<unknown> = Promise.resolve();
    const serially = <T>(task: () => Promise<T>): Promise<T> => {
        const run = queue.then(task, task);
        queue = run.catch(() => undefined);
        return run;
    };

    return {
        unsafe: (query: string) => serially(async () => {
            try {
                return await runReadOnly(query);
            } catch (error) {
                if (
                    config.type === DB_TYPES.MYSQL &&
                    mysqlVariable === 'max_execution_time' &&
                    isUnknownVariableError(error)
                ) {
                    mysqlVariable = 'max_statement_time';
                    return runReadOnly(query).catch((retryError) =>
                        explainConnectError(explainTimeout(explainConnectTimeout(retryError, config), timeoutMs))
                    );
                }
                return explainConnectError(explainTimeout(explainConnectTimeout(error, config), timeoutMs));
            }
        }),
        close: () => sql.close(),
    };
}

/**
 * Bun.SQL reads `allowPublicKeyRetrieval` only from its constructor options,
 * not from the URL, so move it out of the URL.
 */
function openBunSql(config: ResolvedConnectionConfig): SQL {
    const connectionTimeout = connectTimeoutSeconds(connectTimeoutFor(config));
    if (config.type !== DB_TYPES.MYSQL) {
        // SQLite opens a file and has no connect timeout to set.
        return config.type === DB_TYPES.SQLITE ? new SQL(config.url) : new SQL(config.url, { connectionTimeout });
    }

    // One connection, so the session settings and the transaction that the
    // read-only wrapper opens apply to the statement that follows. Bun.SQL's
    // reserve() cannot be used for this: after a SET SESSION on a reserved
    // MySQL connection, the next reserve() never settles.
    const pool = { max: 1, connectionTimeout };

    let parsed: URL;
    try {
        parsed = new URL(config.url);
    } catch {
        // Leave the error to Bun.SQL, which reports unparseable URLs itself
        return new SQL(config.url, pool);
    }
    const allowPublicKeyRetrieval = parseBoolParam(parsed.searchParams.get(PUBLIC_KEY_RETRIEVAL_PARAM)) === true;
    parsed.searchParams.delete(PUBLIC_KEY_RETRIEVAL_PARAM);
    // The Bun runtime supports this option, but the pinned bun-types predate it
    const options = { ...pool, allowPublicKeyRetrieval } as Bun.SQL.PostgresOrMySQLOptions;
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
            'If the server does not support TLS and you trust the network between you and the ' +
            'server (localhost, an SSH tunnel), set "allowPublicKeyRetrieval": true, or add ' +
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
    handler: (sql: SqlAdapter, dbType: string) => Promise<T>,
    options?: ConnectionOptions
): Promise<T> {
    let sql: SqlAdapter | null = null;

    try {
        sql = await createConnection(config, options);
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
    handler: (sql: SqlAdapter, dbType: string) => Promise<T>,
    options?: ConnectionOptions
): Promise<T> {
    let sql: SqlAdapter | null = null;
    let stopKeepalive: (() => void) | null = null;

    try {
        const config = await resolveConnection(connectionName, configPath);
        stopKeepalive = startTunnelKeepalive(connectionName);
        sql = await createConnection(config, options);
        return await handler(sql, config.type);
    } finally {
        stopKeepalive?.();
        if (sql) {
            await sql.close();
        }
    }
}
