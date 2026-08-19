import { describe, it, expect } from 'bun:test';
import { isEmbeddedScriptPath, keepaliveIntervalFor } from './manager';

describe('keepaliveIntervalFor', () => {
    it('signals several times per idle period for short timeouts', () => {
        expect(keepaliveIntervalFor(9_000)).toBe(3_000);
    });

    it('caps the interval for long timeouts', () => {
        expect(keepaliveIntervalFor(600_000)).toBe(30_000);
    });

    it('does not busy-loop for very short timeouts', () => {
        expect(keepaliveIntervalFor(1_000)).toBe(1_000);
    });

    it('falls back to the cap for a malformed idle timeout', () => {
        // setInterval treats NaN as "immediately, forever", so this must never leak through.
        expect(keepaliveIntervalFor(NaN)).toBe(30_000);
        expect(keepaliveIntervalFor(undefined as unknown as number)).toBe(30_000);
        expect(keepaliveIntervalFor(0)).toBe(30_000);
    });
});

describe('isEmbeddedScriptPath', () => {
    it('recognises the entry script of a compiled binary', () => {
        // These paths stat successfully inside a compiled binary even though no
        // such file exists on disk, so they must be matched by prefix.
        expect(isEmbeddedScriptPath('/$bunfs/root/query-db.ts')).toBe(true);
    });

    it('recognises the Windows embedded filesystem', () => {
        expect(isEmbeddedScriptPath('B:\\~BUN\\root\\query-db.ts')).toBe(true);
    });

    it('treats a real script path as ordinary', () => {
        expect(isEmbeddedScriptPath('/Users/someone/sherlock/src/query-db.ts')).toBe(false);
    });

    it('does not match a directory that merely mentions bun', () => {
        expect(isEmbeddedScriptPath('/Users/someone/bun-projects/src/query-db.ts')).toBe(false);
    });
});
