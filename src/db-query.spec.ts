#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Test suite for database-explorer skill
 *
 * Tests all commands (tables, introspect, describe, query) for each configured database connection.
 * Run with: tsx src/db-query.spec.ts
 *
 * Prerequisites:
 * - Create a config.ts file in the project root with your database connections
 * - Ensure at least one connection is available for testing
 */

import { execSync } from 'child_process';
import path from 'path';
import * as fs from 'fs';

// Load connections from config.ts
function loadConnections(): string[] {
    const configPath = path.join(__dirname, '../config.ts');

    if (!fs.existsSync(configPath)) {
        console.error('❌ config.ts not found. Please create a config.ts file with your database connections.');
        console.error('   See config.example.ts for an example.');
        process.exit(1);
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(configPath);

    if (!config.connections || typeof config.connections !== 'object') {
        console.error('❌ Invalid config.ts: missing "connections" export');
        process.exit(1);
    }

    return Object.keys(config.connections).filter(conn => conn.startsWith('chinook-'));
}

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    duration?: number;
}

class TestRunner {
    private results: TestResult[] = [];
    private scriptPath: string;

    constructor() {
        this.scriptPath = path.join(__dirname, 'query-db.ts');
    }

    /**
     * Execute a command with the specified connection
     */
    private executeCommand(command: string[], connectionName?: string): { stdout: string; success: boolean; error?: string } {
        try {
            const connectionArg = connectionName ? `--connection ${connectionName}` : '';
            const fullCommand = `npx tsx ${this.scriptPath} ${connectionArg} --no-log ${command.join(' ')}`.trim();
            const stdout = execSync(fullCommand, {
                encoding: 'utf-8',
                stdio: 'pipe',
            });
            return { stdout, success: true };
        } catch (error: any) {
            return {
                stdout: error.stdout || '',
                success: false,
                error: error.stderr || error.message,
            };
        }
    }

