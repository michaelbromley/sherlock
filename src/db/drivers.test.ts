import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createConnection, type SqlAdapter } from './connection';
import type { DbType } from '../db-types';

/**
 * The drivers against real databases. SQLite always runs, on a temporary
 * file. The others run when their URL is set, e.g. for the containers the
 * fetch spike uses (spikes/fetch/README.md):
 *
 *   SHERLOCK_TEST_POSTGRES_URL=postgres://postgres:password@127.0.0.1:55432/postgres
 *   SHERLOCK_TEST_MYSQL_URL='mysql://root:password@127.0.0.1:53306/spike?allowPublicKeyRetrieval=true'
 *   SHERLOCK_TEST_MSSQL_URL='mssql://sa:Spike_Passw0rd%21@127.0.0.1:51433/master'
 *
 * Rows come from a series the database generates, so nothing is written.
 */

const ROWS = 5000;

interface Target {
    type: DbType;
    url: string | undefined;
    /** A statement returning ids 1..ROWS and a text column */
    series: string;
    /** A statement that writes, which the read-only connection must refuse */
    write?: string;
    /** Whether the server itself refuses a second statement */
    refusesSecondStatement: boolean;
}

let sqliteDir: string;

const targets: Target[] = [
    {
        type: 'postgres',
        url: process.env.SHERLOCK_TEST_POSTGRES_URL,
        series: `SELECT g AS id, repeat('x', 10) AS body FROM generate_series(1, ${ROWS}) g`,
        write: 'CREATE TABLE sherlock_must_not_exist (id int)',
        refusesSecondStatement: true,
    },
    {
        type: 'mysql',
        url: process.env.SHERLOCK_TEST_MYSQL_URL,
        // MySQL stops a recursive CTE at 1,000 rows by default, so square one of 100
        series:
            'WITH RECURSIVE g(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM g WHERE n < 100) ' +
            `SELECT id, repeat('x', 10) AS body FROM (SELECT (a.n - 1) * 100 + b.n AS id FROM g a CROSS JOIN g b) s ` +
            `WHERE id <= ${ROWS} ORDER BY id`,
        // A DDL statement commits a read-only transaction implicitly; the read-only session still refuses it
        write: 'CREATE TABLE sherlock_must_not_exist (id int)',
        refusesSecondStatement: true,
    },
    {
        type: 'mssql',
        url: process.env.SHERLOCK_TEST_MSSQL_URL,
        series: `SELECT TOP ${ROWS} CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS int) AS id, REPLICATE('x', 10) AS body FROM sys.all_objects a CROSS JOIN sys.all_objects b`,
        refusesSecondStatement: false,
    },
    {
        type: 'sqlite',
        url: 'set in beforeAll',
        series: `WITH RECURSIVE g(id) AS (SELECT 1 UNION ALL SELECT id + 1 FROM g WHERE id < ${ROWS}) SELECT id, 'xxxxxxxxxx' AS body FROM g`,
        write: 'CREATE TABLE sherlock_must_not_exist (id int)',
        // bun:sqlite runs the first statement and ignores the rest; the guard refuses them first
        refusesSecondStatement: false,
    },
];

beforeAll(() => {
    sqliteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-drivers-'));
    const file = path.join(sqliteDir, 'test.db');
    const db = new Database(file, { create: true });
    db.run('CREATE TABLE typed (id INTEGER, label TEXT, data BLOB)');
    db.close();
    targets.find((t) => t.type === 'sqlite')!.url = `sqlite://${file}`;
});

afterAll(() => {
    fs.rmSync(sqliteDir, { recursive: true, force: true });
});

