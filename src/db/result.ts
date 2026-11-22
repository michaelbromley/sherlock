/**
 * The result of a statement, sized for an agent's context.
 *
 *   { columns: [{ name, type? }], rows: [[...], ...], rowCount, truncated }
 *
 * Column names are sent once and each row is an array. Three caps keep one
 * result from filling a context: rows, characters per cell, and the total size
 * of the result in bytes, measured on the compact JSON that is printed. Every
 * cut is reported, in `truncated` and in a RESULT_TRUNCATED warning saying how
 * to get the rest.
 */

import type { Column, FetchedRows } from './adapter';
import type { SherlockWarning } from '../output/warnings';

export interface Caps {
    /** Rows returned; Infinity for none */
    maxRows: number;
    /** Characters per text cell; Infinity for none */
    maxCellChars: number;
    /** Bytes of the whole result as compact JSON; Infinity for none */
    maxBytes: number;
}

export const DEFAULT_CAPS: Caps = {
    maxRows: 200,
    maxCellChars: 500,
    maxBytes: 32 * 1024,
};

export const NO_CAPS: Caps = { maxRows: Infinity, maxCellChars: Infinity, maxBytes: Infinity };

/** What a result left out */
export interface Truncation {
    /** Rows exist past the last one returned, cut by the row or the size cap */
    moreRows: boolean;
    /** How many cells were shortened, or replaced by their size for binary values */
    cellsCut: number;
    /** The size cap, when it dropped rows */
    bytesLimit?: number;
}

export interface Result {
    columns: Column[];
    rows: unknown[][];
    rowCount: number;
    /** False when nothing was cut */
    truncated: Truncation | false;
}

/** What marks the end of a cut text cell */
export const CUT_MARK = '…';

/** The rows to ask the driver for: the cap, or every row when there is none */
export function fetchLimit(caps: Caps): number | undefined {
    return Number.isFinite(caps.maxRows) ? caps.maxRows : undefined;
}

/**
 * Build a result from fetched rows, applying the caps. Returns the warnings
 * that go with it: RESULT_TRUNCATED when anything was cut, and FETCHED_ALL_ROWS
 * when the driver read more rows than it needed to.
 */
export function buildResult(fetched: FetchedRows, caps: Caps): { result: Result; warnings: SherlockWarning[] } {
    let cellsCut = 0;
    const rows = fetched.rows.slice(0, caps.maxRows).map((row) => row.map((value) => {
        const cell = toCell(value, caps.maxCellChars);
        if (cell.cut) cellsCut += 1;
        return cell.value;
    }));
    let moreRows = fetched.more || fetched.rows.length > rows.length;

    // Drop whole rows from the end until the compact JSON fits.
    let bytesLimit: number | undefined;
    if (Number.isFinite(caps.maxBytes)) {
        const fixed = byteLength({ columns: fetched.columns, rows: [], rowCount: 0, truncated: { moreRows: true, cellsCut, bytesLimit: caps.maxBytes } });
        let size = fixed;
        let kept = 0;
        for (const row of rows) {
            const next = size + byteLength(row) + (kept > 0 ? 1 : 0);
            if (next > caps.maxBytes) break;
            size = next;
            kept += 1;
        }
        if (kept < rows.length) {
            rows.length = kept;
            moreRows = true;
            bytesLimit = caps.maxBytes;
        }
    }

    const truncated: Truncation | false = moreRows || cellsCut > 0
        ? { moreRows, cellsCut, ...(bytesLimit !== undefined && { bytesLimit }) }
        : false;
    const result: Result = { columns: fetched.columns, rows, rowCount: rows.length, truncated };

    const warnings: SherlockWarning[] = [];
    if (truncated) warnings.push(truncationWarning(result.rowCount, truncated));
    const needed = Number.isFinite(caps.maxRows) ? caps.maxRows + 1 : Infinity;
    if (fetched.rowsFetched > needed) {
        warnings.push({
            code: 'FETCHED_ALL_ROWS',
            message:
                `${fetched.rowsFetched} rows were read from the database to return ${result.rowCount}: ` +
                `the database could not be stopped early for this query.`,
            fix: 'Add a LIMIT to the query to read less.',
            details: { rowsFetched: fetched.rowsFetched },
        });
    }
    return { result, warnings };
}

