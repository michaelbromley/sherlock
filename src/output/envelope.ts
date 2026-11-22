/**
 * The response envelope: the one JSON object every command prints on stdout.
 *
 *   { ok, data?, error?, warnings, meta }
 *
 * `ok` and the exit code never disagree: 0 when ok, 1 when not, 2 for a usage
 * error. The envelope is printed compact, on one line, success or failure, and
 * nothing else goes to stdout.
 */

import { exitCodeFor, toErrorBody, type ErrorBody } from '../errors';
import { WarningCollector, type SherlockWarning } from './warnings';
import pkg from '../../package.json';

/** The version of this contract. Changes only when the envelope itself does. */
export const CONTRACT_VERSION = 2;

export interface Meta {
    contract: typeof CONTRACT_VERSION;
    /** The command as typed, e.g. "query" or "connection add" */
    command: string;
    connection?: string;
    dbType?: string;
    durationMs: number;
    version: string;
}

export interface Envelope<T = unknown> {
    ok: boolean;
    data?: T;
    error?: ErrorBody;
    warnings: SherlockWarning[];
    meta: Meta;
}

/**
 * What is known about the running command, filled in as it goes: which
 * command it is, the connection once resolved, and the warnings met on the way.
 */
export class Invocation {
    command = '';
    connection?: string;
    dbType?: string;
    readonly warnings = new WarningCollector();
    private readonly startedAt = performance.now();

    meta(): Meta {
        return {
            contract: CONTRACT_VERSION,
            command: this.command,
            ...(this.connection !== undefined && { connection: this.connection }),
            ...(this.dbType !== undefined && { dbType: this.dbType }),
            durationMs: Math.round(performance.now() - this.startedAt),
            version: pkg.version,
        };
    }

    succeed<T>(data: T): Envelope<T> {
        return { ok: true, data, warnings: this.warnings.list, meta: this.meta() };
    }

    /**
     * A failed envelope. A command whose result is a report (doctor, tunnel
     * stop, keychain list) passes the report as `data`, so it is still filled.
     */
    fail<T>(error: unknown, data?: T): Envelope<T> {
        return {
            ok: false,
            ...(data !== undefined && { data }),
            error: toErrorBody(error),
            warnings: this.warnings.list,
            meta: this.meta(),
        };
    }
}

/** Print an envelope on stdout as one compact line, and return its exit code */
export function printEnvelope(envelope: Envelope): 0 | 1 | 2 {
    process.stdout.write(JSON.stringify(envelope) + '\n');
    if (envelope.ok) return 0;
    const error = envelope.error!;
    // stderr is for people: a one-line summary of what went wrong.
    process.stderr.write(`error ${error.code}: ${error.message}\n`);
    return exitCodeFor(error);
}
