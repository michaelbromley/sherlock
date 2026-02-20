/**
 * TUI (Terminal User Interface) for Sherlock
 * Interactive prompts for managing database connections
 */
import * as p from '@clack/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { findConfigFile, getConfigDir, ensureConfigDir } from '../config/paths';
import { loadConfigFile, listConnections } from '../config';
import type { SherlockConfig, ConnectionConfig } from '../config/types';
import { DB_TYPES, DEFAULT_PORTS, TEST_QUERIES, isRedisConfig, type DbType } from '../db-types';
import {
    setKeychainPassword,
    hasKeychainPassword,
    deleteKeychainPassword,
} from '../credentials/providers/keychain';
import { initConfig, migrateConfig } from '../config/init';

// ============================================================================
// Connection Manager Menu (main entry point)
// ============================================================================

/**
 * Interactive menu for managing connections — the single hub for all
 * connection/config management. Auto-triggers setup if no config exists.
 */
export async function connectionManagerMenu(): Promise<void> {
    p.intro('Sherlock Connection Manager');

    // Auto-setup: if no config exists, offer to run the setup wizard
    const configExists = findConfigFile() !== null;
    if (!configExists) {
        const runSetup = await p.confirm({
            message: 'No configuration found. Would you like to set up Sherlock now?',
            initialValue: true,
        });

        if (p.isCancel(runSetup)) {
            p.outro('Goodbye!');
            return;
        }

        if (runSetup) {
            await runSetupWizard();
        } else {
            p.outro('Run `sherlock manage` again when you\'re ready.');
            return;
        }
    }

    // Main menu loop
    while (true) {
        let connections: string[] = [];
        try {
            connections = listConnections();
        } catch {
            // No config yet
        }

        const hasConnections = connections.length > 0;

        type MenuOption = { value: string; label: string; hint?: string };
        const options: MenuOption[] = [
            { value: 'add', label: 'Add connection' },
        ];

        if (hasConnections) {
            options.push(
                { value: 'edit', label: 'Edit connection' },
                { value: 'delete', label: 'Delete connection' },
                { value: 'test', label: 'Test connection' },
                { value: 'list', label: 'List connections' },
                { value: 'keychain', label: 'Manage keychain passwords' },
            );
        }

        options.push(
            { value: 'init', label: 'Initialize config template' },
            { value: 'migrate', label: 'Migrate legacy config' },
            { value: 'exit', label: 'Exit' },
        );

        const action = await p.select({
            message: 'What would you like to do?',
            options,
        });

        if (p.isCancel(action) || action === 'exit') {
            p.outro('Goodbye!');
            return;
        }

        if (action === 'add') {
            await addConnectionWizard();
        } else if (action === 'edit') {
            await editConnectionWizard();
        } else if (action === 'delete') {
            await deleteConnectionWizard();
        } else if (action === 'test') {
            await testConnectionMenu(connections);
        } else if (action === 'list') {
            await listConnectionsDisplay();
        } else if (action === 'keychain') {
            await keychainMenu();
        } else if (action === 'init') {
            await initConfig();
        } else if (action === 'migrate') {
            await migrateInteractive();
        }

        // Add spacing between iterations
        console.log('');
    }
}

// ============================================================================
// Menu Actions
// ============================================================================

/**
 * Test a connection from the manage menu
 */
async function testConnectionMenu(connections: string[]): Promise<void> {
    const selected = await p.select({
        message: 'Select connection to test',
        options: connections.map(name => ({ value: name, label: name })),
    });

    if (p.isCancel(selected)) return;

    p.log.info(`Testing ${selected}...`);
    const { resolveConnection } = await import('../config');

    try {
        const config = await resolveConnection(selected as string);

        if (isRedisConfig(config)) {
            const { RedisClient } = await import('bun');
            const client = new RedisClient(config.url);
            await client.send(['PING']);
            client.close();
        } else {
            const { SQL } = await import('bun');
            const sql = new SQL(config.url);
            await sql.unsafe(TEST_QUERIES[config.type]);
            sql.close();
        }
        p.log.success(`Connection "${selected}" successful!`);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        p.log.error(`Connection failed: ${message}`);
    }
}

/**
 * Enhanced connection list showing type + host/database info
 */
