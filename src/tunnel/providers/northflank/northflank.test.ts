import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveNorthflankConfig } from './config';
import { loadNorthflankContext, northflankConfigDir, redactToken } from './context';
import { selectEndpoint, isPrimary, type ForwardedPort } from './endpoint';
import { checkNorthflankHost, recognizeNorthflankCommand, NORTHFLANK_ENDPOINT_PATTERN } from './command';
import { NorthflankApiError, type NorthflankClient } from './client';
import { createNorthflankProvider } from './index';
import type { OpenTunnelContext } from '../types';

const VALID = { provider: 'northflank', context: 'kbart', project: 'artsupplies', addon: 'postgresql' };
const TOKEN = 'nf-secret-token-value';

describe('resolveNorthflankConfig', () => {
    it('accepts the minimal block and leaves the endpoint to be chosen', () => {
        expect(resolveNorthflankConfig(VALID, 'prod')).toEqual({
            context: 'kbart', project: 'artsupplies', addon: 'postgresql',
        });
    });

    it('keeps every optional setting', () => {
        const config = resolveNorthflankConfig(
            { ...VALID, endpoint: 'primary', configDir: '~/.northflank-kbart', team: 'my-team', port: 5432, idleTimeout: '5m' },
            'prod'
        );
        expect(config).toEqual({
            context: 'kbart', project: 'artsupplies', addon: 'postgresql',
            endpoint: 'primary', configDir: '~/.northflank-kbart', team: 'my-team', port: 5432,
        });
    });

    it.each(['context', 'project', 'addon'])('requires %s', (key) => {
        const tunnel = { ...VALID, [key]: undefined };
        expect(() => resolveNorthflankConfig(tunnel, 'prod')).toThrow(
            new RegExp(`connection "prod": "${key}" is required`)
        );
    });

    it('rejects a display name where an id belongs', () => {
        expect(() => resolveNorthflankConfig({ ...VALID, project: 'Art Supplies' }, 'prod')).toThrow(
            /"project" must be the project's id/
        );
    });

    it('rejects an endpoint other than read or primary', () => {
        expect(() => resolveNorthflankConfig({ ...VALID, endpoint: 'replica' }, 'prod')).toThrow(
            /"endpoint" must be "read" or "primary"/
        );
    });

    it('rejects a misspelt setting instead of ignoring it', () => {
        expect(() => resolveNorthflankConfig({ ...VALID, adon: 'x' }, 'prod')).toThrow(/unknown setting "adon"/);
    });

    it('rejects a command, which belongs to a command tunnel', () => {
        expect(() => resolveNorthflankConfig({ ...VALID, command: 'northflank forward' }, 'prod')).toThrow(
            /unknown setting "command"/
        );
    });

    it('rejects an out-of-range port', () => {
        expect(() => resolveNorthflankConfig({ ...VALID, port: 70000 }, 'prod')).toThrow(/"port" must be/);
    });
});

