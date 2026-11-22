import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { listConnections, sortConnectionNames, clearConfigCache, summarizeConnection } from './index';

function writeTempConfig(names: string[]): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-test-'));
    const configPath = path.join(dir, 'config.json');
    const connections = Object.fromEntries(
        names.map(name => [name, { type: 'postgres', host: 'localhost', database: 'db', username: 'u' }])
    );
    fs.writeFileSync(configPath, JSON.stringify({ connections }), 'utf-8');
    return configPath;
}

describe('sortConnectionNames', () => {
    it('sorts alphabetically', () => {
        expect(sortConnectionNames(['zulu', 'aardvark', 'monkey'])).toEqual(['aardvark', 'monkey', 'zulu']);
    });

    it('does not mutate the input', () => {
        const names = ['zulu', 'aardvark'];
        sortConnectionNames(names);
        expect(names).toEqual(['zulu', 'aardvark']);
    });

    it('handles an empty list', () => {
        expect(sortConnectionNames([])).toEqual([]);
    });
});

describe('listConnections', () => {
    afterEach(() => {
        clearConfigCache();
    });

    it('returns names alphabetically, not in config order', () => {
        const configPath = writeTempConfig(['vendure-prod', 'aardvark', 'kbart-local']);
        expect(listConnections(configPath)).toEqual(['aardvark', 'kbart-local', 'vendure-prod']);
    });
});

describe('summarizeConnection', () => {
    it('shows host, port and database', () => {
        expect(summarizeConnection('db', { type: 'postgres', host: 'db.internal', port: 5433, database: 'app', username: 'u' }))
            .toEqual({ name: 'db', type: 'postgres', target: 'db.internal:5433/app' });
    });

    it('reduces a literal URL to its host, dropping the password', () => {
        const summary = summarizeConnection('db', { url: 'mysql://root:hunter2@db.example.com:3306/shop' });
        expect(summary).toEqual({ name: 'db', type: 'mysql', target: 'db.example.com:3306' });
        expect(JSON.stringify(summary)).not.toContain('hunter2');
    });

    it('names a URL reference instead of resolving it', () => {
        expect(summarizeConnection('db', { url: { $keychain: { service: 'sherlock-url', account: 'db' } } }).target)
            .toBe('url from $keychain:sherlock-url/db');
        expect(summarizeConnection('db', { url: { $env: 'DB_URL' } }).target).toBe('url from $env:DB_URL');
    });

    it('shows the file of a SQLite connection', () => {
        expect(summarizeConnection('local', { type: 'sqlite', filename: './data.db' }).target).toBe('./data.db');
    });

    it('shows a provider tunnel by provider, project and addon', () => {
        const summary = summarizeConnection('prod', {
            type: 'postgres', host: 'primary.postgresql--artsupplies--abc.addon.code.run', database: 'app', username: 'u',
            tunnel: { provider: 'northflank', context: 'kbart', project: 'artsupplies', addon: 'postgresql' },
        });
        expect(summary.tunnel).toMatchObject({
            kind: 'provider',
            provider: 'northflank',
            target: 'artsupplies/postgresql',
            details: { context: 'kbart', project: 'artsupplies', addon: 'postgresql', endpoint: 'auto' },
        });
    });

    it('shows what a northflank CLI command tunnel forwards', () => {
        const summary = summarizeConnection('prod', {
            type: 'postgres', host: 'h', database: 'app', username: 'u',
            tunnel: { command: 'northflank forward addon --project cloud --addon control-plane-db --skipHostnames', endpointPattern: 'on (?<port>\\d+)' },
        });
        // A command tunnel, recognised as the northflank CLI so its target can be checked.
        expect(summary.tunnel).toMatchObject({
            kind: 'command', provider: 'command',
            target: 'cloud/control-plane-db (northflank CLI)',
            details: { project: 'cloud', addon: 'control-plane-db' },
        });
    });

    it('reports a broken tunnel instead of failing the whole list', () => {
        const summary = summarizeConnection('prod', { type: 'postgres', host: 'h', database: 'a', username: 'u', tunnel: { provider: 'nope' } });
        expect(summary.tunnel).toBeUndefined();
        expect(summary.problem).toMatch(/unknown provider "nope"/);
    });
});
