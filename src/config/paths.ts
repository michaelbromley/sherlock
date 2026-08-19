import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const APP_NAME = 'sherlock';

/**
 * Get the directory where the binary is located (for portable mode)
 */
export function getBinaryDir(): string {
    return path.dirname(process.execPath);
}

/**
 * Check if we're running in portable mode (config.json exists next to binary)
 */
export function isPortableMode(): boolean {
    const portableConfig = path.join(getBinaryDir(), 'config.json');
    return fs.existsSync(portableConfig);
}

/**
 * Get the config directory path
 * - Portable mode: same directory as the binary
 * - Standard mode: XDG Base Directory spec (~/.config/sherlock)
 */
export function getConfigDir(): string {
    // Portable mode: config lives next to the binary
    if (isPortableMode()) {
        return getBinaryDir();
    }

    // Standard mode: XDG spec
    if (process.platform === 'win32') {
        return process.env.APPDATA
            ? path.join(process.env.APPDATA, APP_NAME)
            : path.join(os.homedir(), `.${APP_NAME}`);
    }

    // macOS and Linux - follow XDG spec
    return (
        process.env.XDG_CONFIG_HOME
            ? path.join(process.env.XDG_CONFIG_HOME, APP_NAME)
            : path.join(os.homedir(), '.config', APP_NAME)
    );
}

/**
 * Get the logs directory path
 */
export function getLogsDir(): string {
    return path.join(getConfigDir(), 'logs');
}

/**
 * Get the cache directory path
 */
export function getCacheDir(): string {
    return path.join(getConfigDir(), 'cache');
}

/**
 * Get the directory holding tunnel state and logs
 */
export function getTunnelsDir(): string {
    return path.join(getConfigDir(), 'tunnels');
}

/**
 * Where a config file was discovered.
 *
 * `project` and `legacy` come from the current working directory, so their
 * contents are attacker-controlled for anyone who clones an untrusted repo.
 * Features that execute config-supplied commands must refuse those two.
 */
export type ConfigSource = 'cli' | 'env' | 'portable' | 'project' | 'user' | 'legacy';

export interface FoundConfig {
    path: string;
    source: ConfigSource;
}

/** Human-readable description of a config source, for error messages */
export function describeConfigSource(source: ConfigSource): string {
    switch (source) {
        case 'cli':
            return '--config flag';
        case 'env':
            return 'SHERLOCK_CONFIG environment variable';
        case 'portable':
            return 'config.json next to the sherlock binary';
        case 'project':
            return 'project-local .sherlock.json';
        case 'user':
            return 'user config directory';
        case 'legacy':
            return 'legacy config.ts in the current directory';
    }
}

/**
 * Config file discovery order:
 * 1. CLI flag (--config)
 * 2. SHERLOCK_CONFIG environment variable
 * 3. Portable mode: config.json next to binary
 * 4. ./.sherlock.json (project-local)
 * 5. ~/.config/sherlock/config.json (XDG standard)
 * 6. ./config.ts (legacy, for migration)
 */
export function findConfig(cliConfigPath?: string): FoundConfig | null {
    // 1. CLI flag
    if (cliConfigPath) {
        const resolved = path.resolve(cliConfigPath);
        if (fs.existsSync(resolved)) {
            return { path: resolved, source: 'cli' };
        }
        throw new Error(`Config file not found: ${resolved}`);
    }

    // 2. Environment variable
    if (process.env.SHERLOCK_CONFIG) {
        const envPath = path.resolve(process.env.SHERLOCK_CONFIG);
        if (fs.existsSync(envPath)) {
            return { path: envPath, source: 'env' };
        }
        throw new Error(`Config file not found: ${envPath} (from SHERLOCK_CONFIG env var)`);
    }

    // 3. Portable mode: config.json next to binary
    const portableConfigPath = path.join(getBinaryDir(), 'config.json');
    if (fs.existsSync(portableConfigPath)) {
        return { path: portableConfigPath, source: 'portable' };
    }

    // 4. Project-local config
    const localConfigPath = path.resolve('.sherlock.json');
    if (fs.existsSync(localConfigPath)) {
        return { path: localConfigPath, source: 'project' };
    }

    // 5. XDG config directory
    const xdgConfigPath = path.join(getXdgConfigDir(), 'config.json');
    if (fs.existsSync(xdgConfigPath)) {
        return { path: xdgConfigPath, source: 'user' };
    }

    // 6. Legacy config.ts in current directory (for migration)
    const legacyConfigPath = path.resolve('config.ts');
    if (fs.existsSync(legacyConfigPath)) {
        return { path: legacyConfigPath, source: 'legacy' };
    }

    return null;
}

/** Config file discovery, when the caller only needs the path */
export function findConfigFile(cliConfigPath?: string): string | null {
    return findConfig(cliConfigPath)?.path ?? null;
}

/**
 * Get XDG config directory (without portable mode check)
 */
function getXdgConfigDir(): string {
    if (process.platform === 'win32') {
        return process.env.APPDATA
            ? path.join(process.env.APPDATA, APP_NAME)
            : path.join(os.homedir(), `.${APP_NAME}`);
    }

    return (
        process.env.XDG_CONFIG_HOME
            ? path.join(process.env.XDG_CONFIG_HOME, APP_NAME)
            : path.join(os.homedir(), '.config', APP_NAME)
    );
}

/**
 * Get the .env file path for the config directory
 */
export function getEnvFilePath(): string {
    return path.join(getConfigDir(), '.env');
}

/**
 * Ensure the config directory exists
 */
export function ensureConfigDir(): void {
    const configDir = getConfigDir();
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }
}

/**
 * Ensure the logs directory exists
 */
export function ensureLogsDir(): void {
    const logsDir = getLogsDir();
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true, mode: 0o700 });
    }
}

/**
 * Ensure the cache directory exists
 */
export function ensureCacheDir(): void {
    const cacheDir = getCacheDir();
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
    }
}

/**
 * Ensure the tunnels directory exists
 */
export function ensureTunnelsDir(): void {
    const tunnelsDir = getTunnelsDir();
    if (!fs.existsSync(tunnelsDir)) {
        fs.mkdirSync(tunnelsDir, { recursive: true, mode: 0o700 });
    }
}
