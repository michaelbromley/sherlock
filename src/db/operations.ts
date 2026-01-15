/**
 * Database operations module
 * Contains all read-only database introspection and query operations
 */

import { SQL } from 'bun';
import { DB_TYPES, type DbType } from '../db-types';

/** Valid SQL identifier pattern (prevents injection via malicious names) */
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Quote an identifier for safe use in SQL queries.
 * PostgreSQL uses double quotes, MySQL/SQLite use backticks.
 */
export function quoteIdentifier(name: string, dbType: DbType): string {
    return dbType === DB_TYPES.POSTGRES ? `"${name}"` : `\`${name}\``;
}

/**
 * Validates that an identifier (table/column name) is safe to interpolate into SQL.
 * Prevents SQL injection via maliciously-named database objects.
 */
export function validateIdentifier(name: string, type: 'table' | 'column'): void {
    if (!SAFE_IDENTIFIER.test(name)) {
        throw new Error(`Invalid ${type} name: "${name}". Names must start with a letter or underscore and contain only alphanumeric characters and underscores.`);
    }
}

/**
 * Validates that a table exists and is safe to use.
 * Combines identifier validation with existence check.
 */
export async function validateTableExists(
    sql: ReturnType<typeof SQL>,
    dbType: DbType,
    tableName: string
): Promise<void> {
    validateIdentifier(tableName, 'table');
    const validTables = await getTables(sql, dbType);
    if (!validTables.includes(tableName)) {
        throw new Error(`Table "${tableName}" not found. Use 'sherlock tables' to list available tables.`);
    }
}

/** Result from executing a query */
export interface QueryResult {
    rowCount?: number;
    rows?: unknown[];
    error?: string;
}

/** Table description result */
export interface TableDescription {
    table: string;
    columns: unknown[];
}

/** Sample result */
export interface SampleResult {
    table: string;
    rowCount: number;
    rows: unknown[];
}

/** Indexes result */
export interface IndexesResult {
    table: string;
    indexCount: number;
    indexes: unknown[];  // Shape varies by DB type
}

/** Foreign key relationship (outgoing) */
export interface FKReference {
    column: string;
    referencesTable: string;
    referencesColumn: string;
}

/** Foreign key relationship (incoming) */
export interface FKReferencedBy {
    fromTable: string;
    fromColumn: string;
    toColumn: string;
}

/** Foreign keys result */
export interface ForeignKeysResult {
    table: string;
    references: FKReference[];
    referencedBy: FKReferencedBy[];
}

/** Column stats */
export interface ColumnStats {
    column: string;
    nullCount: number;
    distinctCount: number;
}

/** Table stats result */
export interface TableStats {
    table: string;
    rowCount: number;
    columns: ColumnStats[];
}

/** Schema info (for introspection) */
export interface SchemaInfo {
    [tableName: string]: TableDescription;
}

/**
 * Get list of tables in the database
 */
export async function getTables(sql: ReturnType<typeof SQL>, dbType: DbType): Promise<string[]> {
    let query: string;

    if (dbType === DB_TYPES.POSTGRES) {
        query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
    } else if (dbType === DB_TYPES.SQLITE) {
        query = "SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
    } else {
        // MySQL
        query = 'SHOW TABLES';
    }

    const result = await sql.unsafe(query);

    if (dbType === DB_TYPES.POSTGRES || dbType === DB_TYPES.SQLITE) {
        return result.map((row: Record<string, unknown>) =>
            String(row.table_name || row.name)
        );
    } else {
        // MySQL returns { Tables_in_<dbname>: 'tablename' }
        const key = Object.keys(result[0] as object)[0];
        return result.map((row: Record<string, unknown>) => String(row[key]));
    }
}

/**
 * Describe a table's schema
 */
export async function describeTable(
    sql: ReturnType<typeof SQL>,
    dbType: DbType,
    tableName: string
): Promise<TableDescription> {
    await validateTableExists(sql, dbType, tableName);

    let query: string;

    if (dbType === DB_TYPES.POSTGRES) {
        query = `
            SELECT
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = '${tableName}'
            ORDER BY ordinal_position
        `;
    } else if (dbType === DB_TYPES.SQLITE) {
        query = `PRAGMA table_info(${quoteIdentifier(tableName, dbType)})`;
    } else {
        // MySQL
        query = `DESCRIBE ${quoteIdentifier(tableName, dbType)}`;
    }

    const result = await sql.unsafe(query);
    return { table: tableName, columns: result };
}

