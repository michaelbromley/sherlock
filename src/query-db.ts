#!/usr/bin/env tsx
/* eslint-disable no-console */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { loadConfig } from './load-config';

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let connectionName = 'default';
    let command: string | undefined;
    let commandArgs: string[] = [];

    // Parse --connection or -c flag
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--connection' || arg === '-c') {
            if (i + 1 < args.length) {
                connectionName = args[i + 1];
                i++; // Skip the next argument
            } else {
                console.error(JSON.stringify({ error: '--connection flag requires a value' }));
                process.exit(1);
            }
        } else if (arg.startsWith('--connection=')) {
            connectionName = arg.split('=')[1];
        } else if (arg.startsWith('-c=')) {
            connectionName = arg.split('=')[1];
        } else if (!command) {
            command = arg;
        } else {
            commandArgs.push(arg);
        }
    }

    if (!command) {
        console.error(JSON.stringify({ error: 'No command provided. Use: introspect, query, or tables' }));
        process.exit(1);
    }

    const dataSource = new DataSource({
        ...loadConfig(connectionName),
        logging: false,
    });

    try {
        await dataSource.initialize();

        if (command === 'introspect') {
            // Get all tables with their columns
            const result = await introspectSchema(dataSource);
            console.log(JSON.stringify(result, null, 2));
        } else if (command === 'tables') {
            // Get list of all tables
            const tables = await getTables(dataSource);
            console.log(JSON.stringify({ tables }, null, 2));
        } else if (command === 'query') {
            // Execute a SQL query
            const query = commandArgs[0];
            if (!query) {
                console.error(JSON.stringify({ error: 'No query provided' }));
                process.exit(1);
            }

            // Enforce read-only: only allow SELECT queries
            const trimmedQuery = query.trim().toUpperCase();
            if (
                !trimmedQuery.startsWith('SELECT') &&
                !trimmedQuery.startsWith('SHOW') &&
                !trimmedQuery.startsWith('DESCRIBE') &&
                !trimmedQuery.startsWith('EXPLAIN')
            ) {
                console.error(
                    JSON.stringify({
                        error: 'Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed (read-only mode)',
                    }),
                );
                process.exit(1);
            }

            const result = await executeQuery(dataSource, query);
            console.log(JSON.stringify(result, null, 2));
        } else if (command === 'describe') {
            // Describe a specific table
            const tableName = commandArgs[0];
            if (!tableName) {
                console.error(JSON.stringify({ error: 'No table name provided' }));
                process.exit(1);
            }

            const result = await describeTable(dataSource, tableName);
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.error(JSON.stringify({ error: `Unknown command: ${command}` }));
            process.exit(1);
        }
    } catch (error: any) {
        console.error(
            JSON.stringify({
                error: error.message,
                stack: error.stack,
            }),
        );
        process.exit(1);
    } finally {
        await dataSource.destroy();
    }
}

async function getTables(dataSource: DataSource): Promise<string[]> {
    const dbType = dataSource.options.type;

    let query: string;
    if (dbType === 'postgres') {
        query =
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
    } else if (dbType === 'better-sqlite3' || dbType === 'sqljs') {
        query =
            "SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
    } else {
        query = 'SHOW TABLES';
    }

    const result = await dataSource.query(query);

    if (dbType === 'postgres' || dbType === 'better-sqlite3' || dbType === 'sqljs') {
        return result.map((row: any) => row.table_name || row.name);
    } else {
        // MySQL/MariaDB
        const key = Object.keys(result[0])[0];
        return result.map((row: any) => row[key]);
    }
}

async function describeTable(dataSource: DataSource, tableName: string): Promise<any> {
    const dbType = dataSource.options.type;

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
    } else if (dbType === 'better-sqlite3' || dbType === 'sqljs') {
        // SQLite needs proper quoting for reserved keywords
        query = `PRAGMA table_info(\`${tableName}\`)`;
    } else {
        // MySQL/MariaDB needs backticks for reserved keywords like 'order'
        query = `DESCRIBE \`${tableName}\``;
    }

    const result = await dataSource.query(query);
    return { table: tableName, columns: result };
}

async function introspectSchema(dataSource: DataSource): Promise<any> {
    const tables = await getTables(dataSource);
    const schema: any = {};

    for (const table of tables) {
        const tableInfo = await describeTable(dataSource, table);
        schema[table] = tableInfo.columns;
    }

    return schema;
}

async function executeQuery(dataSource: DataSource, query: string): Promise<any> {
    try {
        const result = await dataSource.query(query);
        return {
            rowCount: Array.isArray(result) ? result.length : 0,
            rows: result,
        };
    } catch (error: any) {
        return {
            error: error.message,
        };
    }
}

main();
