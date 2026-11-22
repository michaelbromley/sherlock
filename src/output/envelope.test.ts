import { describe, it, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SherlockError, toErrorBody, exitCodeFor, usageError } from '../errors';
import { CONTRACT_VERSION, Invocation, type Envelope } from './envelope';

const CLI = path.join(import.meta.dir, '..', 'query-db.ts');

describe('toErrorBody', () => {
    it('keeps a SherlockError as it is', () => {
        const error = new SherlockError('CONNECT_REFUSED', 'Nothing answered.', {
            fix: 'Check the port.',
            details: { host: 'db', port: 5432 },
        });
        expect(toErrorBody(error)).toEqual({
            code: 'CONNECT_REFUSED',
            message: 'Nothing answered.',
            fix: 'Check the port.',
            details: { host: 'db', port: 5432 },
        });
    });

    it('reports anything else as INTERNAL, with a fix', () => {
        const body = toErrorBody(new TypeError('x is undefined'));
        expect(body.code).toBe('INTERNAL');
        expect(body.message).toBe('x is undefined');
        expect(body.fix).toBeDefined();
        expect(toErrorBody('a string').message).toBe('a string');
    });

    it('leaves out empty details', () => {
        expect(toErrorBody(new SherlockError('INTERNAL', 'm', { details: {} }))).not.toHaveProperty('details');
    });
});

describe('exitCodeFor', () => {
    it('is 2 for a usage error and 1 otherwise', () => {
        expect(exitCodeFor(toErrorBody(usageError('bad flag', '--x')))).toBe(2);
        expect(exitCodeFor(toErrorBody(new Error('boom')))).toBe(1);
    });
});

describe('Invocation', () => {
    it('fills meta and the warnings on success', () => {
        const run = new Invocation();
        run.command = 'query';
        run.connection = 'prod';
        run.dbType = 'postgres';
        run.warnings.add({ code: 'PLAINTEXT_PASSWORD', message: 'm', details: { connection: 'prod' } });
        const envelope = run.succeed({ rows: [] });
        expect(envelope.ok).toBe(true);
        expect(envelope.data).toEqual({ rows: [] });
        expect(envelope).not.toHaveProperty('error');
        expect(envelope.warnings).toHaveLength(1);
        expect(envelope.meta).toMatchObject({ contract: CONTRACT_VERSION, command: 'query', connection: 'prod', dbType: 'postgres' });
        expect(typeof envelope.meta.durationMs).toBe('number');
    });

    it('records each warning once', () => {
        const run = new Invocation();
        run.warnings.add({ code: 'PLAINTEXT_PASSWORD', message: 'same' });
        run.warnings.add({ code: 'PLAINTEXT_PASSWORD', message: 'same' });
        expect(run.warnings.list).toHaveLength(1);
    });

    it('keeps a report as data on failure', () => {
        const envelope = new Invocation().fail(new SherlockError('TUNNEL_DOWN', 'gone'), { checks: [] });
        expect(envelope.ok).toBe(false);
        expect(envelope.data).toEqual({ checks: [] });
        expect(envelope.error?.code).toBe('TUNNEL_DOWN');
    });

    it('leaves data out of a failure with no report', () => {
        expect(new Invocation().fail(new Error('x'))).not.toHaveProperty('data');
    });
});

/** Run the CLI with no config to be found, so nothing on this machine is read */
function sherlock(...args: string[]) {
    const result = spawnSync('bun', [CLI, ...args], {
        encoding: 'utf-8',
        env: { ...process.env, SHERLOCK_CONFIG: '', HOME: '/nonexistent' },
    });
    const lines = result.stdout.split('\n').filter((line) => line !== '');
    return { status: result.status, lines, stderr: result.stderr };
}

describe('a failing command', () => {
    const cases: Array<{ args: string[]; code: string; exit: number; command: string }> = [
        { args: ['--bogus', 'tables'], code: 'USAGE', exit: 2, command: 'tables' },
        { args: ['describe'], code: 'USAGE', exit: 2, command: 'describe' },
        { args: ['no-such-command'], code: 'USAGE', exit: 2, command: '' },
        { args: ['-u', 'ftp://host/db', 'tables'], code: 'USAGE', exit: 2, command: 'tables' },
        { args: ['-u', 'sqlite://:memory:', 'query', 'delete from t'], code: 'QUERY_REFUSED', exit: 1, command: 'query' },
        { args: ['-u', 'sqlite://:memory:', 'info'], code: 'WRONG_DATABASE_TYPE', exit: 1, command: 'info' },
        { args: ['guide', 'no-such-topic'], code: 'USAGE', exit: 2, command: 'guide' },
    ];

    for (const { args, code, exit, command } of cases) {
        it(`sherlock ${args.join(' ')} prints one ${code} envelope and exits ${exit}`, () => {
            const { status, lines, stderr } = sherlock(...args);
            expect(lines).toHaveLength(1);
            const envelope = JSON.parse(lines[0]) as Envelope;
            expect(envelope.ok).toBe(false);
            expect(envelope.error?.code).toBe(code as never);
            expect(envelope.warnings).toEqual([]);
            expect(envelope.meta.contract).toBe(CONTRACT_VERSION);
            expect(envelope.meta.command).toBe(command);
            expect(status).toBe(exit);
            expect(stderr).toContain(`error ${code}:`);
        });
    }

    it('names the refused part of a query in details', () => {
        const { lines } = sherlock('-u', 'sqlite://:memory:', 'query', 'select 1 from t where x in (delete from t)');
        const envelope = JSON.parse(lines[0]) as Envelope;
        expect(envelope.error?.details).toEqual({ reason: 'KEYWORD', keyword: 'DELETE' });
    });

    it('still prints help and the version as plain text, exit 0', () => {
        const help = spawnSync('bun', [CLI, '--help'], { encoding: 'utf-8' });
        expect(help.status).toBe(0);
        expect(help.stdout).toContain('Usage: sherlock');
        const version = spawnSync('bun', [CLI, '--version'], { encoding: 'utf-8' });
        expect(version.status).toBe(0);
        expect(version.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });
});

describe('warnings', () => {
    it('are in the envelope of a command that then fails, and on stderr', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-envelope-'));
        try {
            const configPath = path.join(dir, 'config.json');
            fs.writeFileSync(configPath, JSON.stringify({
                connections: {
                    // Nothing listens on port 1, so the command fails after resolving the connection
                    prod: { type: 'postgres', host: '127.0.0.1', port: 1, username: 'u', database: 'd', password: 'literal' },
                },
            }));
            const { status, lines, stderr } = sherlock('--config', configPath, '-c', 'prod', 'tables');
            const envelope = JSON.parse(lines[0]) as Envelope;
            expect(status).toBe(1);
            expect(envelope.error?.code).toBe('CONNECT_REFUSED');
            expect(envelope.meta).toMatchObject({ connection: 'prod', dbType: 'postgres' });
            expect(envelope.warnings).toEqual([expect.objectContaining({ code: 'PLAINTEXT_PASSWORD', details: { connection: 'prod' } })]);
            expect(stderr).toContain('Warning: The password of connection "prod" is stored as plaintext');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