/**
 * Get random sample rows from a table
 */
export async function sampleTable(
    sql: ReturnType<typeof SQL>,
    dbType: DbType,
    tableName: string,
    limit: number
): Promise<SampleResult> {
    await validateTableExists(sql, dbType, tableName);

    const quotedTable = quoteIdentifier(tableName, dbType);
    let query: string;

    if (dbType === DB_TYPES.MYSQL) {
        query = `SELECT * FROM ${quotedTable} ORDER BY RAND() LIMIT ${limit}`;
    } else {
        // PostgreSQL and SQLite both use RANDOM()
        query = `SELECT * FROM ${quotedTable} ORDER BY RANDOM() LIMIT ${limit}`;
    }

    const result = await sql.unsafe(query);
    return {
        table: tableName,
        rowCount: Array.isArray(result) ? result.length : 0,
        rows: result,
    };
}

/**
 * Get indexes for a table
 */
export async function getIndexes(
    sql: ReturnType<typeof SQL>,
    dbType: DbType,
    tableName: string
): Promise<IndexesResult> {
    await validateTableExists(sql, dbType, tableName);

    let query: string;

    if (dbType === DB_TYPES.POSTGRES) {
        query = `
            SELECT
                indexname as index_name,
                indexdef as index_definition
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = '${tableName}'
            ORDER BY indexname
        `;
    } else if (dbType === DB_TYPES.SQLITE) {
        query = `PRAGMA index_list(${quoteIdentifier(tableName, dbType)})`;
    } else {
        // MySQL
        query = `SHOW INDEX FROM ${quoteIdentifier(tableName, dbType)}`;
    }

    const result = await sql.unsafe(query);
    return {
        table: tableName,
        indexCount: Array.isArray(result) ? result.length : 0,
        indexes: result,
    };
}

/**
 * Get foreign key relationships for a table
 */
export async function getForeignKeys(
    sql: ReturnType<typeof SQL>,
    dbType: DbType,
    tableName: string
): Promise<ForeignKeysResult> {
    await validateTableExists(sql, dbType, tableName);

    let references: FKReference[] = [];
    let referencedBy: FKReferencedBy[] = [];

    if (dbType === DB_TYPES.POSTGRES) {
        // Outgoing FKs: what this table references
        const outgoingQuery = `
            SELECT
                kcu.column_name as column,
                ccu.table_name as references_table,
                ccu.column_name as references_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
                AND tc.table_name = '${tableName}'
        `;
        const outgoing = await sql.unsafe(outgoingQuery);
        references = (outgoing as Record<string, unknown>[]).map(row => ({
            column: String(row.column),
            referencesTable: String(row.references_table),
            referencesColumn: String(row.references_column),
        }));

        // Incoming FKs: what references this table
        const incomingQuery = `
            SELECT
                tc.table_name as from_table,
                kcu.column_name as from_column,
                ccu.column_name as to_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
                AND ccu.table_name = '${tableName}'
        `;
        const incoming = await sql.unsafe(incomingQuery);
        referencedBy = (incoming as Record<string, unknown>[]).map(row => ({
            fromTable: String(row.from_table),
            fromColumn: String(row.from_column),
            toColumn: String(row.to_column),
        }));

    } else if (dbType === DB_TYPES.MYSQL) {
        // Get current database name for MySQL
        const dbResult = await sql.unsafe('SELECT DATABASE() as db');
        const currentDb = String((dbResult[0] as Record<string, unknown>).db);

        // SECURITY: Validate database name to prevent injection
        if (!SAFE_IDENTIFIER.test(currentDb)) {
            throw new Error(`Database name "${currentDb}" contains unsupported characters for FK lookup`);
        }

        // Outgoing FKs
        const outgoingQuery = `
            SELECT
                column_name as col,
                referenced_table_name as ref_table,
                referenced_column_name as ref_col
            FROM information_schema.key_column_usage
            WHERE table_schema = '${currentDb}'
                AND table_name = '${tableName}'
                AND referenced_table_name IS NOT NULL
        `;
        const outgoing = await sql.unsafe(outgoingQuery);
        references = (outgoing as Record<string, unknown>[]).map(row => ({
            column: String(row.col),
            referencesTable: String(row.ref_table),
            referencesColumn: String(row.ref_col),
        }));

        // Incoming FKs
        const incomingQuery = `
            SELECT
                table_name as from_tbl,
                column_name as from_col,
                referenced_column_name as to_col
            FROM information_schema.key_column_usage
            WHERE table_schema = '${currentDb}'
                AND referenced_table_name = '${tableName}'
        `;
        const incoming = await sql.unsafe(incomingQuery);
        referencedBy = (incoming as Record<string, unknown>[]).map(row => ({
            fromTable: String(row.from_tbl),
            fromColumn: String(row.from_col),
            toColumn: String(row.to_col),
        }));

    } else if (dbType === DB_TYPES.SQLITE) {
        // SQLite: PRAGMA foreign_key_list only gives outgoing FKs
        const quotedTable = quoteIdentifier(tableName, dbType);
        const outgoing = await sql.unsafe(`PRAGMA foreign_key_list(${quotedTable})`);
        references = (outgoing as Record<string, unknown>[]).map(row => ({
            column: String(row.from),
            referencesTable: String(row.table),
            referencesColumn: String(row.to),
        }));

        // SQLite doesn't easily support finding incoming FKs without scanning all tables
        referencedBy = [];
    } else {
        throw new Error(`Foreign key lookup not supported for database type: ${dbType}`);
    }

    return { table: tableName, references, referencedBy };
}

