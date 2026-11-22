/**
 * The tunnel provider registry.
 *
 * This is the only file that names individual providers. Everything else in
 * sherlock looks a provider up by the id in the `tunnel` block and talks to it
 * through `TunnelProvider`, so adding one means writing its module and adding
 * it to `PROVIDERS` below.
 *
 * Provider modules are imported eagerly so that validating a config stays
 * synchronous. A provider with a heavy dependency loads it lazily, inside
 * `open` or `diagnose`.
 */

import { resolveTunnelTimeouts, tunnelConfigLabel, type ResolvedTunnelTimeouts } from '../config';
import { isProviderTunnel, type TunnelConfig } from '../types';
import { commandProvider, COMMAND_PROVIDER_ID } from './command';
import { northflankProvider } from './northflank';
import type {
    DiagnoseContext,
    DiagnosticCheck,
    OpenTunnel,
    OpenTunnelContext,
    TunnelInspection,
    TunnelProvider,
    TunnelSetup,
    TunnelShorthand,
} from './types';

const PROVIDERS: readonly TunnelProvider[] = [commandProvider, northflankProvider];

/** Ids a `tunnel.provider` may name */
export function tunnelProviderIds(): string[] {
    return PROVIDERS.map((provider) => provider.id).filter((id) => id !== COMMAND_PROVIDER_ID);
}

/** The id of the provider a tunnel block selects */
export function tunnelProviderId(tunnel: TunnelConfig): string {
    return isProviderTunnel(tunnel) ? tunnel.provider : COMMAND_PROVIDER_ID;
}

function providerFor(tunnel: TunnelConfig, connectionName: string): TunnelProvider {
    const id = tunnelProviderId(tunnel);
    const provider = PROVIDERS.find((candidate) => candidate.id === id);
    if (!provider) {
        throw new Error(
            `Invalid ${tunnelConfigLabel(connectionName)}: unknown provider "${id}". ` +
            `Use one of: ${tunnelProviderIds().join(', ')}, or leave "provider" out and give a "command".`
        );
    }
    return provider;
}

/**
 * A validated tunnel, bound to the provider that opens it. The provider's own
 * config stays inside, so callers never see provider-specific fields.
 */
export interface ResolvedTunnel extends ResolvedTunnelTimeouts {
    providerId: string;
    inspect(): TunnelInspection;
    open(context: OpenTunnelContext): Promise<OpenTunnel>;
    /** Null when the provider has nothing it can check ahead of opening */
    diagnose: ((context: DiagnoseContext) => Promise<DiagnosticCheck[]>) | null;
}

/**
 * Validate a tunnel block with its provider and fill in defaults. Throws with a
 * message naming the connection so config mistakes are traceable.
 */
export function resolveTunnel(connectionName: string, tunnel: TunnelConfig): ResolvedTunnel {
    if (typeof tunnel !== 'object' || tunnel === null) {
        throw new Error(`Invalid ${tunnelConfigLabel(connectionName)}: it must be an object.`);
    }

    if (!isProviderTunnel(tunnel) && typeof (tunnel as { command?: unknown }).command !== 'string') {
        throw missingProviderError(tunnel, connectionName);
    }

    const provider = providerFor(tunnel, connectionName);
    const timeouts = resolveTunnelTimeouts(tunnel, tunnelConfigLabel(connectionName));
    const config = provider.resolve(tunnel, connectionName);
    const diagnose = provider.diagnose?.bind(provider);

    return {
        ...timeouts,
        providerId: provider.id,
        inspect: () => inspectWith(provider, config),
        open: (context) => provider.open(config, context),
        diagnose: diagnose ? (context) => diagnose(config, context) : null,
    };
}

/**
 * The error for a tunnel block with neither a command nor a provider. When its
 * settings are those of a provider, say which: the likely mistake is a
 * forgotten "provider".
 */
function missingProviderError(tunnel: TunnelConfig, connectionName: string): Error {
    const where = tunnelConfigLabel(connectionName);
    const keys = Object.keys(tunnel).filter((key) => !['idleTimeout', 'readyTimeout'].includes(key));
    const match = PROVIDERS.find((provider) => {
        const fields = provider.setup?.fields.map((field) => field.key) ?? [];
        return keys.length > 0 && keys.every((key) => fields.includes(key));
    });
    if (match) {
        return new Error(
            `Invalid ${where}: it has no "provider" or "command". Its settings are those of the ` +
            `${match.id} provider: did you mean to add "provider": "${match.id}"?`
        );
    }
    return new Error(
        `Invalid ${where}: give either "command" (a port-forwarding command) or "provider" ` +
        `(one of: ${tunnelProviderIds().join(', ')}).`
    );
}

/**
 * Describe a tunnel's target. A command tunnel is offered to every other
 * provider first, so that one which recognises its own CLI in the command can
 * describe and check the target better than "a shell command".
 */
function inspectWith(provider: TunnelProvider, config: unknown): TunnelInspection {
    const inspection = provider.inspect(config);
    if (provider.id !== COMMAND_PROVIDER_ID) return inspection;

    const command = inspection.target.details.command;
    for (const candidate of PROVIDERS) {
        const recognized = candidate.recognizeCommand?.(command);
        if (recognized) {
            return {
                ...recognized,
                target: {
                    ...recognized.target,
                    details: { ...recognized.target.details, command },
                },
            };
        }
    }
    return inspection;
}

/**
 * Describe a tunnel's target without throwing: a malformed block is reported
 * as such rather than breaking whatever is listing connections.
 */
export function describeTunnel(connectionName: string, tunnel: TunnelConfig): string {
    try {
        const { target } = resolveTunnel(connectionName, tunnel).inspect();
        return target.provider === COMMAND_PROVIDER_ID
            ? target.summary
            : `${target.provider}: ${target.summary}`;
    } catch {
        return 'invalid tunnel config';
    }
}

/** A provider the wizard can set up, with its questions */
export interface TunnelSetupEntry extends TunnelSetup {
    providerId: string;
}

/** Every provider the `sherlock manage` wizard can set up, in registry order */
export function tunnelSetups(): TunnelSetupEntry[] {
    return PROVIDERS.flatMap((provider) =>
        provider.setup ? [{ ...provider.setup, providerId: provider.id }] : []
    );
}

/** A shorthand registered by any provider, by name */
export function tunnelShorthand(name: string): TunnelShorthand | undefined {
    for (const provider of PROVIDERS) {
        const shorthand = provider.shorthands?.[name];
        if (shorthand) return shorthand;
    }
    return undefined;
}

export type {
    DiagnoseContext,
    DiagnosticCheck,
    HostVerdict,
    OpenTunnel,
    OpenTunnelContext,
    TunnelEndpoint,
    TunnelInspection,
    TunnelProvider,
    TunnelSetup,
    TunnelSetupChoices,
    TunnelSetupField,
    TunnelShorthand,
    TunnelTarget,
} from './types';
