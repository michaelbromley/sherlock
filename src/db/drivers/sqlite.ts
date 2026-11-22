/**
 * SQLite through `bun:sqlite`.
 *
 * The file is opened read-only, so nothing can write to it and a missing file
 * is an error rather than a new, empty database. An in-memory database cannot
 * be opened read-only, so it gets `PRAGMA query_only` instead. There is no
 * statement timeout: the file is local.
 *
 * Column names are known before the statement runs, so a result with no rows
 * still has them. Rows are read one at a time and the read stops after
 * `maxRows + 1`, except when two columns share a name: the driver reads rows
 * one at a time only as objects keyed by name, which would merge the two, so
 * then every row is read as arrays and cut afterwards.
 */

import { Database, type Statement } from 'bun:sqlite';
import { SherlockError } from '../../errors';
import { FETCH_BATCH_ROWS, RowCollector, type Column, type FetchOptions, type FetchedRows, type SqlAdapter } from '../adapter';

/** The file a SQLite URL names: sqlite://path, file://path, or :memory: */
export function sqliteFilename(url: string): string {
    const withoutQuery = url.replace(/\?.*$/, '');
    const match = /^(?:sqlite|file):(?:\/\/)?(.*)$/i.exec(withoutQuery);
    const filename = match ? match[1] : withoutQuery;
    return decodeURIComponent(filename) || ':memory:';
}

export function openSqlite(url: string): SqlAdapter {
    const filename = sqliteFilename(url);
    let db: Database;
    if (filename === ':memory:') {
        db = new Database(':memory:');
        db.run('PRAGMA query_only = ON');
    } else {
        try {
            db = new Database(filename, { readonly: true });
        } catch (error) {
            if ((error as { code?: unknown }).code !== 'SQLITE_CANTOPEN') throw error;
            throw new SherlockError('NOT_FOUND', `Cannot open the SQLite database ${filename}: the file does not exist or cannot be read.`, {
                fix: 'Check the path of the database file.',
                details: { kind: 'database file', name: filename },
                cause: error,
            });
        }
    }

    return {
        unsafe: async (query) => db.prepare(query).all() as Record<string, unknown>[],
        fetch: async (query, options = {}) => fetchRows(db.prepare(query), options),
        close: () => db.close(),
    };
}

function fetchRows(statement: Statement, options: FetchOptions): FetchedRows {
    const names = statement.columnNames;
    const collector = new RowCollector(options);
    let columns: Column[] = names.map((name) => ({ name }));
    collector.setColumns(columns);

    if (new Set(names).size === names.length) {
        let batch: unknown[][] = [];
        let full = false;
        const rows = statement.iterate() as Iterator<Record<string, unknown>>;
        for (let next = rows.next(); !next.done; next = rows.next()) {
            const row = next.value;
            if (batch.length === 0) columns = withTypes(statement, names, columns, collector);
            batch.push(names.map((name) => row[name]));
            const limit = options.maxRows !== undefined ? options.maxRows + 1 : FETCH_BATCH_ROWS;
            if (batch.length >= limit) {
                full = collector.add(batch);
                batch = [];
                if (full) break;
            }
        }
        // Stopping early leaves the statement part-way; let it reset.
        rows.return?.();
        if (!full && batch.length > 0) collector.add(batch);
    } else {
        collector.add(statement.values() as unknown[][]);
    }

    return collector.result(withTypes(statement, names, columns, collector));
}

/**
 * The declared types of the columns, known once the statement has run.
 * Expressions have none, and are left without a type.
 */
function withTypes(statement: Statement, names: string[], columns: Column[], collector: RowCollector): Column[] {
    let declared: Array<string | null>;
    try {
        declared = statement.declaredTypes;
    } catch {
        return columns;
    }
    const typed = names.map((name, i) => (declared[i] ? { name, type: declared[i]!.toLowerCase() } : { name }));
    collector.setColumns(typed);
    return typed;
}