async function listConnectionsDisplay(): Promise<void> {
    let config: SherlockConfig;
    try {
        config = loadConfigFile();
    } catch {
        p.log.warn('No config found.');
        return;
    }

    const entries = Object.entries(config.connections);
    if (entries.length === 0) {
        p.log.warn('No connections configured.');
        return;
    }

    const lines = entries.map(([name, conn]) => {
        const type = conn.type || 'unknown';
        if (type === DB_TYPES.SQLITE) {
            const filename = conn.filename || conn.path || conn.database || '';
            return `${name} (${type}) ${filename}`;
        }
        const host = typeof conn.host === 'string' ? conn.host : '';
        const database = conn.database || '';
        return `${name} (${type}) ${host}${database ? ' - ' + database : ''}`;
    });

    p.note(lines.join('\n'), 'Configured Connections');
}

/**
 * Dedicated delete connection wizard
 */
async function deleteConnectionWizard(): Promise<void> {
    let config: SherlockConfig;
    try {
        config = loadConfigFile();
    } catch {
        p.log.warn('No config found.');
        return;
    }

    const connectionNames = Object.keys(config.connections);
    if (connectionNames.length === 0) {
        p.log.warn('No connections to delete.');
        return;
    }

    const selected = await p.select({
        message: 'Select connection to delete',
        options: connectionNames.map(name => ({
            value: name,
            label: name,
            hint: config.connections[name].type,
        })),
    });

    if (p.isCancel(selected)) return;

    const connName = selected as string;
    const confirmDelete = await p.confirm({
        message: `Are you sure you want to delete "${connName}"?`,
        initialValue: false,
    });

    if (p.isCancel(confirmDelete) || !confirmDelete) return;

    delete config.connections[connName];
    if (hasKeychainPassword(connName)) {
        deleteKeychainPassword(connName);
    }
    saveConfig(config);
    p.log.success(`Connection "${connName}" deleted.`);
}

/**
 * Keychain management submenu
 */
async function keychainMenu(): Promise<void> {
    while (true) {
        const action = await p.select({
            message: 'Keychain management',
            options: [
                { value: 'store', label: 'Store password' },
                { value: 'check', label: 'Check stored passwords' },
                { value: 'delete', label: 'Delete password' },
                { value: 'back', label: 'Back' },
            ],
        });

        if (p.isCancel(action) || action === 'back') return;

        if (action === 'store') {
            const account = await p.text({
                message: 'Account name (usually the connection name)',
                validate: (v) => { if (!v) return 'Account name is required'; },
            });
            if (p.isCancel(account)) continue;

            const password = await p.password({
                message: `Enter password for "${account}"`,
            });
            if (p.isCancel(password)) continue;

            setKeychainPassword(account as string, password as string);
            p.log.success(`Password stored for "${account}"`);
        } else if (action === 'check') {
            let connections: string[] = [];
            try {
                connections = listConnections();
            } catch {
                p.log.warn('No config found.');
                continue;
            }

            if (connections.length === 0) {
                p.log.warn('No connections configured.');
                continue;
            }

            const lines = connections.map(name => {
                const has = hasKeychainPassword(name);
                const status = has ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
                return `  ${status} ${name}`;
            });
            p.note(lines.join('\n'), 'Keychain Status');
        } else if (action === 'delete') {
            const account = await p.text({
                message: 'Account name to delete',
                validate: (v) => { if (!v) return 'Account name is required'; },
            });
            if (p.isCancel(account)) continue;

            if (!hasKeychainPassword(account as string)) {
                p.log.warn(`No password found for "${account}"`);
                continue;
            }

            const confirm = await p.confirm({
                message: `Delete password for "${account}"?`,
                initialValue: false,
            });
            if (p.isCancel(confirm) || !confirm) continue;

            deleteKeychainPassword(account as string);
            p.log.success(`Password deleted for "${account}"`);
        }

        console.log('');
    }
}

/**
 * Interactive migrate handler — prompts for legacy config path
 */
async function migrateInteractive(): Promise<void> {
    const fromPath = await p.text({
        message: 'Path to legacy config.ts',
        placeholder: 'config.ts',
        initialValue: 'config.ts',
    });

    if (p.isCancel(fromPath)) return;

    await migrateConfig(fromPath as string);
}

// ============================================================================
// Setup & Connection Wizards
// ============================================================================

/**
 * Interactive setup wizard for first-time users
 */
