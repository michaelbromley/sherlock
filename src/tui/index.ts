/**
 * TUI (Terminal User Interface) for Sherlock
 * Interactive prompts for managing database connections
 */
import * as p from '@clack/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { getConfigDir, ensureConfigDir } from '../config/paths';
import { loadConfigFile, listConnections } from '../config';
import type { SherlockConfig, ConnectionConfig } from '../config/types';
import { DB_TYPES, DEFAULT_PORTS, TEST_QUERIES, type DbType } from '../db-types';
import {
    setKeychainPassword,
    hasKeychainPassword,
    deleteKeychainPassword,
} from '../credentials/providers/keychain';

/**
 * Interactive setup wizard for first-time users
 */
export async function runSetupWizard(): Promise<void> {
    p.intro('🔍 Sherlock Setup Wizard');

    const configDir = getConfigDir();
    const configPath = path.join(configDir, 'config.json');

    // Check if config already exists
    if (fs.existsSync(configPath)) {
        const overwrite = await p.confirm({
            message: `Config already exists at ${configPath}. Do you want to add a new connection?`,
            initialValue: true,
        });

        if (p.isCancel(overwrite)) {
            p.cancel('Setup cancelled');
            process.exit(0);
        }

        if (overwrite) {
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

            // Remove password from config if using keychain
            if (connection.storageMethod === 'keychain') {
                connection.config.password = { $keychain: connection.name };
            } else if (connection.storageMethod === 'env') {
                const envVar = `SHERLOCK_${connection.name.toUpperCase().replace(/-/g, '_')}_PASSWORD`;
                connection.config.password = { $env: envVar };
                await saveToEnvFile(envVar, connection.password);
            }

            saveConfig(config);
            p.outro('🎉 Setup complete! Run `sherlock test` to verify your connection.');
        }
    } else {
        // Create empty config
        const config: SherlockConfig = {
            version: '2.0',
            connections: {},
        };
        saveConfig(config);
        p.outro('Config created. Run `sherlock setup` again to add connections.');
    }
}

/**
 * Interactive wizard to add a new connection
 */
export async function addConnectionWizard(): Promise<void> {
    p.intro('🔍 Add New Connection');

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

    p.outro(`✓ Connection "${connection.name}" added! Run \`sherlock test ${connection.name}\` to verify.`);
}

/**
 * Interactive wizard to edit an existing connection
 */
