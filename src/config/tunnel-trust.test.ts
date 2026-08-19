import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveConnection, clearConfigCache, isUntrustedSource } from './index';
import { findConfig } from './paths';

/**
 * A tunnel runs a shell command from the config file. Sherlock discovers
 * `.sherlock.json` from the current directory, so honouring a tunnel found
 * there would mean cloning a repository and running any sherlock command
 * executes whatever that repository asked for.
 *
 * These tests pin that refusal. They drive `resolveConnection`, which is the
 * real entry point every SQL and Redis command goes through, rather than the
 * guard in isolation.
 */

const TUNNEL_CONNECTION = {
    connections: {
        pwn: {
            type: 'postgres',
            host: 'db.example.com',
            port: 5432,
            username: 'u',
            password: 'p',
            database: 'd',
            // Would run if the guard failed. Never executed by these tests: the
            // refusal happens before any process is spawned.
            tunnel: { command: 'touch {{port}}-should-never-run' },
        },
    },
};

let tempDir: string;
let originalCwd: string;

beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-trust-'));
    clearConfigCache();
});

afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    clearConfigCache();
    delete process.env.SHERLOCK_CONFIG;
});

function writeConfig(fileName: string): string {
    const file = path.join(tempDir, fileName);
    fs.writeFileSync(file, JSON.stringify(TUNNEL_CONNECTION), 'utf-8');
    return file;
}

describe('tunnels from a config found in the working directory', () => {
    it('are refused when discovered as a project-local .sherlock.json', async () => {
        writeConfig('.sherlock.json');
        process.chdir(tempDir);

        // No configPath: this is the discovery path a bare `sherlock -c pwn` takes.
        await expect(resolveConnection('pwn')).rejects.toThrow(
            /project-local \.sherlock\.json/
        );
    });

    it('names the file so the user can decide whether to trust it', async () => {
        writeConfig('.sherlock.json');
        process.chdir(tempDir);

        await expect(resolveConnection('pwn')).rejects.toThrow(/--config/);
    });

    it('does not spawn the tunnel command before refusing', async () => {
        writeConfig('.sherlock.json');
        process.chdir(tempDir);

        await resolveConnection('pwn').catch(() => undefined);

        const spawned = fs.readdirSync(tempDir).filter(f => f.endsWith('-should-never-run'));
        expect(spawned).toEqual([]);
    });
});

/*
 * The trusted direction is asserted through `findConfig` + `isUntrustedSource`
 * rather than by driving `resolveConnection` to completion. Letting a tunnel
 * through starts a real background supervisor and waits out its ready timeout,
 * which would make the suite slow and dependent on a writable config directory.
 */
describe('config sources the user chose deliberately', () => {
    it('are not refused when the path was passed with --config', () => {
        const file = writeConfig('chosen.json');
        process.chdir(tempDir);

        expect(isUntrustedSource(findConfig(file)?.source ?? null)).toBe(false);
    });

    it('are not refused when the path came from SHERLOCK_CONFIG', () => {
        const file = writeConfig('chosen.json');
        process.chdir(tempDir);
        process.env.SHERLOCK_CONFIG = file;

        expect(isUntrustedSource(findConfig()?.source ?? null)).toBe(false);
    });

    it('prefers an explicit --config over a .sherlock.json in the same directory', () => {
        writeConfig('.sherlock.json');
        const chosen = writeConfig('chosen.json');
        process.chdir(tempDir);

        // Otherwise a hostile repo could shadow the config the user asked for.
        expect(findConfig(chosen)?.source).toBe('cli');
        expect(findConfig(chosen)?.path).toBe(chosen);
    });
});

describe('config source discovery', () => {
    it('reports a project-local .sherlock.json as untrusted', () => {
        writeConfig('.sherlock.json');
        process.chdir(tempDir);

        const found = findConfig();
        expect(found?.source).toBe('project');
        expect(isUntrustedSource(found?.source ?? null)).toBe(true);
    });

    it('reports an explicit --config path as trusted', () => {
        const file = writeConfig('chosen.json');

        const found = findConfig(file);
        expect(found?.source).toBe('cli');
        expect(isUntrustedSource(found?.source ?? null)).toBe(false);
    });

    it('reports SHERLOCK_CONFIG as trusted', () => {
        const file = writeConfig('chosen.json');
        process.env.SHERLOCK_CONFIG = file;

        const found = findConfig();
        expect(found?.source).toBe('env');
        expect(isUntrustedSource(found?.source ?? null)).toBe(false);
    });

    it('treats a legacy config.ts in the working directory as untrusted', () => {
        expect(isUntrustedSource('legacy')).toBe(true);
    });

    it('treats the user config directory and portable mode as trusted', () => {
        expect(isUntrustedSource('user')).toBe(false);
        expect(isUntrustedSource('portable')).toBe(false);
    });
});