describe('selectEndpoint', () => {
    const forward = (hostname: string, port: number, extra: Partial<ForwardedPort> = {}): ForwardedPort => ({
        address: '127.0.0.1', port, hostnames: [hostname], portRemote: 5432, protocol: 'TCP', ...extra,
    });
    const primary = forward('primary.postgresql--artsupplies--abc.addon.code.run', 40001);
    const replica = forward('replica.postgresql--artsupplies--abc.addon.code.run', 40002);

    it('tells the primary from a replica by hostname', () => {
        expect(isPrimary(primary)).toBe(true);
        expect(isPrimary(replica)).toBe(false);
    });

    it('defaults to the read replica when the addon has one', () => {
        expect(selectEndpoint([primary, replica], undefined)).toEqual({ forward: replica, role: 'read' });
    });

    it('does not depend on the order the endpoints come back in', () => {
        expect(selectEndpoint([replica, primary], undefined).forward).toBe(replica);
        expect(selectEndpoint([replica, primary], 'primary').forward).toBe(primary);
    });

    it('defaults to the primary when there is no replica', () => {
        expect(selectEndpoint([primary], undefined)).toEqual({ forward: primary, role: 'primary' });
    });

    it('treats a lone endpoint as the primary whatever it is called', () => {
        const only = forward('postgresql-0.postgresql--artsupplies--abc.addon.code.run', 40003);
        expect(selectEndpoint([only], undefined)).toEqual({ forward: only, role: 'primary' });
        expect(selectEndpoint([only], 'primary').forward).toBe(only);
    });

    it('uses the primary when asked to', () => {
        expect(selectEndpoint([primary, replica], 'primary')).toEqual({ forward: primary, role: 'primary' });
    });

    it('refuses to fall back to the primary when read was asked for', () => {
        expect(() => selectEndpoint([primary], 'read')).toThrow(/has no read replica/);
    });

    it('accepts any of several replicas', () => {
        const second = forward('replica-1.postgresql--artsupplies--abc.addon.code.run', 40004);
        expect(selectEndpoint([primary, replica, second], 'read').forward).toBe(replica);
    });

    it('asks which port to use rather than guessing between several', () => {
        const pooler = forward('primary.postgresql--artsupplies--abc.addon.code.run', 40005, {
            portRemote: 6432, portName: 'pooler',
        });
        expect(() => selectEndpoint([primary, pooler], undefined)).toThrow(/Set "port"/);
        expect(selectEndpoint([primary, pooler], undefined, 'pooler').forward).toBe(pooler);
        expect(selectEndpoint([primary, pooler], undefined, 5432).forward).toBe(primary);
    });

    it('names the ports on offer when the configured one does not exist', () => {
        expect(() => selectEndpoint([primary], undefined, 'nope')).toThrow(/no port named "nope".*5432 on primary/);
    });

    it('ignores UDP ports and fails when nothing is left', () => {
        expect(() => selectEndpoint([{ ...primary, protocol: 'UDP' }], undefined)).toThrow(/no TCP port/);
        expect(() => selectEndpoint([], undefined)).toThrow(/no TCP port/);
    });
});

describe('loadNorthflankContext', () => {
    let dir: string;
    const write = (content: unknown) =>
        fs.writeFileSync(path.join(dir, 'config.json'), typeof content === 'string' ? content : JSON.stringify(content));

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-context-'));
    });
    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('loads the named context, not the current one', () => {
        write({
            current: 'other',
            contexts: [
                { name: 'other', token: 'other-token', host: 'https://api.northflank.com' },
                { name: 'kbart', token: TOKEN, host: 'https://api.example.com', tokenScope: 'org', team: 'my-team' },
            ],
        });
        expect(loadNorthflankContext('kbart', dir)).toEqual({
            name: 'kbart', token: TOKEN, host: 'https://api.example.com', tokenScope: 'org', team: 'my-team',
        });
    });

    it('never writes to the config, so the current context cannot change', () => {
        write({ current: 'other', contexts: [{ name: 'other', token: 'x' }, { name: 'kbart', token: TOKEN }] });
        const before = fs.readFileSync(path.join(dir, 'config.json'), 'utf-8');
        loadNorthflankContext('kbart', dir);
        expect(fs.readFileSync(path.join(dir, 'config.json'), 'utf-8')).toBe(before);
        expect(fs.readdirSync(dir)).toEqual(['config.json']);
    });

    it('defaults the API host', () => {
        write({ contexts: [{ name: 'kbart', token: TOKEN }] });
        expect(loadNorthflankContext('kbart', dir).host).toBe('https://api.northflank.com');
    });

    it('lists the contexts that exist, without their tokens, when the name is wrong', () => {
        write({ contexts: [{ name: 'kbart', token: TOKEN }, { name: 'vendure', token: 'another-secret' }] });
        let message = '';
        try {
            loadNorthflankContext('nope', dir);
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toMatch(/No Northflank context named "nope".*"kbart", "vendure"/);
        expect(message).not.toContain(TOKEN);
        expect(message).not.toContain('another-secret');
    });

    it('does not quote the file when it is not valid JSON', () => {
        write(`{ "contexts": [{ "name": "kbart", "token": "${TOKEN}" `);
        let message = '';
        try {
            loadNorthflankContext('kbart', dir);
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toMatch(/not valid JSON/);
        expect(message).not.toContain(TOKEN);
    });

    it('explains a missing config file', () => {
        expect(() => loadNorthflankContext('kbart', path.join(dir, 'missing'))).toThrow(/Cannot read the Northflank CLI config/);
    });

    it('resolves the config directory: configured, then NF_CONFIG_DIR, then the default', () => {
        expect(northflankConfigDir('/a/b', { NF_CONFIG_DIR: '/env' })).toBe('/a/b');
        expect(northflankConfigDir(undefined, { NF_CONFIG_DIR: '/env' })).toBe('/env');
        expect(northflankConfigDir(undefined, {})).toBe(path.join(os.homedir(), '.northflank'));
        expect(northflankConfigDir('~/.northflank-kbart', {})).toBe(path.join(os.homedir(), '.northflank-kbart'));
    });

    it('redacts a token from text', () => {
        expect(redactToken(`Bearer ${TOKEN} rejected`, TOKEN)).toBe('Bearer [redacted] rejected');
    });
});

