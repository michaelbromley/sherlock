#!/usr/bin/env tsx
/* eslint-disable no-console */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { loadConfig } from './load-config';
import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';

/**
 * Logs a query and its result to a connection-specific log file
 */
function logQuery(connectionName: string, query: string, result: any): void {
    const logsDir = path.join(__dirname, '../output/logs');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }

    const logFile = path.join(logsDir, `${connectionName}.md`);
    const timestamp = new Date().toISOString();

    // Truncate large result sets for logging
    let logResult = result;
    if (result && Array.isArray(result.rows) && result.rows.length > 10) {
        const omittedCount = result.rows.length - 10;
        logResult = {
            ...result,
            rows: [
                ...result.rows.slice(0, 10),
                `... ${omittedCount.toLocaleString()} ${omittedCount === 1 ? 'result' : 'results'} omitted ...`
            ]
        };
    }

    // Format as markdown
    const logEntry = `${timestamp}

\`\`\`sql
${query}
\`\`\`

\`\`\`json
${JSON.stringify(logResult, null, 2)}
\`\`\`

---

`;

    // Append to log file
    fs.appendFileSync(logFile, logEntry, 'utf-8');
}

/**
 * Execute a command with a database connection
 */
async function withDataSource<T>(
    connectionName: string,
    handler: (dataSource: DataSource) => Promise<T>,
): Promise<T> {
    const dataSource = new DataSource({
        ...loadConfig(connectionName),
        logging: false,
    });

    try {
        await dataSource.initialize();
        return await handler(dataSource);
    } catch (error: any) {
        console.error(
            JSON.stringify({
                error: error.message,
                stack: error.stack,
            }),
        );
        process.exit(1);
    } finally {
        await dataSource.destroy();
    }
}

/**
 * Set up CLI with Commander
 */
