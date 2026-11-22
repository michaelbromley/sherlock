/**
 * MySQL and MariaDB through `mysql2`.
 *
 * One connection, sherlock's own, so session variables and the read-only
 * transaction apply to the statement that follows them. Statements are run one
 * at a time: two at once would interleave inside one transaction.
 *
 * The user's statement is streamed with the text protocol. The connection is
 * opened without multiple statements, so the server refuses a second one. It
 * stops after `maxRows + 1` rows through `sql_select_limit`, which leaves the
 * query as written; a LIMIT in the query wins over it.
 */

import mysql from 'mysql2/promise';
import mysqlCore, { type FieldPacket } from 'mysql2';
import { DB_TYPES, parseBoolParam } from '../../db-types';
import { PUBLIC_KEY_RETRIEVAL_PARAM } from '../../config';
import {
    isUnknownTimeoutVariableError,
    readOnlyWrapper,
    runWrapped,
    type MysqlTimeoutVariable,
} from '../read-only';
import { FETCH_BATCH_ROWS, RowCollector, type Column, type FetchOptions, type FetchedRows, type SqlAdapter } from '../adapter';

export interface MysqlOptions {
    url: string;
    connectTimeoutMs: number;
    statementTimeoutMs: number;
}

/** MySQL's column type codes, as the protocol sends them */
const TYPE_NAMES: Record<number, string> = {
    0: 'decimal', 1: 'tinyint', 2: 'smallint', 3: 'int', 4: 'float', 5: 'double', 6: 'null',
    7: 'timestamp', 8: 'bigint', 9: 'mediumint', 10: 'date', 11: 'time', 12: 'datetime', 13: 'year',
    14: 'date', 15: 'varchar', 16: 'bit', 245: 'json', 246: 'decimal', 247: 'enum', 248: 'set',
    249: 'tinytext', 250: 'mediumtext', 251: 'longtext', 252: 'text', 253: 'varchar', 254: 'char',
    255: 'geometry',
};

/** Binary counterparts of the string types, for columns with the binary character set */
const BINARY_NAMES: Record<string, string> = {
    tinytext: 'tinyblob', mediumtext: 'mediumblob', longtext: 'longblob', text: 'blob',
    varchar: 'varbinary', char: 'binary',
};

const BINARY_CHARSET = 63;
const ENUM_FLAG = 256;
const SET_FLAG = 2048;

/** A column's type name, from its type code, character set and flags */
export function mysqlTypeName(field: { columnType?: number; characterSet?: number; flags?: number | string[] }): string | undefined {
    if (field.columnType === undefined) return undefined;
    const flags = typeof field.flags === 'number' ? field.flags : 0;
    if (flags & ENUM_FLAG) return 'enum';
    if (flags & SET_FLAG) return 'set';
    const name = TYPE_NAMES[field.columnType];
    if (name && field.characterSet === BINARY_CHARSET && BINARY_NAMES[name]) return BINARY_NAMES[name];
    return name;
}

