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

import main from './agent.md' with { type: 'text' };
import transfer from './transfer.md' with { type: 'text' };

/** Guide topics, by the name `sherlock guide <topic>` takes */
export const GUIDE_TOPICS = {
    main: { text: main, summary: 'querying, connection setup, tunnels, doctor and the read-only rules' },
    transfer: { text: transfer, summary: 'moving connections, passwords included, to another machine' },
} as const;

export type GuideTopic = keyof typeof GUIDE_TOPICS;

/** The guide for a topic, or the main guide. Throws for an unknown topic. */
export function guideText(topic: string | undefined, version: string): string {
    const name = (topic ?? 'main') as GuideTopic;
    const entry = GUIDE_TOPICS[name];
    if (!entry) {
        throw new Error(
            `No guide topic "${topic}". Topics: ` +
            Object.entries(GUIDE_TOPICS).map(([key, value]) => `${key} (${value.summary})`).join(', ') + '.'
        );
    }

    const others = Object.entries(GUIDE_TOPICS)
        .filter(([key]) => key !== name)
        .map(([key, value]) => `- \`sherlock guide ${key === 'main' ? '' : key}\`${key === 'main' ? '' : ''}: ${value.summary}`.replace('`sherlock guide `', '`sherlock guide`'));

    return `<!-- sherlock ${version} -->\n${entry.text.trimEnd()}\n\n## Other guide topics\n\n${others.join('\n')}\n`;
}
