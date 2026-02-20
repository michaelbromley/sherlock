/**
 * Redis operations
 * All read-only Redis operations for the CLI commands
 */

import type { RedisClient } from 'bun';
import { validateRedisCommand } from './validation';

// ============================================================================
// Types
// ============================================================================

export interface ServerInfoResult {
    server?: Record<string, string>;
    memory?: Record<string, string>;
    keyspace: Record<string, Record<string, number>>;
    dbsize: number;
    [section: string]: unknown;
}

export interface KeyInfo {
    key: string;
    type?: string;
    ttl?: number;
}

export interface ScanKeysResult {
    pattern: string;
    count: number;
    keys: KeyInfo[];
}

export interface KeyValueResult {
    key: string;
    type: string;
    exists?: boolean;
    ttl?: number;
    value?: unknown;
    length?: number;
    size?: number;
}

export interface InspectKeyResult {
    key: string;
    exists: boolean;
    type?: string;
    ttl?: number;
    memoryUsage?: number | null;
    encoding?: string | null;
    length?: number;
}

export interface SlowlogEntry {
    id: unknown;
    timestamp: unknown;
    duration: unknown;
    command: unknown;
    clientAddr?: unknown;
    clientName?: unknown;
}

export interface SlowlogResult {
    entries: SlowlogEntry[];
}

// ============================================================================
// Constants
// ============================================================================

/** Number of keys to request per SCAN iteration */
const SCAN_BATCH_SIZE = 100;

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Parse Redis INFO output into structured sections.
 * Redis INFO uses \r\n line endings (RESP protocol), not plain \n.
 */
function parseInfoString(info: string): Record<string, Record<string, string>> {
    const sections: Record<string, Record<string, string>> = {};
    let currentSection = '';

    for (const line of info.split('\r\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('#')) {
            currentSection = trimmed.slice(2).trim().toLowerCase();
            sections[currentSection] = {};
        } else if (currentSection) {
            const eqIndex = trimmed.indexOf(':');
            if (eqIndex !== -1) {
                const key = trimmed.slice(0, eqIndex);
                const value = trimmed.slice(eqIndex + 1);
                sections[currentSection][key] = value;
            }
        }
    }

    return sections;
}

/**
 * Parse keyspace info string like "keys=12345,expires=100,avg_ttl=5000"
 */
function parseKeyspaceValue(value: string): Record<string, number> {
    const result: Record<string, number> = {};
    for (const part of value.split(',')) {
        const [key, val] = part.split('=');
        if (key && val) {
            result[key] = parseInt(val, 10);
        }
    }
    return result;
}

/**
 * Collect members from a set using SSCAN (bounded, unlike SMEMBERS which returns all)
 */
async function sscanMembers(client: RedisClient, key: string, limit: number): Promise<string[]> {
    const members: string[] = [];
    let cursor = '0';

    do {
        const result = await client.send(['SSCAN', key, cursor, 'COUNT', String(SCAN_BATCH_SIZE)]) as [string, string[]];
        cursor = String(result[0]);
        members.push(...result[1]);
    } while (cursor !== '0' && members.length < limit);

    return members.slice(0, limit);
}

// ============================================================================
// Operations
// ============================================================================

/**
 * Get server info, memory stats, and keyspace overview
 */
export async function getServerInfo(
    client: RedisClient,
    section?: string
): Promise<ServerInfoResult> {
    const args = section ? ['INFO', section] : ['INFO'];
    const info = await client.send(args) as string;
    const parsed = parseInfoString(info);

    const dbsize = await client.send(['DBSIZE']) as number;

    if (section) {
        return { [section]: parsed[section.toLowerCase()] || {}, keyspace: {}, dbsize };
    }

    // Build keyspace with parsed db info
    const keyspace: Record<string, Record<string, number>> = {};
    if (parsed.keyspace) {
        for (const [db, value] of Object.entries(parsed.keyspace)) {
            keyspace[db] = parseKeyspaceValue(value);
        }
    }

    return {
        server: parsed.server || {},
        memory: parsed.memory || {},
        keyspace,
        dbsize,
    };
}

/**
 * Scan for keys matching a glob pattern
 */
export async function scanKeys(
    client: RedisClient,
    pattern: string,
    limit: number,
    includeTypes: boolean
): Promise<ScanKeysResult> {
    const keys: string[] = [];
    let cursor = '0';

    // SCAN in batches until we have enough or cursor returns to 0
    do {
        const result = await client.send(['SCAN', cursor, 'MATCH', pattern, 'COUNT', String(SCAN_BATCH_SIZE)]) as [string, string[]];
        cursor = String(result[0]);
        keys.push(...result[1]);
    } while (cursor !== '0' && keys.length < limit);

    // Trim to limit
    const trimmedKeys = keys.slice(0, limit);

    // Enrich with type and TTL if requested
    const enrichedKeys: KeyInfo[] = [];
    for (const key of trimmedKeys) {
        if (includeTypes) {
            const [type, ttl] = await Promise.all([
                client.send(['TYPE', key]) as Promise<string>,
                client.send(['TTL', key]) as Promise<number>,
            ]);
            enrichedKeys.push({ key, type, ttl });
        } else {
            enrichedKeys.push({ key });
        }
    }

    return {
        pattern,
        count: enrichedKeys.length,
        keys: enrichedKeys,
    };
}

