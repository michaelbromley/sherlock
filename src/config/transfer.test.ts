import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    buildExportPayload,
    sealPayload,
    openPayload,
    planImport,
    planHasSecrets,
    applyImport,
    URL_KEYCHAIN_SERVICE,
    type ExportPayload,
    type SecretStorage,
} from './transfer';
import { ExportFileError } from './transfer-crypto';
import { addConnection } from './write';
import { clearConfigCache } from './index';
import type { ConnectionConfig, CredentialRef } from './types';

/**
 * The source machine's connections, one per way sherlock can store a credential.
 * Keychain reads go through a fake so the tests never touch the real keychain.
 */
const SOURCE: Record<string, ConnectionConfig> = {
    'in-keychain': { type: 'postgres', host: 'db.example.com', database: 'app', username: 'app', password: { $keychain: 'in-keychain' } },
    'in-env': { type: 'mysql', host: 'mysql.local', database: 'shop', username: { $env: 'TRANSFER_TEST_USER' }, password: { $env: 'TRANSFER_TEST_PASSWORD' } },
    'inline': { type: 'postgres', host: 'legacy', port: 5433, database: 'old', username: 'root', password: 'plain-secret', ssl: true },
    'with-url': { type: 'postgres', url: 'postgres://u:url-secret@h:5432/d' },
    'env-unset': { type: 'postgres', host: 'ci', database: 'ci', username: 'ci', password: { $env: 'TRANSFER_TEST_NEVER_SET' } },
    'tunnelled': {
        type: 'postgres', host: '127.0.0.1', database: 'app', username: 'app', password: { $keychain: 'tunnelled' },
        tunnel: { command: 'ssh -N -L {{port}}:db:5432 bastion' },
    },
    'no-password': { type: 'redis', host: 'localhost', database: '0' },
    'local-file': { type: 'sqlite', filename: '/tmp/x.db' },
};

const FAKE_KEYCHAIN: Record<string, string> = {
    'in-keychain': 'keychain-secret',
    'tunnelled': 'tunnel-secret',
};

async function fakeResolve(ref: CredentialRef): Promise<string> {
    if (typeof ref === 'object' && '$keychain' in ref) {
        const account = typeof ref.$keychain === 'string' ? ref.$keychain : ref.$keychain.account;
        if (account in FAKE_KEYCHAIN) return FAKE_KEYCHAIN[account];
        throw new Error(`No password found in keychain for account="${account}"`);
    }
    throw new Error('unexpected ref');
}

/** A keychain that records what was stored in it */
function recordingKeychain(): { storage: SecretStorage; stored: Map<string, string> } {
    const stored = new Map<string, string>();
    return {
        stored,
        storage: { kind: 'keychain', set: (account: string, value: string, service = 'sherlock') => stored.set(`${service}/${account}`, value) },
    };
}

const PASSPHRASE = 'correct horse battery staple';

/** A lower scrypt cost than real exports use, to keep the tests fast */
const TEST_SCRYPT_N = 2 ** 14;

let tempDir: string;
let originalXdg: string | undefined;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-transfer-'));
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tempDir;
    process.env.TRANSFER_TEST_USER = 'env-user';
    process.env.TRANSFER_TEST_PASSWORD = 'env-secret';
    clearConfigCache();
});

afterEach(() => {
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    delete process.env.TRANSFER_TEST_USER;
    delete process.env.TRANSFER_TEST_PASSWORD;
    fs.rmSync(tempDir, { recursive: true, force: true });
    clearConfigCache();
});

function writtenConfig(): Record<string, ConnectionConfig> {
    const file = path.join(tempDir, 'sherlock', 'config.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8')).connections;
}

/** Export the source, seal it, and open it again as the destination would */
async function exportAndOpen(names?: string[]): Promise<ExportPayload> {
    const { payload } = await buildExportPayload(SOURCE, names, fakeResolve);
    const sealed = sealPayload(payload, PASSPHRASE, TEST_SCRYPT_N);
    // Environment on the destination is not the source's
    delete process.env.TRANSFER_TEST_USER;
    delete process.env.TRANSFER_TEST_PASSWORD;
    return openPayload(sealed, PASSPHRASE);
}

