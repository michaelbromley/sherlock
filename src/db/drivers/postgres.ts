/**
 * PostgreSQL through the `postgres` package.
 *
 * Every statement runs on a reserved connection inside
 * `BEGIN TRANSACTION READ ONLY` with a local statement timeout, and is always
 * rolled back. The user's statement is run as a cursor: the extended protocol,
 * on which the server refuses a second statement, and whose row limit stops the
 * server after `maxRows + 1` rows for any statement, SHOW and EXPLAIN included.
 */

import postgres from 'postgres';
import { DB_TYPES } from '../../db-types';
import { readOnlyWrapper, runWrapped } from '../read-only';
import { FETCH_BATCH_ROWS, RowCollector, type Column, type FetchOptions, type FetchedRows, type SqlAdapter } from '../adapter';

/** The built-in types, by OID, so most results need no lookup */
const BUILTIN_TYPES: Record<number, string> = {
    16: 'bool', 17: 'bytea', 18: 'char', 19: 'name', 20: 'int8', 21: 'int2', 23: 'int4', 24: 'regproc',
    25: 'text', 26: 'oid', 114: 'json', 142: 'xml', 194: 'pg_node_tree', 600: 'point', 650: 'cidr',
    700: 'float4', 701: 'float8', 705: 'unknown', 790: 'money', 829: 'macaddr', 869: 'inet',
    1042: 'bpchar', 1043: 'varchar', 1082: 'date', 1083: 'time', 1114: 'timestamp', 1184: 'timestamptz',
    1186: 'interval', 1266: 'timetz', 1560: 'bit', 1562: 'varbit', 1700: 'numeric', 2249: 'record',
    2278: 'void', 2950: 'uuid', 3614: 'tsvector', 3802: 'jsonb', 4089: 'regnamespace', 2205: 'regclass',
    199: '_json', 1000: '_bool', 1001: '_bytea', 1003: '_name', 1005: '_int2', 1007: '_int4', 1009: '_text',
    1015: '_varchar', 1016: '_int8', 1021: '_float4', 1022: '_float8', 1028: '_oid', 1115: '_timestamp',
    1182: '_date', 1185: '_timestamptz', 1231: '_numeric', 2951: '_uuid', 3807: '_jsonb',
};

type Sql = postgres.Sql;
type Reserved = postgres.ReservedSql;

interface PostgresColumn {
    name: string;
    type: number;
}

export interface PostgresOptions {
    url: string;
    connectTimeoutMs: number;
    statementTimeoutMs: number;
}

export function openPostgres(options: PostgresOptions): SqlAdapter {
    const sql: Sql = postgres(options.url, {
        max: 1,
        connect_timeout: Math.max(1, Math.ceil(options.connectTimeoutMs / 1000)),
        // The package prints server notices to the console by default, which
        // would put them on stdout beside the envelope.
        onnotice: () => undefined,
        connection: { application_name: 'sherlock' },
    });

    const wrapper = readOnlyWrapper(DB_TYPES.POSTGRES, options.statementTimeoutMs)!;

    /** Run statements in a read-only transaction that is always rolled back */
    const readOnly = async <T>(fn: (reserved: Reserved) => Promise<T>): Promise<T> => {
        const reserved = await sql.reserve();
        try {
            return await runWrapped(
                { unsafe: async (statement) => [...await reserved.unsafe(statement)] },
                wrapper,
                () => fn(reserved)
            );
        } finally {
            reserved.release();
        }
    };

    return {
        unsafe: (query) => readOnly(async (reserved) => [...await reserved.unsafe(query)] as Record<string, unknown>[]),

        fetch: (query, fetchOptions = {}) => readOnly((reserved) => fetchRows(reserved, query, fetchOptions)),

        close: () => sql.end({ timeout: 5 }),
    };
}

async function fetchRows(reserved: Reserved, query: string, options: FetchOptions): Promise<FetchedRows> {
    const collector = new RowCollector(options);
    const batchSize = options.maxRows !== undefined ? options.maxRows + 1 : FETCH_BATCH_ROWS;

    let described: PostgresColumn[] | undefined;
    let columns: Column[] = [];
    const cursor = reserved.unsafe(query).values().cursor(batchSize) as AsyncIterable<unknown[][] & { columns?: PostgresColumn[] }>;
    for await (const batch of cursor) {
        if (!described) {
            described = batch.columns ?? [];
            columns = await namedColumns(reserved, described);
            collector.setColumns(columns);
        }
        if (collector.add([...batch])) break;
    }

    // A result with no rows yields no batch. Describing the statement parses it
    // without running it, and gives the columns.
    if (!described) {
        const description = await reserved.unsafe(query).describe() as unknown as { columns?: PostgresColumn[] };
        columns = await namedColumns(reserved, description.columns ?? []);
    }
    return collector.result(columns);
}

/** Columns with their type names, looking up any type that is not built in */
async function namedColumns(reserved: Reserved, columns: PostgresColumn[]): Promise<Column[]> {
    const unknown = Array.from(new Set(columns.map((c) => c.type).filter((oid) => oid && !(oid in BUILTIN_TYPES))));
    const looked: Record<number, string> = {};
    if (unknown.length > 0) {
        const rows = await reserved.unsafe(
            'SELECT oid::int AS oid, typname FROM pg_type WHERE oid = ANY($1::oid[])',
            [unknown as never]
        ) as unknown as Array<{ oid: number; typname: string }>;
        for (const row of rows) looked[row.oid] = row.typname;
    }
    return columns.map((column) => {
        const type = BUILTIN_TYPES[column.type] ?? looked[column.type];
        return type ? { name: column.name, type: type.toLowerCase() } : { name: column.name };
    });
}
