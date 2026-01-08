#!/usr/bin/env bun
/* eslint-disable no-console */
import { SQL } from 'bun';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { resolveConnection, listConnections, getConnectionConfig } from './config';
import { getLogsDir, ensureLogsDir, getConfigDir, ensureConfigDir } from './config/paths';
import type { ResolvedConnectionConfig } from './config/types';

/**
 * Logs a query and its result to a connection-specific log file
 */
function logQuery(connectionName: string, query: string, result: any): void {
    ensureLogsDir();
    const logFile = path.join(getLogsDir(), `${connectionName}.md`);
    const timestamp = new Date().toISOString();

    // Truncate large result sets for logging
    let logResult = result;
    if (result && Array.isArray(result.rows) && result.rows.length > 10) {
        const omittedCount = result.rows.length - 10;
        logResult = {
            ...result,
            rows: [
                ...result.rows.slice(0, 10),
                `... ${omittedCount.toLocaleString()} ${omittedCount === 1 ? 'result' : 'results'} omitted ...`,
            ],
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
 * Create a Bun.SQL connection from resolved config
 */
function createConnection(config: ResolvedConnectionConfig): ReturnType<typeof SQL> {
    return new SQL(config.url);
}

/**
 * Execute a command with a database connection
 */
async function withConnection<T>(
    connectionName: string,
    configPath: string | undefined,
    handler: (sql: ReturnType<typeof SQL>, dbType: string) => Promise<T>
): Promise<T> {
    let sql: ReturnType<typeof SQL> | null = null;

    try {
        const config = await resolveConnection(connectionName, configPath);
        sql = createConnection(config);
        return await handler(sql, config.type);
    } catch (error: any) {
        console.error(
            JSON.stringify({
                error: error.message,
                stack: error.stack,
            })
        );
        process.exit(1);
    } finally {
        if (sql) {
            sql.close();
        }
    }
}

/**
 * Set up CLI with Commander
 */
function setupCLI() {
    const program = new Command();

    program
        .name('sherlock')
        .description('Database query tool with read-only access')
        .version('2.0.0');

    // Global options
    program
        .option('-c, --connection <name>', 'database connection name from config', 'default')
        .option('--config <path>', 'path to config file')
        .option('--no-log', 'disable query logging');

    // Tables command
    program
        .command('tables')
        .description('List all tables in the database')
        .action(async () => {
            const opts = program.opts();
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const tables = await getTables(sql, dbType);
                console.log(JSON.stringify({ tables }, null, 2));
            });
        });

    // Introspect command
    program
        .command('introspect')
        .description('Get schema information for all tables')
        .action(async () => {
            const opts = program.opts();
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await introspectSchema(sql, dbType);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Describe command
    program
        .command('describe <table>')
        .description('Describe a specific table schema')
        .action(async (tableName: string) => {
            const opts = program.opts();
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await describeTable(sql, dbType, tableName);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Query command
    program
        .command('query <sql>')
        .description('Execute a read-only SQL query')
        .action(async (sqlQuery: string) => {
            const opts = program.opts();

            // Enforce read-only with comprehensive validation
            const validationError = validateReadOnlyQuery(sqlQuery);
            if (validationError) {
                console.error(JSON.stringify({ error: validationError }));
                process.exit(1);
            }

            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await executeQuery(sql, dbType, sqlQuery);

                // Log the query and result (unless --no-log is specified)
                if (opts.log !== false) {
                    logQuery(opts.connection, sqlQuery, result);
                }

                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Connections list command
    program
        .command('connections')
        .description('List all configured connections')
        .action(() => {
            const opts = program.opts();
            try {
                const connections = listConnections(opts.config);
                console.log(JSON.stringify({ connections }, null, 2));
            } catch (error: any) {
                console.error(JSON.stringify({ error: error.message }));
                process.exit(1);
            }
        });

    // Init command
    program
        .command('init')
        .description('Initialize Sherlock configuration')
        .action(async () => {
            await initConfig();
        });

    // Test connection command
    program
        .command('test [connectionName]')
        .description('Test a database connection')
        .action(async (connectionName?: string) => {
            const opts = program.opts();
            const connName = connectionName || opts.connection;

            console.log(`Testing connection: ${connName}...`);

            try {
                const config = await resolveConnection(connName, opts.config);
                const sql = createConnection(config);

                // Simple query to test connection
                const testQuery = config.type === 'mysql' ? 'SELECT 1' : 'SELECT 1 as test';
                await sql.unsafe(testQuery);
                sql.close();

                console.log(`\x1b[32m✓ Connection "${connName}" successful!\x1b[0m`);
                console.log(`  Type: ${config.type}`);
            } catch (error: any) {
                console.error(`\x1b[31m✗ Connection "${connName}" failed\x1b[0m`);
                console.error(`  Error: ${error.message}`);
                process.exit(1);
            }
        });

    // Migrate command
    program
        .command('migrate')
        .description('Migrate legacy config.ts to new JSON format')
        .option('--from <path>', 'path to legacy config.ts', 'config.ts')
        .action(async (cmdOpts) => {
            await migrateConfig(cmdOpts.from);
        });

    return program;
}

async function getTables(sql: ReturnType<typeof SQL>, dbType: string): Promise<string[]> {
    let query: string;

    if (dbType === 'postgres') {
        query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
    } else if (dbType === 'sqlite') {
        query = "SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
    } else {
        // MySQL
        query = 'SHOW TABLES';
    }

    const result = await sql.unsafe(query);

    if (dbType === 'postgres' || dbType === 'sqlite') {
        return result.map((row: any) => row.table_name || row.name);
    } else {
        // MySQL
        const key = Object.keys(result[0])[0];
        return result.map((row: any) => row[key]);
    }
}

async function describeTable(
    sql: ReturnType<typeof SQL>,
    dbType: string,
    tableName: string
): Promise<any> {
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
    } else if (dbType === 'sqlite') {
        query = `PRAGMA table_info(\`${tableName}\`)`;
    } else {
        // MySQL - needs backticks for reserved keywords
        query = `DESCRIBE \`${tableName}\``;
    }

    const result = await sql.unsafe(query);
    return { table: tableName, columns: result };
}

async function introspectSchema(sql: ReturnType<typeof SQL>, dbType: string): Promise<any> {
    const tables = await getTables(sql, dbType);
    const schema: any = {};

    for (const table of tables) {
        const tableInfo = await describeTable(sql, dbType, table);
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
    const startsWithAllowed = allowedStarts.some((cmd) => normalizedQuery.startsWith(cmd));

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
        'INSERT',
        'UPDATE',
        'DELETE',
        'DROP',
        'CREATE',
        'ALTER',
        'TRUNCATE',
        'GRANT',
        'REVOKE',
        'EXEC',
        'EXECUTE',
        'CALL',
        'MERGE',
        'REPLACE',
        'RENAME',
        'COMMENT',
        'LOCK',
        'UNLOCK',
        'SET',
        'BEGIN',
        'COMMIT',
        'ROLLBACK',
        'SAVEPOINT',
        'PREPARE',
        'DEALLOCATE',
        // Dangerous functions
        'INTO OUTFILE',
        'INTO DUMPFILE',
        'LOAD DATA',
        'LOAD XML',
        // PostgreSQL specific
        'COPY',
        'VACUUM',
        'REINDEX',
        'CLUSTER',
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
            .replace(/--[^\n]*/g, ' ') // Remove -- comments
            .replace(/#[^\n]*/g, ' '); // Remove # comments

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

async function executeQuery(
    sql: ReturnType<typeof SQL>,
    dbType: string,
    query: string
): Promise<any> {
    try {
        const result = await sql.unsafe(query);

        return {
            rowCount: Array.isArray(result) ? result.length : 0,
            rows: result,
        };
    } catch (error: any) {
        return {
            error: error.message,
        };
    }
}

/**
 * Initialize Sherlock configuration
 */
async function initConfig(): Promise<void> {
    ensureConfigDir();
    const configDir = getConfigDir();
    const configPath = path.join(configDir, 'config.json');
    const envPath = path.join(configDir, '.env');

    if (fs.existsSync(configPath)) {
        console.log(`Config already exists at: ${configPath}`);
        return;
    }

    // Create example config
    const exampleConfig = {
        version: '2.0',
        connections: {
            default: {
                type: 'postgres',
                host: 'localhost',
                port: 5432,
                database: 'mydb',
                username: { $env: 'SHERLOCK_DEFAULT_USERNAME' },
                password: { $env: 'SHERLOCK_DEFAULT_PASSWORD' },
            },
            example_mysql: {
                type: 'mysql',
                host: 'localhost',
                port: 3306,
                database: 'mydb',
                username: { $env: 'SHERLOCK_EXAMPLE_MYSQL_USERNAME' },
                password: { $env: 'SHERLOCK_EXAMPLE_MYSQL_PASSWORD' },
            },
        },
    };

    fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2), 'utf-8');
    fs.chmodSync(configPath, 0o600);

    // Create example .env
    const exampleEnv = `# Sherlock Database Credentials
# Set your database credentials here

# Default connection
SHERLOCK_DEFAULT_USERNAME=your_username
SHERLOCK_DEFAULT_PASSWORD=your_password

# Example MySQL connection
SHERLOCK_EXAMPLE_MYSQL_USERNAME=your_username
SHERLOCK_EXAMPLE_MYSQL_PASSWORD=your_password
`;

    fs.writeFileSync(envPath, exampleEnv, 'utf-8');
    fs.chmodSync(envPath, 0o600);

    console.log(`Sherlock initialized!

Config created at: ${configPath}
Env file created at: ${envPath}

Next steps:
1. Edit ${configPath} to add your database connections
2. Set your credentials in ${envPath} or as environment variables
3. Run 'sherlock connections' to verify your setup
4. Run 'sherlock tables' to list tables in your database
`);
}

/**
 * Migrate legacy config.ts to new JSON format
 */
async function migrateConfig(fromPath: string): Promise<void> {
    const absoluteFromPath = path.resolve(fromPath);

    if (!fs.existsSync(absoluteFromPath)) {
        console.error(`Legacy config not found: ${absoluteFromPath}`);
        process.exit(1);
    }

    console.log(`Migrating from: ${absoluteFromPath}`);

    // Load legacy config
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const legacyConfig = require(absoluteFromPath);

    if (!legacyConfig.connections) {
        console.error('Invalid legacy config: missing "connections" export');
        process.exit(1);
    }

    // Convert to new format
    const newConnections: Record<string, any> = {};
    const envVars: string[] = [];

    for (const [name, opts] of Object.entries(legacyConfig.connections as Record<string, any>)) {
        const envPrefix = `SHERLOCK_${name.toUpperCase().replace(/-/g, '_')}`;

        const newConn: any = {
            type: opts.type === 'better-sqlite3' ? 'sqlite' : opts.type,
        };

        if (opts.type === 'better-sqlite3' || opts.type === 'sqlite') {
            newConn.filename = opts.database;
        } else {
            newConn.host = opts.host;
            newConn.port = opts.port;
            newConn.database = opts.database;
            newConn.username = { $env: `${envPrefix}_USERNAME` };
            newConn.password = { $env: `${envPrefix}_PASSWORD` };

            // Track env vars for .env file
            envVars.push(`${envPrefix}_USERNAME=${opts.username || ''}`);
            envVars.push(`${envPrefix}_PASSWORD=${opts.password || ''}`);
        }

        newConnections[name] = newConn;
    }

    const newConfig = {
        version: '2.0',
        connections: newConnections,
    };

    // Write to config directory
    ensureConfigDir();
    const configDir = getConfigDir();
    const configPath = path.join(configDir, 'config.json');
    const envPath = path.join(configDir, '.env');

    // Check if files already exist
    if (fs.existsSync(configPath)) {
        console.log(`\x1b[33mWarning: ${configPath} already exists\x1b[0m`);
        const backupPath = configPath + '.backup.' + Date.now();
        fs.copyFileSync(configPath, backupPath);
        console.log(`  Backed up to: ${backupPath}`);
    }

    // Write new config
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    fs.chmodSync(configPath, 0o600);
    console.log(`\x1b[32m✓\x1b[0m Created: ${configPath}`);

    // Write .env file
    const envContent = `# Sherlock Database Credentials
# Generated by 'sherlock migrate' from ${fromPath}
# IMPORTANT: Review and update these credentials!

${envVars.join('\n')}
`;

    fs.writeFileSync(envPath, envContent, 'utf-8');
    fs.chmodSync(envPath, 0o600);
    console.log(`\x1b[32m✓\x1b[0m Created: ${envPath}`);

    console.log(`
Migration complete!

\x1b[33mIMPORTANT:\x1b[0m
1. Review ${envPath} and ensure credentials are correct
2. The .env file contains your credentials - keep it secure!
3. You can now delete the old ${fromPath} file
4. Run 'sherlock test <connection>' to verify each connection
`);
}

// Set up and parse CLI
const program = setupCLI();
program.parse(process.argv);
