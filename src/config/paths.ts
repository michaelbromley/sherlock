import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const APP_NAME = 'sherlock';

/**
 * Get the config directory path following XDG Base Directory spec
 */
export function getConfigDir(): string {
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
 * Config file discovery order:
 * 1. CLI flag (--config)
 * 2. SHERLOCK_CONFIG environment variable
 * 3. ./.sherlock.json (project-local)
 * 4. ~/.config/sherlock/config.json (XDG standard)
 */
export function findConfigFile(cliConfigPath?: string): string | null {
    // 1. CLI flag
    if (cliConfigPath) {
        const resolved = path.resolve(cliConfigPath);
        if (fs.existsSync(resolved)) {
            return resolved;
        }
        throw new Error(`Config file not found: ${resolved}`);
    }

    // 2. Environment variable
    if (process.env.SHERLOCK_CONFIG) {
        const envPath = path.resolve(process.env.SHERLOCK_CONFIG);
        if (fs.existsSync(envPath)) {
            return envPath;
        }
        throw new Error(`Config file not found: ${envPath} (from SHERLOCK_CONFIG env var)`);
    }

    // 3. Project-local config
    const localConfigPath = path.resolve('.sherlock.json');
    if (fs.existsSync(localConfigPath)) {
        return localConfigPath;
    }

    // 4. XDG config directory
    const xdgConfigPath = path.join(getConfigDir(), 'config.json');
    if (fs.existsSync(xdgConfigPath)) {
        return xdgConfigPath;
    }

    // 5. Legacy config.ts in current directory (for migration)
    const legacyConfigPath = path.resolve('config.ts');
    if (fs.existsSync(legacyConfigPath)) {
        return legacyConfigPath;
    }

    return null;
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
