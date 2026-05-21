import { describe, it, expect } from 'bun:test';
import { normalizeSsl, buildConnectionUrl, applySslToUrl } from './index';
import type { ConnectionConfig } from './types';
import { parseMssqlUrl } from '../db/mssql-adapter';
import { DB_TYPES } from '../db-types';

describe('normalizeSsl', () => {
    it('returns disabled for undefined', () => {
        expect(normalizeSsl(undefined)).toEqual({ enabled: false, verify: false });
    });

    it('returns disabled for false', () => {
        expect(normalizeSsl(false)).toEqual({ enabled: false, verify: false });
    });

    it('returns enabled-no-verify for true', () => {
        expect(normalizeSsl(true)).toEqual({ enabled: true, verify: false });
    });

    it('returns enabled-no-verify for empty object', () => {
        expect(normalizeSsl({})).toEqual({ enabled: true, verify: false });
    });

    it('returns enabled-no-verify for { rejectUnauthorized: false }', () => {
        expect(normalizeSsl({ rejectUnauthorized: false })).toEqual({ enabled: true, verify: false });
    });

    it('returns enabled-verify for { rejectUnauthorized: true }', () => {
        expect(normalizeSsl({ rejectUnauthorized: true })).toEqual({ enabled: true, verify: true });
    });
});

describe('buildConnectionUrl — backwards compatibility (no ssl)', () => {
    it('builds plain postgres URL with no query string', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, 'localhost', 5432, 'user', 'pass', 'db')).toBe(
            'postgres://user:pass@localhost:5432/db'
        );
    });

    it('builds plain mysql URL with no query string', () => {
        expect(buildConnectionUrl(DB_TYPES.MYSQL, 'localhost', 3306, 'user', 'pass', 'db')).toBe(
            'mysql://user:pass@localhost:3306/db'
        );
    });

    it('builds plain mssql URL with no query string', () => {
        expect(buildConnectionUrl(DB_TYPES.MSSQL, 'localhost', 1433, 'user', 'pass', 'db')).toBe(
            'mssql://user:pass@localhost:1433/db'
        );
    });

    it('explicit ssl: false produces no query string', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, 'localhost', 5432, 'u', 'p', 'db', false)).toBe(
            'postgres://u:p@localhost:5432/db'
        );
    });
});

describe('buildConnectionUrl — ssl require (no verify)', () => {
    it('postgres uses sslmode=require', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, 'host', 5432, 'u', 'p', 'db', true)).toBe(
            'postgres://u:p@host:5432/db?sslmode=require'
        );
    });

    it('mysql uses ssl-mode=REQUIRED', () => {
        expect(buildConnectionUrl(DB_TYPES.MYSQL, 'host', 3306, 'u', 'p', 'db', true)).toBe(
            'mysql://u:p@host:3306/db?ssl-mode=REQUIRED'
        );
    });

    it('mssql uses encrypt=true, trustServerCertificate=true', () => {
        expect(buildConnectionUrl(DB_TYPES.MSSQL, 'host', 1433, 'u', 'p', 'db', true)).toBe(
            'mssql://u:p@host:1433/db?encrypt=true&trustServerCertificate=true'
        );
    });
});

describe('buildConnectionUrl — ssl verify', () => {
    const ssl: ConnectionConfig['ssl'] = { rejectUnauthorized: true };

    it('postgres uses sslmode=verify-full', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, 'host', 5432, 'u', 'p', 'db', ssl)).toBe(
            'postgres://u:p@host:5432/db?sslmode=verify-full'
        );
    });

    it('mysql uses ssl-mode=VERIFY_IDENTITY', () => {
        expect(buildConnectionUrl(DB_TYPES.MYSQL, 'host', 3306, 'u', 'p', 'db', ssl)).toBe(
            'mysql://u:p@host:3306/db?ssl-mode=VERIFY_IDENTITY'
        );
    });

    it('mssql uses encrypt=true, trustServerCertificate=false', () => {
        expect(buildConnectionUrl(DB_TYPES.MSSQL, 'host', 1433, 'u', 'p', 'db', ssl)).toBe(
            'mssql://u:p@host:1433/db?encrypt=true&trustServerCertificate=false'
        );
    });
});

describe('buildConnectionUrl — URL-encodes credentials', () => {
    it('encodes special characters in password alongside ssl query', () => {
        const url = buildConnectionUrl(DB_TYPES.POSTGRES, 'host', 5432, 'user', 'p@ss/w:rd', 'db', true);
        expect(url).toBe('postgres://user:p%40ss%2Fw%3Ard@host:5432/db?sslmode=require');
    });
});

