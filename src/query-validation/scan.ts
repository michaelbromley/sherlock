/**
 * Separating the code in a SQL statement from its string literals, quoted
 * identifiers and comments.
 *
 * The read-only guard looks for keywords such as DELETE. Looking in the raw
 * text rejects a harmless `WHERE label = 'delete'`, so the guard looks only at
 * what the database would execute as code. That makes this scanner part of a
 * security check: wherever a database could read some text as code, the scanner
 * must leave it as code too. Text is blanked only when the dialect is certain
 * to treat it as a literal, an identifier or a comment, and anything left
 * unterminated is an error rather than a guess.
 */

import { DB_TYPES, type DbType } from '../db-types';

/** How one database reads quotes and comments */
interface Dialect {
    /** Backslash escapes the next character inside '...' (MySQL) */
    backslashInStrings: boolean;
    /** E'...' strings, whose backslashes do escape (PostgreSQL) */
    escapeStrings: boolean;
    /** $tag$...$tag$ strings (PostgreSQL) */
    dollarQuotes: boolean;
    /** "..." is a string rather than an identifier (MySQL) */
    doubleQuotedStrings: boolean;
    /** `...` identifiers */
    backtickIdentifiers: boolean;
    /** [...] identifiers */
    bracketIdentifiers: boolean;
    /** # starts a comment */
    hashComments: boolean;
    /** -- starts a comment only when whitespace follows (MySQL) */
    dashCommentNeedsSpace: boolean;
    /** A /* inside a block comment opens another level */
    nestedComments: boolean;
}

const DIALECTS: Partial<Record<DbType, Dialect>> = {
    [DB_TYPES.POSTGRES]: {
        backslashInStrings: false, escapeStrings: true, dollarQuotes: true,
        doubleQuotedStrings: false, backtickIdentifiers: false, bracketIdentifiers: false,
        hashComments: false, dashCommentNeedsSpace: false, nestedComments: true,
    },
    [DB_TYPES.MYSQL]: {
        backslashInStrings: true, escapeStrings: false, dollarQuotes: false,
        doubleQuotedStrings: true, backtickIdentifiers: true, bracketIdentifiers: false,
        hashComments: true, dashCommentNeedsSpace: true, nestedComments: false,
    },
    [DB_TYPES.MSSQL]: {
        backslashInStrings: false, escapeStrings: false, dollarQuotes: false,
        doubleQuotedStrings: false, backtickIdentifiers: false, bracketIdentifiers: true,
        hashComments: false, dashCommentNeedsSpace: false, nestedComments: true,
    },
    [DB_TYPES.SQLITE]: {
        backslashInStrings: false, escapeStrings: false, dollarQuotes: false,
        doubleQuotedStrings: false, backtickIdentifiers: true, bracketIdentifiers: true,
        hashComments: false, dashCommentNeedsSpace: false, nestedComments: false,
    },
};

/** The SQL databases a statement may be meant for, when the caller cannot say */
export const SQL_DIALECTS = Object.keys(DIALECTS) as DbType[];

export type ScanResult =
    | { ok: true; code: string }
    | { ok: false; error: string };

/** What a string literal and a quoted identifier are replaced with in the code */
const STRING_PLACEHOLDER = "''";
const IDENTIFIER_PLACEHOLDER = '"_"';

const DOLLAR_TAG = /^\$([A-Za-z_\u0080-￿][\w\u0080-￿]*)?\$/;
const WORD_CHAR = /[\w$\u0080-￿]/;

/**
 * Find the end of a quoted run that starts at `start` (the opening quote).
 * A doubled closing quote stands for one quote character and does not end it.
 * Returns the index just past the closing quote, or -1 when it never closes.
 */
function endOfQuoted(sql: string, start: number, close: string, backslashEscapes: boolean): number {
    let i = start + 1;
    while (i < sql.length) {
        const char = sql[i];
        if (backslashEscapes && char === '\\') {
            i += 2;
        } else if (char === close) {
            if (sql[i + 1] === close) i += 2;
            else return i + 1;
        } else {
            i += 1;
        }
    }
    return -1;
}