/**
 * Get the value of a key, auto-detecting its type
 */
export async function getKeyValue(
    client: RedisClient,
    key: string,
    limit = 100
): Promise<KeyValueResult> {
    const type = await client.send(['TYPE', key]) as string;
    const ttl = await client.send(['TTL', key]) as number;

    if (type === 'none') {
        return { key, type: 'none', exists: false };
    }

    switch (type) {
        case 'string': {
            const value = await client.send(['GET', key]) as string;
            return { key, type, ttl, value };
        }

        case 'hash': {
            const raw = await client.send(['HGETALL', key]) as string[];
            const value: Record<string, string> = {};
            for (let i = 0; i < raw.length; i += 2) {
                value[raw[i]] = raw[i + 1];
            }
            return { key, type, ttl, value };
        }

        case 'list': {
            const length = await client.send(['LLEN', key]) as number;
            const value = await client.send(['LRANGE', key, '0', String(limit - 1)]) as string[];
            return { key, type, ttl, length, value };
        }

        case 'set': {
            const size = await client.send(['SCARD', key]) as number;
            const value = await sscanMembers(client, key, limit);
            return { key, type, ttl, size, value };
        }

        case 'zset': {
            const size = await client.send(['ZCARD', key]) as number;
            const raw = await client.send(['ZRANGE', key, '0', String(limit - 1), 'WITHSCORES']) as string[];
            const value: { member: string; score: number }[] = [];
            for (let i = 0; i < raw.length; i += 2) {
                value.push({ member: raw[i], score: parseFloat(raw[i + 1]) });
            }
            return { key, type, ttl, size, value };
        }

        case 'stream': {
            const length = await client.send(['XLEN', key]) as number;
            return { key, type, ttl, length };
        }

        default:
            return { key, type, ttl };
    }
}

/**
 * Get key metadata: type, TTL, memory usage, encoding, length
 */
export async function inspectKey(
    client: RedisClient,
    key: string
): Promise<InspectKeyResult> {
    const exists = await client.send(['EXISTS', key]) as number;

    if (!exists) {
        return { key, exists: false };
    }

    const [type, ttl, memoryUsage, encoding] = await Promise.all([
        client.send(['TYPE', key]) as Promise<string>,
        client.send(['TTL', key]) as Promise<number>,
        client.send(['MEMORY', 'USAGE', key]).catch(() => null) as Promise<number | null>,
        client.send(['OBJECT', 'ENCODING', key]).catch(() => null) as Promise<string | null>,
    ]);

    const result: InspectKeyResult = {
        key,
        exists: true,
        type,
        ttl,
        memoryUsage,
        encoding,
    };

    // Get type-specific length
    switch (type) {
        case 'string':
            result.length = await client.send(['STRLEN', key]) as number;
            break;
        case 'hash':
            result.length = await client.send(['HLEN', key]) as number;
            break;
        case 'list':
            result.length = await client.send(['LLEN', key]) as number;
            break;
        case 'set':
            result.length = await client.send(['SCARD', key]) as number;
            break;
        case 'zset':
            result.length = await client.send(['ZCARD', key]) as number;
            break;
        case 'stream':
            result.length = await client.send(['XLEN', key]) as number;
            break;
    }

    return result;
}

/**
 * Get recent slow log entries
 */
export async function getSlowlog(
    client: RedisClient,
    count = 10
): Promise<SlowlogResult> {
    const raw = await client.send(['SLOWLOG', 'GET', String(count)]) as unknown[][];

    const entries: SlowlogEntry[] = raw.map((entry: unknown[]) => ({
        id: entry[0],
        timestamp: entry[1],
        duration: entry[2],
        command: Array.isArray(entry[3]) ? (entry[3] as string[]).join(' ') : entry[3],
        ...(entry[4] ? { clientAddr: entry[4] } : {}),
        ...(entry[5] ? { clientName: entry[5] } : {}),
    }));

    return { entries };
}

/**
 * Execute an arbitrary read-only Redis command
 */
export async function executeCommand(
    client: RedisClient,
    cmd: string,
    args: string[]
): Promise<unknown> {
    const validation = validateRedisCommand(cmd, args);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    return await client.send([cmd, ...args]);
}
