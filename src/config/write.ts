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
export const CONFIG_VERSION = '2.0';

/** Where sherlock writes config, which is not always where it read config from */
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

/**
 * Load the existing config, or start a new one when there is none.
 *
 * This reads the file `saveConfig` writes, not whichever config discovery would
 * pick. Discovery prefers `./.sherlock.json` and SHERLOCK_CONFIG, and reading
 * one of those here would copy its connections, tunnel commands included, into
 * the user config on the next write.
 *
 * Only a missing config produces a new one. A config that exists but cannot be
 * read is an error, because the alternative is writing an empty config over
 * whatever was there and losing every connection in it.
 */
export function loadOrCreateConfig(): SherlockConfig {
    const configPath = writableConfigPath();
    if (!fs.existsSync(configPath)) {
        return { version: CONFIG_VERSION, connections: {} };
    }
    return loadConfigFile(configPath);
}

/**
 * Whether a connection of this name is already configured.
 *
 * Callers check this before doing anything irreversible, such as writing a
 * keychain entry, so a refused add cannot damage the connection it collided
 * with.
 */
export function connectionExists(name: string): boolean {
    return loadOrCreateConfig().connections[name] !== undefined;
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
