import { describe, it, expect } from 'bun:test';
import { passwordStatus } from './status';

describe('passwordStatus', () => {
    it('knows a SQLite connection or a URL needs no separate password', () => {
        expect(passwordStatus('db', { type: 'sqlite', filename: 'x.db' })).toEqual({ ok: true, source: 'not needed (SQLite)' });
        expect(passwordStatus('db', { url: { $env: 'DB_URL' } })).toEqual({ ok: true, source: 'part of the connection URL' });
    });

    it('reports an environment variable reference, set or not, without its value', () => {
        expect(passwordStatus('db', { type: 'postgres', password: { $env: 'PW' } }, { PW: 'secret' })).toEqual({
            ok: true, source: 'environment variable PW',
        });
        const missing = passwordStatus('db', { type: 'postgres', password: { $env: 'PW' } }, {});
        expect(missing).toEqual({ ok: false, source: 'environment variable PW, which is not set' });
        expect(JSON.stringify(passwordStatus('db', { type: 'postgres', password: { $env: 'PW' } }, { PW: 'secret' }))).not.toContain('secret');
    });

    it('reports a plaintext password without repeating it', () => {
        const status = passwordStatus('db', { type: 'postgres', password: 'hunter2' });
        expect(status).toEqual({ ok: true, source: 'plaintext in config.json' });
    });

    it('reports a connection with no password at all', () => {
        expect(passwordStatus('nopw_conn_for_test', { type: 'postgres' })).toEqual({ ok: true, source: 'none configured' });
    });
});
