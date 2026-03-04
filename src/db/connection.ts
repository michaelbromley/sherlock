/**
 * Database connection handling
 * Manages creating and using database connections
 */

import { SQL } from 'bun';
import { resolveConnection } from '../config';
import type { ResolvedConnectionConfig } from '../config/types';
import { DB_TYPES } from '../db-types';
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
    const sql = new SQL(config.url);
    return {
        unsafe: (query: string) => sql.unsafe(query) as Promise<unknown[]>,
        close: () => sql.close(),
    };
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

    try {
        const config = await resolveConnection(connectionName, configPath);
        sql = await createConnection(config);
        return await handler(sql, config.type);
    } finally {
        if (sql) {
            await sql.close();
        }
    }
}
