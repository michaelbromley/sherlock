import { describe, it, expect } from 'bun:test';
import { buildConnectionConfig } from './connection-input';
import { NORTHFLANK_ENDPOINT_PATTERN } from '../tunnel/config';
import { DB_TYPES } from '../db-types';

const BASE = { type: 'postgres', host: 'db.example.com', database: 'app', username: 'u' };

describe('buildConnectionConfig — basics', () => {
    it('builds a postgres connection from individual flags', () => {
        expect(buildConnectionConfig('prod', { ...BASE, port: '5432' })).toEqual({
            type: DB_TYPES.POSTGRES,
            host: 'db.example.com',
            port: 5432,
            database: 'app',
            username: 'u',
        });
    });

    it('takes host, port, user and database from a URL', () => {
        const config = buildConnectionConfig('prod', {
            url: 'postgres://alice@db.example.com:5433/app',
        });
        expect(config).toMatchObject({
            type: DB_TYPES.POSTGRES,
            host: 'db.example.com',
            port: 5433,
            database: 'app',
            username: 'alice',
        });
    });

    it('reads SSL out of the URL', () => {
        const config = buildConnectionConfig('prod', {
            url: 'postgres://alice@db.example.com:5432/app?sslmode=require',
        });
        expect(config.ssl).toBe(true);
    });

    it('refuses --url alongside the flags it would contradict', () => {
        expect(() =>
            buildConnectionConfig('prod', { url: 'postgres://a@h/db', host: 'other' })
        ).toThrow(/--url cannot be combined/);
    });

    it('refuses a type that contradicts the URL', () => {
        expect(() =>
            buildConnectionConfig('prod', { url: 'postgres://a@h/db', type: 'mysql' })
        ).toThrow(/contradicts the postgres URL/);
    });

    it('names the missing flag rather than failing at query time', () => {
        expect(() => buildConnectionConfig('prod', { type: 'postgres', host: 'h', database: 'd' }))
            .toThrow(/Missing --username/);
        expect(() => buildConnectionConfig('prod', { type: 'postgres', host: 'h', username: 'u' }))
            .toThrow(/Missing --database/);
        expect(() => buildConnectionConfig('prod', { host: 'h' })).toThrow(/Missing --type/);
    });

    it('rejects an unknown type', () => {
        expect(() => buildConnectionConfig('prod', { ...BASE, type: 'oracle' })).toThrow(
            /Invalid --type "oracle"/
        );
    });

    it('defaults redis to database 0 and needs no username', () => {
        expect(buildConnectionConfig('cache', { type: 'redis', host: 'r.example.com' })).toEqual({
            type: DB_TYPES.REDIS,
            host: 'r.example.com',
            database: '0',
        });
    });

    it('builds sqlite from the database path alone', () => {
        expect(buildConnectionConfig('local', { type: 'sqlite', database: '/tmp/app.db' })).toEqual({
            type: DB_TYPES.SQLITE,
            filename: '/tmp/app.db',
        });
    });
});

describe('buildConnectionConfig — passwords', () => {
    it('stores a keychain reference for --password-stdin, never the secret', () => {
        const config = buildConnectionConfig('prod', { ...BASE, passwordStdin: true });
        expect(config.password).toEqual({ $keychain: 'prod' });
    });

    it('stores an env reference for --password-env', () => {
        const config = buildConnectionConfig('prod', { ...BASE, passwordEnv: 'PROD_PW' });
        expect(config.password).toEqual({ $env: 'PROD_PW' });
    });

    it('omits the password entirely when neither is given', () => {
        expect(buildConnectionConfig('prod', BASE).password).toBeUndefined();
    });

    it('refuses both password sources at once', () => {
        expect(() =>
            buildConnectionConfig('prod', { ...BASE, passwordStdin: true, passwordEnv: 'X' })
        ).toThrow(/cannot both be given/);
    });

    it('never copies a password out of the URL into the config', () => {
        // It was already exposed in the shell history, so it is not worth persisting.
        const config = buildConnectionConfig('prod', { url: 'postgres://a:secret@h:5432/db' });
        expect(JSON.stringify(config)).not.toContain('secret');
    });
});