async function runSetupWizard(): Promise<void> {
    const configDir = getConfigDir();
    const configPath = path.join(configDir, 'config.json');

    // Check if config already exists
    if (fs.existsSync(configPath)) {
        const addNew = await p.confirm({
            message: `Config already exists at ${configPath}. Do you want to add a new connection?`,
            initialValue: true,
        });

        if (p.isCancel(addNew)) {
            p.cancel('Setup cancelled');
            process.exit(0);
        }

        if (addNew) {
            await addConnectionWizard();
        }
        return;
    }

    p.note(
        `This wizard will help you set up Sherlock.\n` +
        `Config will be saved to: ${configPath}`,
        'Welcome'
    );

    // Create first connection
    const createFirst = await p.confirm({
        message: 'Would you like to add your first database connection?',
        initialValue: true,
    });

    if (p.isCancel(createFirst)) {
        p.cancel('Setup cancelled');
        process.exit(0);
    }

    ensureConfigDir();

    if (createFirst) {
        const connection = await promptForConnection();
        if (connection) {
            const config: SherlockConfig = {
                version: '2.0',
                connections: {
                    [connection.name]: connection.config,
                },
            };

            // Handle password storage
            await handlePasswordStorage(connection.name, connection.password);

            // Set password reference based on storage method
            if (connection.storageMethod === 'keychain') {
                connection.config.password = { $keychain: connection.name };
            } else if (connection.storageMethod === 'env') {
                const envVar = `SHERLOCK_${connection.name.toUpperCase().replace(/-/g, '_')}_PASSWORD`;
                connection.config.password = { $env: envVar };
                await saveToEnvFile(envVar, connection.password);
            }

            saveConfig(config);
            p.log.success('Setup complete! Use `sherlock manage` to test your connection.');
        }
    } else {
        // Create empty config
        const config: SherlockConfig = {
            version: '2.0',
            connections: {},
        };
        saveConfig(config);
        p.log.info('Empty config created. Use `sherlock manage` to add connections.');
    }
}

/**
 * Interactive wizard to add a new connection
 */
async function addConnectionWizard(): Promise<void> {
    const connection = await promptForConnection();
    if (!connection) {
        return;
    }

    // Load existing config
    let config: SherlockConfig;
    try {
        config = loadConfigFile();
    } catch {
        config = { version: '2.0', connections: {} };
    }

    // Check if connection name already exists
    if (config.connections[connection.name]) {
        const overwrite = await p.confirm({
            message: `Connection "${connection.name}" already exists. Overwrite?`,
            initialValue: false,
        });

        if (p.isCancel(overwrite) || !overwrite) {
            p.cancel('Cancelled');
            return;
        }
    }

    // Handle password storage
    await handlePasswordStorage(connection.name, connection.password);

    // Update config with appropriate password reference
    if (connection.storageMethod === 'keychain') {
        connection.config.password = { $keychain: connection.name };
    } else if (connection.storageMethod === 'env') {
        const envVar = `SHERLOCK_${connection.name.toUpperCase().replace(/-/g, '_')}_PASSWORD`;
        connection.config.password = { $env: envVar };
        await saveToEnvFile(envVar, connection.password);
    }

    config.connections[connection.name] = connection.config;
    saveConfig(config);

    p.log.success(`Connection "${connection.name}" added!`);
}

/**
 * Interactive wizard to edit an existing connection
 */
