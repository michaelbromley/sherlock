/**
 * Database-enforced read-only execution.
 *
 * The keyword guard decides what sherlock is willing to send. This is the
 * second line: every statement runs inside a read-only transaction with a
 * statement timeout, and the transaction is always rolled back, so a statement
 * the guard misjudged still cannot write, and a runaway query cannot hold the
 * database for long.
 *
 *   PostgreSQL  BEGIN TRANSACTION READ ONLY + SET LOCAL statement_timeout
 *   MySQL       max_execution_time + START TRANSACTION READ ONLY
 *   MariaDB     max_statement_time + START TRANSACTION READ ONLY
 *   SQLite      PRAGMA query_only (no timeout: the file is local)
 *   SQL Server  no read-only transaction exists; a request timeout only
 */

import { DB_TYPES, type DbType } from '../db-types';

/** How long a statement may run when the connection does not say */
export const DEFAULT_STATEMENT_TIMEOUT = '60s';

/** Something statements can be run on, one after another, on one connection */
export interface StatementRunner {
    unsafe(query: string): Promise<unknown[]>;
    /**
     * Run exactly one statement, through a protocol on which the server itself
     * refuses a second one. The user's statement is run this way when the
     * database offers it, so that a statement the guard misjudged cannot end
     * the read-only transaction and write after it.
     */
    single?(query: string): Promise<unknown[]>;
}

/** Which variable a MySQL-family server limits statement time with */
export type MysqlTimeoutVariable = 'max_execution_time' | 'max_statement_time';

/** The statements that open and close a read-only transaction */
export interface ReadOnlyWrapper {
    /** Run before the statement, in order */
    before: string[];
    /** Run after the statement, whether it succeeded or not */
    after: string[];
}

/**
 * The statements that wrap a query for this database type, or null when the
 * type has no read-only transaction to wrap it in.
 *
 * `timeoutMs` must be a positive integer. It is interpolated into SQL, so it
 * is checked here rather than trusted.
 */
export function readOnlyWrapper(
    type: DbType,
    timeoutMs: number,
    mysqlTimeoutVariable: MysqlTimeoutVariable = 'max_execution_time'
): ReadOnlyWrapper | null {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`Statement timeout must be a positive whole number of milliseconds, got ${timeoutMs}.`);
    }

    if (type === DB_TYPES.POSTGRES) {
        return {
            before: ['BEGIN TRANSACTION READ ONLY', `SET LOCAL statement_timeout = ${timeoutMs}`],
            after: ['ROLLBACK'],
        };
    }

    if (type === DB_TYPES.MYSQL) {
        // Session variables, set before the transaction: neither server accepts
        // a transaction-scoped form. The session is sherlock's own.
        const limit = mysqlTimeoutVariable === 'max_execution_time'
            ? `SET SESSION max_execution_time = ${timeoutMs}`
            : `SET SESSION max_statement_time = ${timeoutMs / 1000}`;
        return {
            before: [limit, 'START TRANSACTION READ ONLY'],
            after: ['ROLLBACK'],
        };
    }

    return null;
}

/**
 * Run one statement inside a wrapper on a single connection. The closing
 * statements always run, and a failure in them never hides the statement's
 * own error.
 */
export async function runWrapped(
    runner: StatementRunner,
    wrapper: ReadOnlyWrapper,
    query: string
): Promise<unknown[]> {
    let opened = 0;
    try {
        for (const statement of wrapper.before) {
            await runner.unsafe(statement);
            opened += 1;
        }
        return await (runner.single ? runner.single(query) : runner.unsafe(query));
    } finally {
        // Nothing to roll back if not even the first statement ran.
        if (opened > 0) {
            for (const statement of wrapper.after) {
                await runner.unsafe(statement).catch(() => undefined);
            }
        }
    }
}

/**
 * Whether a MySQL-family error says the server has no `max_execution_time`,
 * as MariaDB does not. Any other unknown variable is the user's own mistake
 * and must be reported as it is.
 */
export function isUnknownTimeoutVariableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /unknown system variable '?max_execution_time/i.test(message);
}

/** Replace the server's refusal of a second statement with sherlock's own wording */
export function explainMultipleStatements(error: unknown): unknown {
    const message = error instanceof Error ? error.message : String(error);
    if (!/cannot insert multiple commands into a prepared statement/i.test(message)) return error;
    return new Error('Multiple statements are not allowed (read-only mode). The database refused the query.');
}

/**
 * Replace a timeout error with one that says which setting caused it, so
 * someone whose query was cancelled knows how to give it longer.
 */
export function explainTimeout(error: unknown, timeoutMs: number): unknown {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut =
        /canceling statement due to statement timeout/i.test(message) ||
        /maximum statement execution time exceeded/i.test(message) ||
        /query execution was interrupted.*max_statement_time/i.test(message) ||
        /timeout: request failed to complete/i.test(message);
    if (!timedOut) return error;

    return new Error(
        `Query cancelled after ${formatMs(timeoutMs)}, the connection's statement timeout. ` +
        `Give it longer with --timeout on the query, or "statementTimeout" on the connection.`
    );
}

function formatMs(ms: number): string {
    if (ms % 60_000 === 0) return `${ms / 60_000}m`;
    if (ms % 1000 === 0) return `${ms / 1000}s`;
    return `${ms}ms`;
}
