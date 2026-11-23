/**
 * Reading `.env` files: sherlock's own, in its config directory, and a
 * project's, for a connection that names its project with `directory`.
 *
 * A connection with a directory reads `$env` references from that project's
 * `.env` first, then from the environment. The project's file wins because a
 * name such as DATABASE_URL is common: a value exported in the shell for some
 * other project must not send this connection to the wrong database.
 */

import * as fs from 'fs';
import * as path from 'path';

/** A project's `.env`: where it is, and what it sets */
export interface ProjectEnv {
    file: string;
    values: Record<string, string>;
}

/**
 * The variables a `.env` file sets. Blank lines and `#` comments are skipped,
 * an `export ` prefix is allowed, and matching quotes around a value are
 * removed.
 */
export function parseEnvFile(content: string): Record<string, string> {
    const values: Record<string, string> = {};
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const assignment = trimmed.replace(/^export\s+/, '');
        const eqIndex = assignment.indexOf('=');
        if (eqIndex === -1) continue;

        const key = assignment.slice(0, eqIndex).trim();
        let value = assignment.slice(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
            (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
            value = value.slice(1, -1);
        }
        if (key) values[key] = value;
    }
    return values;
}

/** The `.env` of a connection's project directory, or undefined when there is none */
export function projectEnv(directory: string | undefined): ProjectEnv | undefined {
    if (!directory) return undefined;
    const file = path.join(directory, '.env');
    let content: string;
    try {
        content = fs.readFileSync(file, 'utf-8');
    } catch {
        return undefined;
    }
    return { file, values: parseEnvFile(content) };
}

/** A variable for a connection: the project's `.env` first, then the environment */
export function lookupEnv(
    name: string,
    project: ProjectEnv | undefined,
    env: Record<string, string | undefined> = process.env
): { value: string; from: string } | undefined {
    const fromProject = project?.values[name];
    if (fromProject !== undefined) return { value: fromProject, from: project!.file };
    const fromEnv = env[name];
    if (fromEnv !== undefined) return { value: fromEnv, from: 'environment' };
    return undefined;
}
