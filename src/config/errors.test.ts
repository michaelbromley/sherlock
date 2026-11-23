import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { clearConfigCache, getConnectionConfig, loadConfigFile, resolveConnection, resolveDurationSetting } from './index';
import { resolveTunnel } from '../tunnel/providers';
import { SherlockError } from '../errors';

/** The error a call throws, which must be a SherlockError */
async function thrown(fn: () => unknown): Promise<SherlockError> {
    try {
        await fn();
    } catch (error) {
        expect(error).toBeInstanceOf(SherlockError);
        return error as SherlockError;
    }
    throw new Error('expected it to throw');
}

let dir: string;
let configPath: string;

function writeConfig(content: unknown): void {
    fs.writeFileSync(configPath, typeof content === 'string' ? content : JSON.stringify(content));
    clearConfigCache();
}

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-errors-'));
    configPath = path.join(dir, 'config.json');
    clearConfigCache();
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    clearConfigCache();
});

describe('config errors', () => {
    it('reports a --config file that does not exist as CONFIG_NOT_FOUND', async () => {
        const error = await thrown(() => loadConfigFile(path.join(dir, 'missing.json')));
        expect(error.code).toBe('CONFIG_NOT_FOUND');
        expect(error.details).toEqual({ searched: [path.join(dir, 'missing.json')] });
    });

    it('reports malformed JSON as CONFIG_INVALID', async () => {
        writeConfig('{"connections": {');
        expect((await thrown(() => loadConfigFile(configPath))).code).toBe('CONFIG_INVALID');
    });

    it('reports a config without connections as CONFIG_INVALID', async () => {
        writeConfig({ connection: {} });
        const error = await thrown(() => loadConfigFile(configPath));
        expect(error).toMatchObject({ code: 'CONFIG_INVALID', details: { setting: 'connections' } });
    });

    it('lists the connections there are when one is not found', async () => {
        writeConfig({ connections: { prod: { type: 'sqlite', filename: 'x.db' }, dev: { type: 'sqlite', filename: 'y.db' } } });
        const error = await thrown(() => getConnectionConfig('stage', configPath));
        expect(error).toMatchObject({ code: 'CONNECTION_NOT_FOUND', details: { connection: 'stage', available: ['prod', 'dev'] } });
        expect(error.fix).toContain('prod, dev');
    });

    it('does not find a connection named after an inherited property', async () => {
        writeConfig({ connections: {} });
        expect((await thrown(() => getConnectionConfig('constructor', configPath))).code).toBe('CONNECTION_NOT_FOUND');
    });

    it('names the setting of a malformed duration', async () => {
        const error = await thrown(() => resolveDurationSetting('prod', 'statementTimeout', 'soon'));
        expect(error).toMatchObject({ code: 'CONFIG_INVALID', details: { connection: 'prod', setting: 'statementTimeout' } });
    });

    it('reports a bad tunnel block as CONFIG_INVALID', async () => {
        const error = await thrown(() => resolveTunnel('prod', { provider: 'northflank', project: 'x' } as never));
        expect(error).toMatchObject({ code: 'CONFIG_INVALID', details: { connection: 'prod', setting: 'tunnel' } });
    });

    it('reports missing host, user or database as CONFIG_INVALID', async () => {
        writeConfig({ connections: { prod: { type: 'postgres', host: 'db' } } });
        const error = await thrown(() => resolveConnection('prod', configPath));
        expect(error).toMatchObject({ code: 'CONFIG_INVALID', details: { connection: 'prod', setting: 'username' } });
    });
});

describe('credential errors', () => {
    const variable = 'SHERLOCK_TEST_UNSET_PASSWORD';

    it('names the setting and the source of a credential that does not resolve', async () => {
        delete process.env[variable];
        writeConfig({
            connections: {
                prod: { type: 'postgres', host: 'db', username: 'u', database: 'd', password: { $env: variable } },
            },
        });
        const error = await thrown(() => resolveConnection('prod', configPath));
        expect(error).toMatchObject({ code: 'CREDENTIAL_MISSING', details: { setting: 'password', source: 'env' } });
        expect(error.message).toContain(variable);
        expect(error.fix).toContain(variable);
    });

    it('reports a URL that resolves to nothing as CREDENTIAL_MISSING', async () => {
        process.env[variable] = '';
        try {
            writeConfig({ connections: { prod: { url: { $env: variable } } } });
            const error = await thrown(() => resolveConnection('prod', configPath));
            expect(error).toMatchObject({ code: 'CREDENTIAL_MISSING', details: { setting: 'url' } });
        } finally {
            delete process.env[variable];
        }
    });

    it('reports a reference that is neither $env nor $keychain as CONFIG_INVALID', async () => {
        writeConfig({
            connections: { prod: { type: 'postgres', host: 'db', username: 'u', database: 'd', password: { $vault: 'x' } } },
        });
        expect((await thrown(() => resolveConnection('prod', configPath))).code).toBe('CONFIG_INVALID');
    });
});
