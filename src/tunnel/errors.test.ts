import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Envelope } from '../output/envelope';

const CLI = path.join(import.meta.dir, '..', 'query-db.ts');

/**
 * A tunnel is started by a separate supervisor process, which reports a
 * failure through its state file. These run the real CLI to check that the
 * failure's code survives that trip.
 */
let dir: string;
let configPath: string;

beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-tunnel-errors-'));
    configPath = path.join(dir, 'config.json');
    fs.mkdirSync(path.join(dir, 'northflank'));
    fs.writeFileSync(path.join(dir, 'northflank', 'config.json'), JSON.stringify({ contexts: [{ name: 'other', token: 't' }] }));
    fs.writeFileSync(configPath, JSON.stringify({
        connections: {
            exits: {
                type: 'postgres', host: 'db', username: 'u', database: 'd', password: 'p',
                tunnel: { command: "sh -c 'echo going; exit 3'", localPort: 45991, readyTimeout: '5s' },
            },
            'no-login': {
                type: 'postgres', host: 'db', username: 'u', database: 'd', password: 'p',
                tunnel: {
                    provider: 'northflank', context: 'missing', project: 'p', addon: 'a',
                    configDir: path.join(dir, 'northflank'), readyTimeout: '5s',
                },
            },
        },
    }));
});

afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

function sherlock(...args: string[]): { status: number | null; envelope: Envelope } {
    const result = spawnSync('bun', [CLI, '--config', configPath, ...args], {
        encoding: 'utf-8',
        // Tunnel state and logs go here rather than the user's config directory
        env: { ...process.env, XDG_CONFIG_HOME: path.join(dir, 'xdg') },
        timeout: 20_000,
    });
    return { status: result.status, envelope: JSON.parse(result.stdout) as Envelope };
}

describe('a tunnel that does not come up', () => {
    it('is TUNNEL_FAILED, with the provider and the log file', () => {
        const { status, envelope } = sherlock('-c', 'exits', 'tables');
        expect(status).toBe(1);
        expect(envelope.error?.code).toBe('TUNNEL_FAILED');
        expect(envelope.error?.message).toMatch(/exited with code 3/);
        expect(envelope.error?.details).toMatchObject({ provider: 'command' });
        expect(String(envelope.error?.details?.logFile)).toEndWith('.log');
        expect(envelope.meta.connection).toBe('exits');
    }, 20_000);

    it("keeps the provider's own code, and only that code's details", () => {
        const { envelope } = sherlock('-c', 'no-login', 'tables');
        expect(envelope.error?.code).toBe('PROVIDER_AUTH');
        expect(envelope.error?.details).toEqual({ provider: 'northflank', context: 'missing' });
        expect(envelope.error?.fix).toContain('northflank login');
        // The message explains the failure; the log tail is only for unexplained ones.
        expect(envelope.error?.message).not.toContain('Last output');
    }, 20_000);
});
