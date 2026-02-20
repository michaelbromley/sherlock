/**
 * Redis command validation
 * Ensures only read-only commands are executed
 */

import type { ValidationResult } from '../query-validation';

/** Read-only Redis commands that are safe to execute */
const ALLOWED_REDIS_COMMANDS = new Set([
    // Strings
    'GET', 'MGET', 'STRLEN', 'GETRANGE',
    // Hashes
    'HGET', 'HMGET', 'HGETALL', 'HKEYS', 'HVALS', 'HLEN', 'HEXISTS', 'HSCAN',
    // Lists
    'LRANGE', 'LLEN', 'LINDEX', 'LPOS',
    // Sets
    'SMEMBERS', 'SCARD', 'SISMEMBER', 'SRANDMEMBER', 'SUNION', 'SINTER', 'SDIFF', 'SSCAN',
    // Sorted sets
    'ZRANGE', 'ZCARD', 'ZSCORE', 'ZRANK', 'ZREVRANK', 'ZCOUNT', 'ZSCAN', 'ZRANGEBYSCORE', 'ZRANGEBYLEX',
    // Keys
    'TYPE', 'TTL', 'PTTL', 'EXISTS', 'SCAN', 'KEYS', 'RANDOMKEY', 'OBJECT', 'DUMP',
    // Server
    'INFO', 'DBSIZE', 'CONFIG', 'CLIENT', 'SLOWLOG', 'MEMORY', 'TIME', 'COMMAND',
    // Streams
    'XINFO', 'XLEN', 'XRANGE', 'XREVRANGE', 'XREAD',
    // Connection
    'PING', 'ECHO',
]);

/** Subcommands that must be read-only for multi-word commands */
const ALLOWED_SUBCOMMANDS: Record<string, Set<string>> = {
    'CONFIG': new Set(['GET']),
    'CLIENT': new Set(['LIST', 'GETNAME', 'ID', 'INFO']),
    'SLOWLOG': new Set(['GET', 'LEN', 'RESET']),
    'OBJECT': new Set(['ENCODING', 'REFCOUNT', 'IDLETIME', 'HELP', 'FREQ']),
    'MEMORY': new Set(['USAGE', 'DOCTOR', 'STATS', 'HELP']),
    'COMMAND': new Set(['COUNT', 'DOCS', 'GETKEYS', 'INFO', 'LIST']),
    'XINFO': new Set(['STREAM', 'GROUPS', 'CONSUMERS', 'HELP']),
};

/**
 * Validates that a Redis command is read-only and safe to execute.
 */
export function validateRedisCommand(cmd: string, args: string[] = []): ValidationResult {
    const upperCmd = cmd.toUpperCase();

    if (!ALLOWED_REDIS_COMMANDS.has(upperCmd)) {
        return {
            valid: false,
            error: `Command "${cmd}" is not allowed (read-only mode). Only read operations are permitted.`,
        };
    }

    // Check subcommands for multi-word commands
    const allowedSubs = ALLOWED_SUBCOMMANDS[upperCmd];
    if (allowedSubs && args.length > 0) {
        const subCmd = args[0].toUpperCase();
        if (!allowedSubs.has(subCmd)) {
            return {
                valid: false,
                error: `"${cmd} ${args[0]}" is not allowed (read-only mode). Allowed: ${cmd} ${[...allowedSubs].join('|')}`,
            };
        }
    }

    return { valid: true };
}
