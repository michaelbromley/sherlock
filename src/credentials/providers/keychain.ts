import { Entry } from '@napi-rs/keyring';
import type { CredentialProvider } from '../types';
import type { CredentialRef } from '../../config/types';

const SERVICE_NAME = 'sherlock';

/**
 * Keychain credential provider
 * Uses OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
 */
export class KeychainProvider implements CredentialProvider {
    name = 'keychain';
    priority = 80; // Higher than literal, lower than env

    canResolve(ref: CredentialRef): boolean {
        return typeof ref === 'object' && '$keychain' in ref;
    }

    async resolve(ref: CredentialRef): Promise<string> {
        if (typeof ref !== 'object' || !('$keychain' in ref)) {
            throw new Error('KeychainProvider can only resolve $keychain references');
        }

        const keychainRef = ref.$keychain;
        let service: string;
        let account: string;

        if (typeof keychainRef === 'string') {
            // Simple format: { "$keychain": "account-name" }
            service = SERVICE_NAME;
            account = keychainRef;
        } else {
            // Full format: { "$keychain": { "service": "...", "account": "..." } }
            service = keychainRef.service || SERVICE_NAME;
            account = keychainRef.account;
        }

        if (!account) {
            throw new Error('Keychain reference must specify an account name');
        }

        const entry = new Entry(service, account);
        const password = entry.getPassword();

        if (password === null) {
            throw new Error(
                `No password found in keychain for service="${service}" account="${account}".\n` +
                `Use 'sherlock keychain set ${account}' to store a password.`
            );
        }

        return password;
    }
}

/**
 * Store a password in the keychain
 */
export function setKeychainPassword(account: string, password: string, service: string = SERVICE_NAME): void {
    const entry = new Entry(service, account);
    entry.setPassword(password);
}

/**
 * Get a password from the keychain
 */
export function getKeychainPassword(account: string, service: string = SERVICE_NAME): string | null {
    const entry = new Entry(service, account);
    return entry.getPassword();
}

/**
 * Delete a password from the keychain
 */
export function deleteKeychainPassword(account: string, service: string = SERVICE_NAME): void {
    const entry = new Entry(service, account);
    entry.deletePassword();
}

/**
 * Check if a password exists in the keychain
 */
export function hasKeychainPassword(account: string, service: string = SERVICE_NAME): boolean {
    const entry = new Entry(service, account);
    return entry.getPassword() !== null;
}
