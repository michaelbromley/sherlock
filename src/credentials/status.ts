/**
 * Where a connection's password comes from, and whether it is there, without
 * reading its value out. For listings such as the keychain check in
 * `sherlock manage`, which otherwise only know about keychain entries named
 * after the connection.
 */

import type { ConnectionConfig } from '../config/types';
import { DB_TYPES } from '../db-types';
import { getEnvVarForConnection } from './providers/env';
import { hasKeychainPassword } from './providers/keychain';

export interface PasswordStatus {
    /** False when the password is configured but cannot be found */
    ok: boolean;
    /** Where it is read from, e.g. "OS keychain (sherlock/prod)" */
    source: string;
}

export function passwordStatus(
    name: string,
    config: ConnectionConfig,
    env: Record<string, string | undefined> = process.env
): PasswordStatus {
    if (config.type === DB_TYPES.SQLITE) return { ok: true, source: 'not needed (SQLite)' };
    if (config.url !== undefined) return { ok: true, source: 'part of the connection URL' };

    const password = config.password;
    if (password === undefined) {
        const envVar = `SHERLOCK_${name.toUpperCase()}_PASSWORD`;
        return getEnvVarForConnection(name, 'PASSWORD') !== undefined
            ? { ok: true, source: `environment variable ${envVar}` }
            : { ok: true, source: 'none configured' };
    }
    if (typeof password === 'string') return { ok: true, source: 'plaintext in config.json' };
    if ('$env' in password) {
        return env[password.$env] !== undefined
            ? { ok: true, source: `environment variable ${password.$env}` }
            : { ok: false, source: `environment variable ${password.$env}, which is not set` };
    }
    const ref = password.$keychain;
    const account = typeof ref === 'string' ? ref : ref.account;
    const service = typeof ref === 'string' ? undefined : ref.service;
    const label = `OS keychain (${service ?? 'sherlock'}/${account})`;
    return hasKeychainPassword(account, service)
        ? { ok: true, source: label }
        : { ok: false, source: `${label}, which has no such entry` };
}
