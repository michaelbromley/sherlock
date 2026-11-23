/**
 * The guide's reference for the output contract: the envelope, the exit codes,
 * the caps, and every error and warning code with its `details` keys.
 *
 * Generated from the code table and the default caps rather than written by
 * hand, so the guide cannot list a code the CLI does not have, miss one it
 * does, or give a cap that is not the default.
 */

import { ERROR_CODES, WARNING_CODES, type CodeInfo } from '../errors/codes';
import { DEFAULT_CAPS } from '../db/result';
import { CONTRACT_VERSION } from '../output/envelope';

/** Where the generated reference goes in the main guide */
export const CONTRACT_PLACEHOLDER = '<!-- contract reference -->';

function codeTable(codes: Record<string, CodeInfo>): string {
    const rows = Object.entries(codes).map(([code, info]) =>
        `| \`${code}\` | ${info.meaning} | ${info.details.map((key) => `\`${key}\``).join(', ') || '-'} |`);
    return ['| Code | Meaning | `details` |', '| --- | --- | --- |', ...rows].join('\n');
}

export function contractReference(): string {
    return `## Output

Every command prints one JSON object on stdout, on one line, and nothing else. This is contract version ${CONTRACT_VERSION}:

\`\`\`json
{"ok": true, "data": {...}, "warnings": [], "meta": {"contract": ${CONTRACT_VERSION}, "command": "query", "connection": "prod", "dbType": "postgres", "durationMs": 41, "version": "..."}}
{"ok": false, "error": {"code": "TUNNEL_DOWN", "message": "...", "fix": "...", "details": {...}}, "warnings": [], "meta": {...}}
\`\`\`

- Check \`ok\`, then branch on \`error.code\`. The exit code agrees with \`ok\`: 0 when true, 1 when false, 2 for \`USAGE\`.
- \`error.message\` is for people and its wording may change. \`error.fix\` says what to do next, as a command where there is one: follow it, or tell the user.
- \`warnings\` lists things that did not stop the command, each with a \`code\`, a \`message\` and usually a \`fix\`. Read them: a cut result is reported there.
- \`doctor\`, \`tunnel stop\` and \`keychain list\` keep their report in \`data\` when \`ok\` is false.
- stderr is progress and a summary for people. Never parse it.
- \`--format human\` (\`-f human\`) prints tables and text instead, for showing to the user. Do not parse it.
- An unknown code is a new one: treat it as a failure and read \`message\`.

## Results

Rows come back with the column names once and each row as an array:

\`\`\`json
{"columns": [{"name": "id", "type": "int4"}, {"name": "email", "type": "text"}], "rows": [[1, "a@example.com"]], "rowCount": 1, "truncated": false}
\`\`\`

\`type\` is the database's own type name, when the driver reports it. \`query\`, \`sample\` and \`describe\` return a result as \`data\`; \`stats\`, \`fk\`, \`indexes\` and \`introspect\` return results inside their data.

Results are capped so one query cannot fill your context: ${DEFAULT_CAPS.maxRows} rows, ${DEFAULT_CAPS.maxCellChars} characters per cell, and ${DEFAULT_CAPS.maxBytes} bytes of JSON in all. A cut text cell ends with \`…\`, and a binary value becomes \`{"$bytes": <length>}\`. When anything is cut, \`truncated\` says what, and a \`RESULT_TRUNCATED\` warning says how to get the rest:

- narrow the query: fewer columns, a \`WHERE\`, a \`LIMIT\`;
- raise a cap: \`--max-rows\`, \`--max-cell\`, \`--max-bytes\` (or \`--no-limit\`);
- or write the whole result to a file with \`--out result.jsonl\` (or \`.csv\`), and look at it with \`head\`, \`jq\` or a script. The envelope then gives the file, the row count, the columns and the first 20 rows. A JSON Lines file starts with a \`{"columns": [...]}\` line, then one array per row.

\`sample -n\` sets its own row cap. Redis results are cut by their own units: keys, the items of a list, set or hash (\`--limit\`), slowlog entries, \`info\` sections.

## Error codes

${codeTable(ERROR_CODES)}

## Warning codes

${codeTable(WARNING_CODES)}`;
}
