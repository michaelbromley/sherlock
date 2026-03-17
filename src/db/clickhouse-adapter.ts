/**
 * ClickHouse adapter
 * Wraps the `@clickhouse/client` package to provide the same interface as Bun.SQL
 */

import { createClient, ClickHouseLogLevel, type ClickHouseClient } from '@clickhouse/client';
import type { SqlAdapter } from './mssql-adapter';

export class ClickhouseAdapter implements SqlAdapter {
    private constructor(private client: ClickHouseClient) {}

    static async connect(url: string): Promise<ClickhouseAdapter> {
        const parsed = new URL(url);
        const useTls = parsed.protocol === 'clickhouses:';
        const defaultPort = useTls ? 8443 : 8123;
        const client = createClient({
            url: `${useTls ? 'https' : 'http'}://${parsed.hostname}:${parsed.port || defaultPort}`,
            username: decodeURIComponent(parsed.username) || 'default',
            password: decodeURIComponent(parsed.password) || '',
            database: parsed.pathname.replace(/^\//, '') || 'default',
            log: { level: ClickHouseLogLevel.OFF },
        });
        // Verify connectivity
        await client.query({ query: 'SELECT 1', format: 'JSONEachRow' });
        return new ClickhouseAdapter(client);
    }

    async unsafe(query: string): Promise<unknown[]> {
        const result = await this.client.query({
            query,
            format: 'JSONEachRow',
        });
        return result.json();
    }

    async close(): Promise<void> {
        await this.client.close();
    }
}
