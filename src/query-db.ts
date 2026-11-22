#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Sherlock CLI - Database query tool with read-only access
 *
 * This is the main CLI entry point. Database operations, formatting,
 * caching, and logging are handled by separate modules.
 */

import { Command, CommanderError } from 'commander';
import * as p from '@clack/prompts';

// Config
import { listConnections, listConnectionSummaries, getConnectionConfig, detectConnectionFromCwd } from './config';
import { DB_TYPES, isRedisConfig, detectDbTypeFromUrl, type DbType } from './db-types';
import type { ResolvedConnectionConfig } from './config/types';
import type { ConnectionAddOptions } from './config/connection-input';

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
import { validateReadOnlyQuery, queryRefusedError } from './query-validation';

// Errors and the response envelope
import { SherlockError, usageError, errorMessage } from './errors';
import { Invocation, printEnvelope } from './output/envelope';

// Database
import { withConnection, withConnectionFromConfig, type ConnectionOptions, type SqlAdapter } from './db/connection';
import { parseDuration } from './tunnel/config';
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
import { withRedisConnection, withRedisConnectionFromConfig } from './redis/connection';
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

/**
 * Print every configured connection as JSON: the names, as before, and what
 * each one points at.
 */
function listConnectionsAction(configPath?: string): void {
    console.log(JSON.stringify({
        connections: listConnections(configPath),
        details: listConnectionSummaries(configPath),
    }, null, 2));
}

/**
 * Things worth knowing about a connection just added, printed to stderr so
 * the JSON on stdout stays clean.
 */
function connectionAddNotes(config: import('./config/types').ConnectionConfig): string[] {
    const notes: string[] = [];
    const isSqlite = config.type === DB_TYPES.SQLITE;
    if (!isSqlite && config.password === undefined && config.url === undefined) {
        notes.push('No password is stored for this connection. Add --password-stdin or --password-env if the database needs one.');
    }
    if (config.tunnel && typeof config.ssl === 'object' && config.ssl.rejectUnauthorized) {
        notes.push(
            '--ssl verify cannot work through a tunnel: the certificate names the real host, not the ' +
            'tunnel\'s local address. Use --ssl require to encrypt without verifying the host name.'
        );
    }
    return notes;
}

/** The global options, as commander parses them */
interface CliOptions {
    connection?: string;
    url?: string;
    config?: string;
    log?: boolean;
    format?: string;
    /** Set by requireConnection for an ad hoc --url connection */
    _resolvedConfig?: ResolvedConnectionConfig;
}

/** What is known about this run: its command, connection and warnings */
const invocation = new Invocation();

/**
 * Read a password from stdin, for non-interactive setup.
 *
 * Passwords are taken this way rather than as a flag so they never reach the
 * process list or the shell history. A trailing newline from `echo` or a heredoc
 * is stripped; anything else is passed through unchanged.
 */
async function readPasswordFromStdin(): Promise<string | null> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
    }
    const value = Buffer.concat(chunks).toString('utf-8').replace(/\r?\n$/, '');
    return value.length > 0 ? value : null;
}

/** Prompt for password input (hidden) */
async function promptPassword(message: string): Promise<string> {
    const result = await p.password({ message });
    if (p.isCancel(result)) {
        process.exit(0);
    }
    return result;
}

/** Derive a synthetic connection name from a URL (for caching/logging) */
function syntheticNameFromUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname || 'localhost';
        const port = parsed.port || '';
        const db = parsed.pathname.replace(/^\//, '') || 'db';
        const raw = `adhoc_${host}_${port ? port + '_' : ''}${db}`;
        // Sanitize to match SAFE_IDENTIFIER: /^[a-zA-Z_][a-zA-Z0-9_]*$/
        return raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
    } catch {
        return 'adhoc_unknown';
    }
}

/** A command's options once requireConnection has settled the connection */
type ConnectedOptions = CliOptions & { connection: string };

/** Require a connection. Auto-detects from cwd if not provided. Handles --url. */
function requireConnection(opts: CliOptions): asserts opts is ConnectedOptions {
    // --url mode: resolve config up front
    if (opts.url) {
        const detectedType = detectDbTypeFromUrl(opts.url);
        if (!detectedType) {
            throw usageError(
                'Cannot detect the database type from the URL.',
                '--url',
                'Start the URL with one of: postgres://, mysql://, mssql://, sqlserver://, sqlite://, redis://, rediss://'
            );
        }
        opts._resolvedConfig = { type: detectedType, url: opts.url } as ResolvedConnectionConfig;
        opts.connection = syntheticNameFromUrl(opts.url);
        invocation.dbType = detectedType;
        return;
    }

    if (!opts.connection) {
        const detected = detectConnectionFromCwd(opts.config);
        if (detected) {
            opts.connection = detected;
            invocation.connection = detected;
            console.error(`Using connection "${detected}" (matched directory ${process.cwd()})`);
            return;
        }
        throw new SherlockError('CONNECTION_REQUIRED', 'No connection given, and none is set up for this directory.', {
            fix: 'Pass -c <name> (see: sherlock connection list) or -u <url>.',
        });
    }
    invocation.connection = opts.connection;
}

const REDIS_COMMANDS = 'info, keys, get, inspect, slowlog, command';

