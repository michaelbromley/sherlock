/**
 * Where a connection's credentials come from, and whether they are there,
 * without reading their values out. Used by `sherlock doctor` and by the
 * password listings in `sherlock keychain list` and `sherlock manage`.
 */

import type { ConnectionConfig, CredentialRef } from '../config/types';
import { DB_TYPES } from '../db-types';
import { connectionEnvVarName } from './providers/env';
import { hasKeychainPassword } from './providers/keychain';

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
    env: Env = process.env
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
        return env[value.$env] !== undefined
            ? { ok: true, source: `environment variable ${value.$env}` }
            : { ok: false, source: `environment variable ${value.$env}, which is not set` };
    }
    const ref = value.$keychain;
    const account = typeof ref === 'string' ? ref : ref.account;
    const service = typeof ref === 'string' ? undefined : ref.service;
    const label = `OS keychain (${service ?? 'sherlock'}/${account})`;
    return hasKeychainPassword(account, service)
        ? { ok: true, source: label }
        : { ok: false, source: `${label}, which has no such entry` };
}

/** Where a connection's password comes from, including when it needs none */
export function passwordStatus(name: string, config: ConnectionConfig, env: Env = process.env): CredentialStatus {
    if (config.type === DB_TYPES.SQLITE) return { ok: true, source: 'not needed (SQLite)' };
    if (config.url !== undefined) return { ok: true, source: 'part of the connection URL' };
    return credentialSource(name, 'password', config.password, env) ?? { ok: true, source: 'none configured' };
}
