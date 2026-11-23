import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseEnvFile, projectEnv, lookupEnv } from './env-file';
import { buildConnectionConfig } from './connection-input';
import { clearConfigCache, resolveConnectionCredentials } from './index';
import { passwordStatus } from '../credentials/status';

/**
 * A connection whose URL comes from a variable, read from the .env of the
 * connection's project directory before the environment.
 */

let dir: string;
let project: string;
let configPath: string;
const URL = 'postgres://shop:secret@127.0.0.1:55433/corner_shop';

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-url-env-'));
    project = path.join(dir, 'project');
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(project, '.env'), `# local dev\nexport DATABASE_URL="${URL}"\nPORT=3000\n`);
    configPath = path.join(dir, 'config.json');
    clearConfigCache();
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    clearConfigCache();
    delete process.env.SHERLOCK_TEST_URL_ENV;
});

describe('parseEnvFile', () => {
    it('reads assignments, skipping comments and blank lines, with export and quotes', () => {
        expect(parseEnvFile('# c\n\nA=1\nexport B="two"\nC=\'three\'\r\nD = spaced \nnot a line\n')).toEqual({
            A: '1', B: 'two', C: 'three', D: 'spaced',
        });
    });

    it('keeps an = inside a value', () => {
        expect(parseEnvFile('URL=postgres://u:p@h/db?sslmode=require')).toEqual({ URL: 'postgres://u:p@h/db?sslmode=require' });
    });
});

describe('lookupEnv', () => {
    it("prefers the project's .env, so an exported value for another project cannot win", () => {
        const found = lookupEnv('DATABASE_URL', projectEnv(project), { DATABASE_URL: 'postgres://elsewhere/db' });
        expect(found).toEqual({ value: URL, from: path.join(project, '.env') });
    });

    it('falls back to the environment', () => {
        expect(lookupEnv('ONLY_ENV', projectEnv(project), { ONLY_ENV: 'x' })).toEqual({ value: 'x', from: 'environment' });
        expect(lookupEnv('NOWHERE', projectEnv(project), {})).toBeUndefined();
    });

    it('has no project .env without a directory, or when the file is missing', () => {
        expect(projectEnv(undefined)).toBeUndefined();
        expect(projectEnv(path.join(dir, 'missing'))).toBeUndefined();
    });
});

describe('connection add --url-env', () => {
    it('stores only the variable name, with the type read from the URL', () => {
        const config = buildConnectionConfig('shop', { urlEnv: 'DATABASE_URL', directory: project });
        expect(config).toEqual({ url: { $env: 'DATABASE_URL' }, type: 'postgres', directory: project });
        expect(JSON.stringify(config)).not.toContain('secret');
    });

    it('refuses flags the URL already gives', () => {
        for (const extra of [{ host: 'h' }, { database: 'd' }, { fromUrl: URL }, { passwordPrompt: true }, { passwordEnv: 'PW' }]) {
            expect(() => buildConnectionConfig('shop', { urlEnv: 'DATABASE_URL', ...extra }))
                .toThrow(expect.objectContaining({ code: 'USAGE', details: { flag: '--url-env' } }));
        }
    });

    it('refuses a --type that contradicts the URL, and a malformed variable name', () => {
        expect(() => buildConnectionConfig('shop', { urlEnv: 'DATABASE_URL', directory: project, type: 'mysql' })).toThrow(/contradicts/);
        expect(() => buildConnectionConfig('shop', { urlEnv: 'not a name' })).toThrow(/Invalid --url-env/);
    });

    it('accepts a variable that is not set yet, leaving the type out', () => {
        expect(buildConnectionConfig('shop', { urlEnv: 'NOT_SET_YET' })).toEqual({ url: { $env: 'NOT_SET_YET' } });
    });
});

describe('resolving the connection', () => {
    function writeConfig(connection: object): void {
        fs.writeFileSync(configPath, JSON.stringify({ connections: { shop: connection } }));
        clearConfigCache();
    }

    it("reads the URL from the project's .env", async () => {
        writeConfig({ url: { $env: 'DATABASE_URL' }, directory: project });
        const resolved = await resolveConnectionCredentials('shop', configPath);
        expect(resolved).toMatchObject({ type: 'postgres', url: URL });
    });

    it('reads the environment when the .env does not set the variable', async () => {
        process.env.SHERLOCK_TEST_URL_ENV = 'sqlite:///tmp/x.db';
        writeConfig({ url: { $env: 'SHERLOCK_TEST_URL_ENV' }, directory: project });
        expect((await resolveConnectionCredentials('shop', configPath)).type).toBe('sqlite');
    });

    it('names the .env when the variable is nowhere', async () => {
        writeConfig({ url: { $env: 'NOWHERE_URL' }, directory: project });
        await expect(resolveConnectionCredentials('shop', configPath)).rejects.toMatchObject({
            code: 'CREDENTIAL_MISSING',
            details: { setting: 'url', source: 'env' },
            fix: expect.stringContaining(path.join(project, '.env')),
        });
    });

    it('reports where the URL comes from, never its value', () => {
        const status = passwordStatus('shop', { url: { $env: 'DATABASE_URL' }, directory: project }, {});
        expect(status).toEqual({ ok: true, source: `part of the connection URL, from DATABASE_URL in ${path.join(project, '.env')}` });
        expect(passwordStatus('shop', { url: { $env: 'NOWHERE_URL' }, directory: project }, {}).ok).toBe(false);
    });
});
