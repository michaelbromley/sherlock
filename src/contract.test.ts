import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CONTRACT_VERSION, type Envelope } from './output/envelope';

/**
 * The output contract, command by command: stdout is one envelope on one
 * line, `ok` and the exit code agree, and `meta.contract` is the contract's
 * version. Every command runs against a SQLite file; the Redis commands run
 * too when SHERLOCK_TEST_REDIS_URL is set.
 *
 * Nothing on this machine is read or written: the config, cache, logs and
 * tunnel state all live in a temporary directory.
 */

const CLI = path.join(import.meta.dir, 'query-db.ts');

let dir: string;
let configPath: string;

beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-contract-'));
    const db = new Database(path.join(dir, 'app.db'), { create: true });
    db.run('CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, note TEXT)');
    db.run('CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), total NUMERIC DEFAULT 0)');
    db.run('CREATE INDEX orders_customer ON orders (customer_id)');
    db.run(`WITH RECURSIVE g(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM g WHERE n < 300)
            INSERT INTO customers SELECT n, 'customer ' || n, printf('%.900c', 'x') FROM g`);
    db.close();

    configPath = path.join(dir, 'config.json');
    const connections: Record<string, unknown> = {
        app: { type: 'sqlite', filename: path.join(dir, 'app.db') },
    };
    if (process.env.SHERLOCK_TEST_REDIS_URL) connections.cache = { url: process.env.SHERLOCK_TEST_REDIS_URL };
    fs.writeFileSync(configPath, JSON.stringify({ connections }));
});

afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

function sherlock(args: string[]): { status: number | null; envelope: Envelope; stdout: string } {
    const result = spawnSync('bun', [CLI, '--config', configPath, ...args], {
        encoding: 'utf-8',
        env: { ...process.env, HOME: dir, XDG_CONFIG_HOME: path.join(dir, 'xdg'), SHERLOCK_CONFIG: '' },
        // No terminal: commands that prompt must refuse rather than wait
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
    });
    const lines = result.stdout.split('\n').filter((line) => line !== '');
    expect(lines).toHaveLength(1);
    return { status: result.status, envelope: JSON.parse(lines[0]) as Envelope, stdout: result.stdout };
}

/** Run a command and check the envelope rules every command keeps */
function run(args: string[], expected: { ok: boolean; code?: string; command: string }): Envelope {
    const { status, envelope } = sherlock(args);
    expect(envelope.meta.contract).toBe(CONTRACT_VERSION);
    expect(envelope.meta.command).toBe(expected.command);
    expect(envelope.ok).toBe(expected.ok);
    expect(Array.isArray(envelope.warnings)).toBe(true);
    if (expected.ok) {
        expect(status).toBe(0);
        expect(envelope).not.toHaveProperty('error');
    } else {
        expect(envelope.error?.code).toBe(expected.code as never);
        expect(status).toBe(envelope.error?.code === 'USAGE' ? 2 : 1);
    }
    return envelope;
}

const resultShape = expect.objectContaining({
    columns: expect.any(Array),
    rows: expect.any(Array),
    rowCount: expect.any(Number),
});

