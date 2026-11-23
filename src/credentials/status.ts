/**
 * Where a connection's credentials come from, and whether they are there,
 * without reading their values out. Used by `sherlock doctor` and by the
 * password listings in `sherlock keychain list` and `sherlock manage`.
 */

import type { ConnectionConfig, CredentialRef } from '../config/types';
import { DB_TYPES } from '../db-types';
import { connectionEnvVarName } from './providers/env';
import { hasKeychainPassword } from './providers/keychain';
import { errorMessage } from '../errors';
import { lookupEnv, projectEnv, type ProjectEnv } from '../config/env-file';

export interface CredentialStatus {
    /** False when the credential is configured but cannot be found */
    ok: boolean;
    /** Where it is read from, e.g. "OS keychain (sherlock/prod)" */
    source: string;
}

type Env = Record<string, string | undefined>;

/** The settings sherlock can read from a credential reference */
export type CredentialField = 'url' | 'host' | 'username' | 'password';

/**
 * Where one setting of a connection comes from. Null when it is neither set
 * in the config nor supplied by sherlock's default environment variable.
 */
export function credentialSource(
    connectionName: string,
    field: CredentialField,
    value: string | CredentialRef | undefined,
    env: Env = process.env,
    project?: ProjectEnv
): CredentialStatus | null {
    if (value === undefined) {
        if (field === 'url') return null;
        // A username is also read from SHERLOCK_<NAME>_USER.
        const fields = field === 'username' ? ['USERNAME', 'USER'] : [field.toUpperCase()];
        for (const envField of fields) {
            const name = connectionEnvVarName(connectionName, envField);
            if (env[name] !== undefined) return { ok: true, source: `environment variable ${name}` };
        }
        return null;
    }
    if (typeof value === 'string') {
        return { ok: true, source: field === 'password' || field === 'url' ? 'plaintext in config.json' : 'config.json' };
    }
    if ('$env' in value) {
        const found = lookupEnv(value.$env, project, env);
        if (found?.from === 'environment') return { ok: true, source: `environment variable ${value.$env}` };
        if (found) return { ok: true, source: `${value.$env} in ${found.from}` };
        return {
            ok: false,
            source: project
                ? `${value.$env}, which is not set in ${project.file} or the environment`
                : `environment variable ${value.$env}, which is not set`,
        };
    }
    const ref = value.$keychain;
    const account = typeof ref === 'string' ? ref : ref.account;
    const service = typeof ref === 'string' ? undefined : ref.service;
    const label = `OS keychain (${service ?? 'sherlock'}/${account})`;
    try {
        return hasKeychainPassword(account, service)
            ? { ok: true, source: label }
            : { ok: false, source: `${label}, which has no such entry` };
    } catch (error) {
        // A locked or missing keychain: report this entry, not the whole listing.
        return { ok: false, source: `${label}, which could not be read: ${errorMessage(error)}` };
    }
}

/** Where a connection's password comes from, including when it needs none */
export function passwordStatus(name: string, config: ConnectionConfig, env: Env = process.env): CredentialStatus {
    if (config.type === DB_TYPES.SQLITE) return { ok: true, source: 'not needed (SQLite)' };
    const project = projectEnv(config.directory);
    if (config.url !== undefined) {
        if (typeof config.url === 'string') return { ok: true, source: 'part of the connection URL' };
        // The URL, and so the password in it, is read from somewhere: say where, and whether it is there.
        const url = credentialSource(name, 'url', config.url, env, project)!;
        return { ok: url.ok, source: `part of the connection URL, from ${url.source}` };
    }
    return credentialSource(name, 'password', config.password, env, project) ?? { ok: true, source: 'none configured' };
}