for (const target of targets) {
    const run = target.type === 'sqlite' || target.url !== undefined;

    describe.skipIf(!run)(`${target.type} driver`, () => {
        let sql: SqlAdapter;

        beforeAll(async () => {
            sql = await createConnection({ type: target.type, url: target.url!, connectionName: 'test' });
        });

        afterAll(async () => {
            await sql?.close();
        });

        it('stops after maxRows + 1 rows, and says there were more', async () => {
            const fetched = await sql.fetch(target.series, { maxRows: 10 });
            expect(fetched.rows).toHaveLength(10);
            expect(fetched.more).toBe(true);
            expect(fetched.rowsFetched).toBe(11);
            expect(fetched.rows[0]).toEqual([1, 'xxxxxxxxxx']);
        });

        it('reads every row when no limit is given', async () => {
            const fetched = await sql.fetch(target.series);
            expect(fetched.rows).toHaveLength(ROWS);
            expect(fetched.more).toBe(false);
        });

        it('passes every row on in batches, keeping none', async () => {
            let seen = 0;
            const fetched = await sql.fetch(target.series, { onRows: (rows, columns) => {
                expect(columns.map((c) => c.name)).toEqual(['id', 'body']);
                seen += rows.length;
            } });
            expect(seen).toBe(ROWS);
            expect(fetched.rows).toEqual([]);
            expect(fetched.rowsFetched).toBe(ROWS);
        });

        it('keeps duplicate and numeric column names, in order', async () => {
            const fetched = await sql.fetch('SELECT 1 AS a, 2 AS a, 3 AS "2024"'.replace(/"2024"/, target.type === 'mysql' ? '`2024`' : target.type === 'mssql' ? '[2024]' : '"2024"'));
            expect(fetched.columns.map((c) => c.name)).toEqual(['a', 'a', '2024']);
            expect(fetched.rows).toEqual([[1, 2, 3]]);
        });

        it('has columns, with types, when there are no rows', async () => {
            const fetched = await sql.fetch(`SELECT * FROM (${target.series}) s WHERE id < 0`);
            expect(fetched.rows).toEqual([]);
            expect(fetched.columns.map((c) => c.name)).toEqual(['id', 'body']);
        });

        it('runs sherlock\'s own statements with rows as objects', async () => {
            const rows = await sql.unsafe('SELECT 1 AS one');
            expect(rows).toEqual([{ one: 1 }]);
        });

        it.skipIf(!target.write)('refuses a write', async () => {
            await expect(sql.fetch(target.write!)).rejects.toMatchObject({ code: expect.stringMatching(/^(READ_ONLY_VIOLATION|QUERY_FAILED)$/) });
        });

        it.skipIf(!target.refusesSecondStatement)('refuses a second statement', async () => {
            await expect(sql.fetch('SELECT 1; SELECT 2')).rejects.toMatchObject({ code: 'QUERY_FAILED' });
        });

        it('reports a rejected query as QUERY_FAILED', async () => {
            await expect(sql.fetch('SELECT no_such_column FROM (SELECT 1 AS x) s')).rejects.toMatchObject({ code: 'QUERY_FAILED' });
        });

        it('is still usable after a capped fetch', async () => {
            await sql.fetch(target.series, { maxRows: 1 });
            expect((await sql.fetch('SELECT 7 AS n')).rows).toEqual([[7]]);
        });
    });
}

describe('sqlite file', () => {
    it('reports a file that does not exist as NOT_FOUND, and does not create it', async () => {
        const missing = path.join(os.tmpdir(), `sherlock-missing-${process.pid}.db`);
        await expect(createConnection({ type: 'sqlite', url: `sqlite://${missing}` })).rejects.toMatchObject({
            code: 'NOT_FOUND',
            details: { kind: 'database file', name: missing },
        });
        expect(fs.existsSync(missing)).toBe(false);
    });

    it('opens an in-memory database, read-only', async () => {
        const sql = await createConnection({ type: 'sqlite', url: ':memory:' });
        try {
            expect((await sql.fetch('SELECT 1 AS one')).rows).toEqual([[1]]);
            await expect(sql.fetch('CREATE TABLE t (id int)')).rejects.toMatchObject({ code: 'READ_ONLY_VIOLATION' });
        } finally {
            await sql.close();
        }
    });
});
