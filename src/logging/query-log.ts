/**
 * Query logging module
 * Logs queries and results to connection-specific log files
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLogsDir, ensureLogsDir } from '../config/paths';

/** Maximum rows to include in query logs (truncate larger results) */
const MAX_LOG_ROWS = 10;

/** Query result for logging purposes */
interface LoggableResult {
    rowCount?: number;
    rows?: unknown[];
    error?: string;
}

/**
 * Logs a query and its result to a connection-specific log file
 */
export function logQuery(connectionName: string, query: string, result: LoggableResult): void {
    ensureLogsDir();
    const logFile = path.join(getLogsDir(), `${connectionName}.md`);
    const timestamp = new Date().toISOString();

    // Truncate large result sets for logging
    let logResult = result;
    if (result && Array.isArray(result.rows) && result.rows.length > MAX_LOG_ROWS) {
        const omittedCount = result.rows.length - MAX_LOG_ROWS;
        logResult = {
            ...result,
            rows: [
                ...result.rows.slice(0, MAX_LOG_ROWS),
                `... ${omittedCount.toLocaleString()} ${omittedCount === 1 ? 'result' : 'results'} omitted ...`,
            ],
        };
    }

    const logEntry = `${timestamp}

\`\`\`sql
${query}
\`\`\`

\`\`\`json
${JSON.stringify(logResult, null, 2)}
\`\`\`

---

`;

    fs.appendFileSync(logFile, logEntry, 'utf-8');
}
