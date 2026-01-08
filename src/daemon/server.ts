/**
 * Sherlock Daemon Server
 *
 * Runs as a background process, caching credentials and maintaining
 * database connections. CLI commands route through this to avoid
 * repeated keychain prompts.
 */
import { SQL } from 'bun';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { resolveConnection, listConnections, loadConfigFile } from '../config';
import { getConfigDir, ensureConfigDir } from '../config/paths';
import type { ResolvedConnectionConfig } from '../config/types';

const SOCKET_NAME = 'sherlock.sock';
const PID_FILE = 'sherlock.pid';

export function getSocketPath(): string {
    return path.join(getConfigDir(), SOCKET_NAME);
}

export function getPidPath(): string {
    return path.join(getConfigDir(), PID_FILE);
}

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
 * The Daemon Server
 */
export class SherlockDaemon {
    private server: net.Server | null = null;
    private connections: Map<string, ReturnType<typeof SQL>> = new Map();
    private connectionConfigs: Map<string, ResolvedConnectionConfig> = new Map();
    private isShuttingDown = false;

    /**
     * Start the daemon server
     */
    async start(): Promise<void> {
        ensureConfigDir();
        const socketPath = getSocketPath();
        const pidPath = getPidPath();

        // Check if already running
        if (fs.existsSync(socketPath)) {
            throw new Error('Daemon already running. Use `sherlock daemon stop` first.');
        }

        // Resolve all credentials upfront (this triggers keychain prompts)
        console.log('Resolving credentials...');
        await this.resolveAllCredentials();
        console.log(`Resolved ${this.connectionConfigs.size} connection(s)`);

        // Create Unix socket server
        this.server = net.createServer((socket) => {
            this.handleConnection(socket);
        });

        // Clean up socket file if it exists
        if (fs.existsSync(socketPath)) {
            fs.unlinkSync(socketPath);
        }

        return new Promise((resolve, reject) => {
            this.server!.listen(socketPath, () => {
                // Set socket permissions
                fs.chmodSync(socketPath, 0o600);

                // Write PID file
                fs.writeFileSync(pidPath, process.pid.toString());

                console.log(`Daemon started (PID: ${process.pid})`);
                console.log(`Socket: ${socketPath}`);
                resolve();
            });

            this.server!.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Resolve all connection credentials
     */
    private async resolveAllCredentials(): Promise<void> {
        const connectionNames = listConnections();

        for (const name of connectionNames) {
            try {
                const config = await resolveConnection(name);
                this.connectionConfigs.set(name, config);
            } catch (error: any) {
                console.warn(`Warning: Could not resolve credentials for "${name}": ${error.message}`);
            }
        }
    }

    /**
     * Get or create a database connection
     */
    private getConnection(connectionName: string): ReturnType<typeof SQL> {
        // Check if we have a cached connection
        let conn = this.connections.get(connectionName);
        if (conn) {
            return conn;
        }

        // Get resolved config
        const config = this.connectionConfigs.get(connectionName);
        if (!config) {
            throw new Error(`Connection "${connectionName}" not found or credentials not resolved`);
        }

        // Create new connection
        conn = new SQL(config.url);
        this.connections.set(connectionName, conn);
        return conn;
    }

    /**
     * Get connection type
     */
    private getConnectionType(connectionName: string): string {
        const config = this.connectionConfigs.get(connectionName);
        return config?.type || 'unknown';
    }

    /**
     * Handle incoming socket connection
     */
    private handleConnection(socket: net.Socket): void {
        let buffer = '';

        socket.on('data', async (data) => {
            buffer += data.toString();

            // Process complete messages (newline-delimited JSON)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const request: DaemonRequest = JSON.parse(line);
                    const response = await this.handleRequest(request);
                    socket.write(JSON.stringify(response) + '\n');
                } catch (error: any) {
                    const errorResponse: DaemonResponse = {
                        id: 'unknown',
                        success: false,
                        error: `Parse error: ${error.message}`,
                    };
                    socket.write(JSON.stringify(errorResponse) + '\n');
                }
            }
        });

        socket.on('error', (err) => {
            // Client disconnected, ignore
        });
    }

    /**
     * Handle a daemon request
     */
    private async handleRequest(request: DaemonRequest): Promise<DaemonResponse> {
        const { id, command, args = {} } = request;

        try {
            switch (command) {
                case 'ping':
                    return { id, success: true, data: { pong: true, pid: process.pid } };

                case 'connections':
                    return {
                        id,
                        success: true,
                        data: { connections: Array.from(this.connectionConfigs.keys()) },
                    };

                case 'query': {
                    const { connection = 'default', sql: sqlQuery } = args;
                    const conn = this.getConnection(connection);
                    const result = await conn.unsafe(sqlQuery);
                    return {
                        id,
                        success: true,
                        data: {
                            rowCount: Array.isArray(result) ? result.length : 0,
                            rows: result,
                        },
                    };
                }

                case 'tables': {
                    const { connection = 'default' } = args;
                    const conn = this.getConnection(connection);
                    const dbType = this.getConnectionType(connection);
                    const tables = await this.getTables(conn, dbType);
                    return { id, success: true, data: { tables } };
                }

                case 'describe': {
                    const { connection = 'default', table } = args;
                    const conn = this.getConnection(connection);
                    const dbType = this.getConnectionType(connection);
                    const result = await this.describeTable(conn, dbType, table);
                    return { id, success: true, data: result };
                }

                case 'introspect': {
                    const { connection = 'default' } = args;
                    const conn = this.getConnection(connection);
                    const dbType = this.getConnectionType(connection);
                    const tables = await this.getTables(conn, dbType);
                    const schema: any = {};
                    for (const table of tables) {
                        const tableInfo = await this.describeTable(conn, dbType, table);
                        schema[table] = tableInfo.columns;
                    }
                    return { id, success: true, data: schema };
                }

                case 'test': {
                    const { connection = 'default' } = args;
                    const conn = this.getConnection(connection);
                    const dbType = this.getConnectionType(connection);
                    const testQuery = dbType === 'mysql' ? 'SELECT 1' : 'SELECT 1 as test';
                    await conn.unsafe(testQuery);
                    return {
                        id,
                        success: true,
                        data: { connection, type: dbType, status: 'ok' },
                    };
                }

                case 'shutdown':
                    // Schedule shutdown after responding
                    setTimeout(() => this.stop(), 100);
                    return { id, success: true, data: { message: 'Shutting down...' } };

                case 'reload':
                    // Reload credentials
                    this.closeAllConnections();
                    await this.resolveAllCredentials();
                    return {
                        id,
                        success: true,
                        data: {
                            message: 'Credentials reloaded',
                            connections: Array.from(this.connectionConfigs.keys()),
                        },
                    };

                default:
                    return { id, success: false, error: `Unknown command: ${command}` };
            }
        } catch (error: any) {
            return { id, success: false, error: error.message };
        }
    }

    /**
     * Get tables for a connection
     */
    private async getTables(conn: ReturnType<typeof SQL>, dbType: string): Promise<string[]> {
        let query: string;

        if (dbType === 'postgres') {
            query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
        } else if (dbType === 'sqlite') {
            query = "SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
        } else {
            query = 'SHOW TABLES';
        }

        const result = await conn.unsafe(query);

        if (dbType === 'postgres' || dbType === 'sqlite') {
            return result.map((row: any) => row.table_name || row.name);
        } else {
            const key = Object.keys(result[0])[0];
            return result.map((row: any) => row[key]);
        }
    }

    /**
     * Describe a table
     */
    private async describeTable(
        conn: ReturnType<typeof SQL>,
        dbType: string,
        tableName: string
    ): Promise<any> {
        let query: string;

        if (dbType === 'postgres') {
            query = `
                SELECT
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns
                WHERE table_name = '${tableName}'
                ORDER BY ordinal_position
            `;
        } else if (dbType === 'sqlite') {
            query = `PRAGMA table_info(\`${tableName}\`)`;
        } else {
            query = `DESCRIBE \`${tableName}\``;
        }

        const result = await conn.unsafe(query);
        return { table: tableName, columns: result };
    }

    /**
     * Close all database connections
     */
    private closeAllConnections(): void {
        for (const [name, conn] of this.connections) {
            try {
                conn.close();
            } catch {
                // Ignore close errors
            }
        }
        this.connections.clear();
    }

    /**
     * Stop the daemon
     */
    async stop(): Promise<void> {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        console.log('Stopping daemon...');

        // Close all database connections
        this.closeAllConnections();

        // Close server
        if (this.server) {
            this.server.close();
        }

        // Remove socket and PID files
        const socketPath = getSocketPath();
        const pidPath = getPidPath();

        if (fs.existsSync(socketPath)) {
            fs.unlinkSync(socketPath);
        }
        if (fs.existsSync(pidPath)) {
            fs.unlinkSync(pidPath);
        }

        console.log('Daemon stopped');
        process.exit(0);
    }
}

/**
 * Check if daemon is running
 */
export function isDaemonRunning(): boolean {
    const socketPath = getSocketPath();
    const pidPath = getPidPath();

    if (!fs.existsSync(socketPath) || !fs.existsSync(pidPath)) {
        return false;
    }

    // Check if PID is still alive
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());
    try {
        process.kill(pid, 0); // Signal 0 just checks if process exists
        return true;
    } catch {
        // Process not running, clean up stale files
        if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
        if (fs.existsSync(pidPath)) fs.unlinkSync(pidPath);
        return false;
    }
}

/**
 * Get daemon PID if running
 */
export function getDaemonPid(): number | null {
    const pidPath = getPidPath();
    if (!fs.existsSync(pidPath)) return null;

    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim());
    try {
        process.kill(pid, 0);
        return pid;
    } catch {
        return null;
    }
}

/**
 * Run the daemon (called when starting in daemon mode)
 */
export async function runDaemon(): Promise<void> {
    const daemon = new SherlockDaemon();

    // Handle shutdown signals
    process.on('SIGINT', () => daemon.stop());
    process.on('SIGTERM', () => daemon.stop());

    await daemon.start();

    // Keep process alive
    await new Promise(() => {}); // Never resolves
}
