/**
 * Redis connection handling
 * Manages creating and using Redis connections via Bun's native RedisClient
 */

import { RedisClient } from 'bun';
import { resolveConnection } from '../config';
import { startTunnelKeepalive } from '../tunnel/manager';
import type { ResolvedConnectionConfig } from '../config/types';
import { connectTimeoutFor } from '../db/connect-timeout';
import { classifyDbError } from '../db/errors';
import type { WarningSink } from '../output/warnings';

/**
 * Create a Redis connection from resolved config
 */
export function createRedisConnection(config: ResolvedConnectionConfig): RedisClient {
    return new RedisClient(config.url, { connectionTimeout: connectTimeoutFor(config) });
}

/**
 * Execute a command with a pre-resolved Redis connection config
 * Skips the name-based config lookup — used for ad hoc --url connections
 */
export async function withRedisConnectionFromConfig<T>(
    config: ResolvedConnectionConfig,
    handler: (client: RedisClient) => Promise<T>
): Promise<T> {
    let client: RedisClient | null = null;

    try {
        client = createRedisConnection(config);
        return await handler(client);
    } catch (error) {
        throw classifyDbError(error, config);
    } finally {
        if (client) {
            client.close();
        }
    }
}

/**
 * Execute a command with a Redis connection
 * Automatically handles connection lifecycle (open/close)
 */
export async function withRedisConnection<T>(
    connectionName: string,
    configPath: string | undefined,
    handler: (client: RedisClient) => Promise<T>,
    warnings?: WarningSink
): Promise<T> {
    let client: RedisClient | null = null;
    let stopKeepalive: (() => void) | null = null;

    let config: ResolvedConnectionConfig | null = null;

    try {
        config = await resolveConnection(connectionName, configPath, warnings);
        stopKeepalive = startTunnelKeepalive(connectionName);
        client = createRedisConnection(config);
        return await handler(client);
    } catch (error) {
        throw config ? classifyDbError(error, config) : error;
    } finally {
        stopKeepalive?.();
        if (client) {
            client.close();
        }
    }
}
