import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    SECTION_END, SECTION_START, agentsSection, chooseAgentsFile, projectConnections, writeAgentsSection,
} from './agents-md';
import type { SherlockConfig } from './config/types';

const CLI = path.join(import.meta.dir, 'query-db.ts');

let dir: string;
let project: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sherlock-agents-md-'));
    project = path.join(dir, 'project');
    fs.mkdirSync(project);
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('projectConnections', () => {
    it("finds connections for the project, a parent of it, or an app inside it, and no others", () => {
        const config = {
            connections: {
                shop: { url: 'postgres://h/db', directory: project },
                parent: { type: 'mysql', host: 'h', directory: dir },
                app: { url: 'sqlite:///tmp/x.db', directory: path.join(project, 'apps', 'api') },
                other: { url: 'postgres://h/db', directory: path.join(dir, 'project-two') },
                none: { url: 'redis://h' },
            },
        } as unknown as SherlockConfig;
        expect(projectConnections(config, project)).toEqual([
            { name: 'app', type: 'sqlite' },
            { name: 'parent', type: 'mysql' },
            { name: 'shop', type: 'postgres' },
        ]);
    });
});

describe('agentsSection', () => {
    it('names one connection and the rules, between markers', () => {
        const text = agentsSection([{ name: 'shop', type: 'postgres' }]);
        expect(text.startsWith(SECTION_START)).toBe(true);
        expect(text.endsWith(SECTION_END)).toBe(true);
        expect(text).toContain("This project's connection is `shop` (PostgreSQL): pass `-c shop`.");
        expect(text).toContain('Run `sherlock guide`');
        expect(text).toContain('read-only on purpose');
        expect(text).toContain('`sherlock doctor <name>`');
    });

    it('lists several connections, or none', () => {
        expect(agentsSection([{ name: 'a', type: 'mssql' }, { name: 'b', type: 'redis' }]))
            .toContain('`a` (SQL Server), `b` (Redis)');
        expect(agentsSection([])).toContain('`sherlock connection list` shows them');
    });
});

describe('chooseAgentsFile', () => {
    it('picks AGENTS.md, or CLAUDE.md when it exists and does not bring AGENTS.md in', () => {
        expect(chooseAgentsFile(project)).toBe(path.join(project, 'AGENTS.md'));
        fs.writeFileSync(path.join(project, 'CLAUDE.md'), '# Notes\n');
        expect(chooseAgentsFile(project)).toBe(path.join(project, 'CLAUDE.md'));
        fs.writeFileSync(path.join(project, 'CLAUDE.md'), '@AGENTS.md\n');
        expect(chooseAgentsFile(project)).toBe(path.join(project, 'AGENTS.md'));
    });
});

describe('writeAgentsSection', () => {
    const v1 = agentsSection([{ name: 'shop', type: 'postgres' }]);
    const v2 = agentsSection([{ name: 'shop2', type: 'postgres' }]);

    it('creates the file, then leaves it alone when nothing changed', () => {
        const file = path.join(project, 'AGENTS.md');
        expect(writeAgentsSection(file, v1)).toBe('created');
        expect(fs.readFileSync(file, 'utf-8')).toBe(v1 + '\n');
        expect(writeAgentsSection(file, v1)).toBe('unchanged');
    });

    it('appends to a file, then replaces only its own section', () => {
        const file = path.join(project, 'CLAUDE.md');
        fs.writeFileSync(file, '# Project\n\nUse pnpm.');
        expect(writeAgentsSection(file, v1)).toBe('added');
        expect(fs.readFileSync(file, 'utf-8')).toBe(`# Project\n\nUse pnpm.\n\n${v1}\n`);
        fs.appendFileSync(file, '\n## Later\n\nMore notes.\n');
        expect(writeAgentsSection(file, v2)).toBe('updated');
        expect(fs.readFileSync(file, 'utf-8')).toBe(`# Project\n\nUse pnpm.\n\n${v2}\n\n## Later\n\nMore notes.\n`);
    });
});

describe('sherlock agents-md', () => {
    function run(args: string[]) {
        const config = path.join(dir, 'config.json');
        fs.writeFileSync(config, JSON.stringify({ connections: { shop: { url: 'postgres://h/db', directory: project } } }));
        const result = spawnSync('bun', [CLI, '--config', config, 'agents-md', ...args], { encoding: 'utf-8', cwd: project });
        return { status: result.status, envelope: JSON.parse(result.stdout) };
    }

    it("writes the project's AGENTS.md, naming its connection", () => {
        const { status, envelope } = run([]);
        expect(status).toBe(0);
        expect(envelope.data).toEqual({ file: fs.realpathSync(path.join(project, 'AGENTS.md')), action: 'created', connections: ['shop'] });
        expect(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf-8')).toContain('`shop` (PostgreSQL)');
    });

    it('prints without writing, and takes another directory', () => {
        const { envelope } = run(['--print', '--directory', project]);
        expect(envelope.data.text).toContain('`shop` (PostgreSQL)');
        expect(fs.existsSync(path.join(project, 'AGENTS.md'))).toBe(false);
    });

    it('refuses a directory that does not exist', () => {
        const { status, envelope } = run(['--directory', path.join(dir, 'missing')]);
        expect(status).toBe(2);
        expect(envelope.error.details).toEqual({ flag: '--directory' });
    });
});
