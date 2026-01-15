/**
 * Schema caching module
 * Caches introspection results per-connection to avoid repeated DB queries
 */

import * as fs from 'fs';
import * as path from 'path';
import { getCacheDir, ensureCacheDir } from '../config/paths';

/** File permissions for sensitive files (owner read/write only) */
const SECURE_FILE_MODE = 0o600;

/** Valid SQL identifier pattern (for path safety) */
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Schema info structure (matches introspect output) */
export interface SchemaInfo {
    [tableName: string]: {
        columns: unknown[];
    };
}

/** Cached schema data with metadata */
export interface CachedSchema {
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
    // SECURITY: Validate connection name to prevent path traversal
    if (!SAFE_IDENTIFIER.test(connectionName)) {
        throw new Error(`Invalid connection name for caching: "${connectionName}"`);
    }
    return path.join(getCacheDir(), `${connectionName}.schema.json`);
}

/**
 * Basic validation that parsed data matches CachedSchema structure
 */
function isValidCachedSchema(data: unknown): data is CachedSchema {
    return (
        typeof data === 'object' &&
        data !== null &&
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
        cachedAt: new Date().toISOString(),
        connectionName,
        schema,
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    setSecurePermissions(cachePath);
}
