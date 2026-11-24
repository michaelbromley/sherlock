import * as fs from 'fs';
import * as path from 'path';
import {
    describeConfigSource,
    discoveredConfigs,
    findConfig,
    getConfigDir,
    getEnvFilePath,
    realDirectory,
    type ConfigSource,
} from './paths';
import { getCredentialResolver } from '../credentials';
import { parseEnvFile, projectEnv } from './env-file';
import { SherlockError, isSherlockError, errorMessage } from '../errors';
import { stderrWarnings, type SherlockWarning, type WarningSink } from '../output/warnings';
import type { SherlockConfig, ConnectionConfig, ResolvedConnectionConfig, CredentialRef, SslConfig } from './types';
import type { TunnelConfig } from '../tunnel/types';
import { connectionEnvVarName, getEnvVarForConnection } from '../credentials/providers/env';
import { DB_TYPES, DEFAULT_PORTS, detectDbTypeFromUrl, parseBoolParam, type DbType } from '../db-types';
import { ensureTunnel } from '../tunnel/manager';
import { resolveTunnel } from '../tunnel/providers';
import { parseDuration } from '../tunnel/config';

let cachedConfig: SherlockConfig | null = null;
let cachedConfigPath: string | null = null;
let cachedConfigSource: ConfigSource | null = null;
let envLoaded = false;

/**
 * Config sources that come from the current working directory, and so may
 * belong to a repository the user has merely cloned rather than written.
 */
const UNTRUSTED_CONFIG_SOURCES: ConfigSource[] = ['project', 'legacy'];

/**
 * Load environment variables from the Sherlock config directory's .env file
 */
