/**
 * Database operations module
 * Contains all read-only database introspection and query operations
 */

import { DB_TYPES, type DbType } from '../db-types';
import type { FetchedRows, SqlAdapter } from './adapter';
import { SherlockError, usageError } from '../errors';

/** Valid SQL identifier pattern (prevents injection via malicious names) */
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Quote an identifier for safe use in SQL queries.
 * PostgreSQL uses double quotes, MSSQL uses square brackets, MySQL/SQLite use backticks.
 */
export function quoteIdentifier(name: string, dbType: DbType): string {
    if (dbType === DB_TYPES.POSTGRES) return `"${name}"`;
    if (dbType === DB_TYPES.MSSQL) return `[${name}]`;
    return `\`${name}\``;
}

/**
 * Validates that an identifier (table/column name) is safe to interpolate into SQL.
 * Prevents SQL injection via maliciously-named database objects.
 */
export function validateIdentifier(name: string, type: 'table' | 'column'): void {
    if (!SAFE_IDENTIFIER.test(name)) {
        throw usageError(
            `Invalid ${type} name: "${name}". Names must start with a letter or underscore and contain only alphanumeric characters and underscores.`,
            undefined,
            `To query a table with another name, use: sherlock query "SELECT ... FROM <quoted name>"`
        );
    }
}

/**
 * Validates that a table exists and is safe to use.
 * Combines identifier validation with existence check.
 */
export async function validateTableExists(
    sql: SqlAdapter,
    dbType: DbType,
    tableName: string
): Promise<void> {
    validateIdentifier(tableName, 'table');
    const validTables = await getTables(sql, dbType);
    if (!validTables.includes(tableName)) {
        throw new SherlockError('NOT_FOUND', `Table "${tableName}" not found.`, {
            fix: 'List the tables with: sherlock -c <connection> tables',
            details: { kind: 'table', name: tableName },
        });
    }
}

interface FKReference {
    column: string;
    referencesTable: string;
    referencesColumn: string;
}

interface FKReferencedBy {
    fromTable: string;
    fromColumn: string;
    toColumn: string;
}

interface ColumnStats {
    column: string;
    nullCount: number;
    distinctCount: number;
}

/** Foreign keys of a table: what it references, and what references it */
export interface ForeignKeys {
    references: FetchedRows;
    referencedBy: FetchedRows;
}

/** Row count and per-column stats of a table */
export interface TableStats {
    rowCount: number;
    columns: FetchedRows;
}

/** Every table's columns, as describe gives them */
export type SchemaInfo = Record<string, FetchedRows>;

/** The columns `describe` returns, the same on every database */
export const DESCRIBE_COLUMNS = ['name', 'type', 'nullable', 'default', 'primaryKey'] as const;

/**
 * Rows of sherlock's own statements, which come back as objects with known
 * keys, as a result with those keys as its columns, in that order. Fixed
 * columns mean an empty list still says what it would hold.
 */
export function rowsFrom(columns: readonly string[], objects: Record<string, unknown>[]): FetchedRows {
    return {
        columns: columns.map((name) => ({ name })),
        rows: objects.map((object) => columns.map((column) => object[column] ?? null)),
        more: false,
        rowsFetched: objects.length,
    };
}

/** A flag column some databases give as 0 and 1, as a boolean */
function flag(value: unknown): boolean {
    return value === true || value === 1 || value === '1' || value === 't' || value === 'YES';
}

/**
 * Get list of tables in the database
 */
export async function getTables(sql: SqlAdapter, dbType: DbType): Promise<string[]> {
    let query: string;

    if (dbType === DB_TYPES.POSTGRES) {
        query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
    } else if (dbType === DB_TYPES.SQLITE) {
        query = "SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
    } else if (dbType === DB_TYPES.MSSQL) {
        query = "SELECT TABLE_NAME as table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
    } else {
        // MySQL
        query = 'SHOW TABLES';
    }

    const result = await sql.unsafe(query);

    if (dbType === DB_TYPES.POSTGRES || dbType === DB_TYPES.SQLITE || dbType === DB_TYPES.MSSQL) {
        return (result as Record<string, unknown>[]).map(row => String(row.table_name || row.name));
    } else {
        // MySQL returns { Tables_in_<dbname>: 'tablename' }
        const key = Object.keys(result[0] as object)[0];
        return (result as Record<string, unknown>[]).map(row => String(row[key]));
    }
}

/**
 * Describe a table's columns, the same way on every database: name, type,
 * whether it takes NULL, its default, and whether it is in the primary key.
 */