/** The mysql2 connection settings for a connection URL */
function connectionSettings(url: string, connectTimeoutMs: number): mysql.ConnectionOptions {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const mode = (params.get('ssl-mode') ?? params.get('sslmode') ?? params.get('ssl') ?? '').toLowerCase();
    const verify = ['verify_identity', 'verify-full', 'verify_ca', 'verify-ca'].includes(mode);
    const encrypt = verify || ['required', 'require', 'true', 'preferred'].includes(mode);
    const allowPublicKeyRetrieval = parseBoolParam(params.get(PUBLIC_KEY_RETRIEVAL_PARAM)) === true;

    return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 3306,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: decodeURIComponent(parsed.pathname.replace(/^\//, '')) || undefined,
        connectTimeout: connectTimeoutMs,
        ...(encrypt && { ssl: { rejectUnauthorized: verify } }),
        multipleStatements: false,
        // Exact values: large integers as strings rather than rounded, and
        // dates as the database holds them rather than shifted to a time zone.
        supportBigNumbers: true,
        bigNumberStrings: false,
        dateStrings: true,
        authPlugins: { caching_sha2_password: guardedCachingSha2(allowPublicKeyRetrieval) },
    };
}

/**
 * MySQL's default login, caching_sha2_password, sends the password encrypted
 * with the server's RSA key when there is no TLS, and asks the server for that
 * key. Anyone who can intercept the connection could hand over their own key
 * and read the password, so asking is refused unless the connection allows it.
 */
function guardedCachingSha2(allowPublicKeyRetrieval: boolean) {
    // The package's own plugin, which its exports reach only through the main module
    const plugin = (mysqlCore as unknown as {
        authPlugins: { caching_sha2_password: (options?: object) => (context: unknown) => (data: Buffer) => Buffer | null };
    }).authPlugins.caching_sha2_password;
    return (context: unknown) => {
        const next = plugin()(context);
        return (data: Buffer) => {
            const reply = next(data);
            const requestsKey = Buffer.isBuffer(reply) && reply.length === 1 && reply[0] === 2;
            if (requestsKey && !allowPublicKeyRetrieval) {
                throw Object.assign(new Error('The server requested RSA public key retrieval, which is not allowed over an insecure connection.'), {
                    code: 'PUBLIC_KEY_RETRIEVAL_NOT_ALLOWED',
                });
            }
            return reply;
        };
    };
}

export async function openMysql(options: MysqlOptions): Promise<SqlAdapter> {
    const connection = await mysql.createConnection(connectionSettings(options.url, options.connectTimeoutMs));
    // A connection the server closes emits an error; the statement that was
    // running reports it, so the event itself must not crash the process.
    connection.on('error', () => undefined);

    // MySQL and MariaDB name the timeout variable differently. Try MySQL's
    // first and remember which one the server knows.
    let variable: MysqlTimeoutVariable = 'max_execution_time';

    const readOnly = async <T>(body: () => Promise<T>, selectLimit?: number): Promise<T> => {
        const run = () => runWrapped(
            { unsafe: async (statement) => { await connection.query(statement); return []; } },
            readOnlyWrapper(DB_TYPES.MYSQL, options.statementTimeoutMs, variable, selectLimit)!,
            body
        );
        try {
            return await run();
        } catch (error) {
            if (variable !== 'max_execution_time' || !isUnknownTimeoutVariableError(error)) throw error;
            variable = 'max_statement_time';
            return run();
        }
    };

    let queue: Promise<unknown> = Promise.resolve();
    const serially = <T>(task: () => Promise<T>): Promise<T> => {
        const run = queue.then(task, task);
        queue = run.catch(() => undefined);
        return run;
    };

    return {
        unsafe: (query) => serially(() => readOnly(async () => {
            const [rows] = await connection.query(query);
            return rows as Record<string, unknown>[];
        })),

        fetch: (query, fetchOptions = {}) => serially(() => readOnly(
            () => streamRows(connection, query, fetchOptions),
            fetchOptions.maxRows !== undefined ? fetchOptions.maxRows + 1 : undefined
        )),

        close: () => connection.end().catch(() => connection.destroy()),
    };
}

/** Stream the rows of the user's statement, keeping what the options ask for */
function streamRows(connection: mysql.Connection, query: string, options: FetchOptions): Promise<FetchedRows> {
    const collector = new RowCollector(options);
    let columns: Column[] = [];
    let batch: unknown[][] = [];

    return new Promise((resolve, reject) => {
        const flush = () => {
            if (batch.length === 0) return;
            collector.add(batch);
            batch = [];
        };
        // The promise wrapper's connection keeps the event-emitting one inside.
        const core = (connection as unknown as { connection: { query(options: object): NodeJS.EventEmitter } }).connection;
        core.query({ sql: query, rowsAsArray: true })
            .on('fields', (fields: FieldPacket[] | undefined) => {
                // A statement that returns no result set, which the guard does not let through, has none.
                columns = (fields ?? []).map((field) => {
                    const type = mysqlTypeName(field as never);
                    return type ? { name: field.name, type } : { name: field.name };
                });
                collector.setColumns(columns);
            })
            .on('result', (row: unknown) => {
                if (!Array.isArray(row)) return;
                batch.push(row);
                if (batch.length >= FETCH_BATCH_ROWS) flush();
            })
            .on('error', reject)
            .on('end', () => {
                flush();
                resolve(collector.result(columns));
            });
    });
}