async function editConnectionWizard(): Promise<void> {
    let config: SherlockConfig;
    try {
        config = loadConfigFile();
    } catch {
        p.log.warn('No config found.');
        return;
    }

    const connectionNames = Object.keys(config.connections);
    if (connectionNames.length === 0) {
        p.log.warn('No connections configured.');
        return;
    }

    const selected = await p.select({
        message: 'Select connection to edit',
        options: connectionNames.map(name => ({
            value: name,
            label: name,
            hint: config.connections[name].type,
        })),
    });

    if (p.isCancel(selected)) return;

    const connName = selected as string;
    const existingConn = config.connections[connName];

    const loggingStatus = existingConn.logging ? 'enabled' : 'disabled';
    const directoryHint = existingConn.directory || 'not set';
    const action = await p.select({
        message: `What would you like to do with "${connName}"?`,
        options: [
            { value: 'edit', label: 'Edit connection details' },
            { value: 'password', label: 'Update password' },
            { value: 'directory', label: 'Set project directory', hint: directoryHint },
            { value: 'logging', label: 'Toggle query logging', hint: `Currently ${loggingStatus}` },
            { value: 'delete', label: 'Delete connection', hint: 'Cannot be undone' },
        ],
    });

    if (p.isCancel(action)) return;

    if (action === 'directory') {
        const cwd = process.cwd();
        const newDir = await p.text({
            message: 'Project directory (auto-selects this connection when you are in this dir)',
            placeholder: 'Leave empty to remove',
            initialValue: existingConn.directory || cwd,
        });

        if (p.isCancel(newDir)) return;

        if (newDir) {
            config.connections[connName].directory = newDir;
        } else {
            delete config.connections[connName].directory;
        }
        saveConfig(config);
        p.log.success(newDir
            ? `Project directory set to "${newDir}" for "${connName}".`
            : `Project directory removed for "${connName}".`);
        return;
    }

    if (action === 'delete') {
        const confirmDelete = await p.confirm({
            message: `Are you sure you want to delete "${connName}"?`,
            initialValue: false,
        });

        if (confirmDelete && !p.isCancel(confirmDelete)) {
            delete config.connections[connName];
            if (hasKeychainPassword(connName)) {
                deleteKeychainPassword(connName);
            }
            saveConfig(config);
            p.log.success(`Connection "${connName}" deleted.`);
        }
        return;
    }

    if (action === 'logging') {
        const newLogging = !existingConn.logging;
        config.connections[connName].logging = newLogging;
        saveConfig(config);
        const status = newLogging ? 'enabled' : 'disabled';
        p.log.success(`Query logging ${status} for "${connName}".`);
        return;
    }

    if (action === 'password') {
        const newPassword = await p.password({
            message: 'Enter new password',
        });

        if (p.isCancel(newPassword)) return;

        const storageMethod = await p.select({
            message: 'Where should the password be stored?',
            options: [
                { value: 'keychain', label: 'OS Keychain', hint: 'Most secure - encrypted by OS' },
                { value: 'env', label: 'Environment file', hint: '~/.config/sherlock/.env' },
            ],
        });

        if (p.isCancel(storageMethod)) return;

        await handlePasswordStorage(connName, newPassword as string, storageMethod as 'keychain' | 'env');

        if (storageMethod === 'keychain') {
            config.connections[connName].password = { $keychain: connName };
        } else {
            const envVar = `SHERLOCK_${connName.toUpperCase().replace(/-/g, '_')}_PASSWORD`;
            config.connections[connName].password = { $env: envVar };
            await saveToEnvFile(envVar, newPassword as string);
        }

        saveConfig(config);
        p.log.success(`Password updated for "${connName}".`);
        return;
    }

    // Edit connection details (password is handled separately via "Update password")
    const connection = await promptForConnection(connName, existingConn);
    if (!connection) return;

    // Only handle password storage for new connections (edit skips password prompt)
    if (connection.password) {
        await handlePasswordStorage(connection.name, connection.password);

        if (connection.storageMethod === 'keychain') {
            connection.config.password = { $keychain: connection.name };
        } else if (connection.storageMethod === 'env') {
            const envVar = `SHERLOCK_${connection.name.toUpperCase().replace(/-/g, '_')}_PASSWORD`;
            connection.config.password = { $env: envVar };
            await saveToEnvFile(envVar, connection.password);
        }
    }

    // If name changed, delete old connection
    if (connection.name !== connName) {
        delete config.connections[connName];
        if (hasKeychainPassword(connName)) {
            deleteKeychainPassword(connName);
        }
    }

    config.connections[connection.name] = connection.config;
    saveConfig(config);

    p.log.success(`Connection "${connection.name}" updated!`);
}

// ============================================================================
// Shared Helpers
// ============================================================================

/**
 * Prompt user for connection details
 */
