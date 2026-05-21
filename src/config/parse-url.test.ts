import { describe, it, expect } from 'bun:test';
import { parseConnectionUrl, buildConnectionUrl, normalizeSsl } from './index';
import { DB_TYPES } from '../db-types';

describe('parseConnectionUrl — postgres', () => {
    it('parses a full postgres URL', () => {
        expect(parseConnectionUrl('postgres://user:pass@host.example.com:5432/mydb')).toEqual({
            type: DB_TYPES.POSTGRES,
            host: 'host.example.com',
            port: 5432,
            username: 'user',
            password: 'pass',
            database: 'mydb',
        });
    });

    it('accepts postgresql:// scheme alias', () => {
        const parsed = parseConnectionUrl('postgresql://user:pass@host:5432/db');
        expect(parsed?.type).toBe(DB_TYPES.POSTGRES);
        expect(parsed?.host).toBe('host');
    });

    it('omits port when absent', () => {
        const parsed = parseConnectionUrl('postgres://user:pass@host/db');
        expect(parsed?.port).toBeUndefined();
    });

    it('omits password when absent', () => {
        const parsed = parseConnectionUrl('postgres://user@host/db');
        expect(parsed?.password).toBeUndefined();
        expect(parsed?.username).toBe('user');
    });

    it('omits database when absent', () => {
        const parsed = parseConnectionUrl('postgres://user:pass@host:5432');
        expect(parsed?.database).toBeUndefined();
    });

    it('decodes URL-encoded password', () => {
        const parsed = parseConnectionUrl('postgres://user:p%40ss%2Fw%3Ard@host/db');
        expect(parsed?.password).toBe('p@ss/w:rd');
    });

    it('detects sslmode=require → ssl: true', () => {
        const parsed = parseConnectionUrl('postgres://u:p@host/db?sslmode=require');
        expect(parsed?.ssl).toBe(true);
    });

    it('detects sslmode=verify-full → ssl with verify', () => {
        const parsed = parseConnectionUrl('postgres://u:p@host/db?sslmode=verify-full');
        expect(parsed?.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('detects sslmode=disable → ssl: false', () => {
        const parsed = parseConnectionUrl('postgres://u:p@host/db?sslmode=disable');
        expect(parsed?.ssl).toBe(false);
    });

    it('omits ssl when no sslmode param', () => {
        const parsed = parseConnectionUrl('postgres://u:p@host/db');
        expect(parsed?.ssl).toBeUndefined();
    });
});

describe('parseConnectionUrl — mysql', () => {
    it('parses a full mysql URL', () => {
        expect(parseConnectionUrl('mysql://root:secret@db.host:3306/myapp')).toEqual({
            type: DB_TYPES.MYSQL,
            host: 'db.host',
            port: 3306,
            username: 'root',
            password: 'secret',
            database: 'myapp',
        });
    });

    it('detects ssl-mode=REQUIRED', () => {
        const parsed = parseConnectionUrl('mysql://u:p@host/db?ssl-mode=REQUIRED');
        expect(parsed?.ssl).toBe(true);
    });

    it('detects ssl-mode=VERIFY_IDENTITY', () => {
        const parsed = parseConnectionUrl('mysql://u:p@host/db?ssl-mode=VERIFY_IDENTITY');
        expect(parsed?.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('detects ssl-mode=DISABLED', () => {
        const parsed = parseConnectionUrl('mysql://u:p@host/db?ssl-mode=DISABLED');
        expect(parsed?.ssl).toBe(false);
    });
});

describe('parseConnectionUrl — mssql', () => {
    it('parses a full mssql URL', () => {
        expect(parseConnectionUrl('mssql://sa:secret@server:1433/master')).toEqual({
            type: DB_TYPES.MSSQL,
            host: 'server',
            port: 1433,
            username: 'sa',
            password: 'secret',
            database: 'master',
        });
    });

    it('detects encrypt=true&trustServerCertificate=true → ssl: true', () => {
        const parsed = parseConnectionUrl(
            'mssql://u:p@host/db?encrypt=true&trustServerCertificate=true'
        );
        expect(parsed?.ssl).toBe(true);
    });

    it('detects encrypt=true&trustServerCertificate=false → verify', () => {
        const parsed = parseConnectionUrl(
            'mssql://u:p@host/db?encrypt=true&trustServerCertificate=false'
        );
        expect(parsed?.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('detects encrypt=false → ssl: false', () => {
        const parsed = parseConnectionUrl('mssql://u:p@host/db?encrypt=false');
        expect(parsed?.ssl).toBe(false);
    });
});

describe('parseConnectionUrl — redis', () => {
    it('parses redis:// without ssl', () => {
        const parsed = parseConnectionUrl('redis://:pass@host:6379/0');
        expect(parsed?.type).toBe(DB_TYPES.REDIS);
        expect(parsed?.host).toBe('host');
        expect(parsed?.port).toBe(6379);
        expect(parsed?.password).toBe('pass');
        expect(parsed?.database).toBe('0');
        expect(parsed?.ssl).toBeUndefined();
    });

    it('detects rediss:// → ssl: true', () => {
        const parsed = parseConnectionUrl('rediss://:pass@host:6380/1');
        expect(parsed?.type).toBe(DB_TYPES.REDIS);
        expect(parsed?.ssl).toBe(true);
    });
});

describe('parseConnectionUrl — sqlite', () => {
    it('parses file:// URL', () => {
        const parsed = parseConnectionUrl('file:///path/to/my.db');
        expect(parsed?.type).toBe(DB_TYPES.SQLITE);
        expect(parsed?.database).toBe('path/to/my.db');
    });
});

describe('parseConnectionUrl — invalid input', () => {
    it('returns null for empty string', () => {
        expect(parseConnectionUrl('')).toBeNull();
    });

    it('returns null for whitespace', () => {
        expect(parseConnectionUrl('   ')).toBeNull();
    });

    it('returns null for non-URL text', () => {
        expect(parseConnectionUrl('just some text')).toBeNull();
    });

    it('returns null for unsupported scheme', () => {
        expect(parseConnectionUrl('mongodb://user:pass@host/db')).toBeNull();
    });
});

describe('roundtrip with buildConnectionUrl', () => {
    it('postgres without ssl', () => {
        const url = buildConnectionUrl(
            DB_TYPES.POSTGRES, 'host', 5432, 'user', 'pass', 'db', normalizeSsl(undefined)
        );
        const parsed = parseConnectionUrl(url);
        expect(parsed?.type).toBe(DB_TYPES.POSTGRES);
        expect(parsed?.host).toBe('host');
        expect(parsed?.port).toBe(5432);
        expect(parsed?.username).toBe('user');
        expect(parsed?.password).toBe('pass');
        expect(parsed?.database).toBe('db');
        expect(parsed?.ssl).toBeUndefined();
    });

    it('postgres with ssl require', () => {
        const url = buildConnectionUrl(
            DB_TYPES.POSTGRES, 'host', 5432, 'user', 'pass', 'db', normalizeSsl(true)
        );
        expect(parseConnectionUrl(url)?.ssl).toBe(true);
    });

    it('postgres with ssl verify', () => {
        const url = buildConnectionUrl(
            DB_TYPES.POSTGRES, 'host', 5432, 'user', 'pass', 'db',
            normalizeSsl({ rejectUnauthorized: true })
        );
        expect(parseConnectionUrl(url)?.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('mssql with ssl verify roundtrip', () => {
        const url = buildConnectionUrl(
            DB_TYPES.MSSQL, 'host', 1433, 'user', 'pass', 'db',
            normalizeSsl({ rejectUnauthorized: true })
        );
        expect(parseConnectionUrl(url)?.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('postgres with special chars in password roundtrips', () => {
        const url = buildConnectionUrl(
            DB_TYPES.POSTGRES, 'host', 5432, 'user', 'p@ss/w:rd&!', 'db', normalizeSsl(true)
        );
        expect(parseConnectionUrl(url)?.password).toBe('p@ss/w:rd&!');
    });
});
