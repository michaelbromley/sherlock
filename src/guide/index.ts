/**
 * The agent guide: how an AI agent should use sherlock, printed by
 * `sherlock guide`.
 *
 * The guide is built into the binary so it always describes the version that
 * prints it. The agent skill is installed separately and can be older or newer
 * than the binary, so it carries only what an agent needs before it can run
 * sherlock at all, and points here for the rest.
 */

/// <reference path="./text-modules.d.ts" />

import { usageError } from '../errors';
import { CONTRACT_PLACEHOLDER, contractReference } from './contract';
import { isPrerelease } from '../feedback';

/**
 * In a pre-release only: ask agents to record anything that got in their way,
 * so it can be fixed before the release.
 */
function prereleaseSection(version: string): string {
    return `## Pre-release: record problems

This is a pre-release of sherlock (${version}). Whenever sherlock gets in your way, record it with \`sherlock feedback\`:

- an error you didn't expect, or an \`INTERNAL\` error;
- output that was wrong, confusing, or missing something you needed;
- a command or flag you looked for and didn't find;
- a workaround you had to use.

Give a one-line summary, then what you ran, what happened and what you expected:

\`\`\`bash
sherlock feedback "introspect fails on a connection name with a hyphen" --details - <<'EOF'
Ran: sherlock -c corner-shop introspect
Got: {"ok":false,"error":{"code":"INTERNAL",...}}
Expected: the schema. tables and query work on the same connection.
EOF
\`\`\`

Record it when it happens, and carry on with the user's task. Leave out passwords and data from the database. Mention once per session that you recorded feedback, and where: the command returns the file.`;
}
import main from './agent.md' with { type: 'text' };
import setup from './setup.md' with { type: 'text' };
import transfer from './transfer.md' with { type: 'text' };

/** Guide topics, by the name `sherlock guide <topic>` takes */
export const GUIDE_TOPICS = {
    main: {
        text: main.replace(CONTRACT_PLACEHOLDER, contractReference()),
        summary: 'the output and error codes, querying, and the read-only rules',
    },
    setup: {
        text: setup,
        summary: "setting up a connection: the project's database URL, a password the user types, SSL, tunnels and doctor",
    },
    transfer: { text: transfer, summary: 'moving connections, passwords included, to another machine' },
} as const;

export type GuideTopic = keyof typeof GUIDE_TOPICS;

/** The guide for a topic, or the main guide. Throws for an unknown topic. */
export function guideText(topic: string | undefined, version: string): string {
    const name = (topic ?? 'main') as GuideTopic;
    // hasOwn, so that "constructor" and other inherited keys are not topics.
    if (!Object.hasOwn(GUIDE_TOPICS, name)) {
        throw usageError(
            `No guide topic "${topic}". Topics: ` +
            Object.entries(GUIDE_TOPICS).map(([key, value]) => `${key} (${value.summary})`).join(', ') + '.'
        );
    }
    const entry = GUIDE_TOPICS[name];

    const others = Object.entries(GUIDE_TOPICS)
        .filter(([key]) => key !== name)
        .map(([key, value]) => `- \`${key === 'main' ? 'sherlock guide' : `sherlock guide ${key}`}\`: ${value.summary}`);

    const prerelease = name === 'main' && isPrerelease(version) ? `\n\n${prereleaseSection(version)}` : '';
    return `<!-- sherlock ${version} -->\n${entry.text.trimEnd()}${prerelease}\n\n## Other guide topics\n\n${others.join('\n')}\n`;
}
