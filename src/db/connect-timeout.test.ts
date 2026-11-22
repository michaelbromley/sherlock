import { describe, it, expect } from 'bun:test';
import * as net from 'node:net';
import { connectTimeoutFor, connectTimeoutSeconds, explainConnectFailure, isConnectTimeoutError } from './connect-timeout';
import { createConnection } from './connection';
import { createRedisConnection } from '../redis/connection';

const timeoutError = (code: string) => Object.assign(new Error('Connection timeout after 10s'), { code });

describe('connect timeout settings', () => {
    it('defaults to 10s and honours the connection setting', () => {
        expect(connectTimeoutFor({ type: 'postgres', url: 'x' })).toBe(10_000);
        expect(connectTimeoutFor({ type: 'postgres', url: 'x', connectTimeoutMs: 2500 })).toBe(2500);
    });

    it('rounds up to whole seconds for Bun.SQL, never to zero', () => {
        expect(connectTimeoutSeconds(2500)).toBe(3);
        expect(connectTimeoutSeconds(10_000)).toBe(10);
        expect(connectTimeoutSeconds(1)).toBe(1);
    });
});

describe('explainConnectFailure', () => {
    it.each(['ERR_POSTGRES_CONNECTION_TIMEOUT', 'ERR_MYSQL_CONNECTION_TIMEOUT', 'ERR_REDIS_CONNECTION_TIMEOUT'])(
        'recognises %s', (code) => expect(isConnectTimeoutError(timeoutError(code))).toBe(true)
    );

    it('recognises the mssql timeout', () => {
        const error = Object.assign(new Error('Failed to connect to db:1433 in 10000ms'), { name: 'ConnectionError', code: 'ETIMEOUT' });
        expect(isConnectTimeoutError(error)).toBe(true);
    });

    it('points at the tunnel when the connection goes through one', () => {
        const explained = explainConnectFailure(timeoutError('ERR_POSTGRES_CONNECTION_TIMEOUT'), {
            type: 'postgres', url: 'x', connectionName: 'prod', tunnelled: true, connectTimeoutMs: 5000,
        }) as Error;
        expect(explained.message).toMatch(/did not answer within 5s.*goes through a tunnel.*sherlock tunnel stop prod.*sherlock doctor prod.*"connectTimeout"/);
    });

    it('points at the host and port when there is no tunnel', () => {
        const explained = explainConnectFailure(timeoutError('ERR_MYSQL_CONNECTION_TIMEOUT'), { type: 'mysql', url: 'x' }) as Error;
        expect(explained.message).toMatch(/did not answer within 10s. Check that the host and port/);
        expect(explained.message).not.toMatch(/tunnel/);
    });

    it('explains a connection the tunnel closed before the database answered', () => {
        const closed = Object.assign(new Error('Connection closed before the connection was established'), { code: 'ERR_POSTGRES_CONNECTION_FAILED' });
        const explained = explainConnectFailure(closed, { type: 'postgres', url: 'x', connectionName: 'prod', tunnelled: true }) as Error;
        expect(explained.message).toMatch(/tunnel accepted the connection and then closed it.*sherlock tunnel stop prod/);
        // Without a tunnel the driver's own message is accurate already.
        expect(explainConnectFailure(closed, { type: 'postgres', url: 'x' })).toBe(closed);
    });

    it('leaves other errors alone', () => {
        const error = new Error('password authentication failed');
        expect(explainConnectFailure(error, { type: 'postgres', url: 'x' })).toBe(error);
    });
});

// A server that accepts connections and never answers: what a tunnel with a
// dead far end looks like from this side.
describe('a database that never answers', () => {
    async function withSilentServer<T>(fn: (port: number) => Promise<T>): Promise<T> {
        const sockets: net.Socket[] = [];
        const server = net.createServer((socket) => { sockets.push(socket); });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        try {
            return await fn((server.address() as net.AddressInfo).port);
        } finally {
            sockets.forEach((socket) => socket.destroy());
            server.close();
        }
    }

    it.each([
        ['postgres', (port: number) => `postgres://u:p@127.0.0.1:${port}/db`],
        ['mysql', (port: number) => `mysql://u:p@127.0.0.1:${port}/db`],
    ] as const)('fails a %s connection within the connect timeout, naming the tunnel', async (type, url) => {
        await withSilentServer(async (port) => {
            const started = Date.now();
            const sql = await createConnection({
                type, url: url(port), connectTimeoutMs: 1000, connectionName: 'prod', tunnelled: true,
            });
            try {
                await expect(sql.unsafe('SELECT 1')).rejects.toThrow(/did not answer within 1s.*tunnel/);
            } finally {
                await sql.close();
            }
            expect(Date.now() - started).toBeLessThan(5000);
        });
    }, 10_000);

    it('fails a Redis connection within the connect timeout', async () => {
        await withSilentServer(async (port) => {
            const client = createRedisConnection({ type: 'redis', url: `redis://127.0.0.1:${port}`, connectTimeoutMs: 1000 });
            const started = Date.now();
            try {
                await expect(client.send('PING', [])).rejects.toMatchObject({ code: 'ERR_REDIS_CONNECTION_TIMEOUT' });
            } finally {
                client.close();
            }
            expect(Date.now() - started).toBeLessThan(5000);
        });
    }, 10_000);
});

describe('explainConnectFailure for unreachable servers', () => {
    const refused = (code: string, message = 'Failed to connect') => Object.assign(new Error(message), { code });

    it('names the host and port, never the credentials', () => {
        const explained = explainConnectFailure(refused('ERR_POSTGRES_CONNECTION_REFUSED'), {
            type: 'postgres', url: 'postgres://app:hunter2@db.internal:5433/app', connectionName: 'prod',
        }) as Error;
        expect(explained.message).toMatch(/Could not connect to db.internal:5433: nothing answered.*sherlock doctor prod.*"tunnel"/);
        expect(explained.message).not.toContain('hunter2');
    });

    it('covers MySQL and Redis, whose messages say even less', () => {
        expect((explainConnectFailure(refused('ERR_MYSQL_CONNECTION_REFUSED'), { type: 'mysql', url: 'mysql://u@h:3306/d' }) as Error).message)
            .toMatch(/Could not connect to h:3306/);
        expect((explainConnectFailure(refused('ERR_REDIS_CONNECTION_CLOSED', 'Max reconnection attempts reached'), { type: 'redis', url: 'redis://cache:6379' }) as Error).message)
            .toMatch(/Could not connect to cache:6379/);
    });

    it('says the tunnel stopped accepting when the connection goes through one', () => {
        const explained = explainConnectFailure(refused('ERR_POSTGRES_CONNECTION_REFUSED'), {
            type: 'postgres', url: 'postgres://u:p@127.0.0.1:40001/d', connectionName: 'prod', tunnelled: true,
        }) as Error;
        expect(explained.message).toMatch(/tunnel on 127.0.0.1:40001: it is no longer accepting.*sherlock tunnel stop prod/);
    });
});
