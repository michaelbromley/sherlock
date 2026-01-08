import type { DbType } from '../db-types';

/**
 * Credential reference types for secure credential resolution
 */
export type CredentialRef =
    | { $env: string }
    | { $keychain: string | { service?: string; account: string } }
    | string; // Literal value (will warn user)

/**
 * Database connection configuration
 */
export interface ConnectionConfig {
    /** Database type - auto-detected from connection string if using url */
    type?: DbType;

    /** Connection URL (preferred) - e.g., postgres://user:pass@host:port/db */
    url?: string | CredentialRef;

    /** Individual connection parameters (alternative to url) */
    host?: string | CredentialRef;
    port?: number;
    username?: string | CredentialRef;
    password?: string | CredentialRef;
    database?: string;

    /** Path to SQLite database file (for sqlite type) */
    filename?: string;
    /** Alias for filename (for sqlite type) */
    path?: string;

    /** Enable query logging for this connection (default: false) */
    logging?: boolean;
}

/**
 * Main configuration file structure
 */
export interface SherlockConfig {
    version?: string;
    connections: Record<string, ConnectionConfig>;
}

/**
 * Resolved connection config with all credentials resolved to actual values
 */
export interface ResolvedConnectionConfig {
    type: DbType;
    url: string;
}
