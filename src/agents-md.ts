/**
 * `sherlock agents-md`: a short section about sherlock in a project's
 * AGENTS.md or CLAUDE.md.
 *
 * Agents read those files at the start of every session, while the skill and
 * `sherlock guide` are read only when the agent decides to. So the section
 * holds what an agent must know before its first command: which connection is
 * this project's, and the rules. Everything else stays in the guide.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DB_TYPES, type DbType } from './db-types';
import type { SherlockConfig } from './config/types';
import { connectionsForDirectory, summarizeConnection } from './config/index';

export const SECTION_START = '<!-- sherlock:start -->';
export const SECTION_END = '<!-- sherlock:end -->';

const TYPE_NAMES: Record<DbType, string> = {
    [DB_TYPES.POSTGRES]: 'PostgreSQL',
    [DB_TYPES.MYSQL]: 'MySQL',
    [DB_TYPES.SQLITE]: 'SQLite',
    [DB_TYPES.REDIS]: 'Redis',
    [DB_TYPES.MSSQL]: 'SQL Server',
};

export interface ProjectConnection {
    name: string;
    type: DbType;
}

/** The connections set up for a project, with their types */
export function projectConnections(config: SherlockConfig, projectDir: string): ProjectConnection[] {
    return connectionsForDirectory(config, projectDir)
        .map((name) => ({ name, type: summarizeConnection(name, config.connections[name]).type }));
}

/** The section's text, markers included */
export function agentsSection(connections: ProjectConnection[]): string {
    const named = connections.map((c) => `\`${c.name}\` (${TYPE_NAMES[c.type]})`);
    const which = connections.length === 0
        ? 'Name the connection with `-c <name>`; `sherlock connection list` shows them.'
        : connections.length === 1
            ? `This project's connection is ${named[0]}: pass \`-c ${connections[0].name}\`. If it is missing on this machine, \`sherlock guide setup\` shows how to add it.`
            : `This project's connections are ${named.join(', ')}. Name one with \`-c <name>\`. If one is missing on this machine, \`sherlock guide setup\` shows how to add it.`;
    return [
        SECTION_START,
        '## Databases',
        '',
        `Read this project's databases with the \`sherlock\` CLI. ${which}`,
        '',
        '- Run `sherlock guide` before the first sherlock command in a session. It describes the installed version\'s output and errors.',
        '- Sherlock is read-only on purpose. Don\'t change data by other means, such as `psql`, the app\'s code or credentials from `.env`, unless the user asks for it that way. Give them the SQL instead.',
        '- Never ask for a database password, guess one, or put one on a command line.',
        '- When a connection fails, run `sherlock doctor <name>` and tell the user what it says.',
        SECTION_END,
    ].join('\n');
}

/**
 * The file to write: CLAUDE.md when the project has one that does not bring
 * in AGENTS.md, since Claude Code then reads only CLAUDE.md; otherwise
 * AGENTS.md, which the other agents read.
 */
export function chooseAgentsFile(projectDir: string): string {
    const claude = path.join(projectDir, 'CLAUDE.md');
    if (fs.existsSync(claude) && !fs.readFileSync(claude, 'utf-8').includes('AGENTS.md')) return claude;
    return path.join(projectDir, 'AGENTS.md');
}

export type WriteAction = 'created' | 'added' | 'updated' | 'unchanged';

/** Add the section to a file, or replace the one already there */
export function writeAgentsSection(file: string, section: string): WriteAction {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, section + '\n');
        return 'created';
    }
    const current = fs.readFileSync(file, 'utf-8');
    const start = current.indexOf(SECTION_START);
    const end = current.indexOf(SECTION_END, start);
    let next: string;
    if (start !== -1 && end !== -1) {
        next = current.slice(0, start) + section + current.slice(end + SECTION_END.length);
    } else {
        const separator = current.length === 0 ? '' : current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
        next = current + separator + section + '\n';
    }
    if (next === current) return 'unchanged';
    fs.writeFileSync(file, next);
    return start !== -1 && end !== -1 ? 'updated' : 'added';
}
