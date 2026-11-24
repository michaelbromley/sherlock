import type { DbType } from '../db-types';
import type { TunnelConfig } from '../tunnel/types';

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

    /** The project's directory: `--url-env` reads its .env, and `agents-md` names this connection there. Never selects the connection. */
    directory?: string;

    /** Enable query logging for this connection (default: false) */
    logging?: boolean;

    /**
     * Longest a single statement may run before the database cancels it, as a
     * duration such as "60s" or "5m". Default "60s". `query --timeout`
     * overrides it for one query.
     */
    statementTimeout?: string;

    /**
     * Longest to wait for the database to answer when connecting, as a
     * duration such as "10s". Default "10s". A tunnel whose far end is gone
     * still accepts connections locally, so this is what makes it fail fast.
     */
    connectTimeout?: string;

    /** Most rows a result returns, unless a command says otherwise. Default 200. */
    maxRows?: number;

    /** Most characters of a text cell in a result. Default 500. */
    maxCellChars?: number;

    /** Most bytes of a whole result, as compact JSON. Default 32768 (about 8,000 tokens). */
    maxBytes?: number;

    /**
     * Port-forwarding process to run before connecting, for databases that are
     * only reachable through a tunnel. When set, the connection's host and port
     * are replaced with the tunnel's local endpoint.
     *
     * Because this executes a shell command, it is honoured only from a config
     * the user chose deliberately — never from a project-local `.sherlock.json`
     * picked up out of the current directory.
     */
    tunnel?: TunnelConfig;

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

    /**
     * MySQL only. Let the client fetch the server's RSA public key to send the
     * password over an unencrypted connection. MySQL 8's default
     * `caching_sha2_password` plugin needs either this or `ssl` to log in.
     *
     * Prefer `ssl`: without TLS, anyone in the network path can hand the client
     * their own key and read the password. Default: false.
     */
    allowPublicKeyRetrieval?: boolean;
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
    /** The connection's `statementTimeout`, when it sets one */
    statementTimeoutMs?: number;
    /** The connection's `connectTimeout`, when it sets one */
    connectTimeoutMs?: number;
    /** Name of the configured connection, for error messages. Unset for --url. */
    connectionName?: string;
    /** True when the URL points at a tunnel rather than the database itself */
    tunnelled?: boolean;
    /** The tunnel's provider, e.g. "northflank" or "command", when tunnelled */
    tunnelProvider?: string;
    /** Set by doctor, so errors do not suggest running doctor */
    diagnosing?: boolean;
}
