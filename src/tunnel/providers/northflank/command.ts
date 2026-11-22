/**
 * The Northflank CLI used as a command tunnel.
 *
 * Before this provider existed, a Northflank connection was a command tunnel
 * running `northflank forward`, and configs written that way keep working. This
 * file holds what is known about that command: how to write it, how to read
 * the endpoint it prints, and how to recognise it so its target can be checked.
 */

import type { TunnelConfig } from '../../types';
import type { HostVerdict, TunnelInspection, TunnelShorthand } from '../types';
import { NORTHFLANK_PROVIDER_ID } from './config';

/**
 * Matches the endpoint line `northflank forward --skipHostnames` prints. The
 * wording has changed between CLI versions:
 *   > Addon 'pg' is exposed on 127.0.0.1:44109 (TCP)
 *   > Addon 'pg' is exposed locally on 127.0.0.1:44109 (TCP)
 */
export const NORTHFLANK_ENDPOINT_PATTERN = 'exposed (?:locally )?on (?<host>[\\d.]+):(?<port>\\d+)';

/** `--tunnel-northflank <project>/<addon>`: the forward command and its pattern */
export const northflankCommandShorthand: TunnelShorthand = {
    usage: '<project>/<addon>',
    endpointPattern: NORTHFLANK_ENDPOINT_PATTERN,
    expand(value: string): TunnelConfig {
        const [project, addon, ...rest] = value.split('/');
        if (!project || !addon || rest.length > 0) {
            throw new Error(`Use <project>/<addon>, e.g. cloud/control-plane-db.`);
        }
        return {
            // --skipHostnames avoids the /etc/hosts write that would otherwise need
            // root, which a background tunnel has no terminal to ask for.
            command: `northflank forward addon --project ${project} --addon ${addon} --skipHostnames`,
            endpointPattern: NORTHFLANK_ENDPOINT_PATTERN,
        };
    },
};

/** Addons are reachable inside Northflank under this domain */
const ADDON_HOST_SUFFIX = '.addon.code.run';

/**
 * Whether an addon hostname names this project and addon. Internal hostnames
 * look like `primary.<addon>--<project>--<suffix>.addon.code.run`, so both ids
 * appear as `--`-separated parts.
 */
export function checkNorthflankHost(host: string, project: string, addon: string): HostVerdict {
    const normalized = host.trim().toLowerCase();
    if (!normalized.endsWith(ADDON_HOST_SUFFIX)) {
        return {
            verdict: 'unknown',
            reason: `"${host}" is not a Northflank addon hostname, so it cannot be compared with the tunnel's target`,
        };
    }

    const parts = normalized
        .slice(0, -ADDON_HOST_SUFFIX.length)
        .split('.')
        .flatMap((label) => label.split('--'));

    if (parts.includes(project.toLowerCase()) && parts.includes(addon.toLowerCase())) {
        return { verdict: 'match', reason: `host ${host} belongs to ${project}/${addon}` };
    }
    return {
        verdict: 'mismatch',
        reason:
            `the tunnel forwards ${project}/${addon}, but the configured host ${host} ` +
            `belongs to a different project or addon`,
    };
}

/** Read the value of a `--flag value` or `--flag=value` option out of a command */
function readFlag(command: string, flag: string): string | undefined {
    const match = new RegExp(`--${flag}(?:Id)?(?:\\s+|=)(?:"([^"]+)"|'([^']+)'|(\\S+))`).exec(command);
    return match ? match[1] ?? match[2] ?? match[3] : undefined;
}

/** Recognise `northflank forward addon …` and report what it forwards */
export function recognizeNorthflankCommand(command: string): TunnelInspection | null {
    if (!/\bnorthflank\s+forward\s+addon\b/.test(command)) return null;

    const project = readFlag(command, 'project');
    const addon = readFlag(command, 'addon');
    if (!project || !addon) return null;

    return {
        target: {
            provider: NORTHFLANK_PROVIDER_ID,
            summary: `${project}/${addon} (northflank CLI)`,
            details: { project, addon },
        },
        checkHost: (host) => checkNorthflankHost(host, project, addon),
    };
}
