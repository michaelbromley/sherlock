#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Sherlock CLI - Database query tool with read-only access
 *
 * This is the main CLI entry point. Database operations, formatting,
 * caching, and logging are handled by separate modules.
 */

import { Command } from 'commander';
import * as p from '@clack/prompts';

// Config
import { listConnections, getConnectionConfig, detectConnectionFromCwd } from './config';
import { DB_TYPES, TEST_QUERIES, isRedisConfig, type DbType } from './db-types';

// Credentials
import {
    setKeychainPassword,
    getKeychainPassword,
    deleteKeychainPassword,
    hasKeychainPassword,
} from './credentials/providers/keychain';

// TUI
import { connectionManagerMenu } from './tui';

// Config init/migration
import { initConfig, migrateConfig } from './config/init';

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

// Redis
import { withRedisConnection } from './redis/connection';
import {
    getServerInfo,
    scanKeys,
    getKeyValue,
    inspectKey,
    getSlowlog,
    executeCommand,
} from './redis/operations';

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

// ============================================================================
// Helpers
// ============================================================================

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

/** Require connection option or exit. Auto-detects from cwd if not provided. */
function requireConnection(opts: { connection?: string; config?: string }): asserts opts is { connection: string } {
    if (!opts.connection) {
        const detected = detectConnectionFromCwd(opts.config);
        if (detected) {
            opts.connection = detected;
            console.error(`Using connection "${detected}" (matched directory ${process.cwd()})`);
            return;
        }
        console.error('Error: --connection (-c) is required. Specify which database to use.');
        process.exit(1);
    }
}

/** Check that the active connection is a Redis connection */
function requireRedisConnection(opts: { connection: string; config?: string }): void {
    const config = getConnectionConfig(opts.connection, opts.config);
    if (!isRedisConfig(config)) {
        const type = config.type || 'SQL';
        console.error(`Error: "${opts.connection}" is a ${type} connection. This command only works with Redis connections.`);
        process.exit(1);
    }
}

/** Check that the active connection is a SQL connection */
function requireSqlConnection(opts: { connection: string; config?: string }): void {
    const config = getConnectionConfig(opts.connection, opts.config);
    if (isRedisConfig(config)) {
        console.error(`Error: "${opts.connection}" is a Redis connection. Use Redis commands (info, keys, get, inspect, slowlog, command) instead.`);
        process.exit(1);
    }
}

