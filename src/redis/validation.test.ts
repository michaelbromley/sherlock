import { describe, it, expect } from 'bun:test';
import { validateRedisCommand } from './validation';

describe('validateRedisCommand', () => {
    // ========================================================================
    // Allowed commands
    // ========================================================================

    describe('allowed read-only commands', () => {
        const allowedCommands = [
            ['GET', ['mykey']],
            ['MGET', ['key1', 'key2']],
            ['HGETALL', ['myhash']],
            ['LRANGE', ['mylist', '0', '-1']],
            ['SMEMBERS', ['myset']],
            ['ZRANGE', ['myzset', '0', '-1']],
            ['TYPE', ['mykey']],
            ['TTL', ['mykey']],
            ['SCAN', ['0']],
            ['EXISTS', ['mykey']],
            ['INFO', []],
            ['DBSIZE', []],
            ['PING', []],
            ['STRLEN', ['mykey']],
            ['SCARD', ['myset']],
            ['ZCARD', ['myzset']],
            ['LLEN', ['mylist']],
            ['HLEN', ['myhash']],
            ['XLEN', ['mystream']],
            ['XRANGE', ['mystream', '-', '+']],
        ] as const;

        for (const [cmd, args] of allowedCommands) {
            it(`allows ${cmd}`, () => {
                const result = validateRedisCommand(cmd, [...args]);
                expect(result.valid).toBe(true);
            });
        }

        it('is case-insensitive', () => {
            expect(validateRedisCommand('get', ['key']).valid).toBe(true);
            expect(validateRedisCommand('Get', ['key']).valid).toBe(true);
            expect(validateRedisCommand('GET', ['key']).valid).toBe(true);
        });
    });

    // ========================================================================
    // Allowed subcommands
    // ========================================================================

    describe('allowed subcommands', () => {
        const allowedSubcommands = [
            ['CONFIG', 'GET'],
            ['CLIENT', 'LIST'],
            ['CLIENT', 'GETNAME'],
            ['CLIENT', 'ID'],
            ['CLIENT', 'INFO'],
            ['SLOWLOG', 'GET'],
            ['SLOWLOG', 'LEN'],
            ['OBJECT', 'ENCODING'],
            ['MEMORY', 'USAGE'],
            ['MEMORY', 'STATS'],
            ['COMMAND', 'COUNT'],
            ['COMMAND', 'DOCS'],
            ['XINFO', 'STREAM'],
            ['XINFO', 'GROUPS'],
        ] as const;

        for (const [cmd, sub] of allowedSubcommands) {
            it(`allows ${cmd} ${sub}`, () => {
                const result = validateRedisCommand(cmd, [sub]);
                expect(result.valid).toBe(true);
            });
        }

        it('subcommand check is case-insensitive', () => {
            expect(validateRedisCommand('config', ['get']).valid).toBe(true);
            expect(validateRedisCommand('CONFIG', ['Get']).valid).toBe(true);
        });
    });

    // ========================================================================
    // Blocked commands
    // ========================================================================

    describe('blocked mutation commands', () => {
        const blockedCommands = [
            'SET', 'DEL', 'MSET', 'HSET', 'HDEL',
            'LPUSH', 'RPUSH', 'LPOP', 'RPOP',
            'SADD', 'SREM',
            'ZADD', 'ZREM',
            'XADD', 'XDEL',
            'EXPIRE', 'PERSIST', 'RENAME',
            'FLUSHDB', 'FLUSHALL',
            'SHUTDOWN', 'SAVE', 'BGSAVE',
            'SLAVEOF', 'REPLICAOF',
            'DEBUG', 'PUBLISH',
        ];

        for (const cmd of blockedCommands) {
            it(`blocks ${cmd}`, () => {
                const result = validateRedisCommand(cmd);
                expect(result.valid).toBe(false);
                expect(result.error).toContain('not allowed');
            });
        }
    });

    describe('blocked subcommands', () => {
        it('blocks CONFIG SET', () => {
            const result = validateRedisCommand('CONFIG', ['SET', 'maxmemory', '100mb']);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not allowed');
        });

        it('blocks CONFIG RESETSTAT', () => {
            const result = validateRedisCommand('CONFIG', ['RESETSTAT']);
            expect(result.valid).toBe(false);
        });

        it('blocks SLOWLOG RESET', () => {
            const result = validateRedisCommand('SLOWLOG', ['RESET']);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not allowed');
        });
    });

    // ========================================================================
    // Subcommand required
    // ========================================================================

    describe('requires subcommand for multi-word commands', () => {
        const requireSubcommand = ['CONFIG', 'CLIENT', 'SLOWLOG', 'OBJECT', 'MEMORY', 'COMMAND', 'XINFO'];

        for (const cmd of requireSubcommand) {
            it(`rejects bare ${cmd} without subcommand`, () => {
                const result = validateRedisCommand(cmd, []);
                expect(result.valid).toBe(false);
                expect(result.error).toContain('requires a subcommand');
            });
        }
    });

    // ========================================================================
    // Removed dangerous commands
    // ========================================================================

    describe('removed footgun commands', () => {
        it('blocks KEYS (use SCAN instead)', () => {
            const result = validateRedisCommand('KEYS', ['*']);
            expect(result.valid).toBe(false);
        });

        it('blocks DUMP (binary output, useless for JSON CLI)', () => {
            const result = validateRedisCommand('DUMP', ['mykey']);
            expect(result.valid).toBe(false);
        });
    });
});
