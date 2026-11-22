import { describe, it, expect } from 'bun:test';
import { validateReadOnlyQuery } from './index';
import { scanSql } from './scan';

const ok = (query: string, dbType?: Parameters<typeof validateReadOnlyQuery>[1]) =>
    expect(validateReadOnlyQuery(query, dbType)).toEqual({ valid: true });
const rejected = (query: string, pattern: RegExp, dbType?: Parameters<typeof validateReadOnlyQuery>[1]) => {
    const result = validateReadOnlyQuery(query, dbType);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(pattern);
};

describe('validateReadOnlyQuery — allowed', () => {
    it.each([
        'SELECT 1',
        'select * from t;',
        'WITH x AS (SELECT 1) SELECT * FROM x',
        'SHOW TABLES',
        'EXPLAIN SELECT 1',
        'DESCRIBE users',
    ])('allows %s', (query) => ok(query));

    it('ignores a keyword inside a string literal', () => {
        ok("SELECT * FROM audit WHERE action = 'delete'");
        ok("SELECT 'drop table users' AS label");
    });

    it('ignores a semicolon inside a string literal', () => {
        ok("SELECT 'a;b' AS x");
    });

    it('ignores keywords in comments', () => {
        ok('-- delete this later\nSELECT 1', 'postgres');
        ok('SELECT 1 /* update me */', 'postgres');
    });

    it('ignores keywords in quoted identifiers', () => {
        ok('SELECT "delete" FROM t', 'postgres');
        ok('SELECT `update` FROM t', 'mysql');
        ok('SELECT [insert] FROM t', 'mssql');
    });

    it('ignores keywords in dollar-quoted strings', () => {
        ok("SELECT $$ drop table x; $$ AS s", 'postgres');
        ok("SELECT $tag$ delete $tag$ AS s", 'postgres');
    });

    it('treats a doubled quote as part of the string', () => {
        ok("SELECT 'it''s; delete' AS s");
    });

    it('does not mistake column names containing keywords for keywords', () => {
        ok('SELECT inserted_at, updated_by, created FROM t');
    });

    it('allows the REPLACE() and TRUNCATE() functions and a column called comment', () => {
        ok("SELECT replace(name, 'a', 'b') FROM t");
        ok('SELECT truncate(1.5, 0)', 'mysql');
        ok('SELECT TRUNCATE (price, 2) FROM t', 'mysql');
        ok('SELECT body AS comment, comment FROM posts');
    });

    it('still blocks the statements those words start', () => {
        rejected('SELECT 1 TRUNCATE TABLE t', /TRUNCATE/, 'mssql');
        rejected('SELECT 1 COMMENT ON TABLE t IS', /COMMENT/);
        rejected("SELECT 1 EXEC('DROP TABLE t')", /EXEC/, 'mssql');
        rejected("SELECT replace(a, 'x', 'y') FROM t REPLACE INTO u VALUES (1)", /REPLACE/, 'mssql');
    });

    it('suggests quoting when a keyword may be a name', () => {
        rejected('SELECT lock FROM t', /quote it as an identifier/);
        ok('SELECT "lock" FROM t', 'postgres');
    });

    it('does not mistake a column beginning with an allowed word for the statement', () => {
        rejected('SELECTED_ROWS', /Only SELECT/);
    });
});

describe('validateReadOnlyQuery — rejected', () => {
    it.each([
        ['DELETE FROM t', /Only SELECT/],
        ['UPDATE t SET a = 1', /Only SELECT/],
        ['DROP TABLE t', /Only SELECT/],
        ['SELECT 1; DELETE FROM t', /Multiple statements/],
        ['WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d', /DELETE/],
        ['SELECT * INTO backup FROM t', /INTO/],
        ['SELECT * FROM t FOR UPDATE', /UPDATE/],
    ] as const)('rejects %s', (query, pattern) => rejected(query, pattern));

    it('rejects a statement hidden after a semicolon that only looks quoted', () => {
        // In PostgreSQL a backslash does not escape a quote, so the string ends
        // after the backslash and the DELETE is real code.
        rejected("SELECT 'a\\' ; DELETE FROM t --'", /Multiple statements/, 'postgres');
    });

    it('reads the same text as one string under MySQL, where backslash escapes', () => {
        ok("SELECT 'a\\' ; DELETE FROM t --'", 'mysql');
    });

    it('checks every dialect when the database is not known', () => {
        // Safe under MySQL, a chained DELETE under PostgreSQL: unknown means strictest.
        rejected("SELECT 'a\\' ; DELETE FROM t --'", /Multiple statements/);
    });

    it('rejects MySQL executable comments', () => {
        rejected('SELECT 1 /*! DELETE FROM t */', /Executable comments/, 'mysql');
        rejected('SELECT 1 /*M! DELETE FROM t */', /Executable comments/, 'mysql');
    });

    it('treats # as a comment only in MySQL', () => {
        ok('SELECT 1 # ; delete', 'mysql');
        rejected('SELECT 1 # ; delete', /Multiple statements|DELETE/, 'postgres');
    });

    it('treats -- without a following space as code in MySQL', () => {
        // MySQL reads 1--1 as 1 - (-1), so what follows is code.
        rejected('SELECT 1--1; DELETE FROM t', /Multiple statements/, 'mysql');
    });

    it('ends a line comment at a carriage return, as PostgreSQL does', () => {
        // Found in review: with the comment running to the next line feed, the
        // ROLLBACK and DELETE were hidden, and PostgreSQL ran both.
        for (const dialect of [undefined, 'postgres', 'mysql', 'mssql', 'sqlite'] as const) {
            rejected('SELECT 1 --\r; ROLLBACK; DELETE FROM t', /Multiple statements/, dialect);
            rejected('SELECT 1 --\r\n; ROLLBACK; DELETE FROM t', /Multiple statements/, dialect);
        }
        rejected('SELECT 1 #\r; DELETE FROM t', /Multiple statements/, 'mysql');
        ok('-- note\r\nSELECT 1', 'postgres');
    });

    it('rejects unterminated literals and comments instead of guessing', () => {
        rejected("SELECT 'abc", /Unterminated string/);
        rejected('SELECT 1 /* open', /Unterminated comment/);
        rejected('SELECT $$ open', /Unterminated dollar-quoted/, 'postgres');
    });

    it('handles E-strings, whose backslashes escape', () => {
        ok("SELECT E'it\\'s; delete' AS s", 'postgres');
    });
});

describe('scanSql', () => {
    it('replaces literals and comments, keeping the code', () => {
        expect(scanSql("SELECT 'x' -- c\nFROM t", 'postgres')).toEqual({ ok: true, code: "SELECT ''  \nFROM t" });
    });

    it('handles nested block comments in PostgreSQL', () => {
        expect(scanSql('SELECT /* a /* b */ c */ 1', 'postgres')).toEqual({ ok: true, code: 'SELECT   1' });
    });

    it('refuses a non-SQL database', () => {
        expect(scanSql('GET x', 'redis').ok).toBe(false);
    });
});