/** Check that the active connection is a Redis connection */
function requireRedisConnection(opts: ConnectedOptions): void {
    const type = opts._resolvedConfig?.type ?? connectionType(opts);
    if (type !== DB_TYPES.REDIS) {
        const which = opts._resolvedConfig ? 'The URL' : `"${opts.connection}"`;
        throw new SherlockError('WRONG_DATABASE_TYPE', `${which} is a ${type} connection, and this command works only with Redis.`, {
            fix: 'Use the SQL commands: tables, describe, query.',
            details: { dbType: type, expected: DB_TYPES.REDIS },
        });
    }
}

/** Check that the active connection is a SQL connection */
function requireSqlConnection(opts: ConnectedOptions): void {
    const type = opts._resolvedConfig?.type ?? connectionType(opts);
    if (type === DB_TYPES.REDIS) {
        const which = opts._resolvedConfig ? 'The URL' : `"${opts.connection}"`;
        throw new SherlockError('WRONG_DATABASE_TYPE', `${which} is a Redis connection, and this command works only with SQL databases.`, {
            fix: `Use the Redis commands: ${REDIS_COMMANDS}.`,
            details: { dbType: DB_TYPES.REDIS, expected: 'sql' },
        });
    }
}

/** A configured connection's type, as far as the config says without resolving it */
function connectionType(opts: ConnectedOptions): string {
    const config = getConnectionConfig(opts.connection, opts.config);
    return isRedisConfig(config) ? DB_TYPES.REDIS : certainDbType(opts) ?? config.type ?? DB_TYPES.POSTGRES;
}

/** Parse a CLI option as a positive integer */
function parsePositiveInt(value: string, name: string, max?: number): number {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1 || (max !== undefined && n > max)) {
        throw usageError(`--${name} must be a positive number${max ? ` (max ${max})` : ''}, got "${value}".`, `--${name}`);
    }
    return n;
}

/** Route to the right SQL connection handler based on whether we have a pre-resolved config */
async function runWithSqlConnection<T>(
    opts: ConnectedOptions,
    handler: (sql: SqlAdapter, dbType: string) => Promise<T>,
    options?: ConnectionOptions
): Promise<T> {
    // The type is only certain once the connection is resolved: a URL held in
    // the keychain says which database it is only when read.
    const recordType = (sql: SqlAdapter, dbType: string) => {
        invocation.dbType = dbType;
        return handler(sql, dbType);
    };
    if (opts._resolvedConfig) {
        return withConnectionFromConfig(opts._resolvedConfig, recordType, options);
    }
    return withConnection(opts.connection, opts.config, recordType, options);
}

/**
 * The database type of a connection when the config alone settles it: a
 * literal URL, or host-and-port settings. Undefined when the URL is held in
 * the keychain or the environment, which only resolving the connection reads.
 * Follows the same precedence as resolving: the URL's scheme wins.
 */
function certainDbType(opts: ConnectedOptions): DbType | undefined {
    if (opts._resolvedConfig) return opts._resolvedConfig.type;
    const config = getConnectionConfig(opts.connection, opts.config);
    if (config.url === undefined) return config.type ?? DB_TYPES.POSTGRES;
    if (typeof config.url === 'string') return detectDbTypeFromUrl(config.url) ?? config.type ?? DB_TYPES.POSTGRES;
    return undefined;
}

/** Largest SQL file `query --file` will read */
const MAX_QUERY_FILE_BYTES = 1024 * 1024;

/**
 * Read the SQL for `query`: from the argument, from a file, or from stdin when
 * either is "-". Long statements with quotes in them survive a file or a pipe
 * where they would not survive a shell argument.
 */
async function readQueryText(sqlArg: string | undefined, file: string | undefined): Promise<string> {
    if (sqlArg !== undefined && file !== undefined) {
        throw usageError('Give the query as an argument or with --file, not both.', '--file');
    }

    const source = file ?? (sqlArg === '-' ? '-' : undefined);
    if (source === undefined) {
        if (sqlArg === undefined) {
            throw usageError('Give the query as an argument, with --file <path>, or on stdin with "query -".');
        }
        if (sqlArg.trim() === '') throw usageError('The query is empty.');
        // Fix shell escaping artifacts: some shells/tools escape ! to \!
        // which is never valid SQL, so safely strip it
        return sqlArg.replace(/\\!/g, '!');
    }

    let text: string;
    if (source === '-') {
        if (process.stdin.isTTY) {
            throw usageError('"query -" reads the query from stdin, but stdin is a terminal. Pipe the query in.');
        }
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of process.stdin) {
            size += chunk.length;
            if (size > MAX_QUERY_FILE_BYTES) throw usageError('The query on stdin is larger than 1 MB.');
            chunks.push(Buffer.from(chunk));
        }
        text = Buffer.concat(chunks).toString('utf-8');
    } else {
        const fs = await import('fs');
        const stat = fs.statSync(source, { throwIfNoEntry: false });
        if (!stat?.isFile()) throw usageError(`${source} does not exist or is not a file.`, '--file');
        if (stat.size > MAX_QUERY_FILE_BYTES) throw usageError(`${source} is larger than 1 MB.`, '--file');
        text = fs.readFileSync(source, 'utf-8');
    }

    // A byte-order mark would stop the query starting with SELECT.
    text = text.replace(/^\uFEFF/, '').trim();
    if (text === '') throw usageError(`The query ${source === '-' ? 'on stdin' : `in ${source}`} is empty.`);
    return text;
}