export async function describeTable(
    sql: SqlAdapter,
    dbType: DbType,
    tableName: string
): Promise<FetchedRows> {
    await validateTableExists(sql, dbType, tableName);
    return describeColumns(sql, dbType, tableName);
}

/** The columns of a table already known to exist. The name must be a safe identifier. */
async function describeColumns(sql: SqlAdapter, dbType: DbType, tableName: string): Promise<FetchedRows> {
    validateIdentifier(tableName, 'table');
    let query: string;

    if (dbType === DB_TYPES.POSTGRES) {
        query = `
            SELECT
                c.column_name AS name,
                CASE WHEN c.character_maximum_length IS NOT NULL
                    THEN c.data_type || '(' || c.character_maximum_length || ')'
                    ELSE c.data_type END AS type,
                c.is_nullable = 'YES' AS nullable,
                c.column_default AS "default",
                EXISTS (
                    SELECT 1 FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage k
                        ON k.constraint_name = tc.constraint_name
                        AND k.table_schema = tc.table_schema
                        AND k.table_name = tc.table_name
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                        AND tc.table_schema = c.table_schema
                        AND tc.table_name = c.table_name
                        AND k.column_name = c.column_name
                ) AS "primaryKey"
            FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = '${tableName}'
            ORDER BY c.ordinal_position
        `;
    } else if (dbType === DB_TYPES.SQLITE) {
        query = `
            SELECT name, type, "notnull" = 0 AS nullable, dflt_value AS "default", pk > 0 AS primaryKey
            FROM pragma_table_info('${tableName}')
            ORDER BY cid
        `;
    } else if (dbType === DB_TYPES.MSSQL) {
        query = `
            SELECT
                c.COLUMN_NAME AS name,
                CASE WHEN c.CHARACTER_MAXIMUM_LENGTH IS NOT NULL
                    THEN c.DATA_TYPE + '(' + CASE WHEN c.CHARACTER_MAXIMUM_LENGTH = -1 THEN 'max'
                        ELSE CAST(c.CHARACTER_MAXIMUM_LENGTH AS varchar(10)) END + ')'
                    ELSE c.DATA_TYPE END AS type,
                CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS nullable,
                c.COLUMN_DEFAULT AS [default],
                CASE WHEN EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k ON k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                        AND tc.TABLE_NAME = c.TABLE_NAME
                        AND k.COLUMN_NAME = c.COLUMN_NAME
                ) THEN 1 ELSE 0 END AS primaryKey
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_NAME = '${tableName}'
            ORDER BY c.ORDINAL_POSITION
        `;
    } else {
        // MySQL
        query = `
            SELECT
                column_name AS name,
                column_type AS type,
                is_nullable = 'YES' AS nullable,
                column_default AS \`default\`,
                column_key = 'PRI' AS primaryKey
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = '${tableName}'
            ORDER BY ordinal_position
        `;
    }

    const rows = (await sql.unsafe(query)).map((row) => ({
        ...row,
        nullable: flag(row.nullable),
        primaryKey: flag(row.primaryKey),
    }));
    return rowsFrom(DESCRIBE_COLUMNS, rows);
}

/**
 * The statement that picks random sample rows from a table, once the table is
 * known to exist. Its rows are fetched as a result like the user's own query.
 */
export async function sampleQuery(
    sql: SqlAdapter,
    dbType: DbType,
    tableName: string,
    limit: number
): Promise<string> {
    await validateTableExists(sql, dbType, tableName);

    const quotedTable = quoteIdentifier(tableName, dbType);
    let query: string;

    if (dbType === DB_TYPES.MYSQL) {
        query = `SELECT * FROM ${quotedTable} ORDER BY RAND() LIMIT ${limit}`;
    } else if (dbType === DB_TYPES.MSSQL) {
        query = `SELECT TOP ${limit} * FROM ${quotedTable} ORDER BY NEWID()`;
    } else {
        // PostgreSQL and SQLite both use RANDOM()
        query = `SELECT * FROM ${quotedTable} ORDER BY RANDOM() LIMIT ${limit}`;
    }
    return query;
}

/**
 * Get indexes for a table
 */
export async function getIndexes(
    sql: SqlAdapter,
    dbType: DbType,
    tableName: string
): Promise<FetchedRows> {
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
    } else if (dbType === DB_TYPES.MSSQL) {
        query = `
            SELECT
                i.name AS index_name,
                i.type_desc AS index_type,
                i.is_unique AS is_unique,
                i.is_primary_key AS is_primary_key
            FROM sys.indexes i
            WHERE i.object_id = OBJECT_ID('${tableName}')
              AND i.name IS NOT NULL
            ORDER BY i.name
        `;
    } else {
        // MySQL
        query = `SHOW INDEX FROM ${quoteIdentifier(tableName, dbType)}`;
    }

    // The columns, and their order, are each database's own
    return sql.fetch(query);
}

