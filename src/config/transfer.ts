/**
 * Moving connections, credentials included, between machines.
 *
 * `sherlock config export` resolves every credential a connection uses, wherever
 * it is stored, and seals the result in a passphrase-encrypted file.
 * `sherlock config import` opens that file and stores each secret the way
 * `connection add --password-stdin` would: in the OS keychain, or inline in
 * config.json only when the machine has no keychain and the user agreed to it.
 *
 * Secrets exist in plaintext only in memory. They are never written to disk
 * except encrypted (export) or into the destination's credential store (import).
 *
 * Kept free of prompts and terminal output so it can be tested directly. The
 * command in query-db.ts owns the passphrase prompts and the reporting.
 */

import type { ConnectionConfig, CredentialRef } from './types';
import { getCredentialResolver } from '../credentials';
import { getEnvVarForConnection } from '../credentials/providers/env';
import { DB_TYPES, isValidDbType } from '../db-types';
import { resolveTunnelConfig } from '../tunnel/config';
import { decryptPayload, encryptPayload, ExportFileError } from './transfer-crypto';
import { loadOrCreateConfig, saveConfig, writableConfigPath } from './write';

const PAYLOAD_FORMAT = 'sherlock-connections-payload';
const PAYLOAD_VERSION = 1;

/**
 * Keychain service for a connection URL that carries credentials. The password
 * lives under the plain `sherlock` service, keyed by connection name, exactly as
 * `connection add` stores it; a separate service keeps the two from colliding.
 */
export const URL_KEYCHAIN_SERVICE = 'sherlock.url';

/** A connection as it travels: config with its secrets lifted out */
export interface ExportedConnection {
    config: ConnectionConfig;
    secrets: { password?: string; url?: string };
}

export interface ExportPayload {
    format: typeof PAYLOAD_FORMAT;
    version: number;
    exportedAt: string;
    connections: Record<string, ExportedConnection>;
}

export interface Skipped {
    name: string;
    reason: string;
}

export interface Note {
    name: string;
    message: string;
}

export interface ExportResult {
    payload: ExportPayload;
    exported: string[];
    skipped: Skipped[];
    notes: Note[];
}

type Resolve = (ref: CredentialRef) => Promise<string>;

const defaultResolve: Resolve = ref => getCredentialResolver().resolve(ref);

/** A credential that cannot be read here; the connection is left out of the export */
class UnreadableCredential extends Error {}

/**
 * What a field holds once it has been read: a value to carry across, or an
 * environment reference that is not set here and so travels as a reference.
 */
type FieldValue = { value: string } | { keep: CredentialRef };

async function readField(
    name: string,
    field: string,
    ref: string | CredentialRef,
    resolve: Resolve,
    notes: Note[]
): Promise<FieldValue> {
    if (typeof ref === 'string') return { value: ref };

    if ('$env' in ref) {
        // Keep an unset variable as a reference: `--password-env` connections
        // expect the variable to be supplied at query time, and it may be
        // supplied on the destination too.
        if (process.env[ref.$env] === undefined) {
            notes.push({
                name,
                message: `${field} reads $${ref.$env}, which is not set here, so it was exported ` +
                    `as a reference to that variable rather than a value.`,
            });
            return { keep: ref };
        }
        return { value: process.env[ref.$env] as string };
    }

    try {
        return { value: await resolve(ref) };
    } catch (error) {
        throw new UnreadableCredential(
            `its ${field} could not be read from the keychain ` +
            `(${error instanceof Error ? error.message.split('\n')[0].replace(/\.$/, '') : String(error)})`
        );
    }
}

/** Whether a connection URL carries a password */
function urlHasPassword(url: string): boolean {
    try {
        return new URL(url).password !== '';
    } catch {
        return false;
    }
}

/**
 * Lift a connection's secrets out of wherever they are stored, and turn every
 * non-secret reference (host, username) into a plain value, so the connection
 * works on a machine with none of this machine's keychain entries or .env file.
 */
