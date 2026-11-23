/**
 * Warnings: things that did not stop a command, but that its caller should
 * know about, such as a plaintext password.
 *
 * Code that finds one is given a sink to add it to rather than printing it.
 * The CLI passes a collector, whose warnings end up in the envelope's
 * `warnings`; callers that pass nothing, such as the interactive wizard, get
 * the old behaviour of a line on stderr.
 */

import type { ErrorDetails, WarningCode } from '../errors';

export interface SherlockWarning {
    code: WarningCode;
    message: string;
    fix?: string;
    details?: ErrorDetails;
}

export interface WarningSink {
    add(warning: SherlockWarning): void;
}

/** Gathers warnings for the envelope, each one once */
export class WarningCollector implements WarningSink {
    private readonly seen = new Set<string>();
    readonly list: SherlockWarning[] = [];

    add(warning: SherlockWarning): void {
        // Config is read more than once in a command, and would warn each time.
        const key = `${warning.code}\0${warning.message}`;
        if (this.seen.has(key)) return;
        this.seen.add(key);
        this.list.push(warning);
    }
}

/** A sink that prints each warning to stderr, for people */
export const stderrWarnings: WarningSink = {
    add(warning) {
        printWarning(warning);
    },
};

/** One warning as a line or two on stderr, coloured only on a terminal */
export function printWarning(warning: SherlockWarning): void {
    const text = `Warning: ${warning.message}${warning.fix ? `\n  ${warning.fix}` : ''}`;
    process.stderr.write(process.stderr.isTTY ? `\x1b[33m${text}\x1b[0m\n` : `${text}\n`);
}
