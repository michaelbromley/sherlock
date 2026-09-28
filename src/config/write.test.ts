import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addConnection, connectionExists, loadOrCreateConfig, shadowingWarning } from './write';
import { clearConfigCache } from './index';

/**
 * These cover the seam between building a connection and writing it, which is
 * where a refused add can still do damage: the caller stores a keychain secret
 * in between, so `connectionExists` has to be right before anything else runs.
 */

let tempDir: string;
let originalXdg: string | undefined;

const CONNECTION = { type: 'postgres', host: 'h', database: 'd', username: 'u' } as const;

beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-write-'));
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tempDir;
    clearConfigCache();
});

afterEach(() => {
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    fs.rmSync(tempDir, { recursive: true, force: true });
    clearConfigCache();
});

describe('addConnection', () => {
    it('writes a connection into a config that does not exist yet', () => {
        const { replaced, path: written } = addConnection('prod', { ...CONNECTION });

        expect(replaced).toBe(false);
        expect(JSON.parse(fs.readFileSync(written, 'utf-8')).connections.prod).toMatchObject(CONNECTION);
    });

    it('writes the config readable by its owner only', () => {
        const { path: written } = addConnection('prod', { ...CONNECTION });
        expect(fs.statSync(written).mode & 0o777).toBe(0o600);
    });

    it('refuses to replace an existing connection', () => {
        addConnection('prod', { ...CONNECTION });
        clearConfigCache();

        expect(() => addConnection('prod', { ...CONNECTION, host: 'other' })).toThrow(
            /already exists.*--force/s
        );
    });

    it('leaves the existing connection untouched when it refuses', () => {
        addConnection('prod', { ...CONNECTION });
        clearConfigCache();

        try {
            addConnection('prod', { ...CONNECTION, host: 'other' });
        } catch {
            // expected
        }
        clearConfigCache();

        expect(loadOrCreateConfig().connections.prod.host).toBe('h');
    });

    it('replaces with --force', () => {
        addConnection('prod', { ...CONNECTION });
        clearConfigCache();

        const { replaced } = addConnection('prod', { ...CONNECTION, host: 'other' }, { force: true });
        clearConfigCache();

        expect(replaced).toBe(true);
        expect(loadOrCreateConfig().connections.prod.host).toBe('other');
    });

    it('keeps connections that were already there', () => {
        addConnection('one', { ...CONNECTION });
        clearConfigCache();
        addConnection('two', { ...CONNECTION });
        clearConfigCache();

        expect(Object.keys(loadOrCreateConfig().connections).sort()).toEqual(['one', 'two']);
    });
});

describe('connectionExists', () => {
    it('is false with no config at all', () => {
        expect(connectionExists('prod')).toBe(false);
    });

    it('is true once the connection is written', () => {
        addConnection('prod', { ...CONNECTION });
        clearConfigCache();
        expect(connectionExists('prod')).toBe(true);
    });

    it('is false for a name that was never added', () => {
        addConnection('prod', { ...CONNECTION });
        clearConfigCache();
        expect(connectionExists('staging')).toBe(false);
    });
});

describe('loadOrCreateConfig', () => {
    it('starts a new config when there is no file', () => {
        expect(loadOrCreateConfig().connections).toEqual({});
    });

    it('refuses to start fresh over a config it cannot parse', () => {
        // Returning an empty config here would let the next write replace every
        // connection in the file with nothing.
        const configDir = path.join(tempDir, 'sherlock');
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, 'config.json'), '{ this is not json', 'utf-8');
        clearConfigCache();

        expect(() => loadOrCreateConfig()).toThrow();
    });

    it('reads the user config even when a project config is in the working directory', () => {
        // Discovery would pick the project file, and writing back what it read
        // would copy the project's connections, tunnels included, into the
        // user config.
        const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-project-'));
        const originalCwd = process.cwd();
        fs.writeFileSync(
            path.join(projectDir, '.sherlock.json'),
            JSON.stringify({ connections: { cloned: { type: 'postgres', tunnel: { command: 'evil' } } } }),
            'utf-8'
        );
        try {
            process.chdir(projectDir);
            addConnection('mine', { ...CONNECTION });
            clearConfigCache();

            expect(Object.keys(loadOrCreateConfig().connections)).toEqual(['mine']);
        } finally {
            process.chdir(originalCwd);
            fs.rmSync(projectDir, { recursive: true, force: true });
        }
    });
});

describe('shadowingWarning', () => {
    it('is null when sherlock reads the config it writes', () => {
        addConnection('prod', { ...CONNECTION });
        expect(shadowingWarning()).toBeNull();
    });

    it('names SHERLOCK_CONFIG, and says to unset it, when it points elsewhere', () => {
        const other = path.join(tempDir, 'other.json');
        fs.writeFileSync(other, JSON.stringify({ connections: {} }), 'utf-8');
        process.env.SHERLOCK_CONFIG = other;
        try {
            const warning = shadowingWarning();
            expect(warning).toContain(other);
            expect(warning).toContain('Unset SHERLOCK_CONFIG');
        } finally {
            delete process.env.SHERLOCK_CONFIG;
        }
    });

    it('names a project .sherlock.json, and says to run elsewhere, when one is in the working directory', () => {
        const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-project-'));
        const originalCwd = process.cwd();
        fs.writeFileSync(path.join(projectDir, '.sherlock.json'), JSON.stringify({ connections: {} }), 'utf-8');
        try {
            process.chdir(projectDir);
            const warning = shadowingWarning();
            expect(warning).toContain('.sherlock.json');
            expect(warning).toContain('without a .sherlock.json');
            expect(warning).not.toContain('SHERLOCK_CONFIG');
        } finally {
            process.chdir(originalCwd);
            fs.rmSync(projectDir, { recursive: true, force: true });
        }
    });
});
