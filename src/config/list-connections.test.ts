import { describe, it, expect, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { listConnections, sortConnectionNames, clearConfigCache } from './index';

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
