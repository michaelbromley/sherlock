import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ResultFile, resultFileFormat } from './result-file';

const CLI = path.join(import.meta.dir, '..', 'query-db.ts');
const COLUMNS = [{ name: 'id', type: 'int4' }, { name: 'note', type: 'text' }, { name: 'data' }];

let dir: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-out-'));
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('resultFileFormat', () => {
    it('takes the format from the extension', () => {
        expect(resultFileFormat('a.jsonl')).toBe('jsonl');
        expect(resultFileFormat('a.NDJSON')).toBe('jsonl');
        expect(resultFileFormat('a.csv')).toBe('csv');
    });

    it('refuses anything else as a usage error', () => {
        expect(() => resultFileFormat('a.json')).toThrow(expect.objectContaining({ code: 'USAGE', details: { flag: '--out' } }));
    });
});

describe('ResultFile', () => {
    it('writes JSON Lines: the columns, then one array per row, values in full', () => {
        const file = new ResultFile(path.join(dir, 'r.jsonl'));
        file.write([[1, 'a'.repeat(1000), Buffer.from([1, 2])]], COLUMNS);
        file.write([[2, null, { k: 1n }]], COLUMNS);
        file.finish(COLUMNS);
        const lines = fs.readFileSync(path.join(dir, 'r.jsonl'), 'utf-8').trimEnd().split('\n').map((line) => JSON.parse(line));
        expect(lines).toEqual([
            { columns: COLUMNS },
            [1, 'a'.repeat(1000), { $base64: 'AQI=' }],
            [2, null, { k: '1' }],
        ]);
        expect(file.rowsWritten).toBe(2);
    });

    it('writes CSV with a header, quoting where it must', () => {
        const file = new ResultFile(path.join(dir, 'r.csv'));
        file.write([[1, 'plain', null], [2, 'has, "quotes"\nand a newline', { a: 1 }]], COLUMNS);
        file.finish(COLUMNS);
        expect(fs.readFileSync(path.join(dir, 'r.csv'), 'utf-8')).toBe(
            'id,note,data\n1,plain,\n2,"has, ""quotes""\nand a newline","{""a"":1}"\n'
        );
    });

    it('writes the header of a result with no rows', () => {
        const file = new ResultFile(path.join(dir, 'r.csv'));
        file.finish(COLUMNS);
        expect(fs.readFileSync(path.join(dir, 'r.csv'), 'utf-8')).toBe('id,note,data\n');
    });

    it('leaves nothing behind when aborted, and keeps an existing file', () => {
        const target = path.join(dir, 'r.jsonl');
        fs.writeFileSync(target, 'before');
        const file = new ResultFile(target);
        file.write([[1, 'x', null]], COLUMNS);
        file.abort();
        expect(fs.readdirSync(dir)).toEqual(['r.jsonl']);
        expect(fs.readFileSync(target, 'utf-8')).toBe('before');
    });

    it('refuses a directory that does not exist', () => {
        expect(() => new ResultFile(path.join(dir, 'missing', 'r.csv'))).toThrow(expect.objectContaining({ code: 'USAGE' }));
    });
});

describe('query --out', () => {
    it('writes every row past the caps, and prints a preview', () => {
        const dbFile = path.join(dir, 'test.db');
        const db = new Database(dbFile, { create: true });
        db.run('CREATE TABLE t (id INTEGER, note TEXT)');
        db.run(`WITH RECURSIVE g(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM g WHERE n < 500) INSERT INTO t SELECT n, 'note ' || n FROM g`);
        db.close();
        const out = path.join(dir, 'all.jsonl');

        const result = spawnSync('bun', [CLI, '-u', `sqlite://${dbFile}`, '--max-rows', '5', 'query', 'SELECT * FROM t', '--out', out], {
            encoding: 'utf-8',
            env: { ...process.env, SHERLOCK_CONFIG: '', HOME: dir },
        });
        expect(result.status).toBe(0);
        const { ok, data } = JSON.parse(result.stdout);
        expect(ok).toBe(true);
        expect(data).toMatchObject({ file: out, format: 'jsonl', rowCount: 500, columns: [{ name: 'id' }, { name: 'note' }] });
        expect(data.preview).toHaveLength(20);
        expect(data.preview[0]).toEqual([1, 'note 1']);
        expect(fs.readFileSync(out, 'utf-8').trimEnd().split('\n')).toHaveLength(501);
    });
});
