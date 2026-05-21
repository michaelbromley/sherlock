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

    /** Project directory - auto-selects this connection when cwd is inside this path */
    directory?: string;

    /** Enable query logging for this connection (default: false) */
    logging?: boolean;

    /**
     * SSL/TLS configuration.
     *
     * Note on `ssl: true` semantics: this means "encrypt the connection but
     * do NOT verify the server certificate". This is the common case for
     * managed databases (Northflank, Supabase, Neon, RDS) where the cert
     * chain isn't trusted by the system CA store but encryption is required.
     * It is NOT the same as "maximum SSL security" — use the object form with
     * `rejectUnauthorized: true` for full verification.
     *
     * Values:
     * - `false` or omitted: no SSL (default)
     * - `true`: require SSL, do not verify server certificate
     * - `{ rejectUnauthorized: true }`: require SSL and verify against system CAs
     */
    ssl?: boolean | SslConfig;
}

/**
 * SSL/TLS connection options. Intentionally minimal — currently only exposes
 * server-certificate verification. May grow to include `ca`, `cert`, `key`
 * file paths for mutual TLS in future.
 */
export interface SslConfig {
    /**
     * Whether to verify the server certificate against system CAs.
     * - `false` (default when ssl is enabled): encrypt only, do not verify
     * - `true`: full verification (postgres `verify-full`, mysql `VERIFY_IDENTITY`, mssql trustServerCertificate=false)
     */
    rejectUnauthorized?: boolean;
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
