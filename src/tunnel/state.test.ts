import { describe, it, expect } from 'bun:test';
import * as path from 'path';
import { tunnelSlug, statePath, logPath, isProcessAlive } from './state';

describe('tunnelSlug', () => {
    it('keeps ordinary names readable', () => {
        expect(tunnelSlug('northflank-prod')).toMatch(/^northflank-prod-[0-9a-f]{8}$/);
    });

    it('is stable for the same name', () => {
        expect(tunnelSlug('prod')).toBe(tunnelSlug('prod'));
    });

    it('distinguishes names that sanitise to the same text', () => {
        expect(tunnelSlug('prod db')).not.toBe(tunnelSlug('prod/db'));
    });

    it('strips path separators so a name cannot escape the tunnels directory', () => {
        const slug = tunnelSlug('../../etc/passwd');
        expect(slug).not.toContain('/');
        expect(slug).not.toContain('..');
    });

    it('caps the readable portion for very long names', () => {
        const slug = tunnelSlug('a'.repeat(200));
        // 32 readable characters, a hyphen, and an 8-character digest
        expect(slug.length).toBe(41);
    });
});

describe('tunnel file paths', () => {
    it('keeps state files inside the tunnels directory even for hostile names', () => {
        const file = statePath('../../../tmp/pwned');
        const dir = path.dirname(file);
        expect(path.basename(dir)).toBe('tunnels');
    });

    it('puts state and log side by side', () => {
        expect(path.dirname(statePath('prod'))).toBe(path.dirname(logPath('prod')));
    });
});

describe('isProcessAlive', () => {
    it('reports this process as alive', () => {
        expect(isProcessAlive(process.pid)).toBe(true);
    });

    it('rejects invalid pids', () => {
        expect(isProcessAlive(0)).toBe(false);
        expect(isProcessAlive(-1)).toBe(false);
        expect(isProcessAlive(1.5)).toBe(false);
    });
});
