/**
 * Feedback from pre-release testing: problems an agent or a person met while
 * using sherlock, written to one file so they can be read back and fixed.
 *
 * In a pre-release, `sherlock guide` asks agents to record anything that got
 * in their way with `sherlock feedback`, and unexpected INTERNAL errors are
 * recorded on their own. Entries are appended to `feedback.md` in sherlock's
 * config directory, so every session on the machine writes to the same file.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ensureConfigDir, getConfigDir } from './config/paths';

/** Whether a version is a pre-release, such as 2.0.0-beta.2 */
export function isPrerelease(version: string): boolean {
    return /^\d+\.\d+\.\d+-/.test(version);
}

export function feedbackFile(): string {
    return path.join(getConfigDir(), 'feedback.md');
}

/** Longest details kept for one entry */
const MAX_DETAILS = 64 * 1024;

export interface FeedbackEntry {
    summary: string;
    details?: string;
    version: string;
    /** Who recorded it: an agent or person, or sherlock itself for an INTERNAL error */
    source: 'reported' | 'automatic';
}

/** Replace the password in any URL with ***, so a pasted error cannot leak one */
export function redactUrls(text: string): string {
    return text.replace(/([a-z][a-z0-9+.-]*:\/\/[^\s:/@]*):[^\s@/]+@/gi, '$1:***@');
}

/** Append one entry to the feedback file, and return the file's path */
export function recordFeedback(entry: FeedbackEntry, now: Date = new Date()): string {
    ensureConfigDir();
    const file = feedbackFile();
    const stamp = now.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
    const details = entry.details ? redactUrls(entry.details.trim().slice(0, MAX_DETAILS)) : undefined;
    const block = [
        `## ${stamp} · sherlock ${entry.version}${entry.source === 'automatic' ? ' · recorded automatically' : ''}`,
        '',
        `**${redactUrls(entry.summary.trim())}**`,
        '',
        `Directory: ${process.cwd()}`,
        ...(details ? ['', details] : []),
        '',
        '---',
        '',
    ].join('\n');
    const isNew = !fs.existsSync(file);
    fs.appendFileSync(file, (isNew ? '# Sherlock feedback\n\nProblems met while using pre-release versions of sherlock.\n\n---\n\n' : '') + block, { mode: 0o600 });
    return file;
}
