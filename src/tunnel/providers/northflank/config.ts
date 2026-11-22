/**
 * The `tunnel` block of a Northflank connection.
 */

import { tunnelConfigLabel } from '../../config';
import type { TunnelConfig } from '../../types';

export const NORTHFLANK_PROVIDER_ID = 'northflank';

/** Which of an addon's endpoints to forward */
export const ENDPOINT_ROLES = ['read', 'primary'] as const;
export type EndpointRole = typeof ENDPOINT_ROLES[number];

/** A validated Northflank tunnel block */
export interface NorthflankTunnelConfig {
    /** Name of a context in the Northflank CLI config. Its token is the login used. */
    context: string;
    /** Project id */
    project: string;
    /** Addon id */
    addon: string;
    /**
     * Endpoint to forward. Left out, the read replica is used when the addon
     * has one and the primary otherwise.
     */
    endpoint?: EndpointRole;
    /** Directory holding the CLI's config.json, when it is not the default */
    configDir?: string;
    /** Team id, for an organisation-scoped token whose context names no team */
    team?: string;
    /** Name or number of the addon port to forward, when it exposes several */
    port?: string | number;
}

/** Keys the block may contain: this provider's own, and the ones every tunnel has */
const KNOWN_KEYS = new Set([
    'provider', 'context', 'project', 'addon', 'endpoint', 'configDir', 'team', 'port',
    'idleTimeout', 'readyTimeout',
]);

/** Northflank ids are lowercase slugs. Anything else is a typo or a display name. */
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function requireString(tunnel: Record<string, unknown>, key: string, where: string): string {
    const value = tunnel[key];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Invalid ${where}: "${key}" is required and must be a non-empty string.`);
    }
    return value.trim();
}

function requireId(tunnel: Record<string, unknown>, key: string, where: string): string {
    const value = requireString(tunnel, key, where);
    if (!ID_PATTERN.test(value)) {
        throw new Error(
            `Invalid ${where}: "${key}" must be the ${key}'s id (lowercase letters, digits and ` +
            `hyphens, as it appears in the Northflank URL), not its display name. Got "${value}".`
        );
    }
    return value;
}

/** Validate a Northflank tunnel block. Throws with a message naming the connection. */
export function resolveNorthflankConfig(
    tunnel: TunnelConfig,
    connectionName: string
): NorthflankTunnelConfig {
    const where = tunnelConfigLabel(connectionName);
    const raw = tunnel as Record<string, unknown>;

    const unknown = Object.keys(raw).filter((key) => !KNOWN_KEYS.has(key));
    if (unknown.length > 0) {
        throw new Error(
            `Invalid ${where}: unknown ${unknown.length === 1 ? 'setting' : 'settings'} ` +
            `${unknown.map((key) => `"${key}"`).join(', ')} for the northflank provider. ` +
            `It accepts: context, project, addon, endpoint, port, team, configDir.`
        );
    }

    const config: NorthflankTunnelConfig = {
        context: requireString(raw, 'context', where),
        project: requireId(raw, 'project', where),
        addon: requireId(raw, 'addon', where),
    };

    if (raw.endpoint !== undefined) {
        if (!ENDPOINT_ROLES.includes(raw.endpoint as EndpointRole)) {
            throw new Error(
                `Invalid ${where}: "endpoint" must be "read" or "primary". Leave it out to use ` +
                `the read replica when the addon has one.`
            );
        }
        config.endpoint = raw.endpoint as EndpointRole;
    }
    if (raw.configDir !== undefined) config.configDir = requireString(raw, 'configDir', where);
    if (raw.team !== undefined) config.team = requireId(raw, 'team', where);
    if (raw.port !== undefined) {
        const port = raw.port;
        const validNumber = typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535;
        const validName = typeof port === 'string' && port.trim() !== '';
        if (!validNumber && !validName) {
            throw new Error(
                `Invalid ${where}: "port" must be the addon port's name or its number (1 to 65535).`
            );
        }
        config.port = typeof port === 'string' ? port.trim() : (port as number);
    }

    return config;
}

/** The target as "project/addon", with the endpoint when one was chosen */
export function describeNorthflankTarget(config: NorthflankTunnelConfig): string {
    const base = `${config.project}/${config.addon}`;
    return config.endpoint ? `${base} (${config.endpoint})` : base;
}