describe('buildConnectionUrl — IPv6 hosts', () => {
    it('brackets IPv6 host', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, '::1', 5432, 'u', 'p', 'db')).toBe(
            'postgres://u:p@[::1]:5432/db'
        );
    });

    it('brackets full IPv6 address with ssl', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, '2001:db8::1', 5432, 'u', 'p', 'db', true)).toBe(
            'postgres://u:p@[2001:db8::1]:5432/db?sslmode=require'
        );
    });

    it('does not re-bracket an already-bracketed host', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, '[::1]', 5432, 'u', 'p', 'db')).toBe(
            'postgres://u:p@[::1]:5432/db'
        );
    });

    it('leaves IPv4 untouched', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, '127.0.0.1', 5432, 'u', 'p', 'db')).toBe(
            'postgres://u:p@127.0.0.1:5432/db'
        );
    });
});

describe('applySslToUrl — overlay ssl config onto an existing URL', () => {
    it('returns URL unchanged when ssl is undefined', () => {
        const url = 'postgres://u:p@host:5432/db';
        expect(applySslToUrl(url, DB_TYPES.POSTGRES, undefined)).toBe(url);
    });

    it('appends sslmode=require to a postgres URL with no query', () => {
        const url = 'postgres://u:p@host:5432/db';
        expect(applySslToUrl(url, DB_TYPES.POSTGRES, true)).toBe(
            'postgres://u:p@host:5432/db?sslmode=require'
        );
    });

    it('replaces an existing sslmode param', () => {
        const url = 'postgres://u:p@host:5432/db?sslmode=disable&application_name=foo';
        const result = applySslToUrl(url, DB_TYPES.POSTGRES, true);
        expect(result).toContain('sslmode=require');
        expect(result).not.toContain('sslmode=disable');
        // Non-SSL params survive
        expect(result).toContain('application_name=foo');
    });

    it('removes sslmode when ssl: false is set explicitly', () => {
        const url = 'postgres://u:p@host:5432/db?sslmode=require';
        const result = applySslToUrl(url, DB_TYPES.POSTGRES, false);
        expect(result).not.toContain('sslmode');
    });

    it('mssql: overlays encrypt + trustServerCertificate', () => {
        const url = 'mssql://u:p@host:1433/db';
        const result = applySslToUrl(url, DB_TYPES.MSSQL, { rejectUnauthorized: true });
        expect(result).toContain('encrypt=true');
        expect(result).toContain('trustServerCertificate=false');
    });

    it('mssql: replaces existing encrypt param', () => {
        const url = 'mssql://u:p@host:1433/db?encrypt=false&trustServerCertificate=true';
        const result = applySslToUrl(url, DB_TYPES.MSSQL, true);
        expect(result).toContain('encrypt=true');
        expect(result).toContain('trustServerCertificate=true');
        expect(result).not.toContain('encrypt=false');
    });

    it('redis: switches redis:// to rediss:// when ssl enabled', () => {
        expect(applySslToUrl('redis://:pwd@host:6379/0', DB_TYPES.REDIS, true)).toBe(
            'rediss://:pwd@host:6379/0'
        );
    });

    it('redis: switches rediss:// back to redis:// when ssl disabled', () => {
        expect(applySslToUrl('rediss://:pwd@host:6379/0', DB_TYPES.REDIS, false)).toBe(
            'redis://:pwd@host:6379/0'
        );
    });

    it('redis: no-op when protocol already matches', () => {
        expect(applySslToUrl('rediss://host/0', DB_TYPES.REDIS, true)).toBe('rediss://host/0');
    });
});

describe('parseMssqlUrl — SSL handling', () => {
    it('defaults to encrypt:false, trustServerCertificate:true when no query params', () => {
        const cfg = parseMssqlUrl('mssql://user:pass@localhost:1433/mydb');
        expect(cfg.options?.encrypt).toBe(false);
        expect(cfg.options?.trustServerCertificate).toBe(true);
    });

    it('reads encrypt=true, trustServerCertificate=true from URL', () => {
        const cfg = parseMssqlUrl('mssql://user:pass@localhost:1433/mydb?encrypt=true&trustServerCertificate=true');
        expect(cfg.options?.encrypt).toBe(true);
        expect(cfg.options?.trustServerCertificate).toBe(true);
    });

    it('reads encrypt=true, trustServerCertificate=false (verify mode)', () => {
        const cfg = parseMssqlUrl('mssql://user:pass@localhost:1433/mydb?encrypt=true&trustServerCertificate=false');
        expect(cfg.options?.encrypt).toBe(true);
        expect(cfg.options?.trustServerCertificate).toBe(false);
    });

    it('parses host, port, user, password, database correctly with ssl query', () => {
        const cfg = parseMssqlUrl('mssql://alice:secret%40123@db.example.com:1433/mydb?encrypt=true');
        expect(cfg.server).toBe('db.example.com');
        expect(cfg.port).toBe(1433);
        expect(cfg.user).toBe('alice');
        expect(cfg.password).toBe('secret@123');
        expect(cfg.database).toBe('mydb');
    });

    it('reads encrypt=1 numeric form', () => {
        const cfg = parseMssqlUrl('mssql://u:p@host/db?encrypt=1&trustServerCertificate=0');
        expect(cfg.options?.encrypt).toBe(true);
        expect(cfg.options?.trustServerCertificate).toBe(false);
    });
});
