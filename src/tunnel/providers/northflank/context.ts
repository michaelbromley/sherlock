/**
 * Reading a login out of the Northflank CLI's config.
 *
 * The CLI keeps every login as a named "context" and marks one as current.
 * Sherlock reads the named context straight from the file and never asks which
 * is current, so switching context in a terminal cannot redirect a connection,
 * and nothing here ever writes to the file.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Environment variable the Northflank CLI reads its config directory from */
const CONFIG_DIR_ENV = 'NF_CONFIG_DIR';

const DEFAULT_API_HOST = 'https://api.northflank.com';

/** A login. `token` is a secret: never log it or put it in an error. */
export interface NorthflankContext {
    name: string;
    token: string;
    host: string;
    tokenScope?: 'team' | 'org';
    team?: string;
}

/** Expand a leading `~`, which a config file cannot rely on a shell to do */
function expandHome(dir: string): string {
    if (dir === '~') return os.homedir();
    if (dir.startsWith('~/')) return path.join(os.homedir(), dir.slice(2));
    return dir;
}

/** The CLI config directory: the one configured, else the CLI's own default */
export function northflankConfigDir(
    configDir: string | undefined,
    env: Record<string, string | undefined> = process.env
): string {
    const chosen = configDir ?? env[CONFIG_DIR_ENV];
    return chosen ? path.resolve(expandHome(chosen)) : path.join(os.homedir(), '.northflank');
}

/**
 * Load a context by name. Errors name the file and the contexts it does hold,
 * and never include a token.
 */
export function loadNorthflankContext(
    name: string,
    configDir?: string,
    env: Record<string, string | undefined> = process.env
): NorthflankContext {
    const file = path.join(northflankConfigDir(configDir, env), 'config.json');

    let content: string;
    try {
        content = fs.readFileSync(file, 'utf-8');
    } catch {
        throw new Error(
            `Cannot read the Northflank CLI config at ${file}. Log in with "northflank login", ` +
            `or set "configDir" on the tunnel to the directory that holds config.json.`
        );
    }

    let contexts: unknown;
    try {
        contexts = (JSON.parse(content) as { contexts?: unknown }).contexts;
    } catch {
        // The parse error would quote the file, which holds tokens.
        throw new Error(`The Northflank CLI config at ${file} is not valid JSON.`);
    }

    const list = (Array.isArray(contexts) ? contexts : []).filter(
        (entry): entry is Record<string, unknown> =>
            typeof entry === 'object' && entry !== null && typeof (entry as { name?: unknown }).name === 'string'
    );
    const found = list.find((entry) => entry.name === name);

    if (!found) {
        const names = list.map((entry) => `"${entry.name as string}"`).join(', ');
        throw new Error(
            `No Northflank context named "${name}" in ${file}. ` +
            (names ? `It has: ${names}.` : 'It has no contexts: log in with "northflank login".')
        );
    }
    if (typeof found.token !== 'string' || found.token === '') {
        throw new Error(
            `Northflank context "${name}" in ${file} has no token. Log in again with "northflank login".`
        );
    }

    return {
        name,
        token: found.token,
        host: typeof found.host === 'string' && found.host !== '' ? found.host : DEFAULT_API_HOST,
        tokenScope: found.tokenScope === 'org' || found.tokenScope === 'team' ? found.tokenScope : undefined,
        team: typeof found.team === 'string' && found.team !== '' ? found.team : undefined,
    };
}

/**
 * The names of the contexts in a CLI config, for offering as choices. Never
 * returns tokens. Throws with the same messages as `loadNorthflankContext`.
 */
export function listNorthflankContextNames(
    configDir?: string,
    env: Record<string, string | undefined> = process.env
): string[] {
    const file = path.join(northflankConfigDir(configDir, env), 'config.json');
    let parsed: { contexts?: unknown };
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        throw new Error(`Cannot read the Northflank CLI config at ${file}. Log in with "northflank login" first.`);
    }
    return (Array.isArray(parsed.contexts) ? parsed.contexts : [])
        .map((entry) => (entry as { name?: unknown })?.name)
        .filter((name): name is string => typeof name === 'string' && name !== '');
}

/** Remove a token from text that is about to be shown or logged */
export function redactToken(text: string, token: string): string {
    return token ? text.split(token).join('[redacted]') : text;
}
