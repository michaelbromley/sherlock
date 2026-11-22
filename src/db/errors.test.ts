import { describe, it, expect } from 'bun:test';
import { classifyDbError } from './errors';
import { SherlockError } from '../errors';
import type { ResolvedConnectionConfig } from '../config/types';

/** A driver error with the fields the real drivers set, as captured from each */
function driverError(name: string, message: string, fields: Record<string, unknown>): Error {
    return Object.assign(new Error(message), { name, ...fields });
}

const PG: ResolvedConnectionConfig = { type: 'postgres', url: 'postgres://app:hunter2@db:5432/app', connectionName: 'prod' };
const MYSQL: ResolvedConnectionConfig = { type: 'mysql', url: 'mysql://root:hunter2@db:3306/app' };
const MSSQL: ResolvedConnectionConfig = { type: 'mssql', url: 'mssql://sa:hunter2@db:1433/master' };
const SQLITE: ResolvedConnectionConfig = { type: 'sqlite', url: 'file:///tmp/app.db' };
const REDIS: ResolvedConnectionConfig = { type: 'redis', url: 'redis://:hunter2@cache:6379/0' };

function classify(error: unknown, config: ResolvedConnectionConfig, timeoutMs?: number): SherlockError {
    const result = classifyDbError(error, config, timeoutMs);
    expect(result).toBeInstanceOf(SherlockError);
    return result as SherlockError;
}