function setupCLI() {
    const program = new Command();

    program
        .name('query-db')
        .description('Database introspection and query tool with read-only access')
        .version('1.0.0');

    // Global options
    program
        .option('-c, --connection <name>', 'database connection name from config.ts', 'default')
        .option('--no-log', 'disable query logging to output/logs directory');

    // Tables command
    program
        .command('tables')
        .description('List all tables in the database')
        .action(async () => {
            const opts = program.opts();
            await withDataSource(opts.connection, async (dataSource) => {
                const tables = await getTables(dataSource);
                console.log(JSON.stringify({ tables }, null, 2));
            });
        });

    // Introspect command
    program
        .command('introspect')
        .description('Get schema information for all tables')
        .action(async () => {
            const opts = program.opts();
            await withDataSource(opts.connection, async (dataSource) => {
                const result = await introspectSchema(dataSource);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Describe command
    program
        .command('describe <table>')
        .description('Describe a specific table schema')
        .action(async (tableName: string) => {
            const opts = program.opts();
            await withDataSource(opts.connection, async (dataSource) => {
                const result = await describeTable(dataSource, tableName);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Query command
    program
        .command('query <sql>')
        .description('Execute a read-only SQL query')
        .action(async (sql: string) => {
            const opts = program.opts();

            // Enforce read-only with comprehensive validation
            const validationError = validateReadOnlyQuery(sql);
            if (validationError) {
                console.error(JSON.stringify({ error: validationError }));
                process.exit(1);
            }

            await withDataSource(opts.connection, async (dataSource) => {
                const result = await executeQuery(dataSource, sql);

                // Log the query and result (unless --no-log is specified)
                if (opts.log !== false) {
                    logQuery(opts.connection, sql, result);
                }

                console.log(JSON.stringify(result, null, 2));
            });
        });

    return program;
}

async function getTables(dataSource: DataSource): Promise<string[]> {
    const dbType = dataSource.options.type;

    let query: string;
    if (dbType === 'postgres') {
        query =
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
    } else if (dbType === 'better-sqlite3' || dbType === 'sqljs') {
        query =
            "SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
    } else {
        query = 'SHOW TABLES';
    }

    const result = await dataSource.query(query);

    if (dbType === 'postgres' || dbType === 'better-sqlite3' || dbType === 'sqljs') {
        return result.map((row: any) => row.table_name || row.name);
    } else {
        // MySQL/MariaDB
        const key = Object.keys(result[0])[0];
        return result.map((row: any) => row[key]);
    }
}

async function describeTable(dataSource: DataSource, tableName: string): Promise<any> {
    const dbType = dataSource.options.type;

    let query: string;
    if (dbType === 'postgres') {
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
    } else if (dbType === 'better-sqlite3' || dbType === 'sqljs') {
        // SQLite needs proper quoting for reserved keywords
        query = `PRAGMA table_info(\`${tableName}\`)`;
    } else {
        // MySQL/MariaDB needs backticks for reserved keywords like 'order'
        query = `DESCRIBE \`${tableName}\``;
    }

    const result = await dataSource.query(query);
    return { table: tableName, columns: result };
}

async function introspectSchema(dataSource: DataSource): Promise<any> {
    const tables = await getTables(dataSource);
    const schema: any = {};

    for (const table of tables) {
        const tableInfo = await describeTable(dataSource, table);
        schema[table] = tableInfo.columns;
    }

    return schema;
}

/**
 * Validates that a query is read-only and safe to execute.
 * Checks for dangerous keywords anywhere in the query, not just at the start.
 */
function validateReadOnlyQuery(query: string): string | null {
    const normalizedQuery = query.trim().toUpperCase();

    // Check if query starts with allowed commands
    const allowedStarts = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN', 'WITH'];
    const startsWithAllowed = allowedStarts.some(cmd => normalizedQuery.startsWith(cmd));

    if (!startsWithAllowed) {
        return 'Only SELECT, SHOW, DESCRIBE, EXPLAIN, and WITH queries are allowed (read-only mode)';
    }

    // Check for multiple statements (prevent SQL injection via chained queries)
    const semicolonCount = (query.match(/;/g) || []).length;
    if (semicolonCount > 1 || (semicolonCount === 1 && !query.trim().endsWith(';'))) {
        return 'Multiple statements are not allowed (read-only mode)';
    }

    // Dangerous keywords that should never appear in read-only queries
    const dangerousKeywords = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
        'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL',
        'MERGE', 'REPLACE', 'RENAME', 'COMMENT',
        'LOCK', 'UNLOCK', 'SET', 'BEGIN', 'COMMIT', 'ROLLBACK',
        'SAVEPOINT', 'PREPARE', 'DEALLOCATE',
        // Dangerous functions
        'INTO OUTFILE', 'INTO DUMPFILE', 'LOAD DATA', 'LOAD XML',
        // PostgreSQL specific
        'COPY', 'VACUUM', 'ANALYZE', 'REINDEX', 'CLUSTER',
    ];

    for (const keyword of dangerousKeywords) {
        // Use word boundaries to avoid false positives (e.g., "INSERTED" column name)
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(query)) {
            return `Dangerous keyword detected: ${keyword}. Only read-only queries are allowed.`;
        }
    }

    // Check for comments that might hide malicious code
    if (query.includes('/*') || query.includes('--') || query.includes('#')) {
        // Allow comments but verify they don't contain dangerous keywords
        const withoutComments = query
            .replace(/\/\*[\s\S]*?\*\//g, ' ') // Remove /* */ comments
            .replace(/--[^\n]*/g, ' ')         // Remove -- comments
            .replace(/#[^\n]*/g, ' ');         // Remove # comments

        // Re-validate without comments
        for (const keyword of dangerousKeywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(withoutComments)) {
                return `Dangerous keyword detected: ${keyword}. Only read-only queries are allowed.`;
            }
        }
    }

    return null; // Query is safe
}

async function executeQuery(dataSource: DataSource, query: string): Promise<any> {
    try {
        // Execute query in a read-only transaction (best effort)
        // Note: This works for PostgreSQL, may not be enforced in all databases
        const queryRunner = dataSource.createQueryRunner();

        try {
            await queryRunner.connect();

            // Set transaction to read-only (PostgreSQL, MySQL 8.0+)
            try {
                await queryRunner.query('SET TRANSACTION READ ONLY');
            } catch (e) {
                // Some databases don't support this, continue anyway
                // Our validation above provides the main protection
            }

            await queryRunner.startTransaction('READ UNCOMMITTED');

            const result = await queryRunner.query(query);

            await queryRunner.commitTransaction();

            return {
                rowCount: Array.isArray(result) ? result.length : 0,
                rows: result,
            };
        } finally {
            await queryRunner.release();
        }
    } catch (error: any) {
        return {
            error: error.message,
        };
    }
}

// Set up and parse CLI
const program = setupCLI();
program.parse(process.argv);
