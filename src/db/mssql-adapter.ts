/**
 * MSSQL adapter
 * Wraps the `mssql` npm package in the adapter every driver offers
 */

import mssql from 'mssql';
import { parseBoolParam } from '../db-types';
import { FETCH_BATCH_ROWS, RowCollector, type Column, type FetchOptions, type FetchedRows, type SqlAdapter } from './adapter';

export type { SqlAdapter };

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

    async unsafe(query: string): Promise<Record<string, unknown>[]> {
        const result = await this.pool.request().query(query);
        return result.recordset ?? [];
    }

    /**
     * Stream the first result set of the user's statement, rows as arrays,
     * cancelling the request once enough rows have arrived. SQL Server has no
     * read-only transaction; the request timeout still applies.
     */
    fetch(query: string, options: FetchOptions = {}): Promise<FetchedRows> {
        const collector = new RowCollector(options);
        let columns: Column[] = [];
        let batch: unknown[][] = [];
        let resultSets = 0;
        let cancelled = false;

        return new Promise((resolve, reject) => {
            const request = this.pool.request() as mssql.Request & { arrayRowMode: boolean };
            request.stream = true;
            request.arrayRowMode = true;
            const flush = () => {
                if (batch.length === 0) return false;
                const full = collector.add(batch);
                batch = [];
                return full;
            };

            request.on('recordset', (recordsetColumns: unknown) => {
                resultSets += 1;
                if (resultSets > 1) return;
                // In array row mode the columns are an array, so duplicate names survive.
                columns = (recordsetColumns as Array<{ name: string; type?: { declaration?: string; name?: string } }>)
                    .map((column) => {
                        const type = column.type?.declaration ?? column.type?.name;
                        return type ? { name: column.name, type: type.toLowerCase() } : { name: column.name };
                    });
                collector.setColumns(columns);
            });
            request.on('row', (row: unknown[]) => {
                if (resultSets > 1 || cancelled) return;
                batch.push(row);
                const limit = options.maxRows !== undefined ? options.maxRows + 1 : FETCH_BATCH_ROWS;
                if (batch.length >= limit && flush()) {
                    cancelled = true;
                    request.cancel();
                }
            });
            request.on('error', (error: { code?: string }) => {
                // Cancelling is how the read stops; it arrives as an error.
                if (cancelled && error.code === 'ECANCEL') return;
                reject(error);
            });
            request.on('done', () => {
                if (!cancelled) flush();
                resolve(collector.result(columns));
            });
            request.query(query);
        });
    }

    async close(): Promise<void> {
        await this.pool.close();
    }
}
