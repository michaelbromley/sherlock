import { describe, it, expect } from 'bun:test';
import { carryOverUnprompted, tunnelHintLabel } from './index';

// Rendered for every non-SQLite connection whenever the edit menu opens, so it
// has to cope with each shape a tunnel config can take, including none at all.
describe('tunnelHintLabel', () => {
    it('reports no tunnel', () => {
        expect(tunnelHintLabel(undefined)).toBe('not set');
    });

    it('reports a fixed port', () => {
        expect(tunnelHintLabel({ command: 'fwd', localPort: 15432 })).toBe('port 15432, idle 10m');
    });

    it('reports a sherlock-allocated port', () => {
        expect(tunnelHintLabel({ command: 'fwd {{port}}' })).toBe('auto port, idle 10m');
    });

    it('reports a discovered endpoint', () => {
        expect(tunnelHintLabel({ command: 'fwd', endpointPattern: '(?<port>\\d+)' })).toBe(
            'port from output, idle 10m'
        );
    });

    it('reflects a custom idle timeout', () => {
        expect(tunnelHintLabel({ command: 'fwd {{port}}', idleTimeout: '30s' })).toBe(
            'auto port, idle 30s'
        );
    });
});

describe('carryOverUnprompted', () => {
    it('keeps the timeouts the wizard does not ask about when a connection is edited', () => {
        const edited = { type: 'postgres' as const, host: 'new-host' };
        carryOverUnprompted({ type: 'postgres', host: 'old', statementTimeout: '5m', connectTimeout: '30s' }, edited);
        expect(edited).toEqual({ type: 'postgres', host: 'new-host', statementTimeout: '5m', connectTimeout: '30s' });
    });

    it('adds nothing for a new connection', () => {
        const added = { type: 'postgres' as const };
        carryOverUnprompted(undefined, added);
        expect(added).toEqual({ type: 'postgres' });
    });
});

