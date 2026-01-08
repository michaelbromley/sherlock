import * as fs from 'fs';
import * as path from 'path';
import { findConfigFile, getConfigDir, getEnvFilePath } from './paths';
import { getCredentialResolver } from '../credentials';
import type { SherlockConfig, ConnectionConfig, ResolvedConnectionConfig, CredentialRef } from './types';
import { getEnvVarForConnection } from '../credentials/providers/env';

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
            type: opts.type === 'better-sqlite3' ? 'sqlite' : opts.type,
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
 * Build a connection URL from individual config parameters
 */
function buildConnectionUrl(
    type: string,
    host: string,
    port: number | undefined,
    username: string,
    password: string,
    database: string
): string {
    const encodedPassword = encodeURIComponent(password);
    const encodedUsername = encodeURIComponent(username);

    if (type === 'postgres') {
        return `postgres://${encodedUsername}:${encodedPassword}@${host}:${port || 5432}/${database}`;
    } else if (type === 'mysql') {
        return `mysql://${encodedUsername}:${encodedPassword}@${host}:${port || 3306}/${database}`;
    }

    throw new Error(`Unsupported database type: ${type}`);
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
        const url = await resolver.resolveValue(config.url);
        if (!url) {
            throw new Error('Connection URL resolved to empty value');
        }

        // Auto-detect type from URL
        let type: 'postgres' | 'mysql' | 'sqlite';
        if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
            type = 'postgres';
        } else if (url.startsWith('mysql://')) {
            type = 'mysql';
        } else if (url.startsWith('sqlite://') || url.startsWith('file://') || url === ':memory:') {
            type = 'sqlite';
        } else {
            type = config.type || 'postgres';
        }

        return { type, url };
    }

    // Handle SQLite
    if (config.type === 'sqlite') {
        const filename = config.filename || config.database || ':memory:';
        return {
            type: 'sqlite',
            url: filename,
        };
    }

    // Build URL from individual parameters
    const type = config.type || 'postgres';

    // Warn if password is stored as plaintext in config
    if (config.password && typeof config.password === 'string') {
        console.warn(
            '\x1b[33m[sherlock] Warning: Password for connection "' + connectionName + '" is stored as plaintext.\n' +
            '  Consider using { "$env": "SHERLOCK_' + connectionName.toUpperCase() + '_PASSWORD" } for better security.\x1b[0m'
        );
    }

    // Try environment variable auto-detection first
    const host =
        (await resolver.resolveValue(config.host)) ||
        getEnvVarForConnection(connectionName, 'HOST');
    const username =
        (await resolver.resolveValue(config.username)) ||
        getEnvVarForConnection(connectionName, 'USERNAME') ||
        getEnvVarForConnection(connectionName, 'USER');
    const password =
        (await resolver.resolveValue(config.password)) ||
        getEnvVarForConnection(connectionName, 'PASSWORD');
    const database = config.database || getEnvVarForConnection(connectionName, 'DATABASE');
    const port = config.port;

    if (!host || !username || !password || !database) {
        const missing: string[] = [];
        if (!host) missing.push('host');
        if (!username) missing.push('username');
        if (!password) missing.push('password');
        if (!database) missing.push('database');

        throw new Error(
            `Missing required connection parameters for "${connectionName}": ${missing.join(', ')}\n\n` +
            `Either provide them in the config file, or set environment variables:\n` +
            missing.map(f => `  SHERLOCK_${connectionName.toUpperCase()}_${f.toUpperCase()}`).join('\n')
        );
    }

    const url = buildConnectionUrl(type, host, port, username, password, database);

    return {
        type: type as 'postgres' | 'mysql' | 'sqlite',
        url,
    };
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