describe('northflank CLI commands', () => {
    it('matches both wordings of the endpoint line', () => {
        const pattern = new RegExp(NORTHFLANK_ENDPOINT_PATTERN);
        expect(pattern.exec("> Addon 'pg' is exposed on 127.0.0.1:44109 (TCP)")?.groups).toMatchObject({ host: '127.0.0.1', port: '44109' });
        expect(pattern.exec("> Addon 'pg' is exposed locally on 127.24.1.1:5432 (TCP)")?.groups).toMatchObject({ host: '127.24.1.1', port: '5432' });
    });

    it('reads the project and addon out of a forward command', () => {
        const command = 'NF_CONFIG_DIR=/home/me/.northflank-kbart northflank forward addon --project artsupplies --addon postgresql --skipHostnames';
        expect(recognizeNorthflankCommand(command)?.target).toEqual({
            provider: 'northflank',
            summary: 'artsupplies/postgresql (northflank CLI)',
            details: { project: 'artsupplies', addon: 'postgresql' },
        });
        expect(recognizeNorthflankCommand('northflank forward addon --project=a --addon="b"')?.target.details).toEqual({ project: 'a', addon: 'b' });
    });

    it('leaves other commands alone', () => {
        expect(recognizeNorthflankCommand('ssh -N -L {{port}}:db:5432 bastion')).toBeNull();
        expect(recognizeNorthflankCommand('northflank forward service --project a --service b')).toBeNull();
    });

    it('flags a host that belongs to a different addon', () => {
        // The mistake this check exists for: a tunnel copied from another connection.
        const host = 'primary.postgresql--artsupplies--abc123.addon.code.run';
        expect(checkNorthflankHost(host, 'artsupplies', 'postgresql').verdict).toBe('match');
        expect(checkNorthflankHost(host, 'cloud', 'control-plane-db')).toMatchObject({
            verdict: 'mismatch',
            reason: expect.stringContaining('cloud/control-plane-db'),
        });
    });

    it('does not judge a host that is not a Northflank hostname', () => {
        expect(checkNorthflankHost('127.0.0.1', 'artsupplies', 'postgresql').verdict).toBe('unknown');
        expect(checkNorthflankHost('db.example.com', 'artsupplies', 'postgresql').verdict).toBe('unknown');
    });
});