/** Index just past the end of a block comment starting at `start`, or -1 */
function endOfBlockComment(sql: string, start: number, nested: boolean): number {
    let depth = 1;
    let i = start + 2;
    while (i < sql.length) {
        if (nested && sql.startsWith('/*', i)) {
            depth += 1;
            i += 2;
        } else if (sql.startsWith('*/', i)) {
            depth -= 1;
            i += 2;
            if (depth === 0) return i;
        } else {
            i += 1;
        }
    }
    return -1;
}

/**
 * Reduce a statement to the code a database of this type would execute:
 * literals and quoted identifiers become placeholders, comments become spaces.
 */
export function scanSql(sql: string, dbType: DbType): ScanResult {
    const dialect = DIALECTS[dbType];
    if (!dialect) return { ok: false, error: `${dbType} is not a SQL database` };

    let code = '';
    let i = 0;

    while (i < sql.length) {
        const char = sql[i];
        const next = sql[i + 1];

        if (char === '-' && next === '-') {
            const after = sql[i + 2];
            if (!dialect.dashCommentNeedsSpace || after === undefined || /\s/.test(after)) {
                const end = sql.indexOf('\n', i);
                i = end === -1 ? sql.length : end;
                code += ' ';
                continue;
            }
        }

        if (char === '#' && dialect.hashComments) {
            const end = sql.indexOf('\n', i);
            i = end === -1 ? sql.length : end;
            code += ' ';
            continue;
        }

        if (char === '/' && next === '*') {
            // MySQL and MariaDB execute the contents of /*! ... */ and /*M! ... */.
            if (/^\/\*M?!/.test(sql.slice(i, i + 4))) {
                return { ok: false, error: 'Executable comments (/*! ... */) are not allowed' };
            }
            const end = endOfBlockComment(sql, i, dialect.nestedComments);
            if (end === -1) return { ok: false, error: 'Unterminated comment' };
            i = end;
            code += ' ';
            continue;
        }

        if (char === "'") {
            // E'...' is an escape string only when the E stands alone: in
            // `SOME'x'` the E is the end of an identifier.
            const previous = sql[i - 1];
            const isEscapeString =
                dialect.escapeStrings &&
                (previous === 'E' || previous === 'e') &&
                !(i >= 2 && WORD_CHAR.test(sql[i - 2]));
            const end = endOfQuoted(sql, i, "'", dialect.backslashInStrings || isEscapeString);
            if (end === -1) return { ok: false, error: 'Unterminated string literal' };
            i = end;
            code += STRING_PLACEHOLDER;
            continue;
        }

        if (char === '"') {
            const end = endOfQuoted(sql, i, '"', dialect.doubleQuotedStrings && dialect.backslashInStrings);
            if (end === -1) return { ok: false, error: 'Unterminated quoted identifier' };
            i = end;
            code += dialect.doubleQuotedStrings ? STRING_PLACEHOLDER : IDENTIFIER_PLACEHOLDER;
            continue;
        }

        if (char === '`' && dialect.backtickIdentifiers) {
            const end = endOfQuoted(sql, i, '`', false);
            if (end === -1) return { ok: false, error: 'Unterminated quoted identifier' };
            i = end;
            code += IDENTIFIER_PLACEHOLDER;
            continue;
        }

        if (char === '[' && dialect.bracketIdentifiers) {
            const end = endOfQuoted(sql, i, ']', false);
            if (end === -1) return { ok: false, error: 'Unterminated quoted identifier' };
            i = end;
            code += IDENTIFIER_PLACEHOLDER;
            continue;
        }

        if (char === '$' && dialect.dollarQuotes && !(i > 0 && WORD_CHAR.test(sql[i - 1]))) {
            const tag = DOLLAR_TAG.exec(sql.slice(i, i + 80))?.[0];
            if (tag) {
                const close = sql.indexOf(tag, i + tag.length);
                if (close === -1) return { ok: false, error: 'Unterminated dollar-quoted string' };
                i = close + tag.length;
                code += STRING_PLACEHOLDER;
                continue;
            }
        }

        code += char;
        i += 1;
    }

    return { ok: true, code };
}
