#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Sherlock CLI - Database query tool with read-only access
 *
 * This is the main CLI entry point. Database operations, formatting,
 * caching, and logging are handled by separate modules.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as p from '@clack/prompts';

// Config
import { listConnections, getConnectionConfig } from './config';
import { getConfigDir, ensureConfigDir } from './config/paths';
import type { ConnectionConfig } from './config/types';
import { DB_TYPES, TEST_QUERIES, type DbType } from './db-types';

// Credentials
import {
    setKeychainPassword,
    getKeychainPassword,
    deleteKeychainPassword,
    hasKeychainPassword,
} from './credentials/providers/keychain';

// TUI
import {
    runSetupWizard,
    addConnectionWizard,
    editConnectionWizard,
    connectionManagerMenu,
} from './tui';

// Query validation
import { validateReadOnlyQuery } from './query-validation';

// Database
import { withConnection } from './db/connection';
import {
    getTables,
    describeTable,
    sampleTable,
    getIndexes,
    getForeignKeys,
    getTableStats,
    introspectSchema,
    executeQuery,
} from './db/operations';

// Output formatting
import {
    formatOutput,
    formatAsMarkdown,
    type OutputFormat,
    DEFAULT_OUTPUT_FORMAT,
} from './output/formatters';

// Caching
import {
    readSchemaCache,
    writeSchemaCache,
    getCacheAge,
    type SchemaInfo,
} from './cache/schema';

// Logging
import { logQuery } from './logging/query-log';

// Package info
import pkg from '../package.json';

// ============================================================================
// Constants
// ============================================================================

/** Default number of rows to sample */
const DEFAULT_SAMPLE_LIMIT = 5;

/** Maximum rows allowed for sample command (prevents DoS via ORDER BY RANDOM) */
const MAX_SAMPLE_LIMIT = 1000;

/** File permissions for sensitive config files (owner read/write only) */
const SECURE_FILE_MODE = 0o600;

// ============================================================================
// Helpers
// ============================================================================

/** Set secure permissions on a file (no-op on Windows) */
function setSecurePermissions(filePath: string): void {
    if (process.platform !== 'win32') {
        fs.chmodSync(filePath, SECURE_FILE_MODE);
    }
}

/** Get error message from unknown error */
function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/** Prompt for password input (hidden) */
async function promptPassword(message: string): Promise<string> {
    const result = await p.password({ message });
    if (p.isCancel(result)) {
        process.exit(0);
    }
    return result;
}

/** Require connection option or exit */
function requireConnection(opts: { connection?: string }): asserts opts is { connection: string } {
    if (!opts.connection) {
        console.error('Error: --connection (-c) is required. Specify which database to use.');
        process.exit(1);
    }
}

