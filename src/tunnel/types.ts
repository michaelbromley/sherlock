/**
 * Tunnel configuration and runtime state types.
 *
 * A tunnel lets a connection point at a remote database that is only reachable
 * through a port-forwarding process (Northflank, kubectl, ssh -L, cloud-sql-proxy,
 * fly proxy). Sherlock starts that process on demand, reuses it across commands,
 * and shuts it down once nobody has used it for a while.
 */

/** Tunnel settings as written in the config file */
export interface TunnelConfig {
    /**
     * Shell command that forwards a remote port to localhost. `{{port}}` is
     * replaced with the local port before the command runs.
     */
    command: string;

    /**
     * Fixed local port to forward to. When omitted, a free port is picked at
     * start time — preferable unless the forwarding tool insists on a fixed one.
     */
    localPort?: number;

    /**
     * Regular expression that reads the local endpoint out of the forwarding
     * command's own output, for tools that choose the address and port
     * themselves rather than accepting one.
     *
     * Must contain a named `port` group, and may contain a named `host` group
     * (defaulting to 127.0.0.1). Mutually exclusive with `localPort` and
     * `{{port}}`, since those dictate an endpoint rather than discovering one.
     *
     * e.g. "exposed on (?<host>[\\d.]+):(?<port>\\d+)" for `northflank forward`.
     */
    endpointPattern?: string;

    /** Shut the tunnel down after this long with no queries. Default "10m". */
    idleTimeout?: string;

    /** How long to wait for the local port to start accepting. Default "30s". */
    readyTimeout?: string;
}

/**
 * Runtime state for a running tunnel, persisted so that separate `sherlock`
 * invocations can find and reuse the same forwarding process.
 *
 * Written only by the supervisor process. Readers must tolerate every field
 * being stale, since the supervisor can be killed at any point.
 */
export interface TunnelState {
    /** Connection name this tunnel belongs to */
    name: string;

    /** Local address the forwarding process listens on */
    host: string;

    /** Local port the forwarding process listens on */
    port: number;

    /** PID of the sherlock supervisor process */
    supervisorPid: number;

    /**
     * PID of the forwarding command itself. Also its process group id, since
     * the supervisor spawns it detached so the whole tree can be signalled.
     */
    childPid: number;

    startedAt: string;

    /** Resolved idle timeout, so in-flight queries know how often to signal use */
    idleTimeoutMs: number;

    /** True once the local port accepts connections */
    ready: boolean;

    /** Set when the tunnel failed to come up; includes the tail of the log */
    error?: string;

    /** The command that was run, with `{{port}}` already substituted */
    command: string;

    /** Where the forwarding command's stdout/stderr are being written */
    logFile: string;
}
