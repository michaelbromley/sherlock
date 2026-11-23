/**
 * `--format human`: a command's data as readable text instead of the
 * envelope. Results become tables, lists of records become tables, nested
 * objects become sections, and the rest becomes "key: value" lines.
 *
 * Human output is for reading, not parsing, and carries no compatibility
 * promise.
 */

import { escapeMarkdownCell, formatAsMarkdown, formatRowsAsMarkdown } from './formatters';

interface ResultLike {
    columns: Array<{ name: string }>;
    rows: unknown[][];
}

function isResult(value: unknown): value is ResultLike & { rowCount?: number; truncated?: unknown } {
    const v = value as Partial<ResultLike> | null;
    return typeof v === 'object' && v !== null && Array.isArray(v.columns) && Array.isArray(v.rows) &&
        v.rows.every(Array.isArray) && v.columns.every((c) => typeof (c as { name?: unknown }).name === 'string');
}

function isScalar(value: unknown): boolean {
    return value === null || ['string', 'number', 'boolean', 'bigint'].includes(typeof value);
}

function isRecordList(value: unknown): value is Record<string, unknown>[] {
    return Array.isArray(value) && value.length > 0 &&
        value.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item) &&
            Object.values(item).every((field) => isScalar(field) || field === undefined));
}

function scalarText(value: unknown): string {
    if (value === null || value === undefined) return '-';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function describeTruncation(truncated: unknown): string | null {
    if (!truncated || typeof truncated !== 'object') return null;
    const t = truncated as { moreRows?: boolean; moreItems?: boolean; cellsCut?: number; bytesLimit?: number; tablesOmitted?: string[]; sectionsOmitted?: string[] };
    const parts: string[] = [];
    if (t.moreRows || t.moreItems) parts.push('there are more');
    if (t.cellsCut) parts.push(`${t.cellsCut} values shortened`);
    if (t.bytesLimit) parts.push(`held to ${t.bytesLimit} bytes`);
    if (t.tablesOmitted?.length) parts.push(`tables left out: ${t.tablesOmitted.join(', ')}`);
    if (t.sectionsOmitted?.length) parts.push(`sections left out: ${t.sectionsOmitted.join(', ')}`);
    return parts.length > 0 ? `Cut to fit: ${parts.join('; ')}.` : null;
}

function renderResult(result: ResultLike & { rowCount?: number; truncated?: unknown }): string {
    const count = result.rowCount ?? result.rows.length;
    const lines = [`${count} ${count === 1 ? 'row' : 'rows'}`];
    const cut = describeTruncation(result.truncated);
    if (cut) lines.push(cut);
    return `${lines.join('. ')}\n\n${formatRowsAsMarkdown(result.columns, result.rows)}`;
}

function render(value: unknown, depth: number): string {
    if (value === undefined) return '';
    if (isScalar(value)) return scalarText(value);
    if (isResult(value)) return renderResult(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '_none_';
        if (isRecordList(value)) return formatAsMarkdown(value);
        if (value.every(isScalar)) return value.map((item) => `- ${escapeMarkdownCell(item)}`).join('\n');
        return value.map((item) => render(item, depth + 1)).join('\n\n');
    }

    // An object: scalars first, as key: value lines, then each section
    const record = value as Record<string, unknown>;
    // A --out result: the file, then its preview
    if (typeof record.file === 'string' && Array.isArray(record.preview) && Array.isArray(record.columns)) {
        return `${record.rowCount} rows written to ${record.file} (${record.format}). The first ${record.preview.length}:\n\n` +
            formatRowsAsMarkdown(record.columns as Array<{ name: string }>, record.preview as unknown[][]);
    }
    const lines: string[] = [];
    const sections: string[] = [];
    const heading = '#'.repeat(Math.min(depth + 2, 6));
    for (const [key, field] of Object.entries(record)) {
        if (field === undefined) continue;
        if (key === 'truncated') {
            const cut = describeTruncation(field);
            if (cut) lines.push(cut);
            continue;
        }
        if (isScalar(field)) lines.push(`${key}: ${scalarText(field)}`);
        else sections.push(`${heading} ${key}\n\n${render(field, depth + 1)}`);
    }
    return [lines.join('\n'), ...sections].filter((part) => part !== '').join('\n\n');
}

/** A command's data as text for people */
export function renderHuman(data: unknown): string {
    const text = render(data, 0).trimEnd();
    return text === '' ? 'Done.' : text;
}
