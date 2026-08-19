import { describe, it, expect } from 'bun:test';
import {
    parseDuration,
    resolveTunnelConfig,
    applyPortPlaceholder,
    hasPortPlaceholder,
    DEFAULT_IDLE_TIMEOUT,
    DEFAULT_READY_TIMEOUT,
} from './config';

describe('parseDuration', () => {
    it('parses milliseconds', () => {
        expect(parseDuration('500ms')).toBe(500);
    });

    it('parses seconds', () => {
        expect(parseDuration('30s')).toBe(30_000);
    });

    it('parses minutes', () => {
        expect(parseDuration('10m')).toBe(600_000);
    });

    it('parses hours', () => {
        expect(parseDuration('2h')).toBe(7_200_000);
    });

    it('parses fractional amounts', () => {
        expect(parseDuration('1.5m')).toBe(90_000);
    });

    it('tolerates surrounding whitespace', () => {
        expect(parseDuration('  10m  ')).toBe(600_000);
    });

    it('rejects a bare number, since the unit would be a guess', () => {
        expect(() => parseDuration('30')).toThrow(/Invalid duration/);
    });

    it('rejects unknown units', () => {
        expect(() => parseDuration('10d')).toThrow(/Invalid duration/);
    });

    it('rejects zero', () => {
        expect(() => parseDuration('0s')).toThrow(/greater than zero/);
    });

    it('rejects nonsense', () => {
        expect(() => parseDuration('soon')).toThrow(/Invalid duration/);
    });
});

describe('resolveTunnelConfig', () => {
    it('applies defaults when only a command is given', () => {
        const resolved = resolveTunnelConfig('prod', { command: 'ssh -L {{port}}:db:5432 bastion' });
        expect(resolved.command).toBe('ssh -L {{port}}:db:5432 bastion');
        expect(resolved.localPort).toBeUndefined();
        expect(resolved.idleTimeoutMs).toBe(parseDuration(DEFAULT_IDLE_TIMEOUT));
        expect(resolved.readyTimeoutMs).toBe(parseDuration(DEFAULT_READY_TIMEOUT));
    });

    it('honours explicit timeouts and port', () => {
        const resolved = resolveTunnelConfig('prod', {
            command: 'forward',
            localPort: 15432,
            idleTimeout: '2m',
            readyTimeout: '5s',
        });
        expect(resolved.localPort).toBe(15432);
        expect(resolved.idleTimeoutMs).toBe(120_000);
        expect(resolved.readyTimeoutMs).toBe(5_000);
    });

    it('trims the command', () => {
        expect(resolveTunnelConfig('prod', { command: '  forward {{port}}  ' }).command).toBe(
            'forward {{port}}'
        );
    });

    it('rejects a command with no way to learn the port', () => {
        expect(() => resolveTunnelConfig('prod', { command: 'forward --port 5432' })).toThrow(
            /must include "\{\{port\}\}"/
        );
    });

    it('accepts a command without the placeholder when localPort is fixed', () => {
        expect(
            resolveTunnelConfig('prod', { command: 'forward --port 15432', localPort: 15432 }).localPort
        ).toBe(15432);
    });

    it('rejects a missing command', () => {
        expect(() => resolveTunnelConfig('prod', {} as never)).toThrow(/"command" is required/);
    });

    it('rejects an empty command', () => {
        expect(() => resolveTunnelConfig('prod', { command: '   ' })).toThrow(/"command" is required/);
    });

    it('rejects an out-of-range port', () => {
        expect(() => resolveTunnelConfig('prod', { command: 'x', localPort: 70000 })).toThrow(
            /between 1 and 65535/
        );
    });

    it('rejects a non-integer port', () => {
        expect(() => resolveTunnelConfig('prod', { command: 'x', localPort: 1.5 })).toThrow(
            /between 1 and 65535/
        );
    });

    it('rejects an idle timeout over 24h', () => {
        expect(() =>
            resolveTunnelConfig('prod', { command: 'x {{port}}', idleTimeout: '25h' })
        ).toThrow(/cannot exceed 24h/);
    });

    it('names the connection in duration errors', () => {
        expect(() =>
            resolveTunnelConfig('northflank-prod', { command: 'x {{port}}', idleTimeout: '10' })
        ).toThrow(/connection "northflank-prod"/);
    });
});

describe('applyPortPlaceholder', () => {
    it('substitutes every occurrence', () => {
        expect(applyPortPlaceholder('fwd --local {{port}} --health {{port}}', 15432)).toBe(
            'fwd --local 15432 --health 15432'
        );
    });

    it('leaves a command without the placeholder alone', () => {
        expect(applyPortPlaceholder('fwd --local 15432', 9999)).toBe('fwd --local 15432');
    });

    it('detects the placeholder', () => {
        expect(hasPortPlaceholder('fwd {{port}}')).toBe(true);
        expect(hasPortPlaceholder('fwd 5432')).toBe(false);
    });
});
