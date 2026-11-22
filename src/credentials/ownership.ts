/**
 * Which keychain entry belongs to a connection, and moving or removing it
 * when the connection is renamed or deleted.
 *
 * A connection owns the entry in sherlock's own keychain service that is named
 * after it, which is where `connection add --password-stdin` and the wizard
 * store passwords. Any other entry a connection references may be shared, so
 * it is never moved or deleted on the connection's behalf.
 */

import type { ConnectionConfig } from '../config/types';

/** What this module needs from the OS keychain, injectable for tests */
export interface KeychainAccess {
    get(account: string): string | null;
    set(account: string, password: string): void;
    has(account: string): boolean;
    delete(account: string): void;
}

/** The keychain service sherlock stores its own entries under */
const SHERLOCK_SERVICE = 'sherlock';

/** Whether a password reference is the keychain entry named after a connection */
export function usesOwnKeychainEntry(password: ConnectionConfig['password'], connName: string): boolean {
    if (typeof password !== 'object' || password === null || !('$keychain' in password)) return false;
    const ref = password.$keychain;
    return typeof ref === 'string'
        ? ref === connName
        : ref.account === connName && (ref.service ?? SHERLOCK_SERVICE) === SHERLOCK_SERVICE;
}

export type KeychainMove =
    /** Ready: the config points at the new entry. Call `commit` once the config is saved. */
    | { ok: true; commit: () => void; message?: string }
    | { ok: false; reason: string };

/**
 * Move a connection's own keychain password to the entry for its new name, in
 * two steps so that a failed save cannot strand it.
 *
 * Copies the password to the new entry and points `config` at it. The old
 * entry is deleted by `commit`, which the caller runs only after the config is
 * saved: until then the saved config still points at the old entry, which
 * still exists.
 */
export function planKeychainMove(
    config: ConnectionConfig,
    oldName: string,
    newName: string,
    keychain: KeychainAccess
): KeychainMove {
    const noop = () => undefined;
    if (!usesOwnKeychainEntry(config.password, oldName)) return { ok: true, commit: noop };

    const secret = keychain.get(oldName);
    if (secret === null) {
        // Nothing to move. Point at the new name so a password stored later lands there.
        config.password = { $keychain: newName };
        return { ok: true, commit: noop };
    }
    if (keychain.has(newName)) {
        return {
            ok: false,
            reason: `The keychain already has an entry for "${newName}", so the password of "${oldName}" ` +
                `cannot be moved there. Nothing was renamed.`,
        };
    }

    keychain.set(newName, secret);
    config.password = { $keychain: newName };
    return {
        ok: true,
        commit: () => keychain.delete(oldName),
        message: `Moved the keychain password from "${oldName}" to "${newName}".`,
    };
}

/**
 * The keychain entry to delete along with a connection, or null when it uses
 * none of its own. Delete it only after the config without the connection is
 * saved.
 */
export function ownKeychainEntry(
    config: ConnectionConfig | undefined,
    connName: string,
    keychain: Pick<KeychainAccess, 'has'>
): string | null {
    return config && usesOwnKeychainEntry(config.password, connName) && keychain.has(connName) ? connName : null;
}
