import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { clearConfigCache, detectConnectionFromCwd } from './index';
import { realDirectory } from './paths';

/**
 * Picking a connection by its `directory` when the same place has two names,
 * as /tmp and /private/tmp do on macOS.
 */

let dir: string;
let linked: string;
const originalCwd = process.cwd();

beforeEach(() => {
    dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-cwd-')));
    fs.mkdirSync(path.join(dir, 'real', 'project', 'src'), { recursive: true });
    linked = path.join(dir, 'linked');
    fs.symlinkSync(path.join(dir, 'real'), linked);
    clearConfigCache();
});

afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
    clearConfigCache();
});

function writeConfig(directory: string): string {
    const file = path.join(dir, 'config.json');
    fs.writeFileSync(file, JSON.stringify({ connections: { shop: { url: 'sqlite:///tmp/x.db', directory } } }));
    return file;
}

describe('detectConnectionFromCwd', () => {
    it('matches a directory saved through a symlink, from inside the real path', () => {
        const config = writeConfig(path.join(linked, 'project'));
        process.chdir(path.join(dir, 'real', 'project', 'src'));
        expect(detectConnectionFromCwd(config)).toBe('shop');
    });

    it('matches a directory saved as the real path, from inside the symlink', () => {
        const config = writeConfig(path.join(dir, 'real', 'project'));
        process.chdir(path.join(linked, 'project'));
        expect(detectConnectionFromCwd(config)).toBe('shop');
    });

    it('does not match a sibling directory', () => {
        const config = writeConfig(path.join(dir, 'real', 'proj'));
        process.chdir(path.join(dir, 'real', 'project'));
        expect(detectConnectionFromCwd(config)).toBeNull();
    });
});

describe('realDirectory', () => {
    it("keeps a missing directory under its parent's real path", () => {
        expect(realDirectory(path.join(linked, 'gone', 'deeper'))).toBe(path.join(dir, 'real', 'gone', 'deeper'));
    });
});