function truncationWarning(rowsReturned: number, truncated: Truncation): SherlockWarning {
    const cuts: string[] = [];
    if (truncated.moreRows) {
        cuts.push(truncated.bytesLimit !== undefined
            ? `only the first ${rowsReturned} rows fit in ${truncated.bytesLimit} bytes`
            : `only the first ${rowsReturned} rows are returned`);
    }
    if (truncated.cellsCut > 0) {
        cuts.push(`${truncated.cellsCut} ${truncated.cellsCut === 1 ? 'cell was' : 'cells were'} shortened, or replaced by their size if binary`);
    }
    return {
        code: 'RESULT_TRUNCATED',
        message: `The result was cut: ${cuts.join(', and ')}.`,
        fix:
            'Narrow the query (fewer columns, a WHERE or LIMIT), raise a cap with --max-rows, --max-cell ' +
            'or --max-bytes, or write the whole result to a file with --out <file.jsonl|file.csv>.',
        details: {
            rowsReturned,
            moreRows: truncated.moreRows,
            cellsCut: truncated.cellsCut,
            ...(truncated.bytesLimit !== undefined && { bytesLimit: truncated.bytesLimit }),
        },
    };
}

/**
 * A value as it goes into the printed result: JSON-safe, and no longer than
 * the cell cap. Text is cut and ends with "…"; binary becomes its size; JSON
 * is kept as it is unless it is too long, when it is serialised and cut as
 * text.
 */
export function toCell(value: unknown, maxChars: number): { value: unknown; cut: boolean } {
    if (value === null || value === undefined) return { value: null, cut: false };
    if (typeof value === 'string') return cutText(value, maxChars);
    if (typeof value === 'number') return { value: Number.isFinite(value) ? value : String(value), cut: false };
    if (typeof value === 'boolean') return { value, cut: false };
    if (typeof value === 'bigint') return { value: value.toString(), cut: false };
    if (value instanceof Date) return { value: Number.isNaN(value.getTime()) ? String(value) : value.toISOString(), cut: false };
    const bytes = binaryLength(value);
    if (bytes !== null) return { value: { $bytes: bytes }, cut: true };

    const json = JSON.stringify(value, jsonSafe);
    if (json === undefined) return { value: String(value), cut: false };
    if (json.length > maxChars) return cutText(json, maxChars);
    return { value: JSON.parse(json), cut: false };
}

/** The length of a binary value, or null for anything else */
export function binaryLength(value: unknown): number | null {
    if (value instanceof Uint8Array) return value.byteLength; // Buffer too
    if (value instanceof ArrayBuffer) return value.byteLength;
    // A Buffer that went through JSON, as some drivers nest them in arrays
    const maybe = value as { type?: unknown; data?: unknown };
    if (maybe?.type === 'Buffer' && Array.isArray(maybe.data)) return maybe.data.length;
    return null;
}

function cutText(text: string, maxChars: number): { value: string; cut: boolean } {
    if (text.length <= maxChars) return { value: text, cut: false };
    let end = maxChars;
    // Never split a surrogate pair, which would leave half a character.
    const last = text.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end -= 1;
    return { value: text.slice(0, end) + CUT_MARK, cut: true };
}

/** For JSON.stringify: big integers as strings, binary as its size */
export function jsonSafe(_key: string, value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    // A Buffer arrives here already turned into { type: 'Buffer', data } by its toJSON
    const bytes = binaryLength(value);
    return bytes !== null ? { $bytes: bytes } : value;
}

function byteLength(value: unknown): number {
    return Buffer.byteLength(JSON.stringify(value));
}