/** Parse a CLI option as a positive integer, exit with error if invalid */
function parsePositiveInt(value: string, name: string, max?: number): number {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || (max !== undefined && n > max)) {
        console.error(`Error: --${name} must be a positive number${max ? ` (max ${max})` : ''}`);
        process.exit(1);
    }
    return n;
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
            requireSqlConnection(opts);
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

            requireSqlConnection(opts);

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
            requireSqlConnection(opts);
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
            requireSqlConnection(opts);

            const limit = parsePositiveInt(cmdOpts.limit, 'limit', MAX_SAMPLE_LIMIT);

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
            requireSqlConnection(opts);
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
            requireSqlConnection(opts);
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
            requireSqlConnection(opts);
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
            // Fix shell escaping artifacts: some shells/tools escape ! to \!
            // which is never valid SQL, so safely strip it
            sqlQuery = sqlQuery.replace(/\\!/g, '!');

            const opts = program.opts();
            requireConnection(opts);
            requireSqlConnection(opts);

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
    // Redis Commands
    // ========================================================================

    // Info command
    program
        .command('info')
        .description('Redis server info, memory stats, and keyspace overview')
        .option('--section <name>', 'get a specific INFO section (e.g., memory, server, clients)')
        .action(async (cmdOpts: { section?: string }) => {
            const opts = program.opts();
            requireConnection(opts);
            requireRedisConnection(opts);
            await withRedisConnection(opts.connection, opts.config, async (client) => {
                const result = await getServerInfo(client, cmdOpts.section);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Keys command
    program
        .command('keys [pattern]')
        .description('Scan for keys matching a glob pattern (default: *)')
        .option('--limit <n>', 'maximum number of keys to return', '100')
        .option('--no-types', 'skip TYPE/TTL lookups for faster scanning')
        .action(async (pattern: string | undefined, cmdOpts: { limit: string; types: boolean }) => {
            const opts = program.opts();
            requireConnection(opts);
            requireRedisConnection(opts);

            const limit = parsePositiveInt(cmdOpts.limit, 'limit');

            await withRedisConnection(opts.connection, opts.config, async (client) => {
                const result = await scanKeys(client, pattern || '*', limit, cmdOpts.types);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Get command (Redis)
    program
        .command('get <key>')
        .description('Get value of a Redis key (auto-detects type)')
        .option('--limit <n>', 'max items for lists/sets/zsets', '100')
        .action(async (key: string, cmdOpts: { limit: string }) => {
            const opts = program.opts();
            requireConnection(opts);
            requireRedisConnection(opts);

            const limit = parsePositiveInt(cmdOpts.limit, 'limit');

            await withRedisConnection(opts.connection, opts.config, async (client) => {
                const result = await getKeyValue(client, key, limit);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Inspect command
    program
        .command('inspect <key>')
        .description('Inspect Redis key metadata (type, TTL, memory usage, encoding)')
        .action(async (key: string) => {
            const opts = program.opts();
            requireConnection(opts);
            requireRedisConnection(opts);
            await withRedisConnection(opts.connection, opts.config, async (client) => {
                const result = await inspectKey(client, key);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Slowlog command
    program
        .command('slowlog')
        .description('Show recent slow queries from the Redis slow log')
        .option('-n, --count <n>', 'number of entries to show', '10')
        .action(async (cmdOpts: { count: string }) => {
            const opts = program.opts();
            requireConnection(opts);
            requireRedisConnection(opts);

            const count = parsePositiveInt(cmdOpts.count, 'count');

            await withRedisConnection(opts.connection, opts.config, async (client) => {
                const result = await getSlowlog(client, count);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Command command (generic read-only Redis command)
    program
        .command('command <cmd> [args...]')
        .description('Execute a read-only Redis command')
        .action(async (cmd: string, args: string[]) => {
            const opts = program.opts();
            requireConnection(opts);
            requireRedisConnection(opts);
            await withRedisConnection(opts.connection, opts.config, async (client) => {
                const result = await executeCommand(client, cmd, args);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // ========================================================================
    // Connection Management Commands
    // ========================================================================

    // Connections list command (hidden — use `manage` instead)
    program
        .command('connections', { hidden: true })
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

    // Test connection command (hidden — use `manage` instead)
    program
        .command('test <connectionName>', { hidden: true })
        .description('Test a database connection')
        .action(async (connectionName: string) => {
            const opts = program.opts();

            console.log(`Testing connection: ${connectionName}...`);

            try {
                const connConfig = getConnectionConfig(connectionName, opts.config);
                if (isRedisConfig(connConfig)) {
                    await withRedisConnection(connectionName, opts.config, async (client) => {
                        await client.send('PING', []);
                    });
                } else {
                    await withConnection(connectionName, opts.config, async (sql, dbType) => {
                        await sql.unsafe(TEST_QUERIES[dbType as DbType]);
                    });
                }
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

    // Manage command — single interactive hub for all connection/config management
    program
        .command('manage')
        .description('Manage connections, credentials, and config')
        .action(async () => {
            await connectionManagerMenu();
        });

    // Init command (hidden — available via `manage` menu)
    program
        .command('init', { hidden: true })
        .description('Create config template (non-interactive)')
        .action(async () => {
            await initConfig();
        });

    // Migrate command (hidden — available via `manage` menu)
    program
        .command('migrate', { hidden: true })
        .description('Migrate legacy config.ts to new JSON format')
        .option('--from <path>', 'path to legacy config.ts', 'config.ts')
        .action(async (cmdOpts) => {
            await migrateConfig(cmdOpts.from);
        });

    // ========================================================================
    // Update Command
    // ========================================================================

    program
        .command('update')
        .description('Check for updates and self-update the sherlock binary')
        .action(async () => {
            const { runUpdate } = await import('./update');
            await runUpdate();
        });

    // ========================================================================
    // Keychain Commands
    // ========================================================================

    const keychain = program
        .command('keychain', { hidden: true })
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