async function exportConnection(
    name: string,
    source: ConnectionConfig,
    resolve: Resolve,
    notes: Note[]
): Promise<ExportedConnection> {
    const config: ConnectionConfig = structuredClone(source);
    const secrets: ExportedConnection['secrets'] = {};

    if (config.url !== undefined) {
        const url = await readField(name, 'url', config.url, resolve, notes);
        // A reference means someone chose to keep the URL out of config.json,
        // so it stays a secret even when it carries no password.
        if ('value' in url && (typeof config.url !== 'string' || urlHasPassword(url.value))) {
            secrets.url = url.value;
            delete config.url;
        }
    }

    if (config.password !== undefined) {
        const password = await readField(name, 'password', config.password, resolve, notes);
        if ('value' in password) {
            delete config.password;
            if (password.value !== '') secrets.password = password.value;
        }
    }

    for (const field of ['host', 'username'] as const) {
        const ref = config[field];
        if (ref === undefined || typeof ref === 'string') continue;
        const read = await readField(name, field, ref, resolve, notes);
        if ('value' in read) config[field] = read.value;
    }

    // Values picked up by naming convention (SHERLOCK_<NAME>_PASSWORD and so on)
    // never appear in config.json, so without this the destination would get a
    // connection with its password missing.
    if (config.url === undefined && secrets.url === undefined && config.type !== DB_TYPES.SQLITE) {
        if (source.password === undefined) {
            const password = getEnvVarForConnection(name, 'PASSWORD');
            if (password) secrets.password = password;
        }
        config.host ??= getEnvVarForConnection(name, 'HOST');
        config.database ??= getEnvVarForConnection(name, 'DATABASE');
        if (config.type !== DB_TYPES.REDIS) {
            config.username ??= getEnvVarForConnection(name, 'USERNAME')
                ?? getEnvVarForConnection(name, 'USER');
        }
        for (const field of ['host', 'database', 'username'] as const) {
            if (config[field] === undefined) delete config[field];
        }
    }

    return { config, secrets };
}

/**
 * Build the export payload. `names` selects connections; omit it to export
 * every one. A connection whose credential cannot be read is skipped and
 * reported rather than exported without it.
 */
export async function buildExportPayload(
    connections: Record<string, ConnectionConfig>,
    names?: string[],
    resolve: Resolve = defaultResolve
): Promise<ExportResult> {
    const selected = names ?? Object.keys(connections).sort((a, b) => a.localeCompare(b));
    const missing = selected.filter(name => !Object.hasOwn(connections, name));
    if (missing.length > 0) {
        throw new Error(
            `Connection${missing.length > 1 ? 's' : ''} not found: ${missing.join(', ')}. ` +
            `Available: ${Object.keys(connections).join(', ') || 'none'}.`
        );
    }

    const payload: ExportPayload = {
        format: PAYLOAD_FORMAT,
        version: PAYLOAD_VERSION,
        exportedAt: new Date().toISOString(),
        connections: {},
    };
    const exported: string[] = [];
    const skipped: Skipped[] = [];
    const notes: Note[] = [];

    for (const name of selected) {
        try {
            payload.connections[name] = await exportConnection(name, connections[name], resolve, notes);
            exported.push(name);
        } catch (error) {
            if (!(error instanceof UnreadableCredential)) throw error;
            skipped.push({ name, reason: error.message });
        }
    }

    return { payload, exported, skipped, notes };
}

/** Serialise and encrypt a payload, returning the export file contents */
export function sealPayload(payload: ExportPayload, passphrase: string, scryptN?: number): string {
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf-8');
    try {
        return encryptPayload(plaintext, passphrase, scryptN);
    } finally {
        plaintext.fill(0);
    }
}

/** Decrypt export file contents and check the payload inside */
export function openPayload(fileContents: string, passphrase: string): ExportPayload {
    const plaintext = decryptPayload(fileContents, passphrase);
    let raw: any;
    try {
        raw = JSON.parse(plaintext.toString('utf-8'));
    } catch {
        throw new ExportFileError('The export file decrypted, but its contents are not valid.');
    } finally {
        plaintext.fill(0);
    }

    if (raw?.format !== PAYLOAD_FORMAT || raw.version !== PAYLOAD_VERSION
        || typeof raw.connections !== 'object' || raw.connections === null
        || Array.isArray(raw.connections)) {
        throw new ExportFileError('The export file decrypted, but its contents are not valid.');
    }
    return raw as ExportPayload;
}

// ============================================================================
// Import
// ============================================================================

/**
 * Connection names become keychain account names, which sherlock passes to the
 * `security` command, so they get the same character limits it enforces.
 * Prototype keys are refused because they would not land in the connections map.
 */
const SAFE_NAME = /^[a-zA-Z0-9_.-]+$/;
const RESERVED_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCredentialField(value: unknown): boolean {
    if (typeof value === 'string') return true;
    if (!isPlainObject(value)) return false;
    if (typeof value.$env === 'string') return true;
    const keychain = value.$keychain;
    return typeof keychain === 'string'
        || (isPlainObject(keychain) && typeof keychain.account === 'string');
}

/**
 * Check an imported connection with the rules `connection add` applies, so an
 * import cannot produce a connection that `connection add` would have refused.
 */
