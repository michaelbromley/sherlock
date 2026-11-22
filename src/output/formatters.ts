/**
 * Output formatting utilities
 * Handles JSON and Markdown output for query results
 */

/** Supported output formats */
export type OutputFormat = 'json' | 'markdown';

/** Default output format */
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'json';

/**
 * Escape a value for safe inclusion in a markdown table cell
 */
export function escapeMarkdownCell(val: unknown): string {
    if (val === null) return '_null_';
    if (val === undefined) return '_undefined_';
    if (val === '') return '_empty_';

    // Handle objects/arrays (e.g., JSONB columns) - stringify them
    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);

    // Escape pipes and normalize whitespace (newlines, carriage returns, tabs)
    return strVal.replace(/\|/g, '\\|').replace(/[\r\n\t]+/g, ' ');
}

/**
 * Format query results as a markdown table
 */
export function formatAsMarkdown(rows: unknown[]): string {
    if (!Array.isArray(rows) || rows.length === 0) {
        return '_No rows returned_';
    }

    const firstRow = rows[0] as Record<string, unknown>;
    const columns = Object.keys(firstRow);

    if (columns.length === 0) {
        return '_No columns_';
    }

    // Header row - escape column names too (they come from the database)
    const escapedColumns = columns.map((col) => col.replace(/\|/g, '\\|'));
    const header = '| ' + escapedColumns.join(' | ') + ' |';
    const separator = '| ' + columns.map(() => '---').join(' | ') + ' |';

    // Data rows
    const dataRows = rows.map((row) => {
        const r = row as Record<string, unknown>;
        const values = columns.map((col) => escapeMarkdownCell(r[col]));
        return '| ' + values.join(' | ') + ' |';
    });

    return [header, separator, ...dataRows].join('\n');
}

/**
 * Format rows that come as arrays, with their column names given once, as a
 * markdown table. Duplicate column names stay separate columns.
 */
export function formatRowsAsMarkdown(columns: Array<{ name: string }>, rows: unknown[][]): string {
    if (columns.length === 0) return '_No columns_';
    const header = '| ' + columns.map((column) => column.name.replace(/\|/g, '\\|')).join(' | ') + ' |';
    const separator = '| ' + columns.map(() => '---').join(' | ') + ' |';
    if (rows.length === 0) return [header, separator, '', '_No rows returned_'].join('\n');
    const dataRows = rows.map((row) => '| ' + columns.map((_, i) => escapeMarkdownCell(row[i])).join(' | ') + ' |');
    return [header, separator, ...dataRows].join('\n');
}

/** A result's columns and rows, when the data is one */
function asResult(data: unknown): { columns: Array<{ name: string }>; rows: unknown[][]; note: string } | null {
    if (typeof data !== 'object' || data === null) return null;
    const d = data as { columns?: unknown; rows?: unknown; preview?: unknown; rowCount?: number; truncated?: unknown; file?: string };
    const rows = d.rows ?? d.preview;
    if (!Array.isArray(d.columns) || !Array.isArray(rows) || !rows.every(Array.isArray)) return null;
    const notes: string[] = [];
    if (d.file) notes.push(`${d.rowCount} rows written to ${d.file}; the first ${rows.length} are shown`);
    else notes.push(`${d.rowCount ?? rows.length} rows`);
    if (d.truncated) notes.push('cut to fit; see the warnings');
    return { columns: d.columns as Array<{ name: string }>, rows: rows as unknown[][], note: notes.join(', ') };
}

/**
 * Format output based on format option
 */
export function formatOutput(data: unknown, format: OutputFormat): string {
    if (format === 'markdown') {
        const result = asResult(data);
        if (result) return `${result.note}\n\n${formatRowsAsMarkdown(result.columns, result.rows)}`;
        // If data has a 'rows' property, format those as a table
        if (typeof data === 'object' && data !== null && 'rows' in data) {
            const d = data as { rows: unknown[]; rowCount?: number };
            const table = formatAsMarkdown(d.rows);
            return d.rowCount !== undefined ? `${d.rowCount} rows\n\n${table}` : table;
        }
        // If it's an array, format as table directly
        if (Array.isArray(data)) {
            return formatAsMarkdown(data);
        }
        // Otherwise fall back to JSON
        return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data, null, 2);
}
