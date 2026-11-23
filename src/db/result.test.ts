import { describe, it, expect } from 'bun:test';
import { buildResult, toCell, CUT_MARK, DEFAULT_CAPS, NO_CAPS, type Caps } from './result';
import type { FetchedRows } from './adapter';

function fetched(rows: unknown[][], more = false, rowsFetched = rows.length + (more ? 1 : 0)): FetchedRows {
    return { columns: [{ name: 'id', type: 'int4' }, { name: 'body', type: 'text' }], rows, more, rowsFetched };
}

const caps = (overrides: Partial<Caps> = {}): Caps => ({ ...DEFAULT_CAPS, ...overrides });

describe('toCell', () => {
    it('cuts long text to the cap and marks the cut', () => {
        expect(toCell('abcdef', 3)).toEqual({ value: `abc${CUT_MARK}`, cut: true });
        expect(toCell('abc', 3)).toEqual({ value: 'abc', cut: false });
    });

    it('never splits a character made of two code units', () => {
        const { value } = toCell('ab😀cd', 3);
        expect(value).toBe(`ab${CUT_MARK}`);
    });

    it('replaces binary with its size', () => {
        expect(toCell(Buffer.from([1, 2, 3]), 500)).toEqual({ value: { $bytes: 3 }, cut: true });
        expect(toCell(new Uint8Array(10), 500)).toEqual({ value: { $bytes: 10 }, cut: true });
    });

    it('keeps short JSON as JSON, and cuts long JSON as text', () => {
        expect(toCell({ a: [1, 2] }, 500)).toEqual({ value: { a: [1, 2] }, cut: false });
        const long = toCell({ text: 'x'.repeat(100) }, 20);
        expect(long.cut).toBe(true);
        expect(long.value).toBe(`{"text":"xxxxxxxxxxx${CUT_MARK}`);
    });

    it('makes values JSON can hold', () => {
        expect(toCell(12n, 500).value).toBe('12');
        expect(toCell(new Date('2026-01-02T03:04:05Z'), 500).value).toBe('2026-01-02T03:04:05.000Z');
        expect(toCell(undefined, 500).value).toBeNull();
        expect(toCell(Number.NaN, 500).value).toBe('NaN');
        expect(toCell({ big: 1n, bin: Buffer.from([1]) }, 500).value).toEqual({ big: '1', bin: { $bytes: 1 } });
    });
});

describe('buildResult', () => {
    it('passes a small result through untouched, with no warnings', () => {
        const { result, warnings } = buildResult(fetched([[1, 'a'], [2, 'b']]), caps());
        expect(result).toEqual({
            columns: [{ name: 'id', type: 'int4' }, { name: 'body', type: 'text' }],
            rows: [[1, 'a'], [2, 'b']],
            rowCount: 2,
            truncated: false,
        });
        expect(warnings).toEqual([]);
    });

    it('reports rows past the row cap', () => {
        const { result, warnings } = buildResult(fetched([[1, 'a'], [2, 'b']], true), caps({ maxRows: 2 }));
        expect(result.truncated).toEqual({ moreRows: true, cellsCut: 0 });
        expect(warnings).toEqual([expect.objectContaining({
            code: 'RESULT_TRUNCATED',
            details: { rowsReturned: 2, moreRows: true, cellsCut: 0 },
        })]);
        expect(warnings[0].fix).toContain('--out');
    });

    it('counts cut cells', () => {
        const { result } = buildResult(fetched([[1, 'x'.repeat(10)], [2, 'short']]), caps({ maxCellChars: 5 }));
        expect(result.rows[0][1]).toBe(`xxxxx${CUT_MARK}`);
        expect(result.truncated).toEqual({ moreRows: false, cellsCut: 1 });
    });

    it('drops whole rows from the end to fit the byte cap, measured on compact JSON', () => {
        const rows = Array.from({ length: 100 }, (_, i) => [i, 'é'.repeat(40)]);
        const maxBytes = 2000;
        const { result, warnings } = buildResult(fetched(rows), caps({ maxBytes }));
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(maxBytes);
        expect(result.rowCount).toBeGreaterThan(0);
        expect(result.rowCount).toBeLessThan(100);
        // Every row returned is whole
        for (const row of result.rows) expect(row[1]).toBe('é'.repeat(40));
        expect(result.truncated).toEqual({ moreRows: true, cellsCut: 0, bytesLimit: maxBytes });
        expect(warnings[0].details).toMatchObject({ bytesLimit: maxBytes, rowsReturned: result.rowCount });
        // One more row would not have fitted
        const oneMore = { ...result, rows: rows.slice(0, result.rowCount + 1), rowCount: result.rowCount + 1 };
        expect(Buffer.byteLength(JSON.stringify(oneMore))).toBeGreaterThan(maxBytes);
    });

    it('warns when the driver read more rows than the cap needed', () => {
        const rows = Array.from({ length: 10 }, (_, i) => [i, 'a']);
        const { warnings } = buildResult(fetched(rows.slice(0, 3), true, 10), caps({ maxRows: 3 }));
        expect(warnings.map((w) => w.code)).toEqual(['RESULT_TRUNCATED', 'FETCHED_ALL_ROWS']);
        expect(warnings[1].details).toEqual({ rowsFetched: 10 });
    });

    it('does not warn about reading one row past the cap, which is how more rows are known', () => {
        const { warnings } = buildResult(fetched([[1, 'a']], true, 2), caps({ maxRows: 1 }));
        expect(warnings.map((w) => w.code)).toEqual(['RESULT_TRUNCATED']);
    });

    it('cuts nothing with no caps', () => {
        const rows = Array.from({ length: 500 }, (_, i) => [i, 'x'.repeat(1000)]);
        const { result, warnings } = buildResult(fetched(rows), NO_CAPS);
        expect(result.rowCount).toBe(500);
        expect(result.truncated).toBe(false);
        expect(warnings).toEqual([]);
    });

    it('keeps the columns of a result with no rows', () => {
        expect(buildResult(fetched([]), caps()).result).toMatchObject({ columns: [{ name: 'id' }, { name: 'body' }], rows: [], rowCount: 0 });
    });
});