/** Route to the right Redis connection handler based on whether we have a pre-resolved config */
async function runWithRedisConnection<T>(
    opts: ConnectedOptions,
    handler: (client: import('bun').RedisClient) => Promise<T>
): Promise<T> {
    invocation.dbType = DB_TYPES.REDIS;
    if (opts._resolvedConfig) {
        return withRedisConnectionFromConfig(opts._resolvedConfig, handler);
    }
    return withRedisConnection(opts.connection, opts.config, handler);
}

// ============================================================================
// Config Transfer
// ============================================================================

/** Where `config export` writes when no --output is given */
const DEFAULT_EXPORT_FILE = 'sherlock-connections.enc';

/** An export file is small; anything far larger is not one */
const MAX_EXPORT_FILE_BYTES = 10 * 1024 * 1024;

/** Passphrase attempts allowed on import before giving up */
const IMPORT_PASSPHRASE_ATTEMPTS = 3;

/** The passphrase is only ever typed at a prompt, so both commands need a terminal */
function requireTerminal(command: string): void {
    if (!process.stdin.isTTY) {
        throw usageError(
            `'sherlock config ${command}' prompts for a passphrase and needs an interactive terminal. ` +
            `The passphrase cannot be passed as an argument or piped in.`,
            undefined,
            `Run 'sherlock config ${command}' yourself in a terminal.`
        );
    }
}

