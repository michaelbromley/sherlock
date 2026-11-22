/**
 * The contract between sherlock and a tunnel provider.
 *
 * A provider knows how to reach one kind of remote: by running a shell command,
 * or by talking to a platform's API. Sherlock itself knows nothing about any
 * particular platform. It asks the registry for a provider by the id written in
 * the `tunnel` block, and deals with it only through this interface.
 *
 * To add a provider, implement `TunnelProvider` in its own directory and list
 * it in `./index.ts`. Nothing else needs to change.
 */

import type { DbType } from '../../db-types';
import type { TunnelConfig } from '../types';

/** Where a running tunnel can be reached locally */
export interface TunnelEndpoint {
    host: string;
    port: number;
}

/**
 * What a tunnel forwards to, for showing to the user. Must never contain a
 * secret: it is printed, logged and written to the tunnel's state file.
 */
export interface TunnelTarget {
    /** Id of the provider that owns the target */
    provider: string;
    /** One line naming the target, e.g. "my-project/my-addon (read)" */
    summary: string;
    /** The same target as named fields, e.g. { project, addon } */
    details: Record<string, string>;
}

/** Whether a tunnel's target is the database the connection's `host` names */
export interface HostVerdict {
    /** `unknown` when the two cannot be compared, which is not a pass */
    verdict: 'match' | 'mismatch' | 'unknown';
    reason: string;
}

/** A tunnel's target, with the means to compare it against a configured host */
export interface TunnelInspection {
    target: TunnelTarget;
    checkHost(host: string): HostVerdict;
}

/** One step of `sherlock doctor` */
export interface DiagnosticCheck {
    name: string;
    status: 'pass' | 'fail' | 'skip';
    /** What was found. Never a secret. */
    detail: string;
    /** What to change, when the check failed */
    fix?: string;
}

/** What a provider is told about the connection it is diagnosing */
export interface DiagnoseContext {
    connectionName: string;
    dbType: DbType;
}

/** What a provider is given to open a tunnel with */
export interface OpenTunnelContext {
    connectionName: string;
    /** Epoch milliseconds by which the tunnel must be up */
    deadline: number;
    /** Append a line to the tunnel's log. Never pass a secret. */
    log(line: string): void;
    /**
     * The tunnel log's file descriptor, for a provider that runs a separate
     * process and wants its output captured.
     */
    logFd: number;
    /** The log's current size in bytes, to mark where later output begins */
    logOffset(): number;
    /** The log's contents from `offset` bytes onwards */
    readLog(offset: number): string;
    /** Ask the OS for a free local port */
    findFreePort(): Promise<number>;
}

/** A tunnel a provider has opened */
export interface OpenTunnel {
    /** Where the forward listens. The caller waits for it to accept. */
    endpoint: TunnelEndpoint;
    /** What is being forwarded, for the state file and `tunnel status` */
    description: string;
    /**
     * PID of the forwarding process, when there is one, so that a supervisor
     * that dies can have its tunnel cleaned up by a later command.
     */
    childPid?: number;
    /** Why the forward stopped, or null while it is still running */
    exitReason(): string | null;
    /** Stop forwarding and release the local port */
    close(): Promise<void>;
}

/**
 * A way of opening tunnels. `C` is the provider's own validated config.
 */
export interface TunnelProvider<C = unknown> {
    /** The value of `tunnel.provider` that selects this provider */
    readonly id: string;

    /**
     * Validate the `tunnel` block and fill in defaults. Throws an error that
     * names the connection (see `tunnelConfigLabel`) so the mistake is traceable.
     */
    resolve(tunnel: TunnelConfig, connectionName: string): C;

    /** Describe the target and how to compare it with a configured host */
    inspect(config: C): TunnelInspection;

    /**
     * Open the forward. Called inside the supervisor process, which keeps
     * running for as long as the tunnel does.
     *
     * Throws with a message fit to show the user when the tunnel cannot start.
     */
    open(config: C, context: OpenTunnelContext): Promise<OpenTunnel>;

    /**
     * Check, without opening a tunnel, that this provider can reach its target:
     * the login works, the target exists. Returns the checks in the order they
     * ran, stopping after the first failure.
     */
    diagnose?(config: C, context: DiagnoseContext): Promise<DiagnosticCheck[]>;

    /**
     * Recognise this provider's own CLI inside a shell command, so that a
     * command tunnel can still be described and checked by its target.
     * Returns null for a command that is not this provider's.
     */
    recognizeCommand?(command: string): TunnelInspection | null;

    /**
     * Named shortcuts that expand to a full `tunnel` block, for
     * `connection add --tunnel-<name>` flags that predate providers.
     */
    shorthands?: Record<string, TunnelShorthand>;

    /**
     * The questions the `sherlock manage` wizard asks to build this provider's
     * tunnel block. A provider without `setup` can only be configured by hand.
     */
    setup?: TunnelSetup;
}

/** How the wizard offers a provider, and what it asks */
export interface TunnelSetup {
    /** Shown in the list of ways to reach a database, e.g. "Northflank addon" */
    label: string;
    /** One line under the label, e.g. "through the Northflank API" */
    hint?: string;
    /** Shown before the first question */
    intro?: string;
    /** Asked in order. Each answer becomes the tunnel setting of the same key. */
    fields: TunnelSetupField[];
}

/** One question. An empty answer to an optional question leaves the setting out. */
export interface TunnelSetupField {
    /** The tunnel setting this answers, e.g. "project" */
    key: string;
    message: string;
    optional?: boolean;
    placeholder?: string;
    /**
     * Answers to pick from, given the answers so far. When they cannot be
     * listed (no login, no network), the wizard says why and lets the user
     * type the value instead.
     */
    choices?(answers: Readonly<Record<string, string>>): Promise<TunnelSetupChoices>;
}

export type TunnelSetupChoices =
    | { options: { value: string; label: string; hint?: string }[] }
    | { unavailable: string };

/** A shortcut from one short value to a full tunnel block */
export interface TunnelShorthand {
    /** Shown in an error when the value cannot be parsed, e.g. "<project>/<addon>" */
    usage: string;
    /** Build the tunnel block. Throws when the value is malformed. */
    expand(value: string): TunnelConfig;
    /** Default `endpointPattern` for a command this shorthand's tool prints */
    endpointPattern?: string;
}
