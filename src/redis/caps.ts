/**
 * The caps on a Redis result. Redis results are not tables, so each is cut by
 * its own unit: `keys` by keys, `get` by the items of a list, set or hash,
 * `slowlog` by entries, `info` by sections. Every string is held to the cell
 * cap, and the byte cap drops units from the end until the result fits.
 */

import { binaryLength, CUT_MARK, type Caps } from '../db/result';
import type { SherlockWarning } from '../output/warnings';

/** What a Redis result left out */
export interface RedisTruncation {
    /** Units exist past the last one returned */
    moreItems: boolean;
    /** Strings shortened, or binary values replaced by their size */
    cellsCut: number;
    /** The size cap, when it dropped units */
    bytesLimit?: number;
    /** For info: the sections left out */
    sectionsOmitted?: string[];
}

export interface CapOptions {
    /**
     * Where the units are: the key of a list or object in the result, or "."
     * when the result's own keys are the units (info's sections).
     */
    units?: string;
    /** How many units there are in all, when more exist than were read */
    total?: number;
}

/** Hold a Redis result to the caps. Returns it with `truncated`, and a warning when anything was cut. */
export function capRedisResult<T extends object>(
    data: T,
    caps: Caps,
    options: CapOptions = {}
): { data: T & { truncated: RedisTruncation | false }; warnings: SherlockWarning[] } {
    let cellsCut = 0;
    const cut = (value: unknown): unknown => {
        if (typeof value === 'string') {
            if (value.length <= caps.maxCellChars) return value;
            cellsCut += 1;
            return value.slice(0, caps.maxCellChars) + CUT_MARK;
        }
        const bytes = binaryLength(value);
        if (bytes !== null) {
            cellsCut += 1;
            return { $bytes: bytes };
        }
        if (typeof value === 'bigint') return value.toString();
        if (Array.isArray(value)) return value.map(cut);
        if (value !== null && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cut(item)]));
        }
        return value;
    };
    const result = cut(data) as Record<string, unknown>;

    const container = options.units === '.' ? result : options.units ? result[options.units] : undefined;
    const count = (): number => Array.isArray(container) ? container.length
        : container && typeof container === 'object' ? Object.keys(container).length : 0;
    let moreItems = options.total !== undefined && options.total > count();

    let bytesLimit: number | undefined;
    const omitted: string[] = [];
    if (Number.isFinite(caps.maxBytes) && container && typeof container === 'object') {
        const size = () => Buffer.byteLength(JSON.stringify(result)) + 80; // room for `truncated`
        while (size() > caps.maxBytes && count() > 0) {
            if (Array.isArray(container)) container.pop();
            else {
                const keys = Object.keys(container);
                const last = keys[keys.length - 1];
                if (options.units === '.') omitted.unshift(last);
                delete (container as Record<string, unknown>)[last];
            }
            bytesLimit = caps.maxBytes;
            moreItems = true;
        }
    }

    const truncated: RedisTruncation | false = moreItems || cellsCut > 0
        ? {
            moreItems,
            cellsCut,
            ...(bytesLimit !== undefined && { bytesLimit }),
            ...(omitted.length > 0 && { sectionsOmitted: omitted }),
        }
        : false;

    const warnings: SherlockWarning[] = [];
    if (truncated) {
        const returned = count();
        const parts: string[] = [];
        if (omitted.length > 0) parts.push(`the sections ${omitted.join(', ')} were left out to fit in ${bytesLimit} bytes`);
        else if (moreItems) parts.push(bytesLimit !== undefined ? `only the first ${returned} items fit in ${bytesLimit} bytes` : `only the first ${returned} items are returned`);
        if (cellsCut > 0) parts.push(`${cellsCut} ${cellsCut === 1 ? 'value was' : 'values were'} shortened`);
        warnings.push({
            code: 'RESULT_TRUNCATED',
            message: `The result was cut: ${parts.join(', and ')}.`,
            fix: 'Raise --limit for more items, or --max-cell or --max-bytes; --no-limit removes the caps.',
            details: {
                rowsReturned: returned,
                moreRows: moreItems,
                cellsCut,
                ...(bytesLimit !== undefined && { bytesLimit }),
            },
        });
    }

    return { data: { ...(result as T), truncated }, warnings };
}