/**
 * Get data profiling stats for a table
 */
export async function getTableStats(
    sql: ReturnType<typeof SQL>,
    dbType: DbType,
    tableName: string
): Promise<TableStats> {
    await validateTableExists(sql, dbType, tableName);

    // Get column info first
    const tableDesc = await describeTable(sql, dbType, tableName);
    const columnNames: string[] = [];

    // PostgreSQL uses column_name, SQLite uses name, MySQL uses Field
    for (const col of tableDesc.columns) {
        const c = col as Record<string, unknown>;
        const name = c.column_name || c.name || c.Field;
        if (typeof name === 'string') {
            columnNames.push(name);
        }
    }

    // Validate all column names upfront
    for (const colName of columnNames) {
        validateIdentifier(colName, 'column');
    }

    const quotedTable = quoteIdentifier(tableName, dbType);

    // Build a SINGLE query that gets all stats in one table scan
    const columnExpressions = columnNames.map(col => {
        const quotedCol = quoteIdentifier(col, dbType);
        return `COUNT(*) - COUNT(${quotedCol}) as "${col}_null_count", COUNT(DISTINCT ${quotedCol}) as "${col}_distinct_count"`;
    }).join(', ');

    const statsQuery = `SELECT COUNT(*) as cnt${columnNames.length > 0 ? ', ' + columnExpressions : ''} FROM ${quotedTable}`;
    const statsResult = await sql.unsafe(statsQuery);
    const row = statsResult[0] as Record<string, unknown>;

    const rowCount = Number(row.cnt) || 0;

    // Parse results for each column
    const columnStats: ColumnStats[] = columnNames.map(col => ({
        column: col,
        nullCount: Number(row[`${col}_null_count`]) || 0,
        distinctCount: Number(row[`${col}_distinct_count`]) || 0,
    }));

    return { table: tableName, rowCount, columns: columnStats };
}

/**
 * Introspect full schema (all tables)
 */
export async function introspectSchema(
    sql: ReturnType<typeof SQL>,
    dbType: DbType
): Promise<SchemaInfo> {
    const tables = await getTables(sql, dbType);
    const schema: SchemaInfo = {};

    for (const table of tables) {
        schema[table] = await describeTable(sql, dbType, table);
    }

    return schema;
}

/**
 * Execute a read-only SQL query
 */
export async function executeQuery(
    sql: ReturnType<typeof SQL>,
    query: string
): Promise<QueryResult> {
    try {
        const result = await sql.unsafe(query);
        return {
            rowCount: Array.isArray(result) ? result.length : 0,
            rows: result,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: message };
    }
}