describe('SQL commands', () => {
    it('tables', () => {
        expect(run(['-c', 'app', 'tables'], { ok: true, command: 'tables' }).data).toEqual({ tables: ['customers', 'orders'] });
    });

    it('describe: the same columns on every database', () => {
        const { data, meta } = run(['-c', 'app', 'describe', 'orders'], { ok: true, command: 'describe' }) as Envelope<{ columns: Array<{ name: string }>; rows: unknown[][] }>;
        expect(data!.columns.map((c) => c.name)).toEqual(['name', 'type', 'nullable', 'default', 'primaryKey']);
        expect(data!.rows[0]).toEqual(['id', 'INTEGER', true, null, true]);
        expect(meta).toMatchObject({ connection: 'app', dbType: 'sqlite' });
    });

    it('sample: -n raises the row cap', () => {
        const { data } = run(['-c', 'app', '--max-cell', '5', 'sample', 'customers', '-n', '250'], { ok: true, command: 'sample' }) as Envelope<{ rowCount: number }>;
        expect(data!.rowCount).toBe(250);
    });

    it('stats', () => {
        const { data } = run(['-c', 'app', 'stats', 'customers'], { ok: true, command: 'stats' });
        expect(data).toEqual({ rowCount: 300, columns: resultShape });
    });

    it('fk and indexes', () => {
        const fk = run(['-c', 'app', 'fk', 'orders'], { ok: true, command: 'fk' });
        expect(fk.data).toEqual({ references: resultShape, referencedBy: resultShape });
        expect(run(['-c', 'app', 'indexes', 'orders'], { ok: true, command: 'indexes' }).data).toEqual({ indexes: resultShape });
    });

    it('query: capped, with the cut reported', () => {
        const envelope = run(['-c', 'app', 'query', 'SELECT * FROM customers'], { ok: true, command: 'query' });
        expect(envelope.data).toMatchObject({ truncated: { moreRows: true } });
        expect(envelope.warnings.map((w) => w.code)).toContain('RESULT_TRUNCATED');
    });

    it('query: a rejected query fails with exit 1', () => {
        run(['-c', 'app', 'query', 'SELECT nope FROM customers'], { ok: false, code: 'QUERY_FAILED', command: 'query' });
        run(['-c', 'app', 'query', 'DELETE FROM customers'], { ok: false, code: 'QUERY_REFUSED', command: 'query' });
        run(['-c', 'app', 'describe', 'nope'], { ok: false, code: 'NOT_FOUND', command: 'describe' });
    });

    it('query --out', () => {
        const out = path.join(dir, 'all.csv');
        const { data } = run(['-c', 'app', 'query', 'SELECT id, name FROM customers', '--out', out], { ok: true, command: 'query' });
        expect(data).toMatchObject({ file: out, format: 'csv', rowCount: 300 });
        expect(fs.readFileSync(out, 'utf-8').trimEnd().split('\n')).toHaveLength(301);
    });

    it('introspect, then from the cache', () => {
        const fresh = run(['-c', 'app', 'introspect', '--refresh'], { ok: true, command: 'introspect' });
        expect(fresh.data).toMatchObject({ tables: { customers: { columns: resultShape }, orders: { columns: resultShape } }, cache: { fromCache: false } });
        const cached = run(['-c', 'app', 'introspect'], { ok: true, command: 'introspect' });
        expect(cached.data).toMatchObject({ cache: { fromCache: true } });
        expect(cached.meta.dbType).toBe('sqlite');
    });

    it('introspect drops whole tables to fit the size cap', () => {
        const { data, warnings } = run(['-c', 'app', '--max-bytes', '900', 'introspect'], { ok: true, command: 'introspect' }) as Envelope<{ tables: object; truncated: { tablesOmitted: string[] } }>;
        expect(Object.keys(data!.tables)).toEqual(['customers']);
        expect(data!.truncated.tablesOmitted).toEqual(['orders']);
        expect(warnings.map((w) => w.code)).toContain('RESULT_TRUNCATED');
    });
});

