/**
 * Database type constants and utilities
 */

/** Supported database types */
export const DB_TYPES = {
    POSTGRES: 'postgres',
    MYSQL: 'mysql',
    SQLITE: 'sqlite',
} as const;

/** Database type union */
export type DbType = typeof DB_TYPES[keyof typeof DB_TYPES];

/** All supported database types as an array */
export const ALL_DB_TYPES: DbType[] = Object.values(DB_TYPES);

/** Check if a string is a valid database type */
export function isValidDbType(type: string): type is DbType {
    return ALL_DB_TYPES.includes(type as DbType);
}

/** Default ports for each database type */
export const DEFAULT_PORTS: Record<DbType, number> = {
    [DB_TYPES.POSTGRES]: 5432,
    [DB_TYPES.MYSQL]: 3306,
    [DB_TYPES.SQLITE]: 0, // SQLite doesn't use ports
};

/** Simple test query for each database type */
export const TEST_QUERIES: Record<DbType, string> = {
    [DB_TYPES.POSTGRES]: 'SELECT 1 as test',
    [DB_TYPES.MYSQL]: 'SELECT 1',
    [DB_TYPES.SQLITE]: 'SELECT 1',
};
