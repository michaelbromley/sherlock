/**
 * Choosing which of an addon's forwarded ports to connect to.
 *
 * Forwarding an addon opens a local port for every port of every instance, so
 * a replicated database comes back as several endpoints. Northflank does not
 * label them with a role: the only thing that tells the primary from a replica
 * is the internal hostname each one stands for.
 */

import type { EndpointRole } from './config';

/** One local port forwarding to one port of one addon instance */
export interface ForwardedPort {
    /** Local address the forward listens on */
    address: string;
    /** Local port the forward listens on */
    port: number;
    /** Internal hostnames this forward stands for */
    hostnames: string[];
    portName?: string;
    /** The port on the addon */
    portRemote?: number;
    protocol?: string;
}

/** A chosen forward, and the role it was chosen as */
export interface SelectedEndpoint {
    forward: ForwardedPort;
    role: EndpointRole;
}

/** The primary's internal hostname starts with this label */
const PRIMARY_LABEL = 'primary';

/** Whether a forward stands for the addon's primary, going by its hostname */
export function isPrimary(forward: ForwardedPort): boolean {
    return forward.hostnames.some((hostname) => {
        const firstLabel = hostname.split('.')[0].toLowerCase();
        return firstLabel === PRIMARY_LABEL || firstLabel.startsWith(`${PRIMARY_LABEL}-`);
    });
}

function describe(forward: ForwardedPort): string {
    const name = forward.portName ? `${forward.portName} ` : '';
    return `${name}${forward.portRemote ?? '?'} on ${forward.hostnames.join(', ') || 'unknown host'}`;
}

function matchesPort(forward: ForwardedPort, port: string | number): boolean {
    return typeof port === 'number' ? forward.portRemote === port : forward.portName === port;
}

/**
 * Pick the forward to connect to.
 *
 * With no role requested, a replica is preferred, since sherlock only reads.
 * A role that was asked for and is missing is an error rather than a silent
 * fall back to the other one: someone who asked for the replica to keep load
 * off the primary should not be given the primary.
 */
export function selectEndpoint(
    forwards: ForwardedPort[],
    requested: EndpointRole | undefined,
    port?: string | number
): SelectedEndpoint {
    const usable = forwards.filter((forward) => forward.protocol !== 'UDP');
    if (usable.length === 0) {
        throw new Error('The addon exposes no TCP port to forward.');
    }

    const wanted = port === undefined ? usable : usable.filter((forward) => matchesPort(forward, port));
    if (wanted.length === 0) {
        throw new Error(
            `The addon has no port ${typeof port === 'number' ? port : `named "${port}"`}. ` +
            `It exposes: ${usable.map(describe).join('; ')}.`
        );
    }

    const primaries = wanted.filter(isPrimary);
    const replicas = wanted.filter((forward) => !isPrimary(forward));
    // A single instance is the primary whatever its hostname says.
    const single = wanted.length === 1;

    let role: EndpointRole;
    let candidates: ForwardedPort[];

    if (requested === 'primary') {
        role = 'primary';
        candidates = single ? wanted : primaries;
        if (candidates.length === 0) {
            throw new Error(
                `Could not tell which endpoint is the primary. The addon exposes: ` +
                `${wanted.map(describe).join('; ')}.`
            );
        }
    } else if (requested === 'read') {
        role = 'read';
        candidates = single ? [] : replicas;
        if (candidates.length === 0) {
            throw new Error(
                'The tunnel asks for the "read" endpoint, but the addon has no read replica. ' +
                'Set "endpoint" to "primary", or leave it out.'
            );
        }
    } else if (!single && replicas.length > 0) {
        role = 'read';
        candidates = replicas;
    } else {
        role = 'primary';
        candidates = single ? wanted : primaries;
    }

    // Several replicas are interchangeable. Several ports on one instance are
    // not, and guessing between them could connect to the wrong service.
    const remotePorts = new Set(candidates.map((forward) => forward.portRemote));
    if (remotePorts.size > 1) {
        throw new Error(
            `The addon exposes several ports and the tunnel does not say which to use. ` +
            `Set "port" to a name or number. It exposes: ${candidates.map(describe).join('; ')}.`
        );
    }

    return { forward: candidates[0], role };
}