describe('classifyDbError', () => {
    const cases: Array<[string, unknown, ResolvedConnectionConfig, string, Record<string, unknown> | undefined]> = [
        ['PostgreSQL wrong password',
            driverError('PostgresError', 'password authentication failed for user "app"', { code: '28P01', severity: 'FATAL' }),
            PG, 'AUTH_FAILED', { username: 'app' }],
        ['MySQL wrong password',
            driverError('Error', "Access denied for user 'root'@'172.17.0.1' (using password: YES)", { code: 'ER_ACCESS_DENIED_ERROR', errno: 1045, sqlState: '28000' }),
            MYSQL, 'AUTH_FAILED', { username: 'root' }],
        ['SQL Server login failed',
            driverError('ConnectionError', "Login failed for user 'sa'.", { code: 'ELOGIN' }),
            MSSQL, 'AUTH_FAILED', { username: 'sa' }],
        ['Redis wrong password',
            new Error('WRONGPASS invalid username-password pair or user is disabled.'),
            REDIS, 'AUTH_FAILED', undefined],
        ['PostgreSQL without TLS',
            driverError('Error', 'SSL_NOT_SUPPORTED: The server does not support SSL connections', { code: 'SSL_NOT_SUPPORTED' }),
            PG, 'TLS_FAILED', { reason: 'SSL_NOT_SUPPORTED' }],
        ['MySQL TLS handshake failure',
            driverError('Error', 'self signed certificate in certificate chain', { code: 'HANDSHAKE_SSL_ERROR', errno: 0 }),
            MYSQL, 'TLS_FAILED', { reason: 'HANDSHAKE_SSL_ERROR' }],
        ['a certificate that does not verify',
            Object.assign(new Error('self signed certificate in certificate chain'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }),
            PG, 'TLS_FAILED', { reason: 'SELF_SIGNED_CERT_IN_CHAIN' }],
        ['MySQL asking for the public key',
            driverError('Error', 'The server requested RSA public key retrieval', { code: 'PUBLIC_KEY_RETRIEVAL_NOT_ALLOWED' }),
            MYSQL, 'TLS_FAILED', { reason: 'PUBLIC_KEY_RETRIEVAL' }],
        ['PostgreSQL write in a read-only transaction',
            driverError('PostgresError', 'cannot execute nextval() in a read-only transaction', { code: '25006' }),
            PG, 'READ_ONLY_VIOLATION', { dbCode: '25006' }],
        ['MySQL write in a read-only transaction',
            driverError('Error', 'Cannot execute statement in a READ ONLY transaction.', { code: 'ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION', errno: 1792, sqlState: '25006' }),
            MYSQL, 'READ_ONLY_VIOLATION', { dbCode: 1792 }],
        ['SQLite write on a query_only connection',
            driverError('SQLiteError', 'attempt to write a readonly database', { code: 'SQLITE_READONLY', errno: 8 }),
            SQLITE, 'READ_ONLY_VIOLATION', { dbCode: 'SQLITE_READONLY' }],
        ['PostgreSQL unknown column',
            driverError('PostgresError', 'column "nope" does not exist', { code: '42703' }),
            PG, 'QUERY_FAILED', { dbCode: '42703' }],
        ['MySQL unknown column',
            driverError('Error', "Unknown column 'nope' in 'field list'", { code: 'ER_BAD_FIELD_ERROR', errno: 1054, sqlState: '42S22' }),
            MYSQL, 'QUERY_FAILED', { dbCode: 1054 }],
        ['SQLite unknown column',
            driverError('SQLiteError', 'no such column: nope', { code: 'SQLITE_ERROR', errno: 1 }),
            SQLITE, 'QUERY_FAILED', { dbCode: 'SQLITE_ERROR' }],
        ['SQL Server unknown column',
            driverError('RequestError', "Invalid column name 'nope'.", { code: 'EREQUEST', number: 207 }),
            MSSQL, 'QUERY_FAILED', { dbCode: 207 }],
        ['Redis command on the wrong type',
            new Error('WRONGTYPE Operation against a key holding the wrong kind of value'),
            REDIS, 'QUERY_FAILED', { dbCode: 'WRONGTYPE' }],
        ['a second statement the server refused',
            driverError('PostgresError', 'cannot insert multiple commands into a prepared statement', { code: '42601' }),
            PG, 'QUERY_FAILED', { dbCode: '42601' }],
        ['nothing listening',
            driverError('Error', 'connect ECONNREFUSED db:5432', { code: 'ECONNREFUSED', errno: -61 }),
            PG, 'CONNECT_REFUSED', { host: 'db', port: 5432 }],
        ['a host that does not resolve',
            driverError('Error', 'getaddrinfo ENOTFOUND db', { code: 'ENOTFOUND', errno: 4 }),
            PG, 'CONNECT_REFUSED', { host: 'db', port: 5432 }],
        ['no socket at all',
            new Error('FailedToOpenSocket failed to connect to postgresql'),
            PG, 'CONNECT_REFUSED', { host: 'db', port: 5432 }],
    ];

    for (const [label, error, config, code, details] of cases) {
        it(`classifies ${label} as ${code}`, () => {
            const classified = classify(error, config);
            expect(classified.code).toBe(code as never);
            expect(classified.details).toEqual(details);
            expect(classified.fix).toBeDefined();
            expect(classified.cause).toBe(error);
        });
    }

    it('classifies a cancelled statement as QUERY_TIMEOUT when given the timeout', () => {
        const error = driverError('PostgresError', 'canceling statement due to statement timeout', { code: '57014' });
        expect(classify(error, PG, 30_000)).toMatchObject({ code: 'QUERY_TIMEOUT', details: { timeoutMs: 30_000 } });
    });

    it('never puts the password in a message, fix or details', () => {
        const error = driverError('PostgresError', 'password authentication failed', { code: '28P01' });
        const classified = classify(error, PG);
        expect(`${classified.message} ${classified.fix} ${JSON.stringify(classified.details)}`).not.toContain('hunter2');
    });

    it('leaves a classified error as it is', () => {
        const error = new SherlockError('NOT_FOUND', 'no table');
        expect(classifyDbError(error, PG)).toBe(error);
    });

    it('leaves an error from outside the driver unclassified', () => {
        const error = new TypeError('x is not a function');
        expect(classifyDbError(error, PG)).toBe(error);
    });

    it('does not take a network error with an errno for a MySQL server error', () => {
        const error = driverError('Error', 'write EPIPE', { code: 'EPIPE', errno: -32 });
        expect(classifyDbError(error, MYSQL)).toBe(error);
    });

    it('does not read a Redis-style prefix into a SQL error', () => {
        const error = new Error('ERR something');
        expect(classifyDbError(error, PG)).toBe(error);
    });
});