function validateImported(name: string, entry: unknown): ExportedConnection {
    if (!SAFE_NAME.test(name) || RESERVED_NAMES.has(name)) {
        throw new Error('the name may only contain letters, numbers, hyphens, underscores and dots');
    }
    if (!isPlainObject(entry) || !isPlainObject(entry.config) || !isPlainObject(entry.secrets)) {
        throw new Error('the entry is malformed');
    }

    const config = entry.config as ConnectionConfig;
    const secrets = entry.secrets as ExportedConnection['secrets'];

    for (const [key, value] of Object.entries(secrets)) {
        if ((key !== 'password' && key !== 'url') || typeof value !== 'string') {
            throw new Error(`the secret "${key}" is malformed`);
        }
    }
    if (config.type !== undefined && !isValidDbType(config.type)) {
        throw new Error(`"${config.type}" is not a database type sherlock supports`);
    }
    for (const field of ['url', 'host', 'username', 'password'] as const) {
        if (config[field] !== undefined && !isCredentialField(config[field])) {
            throw new Error(`"${field}" is malformed`);
        }
    }
    if (config.port !== undefined
        && (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)) {
        throw new Error(`port ${config.port} is not between 1 and 65535`);
    }
    if (config.tunnel !== undefined) {
        if (config.type === DB_TYPES.SQLITE) {
            throw new Error('SQLite is a local file and cannot use a tunnel');
        }
        resolveTunnelConfig(name, config.tunnel);
    }

    return { config, secrets };
}

export interface ImportPlan {
    /** Connections that will be written, in name order */
    toImport: { name: string; entry: ExportedConnection; replaces: boolean }[];
    skipped: Skipped[];
}

/**
 * Decide what an import will do without changing anything. A name that already
 * exists is skipped unless `force` is set, matching `connection add`.
 */
export function planImport(payload: ExportPayload, options: { force?: boolean } = {}): ImportPlan {
    const existing = loadOrCreateConfig().connections;
    const plan: ImportPlan = { toImport: [], skipped: [] };

    const names = Object.keys(payload.connections).sort((a, b) => a.localeCompare(b));
    for (const name of names) {
        let entry: ExportedConnection;
        try {
            entry = validateImported(name, payload.connections[name]);
        } catch (error) {
            plan.skipped.push({ name, reason: `invalid: ${error instanceof Error ? error.message : error}` });
            continue;
        }

        const replaces = Object.hasOwn(existing, name);
        if (replaces && !options.force) {
            plan.skipped.push({ name, reason: 'a connection with this name already exists; pass --force to replace it' });
            continue;
        }
        plan.toImport.push({ name, entry, replaces });
    }

    return plan;
}

/** Whether any connection in the plan carries a secret that needs storing */
export function planHasSecrets(plan: ImportPlan): boolean {
    return plan.toImport.some(({ entry }) => Object.keys(entry.secrets).length > 0);
}

/** Where imported secrets go */
export type SecretStorage =
    | { kind: 'keychain'; set: (account: string, value: string, service?: string) => void }
    | { kind: 'inline' };

export interface ImportedConnection {
    name: string;
    action: 'added' | 'replaced';
    /** Where this connection's secrets were stored, or 'none' if it had none */
    secrets: 'keychain' | 'inline' | 'none';
    tunnel?: string;
}

/**
 * Store each connection's secrets and write the config, once, at the end.
 *
 * Secrets go to the keychain before the config is written, so a keychain
 * failure part-way leaves config.json untouched rather than pointing at
 * entries that were never stored.
 */
export function applyImport(plan: ImportPlan, storage: SecretStorage): {
    imported: ImportedConnection[];
    path: string;
} {
    const config = loadOrCreateConfig();
    const imported: ImportedConnection[] = [];

    for (const { name, entry, replaces } of plan.toImport) {
        const connection: ConnectionConfig = structuredClone(entry.config);
        const { password, url } = entry.secrets;
        const hasSecrets = password !== undefined || url !== undefined;

        if (storage.kind === 'keychain') {
            if (password !== undefined) {
                storage.set(name, password);
                connection.password = { $keychain: name };
            }
            if (url !== undefined) {
                storage.set(name, url, URL_KEYCHAIN_SERVICE);
                connection.url = { $keychain: { service: URL_KEYCHAIN_SERVICE, account: name } };
            }
        } else {
            if (password !== undefined) connection.password = password;
            if (url !== undefined) connection.url = url;
        }

        config.connections[name] = connection;
        imported.push({
            name,
            action: replaces ? 'replaced' : 'added',
            secrets: hasSecrets ? storage.kind : 'none',
            ...(connection.tunnel ? { tunnel: connection.tunnel.command } : {}),
        });
    }

    if (imported.length > 0) saveConfig(config);
    return { imported, path: writableConfigPath() };
}
