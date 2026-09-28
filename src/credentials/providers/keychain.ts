import { execSync, spawnSync, type SpawnSyncOptions } from 'child_process';
import type { CredentialProvider } from '../types';
import type { CredentialRef } from '../../config/types';

const SERVICE_NAME = 'sherlock';

// Cache to avoid multiple keychain access prompts for the same credential
const passwordCache = new Map<string, string | null>();

function getCacheKey(service: string, account: string): string {
    return `${service}:${account}`;
}

/**
 * SECURITY: Validate that a string is safe for use in shell commands
 * Only allows alphanumeric, hyphens, underscores, and dots
 */
function validateShellSafeString(value: string, fieldName: string): void {
    if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
        throw new Error(
            `Invalid ${fieldName}: "${value}". ` +
            `Only letters, numbers, hyphens, underscores, and dots are allowed.`
        );
    }
}

/**
 * SECURITY: Escape a string for use in shell single quotes
 * Single quotes are safest - only need to handle the quote itself
 */
function shellEscape(value: string): string {
    // Replace single quotes with '\'' (end quote, escaped quote, start quote)
    return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Get password using macOS security command (single prompt)
 */
function getPasswordViaSecurity(service: string, account: string): string | null {
    // SECURITY: Validate inputs before using in shell command
    validateShellSafeString(service, 'service');
    validateShellSafeString(account, 'account');

    if (process.platform !== 'darwin') {
        // Fall back to @napi-rs/keyring for non-macOS
        const { Entry } = require('@napi-rs/keyring');
        const entry = new Entry(service, account);
        return entry.getPassword();
    }

    try {
        // Use -w flag to only output the password
        const result = execSync(
            `security find-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)} -w`,
            { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        return result.trim();
    } catch {
        return null;
    }
}

/**
 * Set password using macOS security command
 */
function setPasswordViaSecurity(service: string, account: string, password: string): void {
    // SECURITY: Validate inputs before using in shell command
    validateShellSafeString(service, 'service');
    validateShellSafeString(account, 'account');

    if (process.platform !== 'darwin') {
        const { Entry } = require('@napi-rs/keyring');
        const entry = new Entry(service, account);
        entry.setPassword(password);
        return;
    }

    // Delete existing entry first (ignore errors if it doesn't exist)
    try {
        execSync(
            `security delete-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)}`,
            { stdio: ['pipe', 'pipe', 'pipe'] }
        );
    } catch {
        // Ignore - entry might not exist
    }

    // `security` asks for the password twice when -w is given no value, and
    // reads both from stdin. Passing it as an argument instead would put the
    // password in the process list, where any local user can read it.
    if (password.includes('\n')) {
        throw new Error(
            'Passwords containing a newline cannot be stored in the macOS keychain by sherlock.'
        );
    }

    // -A allows any app to read the entry, which avoids a keychain prompt on
    // every query from a differently-signed binary.
    //
    // `security` reads the password from the controlling terminal when there is
    // one, ignoring stdin, and would wait there for input nobody can see.
    // Detaching starts it in a new session with no terminal, so it reads stdin.
    const result = spawnSync(
        'security',
        ['add-generic-password', '-s', service, '-a', account, '-A', '-w'],
        // Node's types omit `detached` for spawnSync, but Bun honours it.
        { input: `${password}\n${password}\n`, stdio: ['pipe', 'pipe', 'pipe'], detached: true } as SpawnSyncOptions
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(
            `Could not store the password in the macOS keychain: ` +
            `${String(result.stderr).trim() || `security exited with status ${result.status}`}`
        );
    }
}

/**
 * Delete password using macOS security command
 */
function deletePasswordViaSecurity(service: string, account: string): void {
    // SECURITY: Validate inputs before using in shell command
    validateShellSafeString(service, 'service');
    validateShellSafeString(account, 'account');

    if (process.platform !== 'darwin') {
        const { Entry } = require('@napi-rs/keyring');
        const entry = new Entry(service, account);
        entry.deletePassword();
        return;
    }

    try {
        execSync(
            `security delete-generic-password -s ${shellEscape(service)} -a ${shellEscape(account)}`,
            { stdio: ['pipe', 'pipe', 'pipe'] }
        );
    } catch {
        // Ignore errors
    }
}

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

        // Check cache first to avoid multiple keychain prompts
        const cacheKey = getCacheKey(service, account);
        if (passwordCache.has(cacheKey)) {
            const cached = passwordCache.get(cacheKey);
            if (cached === null) {
                throw new Error(
                    `No password found in keychain for service="${service}" account="${account}".\n` +
                    `Use 'sherlock keychain set ${account}' to store a password.`
                );
            }
            return cached;
        }

        // Access keychain using native security command (single prompt on macOS)
        const password = getPasswordViaSecurity(service, account);

        // Cache the result (even if null)
        passwordCache.set(cacheKey, password);

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
    setPasswordViaSecurity(service, account, password);

    // Update cache
    passwordCache.set(getCacheKey(service, account), password);
}

/**
 * Get a password from the keychain (uses cache to avoid multiple prompts)
 */
export function getKeychainPassword(account: string, service: string = SERVICE_NAME): string | null {
    const cacheKey = getCacheKey(service, account);

    // Check cache first
    if (passwordCache.has(cacheKey)) {
        return passwordCache.get(cacheKey) ?? null;
    }

    // Access keychain using native command
    const password = getPasswordViaSecurity(service, account);

    // Cache result
    passwordCache.set(cacheKey, password);

    return password;
}

/**
 * Delete a password from the keychain
 */
export function deleteKeychainPassword(account: string, service: string = SERVICE_NAME): void {
    deletePasswordViaSecurity(service, account);

    // Clear from cache
    passwordCache.delete(getCacheKey(service, account));
}

/** Account used only to check that the keychain works; never left behind */
const PROBE_ACCOUNT = '__sherlock_keychain_probe__';

/**
 * Whether this machine has a usable keychain, found by storing, reading back
 * and deleting a throwaway entry. A headless Linux box usually has no Secret
 * Service running, and then the store step throws.
 */
export function isKeychainAvailable(): boolean {
    const probe = `probe-${Date.now()}`;
    try {
        setPasswordViaSecurity(SERVICE_NAME, PROBE_ACCOUNT, probe);
        const readBack = getPasswordViaSecurity(SERVICE_NAME, PROBE_ACCOUNT);
        return readBack === probe;
    } catch {
        return false;
    } finally {
        try {
            deletePasswordViaSecurity(SERVICE_NAME, PROBE_ACCOUNT);
        } catch {
            // Nothing was stored, or there is no keychain to delete from
        }
    }
}

/**
 * Check if a password exists in the keychain (uses cache to avoid multiple prompts)
 */
export function hasKeychainPassword(account: string, service: string = SERVICE_NAME): boolean {
    // Use getKeychainPassword which handles caching
    return getKeychainPassword(account, service) !== null;
}
