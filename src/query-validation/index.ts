/**
 * Query validation module
 * Ensures queries are read-only and safe to execute
 */

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
 * @param query - The SQL query to validate
 * @returns ValidationResult with valid=true if safe, or valid=false with error message
 */
export function validateReadOnlyQuery(query: string): ValidationResult {
    const normalizedQuery = query.trim().toUpperCase();

    // Check if query starts with allowed commands
    const startsWithAllowed = ALLOWED_QUERY_STARTS.some((cmd) =>
        normalizedQuery.startsWith(cmd)
    );

    if (!startsWithAllowed) {
        return {
            valid: false,
            error: 'Only SELECT, SHOW, DESCRIBE, EXPLAIN, and WITH queries are allowed (read-only mode)',
        };
    }

    // Check for multiple statements (prevent SQL injection via chained queries)
    const semicolonCount = (query.match(/;/g) || []).length;
    if (semicolonCount > 1 || (semicolonCount === 1 && !query.trim().endsWith(';'))) {
        return {
            valid: false,
            error: 'Multiple statements are not allowed (read-only mode)',
        };
    }

    // Check for dangerous keywords anywhere in the query
    const dangerousKeyword = findDangerousKeyword(query);
    if (dangerousKeyword) {
        return {
            valid: false,
            error: `Dangerous keyword detected: ${dangerousKeyword}. Only read-only queries are allowed.`,
        };
    }

    // Check comments for hidden dangerous keywords
    if (hasComments(query)) {
        const withoutComments = stripComments(query);
        const hiddenKeyword = findDangerousKeyword(withoutComments);
        if (hiddenKeyword) {
            return {
                valid: false,
                error: `Dangerous keyword detected: ${hiddenKeyword}. Only read-only queries are allowed.`,
            };
        }
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

/** Checks if a query contains SQL comments */
function hasComments(query: string): boolean {
    return query.includes('/*') || query.includes('--') || query.includes('#');
}

/** Strips SQL comments from a query */
function stripComments(query: string): string {
    return query
        .replace(/\/\*[\s\S]*?\*\//g, ' ')  // Remove /* */ comments
        .replace(/--[^\n]*/g, ' ')           // Remove -- comments
        .replace(/#[^\n]*/g, ' ');           // Remove # comments (MySQL)
}
