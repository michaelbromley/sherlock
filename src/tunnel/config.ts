/**
 * Parsing and validation of the `tunnel` block in a connection config.
 */

import type { TunnelConfig } from './types';

/** Shut the tunnel down after this long with no queries */
export const DEFAULT_IDLE_TIMEOUT = '10m';

/** How long to wait for the forwarded port to start accepting connections */
export const DEFAULT_READY_TIMEOUT = '30s';

/** Refuse absurd idle timeouts so a typo can't leave a tunnel up for a week */
const MAX_IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

/**
 * Matches the endpoint line printed by `northflank forward --skipHostnames`:
 *   > Addon 'pg' is exposed on 127.0.0.1:44109 (TCP)
 *
 * Offered as the default in the setup wizard, since northflank is the tool most
 * likely to need endpoint discovery.
 */
export const NORTHFLANK_ENDPOINT_PATTERN = 'exposed on (?<host>[\\d.]+):(?<port>\\d+)';

/** The placeholder replaced with the allocated local port */
const PORT_PLACEHOLDER = '{{port}}';

/**
 * Parse a duration like "30s", "10m" or "2h" into milliseconds.
 *
 * A bare number is rejected on purpose: "30" reads as seconds to some people
 * and milliseconds to others, and picking either silently would give one group
 * a tunnel that dies mid-query.
 */
export function parseDuration(value: string): number {
    const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(value.trim());
    if (!match) {
        throw new Error(
            `Invalid duration "${value}". Use a number with a unit, e.g. "30s", "10m", "2h".`
        );
    }

    const amount = parseFloat(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
    const ms = amount * multipliers[unit];

    if (ms <= 0) {
        throw new Error(`Invalid duration "${value}": must be greater than zero.`);
    }

    return ms;
}

/** A tunnel config with defaults filled in and durations resolved to milliseconds */
export interface ResolvedTunnelConfig {
    command: string;
    localPort?: number;
    /** Compiled `endpointPattern`, when the endpoint is discovered from output */
    endpointPattern?: RegExp;
    idleTimeoutMs: number;
    readyTimeoutMs: number;
}

/** A local endpoint read out of a forwarding command's output */
export interface DiscoveredEndpoint {
    host: string;
    port: number;
}

/**
 * Read the local endpoint out of a forwarding command's output.
 * Returns null until the output contains a match.
 */
export function matchEndpoint(pattern: RegExp, output: string): DiscoveredEndpoint | null {
    const match = pattern.exec(output);
    if (!match?.groups) return null;

    const port = Number(match.groups.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

    return { host: match.groups.host || '127.0.0.1', port };
}

/**
 * Compile an endpointPattern, rejecting one that could never yield an endpoint.
 */
function compileEndpointPattern(pattern: string, where: string): RegExp {
    let compiled: RegExp;
    try {
        compiled = new RegExp(pattern);
    } catch (error) {
        throw new Error(
            `Invalid ${where}: "endpointPattern" is not a valid regular expression ` +
            `(${error instanceof Error ? error.message : String(error)}).`
        );
    }

    if (!pattern.includes('(?<port>')) {
        throw new Error(
            `Invalid ${where}: "endpointPattern" must contain a named "port" group, ` +
            `e.g. "exposed on (?<host>[\\\\d.]+):(?<port>\\\\d+)".`
        );
    }

    return compiled;
}

/**
 * Validate a raw tunnel config and fill in defaults. Throws with a message
 * naming the connection so config mistakes are traceable.
 */
export function resolveTunnelConfig(
    connectionName: string,
    tunnel: TunnelConfig
): ResolvedTunnelConfig {
    const where = `tunnel config for connection "${connectionName}"`;

    if (typeof tunnel.command !== 'string' || tunnel.command.trim() === '') {
        throw new Error(`Invalid ${where}: "command" is required and must be a non-empty string.`);
    }

    // A tunnel either dictates its endpoint (localPort or {{port}}) or discovers
    // it from the command's output. Doing both would mean two different answers
    // to the same question.
    const discovers = tunnel.endpointPattern !== undefined;
    let endpointPattern: RegExp | undefined;

    if (discovers) {
        if (tunnel.localPort !== undefined) {
            throw new Error(
                `Invalid ${where}: "endpointPattern" and "localPort" cannot both be set. ` +
                `Use "endpointPattern" when the forwarding tool chooses the port itself.`
            );
        }
        if (hasPortPlaceholder(tunnel.command)) {
            throw new Error(
                `Invalid ${where}: the command uses "{{port}}" but "endpointPattern" is set. ` +
                `Use "{{port}}" when sherlock chooses the port, "endpointPattern" when the tool does.`
            );
        }
        endpointPattern = compileEndpointPattern(tunnel.endpointPattern as string, where);
    } else if (tunnel.localPort !== undefined) {
        const port = tunnel.localPort;
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error(`Invalid ${where}: "localPort" must be an integer between 1 and 65535.`);
        }
    } else if (!hasPortPlaceholder(tunnel.command)) {
        // Without a fixed port sherlock picks one at random, and the command has
        // no way to learn it, so it would bind somewhere sherlock never checks.
        throw new Error(
            `Invalid ${where}: the command must include "{{port}}" so sherlock can tell it which ` +
            `local port to bind, set "localPort" to a fixed port, or set "endpointPattern" to read ` +
            `the endpoint from the command's own output.`
        );
    }

    let idleTimeoutMs: number;
    let readyTimeoutMs: number;
    try {
        idleTimeoutMs = parseDuration(tunnel.idleTimeout ?? DEFAULT_IDLE_TIMEOUT);
        readyTimeoutMs = parseDuration(tunnel.readyTimeout ?? DEFAULT_READY_TIMEOUT);
    } catch (error) {
        throw new Error(`Invalid ${where}: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (idleTimeoutMs > MAX_IDLE_TIMEOUT_MS) {
        throw new Error(`Invalid ${where}: "idleTimeout" cannot exceed 24h.`);
    }

    return {
        command: tunnel.command.trim(),
        localPort: tunnel.localPort,
        endpointPattern,
        idleTimeoutMs,
        readyTimeoutMs,
    };
}

/** Substitute the allocated local port into the tunnel command */
export function applyPortPlaceholder(command: string, port: number): string {
    return command.split(PORT_PLACEHOLDER).join(String(port));
}

/** Whether the command references `{{port}}` at all */
export function hasPortPlaceholder(command: string): boolean {
    return command.includes(PORT_PLACEHOLDER);
}
