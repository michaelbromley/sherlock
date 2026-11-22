/**
 * MSSQL adapter
 * Wraps the `mssql` npm package to provide the same interface as Bun.SQL
 */

import mssql from 'mssql';
import { parseBoolParam } from '../db-types';

/** Common interface for database connections (Bun SQL or MSSQL adapter) */
export interface SqlAdapter {
    unsafe(query: string): Promise<unknown[]>;
    close(): void | Promise<void>;
}

/** Parse an mssql:// URL into a mssql ConnectionConfig */
export function parseMssqlUrl(url: string, requestTimeoutMs?: number, connectTimeoutMs?: number): mssql.config {
    const parsed = new URL(url);
    // Backwards-compatible defaults: no encryption, trust whatever cert is presented.
    // SSL is opt-in via the ssl config (which sets encrypt/trustServerCertificate query params).
    const encrypt = parseBoolParam(parsed.searchParams.get('encrypt')) ?? false;
    const trustServerCertificate =
        parseBoolParam(parsed.searchParams.get('trustServerCertificate')) ?? true;

    return {
        server: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 1433,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, ''),
        ...(requestTimeoutMs !== undefined ? { requestTimeout: requestTimeoutMs } : {}),
        ...(connectTimeoutMs !== undefined ? { connectionTimeout: connectTimeoutMs } : {}),
        options: {
            encrypt,
            trustServerCertificate,
        },
    };
}

export class MssqlAdapter implements SqlAdapter {
    private constructor(private pool: mssql.ConnectionPool) {}

    static async connect(
        url: string,
        options: { requestTimeoutMs?: number; connectTimeoutMs?: number } = {}
    ): Promise<MssqlAdapter> {
        const config = parseMssqlUrl(url, options.requestTimeoutMs, options.connectTimeoutMs);
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
