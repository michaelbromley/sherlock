import { describe, it, expect } from 'bun:test';
import { isEmbeddedScriptPath, keepaliveIntervalFor } from './manager';
import { withSudoHint } from './supervisor';

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

describe('withSudoHint', () => {
    it('explains the missing terminal when sudo could not prompt', () => {
        const output = 'sudo: a terminal is required to read the password';
        expect(withSudoHint('Tunnel command exited with code 1', output)).toMatch(
            /no terminal, so sudo cannot prompt/
        );
    });

    it('recognises the no-tty wording too', () => {
        expect(withSudoHint('failed', 'sudo: no tty present and no askpass program specified')).toMatch(
            /SUDO_ASKPASS/
        );
    });

    it('leaves unrelated failures untouched', () => {
        const message = 'Tunnel command exited with code 127';
        expect(withSudoHint(message, '/bin/sh: northflank: command not found')).toBe(message);
    });

    it('does not fire on output that merely mentions sudo', () => {
        const message = 'failed';
        expect(withSudoHint(message, 'run this with sudo for hostname support')).toBe(message);
    });
});
