/**
 * The part of the Northflank API this provider uses, behind a narrow interface.
 *
 * Everything that touches `@northflank/js-client` is in this file. The rest of
 * the provider depends only on `NorthflankClient`, which is what tests replace.
 * The client library is loaded on first use, so commands that never open a
 * Northflank tunnel do not pay for it.
 */

import type { NorthflankContext } from './context';
import type { ForwardedPort } from './endpoint';

/** What a client is bound to: one addon, as seen by one login */
export interface NorthflankTargetRef {
    project: string;
    addon: string;
    team?: string;
}

export interface NorthflankProjectInfo {
    id: string;
    name: string;
}

export interface NorthflankAddonInfo {
    id: string;
    name: string;
    /** e.g. "running", "paused" */
    status: string;
    /** e.g. "postgresql", "mysql", "redis" */
    type: string;
    replicas?: number;
    tlsEnabled?: boolean;
}

/** An API call that was answered with an error status */
export class NorthflankApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'NorthflankApiError';
    }
}

export interface NorthflankClient {
    getProject(): Promise<NorthflankProjectInfo>;
    getAddon(): Promise<NorthflankAddonInfo>;
    /** Open a local port for every port of every instance of the addon */
    forwardAddon(): Promise<ForwardedPort[]>;
    /** Be told when a forward stops, e.g. because the addon restarted */
    onForwardClosed(listener: (forward: Pick<ForwardedPort, 'address' | 'port'>) => void): void;
    /** Close every forward this client opened */
    stop(): Promise<void>;
}

export type NorthflankClientFactory = (
    context: NorthflankContext,
    target: NorthflankTargetRef
) => Promise<NorthflankClient>;

/** Pull an HTTP status out of whatever the client library threw */
function toApiError(error: unknown): Error {
    const status = (error as { status?: unknown } | null)?.status;
    const message = error instanceof Error ? error.message : String(error);
    if (typeof status === 'number') return new NorthflankApiError(message, status);

    // The port-forwarding calls throw a plain Error whose message is the JSON body.
    const embedded = /"status"\s*:\s*(\d{3})/.exec(message);
    if (embedded) return new NorthflankApiError(message, Number(embedded[1]));

    return error instanceof Error ? error : new Error(message);
}

/** The real client, backed by `@northflank/js-client` */
export const createNorthflankClient: NorthflankClientFactory = async (context, target) => {
    const { ApiClient, ApiClientInMemoryContextProvider } = await import('@northflank/js-client');

    // An in-memory provider holding only this context. The file-backed provider
    // is never constructed, so the CLI's config and its current context cannot
    // be read through it or written by it.
    const contextProvider = new ApiClientInMemoryContextProvider();
    contextProvider.addContext({
        name: context.name,
        token: context.token,
        host: context.host,
        ...(context.tokenScope ? { tokenScope: context.tokenScope } : {}),
        ...(context.team ? { team: context.team } : {}),
    });
    contextProvider.useContext(context.name);

    const api = new ApiClient(contextProvider, {
        throwErrorOnHttpErrorCode: true,
        customUserAgent: 'sherlock',
    });

    const parameters = {
        projectId: target.project,
        addonId: target.addon,
        ...(target.team ? { teamId: target.team } : {}),
    };

    return {
        async getProject() {
            try {
                const { data } = await api.get.project({
                    parameters: {
                        projectId: target.project,
                        ...(target.team ? { teamId: target.team } : {}),
                    },
                });
                return { id: data.id, name: data.name };
            } catch (error) {
                throw toApiError(error);
            }
        },

        async getAddon() {
            try {
                const { data } = await api.get.addon({ parameters });
                // `config` is a union with a templated form that has neither field.
                const config = data.spec.config as {
                    deployment?: { replicas?: number };
                    networking?: { tlsEnabled?: boolean };
                };
                return {
                    id: data.id,
                    name: data.name,
                    status: data.status,
                    type: data.spec.type,
                    replicas: config?.deployment?.replicas,
                    tlsEnabled: config?.networking?.tlsEnabled,
                };
            } catch (error) {
                throw toApiError(error);
            }
        },

        async forwardAddon() {
            let results;
            try {
                // ipOnly: bind loopback addresses and leave /etc/hosts alone, which
                // would need root that a background supervisor cannot ask for.
                results = await api.forwarding.forwardAddon(parameters, true);
            } catch (error) {
                throw toApiError(error);
            }

            const forwards: ForwardedPort[] = [];
            const errors: string[] = [];
            for (const result of results) {
                if (result.data) {
                    forwards.push({
                        address: result.data.address,
                        port: result.data.port,
                        hostnames: result.data.hostnames,
                        portName: result.data.portName,
                        portRemote: result.data.portRemote,
                        protocol: result.data.protocol,
                    });
                } else if (result.error) {
                    errors.push(result.error.message);
                }
            }
            if (forwards.length === 0 && errors.length > 0) {
                throw new Error(errors.join('; '));
            }
            return forwards;
        },

        onForwardClosed(listener) {
            api.forwarding.on('tunnel-close', (_tunnel, data) => {
                listener({ address: data.address, port: data.port });
            });
        },

        async stop() {
            await api.forwarding.stop();
        },
    };
};
