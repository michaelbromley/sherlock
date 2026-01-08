/**
 * Sherlock Daemon Client
 *
 * Communicates with the daemon server via Unix socket.
 */
import * as net from 'net';
import { getSocketPath, isDaemonRunning } from './server';

interface DaemonRequest {
    id: string;
    command: string;
    args?: Record<string, any>;
}

interface DaemonResponse {
    id: string;
    success: boolean;
    data?: any;
    error?: string;
}

/**
 * Generate a unique request ID
 */
function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

/**
 * Send a request to the daemon and wait for response
 */
export async function sendRequest(
    command: string,
    args?: Record<string, any>,
    timeout: number = 30000
): Promise<any> {
    if (!isDaemonRunning()) {
        throw new Error('Daemon not running. Start it with `sherlock daemon start`');
    }

    const socketPath = getSocketPath();
    const requestId = generateId();

    return new Promise((resolve, reject) => {
        const socket = net.createConnection(socketPath);
        let buffer = '';
        let timeoutHandle: Timer | null = null;

        const cleanup = () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            socket.destroy();
        };

        timeoutHandle = setTimeout(() => {
            cleanup();
            reject(new Error('Daemon request timed out'));
        }, timeout);

        socket.on('connect', () => {
            const request: DaemonRequest = { id: requestId, command, args };
            socket.write(JSON.stringify(request) + '\n');
        });

        socket.on('data', (data) => {
            buffer += data.toString();

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const response: DaemonResponse = JSON.parse(line);
                    if (response.id === requestId) {
                        cleanup();
                        if (response.success) {
                            resolve(response.data);
                        } else {
                            reject(new Error(response.error || 'Unknown error'));
                        }
                        return;
                    }
                } catch (e) {
                    // Invalid JSON, continue
                }
            }
        });

        socket.on('error', (err) => {
            cleanup();
            reject(new Error(`Failed to connect to daemon: ${err.message}`));
        });

        socket.on('close', () => {
            cleanup();
            reject(new Error('Connection to daemon closed unexpectedly'));
        });
    });
}

/**
 * High-level client methods
 */
export class DaemonClient {
    /**
     * Check if daemon is responding
     */
    static async ping(): Promise<{ pong: boolean; pid: number }> {
        return sendRequest('ping');
    }

    /**
     * List available connections
     */
    static async listConnections(): Promise<string[]> {
        const result = await sendRequest('connections');
        return result.connections;
    }

    /**
     * Execute a SQL query
     */
    static async query(
        sql: string,
        connection: string = 'default'
    ): Promise<{ rowCount: number; rows: any[] }> {
        return sendRequest('query', { connection, sql });
    }

    /**
     * List tables
     */
    static async tables(connection: string = 'default'): Promise<string[]> {
        const result = await sendRequest('tables', { connection });
        return result.tables;
    }

    /**
     * Describe a table
     */
    static async describe(
        table: string,
        connection: string = 'default'
    ): Promise<{ table: string; columns: any[] }> {
        return sendRequest('describe', { connection, table });
    }

    /**
     * Introspect full schema
     */
    static async introspect(connection: string = 'default'): Promise<any> {
        return sendRequest('introspect', { connection });
    }

    /**
     * Test a connection
     */
    static async test(
        connection: string = 'default'
    ): Promise<{ connection: string; type: string; status: string }> {
        return sendRequest('test', { connection });
    }

    /**
     * Shutdown the daemon
     */
    static async shutdown(): Promise<void> {
        await sendRequest('shutdown');
    }

    /**
     * Reload credentials
     */
    static async reload(): Promise<{ message: string; connections: string[] }> {
        return sendRequest('reload');
    }
}

/**
 * Check if we should use the daemon for this command
 */
export function shouldUseDaemon(): boolean {
    return isDaemonRunning();
}
