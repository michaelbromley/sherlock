#!/usr/bin/env npx tsx

/**
 * Initialize SQL Server with Chinook database
 * This script creates the database and runs the Chinook SQL setup
 */

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Split SQL content by GO statements more intelligently
 * Handles multi-line comments and only splits on GO that appears on its own line
 */
function splitSQLBatches(sqlContent: string): string[] {
    const lines = sqlContent.split('\n');
    const batches: string[] = [];
    let currentBatch: string[] = [];
    let inMultiLineComment = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Track multi-line comment state
        if (trimmedLine.includes('/*')) {
            inMultiLineComment = true;
        }
        if (inMultiLineComment && trimmedLine.includes('*/')) {
            inMultiLineComment = false;
            currentBatch.push(line);
            continue;
        }

        // If we're in a multi-line comment, just add the line
        if (inMultiLineComment) {
            currentBatch.push(line);
            continue;
        }

        // Check if this line is a GO statement (not in a comment)
        // GO must be on its own line (possibly with whitespace)
        if (/^\s*GO\s*$/i.test(trimmedLine)) {
            // End current batch
            const batch = currentBatch.join('\n').trim();
            if (batch.length > 0 && !batch.match(/^\/\*[\s\S]*\*\/$/)) {
                // Don't add batches that are only comments
                batches.push(batch);
            }
            currentBatch = [];
        } else {
            currentBatch.push(line);
        }
    }

    // Add final batch if there is one
    const finalBatch = currentBatch.join('\n').trim();
    if (finalBatch.length > 0 && !finalBatch.match(/^\/\*[\s\S]*\*\/$/)) {
        batches.push(finalBatch);
    }

    return batches;
}

async function initMSSQL() {
    console.log('🔄 Connecting to SQL Server...');

    // Connect to master database first
    const masterDataSource = new DataSource({
        type: 'mssql',
        host: 'localhost',
        port: 14330,
        username: 'sa',
        password: 'YourStrong@Passw0rd',
        database: 'master',
        options: {
            encrypt: false,
            trustServerCertificate: true,
        },
    });

    try {
        await masterDataSource.initialize();
        console.log('✅ Connected to SQL Server');

        // Check if database already exists (case-insensitive since SQL Server databases are case-insensitive by default)
        const result = await masterDataSource.query(
            `SELECT name FROM sys.databases WHERE name = 'Chinook'`
        );

        if (result.length > 0) {
            console.log('ℹ️  Database Chinook already exists - dropping and recreating...');
            // Drop existing database
            await masterDataSource.query('DROP DATABASE Chinook');
            console.log('✅ Dropped existing database');
        }

        console.log('📦 Creating Chinook database...');
        await masterDataSource.query('CREATE DATABASE Chinook');
        console.log('✅ Database created');

        await masterDataSource.destroy();

        // Connect to Chinook database and run SQL file
        const chinookDataSource = new DataSource({
            type: 'mssql',
            host: 'localhost',
            port: 14330,
            username: 'sa',
            password: 'YourStrong@Passw0rd',
            database: 'Chinook',
            options: {
                encrypt: false,
                trustServerCertificate: true,
            },
        });

        await chinookDataSource.initialize();

        // Read and execute the SQL file
        const sqlFile = path.join(__dirname, '../seeds/mssql/01-chinook-mssql.sql');

        if (!fs.existsSync(sqlFile)) {
            console.error('❌ SQL file not found:', sqlFile);
            console.error('   Run \'npm run setup:demo\' first to download the Chinook database files');
            process.exit(1);
        }

        console.log('📥 Importing Chinook schema and data...');
        const sqlContent = fs.readFileSync(sqlFile, 'utf-8');

        // Split by GO statements (SQL Server batch separator) more carefully
        const batches = splitSQLBatches(sqlContent);

        console.log(`   Executing ${batches.length} SQL batches...`);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < batches.length; i++) {
            try {
                await chinookDataSource.query(batches[i]);
                successCount++;
                if ((i + 1) % 10 === 0 || i === batches.length - 1) {
                    console.log(`   Progress: ${i + 1}/${batches.length} batches (${successCount} succeeded, ${errorCount} failed)`);
                }
            } catch (error: any) {
                errorCount++;
                if (errorCount <= 5) {
                    console.error(`   Error in batch ${i + 1}:`, error.message);
                }
                // Continue with next batch
            }
        }

        if (errorCount > 0) {
            console.log(`   ⚠️  Completed with ${errorCount} errors (${successCount} batches succeeded)`);
        }

        await chinookDataSource.destroy();
        console.log('✅ SQL Server Chinook database initialized successfully!');

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

initMSSQL();
