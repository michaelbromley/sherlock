/**
 * What every database driver offers sherlock.
 *
 * Two ways to run a statement:
 *
 *   unsafe  sherlock's own statements (listing tables, describing columns),
 *           whose rows come back as objects keyed by column name.
 *   fetch   the user's statement, whose columns come from the driver's
 *           metadata and whose rows come back as arrays, so duplicate or
 *           numeric column names survive and a result with no rows still has
 *           its columns. It stops reading after `maxRows + 1` rows where the
 *           driver allows, and can pass rows on in batches instead of keeping
 *           them, for writing a whole result to a file.
 *
 * Both run read-only, inside the database's read-only transaction where it has
 * one, and fail with a classified SherlockError.
 */

/** A result column, in the order the database sent it */
export interface Column {
    name: string;
    /** The database's own type name, lowercased, when the driver reports it */
    type?: string;
}

export interface FetchOptions {
    /**
     * Keep at most this many rows, reading one more to know whether there
     * were more. Undefined reads every row.
     */
    maxRows?: number;
    /**
     * Receive rows in batches as they are read, instead of having them kept.
     * The columns are known by the first batch. Called synchronously, so a
     * writer can write each batch before the next is read.
     */
    onRows?: (rows: unknown[][], columns: Column[]) => void;
}

export interface FetchedRows {
    columns: Column[];
    /** At most `maxRows` rows; empty when `onRows` was given */
    rows: unknown[][];
    /** Whether there were rows past `maxRows` */
    more: boolean;
    /**
     * How many rows were read from the database. More than `maxRows + 1` when
     * the driver could not stop early, or the query's own LIMIT asked for more.
     */
    rowsFetched: number;
}

export interface SqlAdapter {
    /** Run one of sherlock's own statements; rows as objects */
    unsafe(query: string): Promise<Record<string, unknown>[]>;
    /** Run the user's statement; columns from the driver, rows as arrays */
    fetch(query: string, options?: FetchOptions): Promise<FetchedRows>;
    close(): void | Promise<void>;
}

/** How many rows to read at a time when reading a whole result */
export const FETCH_BATCH_ROWS = 1000;

/**
 * Keep the rows of a fetch: up to `maxRows`, noting whether there were more.
 * Drivers feed it each batch they read and stop when it says it is full.
 */
export class RowCollector {
    readonly rows: unknown[][] = [];
    more = false;
    rowsFetched = 0;
    private columns: Column[] = [];

    constructor(private readonly options: FetchOptions) {}

    setColumns(columns: Column[]): void {
        this.columns = columns;
    }

    /** Take a batch of rows. Returns true once no more are wanted. */
    add(batch: unknown[][]): boolean {
        this.rowsFetched += batch.length;
        if (this.options.onRows) {
            if (batch.length > 0) this.options.onRows(batch, this.columns);
            return false;
        }
        const { maxRows } = this.options;
        if (maxRows === undefined) {
            for (const row of batch) this.rows.push(row);
            return false;
        }
        for (const row of batch) {
            if (this.rows.length < maxRows) this.rows.push(row);
            else this.more = true;
        }
        return this.more;
    }

    result(columns: Column[]): FetchedRows {
        return { columns, rows: this.rows, more: this.more, rowsFetched: this.rowsFetched };
    }
}
