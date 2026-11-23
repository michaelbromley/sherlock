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
import type { ConnectionConfig } from '../config/types';
import { getEnvFilePath } from '../config/paths';
import { DB_TYPES, isRedisConfig, type DbType } from '../db-types';
import { createConnection } from '../db/connection';
import { credentialSource } from '../credentials/status';
import { classifyDbError } from '../db/errors';
import { isSherlockError, type ErrorCode } from '../errors';
import type { WarningSink } from '../output/warnings';
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
            result = [failedCheck('unexpected error', error, 'INTERNAL')];
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

/**
 * A failed check for an error: its message, its fix unless the check has a
 * better one, and its code, which is what doctor reports as its own error.
 */
function failedCheck(name: string, error: unknown, fallbackCode: ErrorCode, fix?: string): DiagnosticCheck {
    const classified = isSherlockError(error) ? error : null;
    const chosenFix = fix ?? classified?.fix;
    return {
        name,
        status: 'fail',
        detail: errorMessage(error),
        ...(chosenFix !== undefined && { fix: chosenFix }),
        code: classified?.code ?? fallbackCode,
    };
}

function configStep(connectionName: string, configPath: string | undefined, state: DoctorState): DoctorStep {
    return async () => {
        let config: ConnectionConfig;
        try {
            config = getConnectionConfig(connectionName, configPath);
        } catch (error) {
            return [failedCheck('config', error, 'CONFIG_INVALID')];
        }
        state.config = config;
        state.dbType = summarizeConnection(connectionName, config).type;

        if (!config.tunnel) {
            return [{ name: 'config', status: 'pass', detail: `${state.dbType} connection with no tunnel` }];
        }

        try {
            state.tunnel = resolveTunnel(connectionName, config.tunnel);
        } catch (error) {
            return [failedCheck('config', error, 'CONFIG_INVALID')];
        }

        if (isConfigFromWorkingDirectory(configPath)) {
            return [{
                name: 'config',
                status: 'fail',
                detail: 'the connection has a tunnel, but the config was loaded from the current directory, where tunnels are not honoured',
                fix: 'Run with --config pointing at the file if you trust it, or move the connection to your user config.',
                code: 'CONFIG_UNTRUSTED',
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
                code: 'CONFIG_INVALID',
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
            await resolveConnectionCredentials(connectionName, configPath, state.warnings);
        } catch (error) {
            return [failedCheck('credentials', error, 'CREDENTIAL_MISSING', credentialsFix(errorMessage(error)))];
        }

        const fields = (['url', 'host', 'username', 'password'] as const)
            .map((field) => [field, credentialSource(connectionName, field, config[field])] as const)
            .filter(([, status]) => status !== null)
            .map(([field, status]) => `${field} from ${status!.source}`);
        const noPassword = config.url === undefined && credentialSource(connectionName, 'password', config.password) === null;

        return [{
            name: 'credentials',
            status: 'pass',
            detail: (fields.length > 0 ? fields.join('; ') : 'nothing to resolve') +
                (noPassword && !isRedisConfig(config) ? '; no password configured' : ''),
        }];
    };
}

/** What to do about a credential that does not resolve, by why it did not */
function credentialsFix(detail: string): string {
    const envVar = /environment variable not set: (\S+)/i.exec(detail)?.[1];
    if (envVar) {
        return `Set ${envVar} in the environment sherlock runs in, or in ${getEnvFilePath()}.`;
    }
    if (/keychain/i.test(detail)) {
        return 'Store the password again with sherlock manage > Edit connection > Update password. Typing it ' +
            'there keeps it out of the shell history.';
    }
    if (/missing required connection parameters/i.test(detail)) {
        return 'Add the missing settings to the connection, or set the environment variables the error names.';
    }
    return 'Check the connection\'s url, host, username and password settings.';
}

/** What the steps learn and pass on to the next */
interface DoctorState {
    /** Where warnings met while resolving the connection go */
    warnings?: WarningSink;
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

const CONNECT_CODES = new Set<ErrorCode>(['CONNECT_REFUSED', 'CONNECT_TIMEOUT', 'TUNNEL_DOWN', 'AUTH_FAILED']);

/** Which check a connection failure belongs to, by its code, or else by its message */
function failedCheckName(error: unknown, fallback: 'query' | 'connect'): string {
    if (isSherlockError(error)) {
        if (CONNECT_CODES.has(error.code)) return 'connect';
        if (error.code === 'TLS_FAILED') return 'tls';
    }
    const message = errorMessage(error);
    if (/did not answer within|tunnel accepted the connection|Could not connect to/.test(message)) return 'connect';
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
            resolved = await resolveConnection(connectionName, configPath, state.warnings);
        } catch (error) {
            if (!state.tunnel) {
                return [failedCheck('connect', error, 'INTERNAL')];
            }
            const fix = isSherlockError(error) && error.code !== 'TUNNEL_FAILED' && error.fix
                ? error.fix
                : `The error includes the end of the tunnel's log. The whole log is in ${logPath(connectionName)}.`;
            return [failedCheck('tunnel', error, 'TUNNEL_FAILED', fix)];
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
                    const classified = classifyDbError(error, resolved!);
                    return [failedCheck(failedCheckName(classified, 'query'), classified, 'QUERY_FAILED')];
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
                        const name = failedCheckName(error, 'connect');
                        const fix = name === 'tls' ? tlsFix(errorMessage(error), ssl.enabled) : undefined;
                        return [failedCheck(name, error, 'QUERY_FAILED', fix)];
                    }
                    checks.push(tls.encrypted
                        ? { name: 'tls', status: 'pass', detail: `session is encrypted${tls.protocol ? ` (${tls.protocol})` : ''}` }
                        : {
                            name: 'tls',
                            status: 'fail',
                            detail: 'ssl is enabled on the connection, but the session is not encrypted',
                            code: 'TLS_FAILED',
                        });
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
            const name = failedCheckName(error, 'query');
            const fix = name === 'tls' ? tlsFix(errorMessage(error), ssl.enabled) : undefined;
            checks.push(failedCheck(name, error, 'QUERY_FAILED', fix));
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
export async function diagnoseConnection(
    connectionName: string,
    configPath?: string,
    warnings?: WarningSink
): Promise<DoctorReport> {
    const state: DoctorState = { warnings };
    const { ok, checks } = await runSteps([
        configStep(connectionName, configPath, state),
        targetStep(state),
        providerStep(connectionName, state),
        credentialsStep(connectionName, configPath, state),
        ...connectSteps(connectionName, configPath, state),
    ]);
    return { connection: connectionName, ok, checks };
}