/**
 * Get foreign key relationships for a table
 */
export async function getForeignKeys(
    sql: SqlAdapter,
    dbType: DbType,
    tableName: string
): Promise<ForeignKeys> {
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

    } else if (dbType === DB_TYPES.MSSQL) {
        // Outgoing FKs: what this table references
        const outgoingQuery = `
            SELECT
                c.name AS col,
                rt.name AS ref_table,
                rc.name AS ref_col
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
            JOIN sys.tables rt ON fkc.referenced_object_id = rt.object_id
            JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
            WHERE OBJECT_NAME(fk.parent_object_id) = '${tableName}'
        `;
        const outgoing = await sql.unsafe(outgoingQuery);
        references = (outgoing as Record<string, unknown>[]).map(row => ({
            column: String(row.col),
            referencesTable: String(row.ref_table),
            referencesColumn: String(row.ref_col),
        }));

        // Incoming FKs: what references this table
        const incomingQuery = `
            SELECT
                OBJECT_NAME(fk.parent_object_id) AS from_table,
                c.name AS from_col,
                rc.name AS to_col
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
            JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
            WHERE OBJECT_NAME(fk.referenced_object_id) = '${tableName}'
        `;
        const incoming = await sql.unsafe(incomingQuery);
        referencedBy = (incoming as Record<string, unknown>[]).map(row => ({
            fromTable: String(row.from_table),
            fromColumn: String(row.from_col),
            toColumn: String(row.to_col),
        }));

    } else {
        throw new Error(`Foreign key lookup not supported for database type: ${dbType}`);
    }

    return {
        references: rowsFrom(['column', 'referencesTable', 'referencesColumn'], references as unknown as Record<string, unknown>[]),
        referencedBy: rowsFrom(['fromTable', 'fromColumn', 'toColumn'], referencedBy as unknown as Record<string, unknown>[]),
    };
}

/**
 * Get data profiling stats for a table
 */
export async function getTableStats(
    sql: SqlAdapter,
    dbType: DbType,
    tableName: string
): Promise<TableStats> {
    await validateTableExists(sql, dbType, tableName);

    // Get column info first
    const tableDesc = await describeColumns(sql, dbType, tableName);
    const columnNames = tableDesc.rows.map((row) => String(row[0]));

    // Validate all column names upfront
    for (const colName of columnNames) {
        validateIdentifier(colName, 'column');
    }

    const quotedTable = quoteIdentifier(tableName, dbType);

    if (dbType === DB_TYPES.MSSQL) {
        // MSSQL: use a CTE to get row count and per-column stats in one pass
        // COUNT(DISTINCT ...) doesn't work across all column types in MSSQL, so we do it per-column
        const rowCountResult = await sql.unsafe(`SELECT COUNT(*) AS cnt FROM ${quotedTable}`);
        const rowCount = Number((rowCountResult[0] as Record<string, unknown>).cnt) || 0;

        const columnStats: ColumnStats[] = await Promise.all(
            columnNames.map(async col => {
                const quotedCol = quoteIdentifier(col, dbType);
                const statsResult = await sql.unsafe(
                    `SELECT COUNT(*) - COUNT(${quotedCol}) AS null_count, COUNT(DISTINCT ${quotedCol}) AS distinct_count FROM ${quotedTable}`
                );
                const r = statsResult[0] as Record<string, unknown>;
                return {
                    column: col,
                    nullCount: Number(r.null_count) || 0,
                    distinctCount: Number(r.distinct_count) || 0,
                };
            })
        );

        return { rowCount, columns: rowsFrom(STATS_COLUMNS, columnStats as unknown as Record<string, unknown>[]) };
    }

    // Build a SINGLE query that gets all stats in one table scan (non-MSSQL)
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

    return { rowCount, columns: rowsFrom(STATS_COLUMNS, columnStats as unknown as Record<string, unknown>[]) };
}

const STATS_COLUMNS = ['column', 'nullCount', 'distinctCount'];

/**
 * Introspect full schema (all tables)
 */
export async function introspectSchema(
    sql: SqlAdapter,
    dbType: DbType
): Promise<SchemaInfo> {
    const tables = await getTables(sql, dbType);
    const schema: SchemaInfo = {};

    for (const table of tables) {
        // A listed table whose name is not a safe identifier cannot be described safely
        try {
            validateIdentifier(table, 'table');
        } catch {
            continue;
        }
        schema[table] = await describeColumns(sql, dbType, table);
    }

    return schema;
}
