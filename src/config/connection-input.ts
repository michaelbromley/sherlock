/**
 * Turning `sherlock connection add` flags into a connection config.
 *
 * Kept free of I/O so the flag combinations can be tested directly. Anything
 * that touches the keychain, the config file or the network happens in the
 * command itself.
 */

import type { ConnectionConfig, CredentialRef } from './types';
import { parseConnectionUrl } from './index';
import { DB_TYPES, isValidDbType, type DbType } from '../db-types';
import { resolveTunnel, tunnelProviderIds, tunnelShorthand } from '../tunnel/providers';
import type { TunnelConfig } from '../tunnel/types';

/** Flags accepted by `sherlock connection add`, before any validation */
export interface ConnectionAddOptions {
    fromUrl?: string;
    type?: string;
    host?: string;
    port?: string;
    username?: string;
    database?: string;
    ssl?: string;
    logging?: boolean;
    directory?: string;
    passwordEnv?: string;
    /** True when the password is being read from stdin and stored in the keychain */
    passwordStdin?: boolean;

    tunnelCommand?: string;
    tunnelLocalPort?: string;
    tunnelEndpointPattern?: string;
    tunnelNorthflank?: string;
    /** Id of a tunnel provider, with its settings given as --tunnel-option */
    tunnelProvider?: string;
    /** `key=value` settings for the tunnel provider */
    tunnelOption?: string[];
    tunnelIdleTimeout?: string;
    tunnelReadyTimeout?: string;
}

/** The three SSL settings, named as the flag accepts them */
const SSL_CHOICES = ['off', 'require', 'verify'] as const;
type SslChoice = typeof SSL_CHOICES[number];

function parseSsl(value: string | undefined): ConnectionConfig['ssl'] {
    if (value === undefined) return undefined;
    if (!SSL_CHOICES.includes(value as SslChoice)) {
        throw new Error(`Invalid --ssl "${value}". Use one of: ${SSL_CHOICES.join(', ')}.`);
    }
    if (value === 'off') return undefined;
    if (value === 'require') return true;
    return { rejectUnauthorized: true };
}

