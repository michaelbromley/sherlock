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
 * Format output based on format option
 */
export function formatOutput(data: unknown, format: OutputFormat): string {
    if (format === 'markdown') {
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
