import { describe, it, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import * as path from 'path';
import { GUIDE_TOPICS, guideText } from './index';

const CLI = path.join(import.meta.dir, '..', 'query-db.ts');

/** Commands that take a subcommand, so the subcommand is checked too */
const GROUPS = new Set(['connection', 'config', 'tunnel', 'keychain']);

/** Global options that take a value, skipped when finding the command */
const VALUE_OPTIONS = new Set(['-c', '--connection', '-u', '--url', '--config', '-f', '--format']);

/** Every `sherlock ...` invocation inside the guide's code spans and blocks */
function invocations(markdown: string): string[][] {
    const code = [
        ...[...markdown.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]),
        ...[...markdown.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g)].map((m) => m[1]),
    ].join('\n')
        // A trailing backslash continues the command on the next line.
        .replace(/\\\n\s*/g, ' ');

    const found: string[][] = [];
    for (const line of code.split('\n')) {
        // Quoted arguments are SQL, patterns or other commands, not sherlock flags.
        const unquoted = line.replace(/'[^']*'|"[^"]*"/g, 'ARG');
        for (const match of unquoted.matchAll(/(?:^|[\s|;&(])sherlock((?:[ \t]+[^\s|;&)<>#]+|[ \t]+<[^>]+>)+)/g)) {
            found.push(match[1].trim().split(/[ \t]+/));
        }
    }
    return found;
}

/** The command words and the flags of one invocation, skipping global options */
function parse(words: string[]): { command: string[]; flags: string[] } {
    const command: string[] = [];
    const flags: string[] = [];
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (VALUE_OPTIONS.has(word)) { i++; continue; }
        if (word.startsWith('-') && word !== '-') {
            if (command.length > 0) flags.push(word.split('=')[0]);
            continue;
        }
        const wantsCommand = command.length === 0 || (command.length === 1 && GROUPS.has(command[0]));
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

describe('guideText', () => {
    it('prints the main guide by default, with the version and the other topics', () => {
        const text = guideText(undefined, '9.9.9');
        expect(text.startsWith('<!-- sherlock 9.9.9 -->\n# Sherlock: agent guide')).toBe(true);
        expect(text).toContain('`sherlock guide transfer`');
    });

    it('prints a topic, pointing back to the main guide', () => {
        expect(guideText('transfer', '1.0.0')).toContain('# Moving Connections to Another Machine');
        expect(guideText('transfer', '1.0.0')).toContain('`sherlock guide`: querying');
    });

    it('lists the topics when one does not exist', () => {
        expect(() => guideText('nope', '1.0.0')).toThrow(/No guide topic "nope". Topics: main .*, transfer/);
    });
});

// The guide ships inside the binary so that it cannot describe commands the
// binary lacks. This keeps it that way: every command and flag it shows must
// exist in this build.
describe('the guide matches the CLI', () => {
    const helpCache = new Map<string, { ok: boolean; text: string }>();
    const help = (command: string[]) => {
        const key = command.join(' ');
        if (!helpCache.has(key)) {
            const result = spawnSync('bun', [CLI, ...command, '--help'], { encoding: 'utf-8' });
            helpCache.set(key, { ok: result.status === 0, text: result.stdout + result.stderr });
        }
        return helpCache.get(key)!;
    };

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

        for (const [command, flags] of byCommand) {
            it(`${topic}: \`sherlock ${command}\` exists with ${flags.size ? [...flags].join(', ') : 'no flags'}`, () => {
                // Commander prints the parent's help for an unknown command, so
                // check the parent lists it. Hidden commands are not listed,
                // which keeps the guide off them too.
                const words = command.split(' ');
                const parent = help(words.slice(0, -1));
                expect(parent.ok).toBe(true);
                expect(parent.text).toMatch(new RegExp(`\\n  ${words.at(-1)}\\b`));

                const result = help(words);
                expect(result.ok).toBe(true);
                if (GROUPS.has(command)) return;
                for (const flag of flags) {
                    if (flag === '--help') continue;
                    expect(result.text).toContain(flag);
                }
            }, 20_000);
        }
    }
});
