import { describe, it, expect } from 'bun:test';
import { explainMultipleStatements, explainTimeout, readOnlyWrapper, runWrapped, isUnknownTimeoutVariableError } from './read-only';

function recorder(failOn?: string) {
    const statements: string[] = [];
    return {
        statements,
        runner: {
            unsafe: async (query: string) => {
                statements.push(query);
                if (failOn && query.includes(failOn)) throw new Error(`failed: ${query}`);
                return [{ ok: 1 }];
            },
        },
    };
}

describe('readOnlyWrapper', () => {
    it('opens a read-only transaction with a local timeout on PostgreSQL', () => {
        expect(readOnlyWrapper('postgres', 60_000)).toEqual({
            before: ['BEGIN TRANSACTION READ ONLY', 'SET LOCAL statement_timeout = 60000'],
            after: ['ROLLBACK'],
        });
    });

    it('sets the session limit before the transaction on MySQL', () => {
        expect(readOnlyWrapper('mysql', 60_000)).toEqual({
            before: ['SET SESSION max_execution_time = 60000', 'START TRANSACTION READ ONLY'],
            after: ['ROLLBACK'],
        });
    });

    it('uses seconds for the MariaDB variable', () => {
        expect(readOnlyWrapper('mysql', 1500, 'max_statement_time')?.before[0]).toBe(
            'SET SESSION max_statement_time = 1.5'
        );
    });

    it('has no transaction to offer SQL Server or SQLite', () => {
        expect(readOnlyWrapper('mssql', 60_000)).toBeNull();
        expect(readOnlyWrapper('sqlite', 60_000)).toBeNull();
    });

    it('refuses a timeout that is not a positive integer, since it goes into SQL', () => {
        expect(() => readOnlyWrapper('postgres', 0)).toThrow(/positive whole number/);
        expect(() => readOnlyWrapper('postgres', 1.5)).toThrow(/positive whole number/);
        expect(() => readOnlyWrapper('postgres', NaN)).toThrow(/positive whole number/);
    });
});

describe('runWrapped', () => {
    const wrapper = readOnlyWrapper('postgres', 1000)!;

    it('runs the statement between the opening and closing statements', async () => {
        const { statements, runner } = recorder();
        expect(await runWrapped(runner, wrapper, 'SELECT 1')).toEqual([{ ok: 1 }]);
        expect(statements).toEqual([
            'BEGIN TRANSACTION READ ONLY', 'SET LOCAL statement_timeout = 1000', 'SELECT 1', 'ROLLBACK',
        ]);
    });

    it('rolls back and rethrows when the statement fails', async () => {
        const { statements, runner } = recorder('DELETE');
        await expect(runWrapped(runner, wrapper, 'DELETE FROM t')).rejects.toThrow('failed: DELETE FROM t');
        expect(statements.at(-1)).toBe('ROLLBACK');
    });

    it('rolls back when the timeout cannot be set, and never runs the statement', async () => {
        const { statements, runner } = recorder('statement_timeout');
        await expect(runWrapped(runner, wrapper, 'SELECT 1')).rejects.toThrow(/statement_timeout/);
        expect(statements).toEqual(['BEGIN TRANSACTION READ ONLY', 'SET LOCAL statement_timeout = 1000', 'ROLLBACK']);
    });

    it('does not roll back a transaction that never began', async () => {
        const { statements, runner } = recorder('BEGIN');
        await expect(runWrapped(runner, wrapper, 'SELECT 1')).rejects.toThrow();
        expect(statements).toEqual(['BEGIN TRANSACTION READ ONLY']);
    });

    it("keeps the statement's error when the rollback also fails", async () => {
        const statements: string[] = [];
        const runner = {
            unsafe: async (query: string) => {
                statements.push(query);
                if (query === 'SELECT boom' || query === 'ROLLBACK') throw new Error(`failed: ${query}`);
                return [];
            },
        };
        await expect(runWrapped(runner, wrapper, 'SELECT boom')).rejects.toThrow('failed: SELECT boom');
    });
});

describe('explainTimeout', () => {
    it.each([
        'canceling statement due to statement timeout',
        'Query execution was interrupted, maximum statement execution time exceeded',
        'Timeout: Request failed to complete in 60000ms',
    ])('names the setting for "%s"', (message) => {
        const explained = explainTimeout(new Error(message), 60_000) as Error;
        expect(explained.message).toMatch(/cancelled after 1m.*--timeout.*"statementTimeout"/);
    });

    it('leaves other errors alone', () => {
        const error = new Error('relation "x" does not exist');
        expect(explainTimeout(error, 60_000)).toBe(error);
    });
});

it('recognises only MariaDB lacking max_execution_time, not the user\'s own unknown variable', () => {
    expect(isUnknownTimeoutVariableError(new Error("Unknown system variable 'max_execution_time'"))).toBe(true);
    expect(isUnknownTimeoutVariableError(new Error("Unknown system variable 'nosuch'"))).toBe(false);
    expect(isUnknownTimeoutVariableError(new Error('Access denied'))).toBe(false);
});

it('words the server\'s refusal of a second statement as sherlock does', () => {
    const refused = new Error('cannot insert multiple commands into a prepared statement');
    expect((explainMultipleStatements(refused) as Error).message).toMatch(/^Multiple statements are not allowed/);
    const other = new Error('relation "x" does not exist');
    expect(explainMultipleStatements(other)).toBe(other);
});

it('runs the user\'s statement through the single-statement path when there is one', async () => {
    const calls: string[] = [];
    const runner = {
        unsafe: async (query: string) => { calls.push(`unsafe ${query}`); return []; },
        single: async (query: string) => { calls.push(`single ${query}`); return [{ ok: 1 }]; },
    };
    expect(await runWrapped(runner, readOnlyWrapper('postgres', 1000)!, 'SELECT 1')).toEqual([{ ok: 1 }]);
    expect(calls).toEqual([
        'unsafe BEGIN TRANSACTION READ ONLY', 'unsafe SET LOCAL statement_timeout = 1000', 'single SELECT 1', 'unsafe ROLLBACK',
    ]);
});
