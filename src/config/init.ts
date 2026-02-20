/**
 * Config initialization and migration utilities
 * Extracted from query-db.ts so both CLI commands and TUI can use them.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getConfigDir, ensureConfigDir } from './paths';
import type { ConnectionConfig } from './types';
import { DB_TYPES, type DbType } from '../db-types';

/** File permissions for sensitive config files (owner read/write only) */
const SECURE_FILE_MODE = 0o600;

/** Set secure permissions on a file (no-op on Windows) */
export function setSecurePermissions(filePath: string): void {
    if (process.platform !== 'win32') {
        fs.chmodSync(filePath, SECURE_FILE_MODE);
    }
}

/**
 * Create a template config file (non-interactive)
 */
export async function initConfig(): Promise<void> {
    ensureConfigDir();
    const configDir = getConfigDir();
    const configPath = path.join(configDir, 'config.json');
    const envPath = path.join(configDir, '.env');

    if (fs.existsSync(configPath)) {
        console.log(`Config already exists at: ${configPath}`);
        return;
    }

    const exampleConfig = {
        version: '2.0',
        connections: {
            'myapp-prod': {
                type: DB_TYPES.POSTGRES,
                host: 'localhost',
                port: 5432,
                database: 'myapp',
                username: { $env: 'SHERLOCK_MYAPP_PROD_USERNAME' },
                password: { $env: 'SHERLOCK_MYAPP_PROD_PASSWORD' },
            },
            'myapp-staging': {
                type: DB_TYPES.POSTGRES,
                host: 'localhost',
                port: 5432,
                database: 'myapp_staging',
                username: { $env: 'SHERLOCK_MYAPP_STAGING_USERNAME' },
                password: { $env: 'SHERLOCK_MYAPP_STAGING_PASSWORD' },
            },
        },
    };

    fs.writeFileSync(configPath, JSON.stringify(exampleConfig, null, 2), 'utf-8');
    setSecurePermissions(configPath);

    const exampleEnv = `# Sherlock Database Credentials
# Set your database credentials here

# Production database
SHERLOCK_MYAPP_PROD_USERNAME=your_username
SHERLOCK_MYAPP_PROD_PASSWORD=your_password

# Staging database
SHERLOCK_MYAPP_STAGING_USERNAME=your_username
SHERLOCK_MYAPP_STAGING_PASSWORD=your_password
`;

    fs.writeFileSync(envPath, exampleEnv, 'utf-8');
    setSecurePermissions(envPath);

    console.log(`Sherlock initialized!

Config created at: ${configPath}
Env file created at: ${envPath}

Next steps:
1. Edit ${configPath} to add your database connections
2. Set your credentials in ${envPath} or use 'sherlock keychain set <name>'
3. Run 'sherlock connections' to list configured connections
4. Run 'sherlock test <connection>' to verify a connection
5. Run 'sherlock -c <connection> tables' to list tables
`);
}

/**
 * Migrate a legacy config.ts to new JSON format
 */
export async function migrateConfig(fromPath: string): Promise<void> {
    const absoluteFromPath = path.resolve(fromPath);

    if (!fs.existsSync(absoluteFromPath)) {
        console.error(`Legacy config not found: ${absoluteFromPath}`);
        process.exit(1);
    }

    console.log(`Migrating from: ${absoluteFromPath}`);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const legacyConfig = require(absoluteFromPath);

    if (!legacyConfig.connections) {
        console.error('Invalid legacy config: missing "connections" export');
        process.exit(1);
    }

    interface LegacyConnectionOpts {
        type: string;
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        database?: string;
    }

    const newConnections: Record<string, ConnectionConfig> = {};
    const envVars: string[] = [];

    for (const [name, opts] of Object.entries(legacyConfig.connections as Record<string, LegacyConnectionOpts>)) {
        const envPrefix = `SHERLOCK_${name.toUpperCase().replace(/-/g, '_')}`;

        const newConn: ConnectionConfig = {
            type: opts.type === 'better-sqlite3' ? DB_TYPES.SQLITE : opts.type as DbType,
        };

        if (opts.type === 'better-sqlite3' || opts.type === DB_TYPES.SQLITE) {
            newConn.filename = opts.database;
        } else {
            newConn.host = opts.host;
            newConn.port = opts.port;
            newConn.database = opts.database;
            newConn.username = { $env: `${envPrefix}_USERNAME` };
            newConn.password = { $env: `${envPrefix}_PASSWORD` };
            envVars.push(`${envPrefix}_USERNAME=${opts.username || ''}`);
            envVars.push(`${envPrefix}_PASSWORD=${opts.password || ''}`);
        }

        newConnections[name] = newConn;
    }

    const newConfig = {
        version: '2.0',
        connections: newConnections,
    };

    ensureConfigDir();
    const configDir = getConfigDir();
    const configPath = path.join(configDir, 'config.json');
    const envPath = path.join(configDir, '.env');

    if (fs.existsSync(configPath)) {
        console.log(`\x1b[33mWarning: ${configPath} already exists\x1b[0m`);
        const backupPath = configPath + '.backup.' + Date.now();
        fs.copyFileSync(configPath, backupPath);
        console.log(`  Backed up to: ${backupPath}`);
    }

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
    setSecurePermissions(configPath);
    console.log(`\x1b[32m✓\x1b[0m Created: ${configPath}`);

    const envContent = `# Sherlock Database Credentials
# Generated by 'sherlock migrate' from ${fromPath}
# IMPORTANT: Review and update these credentials!

${envVars.join('\n')}
`;

    fs.writeFileSync(envPath, envContent, 'utf-8');
    setSecurePermissions(envPath);
    console.log(`\x1b[32m✓\x1b[0m Created: ${envPath}`);

    console.log(`
Migration complete!

\x1b[33mIMPORTANT:\x1b[0m
1. Review ${envPath} and ensure credentials are correct
2. The .env file contains your credentials - keep it secure!
3. You can now delete the old ${fromPath} file
4. Run 'sherlock test <connection>' to verify each connection
`);
}