    /**
     * Validate JSON output
     */
    private validateJSON(output: string): boolean {
        try {
            JSON.parse(output);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Test the 'tables' command
     */
    private testTablesCommand(connectionName: string): TestResult {
        const testName = `${connectionName}: tables command`;
        const startTime = Date.now();

        const result = this.executeCommand(['tables'], connectionName);
        const duration = Date.now() - startTime;

        if (!result.success) {
            return {
                name: testName,
                passed: false,
                error: `Command failed: ${result.error}`,
                duration,
            };
        }

        if (!this.validateJSON(result.stdout)) {
            return {
                name: testName,
                passed: false,
                error: 'Invalid JSON output',
                duration,
            };
        }

        const data = JSON.parse(result.stdout);
        if (!data.tables || !Array.isArray(data.tables)) {
            return {
                name: testName,
                passed: false,
                error: 'Expected "tables" array in response',
                duration,
            };
        }

        if (data.tables.length === 0) {
            return {
                name: testName,
                passed: false,
                error: 'Expected at least one table',
                duration,
            };
        }

        return {
            name: testName,
            passed: true,
            duration,
        };
    }

    /**
     * Test the 'describe' command
     */
    private testDescribeCommand(connectionName: string, tableName: string): TestResult {
        const testName = `${connectionName}: describe command (${tableName})`;
        const startTime = Date.now();

        const result = this.executeCommand(['describe', tableName], connectionName);
        const duration = Date.now() - startTime;

        if (!result.success) {
            return {
                name: testName,
                passed: false,
                error: `Command failed: ${result.error}`,
                duration,
            };
        }

        if (!this.validateJSON(result.stdout)) {
            return {
                name: testName,
                passed: false,
                error: 'Invalid JSON output',
                duration,
            };
        }

        const data = JSON.parse(result.stdout);
        if (!data.table || !data.columns || !Array.isArray(data.columns)) {
            return {
                name: testName,
                passed: false,
                error: 'Expected "table" and "columns" in response',
                duration,
            };
        }

        if (data.columns.length === 0) {
            return {
                name: testName,
                passed: false,
                error: 'Expected at least one column',
                duration,
            };
        }

        return {
            name: testName,
            passed: true,
            duration,
        };
    }

    /**
     * Test the 'query' command
     */
    private testQueryCommand(connectionName: string, query: string): TestResult {
        const testName = `${connectionName}: query command`;
        const startTime = Date.now();

        const result = this.executeCommand(['query', `"${query}"`], connectionName);
        const duration = Date.now() - startTime;

        if (!result.success) {
            return {
                name: testName,
                passed: false,
                error: `Command failed: ${result.error}`,
                duration,
            };
        }

        if (!this.validateJSON(result.stdout)) {
            return {
                name: testName,
                passed: false,
                error: 'Invalid JSON output',
                duration,
            };
        }

        const data = JSON.parse(result.stdout);
        if (!('rowCount' in data) || !('rows' in data)) {
            return {
                name: testName,
                passed: false,
                error: 'Expected "rowCount" and "rows" in response',
                duration,
            };
        }

        return {
            name: testName,
            passed: true,
            duration,
        };
    }

    /**
     * Test read-only enforcement with various attack vectors
     */
    private testReadOnlyEnforcement(connectionName: string, tableName: string): TestResult {
        const testName = `${connectionName}: read-only enforcement`;
        const startTime = Date.now();

        // List of malicious queries to test
        const maliciousQueries = [
            // Direct DELETE
            `DELETE FROM ${tableName} WHERE id = 999`,
            // Direct UPDATE
            `UPDATE ${tableName} SET name = 'hacked' WHERE id = 1`,
            // Direct INSERT
            `INSERT INTO ${tableName} VALUES (999, 'hacked')`,
            // DROP TABLE
            `DROP TABLE ${tableName}`,
            // SQL injection via chained query
            `SELECT * FROM ${tableName}; DROP TABLE ${tableName}`,
            // SQL injection via comment
            `SELECT * FROM ${tableName} WHERE 1=1 -- ; DROP TABLE ${tableName}`,
            // TRUNCATE
            `TRUNCATE TABLE ${tableName}`,
            // CREATE
            `CREATE TABLE hacked (id INT)`,
            // ALTER
            `ALTER TABLE ${tableName} ADD COLUMN hacked VARCHAR(255)`,
            // Multiple statements
            `SELECT 1; DELETE FROM ${tableName}`,
            // Hidden in subquery attempt
            `SELECT * FROM ${tableName} WHERE id IN (SELECT id FROM ${tableName}) AND 1=1; DROP TABLE ${tableName}`,
        ];

        const failures: string[] = [];

        for (const query of maliciousQueries) {
            const result = this.executeCommand(['query', `"${query}"`], connectionName);

            if (result.success) {
                failures.push(`Query should have been rejected: ${query.substring(0, 50)}...`);
                continue;
            }

            // Check that the error message mentions read-only or dangerous keyword
            const output = result.error || result.stdout;
            if (!output.includes('read-only') && !output.includes('Dangerous keyword') && !output.includes('not allowed')) {
                failures.push(`Error message should mention security issue for: ${query.substring(0, 50)}...`);
            }
        }

        const duration = Date.now() - startTime;

        if (failures.length > 0) {
            return {
                name: testName,
                passed: false,
                error: failures.join('; '),
                duration,
            };
        }

        return {
            name: testName,
            passed: true,
            duration,
        };
    }

    /**
     * Test the 'introspect' command
     */
    private testIntrospectCommand(connectionName: string): TestResult {
        const testName = `${connectionName}: introspect command`;
        const startTime = Date.now();

        const result = this.executeCommand(['introspect'], connectionName);
        const duration = Date.now() - startTime;

        if (!result.success) {
            return {
                name: testName,
                passed: false,
                error: `Command failed: ${result.error}`,
                duration,
            };
        }

        if (!this.validateJSON(result.stdout)) {
            return {
                name: testName,
                passed: false,
                error: 'Invalid JSON output',
                duration,
            };
        }

        const data = JSON.parse(result.stdout);
        const tableNames = Object.keys(data);

        if (tableNames.length === 0) {
            return {
                name: testName,
                passed: false,
                error: 'Expected at least one table in schema',
                duration,
            };
        }

        // Check that each table has column information
        for (const tableName of tableNames) {
            if (!Array.isArray(data[tableName])) {
                return {
                    name: testName,
                    passed: false,
                    error: `Expected array of columns for table "${tableName}"`,
                    duration,
                };
            }
        }

        return {
            name: testName,
            passed: true,
            duration,
        };
    }

    /**
     * Check if a connection is available and get first table name
     */
    private getConnectionInfo(connectionName: string): { available: boolean; firstTable?: string } {
        try {
            const result = this.executeCommand(['tables'], connectionName);
            if (!result.success) {
                return { available: false };
            }

            const data = JSON.parse(result.stdout);
            const firstTable = data.tables && data.tables.length > 0 ? data.tables[0] : undefined;
            return { available: true, firstTable };
        } catch {
            return { available: false };
        }
    }

    /**
     * Run all tests for a specific connection
     */
    public runTestsForConnection(connectionName: string): void {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing connection: ${connectionName}`);
        console.log('='.repeat(60));

        // Check if connection is available and get first table
        const info = this.getConnectionInfo(connectionName);

        if (!info.available) {
            console.log(`⚠️  Connection "${connectionName}" not available - skipping tests`);
            return;
        }

        console.log(`✓ Connection "${connectionName}" is available`);

        // Test 1: tables command
        const tablesResult = this.testTablesCommand(connectionName);
        this.results.push(tablesResult);
        this.printTestResult(tablesResult);

        // Test 2: introspect command
        const introspectResult = this.testIntrospectCommand(connectionName);
        this.results.push(introspectResult);
        this.printTestResult(introspectResult);

        // Test 3: describe command (use first table if available)
        if (info.firstTable) {
            const describeResult = this.testDescribeCommand(connectionName, info.firstTable);
            this.results.push(describeResult);
            this.printTestResult(describeResult);

            // Test 4: query command
            const queryResult = this.testQueryCommand(connectionName, `SELECT COUNT(*) as count FROM ${info.firstTable}`);
            this.results.push(queryResult);
            this.printTestResult(queryResult);

            // Test 5: read-only enforcement
            const readOnlyResult = this.testReadOnlyEnforcement(connectionName, info.firstTable);
            this.results.push(readOnlyResult);
            this.printTestResult(readOnlyResult);
        } else {
            console.log('⚠️  No tables found - skipping table-specific tests');
        }
    }

    /**
     * Print a single test result
     */
    private printTestResult(result: TestResult): void {
        const status = result.passed ? '✓' : '✗';
        const color = result.passed ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';

        console.log(`${color}${status}${reset} ${result.name} (${result.duration}ms)`);

        if (!result.passed && result.error) {
            console.log(`  Error: ${result.error}`);
        }
    }

    /**
     * Run all tests
     */
    public runAllTests(connections: string[]): void {
        console.log('🧪 Database Explorer Test Suite');
        console.log('================================\n');
        console.log(`Found ${connections.length} connection(s) in config.ts:`);
        connections.forEach(conn => console.log(`  - ${conn}`));

        // Test each connection
        for (const connectionName of connections) {
            this.runTestsForConnection(connectionName);
        }

        // Print summary
        this.printSummary();
    }

    /**
     * Print test summary
     */
    private printSummary(): void {
        console.log(`\n${'='.repeat(60)}`);
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));

        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = total - passed;

        console.log(`Total tests: ${total}`);
        console.log(`Passed: \x1b[32m${passed}\x1b[0m`);
        console.log(`Failed: \x1b[31m${failed}\x1b[0m`);

        if (failed > 0) {
            console.log('\n❌  Some tests failed');
            process.exit(1);
        } else {
            console.log('\n✅  All tests passed!');
            process.exit(0);
        }
    }
}

// Run tests
const connections = loadConnections();
const runner = new TestRunner();
runner.runAllTests(connections);