async function exportConfigAction(
    configPath: string | undefined,
    name: string | undefined,
    cmdOpts: { output: string; force?: boolean }
): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    const { loadConfigFile } = await import('./config');
    const { findConfigFile } = await import('./config/paths');
    const { buildExportPayload, sealPayload } = await import('./config/transfer');
    const { MIN_PASSPHRASE_LENGTH } = await import('./config/transfer-crypto');

    requireTerminal('export');
    const outputPath = path.resolve(cmdOpts.output);

    try {
        if (fs.existsSync(outputPath) && !cmdOpts.force) {
            throw new Error(`${outputPath} already exists. Pass --force to overwrite it.`);
        }

        const config = loadConfigFile(configPath);
        p.intro(`Exporting from ${findConfigFile(configPath)}`);

        const { payload, exported, skipped, notes } = await buildExportPayload(
            config.connections, name ? [name] : undefined
        );
        for (const s of skipped) p.log.warn(`Skipped ${s.name}: ${s.reason}.`);
        for (const n of notes) p.log.info(`${n.name}: ${n.message}`);
        if (exported.length === 0) {
            throw new Error('Nothing to export.');
        }

        const passphrase = await promptPassword(
            `Passphrase to encrypt the file (at least ${MIN_PASSPHRASE_LENGTH} characters)`
        );
        if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
            throw new Error(`The passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
        }
        const confirmation = await promptPassword('Repeat the passphrase');
        if (confirmation !== passphrase) {
            throw new Error('The passphrases do not match. Nothing was written.');
        }

        const spinner = p.spinner();
        spinner.start('Encrypting');
        const sealed = sealPayload(payload, passphrase);
        // The contents are encrypted, but there is still no reason for anyone
        // else to read them.
        fs.writeFileSync(outputPath, sealed, { mode: 0o600, flag: cmdOpts.force ? 'w' : 'wx' });
        fs.chmodSync(outputPath, 0o600);
        spinner.stop(`Wrote ${outputPath}`);

        p.note(
            exported.map(n => Object.keys(payload.connections[n].secrets).length > 0
                ? `${n}  (with password)`
                : `${n}  (no stored password)`).join('\n'),
            `Exported ${exported.length} connection${exported.length === 1 ? '' : 's'}`
        );
        p.outro(
            `Copy the file to the other machine, run 'sherlock config import ${path.basename(outputPath)}' ` +
            `there, then delete it.`
        );
        if (skipped.length > 0) process.exitCode = 1;
    } catch (error: unknown) {
        p.cancel(errorMessage(error));
        process.exit(1);
    }
}

async function importConfigAction(
    file: string,
    cmdOpts: { force?: boolean },
    configPath: string | undefined
): Promise<void> {
    const fs = await import('fs');
    const { openPayload, planImport, planHasSecrets, applyImport } = await import('./config/transfer');
    const { readSealedFile, DecryptionFailedError } = await import('./config/transfer-crypto');
    const { isKeychainAvailable } = await import('./credentials/providers/keychain');
    const { writableConfigPath, shadowingWarning } = await import('./config/write');

    // Import writes to the user config, like `connection add`. Saying so beats
    // quietly writing somewhere other than the file the user named.
    if (configPath) {
        throw usageError(
            `--config cannot be used with import. Connections are always imported into ${writableConfigPath()}.`,
            '--config'
        );
    }

    requireTerminal('import');

    try {
        const stat = fs.statSync(file, { throwIfNoEntry: false });
        if (!stat?.isFile()) throw new Error(`${file} does not exist or is not a file.`);
        if (stat.size > MAX_EXPORT_FILE_BYTES) throw new Error(`${file} is too large to be a sherlock export file.`);
        // Check the file before asking for a passphrase, so a truncated or wrong
        // file is reported as such instead of as a mistyped passphrase.
        const sealed = readSealedFile(fs.readFileSync(file, 'utf-8'));

        p.intro(`Importing ${file}`);

        let payload: ReturnType<typeof openPayload> | undefined;
        for (let attempt = 1; payload === undefined; attempt++) {
            const passphrase = await promptPassword('Passphrase the file was exported with');
            const spinner = p.spinner();
            spinner.start('Decrypting');
            try {
                payload = openPayload(sealed, passphrase);
                spinner.stop('Decrypted');
            } catch (error) {
                spinner.error(errorMessage(error));
                if (!(error instanceof DecryptionFailedError)) throw error;
                if (attempt >= IMPORT_PASSPHRASE_ATTEMPTS) {
                    throw new Error(
                        `Giving up after ${attempt} attempts. Nothing was imported. If you are sure ` +
                        `of the passphrase, the file was changed after it was exported: export it again.`
                    );
                }
            }
        }

        const plan = planImport(payload, { force: cmdOpts.force });
        for (const s of plan.skipped) p.log.warn(`Skipped ${s.name}: ${s.reason}.`);
        if (plan.toImport.length === 0) {
            p.outro('Nothing imported.');
            if (plan.skipped.length > 0) process.exitCode = 1;
            return;
        }

        let storage: Parameters<typeof applyImport>[1] = {
            kind: 'keychain',
            get: getKeychainPassword,
            set: setKeychainPassword,
            delete: deleteKeychainPassword,
        };
        if (planHasSecrets(plan) && !isKeychainAvailable()) {
            // A Mac always has a keychain; over SSH it is usually just locked,
            // and unlocking it beats settling for plaintext.
            p.log.warn(process.platform === 'darwin'
                ? 'The macOS keychain could not be written. Over SSH the login keychain is ' +
                  'usually locked: answer no, run `security unlock-keychain`, and import again. ' +
                  'Otherwise passwords can only be stored in plaintext in config.json ' +
                  '(readable by your user only).'
                : 'This machine has no usable OS keychain, so passwords can only be stored in ' +
                  'plaintext in config.json (readable by your user only).'
            );
            const accept = await p.confirm({
                message: 'Store the imported passwords in config.json?',
                initialValue: false,
            });
            if (p.isCancel(accept) || !accept) {
                p.cancel('Nothing was imported.');
                process.exit(1);
            }
            storage = { kind: 'inline' };
        }

        const { imported, path: configPath, removedEntries } = applyImport(plan, storage);

        const where = { keychain: 'password in OS keychain', inline: 'password inline in config.json', none: 'no stored password' };
        p.note(
            imported.map(c => `${c.action === 'replaced' ? '↻' : '+'} ${c.name}  (${where[c.secrets]})` +
                (c.tunnel ? `\n    tunnel: ${c.tunnel}` : '')).join('\n'),
            `Imported ${imported.length} connection${imported.length === 1 ? '' : 's'} into ${configPath}`
        );
        if (imported.some(c => c.tunnel)) {
            p.log.info('Tunnels open on this machine when you query: a command tunnel runs its command here, and a provider tunnel uses this machine\'s login for that platform. Check they are what you expect.');
        }
        if (removedEntries.length > 0) {
            p.log.info(`Deleted keychain entries the replaced connections no longer use: ${removedEntries.join(', ')}`);
        }
        const shadowed = shadowingWarning();
        if (shadowed) p.log.warn(shadowed);
        p.outro(`Delete ${file} now that it has been imported. Try: sherlock -c ${imported[0].name} tables`);
        if (plan.skipped.length > 0) process.exitCode = 1;
    } catch (error: unknown) {
        p.cancel(errorMessage(error));
        process.exit(1);
    }
}

// ============================================================================
// CLI Setup
// ============================================================================

function setupCLI() {
    const program = new Command();

    // Before any subcommand is added: commander copies these settings to each
    // subcommand as it is created. Usage errors are thrown rather than printed
    // and exited on, so the top-level handler reports them in the envelope.
    program
        .exitOverride()
        .configureOutput({ outputError: () => undefined });

    program
        .name('sherlock')
        .description('Database query tool with read-only access')
        .version(pkg.version);

    // Global options
    program
        .option('-c, --connection <name>', 'database connection name from config (required for DB commands)')
        .option('-u, --url <url>', 'connect directly via URL (e.g. postgres://user:pass@host:5432/db)')
        .option('--config <path>', 'path to config file')
        .option('--no-log', 'disable query logging')
        .option('-f, --format <format>', 'output format: json or markdown', DEFAULT_OUTPUT_FORMAT)
        .hook('preAction', (thisCommand, actionCommand) => {
            invocation.command = commandPath(actionCommand);
            const opts = thisCommand.opts<CliOptions>();
            if (opts.connection && opts.url) {
                throw usageError('--connection (-c) and --url (-u) are mutually exclusive. Use one or the other.', '--url');
            }
            if (opts.format && !['json', 'markdown'].includes(opts.format)) {
                throw usageError(`Invalid format "${opts.format}". Must be 'json' or 'markdown'.`, '--format');
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireSqlConnection(opts);
            await runWithSqlConnection(opts, async (sql, dbType) => {
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
            const opts = program.opts<CliOptions>();
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
            await runWithSqlConnection(opts, async (sql, dbType) => {
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireSqlConnection(opts);
            await runWithSqlConnection(opts, async (sql, dbType) => {
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireSqlConnection(opts);

            const limit = parsePositiveInt(cmdOpts.limit, 'limit', MAX_SAMPLE_LIMIT);

            await runWithSqlConnection(opts, async (sql, dbType) => {
                const result = await sampleTable(sql, dbType as DbType, tableName, limit);

                // Log if enabled (ad hoc --url connections have logging disabled)
                if (!opts._resolvedConfig) {
                    const connConfig = getConnectionConfig(opts.connection, opts.config);
                    const loggingEnabled = connConfig.logging === true && opts.log !== false;
                    if (loggingEnabled) {
                        logQuery(opts.connection, `-- sherlock sample ${tableName} --limit ${limit}`, {
                            rowCount: result.rowCount,
                            rows: result.rows,
                        });
                    }
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireSqlConnection(opts);
            await runWithSqlConnection(opts, async (sql, dbType) => {
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireSqlConnection(opts);
            await runWithSqlConnection(opts, async (sql, dbType) => {
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireSqlConnection(opts);
            await runWithSqlConnection(opts, async (sql, dbType) => {
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
        .command('query [sql]')
        .description('Execute a read-only SQL query')
        .option('--file <path>', 'read the query from a file, or from stdin with "-"')
        .option('--timeout <duration>', 'cancel the query after this long, e.g. 30s or 5m (default: the connection\'s statementTimeout, else 60s)')
        .addHelpText('after', `
The query can be given three ways:
  sherlock -c <conn> query "SELECT 1"
  sherlock -c <conn> query --file check.sql
  sherlock -c <conn> query - < check.sql

Every query runs in a read-only transaction that is rolled back afterwards.`)
        .action(async (sqlArg: string | undefined, cmdOpts: { file?: string; timeout?: string }) => {
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireSqlConnection(opts);

            const sqlQuery = await readQueryText(sqlArg, cmdOpts.file);
            let options: ConnectionOptions = {};
            if (cmdOpts.timeout !== undefined) {
                let timeoutMs: number;
                try {
                    timeoutMs = Math.round(parseDuration(cmdOpts.timeout));
                } catch (error: unknown) {
                    throw usageError(`--timeout: ${errorMessage(error)}`, '--timeout');
                }
                options = { statementTimeoutMs: timeoutMs };
            }

            // When the config already says which database this is, refuse a
            // bad query before a tunnel is started or a connection opened.
            const knownType = certainDbType(opts);
            if (knownType) {
                const early = validateReadOnlyQuery(sqlQuery, knownType);
                if (!early.valid) throw queryRefusedError(early);
            }

            await runWithSqlConnection(opts, async (sql, dbType) => {
                // Enforce read-only, with the dialect the connection resolved
                // to: the one the database will read the query with. The type
                // is only certain once a URL held in the keychain is read.
                const validation = validateReadOnlyQuery(sqlQuery, dbType as DbType);
                if (!validation.valid) throw queryRefusedError(validation);

                // Log if enabled (ad hoc --url connections have logging disabled)
                const loggingEnabled = !opts._resolvedConfig &&
                    getConnectionConfig(opts.connection, opts.config).logging === true && opts.log !== false;

                let result;
                try {
                    result = await executeQuery(sql, sqlQuery);
                } catch (error: unknown) {
                    if (loggingEnabled) logQuery(opts.connection, sqlQuery, { error: errorMessage(error) });
                    throw error;
                }
                if (loggingEnabled) logQuery(opts.connection, sqlQuery, result);

                const format = opts.format as OutputFormat;
                console.log(formatOutput(result, format));
            }, options);
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireRedisConnection(opts);
            await runWithRedisConnection(opts, async (client) => {
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireRedisConnection(opts);

            const limit = parsePositiveInt(cmdOpts.limit, 'limit');

            await runWithRedisConnection(opts, async (client) => {
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireRedisConnection(opts);

            const limit = parsePositiveInt(cmdOpts.limit, 'limit');

            await runWithRedisConnection(opts, async (client) => {
                const result = await getKeyValue(client, key, limit);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Inspect command
    program
        .command('inspect <key>')
        .description('Inspect Redis key metadata (type, TTL, memory usage, encoding)')
        .action(async (key: string) => {
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireRedisConnection(opts);
            await runWithRedisConnection(opts, async (client) => {
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
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireRedisConnection(opts);

            const count = parsePositiveInt(cmdOpts.count, 'count');

            await runWithRedisConnection(opts, async (client) => {
                const result = await getSlowlog(client, count);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // Command command (generic read-only Redis command)
    program
        .command('command <cmd> [args...]')
        .description('Execute a read-only Redis command')
        .action(async (cmd: string, args: string[]) => {
            const opts = program.opts<CliOptions>();
            requireConnection(opts);
            requireRedisConnection(opts);
            await runWithRedisConnection(opts, async (client) => {
                const result = await executeCommand(client, cmd, args);
                console.log(JSON.stringify(result, null, 2));
            });
        });

    // ========================================================================
    // Connection Management Commands
    // ========================================================================

    // Hidden: `connection list` is the documented spelling, but scripts and
    // older docs use `connections`.
    program
        .command('connections', { hidden: true })
        .description('List all configured connections')
        .action(() => listConnectionsAction(program.opts().config));

    // Test connection command (hidden — use `manage` instead)
    program
        .command('test <connectionName>', { hidden: true })
        .description('Test a database connection')
        .action(async (connectionName: string) => {
            const opts = program.opts<CliOptions>();

            console.log(`Testing connection: ${connectionName}...`);

            const connConfig = getConnectionConfig(connectionName, opts.config);
            if (isRedisConfig(connConfig)) {
                await withRedisConnection(connectionName, opts.config, async (client) => {
                    await client.send('PING', []);
                });
            } else {
                await withConnection(connectionName, opts.config, async (sql) => {
                    await sql.unsafe('SELECT 1');
                });
            }
            console.log(`\x1b[32m✓ Connection "${connectionName}" successful!\x1b[0m`);
        });

    program
        .command('guide [topic]')
        .description('Print the guide for AI agents using sherlock (topics: transfer)')
        .action(async (topic: string | undefined) => {
            const { guideText } = await import('./guide');
            process.stdout.write(guideText(topic, pkg.version));
        });

    program
        .command('doctor [connectionName]')
        .description('Check a connection step by step and report the first thing that is wrong')
        .addHelpText('after', `
Checks, in order, stopping at the first failure:
  config       the connection and its tunnel are valid
  tunnel target  the tunnel forwards to the database the host names
  provider     the tunnel provider can see its target (e.g. northflank login, project, addon)
  credentials  every password or URL reference resolves (values are never shown)
  tunnel       the tunnel comes up
  tls          the session is encrypted, when ssl is configured
  query        SELECT 1 succeeds in a read-only transaction (PING for Redis)

Exits 1 when a check fails.`)
        .action(async (connectionName: string | undefined) => {
            const opts = program.opts<CliOptions>();
            if (opts.url) {
                throw usageError('doctor checks a configured connection. Give its name, not --url.', '--url');
            }
            const name = connectionName ?? opts.connection;
            if (connectionName && opts.connection && connectionName !== opts.connection) {
                throw usageError('Give the connection either as an argument or with -c, not both.', '--connection');
            }
            const configPath: string | undefined = opts.config;
            const target = name ?? detectConnectionFromCwd(configPath);
            if (!target) {
                throw new SherlockError('CONNECTION_REQUIRED', 'No connection given to check, and none is set up for this directory.', {
                    fix: 'Give its name: sherlock doctor <name>. See them with: sherlock connection list',
                });
            }
            invocation.connection = target;
            const { diagnoseConnection } = await import('./doctor');
            const report = await diagnoseConnection(target, configPath);
            console.log(JSON.stringify(report, null, 2));
            if (!report.ok) process.exitCode = 1;
        });

    // ========================================================================
    // Connection Setup Commands
    // ========================================================================

    const connection = program
        .command('connection')
        .description('Add and inspect connections without the interactive wizard');

    connection
        .command('list')
        .description('List all configured connections')
        .action(() => listConnectionsAction(program.opts().config));

    connection
        .command('add <name>')
        .description('Add a connection non-interactively')
        .option('--from-url <url>', 'take host, port, user and database from a connection URL')
        .option('--type <type>', 'postgres, mysql, mssql, sqlite or redis')
        .option('--host <host>', 'database host')
        .option('--port <port>', 'database port')
        .option('--username <user>', 'database user')
        .option('--database <name>', 'database name, or file path for sqlite')
        .option('--ssl <mode>', 'off, require, or verify')
        .option('--logging', 'record queries for this connection')
        .option('--directory <path>', 'auto-select this connection when inside this directory (stored as an absolute path)')
        .option('--password-stdin', 'read the password from stdin and store it in the OS keychain')
        .option('--password-env <var>', 'read the password from this environment variable at query time')
        .option('--tunnel-command <cmd>', 'port-forwarding command; use {{port}} where it takes a local port')
        .option('--tunnel-northflank <project/addon>', 'a northflank CLI command tunnel (prefer --tunnel-provider northflank)')
        .option('--tunnel-provider <id>', 'open the tunnel with a provider instead of a command, e.g. northflank')
        .option(
            '--tunnel-option <key=value>',
            'a setting for --tunnel-provider; repeat for each one ' +
                '(northflank: context, project, addon, endpoint, port, team, configDir)',
            (value: string, previous: string[] = []) => [...previous, value]
        )
        .option('--tunnel-local-port <port>', 'fixed local port, when the command cannot be told one')
        .option('--tunnel-endpoint-pattern <regex>', 'read the endpoint from the command output')
        .option('--tunnel-idle-timeout <duration>', 'shut the tunnel down after this long unused, e.g. 30m (default 10m)')
        .option('--tunnel-ready-timeout <duration>', 'how long to wait for the tunnel to accept, e.g. 1m (default 30s)')
        .option('--force', 'replace an existing connection of the same name')
        .action(async (name: string, cmdOpts: ConnectionAddOptions & { force?: boolean }) => {
            const { buildConnectionConfig } = await import('./config/connection-input');
            const { addConnection, connectionExists, shadowingWarning } = await import('./config/write');
            const { summarizeTunnel } = await import('./config');

            // -u/--url is a global option meaning "connect to this URL now", so
            // it never reaches this command. Say so rather than reporting the
            // missing details it would have supplied.
            if (program.opts().url) {
                throw usageError(
                    '-u/--url connects to a URL without saving it.',
                    '--url',
                    'Use --from-url to build a connection from a URL.'
                );
            }
            invocation.connection = name;

            const config = buildConnectionConfig(name, cmdOpts);

            // Refuse a duplicate before storing the secret. Writing the
            // keychain entry first would replace the existing connection's
            // password and then abandon it, leaving that connection
            // pointing at credentials that no longer work.
            if (connectionExists(name) && !cmdOpts.force) {
                throw usageError(`Connection "${name}" already exists.`, '--force', 'Pass --force to replace it.');
            }

            if (cmdOpts.passwordStdin && process.stdin.isTTY) {
                throw usageError(
                    '--password-stdin reads the password from a pipe, and stdin is a terminal.',
                    '--password-stdin',
                    "Pipe it in, e.g. printf '%s' \"$PASSWORD\" | sherlock connection add ..."
                );
            }
            if (cmdOpts.passwordStdin) {
                const password = await readPasswordFromStdin();
                if (password === null) {
                    throw usageError('--password-stdin was given but stdin was empty.', '--password-stdin');
                }
                setKeychainPassword(name, password);
            }

            const { replaced, path: configPath } = addConnection(name, config, {
                force: cmdOpts.force,
            });

            const shadowed = shadowingWarning();
            if (shadowed) console.error(`Warning: ${shadowed}`);
            for (const note of connectionAddNotes(config)) console.error(`Note: ${note}`);

            // A tunnel is opened by the first command, so check it with
            // doctor first; otherwise start with a command that lists something.
            const next = config.tunnel
                ? `sherlock doctor ${name}`
                : isRedisConfig(config) ? `sherlock -c ${name} info` : `sherlock -c ${name} tables`;

            console.log(JSON.stringify({
                connection: name,
                action: replaced ? 'replaced' : 'added',
                config: configPath,
                tunnel: config.tunnel ? summarizeTunnel(name, config.tunnel) : null,
                next,
            }, null, 2));
        });

    // ========================================================================
    // Config Transfer Commands
    // ========================================================================

    const configCmd = program
        .command('config')
        .description('Move connections, credentials included, to another machine');

    configCmd
        .command('export [name]')
        .description('Write connections and their credentials to a passphrase-encrypted file')
        .option('-o, --output <file>', 'file to write', DEFAULT_EXPORT_FILE)
        .option('--force', 'overwrite the output file if it exists')
        .addHelpText('after', `
Exports every connection, or only [name]. Passwords are read from wherever
they are stored (keychain, .env or config.json) and encrypted with a
passphrase you are prompted for. The passphrase is never taken as an argument.

Move the file to the other machine yourself (scp, USB) and run
'sherlock config import <file>' there.`)
        .action(async (name: string | undefined, cmdOpts: { output: string; force?: boolean }) => {
            await exportConfigAction(program.opts().config, name, cmdOpts);
        });

    configCmd
        .command('import <file>')
        .description('Add the connections in an export file to this machine')
        .option('--force', 'replace connections that already exist with the same name')
        .addHelpText('after', `
Prompts for the passphrase the file was exported with. Passwords are stored in
the OS keychain, as 'connection add --password-stdin' does. On a machine with
no keychain you are asked before any password is written to config.json.

A connection whose name already exists is skipped unless --force is given.`)
        .action(async (file: string, cmdOpts: { force?: boolean }) => {
            await importConfigAction(file, cmdOpts, program.opts().config);
        });

    // ========================================================================
    // Tunnel Commands
    // ========================================================================

    const tunnel = program
        .command('tunnel')
        .description('Inspect and stop background tunnels');

    tunnel
        .command('status')
        .description('Show running tunnels')
        .action(async () => {
            const { listTunnels } = await import('./tunnel/manager');
            const tunnels = await listTunnels();
            console.log(JSON.stringify({ tunnels }, null, 2));
        });

    tunnel
        .command('stop [connectionName]')
        .description('Stop a tunnel, or all tunnels when no name is given')
        .action(async (connectionName: string | undefined) => {
            const { stopTunnel, stopAllTunnels } = await import('./tunnel/manager');
            const results = connectionName
                ? [await stopTunnel(connectionName)]
                : await stopAllTunnels();

            if (results.length === 0) {
                console.log(JSON.stringify({ stopped: [], message: 'No tunnels running' }, null, 2));
                return;
            }
            console.log(JSON.stringify({ stopped: results }, null, 2));
            // A named tunnel that was not running is worth knowing about: the
            // name may be misspelt. Stopping all of none is not a failure.
            if (connectionName && !results[0].stopped) process.exitCode = 1;
        });

    // Hidden: this is how sherlock re-invokes itself as a tunnel supervisor.
    // Config path comes from the global --config, which commander parses even
    // when it appears after the subcommand.
    tunnel
        .command('__supervise', { hidden: true })
        .description('Run as a tunnel supervisor process (internal)')
        .requiredOption('--name <name>', 'connection name to supervise')
        .action(async (cmdOpts: { name: string }) => {
            const opts = program.opts<CliOptions>();
            const { runSupervisor } = await import('./tunnel/supervisor');
            const code = await runSupervisor(cmdOpts.name, opts.config);
            process.exit(code);
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
                throw usageError('No password was entered.');
            }
            setKeychainPassword(account, password);
            console.log(`\x1b[32m✓\x1b[0m Password stored for account "${account}"`);
            console.log(`\nUse in config.json:`);
            console.log(`  "password": { "$keychain": "${account}" }`);
        });

    keychain
        .command('get <account>')
        .description('Check whether the keychain has a password for an account')
        .action((account: string) => {
            // Reports only whether the entry exists. Printing the password
            // would put it in the terminal scrollback, and in front of any
            // agent that finds this command.
            if (!hasKeychainPassword(account)) throw keychainEntryNotFound(account);
            console.log(`The keychain has a password for "${account}".`);
        });

    keychain
        .command('delete <account>')
        .description('Delete a password from the keychain')
        .action((account: string) => {
            if (!hasKeychainPassword(account)) throw keychainEntryNotFound(account);
            deleteKeychainPassword(account);
            console.log(`\x1b[32m✓\x1b[0m Password deleted for account "${account}"`);
        });

    keychain
        .command('list')
        .description('Show where each connection\'s password comes from, and whether it is there')
        .action(async () => {
            const opts = program.opts<CliOptions>();
            const { loadConfigFile } = await import('./config');
            const { passwordStatus } = await import('./credentials/status');
            const config = loadConfigFile(opts.config);
            const passwords = listConnections(opts.config).map((name) => ({
                connection: name,
                ...passwordStatus(name, config.connections[name]),
            }));
            console.log(JSON.stringify({ passwords }, null, 2));
            if (passwords.some((entry) => !entry.ok)) process.exitCode = 1;
        });

    return program;
}

// ============================================================================
// Main
// ============================================================================

/** Commander's exits that are not failures: help and --version */
const COMMANDER_EXITS = new Set(['commander.help', 'commander.helpDisplayed', 'commander.version']);

/** The command as typed, e.g. "connection add", from the command commander ran */
function commandPath(command: Command): string {
    const names: string[] = [];
    for (let current: Command | null = command; current?.parent; current = current.parent) {
        names.unshift(current.name());
    }
    return names.join(' ');
}

/**
 * The command named on the command line, for an error raised before commander
 * ran it: the longest run of words that name a command and its subcommands.
 */
function commandPathFromArgv(program: Command, args: string[]): string {
    const names: string[] = [];
    let current = program;
    for (const arg of args) {
        if (arg.startsWith('-')) continue;
        const next = current.commands.find((c) => c.name() === arg || c.aliases().includes(arg));
        if (!next) {
            // A value of a global option such as -c, or the command's own argument
            if (names.length > 0) break;
            continue;
        }
        names.push(next.name());
        current = next;
    }
    return names.join(' ');
}

/** A commander parse failure as a USAGE error, naming the flag when there is one */
function fromCommanderError(error: CommanderError): SherlockError {
    const message = error.message.replace(/^error: /, '');
    const flag = /(?:option|flag) '([^']+)'/.exec(message)?.[1]?.split(/[ ,<[]/)[0];
    const fix = error.code === 'commander.unknownCommand' || error.code === 'commander.unknownOption'
        ? 'See the commands and flags with: sherlock --help'
        : undefined;
    return usageError(message.replace(/\.?$/, '.'), flag, fix);
}

function keychainEntryNotFound(account: string): SherlockError {
    return new SherlockError('NOT_FOUND', `The keychain has no password for "${account}".`, {
        fix: `Store one with: sherlock keychain set ${account}`,
        details: { kind: 'keychain entry', name: account },
    });
}

/**
 * Run the command. Any error it throws, or commander's own usage errors, is
 * reported once, here, in the envelope, with the exit code that goes with it.
 * `tunnel __supervise` exits by itself with its own code and never gets here.
 */
async function main(): Promise<void> {
    const program = setupCLI();
    try {
        await program.parseAsync(process.argv);
    } catch (thrown: unknown) {
        let error = thrown;
        if (error instanceof CommanderError) {
            if (COMMANDER_EXITS.has(error.code)) {
                process.exitCode = error.exitCode;
                return;
            }
            error = fromCommanderError(error);
        }
        invocation.command ||= commandPathFromArgv(program, process.argv.slice(2));
        if (process.env.DEBUG && error instanceof Error && error.stack) {
            process.stderr.write(`${error.stack}\n`);
        }
        const code = printEnvelope(invocation.fail(error));
        // Exit once stdout has taken the envelope: pending work such as a
        // tunnel keepalive timer must not keep the process alive, and exiting
        // straight away can cut a write to a pipe short.
        process.stdout.write('', () => process.exit(code));
    }
}

void main();
