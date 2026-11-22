import { describe, it, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import * as path from 'path';
import { GUIDE_TOPICS, guideText } from './index';

const CLI = path.join(import.meta.dir, '..', 'query-db.ts');

/** Global options that take a value, skipped when finding the command */
const VALUE_OPTIONS = new Set(['-c', '--connection', '-u', '--url', '--config', '-f', '--format']);

/**
 * Flags the guide names that belong to other tools, not to sherlock. Only
 * flags written on their own in inline code are checked against this; flags
 * inside a `sherlock ...` command are always checked against that command.
 */
const EXTERNAL_FLAGS = new Set(['--skipHostnames']);

// ---------------------------------------------------------------------------
// What the CLI actually has, read from its own help output
// ---------------------------------------------------------------------------

function helpText(command: string[]): string {
    const result = spawnSync('bun', [CLI, ...command, '--help'], { encoding: 'utf-8' });
    if (result.status !== 0) throw new Error(`sherlock ${command.join(' ')} --help failed: ${result.stderr}`);
    return result.stdout;
}

/** The lines of one section of commander's help, such as "Commands:" */
function section(help: string, title: string): string[] {
    const lines = help.split('\n');
    const start = lines.findIndex((line) => line === `${title}:`);
    if (start === -1) return [];
    const end = lines.findIndex((line, i) => i > start && line !== '' && !line.startsWith(' '));
    return lines.slice(start + 1, end === -1 ? undefined : end);
}

/** Command names listed in a help text. Hidden commands are not listed. */
function listedCommands(help: string): string[] {
    return section(help, 'Commands')
        .map((line) => /^ {2}([a-z][\w-]*)/.exec(line)?.[1])
        .filter((name): name is string => name !== undefined && name !== 'help');
}

/** Every flag spelling in a help text's options, e.g. "-n" and "--limit" */
function listedFlags(help: string): Set<string> {
    const flags = new Set<string>();
    for (const line of section(help, 'Options')) {
        const spec = /^ {2}(-\S.*?)(?: {2,}|$)/.exec(line)?.[1] ?? '';
        for (const flag of spec.matchAll(/(?:^|[\s,])(--?[A-Za-z][\w-]*)/g)) flags.add(flag[1]);
    }
    return flags;
}

interface CliCommand {
    flags: Set<string>;
    /** Subcommands, for a command group such as `tunnel` */
    subcommands: Map<string, CliCommand>;
}

function readCommand(command: string[]): CliCommand {
    const help = helpText(command);
    // A command is a group when its help lists commands of its own.
    const subcommands = new Map(
        command.length === 0 || listedCommands(help).length === 0
            ? []
            : listedCommands(help).map((name) => [name, readCommand([...command, name])] as const)
    );
    return { flags: listedFlags(help), subcommands };
}

const ROOT_HELP = helpText([]);
const GLOBAL_FLAGS = listedFlags(ROOT_HELP);
const COMMANDS = new Map(listedCommands(ROOT_HELP).map((name) => [name, readCommand([name])] as const));
const ALL_FLAGS = new Set([
    ...GLOBAL_FLAGS,
    ...[...COMMANDS.values()].flatMap((command) => [
        ...command.flags,
        ...[...command.subcommands.values()].flatMap((sub) => [...sub.flags]),
    ]),
]);

// ---------------------------------------------------------------------------
// What the guide shows
// ---------------------------------------------------------------------------

function codeOf(markdown: string): { blocks: string[]; inline: string[] } {
    return {
        blocks: [...markdown.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]),
        inline: [...markdown.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map((m) => m[1]),
    };
}

/**
 * Every sherlock invocation in the guide's code, as words. The transfer guide
 * writes the binary as `<local-sherlock>` and `<remote-sherlock>`, and runs
 * some commands inside a quoted `ssh` argument, so both are looked into.
 */
function invocations(markdown: string): string[][] {
    const { blocks, inline } = codeOf(markdown);
    const lines = [...blocks, ...inline]
        .join('\n')
        // A trailing backslash continues the command on the next line.
        .replace(/\\\n\s*/g, ' ')
        .replace(/<(?:local|remote)-sherlock>/g, 'sherlock')
        // A placeholder such as "<one imported connection>" is one argument.
        .replace(/<[^<>\n]*>/g, (placeholder) => placeholder.replace(/\s+/g, '_'))
        .split('\n');

    const found: string[][] = [];
    const scan = (line: string) => {
        // A quoted span is an argument: SQL, a pattern, or a whole command
        // for ssh. Look inside the ones that run sherlock, then set all aside.
        for (const quoted of line.matchAll(/'([^']*)'|"([^"]*)"/g)) {
            const inner = quoted[1] ?? quoted[2];
            if (/(?:^|[\s;&|])sherlock\s/.test(inner)) scan(inner);
        }
        const unquoted = line.replace(/'[^']*'|"[^"]*"/g, 'ARG');
        for (const match of unquoted.matchAll(/(?:^|[\s|;&(])sherlock((?:[ \t]+[^\s|;&)<>#]+|[ \t]+<[^>]+>)+)/g)) {
            found.push(
                match[1].trim().split(/[ \t]+/)
                    // "[--force]" in a usage line is the optional flag --force.
                    .map((word) => word.replace(/^\[+|\]+$/g, ''))
                    .filter(Boolean)
            );
        }
    };
    lines.forEach(scan);
    return found;
}

interface Use {
    /** e.g. ["tunnel", "stop"]; empty when the command is a placeholder */
    command: string[];
    flags: string[];
}

/** The command and flags of one invocation, skipping global options and values */
function parse(words: string[]): Use {
    const command: string[] = [];
    const flags: string[] = [];
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (VALUE_OPTIONS.has(word)) { i++; continue; }
        if (word.startsWith('-') && word !== '-') {
            flags.push(word.split('=')[0]);
            continue;
        }
        const top = command.length > 0 ? COMMANDS.get(command[0]) : undefined;
        const wantsCommand = command.length === 0 || (command.length === 1 && (top?.subcommands.size ?? 0) > 0);
        if (!wantsCommand) continue;
        // A placeholder where the command belongs, as in "sherlock <command> --help".
        if (!/^[a-z][a-z-]*$/.test(word)) {
            if (command.length === 0) return { command: [], flags: [] };
            continue;
        }
        command.push(word);
    }
    return { command, flags };
}

/** Flags written on their own in inline code, such as `--password-env VAR` */
function inlineFlags(markdown: string): string[] {
    return codeOf(markdown).inline
        .map((span) => /^(--?[A-Za-z][\w-]*)/.exec(span)?.[1])
        .filter((flag): flag is string => flag !== undefined);
}

// ---------------------------------------------------------------------------

describe('guideText', () => {
    it('prints the main guide by default, with the version and the other topics', () => {
        const text = guideText(undefined, '9.9.9');
        expect(text.startsWith('<!-- sherlock 9.9.9 -->\n# Sherlock: agent guide')).toBe(true);
        expect(text).toContain('- `sherlock guide transfer`: moving connections');
    });

    it('prints a topic, pointing back to the main guide', () => {
        expect(guideText('transfer', '1.0.0')).toContain('# Moving Connections to Another Machine');
        expect(guideText('transfer', '1.0.0')).toContain('- `sherlock guide`: querying');
    });

    it('lists the topics when one does not exist', () => {
        expect(() => guideText('nope', '1.0.0')).toThrow(/No guide topic "nope". Topics: main .*, transfer/);
    });

    it('does not treat inherited object keys as topics', () => {
        expect(() => guideText('constructor', '1.0.0')).toThrow(/No guide topic "constructor"/);
        expect(() => guideText('toString', '1.0.0')).toThrow(/No guide topic "toString"/);
    });
});

describe('reading the CLI', () => {
    it('finds the commands, the groups and their flags', () => {
        expect(COMMANDS.has('query')).toBe(true);
        expect(COMMANDS.get('query')!.flags).toContain('--timeout');
        expect(COMMANDS.get('tunnel')!.subcommands.has('stop')).toBe(true);
        expect(GLOBAL_FLAGS).toContain('-c');
        // Hidden commands are not listed, so the guide cannot rely on them.
        expect(COMMANDS.has('connections')).toBe(false);
    });

    it('reads a sherlock command out of the transfer guide\'s placeholders and ssh quotes', () => {
        const uses = invocations("```bash\nssh <host> '<remote-sherlock> -c <conn> tables'\n<local-sherlock> config import --help\n```").map(parse);
        expect(uses).toEqual([
            { command: ['tables'], flags: [] },
            { command: ['config', 'import'], flags: ['--help'] },
        ]);
    });

    it('reads an optional flag out of a usage line', () => {
        expect(invocations('```\nsherlock config export [conn] [-o file] [--force]\n```').map(parse)).toEqual([
            { command: ['config', 'export'], flags: ['-o', '--force'] },
        ]);
    });
});

// The guide ships inside the binary so that it cannot describe commands the
// binary lacks. This keeps it that way: every command and flag it shows must
// exist in this build, matched as whole names.
describe('the guide matches the CLI', () => {
    for (const [topic, { text }] of Object.entries(GUIDE_TOPICS)) {
        const uses = invocations(text).map(parse).filter((use) => use.command.length > 0);

        it(`${topic}: shows at least one command`, () => {
            expect(uses.length).toBeGreaterThan(0);
        });

        const byCommand = new Map<string, Set<string>>();
        for (const { command, flags } of uses) {
            const key = command.join(' ');
            const set = byCommand.get(key) ?? new Set<string>();
            flags.forEach((flag) => set.add(flag));
            byCommand.set(key, set);
        }

        for (const [key, flags] of byCommand) {
            it(`${topic}: \`sherlock ${key}\` exists with ${flags.size ? [...flags].join(', ') : 'no flags'}`, () => {
                const [name, sub] = key.split(' ');
                const top = COMMANDS.get(name);
                expect(top, `no command "${name}"`).toBeDefined();
                const command = sub === undefined ? top! : top!.subcommands.get(sub);
                expect(command, `no command "${key}"`).toBeDefined();
                if (top!.subcommands.size > 0) {
                    expect(sub, `"${name}" needs a subcommand`).toBeDefined();
                }

                for (const flag of flags) {
                    if (flag === '--help' || flag === '-h') continue;
                    expect(
                        command!.flags.has(flag) || GLOBAL_FLAGS.has(flag),
                        `"sherlock ${key}" has no flag ${flag}`
                    ).toBe(true);
                }
            });
        }

        it(`${topic}: every flag named on its own exists somewhere in the CLI`, () => {
            const missing = inlineFlags(text).filter((flag) => !ALL_FLAGS.has(flag) && !EXTERNAL_FLAGS.has(flag));
            expect(missing).toEqual([]);
        });
    }
});
