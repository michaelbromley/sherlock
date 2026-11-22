/**
 * `sherlock doctor <connection>`: find out why a connection does not work.
 *
 * Runs checks in the order a connection depends on them and stops at the first
 * failure, since every later check would fail for the same reason:
 *
 *   1. config      the connection and its tunnel block are valid and allowed
 *   2. target      the tunnel forwards to the database the host names
 *   3. provider    the provider can reach its target (login, project, ...)
 *   4. credentials every credential reference resolves
 *   5. tunnel      the tunnel comes up
 *   6. tls         the session is encrypted when ssl is configured
 *   7. query       SELECT 1 (PING for Redis) succeeds
 *
 * Nothing here prints a secret: credentials are reported by where they come
 * from, never by value.
 */

import {
    getConnectionConfig,
    isConfigFromWorkingDirectory,
    normalizeSsl,
    resolveConnection,
    resolveConnectionCredentials,
    summarizeConnection,
} from '../config';
import type { ConnectionConfig, CredentialRef } from '../config/types';
import { getEnvVarForConnection } from '../credentials/providers/env';
import { DB_TYPES, isRedisConfig, type DbType } from '../db-types';
import { createConnection } from '../db/connection';
import { explainConnectTimeout } from '../db/connect-timeout';
import { createRedisConnection } from '../redis/connection';
import { resolveTunnel, type DiagnosticCheck, type ResolvedTunnel } from '../tunnel/providers';
import { startTunnelKeepalive } from '../tunnel/manager';
import { logPath } from '../tunnel/state';

export type { DiagnosticCheck };

export interface DoctorReport {
    connection: string;
    ok: boolean;
    checks: DiagnosticCheck[];
}

/** A step returns the checks it ran. A failed check ends the run. */
export type DoctorStep = () => Promise<DiagnosticCheck[]>;

