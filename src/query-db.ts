#!/usr/bin/env bun
/* eslint-disable no-console */
import { SQL } from 'bun';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as p from '@clack/prompts';
import { resolveConnection, listConnections, getConnectionConfig } from './config';
import { getLogsDir, ensureLogsDir, getConfigDir, ensureConfigDir } from './config/paths';
import type { ResolvedConnectionConfig, ConnectionConfig } from './config/types';
import { DB_TYPES, TEST_QUERIES, type DbType } from './db-types';
import {
    setKeychainPassword,
    getKeychainPassword,
    deleteKeychainPassword,
    hasKeychainPassword,
} from './credentials/providers/keychain';
import {
    runSetupWizard,
    addConnectionWizard,
    editConnectionWizard,
    connectionManagerMenu,
} from './tui';
import { validateReadOnlyQuery } from './query-validation';
import pkg from '../package.json';

/** Maximum rows to include in query logs (truncate larger results) */
const MAX_LOG_ROWS = 10;

/** Default number of rows to sample */
const DEFAULT_SAMPLE_LIMIT = 5;

/** Maximum rows allowed for sample command (prevents DoS via ORDER BY RANDOM) */
const MAX_SAMPLE_LIMIT = 1000;

/** Valid SQL identifier pattern (prevents injection via malicious table/column names) */
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Default output format */
const DEFAULT_OUTPUT_FORMAT = 'json' as const;

/** File permissions for sensitive config files (owner read/write only) */
const SECURE_FILE_MODE = 0o600;

/** Set secure permissions on a file (no-op on Windows) */
function setSecurePermissions(filePath: string): void {
    if (process.platform !== 'win32') {
        fs.chmodSync(filePath, SECURE_FILE_MODE);
    }
}

/** Result from executing a query */
interface QueryResult {
    rowCount?: number;
    rows?: unknown[];
    error?: string;
}

/** Schema introspection result */
interface SchemaInfo {
    [tableName: string]: {
        columns: unknown[];
    };
}

/** Narrowed error type with message */
interface ErrorWithMessage {
    message: string;
    stack?: string;
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as ErrorWithMessage).message === 'string'
    );
}

function getErrorMessage(error: unknown): string {
    if (isErrorWithMessage(error)) {
        return error.message;
    }
    return String(error);
}

/**
 * Validates that an identifier (table/column name) is safe to interpolate into SQL.
 * Prevents SQL injection via maliciously-named database objects.
 */
function validateIdentifier(name: string, type: 'table' | 'column'): void {
    if (!SAFE_IDENTIFIER.test(name)) {
        throw new Error(`Invalid ${type} name: "${name}". Names must start with a letter or underscore and contain only alphanumeric characters and underscores.`);
    }
}

/** Supported output formats */
type OutputFormat = 'json' | 'markdown';

/**
 * Escape a value for safe inclusion in a markdown table cell
 */
function escapeMarkdownCell(val: unknown): string {
    if (val === null) return '_null_';
    if (val === undefined) return '_undefined_';
    if (val === '') return '_empty_';

    // Handle objects/arrays (e.g., JSONB columns) - stringify them
    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);

    // Escape pipes and normalize whitespace (newlines, carriage returns, tabs)
    return strVal.replace(/\|/g, '\\|').replace(/[\r\n\t]+/g, ' ');
}

/**
 * Format query results as a markdown table
 */
function formatAsMarkdown(rows: unknown[]): string {
    if (!Array.isArray(rows) || rows.length === 0) {
        return '_No rows returned_';
    }

    const firstRow = rows[0] as Record<string, unknown>;
    const columns = Object.keys(firstRow);

    if (columns.length === 0) {
        return '_No columns_';
    }

    // Header row - escape column names too (they come from the database)
    const escapedColumns = columns.map((col) => col.replace(/\|/g, '\\|'));
    const header = '| ' + escapedColumns.join(' | ') + ' |';
    const separator = '| ' + columns.map(() => '---').join(' | ') + ' |';

    // Data rows
    const dataRows = rows.map((row) => {
        const r = row as Record<string, unknown>;
        const values = columns.map((col) => escapeMarkdownCell(r[col]));
        return '| ' + values.join(' | ') + ' |';
    });

    return [header, separator, ...dataRows].join('\n');
}

