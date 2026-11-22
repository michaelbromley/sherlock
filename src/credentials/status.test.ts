import { describe, it, expect } from 'bun:test';
import { credentialSource, passwordStatus } from './status';

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
    });

    it('reports a plaintext password without repeating it', () => {
        const status = passwordStatus('db', { type: 'postgres', password: 'hunter2' });
        expect(status).toEqual({ ok: true, source: 'plaintext in config.json' });
    });

    it('reports a connection with no password at all, whatever the real environment holds', () => {
        expect(passwordStatus('db', { type: 'postgres' }, {})).toEqual({ ok: true, source: 'none configured' });
    });

    it('names the default variable as sherlock reads it, with hyphens as underscores', () => {
        expect(passwordStatus('prod-db', { type: 'postgres' }, { SHERLOCK_PROD_DB_PASSWORD: 'x' })).toEqual({
            ok: true, source: 'environment variable SHERLOCK_PROD_DB_PASSWORD',
        });
    });
});

describe('credentialSource', () => {
    it('reads a username from either default variable', () => {
        expect(credentialSource('prod-db', 'username', undefined, { SHERLOCK_PROD_DB_USER: 'u' })).toEqual({
            ok: true, source: 'environment variable SHERLOCK_PROD_DB_USER',
        });
    });

    it('says a host written in the config comes from config.json, a password from plaintext there', () => {
        expect(credentialSource('db', 'host', 'db.internal', {})?.source).toBe('config.json');
        expect(credentialSource('db', 'password', 'pw', {})?.source).toBe('plaintext in config.json');
    });

    it('is null for a setting with no source at all', () => {
        expect(credentialSource('db', 'url', undefined, {})).toBeNull();
        expect(credentialSource('db', 'host', undefined, {})).toBeNull();
    });
});
