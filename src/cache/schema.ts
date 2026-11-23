/**
 * Schema caching module
 * Caches introspection results per-connection to avoid repeated DB queries
 */

import type { FetchedRows } from '../db/adapter';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { getCacheDir, ensureCacheDir } from '../config/paths';

/** File permissions for sensitive files (owner read/write only) */
const SECURE_FILE_MODE = 0o600;

/** Valid SQL identifier pattern (for path safety) */
/** Connection names that can be file names as they are: no slash, no leading dot */
const SAFE_FILE_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

/** Schema info structure (matches introspect output) */
/** Every table's columns, as `describe` gives them, before any cap */
export type SchemaInfo = Record<string, FetchedRows>;

/** The layout of the cache file. A cache in any other layout, such as 1.x's, is ignored. */
const CACHE_FORMAT = 2;

/** Cached schema data with metadata */
export interface CachedSchema {
    format: typeof CACHE_FORMAT;
    cachedAt: string;
    connectionName: string;
    schema: SchemaInfo;
}

/** Set secure permissions on a file (no-op on Windows) */
function setSecurePermissions(filePath: string): void {
    if (process.platform !== 'win32') {
        fs.chmodSync(filePath, SECURE_FILE_MODE);
    }
}

/**
 * Get the cache file path for a connection's schema
 */
export function getSchemaCachePath(connectionName: string): string {
    // SECURITY: the name becomes a file name, so it must not leave the cache
    // directory. A name that could (a slash, a leading dot) or that is not a
    // plain file name is cached under a hash of itself instead. Every
    // connection name gets a cache; the file records the name it belongs to.
    const stem = SAFE_FILE_NAME.test(connectionName)
        ? connectionName
        : `connection-${createHash('sha256').update(connectionName).digest('hex').slice(0, 16)}`;
    return path.join(getCacheDir(), `${stem}.schema.json`);
}

/**
 * Basic validation that parsed data matches CachedSchema structure
 */
function isValidCachedSchema(data: unknown): data is CachedSchema {
    return (
        typeof data === 'object' &&
        data !== null &&
        (data as CachedSchema).format === CACHE_FORMAT &&
        typeof (data as CachedSchema).cachedAt === 'string' &&
        typeof (data as CachedSchema).connectionName === 'string' &&
        typeof (data as CachedSchema).schema === 'object'
    );
}

/**
 * Get human-readable cache age
 */
export function getCacheAge(cachedAt: string): string {
    const cached = new Date(cachedAt);
    const now = new Date();
    const diffMs = now.getTime() - cached.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'just now';
}

/**
 * Read cached schema for a connection (if it exists and is valid)
 */
export function readSchemaCache(connectionName: string): CachedSchema | null {
    const cachePath = getSchemaCachePath(connectionName);
    if (!fs.existsSync(cachePath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(cachePath, 'utf-8');
        const parsed = JSON.parse(content);

        // Validate structure
        if (!isValidCachedSchema(parsed)) {
            return null;
        }

        // Verify connection name matches (prevents using wrong cache)
        if (parsed.connectionName !== connectionName) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

/**
 * Write schema to cache
 */
export function writeSchemaCache(connectionName: string, schema: SchemaInfo): void {
    ensureCacheDir();
    const cachePath = getSchemaCachePath(connectionName);
    const cacheData: CachedSchema = {
        format: CACHE_FORMAT,
        cachedAt: new Date().toISOString(),
        connectionName,
        schema,
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheData), 'utf-8');
    setSecurePermissions(cachePath);
}
