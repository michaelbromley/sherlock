/**
 * `--out <file>`: the whole result, with no caps, written to a file as it is
 * read, so a large result never has to fit in memory or in an agent's context.
 *
 *   .jsonl / .ndjson  JSON Lines. The first line is {"columns":[{name,type?}]};
 *                     every line after it is one row, as an array.
 *   .csv              A header of column names, then one line per row.
 *
 * Values are written in full: binary as base64 ({"$base64": "..."} in JSON
 * Lines), JSON as JSON, dates as ISO 8601. The file is written beside the
 * target and renamed into place once complete, so a failed query never leaves
 * half a file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { usageError } from '../errors';
import type { Column } from '../db/adapter';

export type ResultFileFormat = 'jsonl' | 'csv';

const FORMATS: Record<string, ResultFileFormat> = { '.jsonl': 'jsonl', '.ndjson': 'jsonl', '.csv': 'csv' };

/** The format a file name asks for, or a USAGE error */
export function resultFileFormat(file: string): ResultFileFormat {
    const format = FORMATS[path.extname(file).toLowerCase()];
    if (!format) {
        throw usageError(`--out writes .jsonl, .ndjson or .csv files, not "${path.basename(file)}".`, '--out',
            'Name the file with one of those extensions, e.g. --out result.jsonl');
    }
    return format;
}

export class ResultFile {
    readonly path: string;
    readonly format: ResultFileFormat;
    private readonly temp: string;
    private fd: number;
    private headerWritten = false;
    rowsWritten = 0;

    constructor(file: string) {
        this.format = resultFileFormat(file);
        this.path = path.resolve(file);
        const dir = path.dirname(this.path);
        if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
            throw usageError(`--out: the directory ${dir} does not exist.`, '--out');
        }
        this.temp = path.join(dir, `.${path.basename(this.path)}.${process.pid}.tmp`);
        this.fd = fs.openSync(this.temp, 'w', 0o600);
    }

    /** Write a batch of rows, and the header first if it is not written yet */
    write(rows: unknown[][], columns: Column[]): void {
        this.writeHeader(columns);
        const lines = rows.map((row) => this.format === 'csv'
            ? row.map(csvField).join(',')
            : JSON.stringify(row, fileReplacer));
        if (lines.length > 0) fs.writeSync(this.fd, lines.join('\n') + '\n');
        this.rowsWritten += rows.length;
    }

    /** Write the header if no rows came, and put the file in place */
    finish(columns: Column[]): void {
        this.writeHeader(columns);
        fs.closeSync(this.fd);
        fs.chmodSync(this.temp, 0o644);
        fs.renameSync(this.temp, this.path);
    }

    /** Remove the partial file */
    abort(): void {
        try {
            fs.closeSync(this.fd);
        } catch {
            // Already closed
        }
        fs.rmSync(this.temp, { force: true });
    }

    private writeHeader(columns: Column[]): void {
        if (this.headerWritten) return;
        this.headerWritten = true;
        const header = this.format === 'csv'
            ? columns.map((column) => csvField(column.name)).join(',')
            : JSON.stringify({ columns });
        fs.writeSync(this.fd, header + '\n');
    }
}

/** A value as written to a file: in full, and JSON-safe */
function fileValue(value: unknown): unknown {
    if (value === undefined) return null;
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
    if (value instanceof Uint8Array) return { $base64: Buffer.from(value).toString('base64') };
    return value;
}

/**
 * For JSON.stringify of a file's values, at any depth: big integers as
 * strings, binary in full as base64. A Buffer arrives already turned into
 * { type: 'Buffer', data } by its own toJSON.
 */
function fileReplacer(_key: string, value: unknown): unknown {
    const buffer = value as { type?: unknown; data?: unknown };
    if (buffer?.type === 'Buffer' && Array.isArray(buffer.data)) {
        return { $base64: Buffer.from(buffer.data as number[]).toString('base64') };
    }
    return fileValue(value);
}

/** A CSV field, quoted when it has to be */
function csvField(value: unknown): string {
    const plain = fileValue(value);
    let text: string;
    if (plain === null) text = '';
    else if (typeof plain === 'object') {
        const base64 = (plain as { $base64?: unknown }).$base64;
        text = typeof base64 === 'string' ? base64 : JSON.stringify(plain, fileReplacer);
    } else text = String(plain);
    return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
