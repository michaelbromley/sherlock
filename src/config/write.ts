/**
 * Writing the config file.
 *
 * Both the setup wizard and `sherlock connection add` end up here, so a
 * connection added either way lands in the same file with the same permissions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getConfigDir, ensureConfigDir } from './paths';
import { loadConfigFile } from './index';
import type { SherlockConfig, ConnectionConfig } from './types';

/** Config may hold credentials, so it is readable by its owner only */
const SECURE_FILE_MODE = 0o600;

/** The config version written for a file sherlock creates itself */
const CONFIG_VERSION = '2.0';

/** Where a config sherlock writes always goes, regardless of where one was read from */
export function writableConfigPath(): string {
    return path.join(getConfigDir(), 'config.json');
}

/** Write the config, replacing whatever was there */
export function saveConfig(config: SherlockConfig): void {
    ensureConfigDir();
    const configPath = writableConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    fs.chmodSync(configPath, SECURE_FILE_MODE);
}

/** Load the existing config, or start a new one when there is nothing to load */
export function loadOrCreateConfig(): SherlockConfig {
    try {
        return loadConfigFile();
    } catch {
        return { version: CONFIG_VERSION, connections: {} };
    }
}

/**
 * Add a connection and write the file. Refuses to replace an existing
 * connection unless `force` is set, so a mistyped name cannot quietly
 * overwrite a working one.
 */
export function addConnection(
    name: string,
    connection: ConnectionConfig,
    options: { force?: boolean } = {}
): { replaced: boolean; path: string } {
    const config = loadOrCreateConfig();
    const replaced = config.connections[name] !== undefined;

    if (replaced && !options.force) {
        throw new Error(`Connection "${name}" already exists. Pass --force to replace it.`);
    }

    config.connections[name] = connection;
    saveConfig(config);

    return { replaced, path: writableConfigPath() };
}
