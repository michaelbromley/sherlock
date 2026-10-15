import { describe, it, expect } from 'bun:test';
import { applyPublicKeyRetrievalToUrl, parseConnectionUrl } from './index';
import { buildConnectionConfig } from './connection-input';
import { DB_TYPES } from '../db-types';

describe('applyPublicKeyRetrievalToUrl', () => {
    it('adds the param to a mysql URL when enabled', () => {
        expect(applyPublicKeyRetrievalToUrl('mysql://u:p@host:3306/db', DB_TYPES.MYSQL, true)).toBe(
            'mysql://u:p@host:3306/db?allowPublicKeyRetrieval=true'
        );
    });

    it('keeps existing query params', () => {
        expect(
            applyPublicKeyRetrievalToUrl('mysql://u:p@host:3306/db?ssl-mode=DISABLED', DB_TYPES.MYSQL, true)
        ).toBe('mysql://u:p@host:3306/db?ssl-mode=DISABLED&allowPublicKeyRetrieval=true');
    });

    it('leaves the URL alone when not enabled', () => {
        expect(applyPublicKeyRetrievalToUrl('mysql://u:p@host:3306/db', DB_TYPES.MYSQL, undefined)).toBe(
            'mysql://u:p@host:3306/db'
        );
        expect(applyPublicKeyRetrievalToUrl('mysql://u:p@host:3306/db', DB_TYPES.MYSQL, false)).toBe(
            'mysql://u:p@host:3306/db'
        );
    });

    it('ignores non-mysql connections', () => {
        expect(applyPublicKeyRetrievalToUrl('postgres://u:p@host:5432/db', DB_TYPES.POSTGRES, true)).toBe(
            'postgres://u:p@host:5432/db'
        );
    });
});

describe('parseConnectionUrl — allowPublicKeyRetrieval', () => {
    it('detects the param on a mysql URL', () => {
        expect(parseConnectionUrl('mysql://u:p@host/db?allowPublicKeyRetrieval=true')?.allowPublicKeyRetrieval).toBe(true);
    });

    it('is absent when the param is missing or false', () => {
        expect(parseConnectionUrl('mysql://u:p@host/db')?.allowPublicKeyRetrieval).toBeUndefined();
        expect(parseConnectionUrl('mysql://u:p@host/db?allowPublicKeyRetrieval=false')?.allowPublicKeyRetrieval).toBeUndefined();
    });

    it('is ignored on other database types', () => {
        expect(parseConnectionUrl('postgres://u:p@host/db?allowPublicKeyRetrieval=true')?.allowPublicKeyRetrieval).toBeUndefined();
    });

    it('is carried into a config built with --from-url', () => {
        const config = buildConnectionConfig('prod', {
            fromUrl: 'mysql://alice@db.example.com:3306/app?allowPublicKeyRetrieval=true',
        });
        expect(config.allowPublicKeyRetrieval).toBe(true);
    });
});