describe('connection and setup commands', () => {
    it('connection list', () => {
        const { data } = run(['connection', 'list'], { ok: true, command: 'connection list' }) as Envelope<{ connections: Array<{ name: string }> }>;
        expect(data!.connections.map((c) => c.name)).toContain('app');
    });

    it('connection add, with its notes as warnings', () => {
        const envelope = run(
            ['connection', 'add', 'added', '--type', 'postgres', '--host', 'db', '--username', 'u', '--database', 'd'],
            { ok: true, command: 'connection add' }
        );
        expect(envelope.data).toMatchObject({ connection: 'added', action: 'added' });
        expect(envelope.warnings.map((w) => w.code)).toEqual(['NO_PASSWORD']);
    });

    it('connection add --password-prompt refuses at once without a terminal, saving nothing', () => {
        const envelope = run(
            ['connection', 'add', 'prompted', '--type', 'postgres', '--host', 'db', '--username', 'u', '--database', 'd', '--password-prompt'],
            { ok: false, code: 'USAGE', command: 'connection add' }
        );
        expect(envelope.error?.details).toEqual({ flag: '--password-prompt' });
        // connection add writes the user config, not --config
        const userConfig = path.join(dir, 'xdg', 'sherlock', 'config.json');
        const written = fs.existsSync(userConfig) ? fs.readFileSync(userConfig, 'utf-8') : '';
        expect(written).not.toContain('prompted');
    });

    it('doctor', () => {
        const { data } = run(['doctor', 'app'], { ok: true, command: 'doctor' });
        expect(data).toEqual({ checks: expect.any(Array) });
    });

    it('doctor of a connection that fails: the cause, with the report as data', () => {
        const broken = path.join(dir, 'broken.json');
        fs.writeFileSync(broken, JSON.stringify({ connections: { gone: { type: 'sqlite', filename: path.join(dir, 'missing.db') } } }));
        const result = spawnSync('bun', [CLI, '--config', broken, 'doctor', 'gone'], {
            encoding: 'utf-8', env: { ...process.env, HOME: dir, XDG_CONFIG_HOME: path.join(dir, 'xdg') },
        });
        const envelope = JSON.parse(result.stdout) as Envelope<{ checks: Array<{ name: string; status: string }> }>;
        expect(result.status).toBe(1);
        expect(envelope.error).toMatchObject({ code: 'NOT_FOUND', details: { check: 'query' } });
        expect(envelope.data!.checks.at(-1)).toMatchObject({ name: 'query', status: 'fail' });
    });

    it('tunnel status and stop', () => {
        expect(run(['tunnel', 'status'], { ok: true, command: 'tunnel status' }).data).toEqual({ tunnels: [] });
        expect(run(['tunnel', 'stop'], { ok: true, command: 'tunnel stop' }).data).toEqual({ stopped: [] });
        const named = run(['tunnel', 'stop', 'nothing'], { ok: false, code: 'NOT_FOUND', command: 'tunnel stop' });
        expect(named.data).toEqual({ stopped: [expect.objectContaining({ name: 'nothing', stopped: false })] });
    });

    it('keychain list', () => {
        expect(run(['keychain', 'list'], { ok: true, command: 'keychain list' }).data).toMatchObject({ passwords: expect.any(Array) });
    });

    it('guide --json', () => {
        expect(run(['guide', '--json'], { ok: true, command: 'guide' }).data).toMatchObject({ topic: 'main', text: expect.stringContaining('sherlock') });
    });

    it('update, which only a compiled binary can do', () => {
        run(['update', '--yes'], { ok: false, code: 'UPDATE_FAILED', command: 'update' });
    });

    it.each([
        [['manage'], 'manage'],
        [['config', 'export'], 'config export'],
        [['config', 'import', 'x.enc'], 'config import'],
        [['keychain', 'set', 'someone'], 'keychain set'],
    ])('%j refuses at once without a terminal', (args, command) => {
        run(args, { ok: false, code: 'USAGE', command });
    });

    it.each(['connections', 'test', 'init'])('the removed hidden command %s is unknown', (command) => {
        run([command, 'app'], { ok: false, code: 'USAGE', command: '' });
    });
});

describe.skipIf(!process.env.SHERLOCK_TEST_REDIS_URL)('Redis commands', () => {
    it.each([
        [['info'], 'info'],
        [['keys'], 'keys'],
        [['slowlog'], 'slowlog'],
        [['command', 'PING'], 'command'],
    ])('%j', (args, command) => {
        const { data } = run(['-c', 'cache', ...args], { ok: true, command });
        expect(data).toHaveProperty('truncated');
    });

    it('get and inspect of a key that does not exist', () => {
        run(['-c', 'cache', 'get', 'sherlock-contract-no-such-key'], { ok: false, code: 'NOT_FOUND', command: 'get' });
        run(['-c', 'cache', 'inspect', 'sherlock-contract-no-such-key'], { ok: false, code: 'NOT_FOUND', command: 'inspect' });
    });
});

describe('--format human', () => {
    it('prints text instead of the envelope, with the same exit code', () => {
        const result = spawnSync('bun', [CLI, '--config', configPath, '-f', 'human', '-c', 'app', 'query', 'SELECT id FROM customers LIMIT 2'], {
            encoding: 'utf-8', env: { ...process.env, HOME: dir, XDG_CONFIG_HOME: path.join(dir, 'xdg') },
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('| id |');
        expect(() => JSON.parse(result.stdout)).toThrow();
    });

    it('accepts markdown as another name for it', () => {
        const result = spawnSync('bun', [CLI, '--config', configPath, '-f', 'markdown', '-c', 'app', 'tables'], { encoding: 'utf-8' });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('- customers');
    });
});
