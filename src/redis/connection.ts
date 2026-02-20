/**
 * Redis connection handling
 * Manages creating and using Redis connections via Bun's native RedisClient
 */

import { RedisClient } from 'bun';
import { resolveConnection } from '../config';
import type { ResolvedConnectionConfig } from '../config/types';

/**
 * Create a Redis connection from resolved config
 */
export function createRedisConnection(config: ResolvedConnectionConfig): RedisClient {
    return new RedisClient(config.url);
}

/**
 * Execute a command with a Redis connection
 * Automatically handles connection lifecycle (open/close)
 */
export async function withRedisConnection<T>(
    connectionName: string,
    configPath: string | undefined,
    handler: (client: RedisClient) => Promise<T>
): Promise<T> {
    let client: RedisClient | null = null;

    try {
        const config = await resolveConnection(connectionName, configPath);
        client = createRedisConnection(config);
        return await handler(client);
    } finally {
        if (client) {
            client.close();
        }
    }
}