describe('export then import', () => {
    it('reproduces every connection, with secrets in the keychain', async () => {
        const payload = await exportAndOpen();
        const plan = planImport(payload);
        const { storage, stored } = recordingKeychain();
        const { imported } = applyImport(plan, storage);

        expect(imported.map(c => c.name)).toEqual(Object.keys(SOURCE).sort((a, b) => a.localeCompare(b)));
        expect(plan.skipped).toEqual([]);

        const config = writtenConfig();

        // Every secret lands in the keychain, the way `connection add --password-stdin` stores it
        expect(Object.fromEntries(stored)).toEqual({
            'sherlock/in-keychain': 'keychain-secret',
            'sherlock/in-env': 'env-secret',
            'sherlock/inline': 'plain-secret',
            'sherlock/tunnelled': 'tunnel-secret',
            [`${URL_KEYCHAIN_SERVICE}/with-url`]: 'postgres://u:url-secret@h:5432/d',
        });
        expect(config['in-keychain'].password).toEqual({ $keychain: 'in-keychain' });
        expect(config['in-env'].password).toEqual({ $keychain: 'in-env' });
        expect(config['with-url'].url).toEqual({ $keychain: { service: URL_KEYCHAIN_SERVICE, account: 'with-url' } });

        // A plaintext password on the source is upgraded, not carried over as plaintext
        expect(config['inline'].password).toEqual({ $keychain: 'inline' });
        expect(config['inline']).toMatchObject({ host: 'legacy', port: 5433, database: 'old', username: 'root', ssl: true });

        // Non-secret references resolve to values, so the destination needs no .env
        expect(config['in-env'].username).toBe('env-user');

        // An env reference that was never set travels as a reference
        expect(config['env-unset'].password).toEqual({ $env: 'TRANSFER_TEST_NEVER_SET' });

        expect(config['tunnelled'].tunnel).toEqual({ command: 'ssh -N -L {{port}}:db:5432 bastion' });
        expect(config['no-password']).toEqual(SOURCE['no-password']);
        expect(config['local-file']).toEqual(SOURCE['local-file']);
    });

    it('stores secrets inline when told the destination has no keychain', async () => {
        const payload = await exportAndOpen(['in-keychain', 'with-url']);
        const { imported } = applyImport(planImport(payload), { kind: 'inline' });

        expect(imported.every(c => c.secrets === 'inline')).toBe(true);
        const config = writtenConfig();
        expect(config['in-keychain'].password).toBe('keychain-secret');
        expect(config['with-url'].url).toBe('postgres://u:url-secret@h:5432/d');
    });

    it('exports a single named connection', async () => {
        const payload = await exportAndOpen(['in-keychain']);
        expect(Object.keys(payload.connections)).toEqual(['in-keychain']);
    });
});

describe('export', () => {
    it('refuses a connection name that does not exist', async () => {
        await expect(buildExportPayload(SOURCE, ['nope'], fakeResolve)).rejects.toThrow('not found: nope');
    });

    it('skips a connection whose keychain entry is missing, and says why', async () => {
        const source = { ...SOURCE, 'lost': { type: 'postgres', host: 'h', database: 'd', username: 'u', password: { $keychain: 'lost' } } } as Record<string, ConnectionConfig>;
        const { exported, skipped } = await buildExportPayload(source, undefined, fakeResolve);

        expect(exported).not.toContain('lost');
        expect(skipped).toHaveLength(1);
        expect(skipped[0].name).toBe('lost');
        expect(skipped[0].reason).toContain('keychain');
    });

    it('picks up a password supplied by the SHERLOCK_<NAME>_PASSWORD convention', async () => {
        process.env.SHERLOCK_BY_CONVENTION_PASSWORD = 'conventional';
        try {
            const source = { 'by-convention': { type: 'postgres', host: 'h', database: 'd', username: 'u' } } as Record<string, ConnectionConfig>;
            const { payload } = await buildExportPayload(source, undefined, fakeResolve);
            expect(payload.connections['by-convention'].secrets.password).toBe('conventional');
        } finally {
            delete process.env.SHERLOCK_BY_CONVENTION_PASSWORD;
        }
    });

    it('does not change the source config', async () => {
        const before = structuredClone(SOURCE);
        await buildExportPayload(SOURCE, undefined, fakeResolve);
        expect(SOURCE).toEqual(before);
    });
});