function loadEnvFile(): void {
    if (envLoaded) return;
    envLoaded = true;

    const envPath = getEnvFilePath();
    if (!fs.existsSync(envPath)) return;

    for (const [key, value] of Object.entries(parseEnvFile(fs.readFileSync(envPath, 'utf-8')))) {
        // Only set if not already set in environment
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

/**
 * Load the Sherlock configuration from file. A warning about the file itself,
 * such as a legacy config.ts, goes to `warnings` the first time it is read.
 */
export function loadConfigFile(configPath?: string, warnings: WarningSink = stderrWarnings): SherlockConfig {
    // Load .env file from config directory
    loadEnvFile();

    const found = findConfig(configPath);

    if (!found) {
        throw new SherlockError(
            'CONFIG_NOT_FOUND',
            `No configuration file found. Sherlock reads ./.sherlock.json (project-local) or ` +
            `${path.join(getConfigDir(), 'config.json')} (user config), or the file named by --config ` +
            `or the SHERLOCK_CONFIG environment variable.`,
            {
                fix: "Add a connection with 'sherlock connection add <name> ...': 'sherlock guide setup' shows how. Or run 'sherlock manage'.",
                details: { searched: discoveredConfigs().map((candidate) => candidate.path) },
            }
        );
    }

    const resolvedPath = found.path;
    cachedConfigSource = found.source;

    // Use cached config if available
    if (cachedConfig && cachedConfigPath === resolvedPath) {
        return cachedConfig;
    }

    // Check if it's a legacy TypeScript config
    if (resolvedPath.endsWith('.ts')) {
        cachedConfig = loadLegacyConfig(resolvedPath, warnings);
        cachedConfigPath = resolvedPath;
        return cachedConfig;
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    let config: SherlockConfig;
    try {
        config = JSON.parse(content) as SherlockConfig;
    } catch (error) {
        throw new SherlockError('CONFIG_INVALID', `${resolvedPath} is not valid JSON: ${errorMessage(error)}`, {
            fix: `Fix the JSON in ${resolvedPath}.`,
            cause: error,
        });
    }
    if (typeof config?.connections !== 'object' || config.connections === null || Array.isArray(config.connections)) {
        throw new SherlockError('CONFIG_INVALID', `${resolvedPath} has no "connections" object.`, {
            fix: `Give ${resolvedPath} a "connections" object, or add one with 'sherlock connection add'.`,
            details: { setting: 'connections' },
        });
    }

    cachedConfig = config;
    cachedConfigPath = resolvedPath;

    return config;
}

/**
 * Load legacy TypeScript config file (for backwards compatibility)
 */
function loadLegacyConfig(configPath: string, warnings: WarningSink): SherlockConfig {
    warnings.add({
        code: 'CONFIG_LEGACY',
        message: `Using the legacy config.ts format, from ${configPath}.`,
        fix: "Run 'sherlock migrate' to convert it to the JSON format.",
        details: { path: configPath },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const legacyConfig = require(configPath);

    // Convert TypeORM DataSourceOptions to SherlockConfig
    const connections: Record<string, ConnectionConfig> = {};

    for (const [name, opts] of Object.entries(legacyConfig.connections as Record<string, any>)) {
        connections[name] = {
            type: opts.type === 'better-sqlite3' ? DB_TYPES.SQLITE : opts.type,
            host: opts.host,
            port: opts.port,
            username: opts.username,
            password: opts.password,
            database: opts.database,
            filename: opts.database, // SQLite uses database field for filename
        };
    }

    return { connections };
}

/**
 * Get a specific connection configuration
 */
export function getConnectionConfig(
    connectionName: string,
    configPath?: string,
    warnings?: WarningSink
): ConnectionConfig {
    const config = loadConfigFile(configPath, warnings);

    if (!Object.prototype.hasOwnProperty.call(config.connections, connectionName)) {
        const available = Object.keys(config.connections);
        throw new SherlockError('CONNECTION_NOT_FOUND', `Connection "${connectionName}" not found in config.`, {
            fix: available.length > 0
                ? `Use one of: ${available.join(', ')}.`
                : "The config has no connections. Add one with 'sherlock connection add <name> ...': 'sherlock guide setup' shows how.",
            details: { connection: connectionName, available },
        });
    }

    return config.connections[connectionName];
}

/**
 * Normalized SSL settings — internal flat form used by the URL builders.
 * Public callers should pass `ConnectionConfig['ssl']` directly; functions
 * that consume this type normalize on entry via `normalizeSsl()`.
 */
export interface NormalizedSsl {
    enabled: boolean;
    /** Whether to verify the server certificate against system CAs */
    verify: boolean;
}

/**
 * Normalize the public ssl config (boolean | object | undefined) into a flat
 * internal form. Keeps the per-driver URL building logic simple.
 */
export function normalizeSsl(ssl: ConnectionConfig['ssl']): NormalizedSsl {
    if (ssl === true) return { enabled: true, verify: false };
    if (ssl === false || ssl == null) return { enabled: false, verify: false };
    // Object form: rejectUnauthorized defaults to false ("encrypt but don't verify")
    return { enabled: true, verify: ssl.rejectUnauthorized === true };
}

/**
 * Build the SSL query-string fragment for a given driver. Returns a string
 * that can be appended to a URL after `?`, or an empty string when no SSL.
 */
function buildSslQuery(type: DbType, ssl: NormalizedSsl): string {
    if (!ssl.enabled) return '';

    if (type === DB_TYPES.POSTGRES) {
        return ssl.verify ? 'sslmode=verify-full' : 'sslmode=require';
    }
    if (type === DB_TYPES.MYSQL) {
        return ssl.verify ? 'ssl-mode=VERIFY_IDENTITY' : 'ssl-mode=REQUIRED';
    }
    if (type === DB_TYPES.MSSQL) {
        // trustServerCertificate=true means "do not verify"
        return ssl.verify
            ? 'encrypt=true&trustServerCertificate=false'
            : 'encrypt=true&trustServerCertificate=true';
    }
    return '';
}

/**
 * Result of parsing a connection string. Each field is optional —
 * the TUI uses presence to decide which prompts to skip.
 */
export interface ParsedConnectionUrl {
    type?: DbType;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    ssl?: ConnectionConfig['ssl'];
    allowPublicKeyRetrieval?: boolean;
}

/**
 * Parse postgres SSL query params into our ssl config form.
 * sslmode values: disable, allow, prefer, require, verify-ca, verify-full
 */
function parsePostgresSsl(params: URLSearchParams): ConnectionConfig['ssl'] | undefined {
    const mode = params.get('sslmode')?.toLowerCase();
    if (!mode) return undefined;
    if (mode === 'disable') return false;
    if (mode === 'verify-ca' || mode === 'verify-full') return { rejectUnauthorized: true };
    // require / prefer / allow → encrypt without verification
    return true;
}

/**
 * Parse MySQL SSL query params. ssl-mode values: DISABLED, PREFERRED,
 * REQUIRED, VERIFY_CA, VERIFY_IDENTITY (case-insensitive).
 */
function parseMysqlSsl(params: URLSearchParams): ConnectionConfig['ssl'] | undefined {
    const mode = params.get('ssl-mode')?.toUpperCase() ?? params.get('sslmode')?.toUpperCase();
    if (!mode) return undefined;
    if (mode === 'DISABLED') return false;
    if (mode === 'VERIFY_CA' || mode === 'VERIFY_IDENTITY') return { rejectUnauthorized: true };
    return true;
}

/**
 * Parse MSSQL SSL query params: encrypt + trustServerCertificate booleans.
 */
function parseMssqlSslParams(params: URLSearchParams): ConnectionConfig['ssl'] | undefined {
    const encrypt = parseBoolParam(params.get('encrypt'));
    if (encrypt == null) return undefined;
    if (!encrypt) return false;
    // trustServerCertificate=false means "verify the cert"
    const trust = parseBoolParam(params.get('trustServerCertificate'));
    return trust === false ? { rejectUnauthorized: true } : true;
}

/**
 * Parse a connection string into individual config fields. Returns each piece
 * as optional so callers can tell what was present in the URL vs what still
 * needs to be prompted for. Returns null if the string isn't a parseable URL
 * or doesn't have a recognised database scheme.
 */
export function parseConnectionUrl(rawUrl: string): ParsedConnectionUrl | null {
    const url = rawUrl.trim();
    if (!url) return null;

    const type = detectDbTypeFromUrl(url);
    if (type == null) return null;

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    // SQLite is just a path, not really a URL with creds/host.
    if (type === DB_TYPES.SQLITE) {
        const filename = parsed.pathname.replace(/^\//, '') || (url === ':memory:' ? ':memory:' : '');
        return {
            type,
            database: filename || undefined,
        };
    }

    const result: ParsedConnectionUrl = { type };

    if (parsed.hostname) {
        // WHATWG URL retains brackets around IPv6 literals in `hostname` —
        // strip them so the host string is bracket-free in our config form.
        const hostname = parsed.hostname;
        result.host = hostname.startsWith('[') && hostname.endsWith(']')
            ? hostname.slice(1, -1)
            : hostname;
    }
    if (parsed.port) result.port = parseInt(parsed.port, 10);
    if (parsed.username) result.username = decodeURIComponent(parsed.username);
    if (parsed.password) result.password = decodeURIComponent(parsed.password);

    const dbPath = parsed.pathname.replace(/^\//, '');
    if (dbPath) result.database = decodeURIComponent(dbPath);

    // SSL detection — per-driver, plus the rediss:// scheme shortcut
    let ssl: ConnectionConfig['ssl'] | undefined;
    if (type === DB_TYPES.POSTGRES) ssl = parsePostgresSsl(parsed.searchParams);
    else if (type === DB_TYPES.MYSQL) ssl = parseMysqlSsl(parsed.searchParams);
    else if (type === DB_TYPES.MSSQL) ssl = parseMssqlSslParams(parsed.searchParams);
    else if (type === DB_TYPES.REDIS && url.startsWith('rediss://')) ssl = true;

    if (ssl !== undefined) result.ssl = ssl;

    if (type === DB_TYPES.MYSQL && parseBoolParam(parsed.searchParams.get(PUBLIC_KEY_RETRIEVAL_PARAM))) {
        result.allowPublicKeyRetrieval = true;
    }

    return result;
}

/** Bracket an IPv6 host for inclusion in a URL authority component. */
function formatHostForUrl(host: string): string {
    // IPv6 literals contain colons and must be bracketed in URLs.
    // IPv4 and hostnames never contain ':', so this check is unambiguous.
    return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

/**
 * Build a connection URL from individual config parameters.
 *
 * Accepts the public ssl config shape (boolean | SslConfig | undefined) and
 * normalizes internally — callers don't need to construct NormalizedSsl.
 */
export function buildConnectionUrl(
    type: DbType,
    host: string,
    port: number | undefined,
    username: string,
    password: string,
    database: string,
    ssl?: ConnectionConfig['ssl']
): string {
    const encodedPassword = encodeURIComponent(password);
    const encodedUsername = encodeURIComponent(username);
    const defaultPort = DEFAULT_PORTS[type];
    const sslQuery = buildSslQuery(type, normalizeSsl(ssl));
    const suffix = sslQuery ? `?${sslQuery}` : '';
    const formattedHost = formatHostForUrl(host);

    if (type === DB_TYPES.POSTGRES) {
        return `postgres://${encodedUsername}:${encodedPassword}@${formattedHost}:${port || defaultPort}/${database}${suffix}`;
    } else if (type === DB_TYPES.MYSQL) {
        return `mysql://${encodedUsername}:${encodedPassword}@${formattedHost}:${port || defaultPort}/${database}${suffix}`;
    } else if (type === DB_TYPES.MSSQL) {
        return `mssql://${encodedUsername}:${encodedPassword}@${formattedHost}:${port || defaultPort}/${database}${suffix}`;
    }

    throw new SherlockError('CONFIG_INVALID', `Unsupported database type: ${type}`, {
        fix: 'Set "type" to one of: postgres, mysql, mssql, sqlite, redis.',
        details: { setting: 'type' },
    });
}

/**
 * Query param that carries the MySQL `allowPublicKeyRetrieval` option in a
 * connection URL, named as in JDBC. The MySQL driver reads it from the URL
 * and refuses to ask the server for its key without it.
 */
export const PUBLIC_KEY_RETRIEVAL_PARAM = 'allowPublicKeyRetrieval';

/**
 * Add the public key retrieval param to a MySQL URL when the connection
 * config enables it. Returns the URL unchanged for other types or when the
 * option is not set.
 */
export function applyPublicKeyRetrievalToUrl(url: string, type: DbType, allow: boolean | undefined): string {
    if (type !== DB_TYPES.MYSQL || allow !== true) return url;

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return url;
    }
    parsed.searchParams.set(PUBLIC_KEY_RETRIEVAL_PARAM, 'true');
    return parsed.toString();
}

/** Driver-specific SSL query keys that we manage ourselves */
const SSL_QUERY_KEYS: Record<DbType, string[]> = {
    [DB_TYPES.POSTGRES]: ['sslmode'],
    [DB_TYPES.MYSQL]: ['ssl-mode', 'sslmode', 'ssl'],
    [DB_TYPES.MSSQL]: ['encrypt', 'trustServerCertificate'],
    [DB_TYPES.REDIS]: [],
    [DB_TYPES.SQLITE]: [],
};

/**
 * Overlay an explicit `ssl` config onto an existing connection URL.
 * Strips any pre-existing driver-specific SSL query params and re-adds them
 * from the `ssl` config. For Redis, swaps the protocol between redis:// and
 * rediss:// as appropriate. Returns the URL unchanged when `ssl` is null/undefined.
 */
export function applySslToUrl(url: string, type: DbType, ssl: ConnectionConfig['ssl']): string {
    if (ssl === undefined) return url;

    // Redis is handled by switching the protocol — no query params.
    if (type === DB_TYPES.REDIS) {
        const enabled = normalizeSsl(ssl).enabled;
        if (enabled && url.startsWith('redis://')) return 'rediss://' + url.slice('redis://'.length);
        if (!enabled && url.startsWith('rediss://')) return 'redis://' + url.slice('rediss://'.length);
        return url;
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return url;
    }

    // Strip any existing SSL params for this driver
    for (const key of SSL_QUERY_KEYS[type]) parsed.searchParams.delete(key);

    // Append the new ones (if ssl is enabled)
    const sslQuery = buildSslQuery(type, normalizeSsl(ssl));
    if (sslQuery) {
        for (const pair of sslQuery.split('&')) {
            const [k, v] = pair.split('=');
            parsed.searchParams.set(k, v);
        }
    }

    return parsed.toString();
}

/**
 * Point a connection URL at a different host and port, preserving credentials,
 * database name and query parameters.
 */
export function rewriteUrlEndpoint(url: string, host: string, port: number): string {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        // The URL holds the password, so it is not quoted here.
        throw new SherlockError('CONFIG_INVALID', 'Cannot apply the tunnel: the connection URL cannot be parsed.', {
            fix: 'Check the connection\'s "url".',
            details: { setting: 'url' },
        });
    }

    parsed.hostname = host;
    parsed.port = String(port);
    return parsed.toString();
}

/**
 * Whether the loaded config was discovered in the current working directory,
 * and so cannot be trusted to supply shell commands. Loads the config first,
 * since the source is only known once discovery has run.
 */
export function isConfigFromWorkingDirectory(configPath?: string): boolean {
    try {
        loadConfigFile(configPath);
    } catch {
        return false;
    }
    return isUntrustedSource(cachedConfigSource);
}

/**
 * Whether a config source is one the user did not deliberately choose, and so
 * must not be allowed to supply shell commands.
 */
export function isUntrustedSource(source: ConfigSource | null): boolean {
    return source !== null && UNTRUSTED_CONFIG_SOURCES.includes(source);
}

/**
 * Refuse to run a config-supplied shell command that came from the current
 * working directory. Otherwise cloning a repository containing a hostile
 * `.sherlock.json` and running any sherlock command would execute it.
 */
function assertTunnelAllowed(connectionName: string): void {
    if (isUntrustedSource(cachedConfigSource)) {
        throw new SherlockError(
            'CONFIG_UNTRUSTED',
            `Connection "${connectionName}" defines a tunnel, but the config was loaded from ` +
            `${describeConfigSource(cachedConfigSource!)}. ` +
            `A tunnel runs a command on this machine or uses your platform login, so it is only ` +
            `honoured from a config you opted into explicitly: your user config directory, a ` +
            `config next to the binary, --config, or SHERLOCK_CONFIG.`,
            {
                fix: `If you trust this file, re-run with --config ${cachedConfigPath ?? '<path>'}`,
                details: { path: cachedConfigPath },
            }
        );
    }
}

/**
 * Start the connection's tunnel if it has one, and redirect the URL through it.
 */
async function applyTunnel(
    connectionName: string,
    config: ConnectionConfig,
    resolved: ResolvedConnectionConfig,
    configPath: string | undefined,
    warnings: WarningSink
): Promise<ResolvedConnectionConfig> {
    if (!config.tunnel) return resolved;

    if (resolved.type === DB_TYPES.SQLITE) {
        throw new SherlockError('CONFIG_INVALID', `Connection "${connectionName}": SQLite is a local file and cannot use a tunnel.`, {
            fix: 'Remove "tunnel" from the connection.',
            details: { connection: connectionName, setting: 'tunnel' },
        });
    }

    assertTunnelAllowed(connectionName);

    // Certificate verification checks the hostname, which after tunnelling is a
    // loopback address rather than the database's real name, so it never matches.
    if (normalizeSsl(config.ssl).verify) {
        warnings.add(tlsVerifyThroughTunnelWarning(connectionName));
    }

    const { host, port } = await ensureTunnel(connectionName, config.tunnel, configPath);
    return {
        ...resolved,
        url: rewriteUrlEndpoint(resolved.url, host, port),
        tunnelled: true,
        tunnelProvider: resolveTunnel(connectionName, config.tunnel).providerId,
    };
}

/**
 * Resolve a connection config to a fully resolved config with connection URL,
 * starting the connection's tunnel first if it has one.
 */
export async function resolveConnection(
    connectionName: string,
    configPath?: string,
    warnings: WarningSink = stderrWarnings
): Promise<ResolvedConnectionConfig> {
    const config = getConnectionConfig(connectionName, configPath, warnings);
    const resolved = await buildResolvedConnection(connectionName, config, warnings);
    resolved.connectionName = connectionName;
    if (config.statementTimeout !== undefined) {
        resolved.statementTimeoutMs = resolveDurationSetting(connectionName, 'statementTimeout', config.statementTimeout);
    }
    if (config.connectTimeout !== undefined) {
        resolved.connectTimeoutMs = resolveDurationSetting(connectionName, 'connectTimeout', config.connectTimeout);
    }
    return applyTunnel(connectionName, config, resolved, configPath, warnings);
}

/**
 * Resolve a connection's credentials into a connection URL without starting
 * its tunnel, so `doctor` can check credentials on their own. The URL holds
 * the password: never print it.
 */
export async function resolveConnectionCredentials(
    connectionName: string,
    configPath?: string,
    warnings: WarningSink = stderrWarnings
): Promise<ResolvedConnectionConfig> {
    return buildResolvedConnection(connectionName, getConnectionConfig(connectionName, configPath, warnings), warnings);
}

/**
 * Parse a duration setting into whole milliseconds, naming the connection and
 * the setting when it is malformed.
 */
export function resolveDurationSetting(connectionName: string, setting: string, value: string): number {
    try {
        return Math.round(parseDuration(value));
    } catch (error) {
        throw new SherlockError(
            'CONFIG_INVALID',
            `Invalid "${setting}" for connection "${connectionName}": ${errorMessage(error)}`,
            { fix: `Give "${setting}" as a duration such as 30s or 5m.`, details: { connection: connectionName, setting } }
        );
    }
}

/**
 * A credential resolver for one connection, whose failures say which setting
 * could not be resolved.
 */
function credentialsFor(connectionName: string, directory: string | undefined) {
    const resolver = getCredentialResolver();
    // A connection that names its project reads $env references from the
    // project's .env first: see ./env-file.
    const context = { projectEnv: projectEnv(directory) };
    return {
        async resolveValue(setting: string, value: string | CredentialRef | undefined): Promise<string | undefined> {
            try {
                return await resolver.resolveValue(value, context);
            } catch (error) {
                if (isSherlockError(error) && error.code !== 'CREDENTIAL_MISSING') throw error;
                throw new SherlockError(
                    'CREDENTIAL_MISSING',
                    `The ${setting} of connection "${connectionName}" could not be resolved: ${errorMessage(error)}`,
                    {
                        fix: isSherlockError(error) ? error.fix : undefined,
                        details: { ...(isSherlockError(error) ? error.details : {}), setting },
                        cause: error,
                    }
                );
            }
        },
    };
}

/**
 * Build the connection URL from a connection config, resolving credentials.
 */
async function buildResolvedConnection(
    connectionName: string,
    config: ConnectionConfig,
    warnings: WarningSink
): Promise<ResolvedConnectionConfig> {
    const resolver = credentialsFor(connectionName, config.directory);

    // Check for connection URL first
    if (config.url) {
        const rawUrl = await resolver.resolveValue('url', config.url);
        if (!rawUrl) {
            throw new SherlockError('CREDENTIAL_MISSING', `The URL of connection "${connectionName}" resolved to an empty value.`, {
                fix: 'Set the variable or keychain entry it names to the connection URL.',
                details: { setting: 'url' },
            });
        }

        // Auto-detect type from URL
        const type = detectDbTypeFromUrl(rawUrl) ?? config.type ?? DB_TYPES.POSTGRES;
        // If the user set `ssl` alongside `url`, apply it to the URL.
        const sslUrl = applySslToUrl(rawUrl, type, config.ssl);
        const url = applyPublicKeyRetrievalToUrl(sslUrl, type, config.allowPublicKeyRetrieval);

        return { type, url };
    }

    // Handle Redis
    if (config.type === DB_TYPES.REDIS) {
        const host = (await resolver.resolveValue('host', config.host)) ??
            getEnvVarForConnection(connectionName, 'HOST') ?? 'localhost';
        const password = (await resolver.resolveValue('password', config.password)) ??
            getEnvVarForConnection(connectionName, 'PASSWORD');
        const port = config.port || DEFAULT_PORTS[DB_TYPES.REDIS];
        const database = config.database || '0';
        const ssl = normalizeSsl(config.ssl);
        const protocol = ssl.enabled ? 'rediss' : 'redis';
        const formattedHost = formatHostForUrl(host);

        let url: string;
        if (password) {
            url = `${protocol}://:${encodeURIComponent(password)}@${formattedHost}:${port}/${database}`;
        } else {
            url = `${protocol}://${formattedHost}:${port}/${database}`;
        }

        return { type: DB_TYPES.REDIS, url };
    }

    // Handle SQLite
    if (config.type === DB_TYPES.SQLITE) {
        const filename = config.filename || config.path || config.database || ':memory:';
        // A file:// URL, which the SQLite driver reads the path from
        let url = filename;
        if (filename !== ':memory:' && !filename.startsWith('file:')) {
            url = `file://${filename}`;
        }
        return {
            type: DB_TYPES.SQLITE,
            url,
        };
    }

    // Build URL from individual parameters
    const type = config.type || DB_TYPES.POSTGRES;

    // Warn if password is stored as plaintext in config (but not for empty passwords)
    if (config.password && typeof config.password === 'string' && config.password.length > 0) {
        warnings.add({
            code: 'PLAINTEXT_PASSWORD',
            message: `The password of connection "${connectionName}" is stored as plaintext in the config.`,
            fix: `Use { "$env": "${connectionEnvVarName(connectionName, 'PASSWORD')}" }, or store it in the ` +
                `keychain with: sherlock manage`,
            details: { connection: connectionName },
        });
    }

    // Try environment variable auto-detection first
    // Use ?? instead of || to allow empty string values (e.g., empty passwords)
    const host =
        (await resolver.resolveValue('host', config.host)) ??
        getEnvVarForConnection(connectionName, 'HOST');
    const username =
        (await resolver.resolveValue('username', config.username)) ??
        getEnvVarForConnection(connectionName, 'USERNAME') ??
        getEnvVarForConnection(connectionName, 'USER');
    // Password defaults to empty string - many local DBs use trust/peer auth
    const password =
        (await resolver.resolveValue('password', config.password)) ??
        getEnvVarForConnection(connectionName, 'PASSWORD') ??
        '';
    const database = config.database ?? getEnvVarForConnection(connectionName, 'DATABASE');
    const port = config.port;

    // Check for missing required params - use == null to allow empty strings
    if (host == null || username == null || database == null) {
        const missing: string[] = [];
        if (host == null) missing.push('host');
        if (username == null) missing.push('username');
        if (database == null) missing.push('database');

        throw new SherlockError(
            'CONFIG_INVALID',
            `Missing required connection parameters for "${connectionName}": ${missing.join(', ')}.`,
            {
                fix: `Provide them in the config file, or set the environment variables ` +
                    `${missing.map(f => connectionEnvVarName(connectionName, f)).join(', ')}.`,
                details: { connection: connectionName, setting: missing[0] },
            }
        );
    }

    const url = applyPublicKeyRetrievalToUrl(
        buildConnectionUrl(type, host, port, username, password, database, config.ssl),
        type,
        config.allowPublicKeyRetrieval
    );

    return { type, url };
}

/**
 * Auto-detect a connection based on the current working directory.
 * If cwd is inside a connection's configured `directory`, returns that connection name.
 * If multiple connections match, picks the most specific (longest path).
 * Returns null if no match found.
 */
export function detectConnectionFromCwd(configPath?: string): string | null {
    let config: SherlockConfig;
    try {
        config = loadConfigFile(configPath);
    } catch {
        return null;
    }

    // Both through symlinks, so a directory saved as /tmp/x matches /private/tmp/x
    const cwd = realDirectory(process.cwd());
    let bestMatch: string | null = null;
    let bestLength = 0;

    for (const [name, conn] of Object.entries(config.connections)) {
        if (!conn.directory) continue;

        const resolved = realDirectory(conn.directory);
        // Check if cwd is the directory itself or a subdirectory
        if (cwd === resolved || cwd.startsWith(resolved + path.sep)) {
            if (resolved.length > bestLength) {
                bestMatch = name;
                bestLength = resolved.length;
            }
        }
    }

    return bestMatch;
}

/**
 * Order connection names for display. Config files list connections in the
 * order they were added, which is meaningless to anyone reading a long list.
 */
export function sortConnectionNames(names: string[]): string[] {
    return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * List all available connections, sorted alphabetically
 */
export function listConnections(configPath?: string): string[] {
    const config = loadConfigFile(configPath);
    return sortConnectionNames(Object.keys(config.connections));
}

/**
 * A tunnel, as every command reports it. `kind` says whether a provider opens
 * it or a shell command does; a command recognised as a platform's CLI keeps
 * kind "command" and has that platform's target in `details`.
 */
export interface TunnelSummary {
    kind: 'provider' | 'command';
    /** The provider id, or "command" */
    provider: string;
    /** One line, e.g. "my-project/postgresql (read)" */
    target: string;
    details: Record<string, string>;
}

/** Summarise a tunnel block. Throws when it is invalid. */
export function summarizeTunnel(connectionName: string, tunnel: TunnelConfig): TunnelSummary {
    const resolved = resolveTunnel(connectionName, tunnel);
    const { target } = resolved.inspect();
    return {
        kind: resolved.providerId === 'command' ? 'command' : 'provider',
        provider: resolved.providerId,
        target: target.summary,
        details: target.details,
    };
}

/**
 * Where a connection points, for `sherlock connections`. Never includes a
 * secret: a URL is reduced to its host, and a credential reference is named
 * rather than resolved.
 */
export interface ConnectionSummary {
    name: string;
    type: DbType;
    /** The database's host, file, or where those are read from */
    target: string;
    /** The tunnel, when the connection has one */
    tunnel?: TunnelSummary;
    /** Set when the connection's config cannot be read as it is */
    problem?: string;
}

/** Name a credential reference without resolving it */
function describeReference(value: CredentialRef): string {
    if (typeof value === 'string') return value;
    if ('$env' in value) return `$env:${value.$env}`;
    const ref = value.$keychain;
    return typeof ref === 'string' ? `$keychain:${ref}` : `$keychain:${ref.service ?? 'sherlock'}/${ref.account}`;
}

/** The host and port of a literal URL, dropping everything that could be secret */
function urlTarget(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.protocol === 'file:' || parsed.protocol === 'sqlite:') {
            return parsed.pathname || url;
        }
        return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    } catch {
        return 'unparseable url';
    }
}

/** Summarise one connection without resolving credentials or starting a tunnel */
export function summarizeConnection(name: string, config: ConnectionConfig): ConnectionSummary {
    const urlType = typeof config.url === 'string' ? detectDbTypeFromUrl(config.url) : null;
    const type = urlType ?? config.type ?? DB_TYPES.POSTGRES;

    let target: string;
    if (type === DB_TYPES.SQLITE && config.url === undefined) {
        target = config.filename ?? config.path ?? config.database ?? ':memory:';
    } else if (config.url !== undefined) {
        target = typeof config.url === 'string' ? urlTarget(config.url) : `url from ${describeReference(config.url)}`;
    } else {
        const host = config.host === undefined
            ? `$env:${connectionEnvVarName(name, 'HOST')}`
            : typeof config.host === 'string' ? config.host : describeReference(config.host);
        target = config.port ? `${host}:${config.port}` : host;
    }
    if (config.database && type !== DB_TYPES.SQLITE && config.url === undefined) target += `/${config.database}`;

    const summary: ConnectionSummary = { name, type, target };

    if (config.tunnel) {
        try {
            summary.tunnel = summarizeTunnel(name, config.tunnel);
        } catch (error) {
            summary.problem = error instanceof Error ? error.message : String(error);
        }
    }

    return summary;
}

/** Summaries of every connection, sorted by name */
export function listConnectionSummaries(configPath?: string): ConnectionSummary[] {
    const config = loadConfigFile(configPath);
    return sortConnectionNames(Object.keys(config.connections))
        .map((name) => summarizeConnection(name, config.connections[name]));
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache(): void {
    cachedConfig = null;
    cachedConfigPath = null;
    cachedConfigSource = null;
}

/**
 * Full certificate verification cannot work through a tunnel: the certificate
 * names the database's real host, and the connection goes to a loopback address.
 */
export function tlsVerifyThroughTunnelWarning(connectionName: string): SherlockWarning {
    return {
        code: 'TLS_VERIFY_THROUGH_TUNNEL',
        message:
            `Connection "${connectionName}" goes through a tunnel but asks for full certificate ` +
            `verification. The server's certificate names its real host, not the tunnel's local address, ` +
            `so it will not match.`,
        fix: 'Use "ssl": true (--ssl require) to encrypt without verifying the host name.',
        details: { connection: connectionName },
    };
}
