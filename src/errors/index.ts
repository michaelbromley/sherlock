/**
 * The one error type sherlock reports failures with.
 *
 * A SherlockError carries a stable `code` that callers branch on, a `message`
 * for people, a `fix` saying what to do next, and `details` holding the facts a
 * program needs. The top-level handler turns it, or any other error as
 * INTERNAL, into the response envelope and the exit code.
 */

import { ERROR_CODES, type ErrorCode } from './codes';

export { ERROR_CODES, WARNING_CODES, type ErrorCode, type WarningCode, type QueryRefusedReason } from './codes';

/** Facts about a failure a program can act on. Never a secret. */
export type ErrorDetails = Record<string, unknown>;

export interface SherlockErrorOptions {
    /** What to do next, as a command where there is one */
    fix?: string;
    details?: ErrorDetails;
    /** The error this one explains, kept for debugging; never printed in the envelope */
    cause?: unknown;
}

export class SherlockError extends Error {
    readonly code: ErrorCode;
    readonly fix?: string;
    readonly details?: ErrorDetails;

    constructor(code: ErrorCode, message: string, options: SherlockErrorOptions = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'SherlockError';
        this.code = code;
        if (options.fix !== undefined) this.fix = options.fix;
        if (options.details !== undefined && Object.keys(options.details).length > 0) {
            this.details = options.details;
        }
    }
}

/** A malformed command line. Exits 2 rather than 1. */
export function usageError(message: string, flag?: string, fix?: string): SherlockError {
    return new SherlockError('USAGE', message, { fix, details: flag ? { flag } : undefined });
}

export function isSherlockError(error: unknown): error is SherlockError {
    return error instanceof SherlockError;
}

/** The `error` member of a failed envelope */
export interface ErrorBody {
    code: ErrorCode;
    message: string;
    fix?: string;
    details?: ErrorDetails;
}

/** The envelope's error for any thrown value; anything unclassified is INTERNAL */
export function toErrorBody(error: unknown): ErrorBody {
    if (isSherlockError(error)) {
        return {
            code: error.code,
            message: error.message,
            ...(error.fix !== undefined && { fix: error.fix }),
            ...(error.details !== undefined && { details: error.details }),
        };
    }
    return {
        code: 'INTERNAL',
        message: error instanceof Error ? error.message : String(error),
        fix: 'This is likely a bug in sherlock. Run again with DEBUG=1 for a stack trace, and report it.',
    };
}

/** The exit code for a failure: 2 for a usage error, 1 for anything else */
export function exitCodeFor(error: ErrorBody): 1 | 2 {
    return error.code === 'USAGE' ? 2 : 1;
}

/** The message of any thrown value */
export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Whether a string is a known error code, for codes read back from a file */
export function isErrorCode(value: unknown): value is ErrorCode {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ERROR_CODES, value);
}
