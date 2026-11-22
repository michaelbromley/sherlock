/**
 * TUI (Terminal User Interface) for Sherlock
 * Interactive prompts for managing database connections
 */
import * as p from '@clack/prompts';
import * as fs from 'fs';
import * as path from 'path';
import { diagnoseConnection } from '../doctor';
import { passwordStatus } from '../credentials/status';
import { findConfigFile, getConfigDir, ensureConfigDir, getEnvFilePath } from '../config/paths';
import {
    listConnectionSummaries,
    type ConnectionSummary,
    listConnections,
    parseConnectionUrl,
    sortConnectionNames,
    isConfigFromWorkingDirectory,
} from '../config';
import type { SherlockConfig, ConnectionConfig } from '../config/types';
import type { ParsedConnectionUrl } from '../config';
import { DB_TYPES, DEFAULT_PORTS, isRedisConfig, type DbType } from '../db-types';
import {
    DEFAULT_IDLE_TIMEOUT,
    hasPortPlaceholder,
    parseDuration,
} from '../tunnel/config';
import {
    describeTunnel,
    resolveTunnel,
    tunnelProviderId,
    tunnelSetups,
    type TunnelSetupEntry,
    type TunnelSetupField,
} from '../tunnel/providers';
import { isProviderTunnel, type CommandTunnelConfig, type ProviderTunnelConfig } from '../tunnel/types';
import {
    setKeychainPassword,
    getKeychainPassword,
    hasKeychainPassword,
    deleteKeychainPassword,
} from '../credentials/providers/keychain';
import { migrateConfig } from '../config/init';
import { loadOrCreateConfig, saveConfig as writeConfig, shadowingWarning, writableConfigPath } from '../config/write';
import { stopTunnel } from '../tunnel/manager';

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

        // "init" is not offered: this menu only shows once a config exists,
        // and `sherlock init` refuses to replace one.
        options.push(
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

/** How many connections to show at once in the connection picker */
const CONNECTION_LIST_SIZE = 10;

/**
 * Pick a connection by name. Uses autocomplete rather than a plain select
 * because a config can hold dozens of connections, which scroll the terminal
 * out of view. Returns a cancel symbol if the user backed out, so callers
 * check the result with `p.isCancel` like any other prompt.
 */
async function selectConnection(
    message: string,
    connections: string[],
    hintFor?: (name: string) => string | undefined,
): Promise<string | symbol> {
    return p.autocomplete({
        message,
        placeholder: 'Type to filter',
        maxItems: CONNECTION_LIST_SIZE,
        options: sortConnectionNames(connections)
            .map(name => ({ value: name, label: name, hint: hintFor?.(name) })),
    });
}

/**
 * Test a connection from the manage menu, with the same checks as `sherlock
 * doctor`, so a failure says what is wrong and what to change.
 */
async function testConnectionMenu(connections: string[]): Promise<void> {
    const selected = await selectConnection('Select connection to test', connections);

    if (p.isCancel(selected)) return;

    const spinner = p.spinner();
    spinner.start(`Checking "${selected}"`);
    const report = await diagnoseConnection(selected);
    spinner.stop(report.ok ? `"${selected}" works` : `"${selected}" does not work`);

    for (const check of report.checks) {
        const line = `${check.name}: ${check.detail}`;
        if (check.status === 'pass') p.log.success(line);
        else if (check.status === 'skip') p.log.info(line);
        else {
            p.log.error(line);
            if (check.fix) p.log.info(`Fix: ${check.fix}`);
        }
    }
    if (report.checks.some((check) => check.name === 'tunnel' && check.status === 'pass')) {
        p.log.info(`The tunnel stays up until it goes unused. Stop it now with: sherlock tunnel stop ${selected}`);
    }
}

/**
 * Connection list showing what each connection points at, as `sherlock
 * connection list` reports it
 */
async function listConnectionsDisplay(): Promise<void> {
    let summaries: ConnectionSummary[];
    try {
        summaries = listConnectionSummaries();
    } catch {
        p.log.warn('No config found.');
        return;
    }

    if (summaries.length === 0) {
        p.log.warn('No connections configured.');
        return;
    }

    const lines = summaries.map((summary) => {
        const tunnel = summary.tunnel
            ? `  via ${summary.tunnel.kind === 'provider' ? `${summary.tunnel.provider}: ` : ''}${summary.tunnel.target}`
            : '';
        const problem = summary.problem ? `  (${summary.problem})` : '';
        return `${summary.name} (${summary.type}) ${summary.target}${tunnel}${problem}`;
    });

    p.note(lines.join('\n'), 'Configured Connections');
}

/**
 * Dedicated delete connection wizard
 */
async function deleteConnectionWizard(): Promise<void> {
    const config = loadWritableConfig();
    if (!config) return;

    const connectionNames = Object.keys(config.connections);
    if (connectionNames.length === 0) {
        p.log.warn('No connections to delete.');
        return;
    }

    const connName = await selectConnection(
        'Select connection to delete',
        connectionNames,
        name => config.connections[name].type,
    );

    if (p.isCancel(connName)) return;

    const confirmDelete = await p.confirm({
        message: `Are you sure you want to delete "${connName}"?`,
        initialValue: false,
    });

    if (p.isCancel(confirmDelete) || !confirmDelete) return;

    await removeConnection(config, connName);
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
            const config = loadWritableConfig();
            if (!config) continue;
            if (Object.keys(config.connections).length === 0) {
                p.log.warn('No connections configured.');
                continue;
            }
            const lines = sortConnectionNames(Object.keys(config.connections)).map(name => {
                const { ok, source } = passwordStatus(name, config.connections[name]);
                const status = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
                return `  ${status} ${name}: ${source}`;
            });
            p.note(lines.join('\n'), 'Where each password comes from');
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

    try {
        await migrateConfig(fromPath as string);
    } catch (error) {
        p.log.error(error instanceof Error ? error.message : String(error));
    }
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
        const prefill = await promptForSetupMethod();
        const connection = await promptForConnection(undefined, undefined, prefill);
        if (!connection) {
            // Cancelled mid-flow — leave an empty config so `sherlock manage`
            // works next time, and tell the user what to do from here.
            saveConfig({ version: '2.0', connections: {} });
            p.log.info('Setup cancelled. Empty config saved — use `sherlock manage` to add connections later.');
            return;
        }
        const config: SherlockConfig = {
            version: '2.0',
            connections: {
                [connection.name]: connection.config,
            },
        };

        // Handle password storage (only if a password was provided)
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

        saveConfig(config);
        p.log.success('Setup complete! Use `sherlock manage` to test your connection.');
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
    const prefill = await promptForSetupMethod();
    const connection = await promptForConnection(undefined, undefined, prefill);
    if (!connection) {
        return;
    }

    const config = loadWritableConfig();
    if (!config) return;

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

    // Handle password storage (only if a password was provided)
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

    config.connections[connection.name] = connection.config;
    saveConfig(config);

    p.log.success(`Connection "${connection.name}" added!`);
}

/**
 * Interactive wizard to edit an existing connection
 */
async function editConnectionWizard(): Promise<void> {
    const config = loadWritableConfig();
    if (!config) return;

    const connectionNames = Object.keys(config.connections);
    if (connectionNames.length === 0) {
        p.log.warn('No connections configured.');
        return;
    }

    const connName = await selectConnection(
        'Select connection to edit',
        connectionNames,
        name => config.connections[name].type,
    );

    if (p.isCancel(connName)) return;

    const existingConn = config.connections[connName];

    const loggingStatus = existingConn.logging ? 'enabled' : 'disabled';
    const directoryHint = existingConn.directory || 'not set';
    const sslHint = sslHintLabel(existingConn.ssl);
    const isSqlite = existingConn.type === DB_TYPES.SQLITE;
    type EditAction = 'edit' | 'password' | 'directory' | 'logging' | 'ssl' | 'tunnel' | 'delete';
    const editOptions: Array<{ value: EditAction; label: string; hint?: string }> = [
        { value: 'edit', label: 'Edit connection details' },
        ...(isSqlite ? [] : [{ value: 'password' as const, label: 'Update password' }]),
        { value: 'directory', label: 'Set project directory', hint: directoryHint },
        { value: 'logging', label: 'Toggle query logging', hint: `Currently ${loggingStatus}` },
    ];
    if (!isSqlite) {
        editOptions.push({ value: 'ssl', label: 'Configure SSL/TLS', hint: sslHint });
        editOptions.push({
            value: 'tunnel',
            label: 'Configure tunnel',
            hint: tunnelHintLabel(existingConn.tunnel),
        });
    }
    editOptions.push({ value: 'delete', label: 'Delete connection', hint: 'Cannot be undone' });

    const action = await p.select({
        message: `What would you like to do with "${connName}"?`,
        options: editOptions,
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
            await removeConnection(config, connName);
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

    if (action === 'ssl') {
        const newSsl = await promptForSsl(existingConn.ssl);
        if (newSsl === null) return;
        if (newSsl === undefined) {
            delete config.connections[connName].ssl;
        } else {
            config.connections[connName].ssl = newSsl;
        }
        saveConfig(config);
        p.log.success(`SSL set to "${sslHintLabel(newSsl)}" for "${connName}".`);
        return;
    }

    if (action === 'tunnel') {
        const newTunnel = await promptForTunnel(existingConn.tunnel);
        if (newTunnel === null) return;

        if (newTunnel === undefined) {
            delete config.connections[connName].tunnel;
            saveConfig(config);
            p.log.success(`Tunnel removed for "${connName}".`);
            return;
        }

        config.connections[connName].tunnel = newTunnel;
        saveConfig(config);
        p.log.success(`Tunnel configured for "${connName}".`);
        p.log.info(
            'Sherlock starts this tunnel on the first query and shuts it down once it goes unused.\n' +
            `Stop it now with: sherlock tunnel stop ${connName}`
        );

        if (isConfigFromWorkingDirectory()) {
            p.log.warn(
                'This config was loaded from the current directory, where tunnels are refused: a ' +
                'tunnel runs a command or uses your platform login, so a cloned repository must not ' +
                'be able to define one. Move the connection to your user config directory to use it.'
            );
        }
        return;
    }

    if (action === 'password') {
        const newPassword = await p.password({
            message: `New database password for "${connName}"`,
            validate: (value) => (!value ? 'Enter the password, or press Escape to keep the current one' : undefined),
        });

        if (p.isCancel(newPassword)) return;

        const storageMethod = await p.select({
            message: 'Where should the password be stored?',
            options: [
                { value: 'keychain', label: 'OS Keychain', hint: 'Most secure - encrypted by OS' },
                { value: 'env', label: 'Environment file', hint: getEnvFilePath() },
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
    if (existingConn.url !== undefined) {
        // The prompts ask for host, port and database separately. Saving
        // their answers would replace the URL, and any reference it is
        // stored behind, with whatever was typed.
        p.log.warn(
            `"${connName}" is defined by a connection URL, which these prompts cannot edit without ` +
            `replacing it. Change "url" in ${writableConfigPath()}, or delete the connection and ` +
            `add it again from the new URL.`
        );
        return;
    }
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

    // A rename moves the keychain entry named after the connection, since the
    // entry is looked up by that name.
    if (connection.name !== connName) {
        if (!moveKeychainEntry(connection.config, connName, connection.name)) return;
        delete config.connections[connName];
        await stopTunnel(connName).catch(() => undefined);
    }

    config.connections[connection.name] = connection.config;
    saveConfig(config);

    p.log.success(`Connection "${connection.name}" updated!`);
}

// ============================================================================
// Shared Helpers
// ============================================================================

// ----------------------------------------------------------------------------
// Per-field prompts. Each returns the field value, or null when the user
// cancelled. promptForConnection composes these.
// ----------------------------------------------------------------------------

async function promptForName(initial?: string): Promise<string | null> {
    const v = await p.text({
        message: 'Connection name',
        placeholder: 'e.g., production, staging, local',
        initialValue: initial || '',
        validate: (value) => {
            if (!value) return 'Name is required';
            if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                return 'Name can only contain letters, numbers, hyphens, and underscores';
            }
        },
    });
    return p.isCancel(v) ? null : v;
}

async function promptForType(initial?: DbType): Promise<DbType | null> {
    const v = await p.select({
        message: 'Database type',
        initialValue: initial || DB_TYPES.POSTGRES,
        options: [
            { value: DB_TYPES.POSTGRES, label: 'PostgreSQL' },
            { value: DB_TYPES.MYSQL, label: 'MySQL / MariaDB' },
            { value: DB_TYPES.SQLITE, label: 'SQLite' },
            { value: DB_TYPES.REDIS, label: 'Redis' },
            { value: DB_TYPES.MSSQL, label: 'Microsoft SQL Server' },
        ],
    });
    return p.isCancel(v) ? null : (v as DbType);
}

async function promptForHost(initial?: string): Promise<string | null> {
    const v = await p.text({
        message: 'Host',
        placeholder: 'localhost',
        initialValue: initial || 'localhost',
    });
    return p.isCancel(v) ? null : v;
}

/** Whether a setting is read from the environment or the keychain rather than written in */
function isCredentialReference(value: ConnectionConfig['host']): value is Exclude<ConnectionConfig['host'], string | undefined> {
    return typeof value === 'object' && value !== null;
}

/** Keep a referenced setting as it is, and say so, since a prompt would replace it */
function keepReference(label: string, value: ConnectionConfig['host']): ConnectionConfig['host'] {
    const where = typeof value === 'object' && value !== null && '$env' in value
        ? `environment variable ${value.$env}`
        : 'the OS keychain';
    p.log.info(`${label} is read from ${where}. Kept as it is; change it in ${writableConfigPath()}.`);
    return value;
}

async function promptForPort(defaultPort: number, initial?: number): Promise<number | null> {
    const v = await p.text({
        message: 'Port',
        placeholder: String(defaultPort),
        initialValue: initial?.toString() || String(defaultPort),
        validate: (value) => {
            const port = Number(value);
            if (!value || !Number.isInteger(port) || port < 1 || port > 65535) {
                return 'Enter a port between 1 and 65535';
            }
        },
    });
    if (p.isCancel(v)) return null;
    return Number(v);
}

async function promptForDbName(initial?: string): Promise<string | null> {
    const v = await p.text({
        message: 'Database name',
        placeholder: 'myapp',
        initialValue: initial || '',
        validate: (value) => {
            if (!value) return 'Database name is required';
        },
    });
    return p.isCancel(v) ? null : v;
}

async function promptForRedisDbNumber(initial?: string): Promise<string | null> {
    const v = await p.text({
        message: 'Database number (0-15)',
        placeholder: '0',
        initialValue: initial || '0',
        validate: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 0 || num > 15) return 'Database must be 0-15';
        },
    });
    return p.isCancel(v) ? null : v;
}

async function promptForSqlitePath(initial?: string): Promise<string | null> {
    const v = await p.text({
        message: 'Database file path',
        placeholder: '/path/to/database.sqlite or :memory:',
        initialValue: initial || '',
        validate: (value) => {
            if (!value) return 'File path is required';
        },
    });
    return p.isCancel(v) ? null : v;
}

async function promptForUsername(initial?: string): Promise<string | null> {
    const v = await p.text({
        message: 'Username',
        placeholder: 'dbuser',
        initialValue: initial || '',
        validate: (value) => {
            if (!value) return 'Username is required';
        },
    });
    return p.isCancel(v) ? null : v;
}

async function promptForOptionalPassword(connectionName: string): Promise<string | null> {
    const v = await p.password({
        message: `Database password for "${connectionName}" (leave empty if none)`,
    });
    if (p.isCancel(v)) return null;
    return (v as string) || '';
}

async function promptForLogging(initial?: boolean): Promise<boolean | null> {
    const v = await p.confirm({
        message: 'Enable query logging?',
        initialValue: initial ?? false,
    });
    return p.isCancel(v) ? null : v;
}

async function promptForStorageMethod(): Promise<'keychain' | 'env' | null> {
    const v = await p.select({
        message: 'Where should the password be stored?',
        options: [
            { value: 'keychain', label: 'OS Keychain', hint: 'Recommended - encrypted by OS' },
            { value: 'env', label: 'Environment file', hint: getEnvFilePath() },
        ],
    });
    return p.isCancel(v) ? null : (v as 'keychain' | 'env');
}

/**
 * Prompt user for connection details.
 *
 * When `prefill` is provided (paste-URL flow), any field already present in
 * the parsed URL is skipped — only missing fields are prompted for.
 *
 * Returns null on cancellation at any step. The caller decides what to do —
 * the wizards return to their menu; the first-run setup exits.
 */
async function promptForConnection(
    existingName?: string,
    existingConfig?: ConnectionConfig,
    prefill?: ParsedConnectionUrl | null
): Promise<{
    name: string;
    config: ConnectionConfig;
    password: string;
    storageMethod?: 'keychain' | 'env';
} | null> {
    const isEditing = !!existingConfig;

    const name = await promptForName(existingName);
    if (name === null) return null;

    let type: DbType;
    if (prefill?.type != null) {
        type = prefill.type;
    } else {
        const t = await promptForType(existingConfig?.type);
        if (t === null) return null;
        type = t;
    }

    // ---- SQLite branch ----
    if (type === DB_TYPES.SQLITE) {
        let filename: string;
        if (prefill?.database != null) {
            filename = prefill.database;
        } else {
            const f = await promptForSqlitePath(existingConfig?.filename as string | undefined);
            if (f === null) return null;
            filename = f;
        }

        const logging = await promptForLogging(existingConfig?.logging);
        if (logging === null) return null;

        const directory = await promptForDirectory(existingConfig?.directory);
        if (directory === null) return null;

        const config: ConnectionConfig = {
            type: DB_TYPES.SQLITE,
            filename,
            logging,
        };
        if (directory) config.directory = directory;
        carryOverUnprompted(existingConfig, config);

        return { name, config, password: '', storageMethod: 'env' };
    }

    // ---- Redis branch ----
    if (type === DB_TYPES.REDIS) {
        let host: ConnectionConfig['host'];
        if (prefill?.host != null) {
            host = prefill.host;
        } else if (isCredentialReference(existingConfig?.host)) {
            host = keepReference('Host', existingConfig!.host);
        } else {
            const v = await promptForHost(existingConfig?.host as string | undefined);
            if (v === null) return null;
            host = v;
        }

        let port: number;
        if (prefill?.port != null) {
            port = prefill.port;
        } else {
            const v = await promptForPort(DEFAULT_PORTS[DB_TYPES.REDIS], existingConfig?.port);
            if (v === null) return null;
            port = v;
        }

        let database: string;
        if (prefill?.database != null) {
            database = prefill.database;
        } else {
            const v = await promptForRedisDbNumber(existingConfig?.database);
            if (v === null) return null;
            database = v;
        }

        let password = '';
        if (!isEditing) {
            if (prefill?.password != null) {
                password = prefill.password;
            } else {
                const v = await promptForOptionalPassword(name);
                if (v === null) return null;
                password = v;
            }
        }

        let storageMethod: 'keychain' | 'env' | undefined;
        if (!isEditing && password) {
            const v = await promptForStorageMethod();
            if (v === null) return null;
            storageMethod = v;
        }

        let ssl: ConnectionConfig['ssl'];
        if (prefill?.ssl !== undefined) {
            ssl = prefill.ssl;
        } else {
            const v = await promptForSsl(existingConfig?.ssl);
            if (v === null) return null;
            ssl = v;
        }

        const directory = await promptForDirectory(existingConfig?.directory);
        if (directory === null) return null;

        const tunnel = await resolveTunnelForConnection(isEditing, existingConfig);
        if (tunnel === CANCELLED) return null;

        const config: ConnectionConfig = {
            type: DB_TYPES.REDIS,
            host,
            port,
            database,
            password: isEditing ? existingConfig!.password : '',
        };
        if (ssl) config.ssl = ssl;
        if (directory) config.directory = directory;
        if (tunnel) config.tunnel = tunnel;
        carryOverUnprompted(existingConfig, config);

        return { name, config, password, storageMethod };
    }

    // ---- Generic SQL branch (postgres / mysql / mssql) ----
    let host: ConnectionConfig['host'];
    if (prefill?.host != null) {
        host = prefill.host;
    } else if (isCredentialReference(existingConfig?.host)) {
        host = keepReference('Host', existingConfig!.host);
    } else {
        const v = await promptForHost(existingConfig?.host as string | undefined);
        if (v === null) return null;
        host = v;
    }

    let port: number;
    if (prefill?.port != null) {
        port = prefill.port;
    } else {
        const v = await promptForPort(DEFAULT_PORTS[type], existingConfig?.port);
        if (v === null) return null;
        port = v;
    }

    let database: string;
    if (prefill?.database != null) {
        database = prefill.database;
    } else {
        const v = await promptForDbName(existingConfig?.database);
        if (v === null) return null;
        database = v;
    }

    let username: ConnectionConfig['username'];
    if (prefill?.username != null) {
        username = prefill.username;
    } else if (isCredentialReference(existingConfig?.username)) {
        username = keepReference('Username', existingConfig!.username);
    } else {
        const initial = typeof existingConfig?.username === 'string' ? existingConfig.username : undefined;
        const v = await promptForUsername(initial);
        if (v === null) return null;
        username = v;
    }

    let password = '';
    if (!isEditing) {
        if (prefill?.password != null) {
            password = prefill.password;
        } else {
            const v = await promptForOptionalPassword(name);
            if (v === null) return null;
            password = v;
        }
    }

    let storageMethod: 'keychain' | 'env' | undefined;
    if (!isEditing && password) {
        const v = await promptForStorageMethod();
        if (v === null) return null;
        storageMethod = v;
    }

    const logging = await promptForLogging(existingConfig?.logging);
    if (logging === null) return null;

    let ssl: ConnectionConfig['ssl'];
    if (prefill?.ssl !== undefined) {
        ssl = prefill.ssl;
    } else {
        const v = await promptForSsl(existingConfig?.ssl);
        if (v === null) return null;
        ssl = v;
    }

    const directory = await promptForDirectory(existingConfig?.directory);
    if (directory === null) return null;

    const tunnel = await resolveTunnelForConnection(isEditing, existingConfig);
    if (tunnel === CANCELLED) return null;

    const config: ConnectionConfig = {
        type,
        host,
        port,
        database,
        username,
        // When editing, preserve existing password config
        password: isEditing ? existingConfig!.password : '',
        logging,
    };
    if (ssl) config.ssl = ssl;
    // Not prompted for: carried over from a pasted URL or the connection being edited
    if (type === DB_TYPES.MYSQL && (prefill?.allowPublicKeyRetrieval ?? existingConfig?.allowPublicKeyRetrieval)) {
        config.allowPublicKeyRetrieval = true;
    }
    if (directory) config.directory = directory;
    if (tunnel) config.tunnel = tunnel;
    carryOverUnprompted(existingConfig, config);

    return { name, config, password, storageMethod };
}

/**
 * Settings the wizard has no prompt for. The edited connection is rebuilt from
 * the answers, so without this, editing a connection would drop them.
 */
const UNPROMPTED_SETTINGS = ['statementTimeout', 'connectTimeout'] as const;

export function carryOverUnprompted(existing: ConnectionConfig | undefined, config: ConnectionConfig): void {
    if (!existing) return;
    for (const key of UNPROMPTED_SETTINGS) {
        if (existing[key] !== undefined) config[key] = existing[key];
    }
}

/**
 * Ask whether to set up via connection string or manual entry. Returns parsed
 * URL fields on success, or null when the user picked manual (or cancelled).
 */
async function promptForSetupMethod(): Promise<ParsedConnectionUrl | null> {
    const method = await p.select({
        message: 'How would you like to set up this connection?',
        options: [
            { value: 'paste', label: 'Paste a connection string', hint: 'fastest if you have one' },
            { value: 'manual', label: 'Enter details manually' },
        ],
    });

    if (p.isCancel(method) || method === 'manual') return null;
    return await promptForConnectionUrl();
}

/**
 * Prompt the user for a connection URL and parse it. Returns parsed fields, or
 * null if the user cancelled or chose to skip (caller should fall through to
 * manual entry).
 */
async function promptForConnectionUrl(): Promise<ParsedConnectionUrl | null> {
    while (true) {
        const raw = await p.password({
            message: 'Paste connection string',
        });

        if (p.isCancel(raw)) return null;

        const parsed = parseConnectionUrl(raw as string);
        if (parsed) {
            // Show what we extracted so the user can sanity-check before continuing
            const lines: string[] = [];
            if (parsed.type) lines.push(`type:     ${parsed.type}`);
            if (parsed.host) lines.push(`host:     ${parsed.host}`);
            if (parsed.port != null) lines.push(`port:     ${parsed.port}`);
            if (parsed.database) lines.push(`database: ${parsed.database}`);
            if (parsed.username) lines.push(`username: ${parsed.username}`);
            if (parsed.password) lines.push(`password: ${'*'.repeat(Math.min(parsed.password.length, 8))}`);
            if (parsed.ssl !== undefined) lines.push(`ssl:      ${sslHintLabel(parsed.ssl)}`);
            if (parsed.allowPublicKeyRetrieval) lines.push('public key retrieval: allowed');
            p.note(lines.join('\n'), 'Parsed from URL');
            return parsed;
        }

        const retry = await p.select({
            message: 'Could not parse that as a connection string. What now?',
            options: [
                { value: 'retry', label: 'Try again' },
                { value: 'manual', label: 'Enter details manually instead' },
                { value: 'cancel', label: 'Cancel' },
            ],
        });

        if (p.isCancel(retry) || retry === 'cancel') return null;
        if (retry === 'manual') return null;
        // 'retry' loops
    }
}

/** Map an existing ssl config back to one of the three TUI options */
function sslConfigToChoice(ssl: ConnectionConfig['ssl']): 'off' | 'require' | 'verify' {
    if (!ssl) return 'off';
    if (ssl === true) return 'require';
    return ssl.rejectUnauthorized === true ? 'verify' : 'require';
}

/** Short label describing the current SSL state, used as a menu hint */
function sslHintLabel(ssl: ConnectionConfig['ssl']): string {
    const choice = sslConfigToChoice(ssl);
    if (choice === 'off') return 'disabled';
    if (choice === 'verify') return 'enabled, verify cert';
    return 'enabled, accept any cert';
}

/** Map the TUI choice back to a ConnectionConfig['ssl'] value */
function sslChoiceToConfig(choice: 'off' | 'require' | 'verify'): ConnectionConfig['ssl'] {
    if (choice === 'off') return undefined;
    if (choice === 'require') return true;
    return { rejectUnauthorized: true };
}

/**
 * Prompt for SSL configuration. Returns the new ssl config (or undefined for off),
 * or null if the user cancelled.
 */
async function promptForSsl(existingSsl?: ConnectionConfig['ssl']): Promise<ConnectionConfig['ssl'] | null> {
    const choice = await p.select({
        message: 'SSL/TLS',
        initialValue: sslConfigToChoice(existingSsl),
        options: [
            { value: 'off', label: 'No SSL', hint: 'local development, plaintext' },
            { value: 'require', label: 'Require SSL (accept any certificate)', hint: 'most managed databases' },
            { value: 'verify', label: 'Require SSL + verify server certificate', hint: 'strict' },
        ],
    });

    if (p.isCancel(choice)) return null;
    return sslChoiceToConfig(choice as 'off' | 'require' | 'verify');
}

/** Short label describing the current tunnel state, used as a menu hint */
export function tunnelHintLabel(tunnel: ConnectionConfig['tunnel']): string {
    if (!tunnel) return 'not set';
    const idle = `idle ${tunnel.idleTimeout ?? DEFAULT_IDLE_TIMEOUT}`;
    if (isProviderTunnel(tunnel)) return `${tunnel.provider} provider, ${idle}`;
    let port = 'auto port';
    if (tunnel.localPort) port = `port ${tunnel.localPort}`;
    else if (tunnel.endpointPattern) port = 'port from output';
    return `${port}, ${idle}`;
}

/**
 * Returned when the user backs out of a prompt whose normal answers already
 * include `undefined`, so "cancelled" stays distinct from "no tunnel".
 */
const CANCELLED = Symbol('cancelled');

/**
 * Decide the tunnel for a connection being added or edited.
 *
 * Editing has its own "Configure tunnel" menu entry, so editing only carries
 * the existing value through. Carrying it through is what matters: the caller
 * rebuilds the connection config from the answers it collected, and would
 * otherwise drop the tunnel of any connection edited for another reason.
 */
async function resolveTunnelForConnection(
    isEditing: boolean,
    existingConfig?: ConnectionConfig
): Promise<ConnectionConfig['tunnel'] | typeof CANCELLED> {
    return isEditing ? existingConfig?.tunnel : promptForOptionalTunnel();
}

/**
 * Offer a tunnel while adding a connection. Most databases do not need one, so
 * this asks a yes/no question first rather than making everyone walk through
 * the tunnel prompts.
 */
async function promptForOptionalTunnel(): Promise<
    ConnectionConfig['tunnel'] | typeof CANCELLED
> {
    const wanted = await p.confirm({
        message: 'Does this database need a tunnel to reach it?',
        initialValue: false,
    });
    if (p.isCancel(wanted)) return CANCELLED;
    if (!wanted) return undefined;

    const tunnel = await promptForTunnel();
    return tunnel === null ? CANCELLED : tunnel;
}

/** The way of reaching a database that means "run a shell command" */
const COMMAND_METHOD = 'command';

/**
 * Prompt for tunnel settings. Returns the new tunnel config, `undefined` to
 * remove the tunnel, or null if the user cancelled.
 *
 * The user first picks how the database is reached: one of the providers that
 * offer a setup, or a shell command. Providers describe their own questions,
 * so nothing here knows about any one of them.
 */
async function promptForTunnel(
    current?: ConnectionConfig['tunnel']
): Promise<ConnectionConfig['tunnel'] | null | undefined> {
    if (current) {
        p.log.info(`Current tunnel: ${describeTunnel('this connection', current)}`);
        const keep = await p.select({
            message: 'Tunnel',
            options: [
                { value: 'edit', label: 'Change tunnel settings' },
                { value: 'remove', label: 'Remove tunnel', hint: 'connect directly instead' },
            ],
        });
        if (p.isCancel(keep)) return null;
        if (keep === 'remove') return undefined;
    }

    const setups = tunnelSetups();
    const currentMethod = current ? tunnelProviderId(current) : undefined;
    const method = await p.select({
        message: 'How is this database reached?',
        initialValue: currentMethod ?? setups[0]?.providerId ?? COMMAND_METHOD,
        options: [
            ...setups.map((setup) => ({ value: setup.providerId, label: setup.label, hint: setup.hint })),
            {
                value: COMMAND_METHOD,
                label: 'A port-forwarding command',
                hint: 'ssh -L, kubectl port-forward, cloud-sql-proxy, ...',
            },
        ],
    });
    if (p.isCancel(method)) return null;

    // Settings from the current tunnel carry over only to the same kind of
    // tunnel. A command's fields mean nothing to a provider, and back.
    if (method === COMMAND_METHOD) {
        return promptForCommandTunnel(current && !isProviderTunnel(current) ? current : undefined);
    }
    const setup = setups.find((candidate) => candidate.providerId === method)!;
    return promptForProviderTunnel(
        setup,
        current && isProviderTunnel(current) && current.provider === method ? current : undefined
    );
}

/**
 * Ask a provider's setup questions and build its tunnel block. Invalid answers
 * are reported and asked again, with what was typed kept as the starting point.
 */
async function promptForProviderTunnel(
    setup: TunnelSetupEntry,
    existing?: ProviderTunnelConfig
): Promise<ProviderTunnelConfig | null> {
    if (setup.intro) p.log.info(setup.intro);

    let previous: Record<string, string> = Object.fromEntries(
        Object.entries(existing ?? {})
            .filter(([key, value]) => key !== 'provider' && value !== undefined)
            .map(([key, value]) => [key, String(value)])
    );

    for (;;) {
        const answers: Record<string, string> = {};

        for (const field of setup.fields) {
            const answer = await askSetupField(field, answers, previous[field.key]);
            if (answer === null) return null;
            answers[field.key] = answer;
        }

        const tunnel: ProviderTunnelConfig = { provider: setup.providerId };
        for (const field of setup.fields) {
            const value = answers[field.key].trim();
            if (value !== '') tunnel[field.key] = value;
        }
        // Timeouts are not asked about here; keep any that were set by hand.
        if (existing?.idleTimeout) tunnel.idleTimeout = existing.idleTimeout;
        if (existing?.readyTimeout) tunnel.readyTimeout = existing.readyTimeout;

        try {
            resolveTunnel('this connection', tunnel);
            return tunnel;
        } catch (error) {
            p.log.error(error instanceof Error ? error.message : String(error));
            previous = answers;
        }
    }
}

/** The option chosen to type a value in place of picking from a list. No real value contains a NUL. */
const TYPE_IT_IN = '\u0000type-it-in';

/** Ask one setup question: as a pick-list when it can be listed, else as text */
async function askSetupField(
    field: TunnelSetupField,
    answers: Readonly<Record<string, string>>,
    initial: string | undefined
): Promise<string | null> {
    if (field.choices) {
        const spinner = p.spinner();
        spinner.start('Looking up the choices');
        const choices = await field.choices(answers);
        spinner.stop('options' in choices ? field.message : 'Could not list the choices');

        if ('options' in choices) {
            const known = choices.options.some((option) => option.value === initial);
            const picked = await p.select<string>({
                message: field.message,
                initialValue: known ? initial : choices.options[0]?.value,
                options: [
                    ...choices.options,
                    { value: TYPE_IT_IN, label: 'Something else', hint: 'type it in' },
                ],
            });
            if (p.isCancel(picked)) return null;
            if (picked !== TYPE_IT_IN) return picked;
        } else {
            p.log.warn(choices.unavailable);
        }
    }

    const typed = await p.text({
        message: field.message,
        placeholder: field.placeholder,
        initialValue: initial,
        validate: (value) => (!field.optional && (!value || value.trim() === '') ? 'This is required' : undefined),
    });
    if (p.isCancel(typed)) return null;
    return typed ?? '';
}

/**
 * Prompt for a shell-command tunnel. Returns the tunnel config, or null if the
 * user cancelled.
 */
async function promptForCommandTunnel(existing?: CommandTunnelConfig): Promise<CommandTunnelConfig | null> {
    p.log.info(
        'The command must forward the remote database to a local port.\n\n' +
        'If it takes a port, write {{port}} and sherlock fills in a free one:\n' +
        '  ssh -N -L {{port}}:db.internal:5432 bastion.example.com\n' +
        '  kubectl port-forward svc/postgres {{port}}:5432\n\n' +
        'If it picks its own port and prints it, leave {{port}} out. Sherlock\n' +
        'then reads the port from the output, using a pattern you give it:\n' +
        '  kubectl port-forward svc/postgres :5432'
    );

    const command = await p.text({
        message: 'Tunnel command',
        placeholder: 'ssh -N -L {{port}}:db.internal:5432 bastion.example.com',
        initialValue: existing?.command,
        validate: (value) => {
            if (!value || value.trim() === '') return 'A command is required';
            return undefined;
        },
    });
    if (p.isCancel(command)) return null;

    // With {{port}} sherlock dictates the port, so there is nothing else to ask.
    let localPort: number | undefined;
    let endpointPattern: string | undefined;

    if (!hasPortPlaceholder(command)) {
        p.log.warn('The command has no {{port}}, so sherlock cannot tell it which port to bind.');

        const strategy = await p.select({
            message: 'How does the command decide its local port?',
            initialValue: existing?.endpointPattern ? 'discover' : 'fixed',
            options: [
                { value: 'fixed', label: 'It always uses the same port', hint: 'enter it below' },
                {
                    value: 'discover',
                    label: 'It picks a port and prints it',
                    hint: 'kubectl port-forward svc/postgres :5432',
                },
            ],
        });
        if (p.isCancel(strategy)) return null;

        if (strategy === 'fixed') {
            const portValue = await p.text({
                message: 'Fixed local port',
                placeholder: 'e.g. 15432',
                initialValue: existing?.localPort ? String(existing.localPort) : undefined,
                validate: (value) => {
                    const n = Number(value);
                    if (!Number.isInteger(n) || n < 1 || n > 65535) {
                        return 'Enter a port between 1 and 65535';
                    }
                    return undefined;
                },
            });
            if (p.isCancel(portValue)) return null;
            localPort = Number(portValue);
        } else {
            p.log.info(
                'Give a regular expression matching the line the command prints.\n' +
                'It needs a (?<port>...) group, and may have a (?<host>...) group.\n\n' +
                'kubectl prints:\n' +
                '  Forwarding from 127.0.0.1:54321 -> 5432\n' +
                'which "Forwarding from (?<host>[\\d.]+):(?<port>\\d+)" matches. Run your\n' +
                'command once and copy the wording it prints.'
            );
            const patternValue = await p.text({
                message: 'Endpoint pattern',
                placeholder: 'Forwarding from (?<host>[\\d.]+):(?<port>\\d+)',
                initialValue: existing?.endpointPattern,
                validate: (value) => {
                    if (!value || !value.includes('(?<port>')) {
                        return 'Must contain a named "port" group, e.g. (?<port>\\d+)';
                    }
                    try {
                        new RegExp(value);
                        return undefined;
                    } catch (error) {
                        return error instanceof Error ? error.message : 'Invalid regular expression';
                    }
                },
            });
            if (p.isCancel(patternValue)) return null;
            endpointPattern = patternValue;
        }
    }

    const idleTimeout = await p.text({
        message: 'Shut the tunnel down after this long with no queries',
        placeholder: DEFAULT_IDLE_TIMEOUT,
        initialValue: existing?.idleTimeout ?? DEFAULT_IDLE_TIMEOUT,
        validate: (value) => {
            if (!value) return undefined;
            try {
                parseDuration(value);
                return undefined;
            } catch (error) {
                return error instanceof Error ? error.message : 'Invalid duration';
            }
        },
    });
    if (p.isCancel(idleTimeout)) return null;

    const tunnel: CommandTunnelConfig = { command: command.trim() };
    if (localPort !== undefined) tunnel.localPort = localPort;
    if (endpointPattern !== undefined) tunnel.endpointPattern = endpointPattern;
    if (idleTimeout && idleTimeout !== DEFAULT_IDLE_TIMEOUT) tunnel.idleTimeout = idleTimeout;
    if (existing?.readyTimeout) tunnel.readyTimeout = existing.readyTimeout;

    return tunnel;
}

/**
 * Prompt for a project directory with clear options.
 * Returns the directory string, empty string if skipped, or null if cancelled.
 */
async function promptForDirectory(existingDirectory?: string): Promise<string | null> {
    const cwd = process.cwd();

    if (existingDirectory) {
        // Editing: use a text field pre-filled with the existing value
        const directory = await p.text({
            message: 'Project directory (auto-selects this connection when you are in this dir)',
            placeholder: 'Leave empty to remove',
            initialValue: existingDirectory,
        });
        if (p.isCancel(directory)) return null;
        return directory;
    }

    const choice = await p.select({
        message: 'Project directory (auto-selects this connection when you are in this dir)',
        options: [
            { value: 'cwd', label: `Use current directory`, hint: cwd },
            { value: 'custom', label: 'Enter a custom path' },
            { value: 'skip', label: 'Skip' },
        ],
    });

    if (p.isCancel(choice)) return null;

    if (choice === 'cwd') return cwd;
    if (choice === 'skip') return '';

    const directory = await p.text({
        message: 'Project directory',
        placeholder: '/path/to/project',
    });
    if (p.isCancel(directory)) return null;
    return directory;
}

/**
 * The config the wizard edits: the user config that `saveConfig` writes, not
 * whichever file discovery would pick. Reading a project's .sherlock.json or
 * SHERLOCK_CONFIG here would copy all of its connections, tunnels included,
 * into the user config on the next save. Null when it cannot be read.
 */
function loadWritableConfig(): SherlockConfig | null {
    try {
        return loadOrCreateConfig();
    } catch (error) {
        p.log.error(`Could not read ${writableConfigPath()}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

/**
 * Save the user config, and say so when commands run here read a different
 * file and so will not see the change.
 */
function saveConfig(config: SherlockConfig): void {
    writeConfig(config);
    const shadowed = shadowingWarning();
    if (shadowed) p.log.warn(shadowed);
}

/** Whether a password reference is the keychain entry named after a connection */
export function usesOwnKeychainEntry(password: ConnectionConfig['password'], connName: string): boolean {
    return typeof password === 'object' && password !== null && '$keychain' in password &&
        (password.$keychain === connName ||
            (typeof password.$keychain === 'object' && password.$keychain.account === connName &&
                (password.$keychain.service ?? 'sherlock') === 'sherlock'));
}

/**
 * Move a connection's keychain password to the entry for its new name, and
 * point the config at it. Returns false, having said why, when it could not
 * be moved; the rename should then not go ahead.
 */
function moveKeychainEntry(config: ConnectionConfig, oldName: string, newName: string): boolean {
    if (!usesOwnKeychainEntry(config.password, oldName)) return true;

    const secret = getKeychainPassword(oldName);
    if (secret === null) {
        // Nothing to move. Point at the new name so a password stored later lands there.
        config.password = { $keychain: newName };
        return true;
    }
    if (hasKeychainPassword(newName)) {
        p.log.error(
            `The keychain already has an entry for "${newName}", so the password of "${oldName}" ` +
            `cannot be moved there. Nothing was renamed.`
        );
        return false;
    }
    setKeychainPassword(newName, secret);
    config.password = { $keychain: newName };
    deleteKeychainPassword(oldName);
    p.log.info(`Moved the keychain password from "${oldName}" to "${newName}".`);
    return true;
}

/**
 * Delete a connection: its config, the keychain entry it uses if that entry
 * is named after it, and its tunnel if one is running.
 */
async function removeConnection(config: SherlockConfig, connName: string): Promise<void> {
    const conn = config.connections[connName];
    delete config.connections[connName];
    if (conn && usesOwnKeychainEntry(conn.password, connName) && hasKeychainPassword(connName)) {
        deleteKeychainPassword(connName);
    }
    if (conn?.tunnel) await stopTunnel(connName).catch(() => undefined);
    saveConfig(config);
    p.log.success(`Connection "${connName}" deleted.`);
    if (conn && typeof conn.password === 'object' && conn.password !== null && '$env' in conn.password) {
        p.log.info(`Its password variable ${conn.password.$env} was left in place, in case anything else uses it.`);
    }
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
    const envPath = getEnvFilePath();

    let content = '';
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, 'utf-8');
    }

    // Check if key already exists
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
        // A function, so that "$&" or "$1" in a password is not expanded
        content = content.replace(regex, () => `${key}=${value}`);
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

