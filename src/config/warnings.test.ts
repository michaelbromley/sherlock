import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { clearConfigCache, loadConfigFile, resolveConnection, resolveConnectionCredentials } from './index';
import { WarningCollector } from '../output/warnings';

/**
 * Warnings found while reading config and resolving a connection go to the
 * collector they are given, for the envelope, instead of being printed.
 */

let dir: string;
let configPath: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-warnings-'));
    configPath = path.join(dir, 'config.json');
    clearConfigCache();
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    clearConfigCache();
});

describe('config warnings', () => {
    it('collects PLAINTEXT_PASSWORD, and prints nothing', async () => {
        fs.writeFileSync(configPath, JSON.stringify({
            connections: { prod: { type: 'postgres', host: 'db', username: 'u', database: 'd', password: 'secret' } },
        }));
        const warnings = new WarningCollector();
        const written: string[] = [];
        const write = process.stderr.write;
        process.stderr.write = ((chunk: string) => { written.push(String(chunk)); return true; }) as typeof process.stderr.write;
        try {
            await resolveConnectionCredentials('prod', configPath, warnings);
        } finally {
            process.stderr.write = write;
        }
        expect(warnings.list).toEqual([expect.objectContaining({ code: 'PLAINTEXT_PASSWORD', details: { connection: 'prod' } })]);
        expect(JSON.stringify(warnings.list)).not.toContain('secret');
        expect(written).toEqual([]);
    });

    it('does not warn about a password from the environment', async () => {
        fs.writeFileSync(configPath, JSON.stringify({
            connections: { prod: { type: 'postgres', host: 'db', username: 'u', database: 'd', password: { $env: 'HOME' } } },
        }));
        const warnings = new WarningCollector();
        await resolveConnectionCredentials('prod', configPath, warnings);
        expect(warnings.list).toEqual([]);
    });

    it('collects TLS_VERIFY_THROUGH_TUNNEL before the tunnel is started', async () => {
        fs.writeFileSync(configPath, JSON.stringify({
            connections: {
                prod: {
                    type: 'postgres', host: 'db', username: 'u', database: 'd', password: { $env: 'HOME' },
                    ssl: { rejectUnauthorized: true },
                    // An unknown provider, so the tunnel fails without starting anything
                    tunnel: { provider: 'nowhere' },
                },
            },
        }));
        const warnings = new WarningCollector();
        await expect(resolveConnection('prod', configPath, warnings)).rejects.toMatchObject({ code: 'CONFIG_INVALID' });
        expect(warnings.list).toEqual([expect.objectContaining({ code: 'TLS_VERIFY_THROUGH_TUNNEL', details: { connection: 'prod' } })]);
    });

    it('collects CONFIG_LEGACY once, however often the file is read', () => {
        const legacyPath = path.join(dir, 'config.ts');
        fs.writeFileSync(legacyPath, `module.exports = { connections: { old: { type: 'better-sqlite3', database: 'old.db' } } };`);
        const warnings = new WarningCollector();
        const config = loadConfigFile(legacyPath, warnings);
        loadConfigFile(legacyPath, warnings);
        expect(config.connections.old).toMatchObject({ type: 'sqlite', filename: 'old.db' });
        expect(warnings.list).toEqual([expect.objectContaining({ code: 'CONFIG_LEGACY', details: { path: legacyPath } })]);
    });
});
