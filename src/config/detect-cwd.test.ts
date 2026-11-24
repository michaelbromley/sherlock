import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { connectionsForDirectory } from './index';
import { realDirectory } from './paths';
import type { SherlockConfig } from './types';

/**
 * The connections set up for a project directory. They are suggested in
 * CONNECTION_REQUIRED's fix, never picked: every command names its connection.
 */

const CLI = path.join(import.meta.dir, '..', 'query-db.ts');

let dir: string;
let linked: string;
let project: string;

beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-cwd-')));
    project = path.join(dir, 'real', 'project');
    fs.mkdirSync(path.join(project, 'src'), { recursive: true });
    linked = path.join(dir, 'linked');
    fs.symlinkSync(path.join(dir, 'real'), linked);
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

function config(connections: Record<string, object>): SherlockConfig {
    return { connections } as unknown as SherlockConfig;
}

describe('connectionsForDirectory', () => {
    it('finds the project, a parent of it, or an app inside it, and not a sibling', () => {
        const found = connectionsForDirectory(config({
            shop: { url: 'sqlite:///x.db', directory: project },
            parent: { url: 'sqlite:///x.db', directory: path.join(dir, 'real') },
            app: { url: 'sqlite:///x.db', directory: path.join(project, 'apps', 'api') },
            sibling: { url: 'sqlite:///x.db', directory: path.join(dir, 'real', 'proj') },
            none: { url: 'sqlite:///x.db' },
        }), project);
        expect(found).toEqual(['app', 'parent', 'shop']);
    });

    it('matches through a symlink, in either direction', () => {
        expect(connectionsForDirectory(config({ shop: { directory: path.join(linked, 'project') } }), path.join(project, 'src'))).toEqual(['shop']);
        expect(connectionsForDirectory(config({ shop: { directory: project } }), path.join(linked, 'project'))).toEqual(['shop']);
    });

    it('skips a relative directory, which 1.x could store and would match everywhere', () => {
        expect(connectionsForDirectory(config({ old: { directory: '.' }, rel: { directory: 'project' } }), project)).toEqual([]);
    });
});

describe('realDirectory', () => {
    it("keeps a missing directory under its parent's real path", () => {
        expect(realDirectory(path.join(linked, 'gone', 'deeper'))).toBe(path.join(dir, 'real', 'gone', 'deeper'));
    });
});

describe('a command with no connection', () => {
    function run(args: string[], connections: Record<string, object>) {
        const file = path.join(dir, 'config.json');
        fs.writeFileSync(file, JSON.stringify({ connections }));
        const result = spawnSync('bun', [CLI, '--config', file, ...args], { encoding: 'utf-8', cwd: path.join(project, 'src') });
        return { status: result.status, error: JSON.parse(result.stdout).error };
    }

    it("is never given the project's connection, but its fix names it", () => {
        const { status, error } = run(['tables'], { shop: { url: 'sqlite:///nope.db', directory: project } });
        expect(status).toBe(1);
        expect(error).toMatchObject({ code: 'CONNECTION_REQUIRED', details: { candidates: ['shop'] } });
        expect(error.fix).toBe('Pass -c shop: "shop" is set up for this directory.');
    });

    it('lists several, or points to connection list when there are none', () => {
        const several = run(['tables'], { a: { directory: project }, b: { directory: project } }).error;
        expect(several.fix).toBe('Pass -c <name>. Set up for this directory: a, b.');
        const none = run(['tables'], { a: { url: 'sqlite:///x.db' } }).error;
        expect(none).toMatchObject({ details: { candidates: [] }, fix: 'Pass -c <name> (see: sherlock connection list) or -u <url>.' });
    });

    it('doctor names it the same way', () => {
        const { error } = run(['doctor'], { shop: { url: 'sqlite:///nope.db', directory: project } });
        expect(error.fix).toBe('Run sherlock doctor shop: "shop" is set up for this directory.');
    });
});
