import { describe, it, expect } from 'bun:test';
import { normalizeSsl, buildConnectionUrl } from './index';
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
    const ssl = normalizeSsl(undefined);

    it('builds plain postgres URL with no query string', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, 'localhost', 5432, 'user', 'pass', 'db', ssl)).toBe(
            'postgres://user:pass@localhost:5432/db'
        );
    });

    it('builds plain mysql URL with no query string', () => {
        expect(buildConnectionUrl(DB_TYPES.MYSQL, 'localhost', 3306, 'user', 'pass', 'db', ssl)).toBe(
            'mysql://user:pass@localhost:3306/db'
        );
    });

    it('builds plain mssql URL with no query string', () => {
        expect(buildConnectionUrl(DB_TYPES.MSSQL, 'localhost', 1433, 'user', 'pass', 'db', ssl)).toBe(
            'mssql://user:pass@localhost:1433/db'
        );
    });
});

describe('buildConnectionUrl — ssl require (no verify)', () => {
    const ssl = normalizeSsl(true);

    it('postgres uses sslmode=require', () => {
        expect(buildConnectionUrl(DB_TYPES.POSTGRES, 'host', 5432, 'u', 'p', 'db', ssl)).toBe(
            'postgres://u:p@host:5432/db?sslmode=require'
        );
    });

    it('mysql uses ssl-mode=REQUIRED', () => {
        expect(buildConnectionUrl(DB_TYPES.MYSQL, 'host', 3306, 'u', 'p', 'db', ssl)).toBe(
            'mysql://u:p@host:3306/db?ssl-mode=REQUIRED'
        );
    });

    it('mssql uses encrypt=true, trustServerCertificate=true', () => {
        expect(buildConnectionUrl(DB_TYPES.MSSQL, 'host', 1433, 'u', 'p', 'db', ssl)).toBe(
            'mssql://u:p@host:1433/db?encrypt=true&trustServerCertificate=true'
        );
    });
});

describe('buildConnectionUrl — ssl verify', () => {
    const ssl = normalizeSsl({ rejectUnauthorized: true });

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
    const ssl = normalizeSsl(true);

    it('encodes special characters in password alongside ssl query', () => {
        const url = buildConnectionUrl(DB_TYPES.POSTGRES, 'host', 5432, 'user', 'p@ss/w:rd', 'db', ssl);
        expect(url).toBe('postgres://user:p%40ss%2Fw%3Ard@host:5432/db?sslmode=require');
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
});
