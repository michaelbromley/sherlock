/**
 * Every error and warning code sherlock reports, with what it means and the
 * `details` keys it carries.
 *
 * This table is part of the output contract: codes are never renamed or reused
 * within a major version, and their `details` keys are listed here. `sherlock
 * guide` is generated from it, so the documentation cannot drift from the code.
 */

export interface CodeInfo {
    /** What the code means, in one sentence */
    meaning: string;
    /** The keys a caller may find in `details` */
    details: readonly string[];
}

export const ERROR_CODES = {
    USAGE: {
        meaning:
            'A flag or argument is missing, unknown or malformed, or a command that needs a terminal ' +
            'or --yes ran without one. Exits 2.',
        details: ['flag'],
    },
    CONNECTION_REQUIRED: {
        meaning: 'No -c, -u or connection matching the current directory.',
        details: [],
    },
    CONNECTION_NOT_FOUND: {
        meaning: '-c names a connection that is not configured.',
        details: ['connection', 'available'],
    },
    WRONG_DATABASE_TYPE: {
        meaning: 'A SQL command on a Redis connection, or a Redis command on a SQL connection.',
        details: ['dbType', 'expected'],
    },
    CONFIG_NOT_FOUND: {
        meaning: 'No config file anywhere sherlock looks.',
        details: ['searched'],
    },
    CONFIG_INVALID: {
        meaning: 'The config, or a connection in it, is malformed, including a bad tunnel block or duration.',
        details: ['connection', 'setting'],
    },
    CONFIG_UNTRUSTED: {
        meaning: 'A connection with a tunnel, in a config loaded from the current directory.',
        details: ['path'],
    },
    CREDENTIAL_MISSING: {
        meaning: 'A password or URL reference does not resolve.',
        details: ['setting', 'source'],
    },
    TUNNEL_FAILED: {
        meaning: 'The tunnel did not come up.',
        details: ['provider', 'logFile'],
    },
    TUNNEL_DOWN: {
        meaning: 'The tunnel is up locally, but its far end is gone.',
        details: ['provider', 'host', 'port'],
    },
    PROVIDER_AUTH: {
        meaning: 'The tunnel provider rejected the login.',
        details: ['provider', 'context'],
    },
    PROVIDER_NOT_FOUND: {
        meaning: "The login cannot see the provider's target.",
        details: ['provider', 'target'],
    },
    CONNECT_REFUSED: {
        meaning: 'Nothing answered at the host and port, or the host does not resolve.',
        details: ['host', 'port'],
    },
    CONNECT_TIMEOUT: {
        meaning: 'The database did not answer within connectTimeout.',
        details: ['host', 'port', 'timeoutMs'],
    },
    TLS_FAILED: {
        meaning: 'TLS could not be set up, or the server does not offer it.',
        details: ['reason'],
    },
    AUTH_FAILED: {
        meaning: 'The database rejected the username or password.',
        details: ['username'],
    },
    QUERY_REFUSED: {
        meaning: "Sherlock's read-only check refused the query before sending it.",
        details: ['reason', 'keyword'],
    },
    READ_ONLY_VIOLATION: {
        meaning: 'The database refused a write inside the read-only transaction.',
        details: ['dbCode'],
    },
    QUERY_FAILED: {
        meaning: 'The database rejected the query: syntax, an unknown column, permissions.',
        details: ['dbCode'],
    },
    QUERY_TIMEOUT: {
        meaning: 'The statement ran longer than statementTimeout.',
        details: ['timeoutMs'],
    },
    NOT_FOUND: {
        meaning: 'A table, Redis key, keychain entry or tunnel that the command names does not exist.',
        details: ['kind', 'name'],
    },
    UPDATE_FAILED: {
        meaning: 'sherlock update could not check for, download or install a new version.',
        details: ['reason'],
    },
    KEYCHAIN_UNAVAILABLE: {
        meaning: 'The OS keychain cannot be read or written.',
        details: [],
    },
    INTERNAL: {
        meaning: 'Anything not covered above. A bug if it appears for a predictable case.',
        details: [],
    },
} as const satisfies Record<string, CodeInfo>;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Why the read-only check refused a query, in `details.reason` of QUERY_REFUSED */
export type QueryRefusedReason = 'NOT_READ_ONLY' | 'MULTIPLE_STATEMENTS' | 'KEYWORD' | 'UNPARSEABLE';

export const WARNING_CODES = {
    RESULT_TRUNCATED: {
        meaning: 'Rows, cells or bytes were cut by a cap.',
        details: ['rowsReturned', 'moreRows', 'cellsCut', 'bytesLimit'],
    },
    PLAINTEXT_PASSWORD: {
        meaning: "The connection's password is written in config.json.",
        details: ['connection'],
    },
    CONFIG_SHADOWED: {
        meaning: 'A command wrote the user config, but commands run here read a different file.',
        details: ['written', 'read'],
    },
    CONFIG_LEGACY: {
        meaning: 'The config was read from a legacy config.ts file.',
        details: ['path'],
    },
    NO_PASSWORD: {
        meaning: 'connection add stored a connection with no password.',
        details: ['connection'],
    },
    TLS_VERIFY_THROUGH_TUNNEL: {
        meaning: 'Full certificate verification is set on a tunnelled connection.',
        details: ['connection'],
    },
    SCHEMA_CACHE_STALE: {
        meaning: 'introspect answered from a cache more than 24 hours old.',
        details: ['cachedAt'],
    },
    FETCHED_ALL_ROWS: {
        meaning: 'The driver cannot stop early, so every row was fetched and then cut.',
        details: ['rowsFetched'],
    },
} as const satisfies Record<string, CodeInfo>;

export type WarningCode = keyof typeof WARNING_CODES;
