import * as fs from 'fs';
import * as path from 'path';
import { findConfigFile, getConfigDir, getEnvFilePath } from './paths';
import { getCredentialResolver } from '../credentials';
import type { SherlockConfig, ConnectionConfig, ResolvedConnectionConfig, CredentialRef, SslConfig } from './types';
import { getEnvVarForConnection } from '../credentials/providers/env';
import { DB_TYPES, DEFAULT_PORTS, detectDbTypeFromUrl, parseBoolParam, type DbType } from '../db-types';

let cachedConfig: SherlockConfig | null = null;
let cachedConfigPath: string | null = null;
let envLoaded = false;

/**
 * Load environment variables from the Sherlock config directory's .env file
 */
function loadEnvFile(): void {
    if (envLoaded) return;
    envLoaded = true;

    const envPath = getEnvFilePath();
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        // Only set if not already set in environment
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

/**
 * Load the Sherlock configuration from file
 */
export function loadConfigFile(configPath?: string): SherlockConfig {
    // Load .env file from config directory
    loadEnvFile();

    const resolvedPath = findConfigFile(configPath);

    if (!resolvedPath) {
        throw new Error(
            `No configuration file found.\n\n` +
            `Run 'sherlock init' to create one, or create a config file at:\n` +
            `  - ./.sherlock.json (project-local)\n` +
            `  - ${path.join(getConfigDir(), 'config.json')} (user config)\n\n` +
            `Or set SHERLOCK_CONFIG environment variable to your config file path.`
        );
    }

    // Check if it's a legacy TypeScript config
    if (resolvedPath.endsWith('.ts')) {
        return loadLegacyConfig(resolvedPath);
    }

    // Use cached config if available
    if (cachedConfig && cachedConfigPath === resolvedPath) {
        return cachedConfig;
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const config = JSON.parse(content) as SherlockConfig;

    cachedConfig = config;
    cachedConfigPath = resolvedPath;

    return config;
}

/**
 * Load legacy TypeScript config file (for backwards compatibility)
 */
function loadLegacyConfig(configPath: string): SherlockConfig {
    console.warn(
        '\x1b[33m[sherlock] Warning: Using legacy config.ts format.\n' +
        "Run 'sherlock migrate' to convert to the new JSON format.\x1b[0m\n"
    );

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
    configPath?: string
): ConnectionConfig {
    const config = loadConfigFile(configPath);

    if (!config.connections[connectionName]) {
        const available = Object.keys(config.connections).join(', ');
        throw new Error(
            `Connection "${connectionName}" not found in config.\n\n` +
            `Available connections: ${available}`
        );
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

    throw new Error(`Unsupported database type: ${type}`);
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
 * Resolve a connection config to a fully resolved config with connection URL
 */
export async function resolveConnection(
    connectionName: string,
    configPath?: string
): Promise<ResolvedConnectionConfig> {
    const config = getConnectionConfig(connectionName, configPath);
    const resolver = getCredentialResolver();

    // Check for connection URL first
    if (config.url) {
        const rawUrl = await resolver.resolveValue(config.url);
        if (!rawUrl) {
            throw new Error('Connection URL resolved to empty value');
        }

        // Auto-detect type from URL
        const type = detectDbTypeFromUrl(rawUrl) ?? config.type ?? DB_TYPES.POSTGRES;
        // If the user set `ssl` alongside `url`, apply it to the URL.
        const url = applySslToUrl(rawUrl, type, config.ssl);

        return { type, url };
    }

    // Handle Redis
    if (config.type === DB_TYPES.REDIS) {
        const host = (await resolver.resolveValue(config.host)) ??
            getEnvVarForConnection(connectionName, 'HOST') ?? 'localhost';
        const password = (await resolver.resolveValue(config.password)) ??
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
        // Bun.SQL requires file:// protocol for SQLite paths
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
        console.warn(
            '\x1b[33m[sherlock] Warning: Password for connection "' + connectionName + '" is stored as plaintext.\n' +
            '  Consider using { "$env": "SHERLOCK_' + connectionName.toUpperCase() + '_PASSWORD" } for better security.\x1b[0m'
        );
    }

    // Try environment variable auto-detection first
    // Use ?? instead of || to allow empty string values (e.g., empty passwords)
    const host =
        (await resolver.resolveValue(config.host)) ??
        getEnvVarForConnection(connectionName, 'HOST');
    const username =
        (await resolver.resolveValue(config.username)) ??
        getEnvVarForConnection(connectionName, 'USERNAME') ??
        getEnvVarForConnection(connectionName, 'USER');
    // Password defaults to empty string - many local DBs use trust/peer auth
    const password =
        (await resolver.resolveValue(config.password)) ??
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

        throw new Error(
            `Missing required connection parameters for "${connectionName}": ${missing.join(', ')}\n\n` +
            `Either provide them in the config file, or set environment variables:\n` +
            missing.map(f => `  SHERLOCK_${connectionName.toUpperCase()}_${f.toUpperCase()}`).join('\n')
        );
    }

    const url = buildConnectionUrl(type, host, port, username, password, database, config.ssl);

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

    const cwd = process.cwd();
    let bestMatch: string | null = null;
    let bestLength = 0;

    for (const [name, conn] of Object.entries(config.connections)) {
        if (!conn.directory) continue;

        const resolved = path.resolve(conn.directory);
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
 * List all available connections
 */
export function listConnections(configPath?: string): string[] {
    const config = loadConfigFile(configPath);
    return Object.keys(config.connections);
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache(): void {
    cachedConfig = null;
    cachedConfigPath = null;
}