function parsePort(value: string | undefined, flag: string): number | undefined {
    if (value === undefined) return undefined;
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid ${flag} "${value}". Use an integer between 1 and 65535.`);
    }
    return port;
}

/** Shorthand flags that expand to a whole tunnel block, by the name after `--tunnel-` */
const SHORTHAND_FLAGS = { northflank: 'tunnelNorthflank' } as const satisfies Record<string, keyof ConnectionAddOptions>;

/** Parse repeated `--tunnel-option key=value` flags into provider settings */
function parseTunnelOptions(options: string[] | undefined): Record<string, string> {
    const parsed: Record<string, string> = {};
    for (const option of options ?? []) {
        const eq = option.indexOf('=');
        const key = eq === -1 ? '' : option.slice(0, eq).trim();
        if (!key) {
            throw new Error(`Invalid --tunnel-option "${option}". Use key=value, e.g. project=my-project.`);
        }
        if (['provider', 'idleTimeout', 'readyTimeout'].includes(key)) {
            throw new Error(
                `--tunnel-option cannot set "${key}". Use --tunnel-provider, --tunnel-idle-timeout ` +
                `or --tunnel-ready-timeout.`
            );
        }
        parsed[key] = option.slice(eq + 1);
    }
    return parsed;
}

/**
 * Build the tunnel block from the tunnel flags.
 *
 * A tunnel comes from exactly one of: `--tunnel-command`, `--tunnel-provider`
 * with its `--tunnel-option` settings, or a shorthand flag that expands to a
 * whole block, because getting a forwarding command and its endpoint pattern
 * both right by hand is the most common way to end up with a tunnel that never
 * comes up.
 */
function buildTunnel(opts: ConnectionAddOptions): TunnelConfig | undefined {
    const shorthandName = (Object.keys(SHORTHAND_FLAGS) as (keyof typeof SHORTHAND_FLAGS)[])
        .find((name) => opts[SHORTHAND_FLAGS[name]] !== undefined);
    const sources = [
        shorthandName !== undefined && `--tunnel-${shorthandName}`,
        opts.tunnelCommand !== undefined && '--tunnel-command',
        opts.tunnelProvider !== undefined && '--tunnel-provider',
    ].filter(Boolean) as string[];

    if (sources.length > 1) {
        throw new Error(`${sources.join(' and ')} cannot both be given.`);
    }
    if (sources.length === 0) {
        const strayFlags = [
            opts.tunnelLocalPort !== undefined && '--tunnel-local-port',
            opts.tunnelEndpointPattern !== undefined && '--tunnel-endpoint-pattern',
            opts.tunnelOption !== undefined && opts.tunnelOption.length > 0 && '--tunnel-option',
            opts.tunnelIdleTimeout !== undefined && '--tunnel-idle-timeout',
            opts.tunnelReadyTimeout !== undefined && '--tunnel-ready-timeout',
        ].filter(Boolean);
        if (strayFlags.length > 0) {
            throw new Error(
                `${strayFlags.join(', ')} needs a tunnel. ` +
                `Add --tunnel-command, --tunnel-provider or --tunnel-northflank.`
            );
        }
        return undefined;
    }

    let tunnel: TunnelConfig;

    if (opts.tunnelProvider !== undefined) {
        const commandOnly = [
            opts.tunnelLocalPort !== undefined && '--tunnel-local-port',
            opts.tunnelEndpointPattern !== undefined && '--tunnel-endpoint-pattern',
        ].filter(Boolean);
        if (commandOnly.length > 0) {
            throw new Error(
                `${commandOnly.join(', ')} only applies to --tunnel-command. ` +
                `A provider finds its own local port.`
            );
        }
        if (!tunnelProviderIds().includes(opts.tunnelProvider)) {
            throw new Error(
                `Invalid --tunnel-provider "${opts.tunnelProvider}". Use one of: ${tunnelProviderIds().join(', ')}.`
            );
        }
        tunnel = { ...parseTunnelOptions(opts.tunnelOption), provider: opts.tunnelProvider };
    } else {
        if (opts.tunnelOption !== undefined && opts.tunnelOption.length > 0) {
            throw new Error('--tunnel-option needs --tunnel-provider.');
        }

        if (shorthandName !== undefined) {
            const spec = opts[SHORTHAND_FLAGS[shorthandName]] as string;
            const shorthand = tunnelShorthand(shorthandName);
            if (!shorthand) throw new Error(`--tunnel-${shorthandName} is not available in this build.`);
            try {
                tunnel = shorthand.expand(spec);
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                throw new Error(`Invalid --tunnel-${shorthandName} "${spec}". ${reason}`);
            }
        } else {
            tunnel = { command: opts.tunnelCommand as string };
        }

        if (opts.tunnelEndpointPattern !== undefined) {
            tunnel.endpointPattern = opts.tunnelEndpointPattern;
        }
        const localPort = parsePort(opts.tunnelLocalPort, '--tunnel-local-port');
        if (localPort !== undefined) tunnel.localPort = localPort;
    }

    if (opts.tunnelIdleTimeout !== undefined) tunnel.idleTimeout = opts.tunnelIdleTimeout;
    if (opts.tunnelReadyTimeout !== undefined) tunnel.readyTimeout = opts.tunnelReadyTimeout;

    return tunnel;
}

/** Where the tunnel forwards to, and so what host the connection should use */
const TUNNEL_LOCAL_HOST = '127.0.0.1';

/**
 * Build a connection config from the flags. Throws with a message naming the
 * offending flag when a combination cannot work.
 *
 * The password itself is never part of the returned config: `--password-stdin`
 * produces a keychain reference and the caller stores the secret, and
 * `--password-env` produces an environment reference.
 */
export function buildConnectionConfig(name: string, opts: ConnectionAddOptions): ConnectionConfig {
    if (opts.fromUrl && (opts.host || opts.port || opts.username || opts.database)) {
        throw new Error(
            '--from-url cannot be combined with --host, --port, --username or --database.'
        );
    }
    if (opts.passwordStdin && opts.passwordEnv) {
        throw new Error('--password-stdin and --password-env cannot both be given.');
    }

    const fromUrl = opts.fromUrl ? parseConnectionUrl(opts.fromUrl) : null;
    if (opts.fromUrl && !fromUrl) {
        throw new Error(
            `Could not parse --from-url "${opts.fromUrl}". Expected a URL such as ` +
            `postgres://user@host:5432/db.`
        );
    }

    const type = resolveType(opts, fromUrl?.type);
    const tunnel = buildTunnel(opts);

    if (tunnel && type === DB_TYPES.SQLITE) {
        throw new Error('SQLite is a local file and cannot use a tunnel.');
    }
    // Report a bad tunnel here rather than on the first query.
    if (tunnel) resolveTunnel(name, tunnel);

    if (type === DB_TYPES.SQLITE) {
        const ignored = [
            opts.host !== undefined && '--host',
            opts.port !== undefined && '--port',
            opts.username !== undefined && '--username',
            opts.ssl !== undefined && '--ssl',
            opts.passwordStdin && '--password-stdin',
            opts.passwordEnv !== undefined && '--password-env',
        ].filter(Boolean);
        if (ignored.length > 0) {
            throw new Error(
                `${ignored.join(', ')} cannot be used with --type sqlite, which is a local file.`
            );
        }

        const filename = opts.database ?? fromUrl?.database;
        if (!filename) {
            throw new Error('SQLite needs --database pointing at the database file.');
        }
        const config: ConnectionConfig = { type, filename };
        if (opts.directory) config.directory = opts.directory;
        return config;
    }

    const config: ConnectionConfig = { type };

    // A tunnel replaces the host and port at connect time, so the connection
    // only needs a placeholder when the user has not named the real remote.
    const host = opts.host ?? fromUrl?.host ?? (tunnel ? TUNNEL_LOCAL_HOST : undefined);
    if (!host) {
        throw new Error('Missing --host. Give the database host, or pass --from-url.');
    }
    config.host = host;

    const port = parsePort(opts.port, '--port') ?? fromUrl?.port;
    if (port !== undefined) config.port = port;

    if (type === DB_TYPES.REDIS) {
        config.database = opts.database ?? fromUrl?.database ?? '0';
    } else {
        const database = opts.database ?? fromUrl?.database;
        if (!database) {
            throw new Error('Missing --database. Give the database name, or pass --from-url.');
        }
        config.database = database;

        const username = opts.username ?? fromUrl?.username;
        if (!username) {
            throw new Error('Missing --username. Give the database user, or pass --from-url.');
        }
        config.username = username;
    }

    const password = buildPasswordRef(name, opts);
    if (password !== undefined) config.password = password;

    // An explicit --ssl always wins, including --ssl off, which parses to the
    // same `undefined` the URL fallback would otherwise fill in.
    const ssl = opts.ssl !== undefined ? parseSsl(opts.ssl) : fromUrl?.ssl;
    if (ssl !== undefined && ssl !== false) config.ssl = ssl;
    if (fromUrl?.allowPublicKeyRetrieval) config.allowPublicKeyRetrieval = true;

    if (opts.logging) config.logging = true;
    if (opts.directory) config.directory = opts.directory;
    if (tunnel) config.tunnel = tunnel;

    return config;
}

/**
 * A password given in the URL is refused rather than stored: it would already
 * have been visible in the shell history and the process list.
 */
function buildPasswordRef(name: string, opts: ConnectionAddOptions): CredentialRef | undefined {
    if (opts.passwordEnv) return { $env: opts.passwordEnv };
    if (opts.passwordStdin) return { $keychain: name };
    return undefined;
}

function resolveType(opts: ConnectionAddOptions, urlType: DbType | undefined): DbType {
    if (opts.type !== undefined) {
        if (!isValidDbType(opts.type)) {
            throw new Error(
                `Invalid --type "${opts.type}". Use one of: postgres, mysql, mssql, sqlite, redis.`
            );
        }
        if (urlType && urlType !== opts.type) {
            throw new Error(`--type ${opts.type} contradicts the ${urlType} URL given in --from-url.`);
        }
        return opts.type;
    }
    if (urlType) return urlType;
    throw new Error('Missing --type. Use one of: postgres, mysql, mssql, sqlite, redis.');
}
