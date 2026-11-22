import { describe, it, expect } from 'bun:test';
import { describeTunnel, resolveTunnel, tunnelProviderId, tunnelProviderIds, tunnelShorthand } from './index';

describe('tunnel provider registry', () => {
    it('treats a block with no provider as a command tunnel', () => {
        const tunnel = resolveTunnel('prod', { command: 'ssh -N -L {{port}}:db:5432 bastion' });
        expect(tunnel.providerId).toBe('command');
        expect(tunnelProviderId({ command: 'x' })).toBe('command');
        expect(tunnel.diagnose).toBeNull();
    });

    it('fills in the timeouts every tunnel has', () => {
        const tunnel = resolveTunnel('prod', { provider: 'northflank', context: 'c', project: 'p', addon: 'a', idleTimeout: '5m' });
        expect(tunnel).toMatchObject({ providerId: 'northflank', idleTimeoutMs: 300_000, readyTimeoutMs: 30_000 });
    });

    it('validates the common timeouts for a provider tunnel too', () => {
        expect(() =>
            resolveTunnel('prod', { provider: 'northflank', context: 'c', project: 'p', addon: 'a', idleTimeout: '25h' })
        ).toThrow(/"idleTimeout" cannot exceed 24h/);
    });

    it('names the providers that exist when one is unknown', () => {
        expect(() => resolveTunnel('prod', { provider: 'flyio' })).toThrow(
            /connection "prod": unknown provider "flyio". Use one of: northflank/
        );
        expect(tunnelProviderIds()).toContain('northflank');
        expect(tunnelProviderIds()).not.toContain('command');
    });

    it('lets a provider validate its own settings', () => {
        expect(() => resolveTunnel('prod', { provider: 'northflank', context: 'c', project: 'p' })).toThrow(/"addon" is required/);
    });

    it('cannot say what an arbitrary command forwards to', () => {
        const inspection = resolveTunnel('prod', { command: 'ssh -N -L {{port}}:db:5432 bastion' }).inspect();
        expect(inspection.target).toEqual({
            provider: 'command',
            summary: 'ssh -N -L {{port}}:db:5432 bastion',
            details: { command: 'ssh -N -L {{port}}:db:5432 bastion' },
        });
        expect(inspection.checkHost('db.internal').verdict).toBe('unknown');
    });

    it('lets a provider recognise its own CLI in a command tunnel', () => {
        const command = 'northflank forward addon --project cloud --addon control-plane-db --skipHostnames';
        const inspection = resolveTunnel('prod', { command, endpointPattern: 'on (?<port>\\d+)' }).inspect();
        expect(inspection.target).toMatchObject({ provider: 'northflank', details: { project: 'cloud', addon: 'control-plane-db', command } });
        expect(inspection.checkHost('primary.postgresql--artsupplies--abc.addon.code.run').verdict).toBe('mismatch');
    });

    it('describes tunnels in one line, and survives a malformed one', () => {
        expect(describeTunnel('prod', { command: 'ssh -L {{port}}:db:5432 b' })).toBe('ssh -L {{port}}:db:5432 b');
        expect(describeTunnel('prod', { provider: 'northflank', context: 'c', project: 'p', addon: 'a', endpoint: 'read' })).toBe('northflank: p/a (read)');
        expect(describeTunnel('prod', { provider: 'nope' })).toBe('invalid tunnel config');
    });

    it('finds a shorthand by name', () => {
        expect(tunnelShorthand('northflank')?.expand('p/a')).toMatchObject({
            command: 'northflank forward addon --project p --addon a --skipHostnames',
        });
        expect(tunnelShorthand('nope')).toBeUndefined();
    });
});
