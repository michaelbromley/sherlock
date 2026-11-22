/**
 * Query validation module
 * Ensures queries are read-only and safe to execute
 */

import type { DbType } from '../db-types';
import { scanSql, SQL_DIALECTS } from './scan';

/** Keywords that indicate read-only query types */
const ALLOWED_QUERY_STARTS = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'WITH'] as const;

/** Keywords that should never appear in read-only queries */
const DANGEROUS_KEYWORDS = [
    // DML operations
    'INSERT',
    'UPDATE',
    'DELETE',
    'MERGE',
    'REPLACE',
    // DDL operations
    'DROP',
    'CREATE',
    'ALTER',
    'TRUNCATE',
    'RENAME',
    'COMMENT',
    // DCL operations
    'GRANT',
    'REVOKE',
    // Execution
    'EXEC',
    'EXECUTE',
    'CALL',
    // Transaction control
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    'SAVEPOINT',
    // Locking
    'LOCK',
    'UNLOCK',
    // Session/connection
    'SET',
    'PREPARE',
    'DEALLOCATE',
    // File operations (MySQL)
    'INTO OUTFILE',
    'INTO DUMPFILE',
    // SELECT ... INTO creates a table (SQL Server, PostgreSQL) or writes a file
    // or variable (MySQL). INSERT INTO is already caught by INSERT.
    'INTO',
    'LOAD DATA',
    'LOAD XML',
    // PostgreSQL specific
    'COPY',
    'VACUUM',
    'REINDEX',
    'CLUSTER',
] as const;

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates that a query is read-only and safe to execute.
 * Uses a whitelist approach - only explicitly allowed query types pass.
 *
 * The checks run on the statement's code only: string literals, quoted
 * identifiers and comments are set aside first, so a keyword inside
 * `'delete'` or a semicolon inside a string does not block a query. How quotes
 * and comments are read depends on the database, so pass its type. Without
 * one, the query must pass under every SQL dialect sherlock supports.
 *
 * @param query - The SQL query to validate
 * @param dbType - The database the query will run on, when known
 * @returns ValidationResult with valid=true if safe, or valid=false with error message
 */
export function validateReadOnlyQuery(query: string, dbType?: DbType): ValidationResult {
    const dialects = dbType && SQL_DIALECTS.includes(dbType) ? [dbType] : SQL_DIALECTS;

    for (const dialect of dialects) {
        const scanned = scanSql(query, dialect);
        if (!scanned.ok) {
            return { valid: false, error: `${scanned.error}. Only read-only queries are allowed.` };
        }
        const result = validateCode(scanned.code);
        if (!result.valid) return result;
    }

    return { valid: true };
}

/** Check a statement with its literals, quoted identifiers and comments removed */
function validateCode(code: string): ValidationResult {
    const normalizedQuery = code.trim().toUpperCase();

    // Check if query starts with allowed commands
    const startsWithAllowed = ALLOWED_QUERY_STARTS.some((cmd) =>
        new RegExp(`^${cmd}\\b`).test(normalizedQuery)
    );

    if (!startsWithAllowed) {
        return {
            valid: false,
            error: 'Only SELECT, SHOW, DESCRIBE, EXPLAIN, and WITH queries are allowed (read-only mode)',
        };
    }

    // Check for multiple statements (prevent SQL injection via chained queries)
    const semicolonCount = (code.match(/;/g) || []).length;
    if (semicolonCount > 1 || (semicolonCount === 1 && !code.trim().endsWith(';'))) {
        return {
            valid: false,
            error: 'Multiple statements are not allowed (read-only mode)',
        };
    }

    // Check for dangerous keywords anywhere in the code
    const dangerousKeyword = findDangerousKeyword(code);
    if (dangerousKeyword) {
        return {
            valid: false,
            error: `Dangerous keyword detected: ${dangerousKeyword}. Only read-only queries are allowed.`,
        };
    }

    return { valid: true };
}

/**
 * Finds the first dangerous keyword in a query
 * Uses word boundaries to avoid false positives (e.g., "INSERTED" column name)
 */
function findDangerousKeyword(query: string): string | null {
    for (const keyword of DANGEROUS_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(query)) {
            return keyword;
        }
    }
    return null;
}
