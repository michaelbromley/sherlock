/**
 * Database connection handling: open the driver for a connection's type, and
 * classify everything it throws.
 *
 *   PostgreSQL  the `postgres` package     ./drivers/postgres
 *   MySQL       `mysql2`                    ./drivers/mysql
 *   SQLite      `bun:sqlite`                ./drivers/sqlite
 *   SQL Server  `mssql`                     ./mssql-adapter
 *
 * Every statement run through the adapter is read-only at the database level
 * as well as by sherlock's guard: see `./read-only`.
 */

import { resolveConnection } from '../config';
import { startTunnelKeepalive } from '../tunnel/manager';
import type { ResolvedConnectionConfig } from '../config/types';
import { DB_TYPES } from '../db-types';
import { MssqlAdapter } from './mssql-adapter';
import type { SqlAdapter } from './adapter';
import { parseDuration } from '../tunnel/config';
import type { WarningSink } from '../output/warnings';
import { connectTimeoutFor } from './connect-timeout';
import { classifyDbError } from './errors';
import { DEFAULT_STATEMENT_TIMEOUT } from './read-only';
import { openPostgres } from './drivers/postgres';
import { openMysql } from './drivers/mysql';
import { openSqlite } from './drivers/sqlite';

/** Re-export SqlAdapter so callers can use it as a type */
export type { SqlAdapter };

/** Per-invocation overrides of the connection's own settings */
export interface ConnectionOptions {
    /** Statement timeout in milliseconds, overriding the connection's */
    statementTimeoutMs?: number;
    /** Where warnings met while resolving the connection go; stderr when not given */
    warnings?: WarningSink;
}

/** The statement timeout to use: an override, the connection's own, or the default */
function statementTimeoutFor(config: ResolvedConnectionConfig, options?: ConnectionOptions): number {
    return options?.statementTimeoutMs
        ?? config.statementTimeoutMs
        ?? parseDuration(DEFAULT_STATEMENT_TIMEOUT);
}

/** Open the driver for the connection's type */
async function openDriver(config: ResolvedConnectionConfig, statementTimeoutMs: number): Promise<SqlAdapter> {
    const connectTimeoutMs = connectTimeoutFor(config);
    switch (config.type) {
        case DB_TYPES.POSTGRES:
            return openPostgres({ url: config.url, connectTimeoutMs, statementTimeoutMs });
        case DB_TYPES.MYSQL:
            return openMysql({ url: config.url, connectTimeoutMs, statementTimeoutMs });
        case DB_TYPES.SQLITE:
            return openSqlite(config.url);
        case DB_TYPES.MSSQL:
            return MssqlAdapter.connect(config.url, { requestTimeoutMs: statementTimeoutMs, connectTimeoutMs });
        default:
            throw new Error(`Unsupported database type: ${config.type}`);
    }
}

/**
 * Create a connection from resolved config. Whatever the driver throws,
 * opening or running a statement, comes out classified.
 */
export async function createConnection(
    config: ResolvedConnectionConfig,
    options?: ConnectionOptions
): Promise<SqlAdapter> {
    const timeoutMs = statementTimeoutFor(config, options);
    const classified = <T>(run: () => Promise<T>): Promise<T> =>
        run().catch((error: unknown) => {
            throw classifyDbError(error, config, timeoutMs);
        });

    const adapter = await classified(() => openDriver(config, timeoutMs));
    return {
        unsafe: (query) => classified(() => adapter.unsafe(query)),
        fetch: (query, fetchOptions) => classified(() => adapter.fetch(query, fetchOptions)),
        close: () => adapter.close(),
    };
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
        const config = await resolveConnection(connectionName, configPath, options?.warnings);
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