describe('the encrypted file', () => {
    let sealed: string;

    beforeAll(async () => {
        process.env.TRANSFER_TEST_USER = 'env-user';
        process.env.TRANSFER_TEST_PASSWORD = 'env-secret';
        const { payload } = await buildExportPayload(SOURCE, undefined, fakeResolve);
        sealed = sealPayload(payload, PASSPHRASE, TEST_SCRYPT_N);
    });

    it('contains no secret, username or host in plaintext', () => {
        for (const needle of ['keychain-secret', 'env-secret', 'plain-secret', 'url-secret', 'tunnel-secret', 'db.example.com', 'in-keychain']) {
            expect(sealed).not.toContain(needle);
        }
    });

    it('refuses the wrong passphrase', () => {
        let error: unknown;
        try {
            openPayload(sealed, 'not the passphrase');
        } catch (e) {
            error = e;
        }
        expect(error).toBeInstanceOf(ExportFileError);
        expect((error as Error).message).toContain('passphrase is wrong');
    });

    it('detects a modified ciphertext', () => {
        const envelope = JSON.parse(sealed);
        const bytes = Buffer.from(envelope.ciphertext, 'base64');
        bytes[bytes.length >> 1] ^= 0x01;
        envelope.ciphertext = bytes.toString('base64');

        expect(() => openPayload(JSON.stringify(envelope), PASSPHRASE)).toThrow('modified or corrupted');
    });

    it('detects a modified authentication tag', () => {
        const envelope = JSON.parse(sealed);
        const tag = Buffer.from(envelope.tag, 'base64');
        tag[0] ^= 0xff;
        envelope.tag = tag.toString('base64');

        expect(() => openPayload(JSON.stringify(envelope), PASSPHRASE)).toThrow(ExportFileError);
    });

    it('detects a modified header, which is authenticated too', () => {
        const envelope = JSON.parse(sealed);
        const iv = Buffer.from(envelope.cipher.iv, 'base64');
        iv[0] ^= 0x01;
        envelope.cipher.iv = iv.toString('base64');

        expect(() => openPayload(JSON.stringify(envelope), PASSPHRASE)).toThrow(ExportFileError);
    });

    it('detects a truncated file', () => {
        expect(() => openPayload(sealed.slice(0, sealed.length / 2), PASSPHRASE)).toThrow('not valid JSON');
    });

    it('refuses scrypt parameters that would exhaust memory', () => {
        const envelope = JSON.parse(sealed);
        envelope.kdf.N = 2 ** 30;
        expect(() => openPayload(JSON.stringify(envelope), PASSPHRASE)).toThrow('header is missing or invalid');
    });

    it('refuses a file that is not an export', () => {
        expect(() => openPayload('{"connections":{}}', PASSPHRASE)).toThrow('not a sherlock export file');
    });
});

describe('import', () => {
    const payloadOf = (connections: Record<string, unknown>): ExportPayload =>
        ({ format: 'sherlock-connections-payload', version: 1, exportedAt: '', connections } as ExportPayload);

    const entry = { config: { type: 'postgres', host: 'new', database: 'd', username: 'u' }, secrets: { password: 'p' } };

    it('skips a connection that already exists, and leaves it and its keychain entry alone', () => {
        addConnection('taken', { type: 'postgres', host: 'original', database: 'd', username: 'u' });
        clearConfigCache();

        const plan = planImport(payloadOf({ taken: entry, fresh: entry }));
        expect(plan.skipped).toEqual([{ name: 'taken', reason: expect.stringContaining('--force') }]);

        const { storage, stored } = recordingKeychain();
        applyImport(plan, storage);

        expect(writtenConfig().taken.host).toBe('original');
        expect(writtenConfig().fresh.host).toBe('new');
        expect([...stored.keys()]).toEqual(['sherlock/fresh']);
    });

    it('replaces an existing connection with --force', () => {
        addConnection('taken', { type: 'postgres', host: 'original', database: 'd', username: 'u' });
        clearConfigCache();

        const plan = planImport(payloadOf({ taken: entry }), { force: true });
        const { imported } = applyImport(plan, recordingKeychain().storage);

        expect(imported[0].action).toBe('replaced');
        expect(writtenConfig().taken.host).toBe('new');
    });

    it('skips entries connection add would refuse', () => {
        const plan = planImport(payloadOf({
            'bad name!': entry,
            'bad-type': { config: { type: 'oracle' }, secrets: {} },
            'bad-tunnel': { config: { type: 'postgres', tunnel: { command: '' } }, secrets: {} },
            'sqlite-tunnel': { config: { type: 'sqlite', filename: 'x', tunnel: { command: 'ssh' } }, secrets: {} },
            'bad-secret': { config: { type: 'postgres' }, secrets: { password: 42 } },
            'good': entry,
            // As JSON.parse produces it: an own key, not the prototype
            ...JSON.parse(`{"__proto__": ${JSON.stringify(entry)}}`),
        }));

        expect(plan.toImport.map(i => i.name)).toEqual(['good']);
        expect(plan.skipped.map(s => s.name).sort()).toEqual(
            ['__proto__', 'bad name!', 'bad-secret', 'bad-tunnel', 'bad-type', 'sqlite-tunnel'].sort()
        );
    });

    it('reports whether any imported connection has a secret to store', () => {
        expect(planHasSecrets(planImport(payloadOf({ a: entry })))).toBe(true);
        expect(planHasSecrets(planImport(payloadOf({ a: { ...entry, secrets: {} } })))).toBe(false);
    });

    it('writes nothing when a keychain write fails', () => {
        const failing: SecretStorage = { kind: 'keychain', set: () => { throw new Error('keychain locked'); } };
        expect(() => applyImport(planImport(payloadOf({ a: entry })), failing)).toThrow('keychain locked');
        expect(fs.existsSync(path.join(tempDir, 'sherlock', 'config.json'))).toBe(false);
    });
});