// ============================================================================
// CLI Setup
// ============================================================================

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

    // ========================================================================
    // Database Commands
    // ========================================================================

    // Tables command
    program
        .command('tables')
        .description('List all tables in the database')
        .action(async () => {
            const opts = program.opts();
            requireConnection(opts);
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const tables = await getTables(sql, dbType as DbType);
                console.log(JSON.stringify({ tables }, null, 2));
            });
        });

    // Introspect command (with caching)
    program
        .command('introspect')
        .description('Get schema information for all tables (cached)')
        .option('--refresh', 'force refresh the cached schema')
        .action(async (cmdOpts: { refresh?: boolean }) => {
            const opts = program.opts();
            requireConnection(opts);

            // Check cache first (unless --refresh)
            if (!cmdOpts.refresh) {
                const cached = readSchemaCache(opts.connection);
                if (cached) {
                    const age = getCacheAge(cached.cachedAt);
                    const cachedDate = new Date(cached.cachedAt);
                    const hoursSinceCached = (Date.now() - cachedDate.getTime()) / (1000 * 60 * 60);
                    const isStale = hoursSinceCached > 24;

                    const output = {
                        ...cached.schema,
                        _cache: {
                            cachedAt: cached.cachedAt,
                            age,
                            stale: isStale,
                            hint: isStale
                                ? 'WARNING: Cache is >24h old. Use --refresh to update.'
                                : 'Use --refresh to update cached schema',
                        },
                    };
                    console.log(JSON.stringify(output, null, 2));
                    return;
                }
            }

            // Fetch fresh schema
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await introspectSchema(sql, dbType as DbType);

                // Cache the result
                writeSchemaCache(opts.connection, result as SchemaInfo);

                const output = {
                    ...result,
                    _cache: {
                        cachedAt: new Date().toISOString(),
                        hint: 'Schema cached. Use --refresh to update.',
                    },
                };
                console.log(JSON.stringify(output, null, 2));
            });
        });

    // Describe command
    program
        .command('describe <table>')
        .description('Describe a specific table schema')
        .action(async (tableName: string) => {
            const opts = program.opts();
            requireConnection(opts);
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await describeTable(sql, dbType as DbType, tableName);
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
            requireConnection(opts);

            const limit = parseInt(cmdOpts.limit, 10);
            if (isNaN(limit) || limit < 1 || limit > MAX_SAMPLE_LIMIT) {
                console.error(`Error: --limit must be between 1 and ${MAX_SAMPLE_LIMIT}`);
                process.exit(1);
            }

            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await sampleTable(sql, dbType as DbType, tableName, limit);

                // Log if enabled
                const connConfig = getConnectionConfig(opts.connection, opts.config);
                const loggingEnabled = connConfig.logging === true && opts.log !== false;
                if (loggingEnabled) {
                    logQuery(opts.connection, `-- sherlock sample ${tableName} --limit ${limit}`, {
                        rowCount: result.rowCount,
                        rows: result.rows,
                    });
                }

                const format = opts.format as OutputFormat;
                console.log(formatOutput(result, format));
            });
        });

    // Stats command
    program
        .command('stats <table>')
        .description('Get data profiling stats for a table (row count, nulls, distinct values)')
        .action(async (tableName: string) => {
            const opts = program.opts();
            requireConnection(opts);
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await getTableStats(sql, dbType as DbType, tableName);
                const format = opts.format as OutputFormat;
                if (format === 'markdown') {
                    console.log(`## Stats for \`${tableName}\`\n\n**Row count:** ${result.rowCount.toLocaleString()}\n\n### Column Stats\n\n${formatAsMarkdown(result.columns)}`);
                } else {
                    console.log(JSON.stringify(result, null, 2));
                }
            });
        });

    // FK command
    program
        .command('fk <table>')
        .description('Show foreign key relationships for a table')
        .action(async (tableName: string) => {
            const opts = program.opts();
            requireConnection(opts);
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await getForeignKeys(sql, dbType as DbType, tableName);
                const format = opts.format as OutputFormat;
                if (format === 'markdown') {
                    let output = `## Foreign Keys for \`${tableName}\`\n\n`;
                    output += `### References (outgoing)\n\n`;
                    output += result.references.length > 0
                        ? formatAsMarkdown(result.references)
                        : '_No outgoing foreign keys_';
                    output += `\n\n### Referenced By (incoming)\n\n`;
                    output += result.referencedBy.length > 0
                        ? formatAsMarkdown(result.referencedBy)
                        : '_No incoming foreign keys_';
                    console.log(output);
                } else {
                    console.log(JSON.stringify(result, null, 2));
                }
            });
        });

    // Indexes command
    program
        .command('indexes <table>')
        .description('Show indexes for a table')
        .action(async (tableName: string) => {
            const opts = program.opts();
            requireConnection(opts);
            await withConnection(opts.connection, opts.config, async (sql, dbType) => {
                const result = await getIndexes(sql, dbType as DbType, tableName);
                const format = opts.format as OutputFormat;
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
            requireConnection(opts);

            // Enforce read-only
            const validation = validateReadOnlyQuery(sqlQuery);
            if (!validation.valid) {
                console.error(JSON.stringify({ error: validation.error }));
                process.exit(1);
            }

            await withConnection(opts.connection, opts.config, async (sql) => {
                const result = await executeQuery(sql, sqlQuery);

                // Log if enabled
                const connConfig = getConnectionConfig(opts.connection, opts.config);
                const loggingEnabled = connConfig.logging === true && opts.log !== false;
                if (loggingEnabled) {
                    logQuery(opts.connection, sqlQuery, result);
                }

                const format = opts.format as OutputFormat;
                console.log(formatOutput(result, format));
            });
        });

    // ========================================================================
    // Connection Management Commands
    // ========================================================================

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

    // Test connection command
    program
        .command('test <connectionName>')
        .description('Test a database connection')
        .action(async (connectionName: string) => {
            const opts = program.opts();

            console.log(`Testing connection: ${connectionName}...`);

            try {
                await withConnection(connectionName, opts.config, async (sql, dbType) => {
                    await sql.unsafe(TEST_QUERIES[dbType as DbType]);
                });
                console.log(`\x1b[32m✓ Connection "${connectionName}" successful!\x1b[0m`);
            } catch (error: unknown) {
                console.error(`\x1b[31m✗ Connection "${connectionName}" failed\x1b[0m`);
                console.error(`  Error: ${getErrorMessage(error)}`);
                process.exit(1);
            }
        });

    // ========================================================================
    // Config Commands
    // ========================================================================

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

    // Migrate command
    program
        .command('migrate')
        .description('Migrate legacy config.ts to new JSON format')
        .option('--from <path>', 'path to legacy config.ts', 'config.ts')
        .action(async (cmdOpts) => {
            await migrateConfig(cmdOpts.from);
        });

    // ========================================================================
    // Keychain Commands
    // ========================================================================

    const keychain = program
        .command('keychain')
        .description('Manage credentials in OS keychain');

    keychain
        .command('set <account>')
        .description('Store a password in the keychain')
        .action(async (account: string) => {
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

// ============================================================================
// Config Initialization & Migration
// ============================================================================

async function initConfig(): Promise<void> {
    ensureConfigDir();
    const configDir = getConfigDir();
    const configPath = path.join(configDir, 'config.json');
    const envPath = path.join(configDir, '.env');

    if (fs.existsSync(configPath)) {
        console.log(`Config already exists at: ${configPath}`);
        return;
    }

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

async function migrateConfig(fromPath: string): Promise<void> {
    const absoluteFromPath = path.resolve(fromPath);

    if (!fs.existsSync(absoluteFromPath)) {
        console.error(`Legacy config not found: ${absoluteFromPath}`);
        process.exit(1);
    }

    console.log(`Migrating from: ${absoluteFromPath}`);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const legacyConfig = require(absoluteFromPath);

    if (!legacyConfig.connections) {
        console.error('Invalid legacy config: missing "connections" export');
        process.exit(1);
    }

    interface LegacyConnectionOpts {
        type: string;
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        database?: string;
    }

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
            envVars.push(`${envPrefix}_USERNAME=${opts.username || ''}`);
            envVars.push(`${envPrefix}_PASSWORD=${opts.password || ''}`);
        }

        newConnections[name] = newConn;
    }

    const newConfig = {
        version: '2.0',
        connections: newConnections,
    };

    ensureConfigDir();
    const configDir = getConfigDir();
    const configPath = path.join(configDir, 'config.json');
    const envPath = path.join(configDir, '.env');

    if (fs.existsSync(configPath)) {
        console.log(`\x1b[33mWarning: ${configPath} already exists\x1b[0m`);
        const backupPath = configPath + '.backup.' + Date.now();
        fs.copyFileSync(configPath, backupPath);
        console.log(`  Backed up to: ${backupPath}`);
    }

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    setSecurePermissions(configPath);
    console.log(`\x1b[32m✓\x1b[0m Created: ${configPath}`);

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

// ============================================================================
// Main
// ============================================================================

const program = setupCLI();
program.parseAsync(process.argv).catch((error: Error) => {
    console.error(JSON.stringify({
        error: error.message,
        ...(process.env.DEBUG && { stack: error.stack }),
    }));
    process.exit(1);
});