/**
 * Format output based on format option
 */
function formatOutput(data: unknown, format: OutputFormat): string {
    if (format === 'markdown') {
        // If data has a 'rows' property, format those as a table
        if (typeof data === 'object' && data !== null && 'rows' in data) {
            const d = data as { rows: unknown[]; rowCount?: number };
            const table = formatAsMarkdown(d.rows);
            return d.rowCount !== undefined ? `${d.rowCount} rows\n\n${table}` : table;
        }
        // If it's an array, format as table directly
        if (Array.isArray(data)) {
            return formatAsMarkdown(data);
        }
        // Otherwise fall back to JSON
        return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data, null, 2);
}

/**
 * Prompt for password input (hidden)
 */
async function promptPassword(message: string): Promise<string> {
    const result = await p.password({ message });
    if (p.isCancel(result)) {
        process.exit(0);
    }
    return result;
}

/**
 * Logs a query and its result to a connection-specific log file
 */
function logQuery(connectionName: string, query: string, result: QueryResult): void {
    ensureLogsDir();
    const logFile = path.join(getLogsDir(), `${connectionName}.md`);
    const timestamp = new Date().toISOString();

    // Truncate large result sets for logging
    let logResult = result;
    if (result && Array.isArray(result.rows) && result.rows.length > MAX_LOG_ROWS) {
        const omittedCount = result.rows.length - MAX_LOG_ROWS;
        logResult = {
            ...result,
            rows: [
                ...result.rows.slice(0, MAX_LOG_ROWS),
                `... ${omittedCount.toLocaleString()} ${omittedCount === 1 ? 'result' : 'results'} omitted ...`,
            ],
        };
    }

    const logEntry = `${timestamp}

\`\`\`sql
${query}
\`\`\`

\`\`\`json
${JSON.stringify(logResult, null, 2)}
\`\`\`

---

`;

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
 * Errors are propagated to the caller - handle them at the CLI layer
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
        .version(pkg.version);

    // Global options
    program
        .option('-c, --connection <name>', 'database connection name from config (required for DB commands)')
        .option('--config <path>', 'path to config file')
        .option('--no-log', 'disable query logging')
        .option('-f, --format <format>', 'output format: json or markdown', DEFAULT_OUTPUT_FORMAT)
        .hook('preAction', (thisCommand) => {
            const format = thisCommand.opts().format;
            if (format && !['json', 'markdown'].includes(format)) {
                console.error(`Error: Invalid format "${format}". Must be 'json' or 'markdown'.`);
                process.exit(1);
            }
        });

    // Tables command
    program
        .command('tables')
        .description('List all tables in the database')
        .action(async () => {
            const opts = program.opts();
            if (!opts.connection) {
                console.error('Error: --connection (-c) is required. Specify which database to use.');
                process.exit(1);
            }
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
            if (!opts.connection) {
                console.error('Error: --connection (-c) is required. Specify which database to use.');
                process.exit(1);
            }
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
            if (!opts.connection) {
                console.error('Error: --connection (-c) is required. Specify which database to use.');
                process.exit(1);
            }
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await describeTable(sql, dbType, tableName);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Sample command
    program
        .command('sample <table>')
        .description('Get random sample rows from a table')
        .option('-n, --limit <number>', 'number of rows to sample', String(DEFAULT_SAMPLE_LIMIT))
        .action(async (tableName: string, cmdOpts: { limit: string }) => {
            const opts = program.opts();
            if (!opts.connection) {
                console.error('Error: --connection (-c) is required. Specify which database to use.');
                process.exit(1);
            }
            const limit = parseInt(cmdOpts.limit, 10);
            if (isNaN(limit) || limit < 1 || limit > MAX_SAMPLE_LIMIT) {
                console.error(`Error: --limit must be between 1 and ${MAX_SAMPLE_LIMIT}`);
                process.exit(1);
            }
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await sampleTable(sql, dbType, tableName, limit);

                // Log the sample if enabled (consistent with query command)
                const connConfig = getConnectionConfig(opts.connection, opts.config);
                const loggingEnabled = connConfig.logging === true && opts.log !== false;
                if (loggingEnabled) {
                    const syntheticQuery = `-- sherlock sample ${tableName} --limit ${limit}`;
                    logQuery(opts.connection, syntheticQuery, { rowCount: result.rowCount, rows: result.rows });
                }

                const format = opts.format as OutputFormat;
                console.log(formatOutput(result, format));
            });
        });

    // Indexes command
    program
        .command('indexes <table>')
        .description('Show indexes for a table')
        .action(async (tableName: string) => {
            const opts = program.opts();
            if (!opts.connection) {
                console.error('Error: --connection (-c) is required. Specify which database to use.');
                process.exit(1);
            }
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await getIndexes(sql, dbType, tableName);
                const format = opts.format as OutputFormat;
                // For indexes, format the indexes array as table if markdown
                if (format === 'markdown') {
                    console.log(`## Indexes for \`${tableName}\`\n\n${result.indexCount} indexes\n\n${formatAsMarkdown(result.indexes)}`);
                } else {
                    console.log(JSON.stringify(result, null, 2));
                }
            });
        });

    // Query command
    program
        .command('query <sql>')
        .description('Execute a read-only SQL query')
        .action(async (sqlQuery: string) => {
            const opts = program.opts();

            if (!opts.connection) {
                console.error('Error: --connection (-c) is required. Specify which database to use.');
                process.exit(1);
            }

            // Enforce read-only with comprehensive validation
            const validation = validateReadOnlyQuery(sqlQuery);
            if (!validation.valid) {
                console.error(JSON.stringify({ error: validation.error }));
                process.exit(1);
            }

            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await executeQuery(sql, dbType, sqlQuery);

                // Log the query and result if enabled in connection config
                // Logging is disabled by default for security (prod data protection)
                // --no-log CLI flag can override to force logging off
                const connConfig = getConnectionConfig(opts.connection, opts.config);
                const loggingEnabled = connConfig.logging === true && opts.log !== false;
                if (loggingEnabled) {
                    logQuery(opts.connection, sqlQuery, result);
                }

                const format = opts.format as OutputFormat;
                console.log(formatOutput(result, format));
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
            } catch (error: unknown) {
                console.error(JSON.stringify({ error: getErrorMessage(error) }));
                process.exit(1);
            }
        });

    // Setup command (interactive wizard)
    program
        .command('setup')
        .description('Interactive setup wizard')
        .action(async () => {
            await runSetupWizard();
        });

    // Manage command (interactive connection manager)
    program
        .command('manage')
        .description('Interactive connection manager')
        .action(async () => {
            await connectionManagerMenu();
        });

    // Add connection (interactive)
    program
        .command('add')
        .description('Add a new connection (interactive)')
        .action(async () => {
            await addConnectionWizard();
        });

    // Edit connection (interactive)
    program
        .command('edit')
        .description('Edit an existing connection (interactive)')
        .action(async () => {
            await editConnectionWizard();
        });

    // Init command (non-interactive, creates template)
    program
        .command('init')
        .description('Create config template (non-interactive)')
        .action(async () => {
            await initConfig();
        });

    // Test connection command
    program
        .command('test <connectionName>')
        .description('Test a database connection')
        .action(async (connectionName: string) => {
            const opts = program.opts();

            console.log(`Testing connection: ${connectionName}...`);

            try {
                const config = await resolveConnection(connectionName, opts.config);
                const sql = createConnection(config);

                // Simple query to test connection
                await sql.unsafe(TEST_QUERIES[config.type]);
                sql.close();

                console.log(`\x1b[32m✓ Connection "${connectionName}" successful!\x1b[0m`);
                console.log(`  Type: ${config.type}`);
            } catch (error: unknown) {
                console.error(`\x1b[31m✗ Connection "${connectionName}" failed\x1b[0m`);
                console.error(`  Error: ${getErrorMessage(error)}`);
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

    // Keychain command group
    const keychain = program
        .command('keychain')
        .description('Manage credentials in OS keychain');

    keychain
        .command('set <account>')
        .description('Store a password in the keychain')
        .action(async (account: string) => {
            // SECURITY: Always prompt for password - never accept via CLI args
            // This prevents passwords from appearing in shell history
            const password = await promptPassword(`Enter password for "${account}": `);

            if (!password) {
                console.error('No password provided');
                process.exit(1);
            }

            setKeychainPassword(account, password);
            console.log(`\x1b[32m✓\x1b[0m Password stored for account "${account}"`);
            console.log(`\nUse in config.json:`);
            console.log(`  "password": { "$keychain": "${account}" }`);
        });

    keychain
        .command('get <account>')
        .description('Retrieve a password from the keychain (for testing)')
        .action((account: string) => {
            const password = getKeychainPassword(account);
            if (password === null) {
                console.error(`No password found for account "${account}"`);
                process.exit(1);
            }
            console.log(`Password for "${account}": ${password}`);
        });

    keychain
        .command('delete <account>')
        .description('Delete a password from the keychain')
        .action((account: string) => {
            if (!hasKeychainPassword(account)) {
                console.error(`No password found for account "${account}"`);
                process.exit(1);
            }
            deleteKeychainPassword(account);
            console.log(`\x1b[32m✓\x1b[0m Password deleted for account "${account}"`);
        });

    keychain
        .command('list')
        .description('Check which connection passwords are in keychain')
        .action(() => {
            const opts = program.opts();
            try {
                const connections = listConnections(opts.config);
                console.log('Keychain status for connections:\n');

                for (const conn of connections) {
                    const hasPassword = hasKeychainPassword(conn);
                    const status = hasPassword ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
                    console.log(`  ${status} ${conn}`);
                }
            } catch (error: unknown) {
                console.error(`Error: ${getErrorMessage(error)}`);
                process.exit(1);
            }
        });

    return program;
}

async function getTables(sql: ReturnType<typeof SQL>, dbType: DbType): Promise<string[]> {
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

interface TableDescription {
    table: string;
    columns: unknown[];
}

async function describeTable(
    sql: ReturnType<typeof SQL>,
    dbType: DbType,
    tableName: string
): Promise<TableDescription> {
    // SECURITY: Validate identifier format to prevent SQL injection via malicious table names
    validateIdentifier(tableName, 'table');

    // SECURITY: Validate table name against actual tables
    const validTables = await getTables(sql, dbType);
    if (!validTables.includes(tableName)) {
        throw new Error(`Table "${tableName}" not found. Use 'sherlock tables' to list available tables.`);
    }

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
        query = `PRAGMA table_info(\`${tableName}\`)`;
    } else {
        // MySQL
        query = `DESCRIBE \`${tableName}\``;
    }

    const result = await sql.unsafe(query);
    return { table: tableName, columns: result };
}

/** Result from sampling a table */
interface SampleResult {
    table: string;
    rowCount: number;
    rows: unknown[];
}

async function sampleTable(
    sql: ReturnType<typeof SQL>,
    dbType: DbType,
    tableName: string,
    limit: number
): Promise<SampleResult> {
    // SECURITY: Validate identifier format to prevent SQL injection via malicious table names
    validateIdentifier(tableName, 'table');

    // SECURITY: Validate table name against actual tables
    const validTables = await getTables(sql, dbType);
    if (!validTables.includes(tableName)) {
        throw new Error(`Table "${tableName}" not found. Use 'sherlock tables' to list available tables.`);
    }

    let query: string;
    const quotedTable = dbType === DB_TYPES.POSTGRES ? `"${tableName}"` : `\`${tableName}\``;

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

/** Result from getting indexes for a table */
interface IndexesResult {
    table: string;
    indexCount: number;
    indexes: unknown[];  // Shape varies by DB type: pg_indexes rows, SHOW INDEX rows, or PRAGMA results
}

async function getIndexes(
    sql: ReturnType<typeof SQL>,
    dbType: DbType,
    tableName: string
): Promise<IndexesResult> {
    // SECURITY: Validate identifier format to prevent SQL injection via malicious table names
    validateIdentifier(tableName, 'table');

    // SECURITY: Validate table name against actual tables
    const validTables = await getTables(sql, dbType);
    if (!validTables.includes(tableName)) {
        throw new Error(`Table "${tableName}" not found. Use 'sherlock tables' to list available tables.`);
    }

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
        query = `PRAGMA index_list(\`${tableName}\`)`;
    } else {
        // MySQL
        query = `SHOW INDEX FROM \`${tableName}\``;
    }

    const result = await sql.unsafe(query);
    return {
        table: tableName,
        indexCount: Array.isArray(result) ? result.length : 0,
        indexes: result,
    };
}

async function introspectSchema(sql: ReturnType<typeof SQL>, dbType: DbType): Promise<SchemaInfo> {
    const tables = await getTables(sql, dbType);
    const schema: SchemaInfo = {};

    for (const table of tables) {
        const tableInfo = await describeTable(sql, dbType, table);
        schema[table] = tableInfo;
    }

    return schema;
}

async function executeQuery(
    sql: ReturnType<typeof SQL>,
    _dbType: DbType,
    query: string
): Promise<QueryResult> {
    try {
        const result = await sql.unsafe(query);

        return {
            rowCount: Array.isArray(result) ? result.length : 0,
            rows: result,
        };
    } catch (error: unknown) {
        return {
            error: getErrorMessage(error),
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
            'myapp-prod': {
                type: DB_TYPES.POSTGRES,
                host: 'localhost',
                port: 5432,
                database: 'myapp',
                username: { $env: 'SHERLOCK_MYAPP_PROD_USERNAME' },
                password: { $env: 'SHERLOCK_MYAPP_PROD_PASSWORD' },
            },
            'myapp-staging': {
                type: DB_TYPES.POSTGRES,
                host: 'localhost',
                port: 5432,
                database: 'myapp_staging',
                username: { $env: 'SHERLOCK_MYAPP_STAGING_USERNAME' },
                password: { $env: 'SHERLOCK_MYAPP_STAGING_PASSWORD' },
            },
        },
    };

    fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2), 'utf-8');
    setSecurePermissions(configPath);

    // Create example .env
    const exampleEnv = `# Sherlock Database Credentials
# Set your database credentials here

# Production database
SHERLOCK_MYAPP_PROD_USERNAME=your_username
SHERLOCK_MYAPP_PROD_PASSWORD=your_password

# Staging database
SHERLOCK_MYAPP_STAGING_USERNAME=your_username
SHERLOCK_MYAPP_STAGING_PASSWORD=your_password
`;

    fs.writeFileSync(envPath, exampleEnv, 'utf-8');
    setSecurePermissions(envPath);

    console.log(`Sherlock initialized!

Config created at: ${configPath}
Env file created at: ${envPath}

Next steps:
1. Edit ${configPath} to add your database connections
2. Set your credentials in ${envPath} or use 'sherlock keychain set <name>'
3. Run 'sherlock connections' to list configured connections
4. Run 'sherlock test <connection>' to verify a connection
5. Run 'sherlock -c <connection> tables' to list tables
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

    // Legacy TypeORM config format
    interface LegacyConnectionOpts {
        type: string;
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        database?: string;
    }

    // Convert to new format
    const newConnections: Record<string, ConnectionConfig> = {};
    const envVars: string[] = [];

    for (const [name, opts] of Object.entries(legacyConfig.connections as Record<string, LegacyConnectionOpts>)) {
        const envPrefix = `SHERLOCK_${name.toUpperCase().replace(/-/g, '_')}`;

        const newConn: ConnectionConfig = {
            type: opts.type === 'better-sqlite3' ? DB_TYPES.SQLITE : opts.type as DbType,
        };

        if (opts.type === 'better-sqlite3' || opts.type === DB_TYPES.SQLITE) {
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
    setSecurePermissions(configPath);
    console.log(`\x1b[32m✓\x1b[0m Created: ${configPath}`);

    // Write .env file
    const envContent = `# Sherlock Database Credentials
# Generated by 'sherlock migrate' from ${fromPath}
# IMPORTANT: Review and update these credentials!

${envVars.join('\n')}
`;

    fs.writeFileSync(envPath, envContent, 'utf-8');
    setSecurePermissions(envPath);
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

// Set up and parse CLI with top-level error handling
const program = setupCLI();
program.parseAsync(process.argv).catch((error: Error) => {
    console.error(JSON.stringify({
        error: error.message,
        ...(process.env.DEBUG && { stack: error.stack }),
    }));
    process.exit(1);
});
