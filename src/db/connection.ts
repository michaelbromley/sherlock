/**
 * Database connection handling
 * Manages creating and using database connections
 */

import { SQL } from 'bun';
import { resolveConnection } from '../config';
import type { ResolvedConnectionConfig } from '../config/types';

/**
 * Create a Bun.SQL connection from resolved config
 */
export function createConnection(config: ResolvedConnectionConfig): ReturnType<typeof SQL> {
    return new SQL(config.url);
}

/**
 * Execute a command with a database connection
 * Automatically handles connection lifecycle (open/close)
 */
export async function withConnection<T>(
    connectionName: string,
    configPath: string | undefined,
    handler: (sql: ReturnType<typeof SQL>, dbType: string) => Promise<T>
): Promise<T> {
    let sql: ReturnType<typeof SQL> | null = null;

    try {
        const config = await resolveConnection(connectionName, configPath);
        sql = createConnection(config);
        return await handler(sql, config.type);
    } finally {
        if (sql) {
            sql.close();
        }
    }
}
