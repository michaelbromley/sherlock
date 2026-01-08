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

/** Maximum rows to include in query logs (truncate larger results) */
const MAX_LOG_ROWS = 10;

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
        .version('2.0.0');

    // Global options
    program
        .option('-c, --connection <name>', 'database connection name from config (required for DB commands)')
        .option('--config <path>', 'path to config file')
        .option('--no-log', 'disable query logging');

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
    // SECURITY: Validate table name against actual tables to prevent SQL injection
    const validTables = await getTables(sql, dbType);
    if (!validTables.includes(tableName)) {
        throw new Error(`Table "${tableName}" not found. Use 'sherlock tables' to list available tables.`);
    }

    let query: string;

    if (dbType === DB_TYPES.POSTGRES) {
        // Table name is now validated - safe to interpolate
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
