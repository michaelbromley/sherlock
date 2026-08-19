import { describe, it, expect } from 'bun:test';
import { rewriteUrlEndpoint } from './index';

describe('rewriteUrlEndpoint', () => {
    it('redirects a postgres URL, preserving credentials and database', () => {
        expect(
            rewriteUrlEndpoint('postgres://user:pass@db.example.com:5432/mydb', '127.0.0.1', 15432)
        ).toBe('postgres://user:pass@127.0.0.1:15432/mydb');
    });

    it('preserves SSL query parameters', () => {
        expect(
            rewriteUrlEndpoint(
                'postgres://user:pass@db.example.com:5432/mydb?sslmode=require',
                '127.0.0.1',
                15432
            )
        ).toBe('postgres://user:pass@127.0.0.1:15432/mydb?sslmode=require');
    });

    it('preserves percent-encoded passwords', () => {
        expect(
            rewriteUrlEndpoint('postgres://user:p%40ss%3A1@db.example.com:5432/mydb', '127.0.0.1', 15432)
        ).toBe('postgres://user:p%40ss%3A1@127.0.0.1:15432/mydb');
    });

    it('redirects mysql URLs', () => {
        expect(rewriteUrlEndpoint('mysql://u:p@h.example.com:3306/db', '127.0.0.1', 13306)).toBe(
            'mysql://u:p@127.0.0.1:13306/db'
        );
    });

    it('redirects redis URLs, keeping the database number', () => {
        expect(rewriteUrlEndpoint('redis://:secret@r.example.com:6379/2', '127.0.0.1', 16379)).toBe(
            'redis://:secret@127.0.0.1:16379/2'
        );
    });

    it('keeps the rediss scheme so TLS stays on', () => {
        expect(rewriteUrlEndpoint('rediss://:secret@r.example.com:6379/0', '127.0.0.1', 16379)).toBe(
            'rediss://:secret@127.0.0.1:16379/0'
        );
    });

    it('redirects mssql URLs', () => {
        expect(
            rewriteUrlEndpoint('mssql://sa:pw@h.example.com:1433/master?encrypt=true', '127.0.0.1', 11433)
        ).toBe('mssql://sa:pw@127.0.0.1:11433/master?encrypt=true');
    });

    it('replaces a URL that had no explicit port', () => {
        expect(rewriteUrlEndpoint('postgres://user:pass@db.example.com/mydb', '127.0.0.1', 15432)).toBe(
            'postgres://user:pass@127.0.0.1:15432/mydb'
        );
    });

    it('rejects an unparseable URL rather than connecting somewhere unintended', () => {
        expect(() => rewriteUrlEndpoint('not a url', '127.0.0.1', 15432)).toThrow(/not a parseable/);
    });
});
