import { DataSourceOptions } from 'typeorm';

/**
 * Define your named database connections here.
 * Copy this file to config.ts and update with your actual database credentials.
 *
 * The 'default' connection will be used when no --connection flag is specified.
 *
 * To use the Docker demo databases:
 * 1. Run: npm run setup:demo
 * 2. Run: docker-compose up -d
 * 3. Use the 'chinook-mysql' or 'chinook-postgres' connections below
 */
export const connections: Record<string, DataSourceOptions> = {
    // Default connection: Docker MySQL with Chinook sample database
    default: {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'dbuser',
        password: 'password',
        database: 'chinook',
    },

    // Docker MySQL connection with Chinook sample database
    'chinook-mysql': {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'dbuser',
        password: 'password',
        database: 'chinook',
    },

    // Docker PostgreSQL connection with Chinook sample database
    'chinook-postgres': {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'dbuser',
        password: 'password',
        database: 'chinook',
    },

    // Example SQLite connection
    'local-sqlite': {
        type: 'better-sqlite3',
        database: './data/local.sqlite',
    },

    // Example production connection (update with your credentials)
    production: {
        type: 'postgres',
        host: 'your-production-host.com',
        port: 5432,
        username: 'readonly_user',
        password: 'your_secure_password',
        database: 'production_db',
        // Optional: use SSL for production
        // ssl: { rejectUnauthorized: false },
    },
};
