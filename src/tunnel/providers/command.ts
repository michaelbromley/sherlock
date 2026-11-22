/**
 * The built-in provider: a tunnel opened by running a shell command.
 *
 * This is what a `tunnel` block with no `provider` uses. The command either
 * binds the port sherlock gives it, or picks its own and prints it, in which
 * case the endpoint is read back out of its output.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import {
    applyPortPlaceholder,
    matchEndpoint,
    resolveTunnelConfig,
    type DiscoveredEndpoint,
    type ResolvedTunnelConfig,
} from '../config';
import { TUNNEL_HOST } from '../net';
import { killProcessTree } from '../process';
import { isProviderTunnel, type TunnelConfig } from '../types';
import type { OpenTunnel, OpenTunnelContext, TunnelProvider } from './types';

export const COMMAND_PROVIDER_ID = 'command';

/** How often to re-read the log while waiting for the command to announce its endpoint */
const DISCOVERY_POLL_MS = 100;

/**
 * Watch the forwarding command's output until it announces the endpoint it
 * bound. Tools that pick their own address and port print it on startup, which
 * is the only way to learn where to connect.
 */
async function discoverEndpoint(
    context: OpenTunnelContext,
    pattern: RegExp,
    outputOffset: number,
    childExited: () => boolean
): Promise<DiscoveredEndpoint | null> {
    for (;;) {
        const found = matchEndpoint(pattern, context.readLog(outputOffset));
        if (found) return found;

        // Check for death only after one last read, so output flushed just
        // before the process exited is not missed.
        if (childExited() || Date.now() >= context.deadline) return null;

        await new Promise((resolve) => setTimeout(resolve, DISCOVERY_POLL_MS));
    }
}

export const commandProvider: TunnelProvider<ResolvedTunnelConfig> = {
    id: COMMAND_PROVIDER_ID,

    resolve(tunnel: TunnelConfig, connectionName: string): ResolvedTunnelConfig {
        if (isProviderTunnel(tunnel)) {
            throw new Error(`The command provider cannot open a "${tunnel.provider}" tunnel.`);
        }
        return resolveTunnelConfig(connectionName, tunnel);
    },

    inspect(config) {
        return {
            target: {
                provider: COMMAND_PROVIDER_ID,
                summary: config.command,
                details: { command: config.command },
            },
            checkHost: () => ({
                verdict: 'unknown',
                reason: 'the tunnel is a shell command, so sherlock cannot tell what it forwards to',
            }),
        };
    },

    async open(config, context): Promise<OpenTunnel> {
        // Either sherlock dictates the endpoint, or the command picks one and we
        // read it back out of the command's output once it starts up.
        const discovering = config.endpointPattern !== undefined;
        const dictatedPort = discovering ? 0 : config.localPort ?? (await context.findFreePort());
        const command = discovering
            ? config.command
            : applyPortPlaceholder(config.command, dictatedPort);

        context.log(discovering ? 'reading endpoint from output' : `on port ${dictatedPort}`);
        context.log(`${command}\n`);

        // The lines above echo the command, which can itself contain something
        // that looks like an endpoint. Endpoint matching starts past them so a
        // loose pattern cannot read the port back out of the command it was given.
        const outputOffset = context.logOffset();

        let child: ChildProcess;
        try {
            child = spawn(command, {
                shell: true,
                // Own process group, so the whole forwarding tree can be signalled
                // and so closing the terminal does not take the tunnel down.
                detached: true,
                stdio: ['ignore', context.logFd, context.logFd],
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to start tunnel command: ${message}`);
        }

        const childPid = child.pid;
        if (childPid === undefined) {
            throw new Error('Tunnel command produced no process');
        }

        let exitReason: string | null = null;
        child.once('exit', (code, signal) => {
            exitReason = `Tunnel command ${signal ? `killed by ${signal}` : `exited with code ${code}`}`;
        });

        let endpoint = { host: TUNNEL_HOST, port: dictatedPort };
        if (config.endpointPattern) {
            const discovered = await discoverEndpoint(
                context,
                config.endpointPattern,
                outputOffset,
                () => exitReason !== null
            );
            if (!discovered) {
                await killProcessTree(childPid);
                throw new Error(
                    exitReason ??
                    `Tunnel command did not print a local endpoint matching ` +
                    `${config.endpointPattern.source} before the ready timeout. ` +
                    `Check "endpointPattern" against the command's actual output below.`
                );
            }
            endpoint = discovered;
            context.log(`found endpoint ${endpoint.host}:${endpoint.port} in command output`);
        }

        return {
            endpoint,
            description: command,
            childPid,
            exitReason: () => exitReason,
            close: async () => {
                await killProcessTree(childPid);
            },
        };
    },
};
