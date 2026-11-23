import { describe, it, expect } from 'bun:test';
import * as path from 'path';
import { getSchemaCachePath } from './schema';
import { getCacheDir } from '../config/paths';

describe('getSchemaCachePath', () => {
    it.each(['prod', 'corner-shop', 'kbart.local', 'my_db_2'])('caches "%s" under its own name', (name) => {
        expect(getSchemaCachePath(name)).toBe(path.join(getCacheDir(), `${name}.schema.json`));
    });

    it.each(['../escape', '/etc/passwd', '.hidden', 'has space', 'a/b'])('keeps "%s" inside the cache directory', (name) => {
        const file = getSchemaCachePath(name);
        expect(path.dirname(file)).toBe(getCacheDir());
        expect(path.basename(file)).toMatch(/^connection-[0-9a-f]{16}\.schema\.json$/);
    });

    it('gives different names different files', () => {
        expect(getSchemaCachePath('a b')).not.toBe(getSchemaCachePath('a/b'));
    });
});
