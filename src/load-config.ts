import { DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Get database configuration for a named connection.
 * Reads from the root load-config.ts file.
 *
 * @param connectionName - The name of the connection to use. Defaults to 'default'.
 * @returns TypeORM DataSourceOptions for the specified connection
 * @throws Error if load-config.ts doesn't exist or connection name is not found
 */
export function loadConfig(connectionName: string = 'default'): DataSourceOptions {
    const configPath = path.resolve(__dirname, '../config.ts');

    if (!fs.existsSync(configPath)) {
        throw new Error(
            `Configuration file not found at ${configPath}\n\n` +
                'Please create a load-config.ts file in the project root.\n' +
                'You can copy config.ts and update it with your database credentials.',
        );
    }

    // Import the config file
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(configPath);

    if (!config.connections) {
        throw new Error(
            'Invalid load-config.ts file: missing "connections" export.\n\n' +
                'Please ensure your load-config.ts exports a "connections" object.\n' +
                'See config.ts for the expected format.',
        );
    }

    const connections = config.connections as Record<string, DataSourceOptions>;

    if (!connections[connectionName]) {
        const availableConnections = Object.keys(connections).join(', ');
        throw new Error(
            `Connection "${connectionName}" not found in config.ts.\n\n` +
                `Available connections: ${availableConnections}\n\n` +
                'Please check your load-config.ts file or use a different connection name.',
        );
    }

    return connections[connectionName];
}