describe('northflank provider', () => {
    const primary: ForwardedPort = {
        address: '127.0.0.1', port: 40001, portRemote: 5432, protocol: 'TCP',
        hostnames: ['primary.postgresql--artsupplies--abc.addon.code.run'],
    };
    const replica: ForwardedPort = { ...primary, port: 40002, hostnames: ['replica.postgresql--artsupplies--abc.addon.code.run'] };

    interface Fake {
        client: NorthflankClient;
        calls: { created: unknown[]; stopped: number };
        closeForward(forward: Pick<ForwardedPort, 'address' | 'port'>): void;
    }

    function fakeClient(overrides: Partial<NorthflankClient> = {}): Fake {
        const calls = { created: [] as unknown[], stopped: 0 };
        let onClosed: (forward: Pick<ForwardedPort, 'address' | 'port'>) => void = () => undefined;
        const client: NorthflankClient = {
            getProject: async () => ({ id: 'artsupplies', name: 'Art Supplies' }),
            getAddon: async () => ({ id: 'postgresql', name: 'Postgres', status: 'running', type: 'postgresql', replicas: 2 }),
            forwardAddon: async () => [primary, replica],
            onForwardClosed: (listener) => { onClosed = listener; },
            stop: async () => { calls.stopped += 1; },
            ...overrides,
        };
        return { client, calls, closeForward: (forward) => onClosed(forward) };
    }

    function providerWith(fake: Fake, context = { name: 'kbart', token: TOKEN, host: 'https://api.northflank.com' }) {
        const loaded: unknown[] = [];
        const provider = createNorthflankProvider({
            loadContext: (name, configDir) => { loaded.push([name, configDir]); return context; },
            createClient: async (ctx, target) => { fake.calls.created.push({ context: ctx.name, target }); return fake.client; },
        });
        return { provider, loaded };
    }

    function openContext(): OpenTunnelContext & { lines: string[] } {
        const lines: string[] = [];
        return {
            lines, connectionName: 'prod', deadline: Date.now() + 1000, logFd: -1,
            log: (line) => { lines.push(line); },
            logOffset: () => 0, readLog: () => '', findFreePort: async () => 0,
        };
    }

    const config = resolveNorthflankConfig({ ...VALID, configDir: '/nf' }, 'prod');

    it('opens the read replica through the named context', async () => {
        const fake = fakeClient();
        const { provider, loaded } = providerWith(fake);
        const context = openContext();

        const tunnel = await provider.open(config, context);

        expect(loaded).toEqual([['kbart', '/nf']]);
        expect(fake.calls.created).toEqual([{ context: 'kbart', target: { project: 'artsupplies', addon: 'postgresql', team: undefined } }]);
        expect(tunnel.endpoint).toEqual({ host: '127.0.0.1', port: 40002 });
        expect(tunnel.description).toBe('northflank artsupplies/postgresql (read) as context "kbart"');
        expect(tunnel.childPid).toBeUndefined();
        expect(tunnel.exitReason()).toBeNull();
    });

    it('never logs or describes the token', async () => {
        const fake = fakeClient();
        const context = openContext();
        const tunnel = await providerWith(fake).provider.open(config, context);
        expect(context.lines.join('\n') + tunnel.description).not.toContain(TOKEN);
        expect(JSON.stringify(providerWith(fake).provider.inspect(config))).not.toContain(TOKEN);
    });

    it('addresses the team of an org-scoped context', async () => {
        const fake = fakeClient();
        const { provider } = providerWith(fake, { name: 'kbart', token: TOKEN, host: 'h', tokenScope: 'org', team: 'my-team' } as never);
        await provider.open(config, openContext());
        expect(fake.calls.created[0]).toMatchObject({ target: { team: 'my-team' } });
    });

    it('reports the tunnel as stopped when Northflank closes the chosen forward', async () => {
        const fake = fakeClient();
        const tunnel = await providerWith(fake).provider.open(config, openContext());
        fake.closeForward(primary);
        expect(tunnel.exitReason()).toBeNull();
        fake.closeForward(replica);
        expect(tunnel.exitReason()).toBe('Northflank closed the tunnel');
    });

    it('closes every forward when the tunnel is closed', async () => {
        const fake = fakeClient();
        const tunnel = await providerWith(fake).provider.open(config, openContext());
        await tunnel.close();
        expect(fake.calls.stopped).toBe(1);
    });

    it('stops forwarding and explains when the endpoint asked for does not exist', async () => {
        const fake = fakeClient({ forwardAddon: async () => [primary] });
        const { provider } = providerWith(fake);
        await expect(provider.open({ ...config, endpoint: 'read' }, openContext())).rejects.toThrow(/has no read replica/);
        expect(fake.calls.stopped).toBe(1);
    });

    it('redacts the token from an error the API client throws', async () => {
        const fake = fakeClient({ forwardAddon: async () => { throw new Error(`connect failed with Bearer ${TOKEN}`); } });
        let message = '';
        try {
            await providerWith(fake).provider.open(config, openContext());
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toContain('[redacted]');
        expect(message).not.toContain(TOKEN);
    });

    it('says the login is wrong when the context cannot see the addon', async () => {
        const fake = fakeClient({ forwardAddon: async () => { throw new NorthflankApiError('Not found', 404); } });
        await expect(providerWith(fake).provider.open(config, openContext())).rejects.toThrow(
            /Context "kbart" cannot see addon artsupplies\/postgresql/
        );
    });

    describe('diagnose', () => {
        const connection = { connectionName: 'prod', dbType: 'postgres' as const };

        it('passes context, project and addon in that order', async () => {
            const checks = await providerWith(fakeClient()).provider.diagnose!(config, connection);
            expect(checks.map((check) => [check.name, check.status])).toEqual([
                ['northflank context', 'pass'], ['northflank project', 'pass'], ['northflank addon', 'pass'],
            ]);
        });

        it('stops at a context that does not exist', async () => {
            const provider = createNorthflankProvider({
                loadContext: () => { throw new Error('No Northflank context named "kbart"'); },
                createClient: async () => { throw new Error('must not be reached'); },
            });
            const checks = await provider.diagnose!(config, connection);
            expect(checks).toHaveLength(1);
            expect(checks[0]).toMatchObject({ name: 'northflank context', status: 'fail' });
        });

        it('stops at a project the context cannot see', async () => {
            const fake = fakeClient({ getProject: async () => { throw new NorthflankApiError('Forbidden', 403); } });
            const checks = await providerWith(fake).provider.diagnose!(config, connection);
            expect(checks.map((check) => check.status)).toEqual(['pass', 'fail']);
            expect(checks[1].detail).toBe('Context "kbart" cannot see project artsupplies.');
            expect(fake.calls.stopped).toBe(1);
        });

        it('reports a rejected token as a login problem', async () => {
            const fake = fakeClient({ getProject: async () => { throw new NorthflankApiError('Unauthorized', 401); } });
            const checks = await providerWith(fake).provider.diagnose!(config, connection);
            expect(checks[1].detail).toMatch(/rejected the token of context "kbart"/);
        });

        it('fails an addon of the wrong database type', async () => {
            const fake = fakeClient({ getAddon: async () => ({ id: 'x', name: 'x', status: 'running', type: 'redis' }) });
            const checks = await providerWith(fake).provider.diagnose!(config, connection);
            expect(checks[2]).toMatchObject({ status: 'fail', detail: expect.stringContaining('is redis, but connection "prod" is configured as postgres') });
        });

        it('fails an addon that is not running', async () => {
            const fake = fakeClient({ getAddon: async () => ({ id: 'x', name: 'x', status: 'paused', type: 'postgresql' }) });
            const checks = await providerWith(fake).provider.diagnose!(config, connection);
            expect(checks[2]).toMatchObject({ status: 'fail', detail: expect.stringContaining('is paused') });
        });
    });
});

describe('northflank setup questions', () => {
    const login = { name: 'kbart', token: TOKEN, host: 'https://api.northflank.com' };
    const lister = {
        listProjects: async () => [{ id: 'artsupplies', name: 'Art Supplies' }, { id: 'staging', name: 'staging' }],
        listAddons: async (_context: unknown, project: string) => project === 'artsupplies'
            ? [
                { id: 'postgresql', name: 'PostgreSQL', type: 'postgresql', status: 'running' },
                { id: 'minio', name: 'MinIO', type: 'minio', status: 'running' },
                { id: 'redis2', name: 'Redis2', type: 'redis', status: 'paused' },
            ]
            : [],
    };
    const setupWith = (overrides: Partial<Parameters<typeof createNorthflankProvider>[0]> = {}) =>
        createNorthflankProvider({
            createClient: async () => { throw new Error('the wizard must not open a tunnel'); },
            loadContext: () => login,
            listContexts: () => ['vendure-cloud', 'kbart'],
            lister,
            ...overrides,
        }).setup!;
    const field = (setup: ReturnType<typeof setupWith>, key: string) => setup.fields.find((f) => f.key === key)!;

    it('asks for the config directory, context, project, addon and endpoint, in that order', () => {
        expect(setupWith().fields.map((f) => f.key)).toEqual(['configDir', 'context', 'project', 'addon', 'endpoint']);
    });

    it('offers the contexts in the CLI config, from the directory given', async () => {
        const seen: unknown[] = [];
        const setup = setupWith({ listContexts: (dir) => { seen.push(dir); return ['kbart']; } });
        expect(await field(setup, 'context').choices!({ configDir: '/nf' })).toEqual({ options: [{ value: 'kbart', label: 'kbart' }] });
        await field(setup, 'context').choices!({ configDir: '' });
        expect(seen).toEqual(['/nf', undefined]);
    });

    it('lets the user type a context when the CLI config cannot be read', async () => {
        const setup = setupWith({ listContexts: () => { throw new Error('Cannot read the Northflank CLI config'); } });
        expect(await field(setup, 'context').choices!({})).toEqual({ unavailable: 'Cannot read the Northflank CLI config' });
    });

    it('offers the projects the chosen context can see, with their names', async () => {
        expect(await field(setupWith(), 'project').choices!({ context: 'kbart' })).toEqual({
            options: [
                { value: 'artsupplies', label: 'artsupplies', hint: 'Art Supplies' },
                { value: 'staging', label: 'staging', hint: undefined },
            ],
        });
    });

    it('offers only database addons, with their type and status', async () => {
        expect(await field(setupWith(), 'addon').choices!({ context: 'kbart', project: 'artsupplies' })).toEqual({
            options: [
                { value: 'postgresql', label: 'postgresql', hint: 'postgresql, running' },
                { value: 'redis2', label: 'redis2', hint: 'redis, paused' },
            ],
        });
        const none = await field(setupWith(), 'addon').choices!({ context: 'kbart', project: 'empty' });
        expect(none).toEqual({ unavailable: expect.stringContaining('no database addons') });
    });

    it('explains a rejected login without showing the token', async () => {
        const setup = setupWith({
            lister: { ...lister, listProjects: async () => { throw new NorthflankApiError(`Unauthorized ${TOKEN}`, 401); } },
        });
        const result = await field(setup, 'project').choices!({ context: 'kbart' });
        expect(result).toEqual({ unavailable: expect.stringContaining('northflank login --name kbart') });
        expect(JSON.stringify(result)).not.toContain(TOKEN);
    });

    it('redacts the token from any other listing failure', async () => {
        const setup = setupWith({
            lister: { ...lister, listAddons: async () => { throw new Error(`socket hang up with ${TOKEN}`); } },
        });
        const result = await field(setup, 'addon').choices!({ context: 'kbart', project: 'artsupplies' });
        expect(JSON.stringify(result)).toContain('[redacted]');
        expect(JSON.stringify(result)).not.toContain(TOKEN);
    });

    it('offers the automatic, read and primary endpoints, automatic meaning the setting is left out', async () => {
        const result = await field(setupWith(), 'endpoint').choices!({});
        expect('options' in result && result.options.map((o) => o.value)).toEqual(['', 'read', 'primary']);
        expect(field(setupWith(), 'endpoint').optional).toBe(true);
    });
});
