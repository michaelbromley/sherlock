/**
 * Turn whatever a database driver throws into a SherlockError with a code.
 *
 * The drivers report causes as codes, not just messages: SQLSTATE on
 * PostgreSQL (`errno`), `errno` and `sqlState` on MySQL, `SQLITE_*` codes on
 * SQLite, and `code` plus a server `number` from mssql. Classification uses
 * those, so a reworded driver message cannot change a code.
 */

import type { ResolvedConnectionConfig } from '../config/types';
import { SherlockError, isSherlockError } from '../errors';
import { DB_TYPES } from '../db-types';
import { explainConnectFailure } from './connect-timeout';
import { explainMultipleStatements, explainTimeout } from './read-only';

/** The fields drivers put their codes in */
interface DriverError {
    name?: unknown;
    code?: unknown;
    errno?: unknown;
    sqlState?: unknown;
    number?: unknown;
    message?: unknown;
}

/** Errors the drivers raise for a statement the database rejected */
const DRIVER_ERROR_NAMES = new Set(['PostgresError', 'MySQLError', 'SQLiteError', 'RequestError']);

/** Certificate failures, as Node and Bun name them */
const CERTIFICATE_CODES = new Set([
    'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'UNABLE_TO_GET_ISSUER_CERT',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'CERT_HAS_EXPIRED',
    'CERT_NOT_YET_VALID',
    'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/** The database's own code for an error: SQLSTATE, MySQL errno or SQL Server number */
function dbCodeOf(error: DriverError): string | number | undefined {
    if (typeof error.errno === 'string') return error.errno; // PostgreSQL SQLSTATE
    if (typeof error.code === 'string' && error.code.startsWith('SQLITE_')) return error.code;
    if (typeof error.errno === 'number') return error.errno; // MySQL
    if (typeof error.number === 'number') return error.number; // SQL Server
    if (typeof error.sqlState === 'string') return error.sqlState;
    return undefined;
}

/** The username in a connection URL, never its password */
function usernameOf(url: string): string | undefined {
    try {
        const name = decodeURIComponent(new URL(url).username);
        return name || undefined;
    } catch {
        return undefined;
    }
}

function isAuthFailure(error: DriverError, message: string): boolean {
    return error.errno === '28P01' || error.errno === '28000' || // PostgreSQL
        error.errno === 1045 || error.sqlState === '28000' || // MySQL
        error.code === 'ELOGIN' || // SQL Server
        /^(WRONGPASS|NOAUTH)\b/.test(message); // Redis
}

/** Why TLS failed, when it did: a driver or certificate code, or null */
function tlsFailure(error: DriverError, message: string): string | null {
    const code = typeof error.code === 'string' ? error.code : '';
    if (CERTIFICATE_CODES.has(code)) return code;
    if (/^ERR_(POSTGRES|MYSQL|REDIS)_\w*(TLS|SSL)\w*$/.test(code)) return code;
    if (/server does not support ssl|ssl is not enabled on the server|certificate|tls handshake|ssl routines/i.test(message)) {
        return code || 'TLS';
    }
    return null;
}

function isReadOnlyViolation(error: DriverError): boolean {
    return error.errno === '25006' || error.sqlState === '25006' || // PostgreSQL, MySQL
        error.errno === 1792 || // MySQL: statement in a READ ONLY transaction
        error.code === 'SQLITE_READONLY';
}

/**
 * Classify an error from opening a connection or running a statement on it.
 * `timeoutMs` is the statement timeout, for an error that says the statement
 * was cancelled. An error that is already classified is returned as it is.
 */
export function classifyDbError(error: unknown, config: ResolvedConnectionConfig, timeoutMs?: number): SherlockError | unknown {
    if (isSherlockError(error)) return error;

    const connect = explainConnectFailure(error, config);
    if (connect !== error) return connect;
    if (timeoutMs !== undefined) {
        const timedOut = explainTimeout(error, timeoutMs);
        if (timedOut !== error) return timedOut;
    }
    const multiple = explainMultipleStatements(error);
    if (multiple !== error) return multiple;

    const driver = (error ?? {}) as DriverError;
    const message = error instanceof Error ? error.message : String(error);

    if (driver.code === 'ERR_MYSQL_PUBLIC_KEY_RETRIEVAL_NOT_ALLOWED') {
        return new SherlockError(
            'TLS_FAILED',
            "MySQL needs TLS or the server's RSA public key to log in this user (caching_sha2_password).",
            {
                fix:
                    'Set "ssl": true on the connection, or add ?ssl-mode=REQUIRED to the URL. ' +
                    'If the server does not support TLS and you trust the network between you and the ' +
                    'server (localhost, an SSH tunnel), set "allowPublicKeyRetrieval": true, or add ' +
                    '?allowPublicKeyRetrieval=true to the URL. Without TLS, anyone who can intercept the ' +
                    'connection can substitute their own key and read the password.',
                details: { reason: 'PUBLIC_KEY_RETRIEVAL' },
                cause: error,
            }
        );
    }

    if (isAuthFailure(driver, message)) {
        const username = usernameOf(config.url);
        const name = config.connectionName;
        return new SherlockError('AUTH_FAILED', message, {
            fix: name
                ? `Check the username and password of "${name}". See where its password comes from with: sherlock keychain list`
                : 'Check the username and password in the URL.',
            details: username ? { username } : undefined,
            cause: error,
        });
    }

    const tls = tlsFailure(driver, message);
    if (tls !== null) {
        return new SherlockError('TLS_FAILED', message, {
            fix:
                'If the server does not offer TLS, turn "ssl" off on the connection. ' +
                'If its certificate cannot be verified, use "ssl": true to encrypt without verifying it.',
            details: { reason: tls },
            cause: error,
        });
    }

    // Bun's Redis client throws plain errors; the server's own start with an
    // upper-case prefix such as WRONGTYPE or ERR.
    const redisPrefix = config.type === DB_TYPES.REDIS ? /^([A-Z][A-Z_]+)\b/.exec(message)?.[1] : undefined;
    const dbCode = redisPrefix ?? dbCodeOf(driver);

    if (isReadOnlyViolation(driver)) {
        return new SherlockError('READ_ONLY_VIOLATION', message, {
            fix: 'Sherlock runs every statement read-only. Rewrite the query so it does not write.',
            details: dbCode !== undefined ? { dbCode } : undefined,
            cause: error,
        });
    }

    if (DRIVER_ERROR_NAMES.has(String(driver.name)) || dbCode !== undefined) {
        return new SherlockError('QUERY_FAILED', message, {
            fix: config.type === DB_TYPES.REDIS
                ? 'Check the key and its type with: sherlock inspect <key>'
                : 'Fix the query. Check table and column names with: sherlock describe <table>',
            details: dbCode !== undefined ? { dbCode } : undefined,
            cause: error,
        });
    }

    return error;
}
