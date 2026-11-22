import { describe, it, expect } from 'bun:test';
import { ownKeychainEntry, planKeychainMove, usesOwnKeychainEntry, type KeychainAccess } from './ownership';
import type { ConnectionConfig } from '../config/types';

function fakeKeychain(entries: Record<string, string> = {}) {
    const calls: string[] = [];
    const keychain: KeychainAccess = {
        get: (account) => entries[account] ?? null,
        set: (account, password) => { calls.push(`set ${account}`); entries[account] = password; },
        has: (account) => account in entries,
        delete: (account) => { calls.push(`delete ${account}`); delete entries[account]; },
    };
    return { keychain, entries, calls };
}

describe('usesOwnKeychainEntry', () => {
    it('is true only for the sherlock keychain entry named after the connection', () => {
        expect(usesOwnKeychainEntry({ $keychain: 'prod' }, 'prod')).toBe(true);
        expect(usesOwnKeychainEntry({ $keychain: { account: 'prod' } }, 'prod')).toBe(true);
        expect(usesOwnKeychainEntry({ $keychain: { service: 'sherlock', account: 'prod' } }, 'prod')).toBe(true);
        // Someone else's entry, or one in another service, is not the connection's to move or delete.
        expect(usesOwnKeychainEntry({ $keychain: 'shared-db-password' }, 'prod')).toBe(false);
        expect(usesOwnKeychainEntry({ $keychain: { service: 'sherlock-url', account: 'prod' } }, 'prod')).toBe(false);
        expect(usesOwnKeychainEntry({ $env: 'PROD_PW' }, 'prod')).toBe(false);
        expect(usesOwnKeychainEntry('plain', 'prod')).toBe(false);
        expect(usesOwnKeychainEntry(undefined, 'prod')).toBe(false);
    });
});

describe('planKeychainMove', () => {
    const own = (): ConnectionConfig => ({ type: 'postgres', password: { $keychain: 'prod' } });

    it('copies the password first and deletes the old entry only on commit', () => {
        const { keychain, entries, calls } = fakeKeychain({ prod: 's3cret' });
        const config = own();

        const move = planKeychainMove(config, 'prod', 'production', keychain);

        expect(move.ok).toBe(true);
        expect(config.password).toEqual({ $keychain: 'production' });
        // Before commit, both entries exist: a config saved or not saved still finds its password.
        expect(entries).toEqual({ prod: 's3cret', production: 's3cret' });
        expect(calls).toEqual(['set production']);

        if (move.ok) move.commit();
        expect(entries).toEqual({ production: 's3cret' });
    });

    it('refuses to overwrite an entry the new name already has, and changes nothing', () => {
        const { keychain, entries, calls } = fakeKeychain({ prod: 'a', production: 'b' });
        const config = own();

        const move = planKeychainMove(config, 'prod', 'production', keychain);

        expect(move.ok).toBe(false);
        expect(config.password).toEqual({ $keychain: 'prod' });
        expect(entries).toEqual({ prod: 'a', production: 'b' });
        expect(calls).toEqual([]);
    });

    it('repoints at the new name when there is no stored password to move', () => {
        const { keychain, calls } = fakeKeychain();
        const config = own();
        const move = planKeychainMove(config, 'prod', 'production', keychain);
        expect(move.ok).toBe(true);
        expect(config.password).toEqual({ $keychain: 'production' });
        if (move.ok) move.commit();
        expect(calls).toEqual([]);
    });

    it('leaves a shared or environment password alone', () => {
        const { keychain, calls } = fakeKeychain({ shared: 'x' });
        for (const password of [{ $keychain: 'shared' }, { $env: 'PW' }] as const) {
            const config: ConnectionConfig = { type: 'postgres', password };
            const move = planKeychainMove(config, 'prod', 'production', keychain);
            expect(move.ok).toBe(true);
            expect(config.password).toEqual(password);
            if (move.ok) move.commit();
        }
        expect(calls).toEqual([]);
    });
});

describe('ownKeychainEntry', () => {
    it('names the entry to delete with a connection, only when it owns one that exists', () => {
        const { keychain } = fakeKeychain({ prod: 'x', shared: 'y' });
        expect(ownKeychainEntry({ type: 'postgres', password: { $keychain: 'prod' } }, 'prod', keychain)).toBe('prod');
        expect(ownKeychainEntry({ type: 'postgres', password: { $keychain: 'shared' } }, 'prod', keychain)).toBeNull();
        expect(ownKeychainEntry({ type: 'postgres', password: { $keychain: 'gone' } }, 'gone', keychain)).toBeNull();
        expect(ownKeychainEntry(undefined, 'prod', keychain)).toBeNull();
    });
});
