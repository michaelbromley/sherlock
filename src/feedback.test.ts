import { describe, it, expect, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isPrerelease, redactUrls } from './feedback';
import { guideText } from './guide';

const CLI = path.join(import.meta.dir, 'query-db.ts');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-feedback-'));

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('isPrerelease', () => {
    it.each([['2.0.0-beta.2', true], ['2.0.0-rc.1', true], ['2.0.0', false], ['1.9.1', false]])('%s is %p', (version, expected) => {
        expect(isPrerelease(version)).toBe(expected);
    });
});

describe('redactUrls', () => {
    it('hides the password in a URL and leaves the rest', () => {
        expect(redactUrls('Ran: sherlock -u postgres://shop:corner-shop-dev@127.0.0.1:55433/db tables'))
            .toBe('Ran: sherlock -u postgres://shop:***@127.0.0.1:55433/db tables');
        expect(redactUrls('no url here, and http://example.com/a stays')).toBe('no url here, and http://example.com/a stays');
    });
});

describe('the guide', () => {
    it('asks for feedback in a pre-release only', () => {
        expect(guideText(undefined, '2.0.0-beta.2')).toContain('## Pre-release: record problems');
        expect(guideText(undefined, '2.0.0')).not.toContain('Pre-release');
        expect(guideText('transfer', '2.0.0-beta.2')).not.toContain('Pre-release');
    });
});

describe('sherlock feedback', () => {
    it('appends an entry to feedback.md in the config directory, with passwords hidden', () => {
        const run = (args: string[], input?: string) => spawnSync('bun', [CLI, 'feedback', ...args], {
            encoding: 'utf-8', input, env: { ...process.env, XDG_CONFIG_HOME: dir, SHERLOCK_CONFIG: '' },
        });
        const first = run(['introspect fails on a hyphenated name', '--details', '-'], 'Ran: sherlock -u postgres://u:secret@h/d introspect\n');
        expect(first.status).toBe(0);
        const envelope = JSON.parse(first.stdout);
        expect(envelope).toMatchObject({ ok: true, data: { recorded: true } });
        run(['a second problem', '--details', 'short note']);

        const text = fs.readFileSync(envelope.data.file, 'utf-8');
        expect(envelope.data.file).toBe(path.join(dir, 'sherlock', 'feedback.md'));
        expect(text.match(/^## /gm)).toHaveLength(2);
        expect(text).toContain('**introspect fails on a hyphenated name**');
        expect(text).toContain('postgres://u:***@h/d');
        expect(text).not.toContain('secret');
        expect(text).toContain('short note');
    });
});