export async function editConnectionWizard(): Promise<void> {
    p.intro('🔍 Edit Connection');

    let config: SherlockConfig;
    try {
        config = loadConfigFile();
    } catch {
        p.cancel('No config found. Run `sherlock setup` first.');
        return;
    }

    const connectionNames = Object.keys(config.connections);
    if (connectionNames.length === 0) {
        p.cancel('No connections configured. Run `sherlock setup` to add one.');
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

    if (p.isCancel(selected)) {
        p.cancel('Cancelled');
        return;
    }

    const connName = selected as string;
    const existingConn = config.connections[connName];

    const loggingStatus = existingConn.logging ? 'enabled' : 'disabled';
    const action = await p.select({
        message: `What would you like to do with "${connName}"?`,
        options: [
            { value: 'edit', label: 'Edit connection details' },
            { value: 'password', label: 'Update password' },
            { value: 'logging', label: 'Toggle query logging', hint: `Currently ${loggingStatus}` },
            { value: 'delete', label: 'Delete connection', hint: 'Cannot be undone' },
        ],
    });

    if (p.isCancel(action)) {
        p.cancel('Cancelled');
        return;
    }

    if (action === 'delete') {
        const confirmDelete = await p.confirm({
            message: `Are you sure you want to delete "${connName}"?`,
            initialValue: false,
        });

        if (confirmDelete && !p.isCancel(confirmDelete)) {
            delete config.connections[connName];
            // Also remove from keychain if exists
            if (hasKeychainPassword(connName)) {
                deleteKeychainPassword(connName);
            }
            saveConfig(config);
            p.outro(`✓ Connection "${connName}" deleted.`);
        }
        return;
    }

    if (action === 'logging') {
        const newLogging = !existingConn.logging;
        config.connections[connName].logging = newLogging;
        saveConfig(config);
        const status = newLogging ? 'enabled' : 'disabled';
        p.outro(`✓ Query logging ${status} for "${connName}".`);
        return;
    }

    if (action === 'password') {
        const newPassword = await p.password({
            message: 'Enter new password',
        });

        if (p.isCancel(newPassword)) {
            p.cancel('Cancelled');
            return;
        }

        const storageMethod = await p.select({
            message: 'Where should the password be stored?',
            options: [
                { value: 'keychain', label: 'OS Keychain', hint: 'Most secure - encrypted by OS' },
                { value: 'env', label: 'Environment file', hint: '~/.config/sherlock/.env' },
            ],
        });

        if (p.isCancel(storageMethod)) {
            p.cancel('Cancelled');
            return;
        }

        await handlePasswordStorage(connName, newPassword as string, storageMethod as 'keychain' | 'env');

        if (storageMethod === 'keychain') {
            config.connections[connName].password = { $keychain: connName };
        } else {
            const envVar = `SHERLOCK_${connName.toUpperCase().replace(/-/g, '_')}_PASSWORD`;
            config.connections[connName].password = { $env: envVar };
            await saveToEnvFile(envVar, newPassword as string);
        }

        saveConfig(config);
        p.outro(`✓ Password updated for "${connName}".`);
        return;
    }

    // Edit connection details
    const connection = await promptForConnection(connName, existingConn);
    if (!connection) {
        return;
    }

    await handlePasswordStorage(connection.name, connection.password);

    if (connection.storageMethod === 'keychain') {
        connection.config.password = { $keychain: connection.name };
    } else if (connection.storageMethod === 'env') {
        const envVar = `SHERLOCK_${connection.name.toUpperCase().replace(/-/g, '_')}_PASSWORD`;
        connection.config.password = { $env: envVar };
        await saveToEnvFile(envVar, connection.password);
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

    p.outro(`✓ Connection "${connection.name}" updated!`);
}

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

    const connResult = await p.group(
        {
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
            password: () =>
                p.password({
                    message: 'Password',
                    validate: (value) => {
                        if (!value) return 'Password is required';
                    },
                }),
            storageMethod: () =>
                p.select({
                    message: 'Where should the password be stored?',
                    options: [
                        { value: 'keychain', label: 'OS Keychain', hint: 'Recommended - encrypted by OS' },
                        { value: 'env', label: 'Environment file', hint: '~/.config/sherlock/.env' },
                    ],
                }),
            logging: () =>
                p.confirm({
                    message: 'Enable query logging?',
                    initialValue: existingConfig?.logging ?? false,
                }),
        },
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
        password: '', // Will be set based on storage method
        logging: connResult.logging as boolean,
    };

    if (directory) {
        config.directory = directory;
    }

    return {
        name: result.name as string,
        config,
        password: connResult.password as string,
        storageMethod: connResult.storageMethod as 'keychain' | 'env',
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
        // Store in keychain
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

/**
 * Interactive menu for managing connections
 */
export async function connectionManagerMenu(): Promise<void> {
    p.intro('🔍 Sherlock Connection Manager');

    while (true) {
        let connections: string[] = [];
        try {
            connections = listConnections();
        } catch {
            // No config yet
        }

        const options = [
            { value: 'add', label: 'Add new connection' },
        ];

        if (connections.length > 0) {
            options.push(
                { value: 'edit', label: 'Edit connection' },
                { value: 'test', label: 'Test connection' },
                { value: 'list', label: 'List all connections' }
            );
        }

        options.push({ value: 'exit', label: 'Exit' });

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
        } else if (action === 'list') {
            p.note(connections.join('\n'), 'Configured Connections');
        } else if (action === 'test') {
            const selected = await p.select({
                message: 'Select connection to test',
                options: connections.map(name => ({ value: name, label: name })),
            });

            if (!p.isCancel(selected)) {
                p.log.info(`Testing ${selected}...`);
                // We'll call the test function from the main CLI
                const { resolveConnection } = await import('../config');
                const { SQL } = await import('bun');

                try {
                    const config = await resolveConnection(selected as string);
                    const sql = new SQL(config.url);
                    await sql.unsafe(TEST_QUERIES[config.type]);
                    sql.close();
                    p.log.success(`Connection "${selected}" successful!`);
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : String(error);
                    p.log.error(`Connection failed: ${message}`);
                }
            }
        }

        // Add spacing between iterations
        console.log('');
    }
}