/** Run steps in order, stopping after the first failed check */
export async function runSteps(steps: DoctorStep[]): Promise<{ ok: boolean; checks: DiagnosticCheck[] }> {
    const checks: DiagnosticCheck[] = [];
    for (const step of steps) {
        let result: DiagnosticCheck[];
        try {
            result = await step();
        } catch (error) {
            // A step that throws has failed without saying how; report it as its own check.
            result = [{ name: 'unexpected error', status: 'fail', detail: errorMessage(error) }];
        }
        for (const check of result) {
            checks.push(check);
            if (check.status === 'fail') return { ok: false, checks };
        }
    }
    return { ok: true, checks };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Where a credential comes from, without its value */
function credentialSource(
    connectionName: string,
    field: 'url' | 'host' | 'username' | 'password',
    value: string | CredentialRef | undefined
): string | null {
    if (value === undefined) {
        const envField = field === 'username' ? 'USERNAME' : field.toUpperCase();
        const envVar = `SHERLOCK_${connectionName.toUpperCase()}_${envField}`;
        if (field === 'url') return null;
        return getEnvVarForConnection(connectionName, envField) !== undefined
            ? `environment variable ${envVar}`
            : null;
    }
    if (typeof value === 'string') return field === 'password' || field === 'url' ? 'plaintext in config.json' : 'config.json';
    if ('$env' in value) return `environment variable ${value.$env}`;
    const ref = value.$keychain;
    return `OS keychain (${typeof ref === 'string' ? ref : `${ref.service ?? 'sherlock'}/${ref.account}`})`;
}

function configStep(connectionName: string, configPath: string | undefined, state: DoctorState): DoctorStep {
    return async () => {
        let config: ConnectionConfig;
        try {
            config = getConnectionConfig(connectionName, configPath);
        } catch (error) {
            return [{ name: 'config', status: 'fail', detail: errorMessage(error) }];
        }
        state.config = config;
        state.dbType = summarizeConnection(connectionName, config).type;

        if (!config.tunnel) {
            return [{ name: 'config', status: 'pass', detail: `${state.dbType} connection with no tunnel` }];
        }

        try {
            state.tunnel = resolveTunnel(connectionName, config.tunnel);
        } catch (error) {
            return [{ name: 'config', status: 'fail', detail: errorMessage(error) }];
        }

        if (isConfigFromWorkingDirectory(configPath)) {
            return [{
                name: 'config',
                status: 'fail',
                detail: 'the connection has a tunnel, but the config was loaded from the current directory, where tunnels are not honoured',
                fix: 'Run with --config pointing at the file if you trust it, or move the connection to your user config.',
            }];
        }

        return [{
            name: 'config',
            status: 'pass',
            detail: `${state.dbType} connection through a ${state.tunnel.providerId} tunnel`,
        }];
    };
}

function targetStep(state: DoctorState): DoctorStep {
    return async () => {
        if (!state.tunnel || !state.config) return [];

        const inspection = state.tunnel.inspect();
        const host = state.config.host;
        if (typeof host !== 'string') {
            return [{
                name: 'tunnel target',
                status: 'skip',
                detail: `the tunnel forwards ${inspection.target.summary}, and the connection's host is not written in the config, so the two cannot be compared`,
            }];
        }

        const verdict = inspection.checkHost(host);
        if (verdict.verdict === 'mismatch') {
            return [{
                name: 'tunnel target',
                status: 'fail',
                detail: verdict.reason,
                fix: 'Point the tunnel at the database the host names, or correct the host. A tunnel copied from another connection is the usual cause.',
            }];
        }
        return [{
            name: 'tunnel target',
            status: verdict.verdict === 'match' ? 'pass' : 'skip',
            detail: verdict.reason,
        }];
    };
}

function providerStep(connectionName: string, state: DoctorState): DoctorStep {
    return async () => {
        if (!state.tunnel?.diagnose || !state.dbType) return [];
        return state.tunnel.diagnose({ connectionName, dbType: state.dbType });
    };
}

function credentialsStep(connectionName: string, configPath: string | undefined, state: DoctorState): DoctorStep {
    return async () => {
        const config = state.config!;
        if (state.dbType === DB_TYPES.SQLITE) {
            return [{ name: 'credentials', status: 'skip', detail: 'SQLite has no credentials' }];
        }

        try {
            await resolveConnectionCredentials(connectionName, configPath);
        } catch (error) {
            return [{
                name: 'credentials',
                status: 'fail',
                detail: errorMessage(error),
                fix: `Store the password again with: sherlock manage, or 'echo <password> | sherlock connection add ${connectionName} --password-stdin --force ...'`,
            }];
        }

        const fields = (['url', 'host', 'username', 'password'] as const)
            .map((field) => [field, credentialSource(connectionName, field, config[field])] as const)
            .filter(([, source]) => source !== null)
            .map(([field, source]) => `${field} from ${source}`);
        const noPassword = config.url === undefined && credentialSource(connectionName, 'password', config.password) === null;

        return [{
            name: 'credentials',
            status: 'pass',
            detail: (fields.length > 0 ? fields.join('; ') : 'nothing to resolve') +
                (noPassword && !isRedisConfig(config) ? '; no password configured' : ''),
        }];
    };
}

/** What the steps learn and pass on to the next */
interface DoctorState {
    config?: ConnectionConfig;
    dbType?: DbType;
    tunnel?: ResolvedTunnel;
}

/** SQL that reports whether this session is encrypted, per database */
const TLS_QUERIES: Partial<Record<DbType, string>> = {
    [DB_TYPES.POSTGRES]: 'SELECT ssl AS encrypted, version AS protocol FROM pg_stat_ssl WHERE pid = pg_backend_pid()',
    [DB_TYPES.MYSQL]: "SHOW SESSION STATUS LIKE 'Ssl_version'",
    [DB_TYPES.MSSQL]: 'SELECT encrypt_option AS encrypted FROM sys.dm_exec_connections WHERE session_id = @@SPID',
};

/** Whether a TLS query's result says the session is encrypted, and how */
function readTlsResult(dbType: DbType, rows: unknown[]): { encrypted: boolean; protocol?: string } {
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return { encrypted: false };
    if (dbType === DB_TYPES.MYSQL) {
        const version = String(row.Value ?? '');
        return { encrypted: version !== '', protocol: version || undefined };
    }
    const encrypted = row.encrypted === true || String(row.encrypted).toUpperCase() === 'TRUE';
    return { encrypted, protocol: typeof row.protocol === 'string' ? row.protocol : undefined };
}

/** Which check a connection failure belongs to, by what went wrong */
function failedCheckName(message: string, fallback: 'query' | 'connect'): string {
    if (/did not answer within|tunnel accepted the connection/.test(message)) return 'connect';
    if (looksLikeTlsError(message)) return 'tls';
    return fallback;
}

function looksLikeTlsError(message: string): boolean {
    return /\b(ssl|tls|certificate|handshake|self[- ]signed)\b/i.test(message);
}

/** What to change for a TLS failure, by what the server said */
function tlsFix(message: string, sslEnabled: boolean): string {
    if (/does not support (ssl|tls)/i.test(message)) {
        return 'The server does not offer TLS. Remove "ssl" from the connection, or enable TLS on the server.';
    }
    if (/certificate|self[- ]signed|verify/i.test(message)) {
        return 'Use "ssl": true to encrypt without verifying the certificate. A tunnelled connection needs this, since the certificate names the real host, not the tunnel.';
    }
    return sslEnabled
        ? 'Check that the server accepts TLS on this port.'
        : 'The server may require TLS: set "ssl": true on the connection.';
}

function connectSteps(connectionName: string, configPath: string | undefined, state: DoctorState): DoctorStep[] {
    let resolved: Awaited<ReturnType<typeof resolveConnection>> | undefined;
    let stopKeepalive: (() => void) | undefined;

    const tunnelStep: DoctorStep = async () => {
        try {
            resolved = await resolveConnection(connectionName, configPath);
        } catch (error) {
            if (!state.tunnel) {
                return [{ name: 'connect', status: 'fail', detail: errorMessage(error) }];
            }
            return [{
                name: 'tunnel',
                status: 'fail',
                detail: errorMessage(error),
                fix: `The error includes the end of the tunnel's log. The whole log is in ${logPath(connectionName)}.`,
            }];
        }
        stopKeepalive = startTunnelKeepalive(connectionName);
        if (!state.tunnel) return [];
        const endpoint = new URL(resolved.url);
        return [{ name: 'tunnel', status: 'pass', detail: `tunnel up on ${endpoint.hostname}:${endpoint.port}` }];
    };

    const sessionSteps: DoctorStep = async () => {
        const config = state.config!;
        const dbType = state.dbType!;
        const ssl = normalizeSsl(config.ssl);
        const checks: DiagnosticCheck[] = [];

        try {
            if (dbType === DB_TYPES.REDIS) {
                const client = createRedisConnection(resolved!);
                try {
                    await client.send('PING', []);
                } catch (error) {
                    const message = errorMessage(explainConnectTimeout(error, resolved!));
                    return [{
                        name: failedCheckName(message, 'query'),
                        status: 'fail',
                        detail: message,
                    }];
                } finally {
                    client.close();
                }
                return [
                    { name: 'tls', status: ssl.enabled ? 'pass' : 'skip', detail: ssl.enabled ? 'connected over TLS (rediss://)' : 'ssl is not enabled on this connection' },
                    { name: 'query', status: 'pass', detail: 'PING succeeded' },
                ];
            }

            const sql = await createConnection(resolved!);
            try {
                const tlsQuery = TLS_QUERIES[dbType];
                if (!ssl.enabled) {
                    checks.push({ name: 'tls', status: 'skip', detail: 'ssl is not enabled on this connection' });
                } else if (tlsQuery) {
                    let tls;
                    try {
                        tls = readTlsResult(dbType, await sql.unsafe(tlsQuery));
                    } catch (error) {
                        const message = errorMessage(error);
                        return [{
                            name: failedCheckName(message, 'connect'),
                            status: 'fail',
                            detail: message,
                            ...(looksLikeTlsError(message) ? { fix: tlsFix(message, ssl.enabled) } : {}),
                        }];
                    }
                    checks.push(tls.encrypted
                        ? { name: 'tls', status: 'pass', detail: `session is encrypted${tls.protocol ? ` (${tls.protocol})` : ''}` }
                        : { name: 'tls', status: 'fail', detail: 'ssl is enabled on the connection, but the session is not encrypted' });
                    if (!tls.encrypted) return checks;
                } else {
                    checks.push({ name: 'tls', status: 'skip', detail: `cannot check TLS on ${dbType}` });
                }

                await sql.unsafe('SELECT 1');
                let detail = 'SELECT 1 succeeded in a read-only transaction';
                if (dbType === DB_TYPES.POSTGRES) {
                    const rows = await sql.unsafe('SELECT pg_is_in_recovery() AS replica') as { replica: boolean }[];
                    detail += rows[0]?.replica ? '; the server is a read replica' : '; the server is a primary';
                }
                checks.push({ name: 'query', status: 'pass', detail });
                return checks;
            } finally {
                await sql.close();
            }
        } catch (error) {
            const message = errorMessage(error);
            const name = failedCheckName(message, 'query');
            const tls = name === 'tls';
            checks.push({
                name,
                status: 'fail',
                detail: message,
                ...(tls ? { fix: tlsFix(message, ssl.enabled) } : {}),
            });
            return checks;
        }
    };

    return [
        tunnelStep,
        async () => {
            try {
                return await sessionSteps();
            } finally {
                stopKeepalive?.();
            }
        },
    ];
}

/** Diagnose a connection. Resolves rather than throws: failures are checks. */
export async function diagnoseConnection(connectionName: string, configPath?: string): Promise<DoctorReport> {
    const state: DoctorState = {};
    const { ok, checks } = await runSteps([
        configStep(connectionName, configPath, state),
        targetStep(state),
        providerStep(connectionName, state),
        credentialsStep(connectionName, configPath, state),
        ...connectSteps(connectionName, configPath, state),
    ]);
    return { connection: connectionName, ok, checks };
}