describe('buildConnectionConfig — tunnels', () => {
    it('expands --tunnel-northflank into a command and a pattern', () => {
        const config = buildConnectionConfig('nf', {
            ...BASE,
            tunnelNorthflank: 'cloud/control-plane-db',
        });
        expect(config.tunnel).toEqual({
            command:
                'northflank forward addon --project cloud --addon control-plane-db --skipHostnames',
            endpointPattern: NORTHFLANK_ENDPOINT_PATTERN,
        });
    });

    it('rejects a northflank spec that is not project/addon', () => {
        expect(() => buildConnectionConfig('nf', { ...BASE, tunnelNorthflank: 'cloud' })).toThrow(
            /Use <project>\/<addon>/
        );
        expect(() =>
            buildConnectionConfig('nf', { ...BASE, tunnelNorthflank: 'a/b/c' })
        ).toThrow(/Use <project>\/<addon>/);
    });

    it('takes a raw command with a port placeholder', () => {
        const config = buildConnectionConfig('bastion', {
            ...BASE,
            tunnelCommand: 'ssh -N -L {{port}}:db.internal:5432 bastion',
            tunnelIdleTimeout: '5m',
        });
        expect(config.tunnel).toEqual({
            command: 'ssh -N -L {{port}}:db.internal:5432 bastion',
            idleTimeout: '5m',
        });
    });

    it('defaults the host to loopback when a tunnel is set and no host given', () => {
        // The tunnel replaces the endpoint anyway, so requiring the real remote
        // host would be busywork for a caller who may not know it.
        const config = buildConnectionConfig('nf', {
            type: 'postgres',
            database: 'app',
            username: 'u',
            tunnelNorthflank: 'cloud/pg',
        });
        expect(config.host).toBe('127.0.0.1');
    });

    it('keeps an explicit host, which documents the real remote', () => {
        const config = buildConnectionConfig('nf', { ...BASE, tunnelNorthflank: 'cloud/pg' });
        expect(config.host).toBe('db.example.com');
    });

    it('refuses both tunnel sources at once', () => {
        expect(() =>
            buildConnectionConfig('nf', {
                ...BASE,
                tunnelNorthflank: 'cloud/pg',
                tunnelCommand: 'ssh {{port}}',
            })
        ).toThrow(/cannot both be given/);
    });

    it('rejects tunnel options with no tunnel to attach them to', () => {
        expect(() => buildConnectionConfig('prod', { ...BASE, tunnelIdleTimeout: '5m' })).toThrow(
            /--tunnel-idle-timeout needs a tunnel/
        );
    });

    it('validates the tunnel now rather than on the first query', () => {
        expect(() =>
            buildConnectionConfig('prod', { ...BASE, tunnelCommand: 'forward --port 5432' })
        ).toThrow(/must include "\{\{port\}\}"/);
        expect(() =>
            buildConnectionConfig('prod', {
                ...BASE,
                tunnelCommand: 'forward {{port}}',
                tunnelIdleTimeout: '5',
            })
        ).toThrow(/Invalid duration/);
    });

    it('refuses a tunnel on sqlite', () => {
        expect(() =>
            buildConnectionConfig('local', {
                type: 'sqlite',
                database: '/tmp/a.db',
                tunnelCommand: 'ssh {{port}}',
            })
        ).toThrow(/SQLite is a local file/);
    });
});

describe('buildConnectionConfig — ssl flag', () => {
    it('maps the three modes', () => {
        expect(buildConnectionConfig('a', { ...BASE, ssl: 'off' }).ssl).toBeUndefined();
        expect(buildConnectionConfig('a', { ...BASE, ssl: 'require' }).ssl).toBe(true);
        expect(buildConnectionConfig('a', { ...BASE, ssl: 'verify' }).ssl).toEqual({
            rejectUnauthorized: true,
        });
    });

    it('rejects anything else', () => {
        expect(() => buildConnectionConfig('a', { ...BASE, ssl: 'yes' })).toThrow(/Invalid --ssl/);
    });
});