async function promptForConnection(
    existingName?: string,
    existingConfig?: ConnectionConfig
): Promise<{
    name: string;
    config: ConnectionConfig;
    password: string;
    storageMethod: 'keychain' | 'env';
} | null> {
    const result = await p.group(
        {
            name: () =>
                p.text({
                    message: 'Connection name',
                    placeholder: 'e.g., production, staging, local',
                    initialValue: existingName || '',
                    validate: (value) => {
                        if (!value) return 'Name is required';
                        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                            return 'Name can only contain letters, numbers, hyphens, and underscores';
                        }
                    },
                }),
            type: () =>
                p.select({
                    message: 'Database type',
                    initialValue: existingConfig?.type || DB_TYPES.POSTGRES,
                    options: [
                        { value: DB_TYPES.POSTGRES, label: 'PostgreSQL' },
                        { value: DB_TYPES.MYSQL, label: 'MySQL / MariaDB' },
                        { value: DB_TYPES.SQLITE, label: 'SQLite' },
                        { value: DB_TYPES.REDIS, label: 'Redis' },
                    ],
                }),
        },
        {
            onCancel: () => {
                p.cancel('Cancelled');
                process.exit(0);
            },
        }
    );

    if (result.type === DB_TYPES.REDIS) {
        const isEditing = !!existingConfig;

        const redisFields: Record<string, () => any> = {
            host: () =>
                p.text({
                    message: 'Host',
                    placeholder: 'localhost',
                    initialValue: (existingConfig?.host as string) || 'localhost',
                }),
            port: () =>
                p.text({
                    message: 'Port',
                    placeholder: String(DEFAULT_PORTS[DB_TYPES.REDIS]),
                    initialValue: existingConfig?.port?.toString() || String(DEFAULT_PORTS[DB_TYPES.REDIS]),
                    validate: (value) => {
                        if (value && isNaN(parseInt(value))) return 'Port must be a number';
                    },
                }),
            // Redis defaults to 16 databases (0-15), configurable via `databases` in redis.conf
            database: () =>
                p.text({
                    message: 'Database number (0-15)',
                    placeholder: '0',
                    initialValue: existingConfig?.database || '0',
                    validate: (value) => {
                        const num = parseInt(value);
                        if (isNaN(num) || num < 0 || num > 15) return 'Database must be 0-15';
                    },
                }),
        };

        if (!isEditing) {
            redisFields.password = () =>
                p.password({
                    message: 'Password (leave empty if none)',
                });
            redisFields.storageMethod = () =>
                p.select({
                    message: 'Where should the password be stored?',
                    options: [
                        { value: 'keychain', label: 'OS Keychain', hint: 'Recommended - encrypted by OS' },
                        { value: 'env', label: 'Environment file', hint: '~/.config/sherlock/.env' },
                    ],
                });
        }

        const redisResult = await p.group(
            redisFields,
            {
                onCancel: () => {
                    p.cancel('Cancelled');
                    process.exit(0);
                },
            }
        );

        const directory = await p.text({
            message: 'Project directory (auto-selects this connection when you are in this dir)',
            placeholder: 'Leave empty to skip',
            initialValue: existingConfig?.directory || '',
        });

        if (p.isCancel(directory)) {
            p.cancel('Cancelled');
            process.exit(0);
        }

        const config: ConnectionConfig = {
            type: DB_TYPES.REDIS,
            host: redisResult.host as string,
            port: parseInt(redisResult.port as string),
            database: redisResult.database as string,
            password: isEditing ? existingConfig!.password : '',
        };

        if (directory) {
            config.directory = directory;
        }

        return {
            name: result.name as string,
            config,
            password: isEditing ? '' : (redisResult.password as string || ''),
            storageMethod: isEditing ? 'env' : (redisResult.storageMethod as 'keychain' | 'env' || 'env'),
        };
    }

    if (result.type === DB_TYPES.SQLITE) {
        const sqliteResult = await p.group({
            filename: () =>
                p.text({
                    message: 'Database file path',
                    placeholder: '/path/to/database.sqlite or :memory:',
                    initialValue: (existingConfig?.filename as string) || '',
                    validate: (value) => {
                        if (!value) return 'File path is required';
                    },
                }),
            logging: () =>
                p.confirm({
                    message: 'Enable query logging?',
                    initialValue: existingConfig?.logging ?? false,
                }),
        });

        const directory = await p.text({
            message: 'Project directory (auto-selects this connection when you are in this dir)',
            placeholder: 'Leave empty to skip',
            initialValue: existingConfig?.directory || process.cwd(),
        });

        if (p.isCancel(directory)) {
            p.cancel('Cancelled');
            process.exit(0);
        }

        const config: ConnectionConfig = {
            type: DB_TYPES.SQLITE,
            filename: sqliteResult.filename as string,
            logging: sqliteResult.logging as boolean,
        };

        if (directory) {
            config.directory = directory;
        }

        return {
            name: result.name as string,
            config,
            password: '',
            storageMethod: 'env',
        };
    }

    const isEditing = !!existingConfig;

    // When editing, skip password/storage — those have their own menu item
    const connFields: Record<string, () => any> = {
        host: () =>
            p.text({
                message: 'Host',
                placeholder: 'localhost',
                initialValue: (existingConfig?.host as string) || 'localhost',
            }),
        port: () =>
            p.text({
                message: 'Port',
                placeholder: String(DEFAULT_PORTS[result.type as DbType]),
                initialValue: existingConfig?.port?.toString() || String(DEFAULT_PORTS[result.type as DbType]),
                validate: (value) => {
                    if (value && isNaN(parseInt(value))) return 'Port must be a number';
                },
            }),
        database: () =>
            p.text({
                message: 'Database name',
                placeholder: 'myapp',
                initialValue: existingConfig?.database || '',
                validate: (value) => {
                    if (!value) return 'Database name is required';
                },
            }),
        username: () =>
            p.text({
                message: 'Username',
                placeholder: 'dbuser',
                initialValue: typeof existingConfig?.username === 'string' ? existingConfig.username : '',
                validate: (value) => {
                    if (!value) return 'Username is required';
                },
            }),
    };

    if (!isEditing) {
        connFields.password = () =>
            p.password({
                message: 'Password',
                validate: (value) => {
                    if (!value) return 'Password is required';
                },
            });
        connFields.storageMethod = () =>
            p.select({
                message: 'Where should the password be stored?',
                options: [
                    { value: 'keychain', label: 'OS Keychain', hint: 'Recommended - encrypted by OS' },
                    { value: 'env', label: 'Environment file', hint: '~/.config/sherlock/.env' },
                ],
            });
    }

    connFields.logging = () =>
        p.confirm({
            message: 'Enable query logging?',
            initialValue: existingConfig?.logging ?? false,
        });

    const connResult = await p.group(
        connFields,
        {
            onCancel: () => {
                p.cancel('Cancelled');
                process.exit(0);
            },
        }
    );

    const directory = await p.text({
        message: 'Project directory (auto-selects this connection when you are in this dir)',
        placeholder: 'Leave empty to skip',
        initialValue: existingConfig?.directory || process.cwd(),
    });

    if (p.isCancel(directory)) {
        p.cancel('Cancelled');
        process.exit(0);
    }

    const config: ConnectionConfig = {
        type: result.type as DbType,
        host: connResult.host as string,
        port: parseInt(connResult.port as string),
        database: connResult.database as string,
        username: connResult.username as string,
        // When editing, preserve existing password config
        password: isEditing ? existingConfig!.password : '',
        logging: connResult.logging as boolean,
    };

    if (directory) {
        config.directory = directory;
    }

    return {
        name: result.name as string,
        config,
        password: isEditing ? '' : (connResult.password as string),
        storageMethod: isEditing ? 'env' : (connResult.storageMethod as 'keychain' | 'env'),
    };
}

/**
 * Handle password storage based on user's choice
 */
async function handlePasswordStorage(
    connectionName: string,
    password: string,
    method?: 'keychain' | 'env'
): Promise<void> {
    if (!password) return;

    if (method === 'keychain' || method === undefined) {
        setKeychainPassword(connectionName, password);
        p.log.success(`Password stored in OS keychain`);
    }
}

/**
 * Save a value to the .env file
 */
async function saveToEnvFile(key: string, value: string): Promise<void> {
    ensureConfigDir();
    const envPath = path.join(getConfigDir(), '.env');

    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
    }

    // Check if key already exists
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
    } else {
        if (content && !content.endsWith('\n')) {
            content += '\n';
        }
        content += `${key}=${value}\n`;
    }

    fs.writeFileSync(envPath, content, 'utf-8');
    fs.chmodSync(envPath, 0o600);
    p.log.success(`Password saved to .env file`);
}

/**
 * Save config to file
 */
function saveConfig(config: SherlockConfig): void {
    ensureConfigDir();
    const configPath = path.join(getConfigDir(), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    fs.chmodSync(configPath, 0o600);
}
