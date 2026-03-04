/**
 * MSSQL adapter
 * Wraps the `mssql` npm package to provide the same interface as Bun.SQL
 */

import mssql from 'mssql';

/** Common interface for database connections (Bun SQL or MSSQL adapter) */
export interface SqlAdapter {
    unsafe(query: string): Promise<unknown[]>;
    close(): void | Promise<void>;
}

/** Parse an mssql:// URL into a mssql ConnectionConfig */
function parseMssqlUrl(url: string): mssql.config {
    const parsed = new URL(url);
    return {
        server: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 1433,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, ''),
        options: {
            encrypt: false,
            trustServerCertificate: true,
        },
    };
}

export class MssqlAdapter implements SqlAdapter {
    private constructor(private pool: mssql.ConnectionPool) {}

    static async connect(url: string): Promise<MssqlAdapter> {
        const config = parseMssqlUrl(url);
        const pool = await new mssql.ConnectionPool(config).connect();
        return new MssqlAdapter(pool);
    }

    async unsafe(query: string): Promise<unknown[]> {
        const result = await this.pool.request().query(query);
        return result.recordset ?? [];
    }

    async close(): Promise<void> {
        await this.pool.close();
    }
}
