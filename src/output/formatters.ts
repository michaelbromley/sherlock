/**
 * Markdown tables, for --format human
 */

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
