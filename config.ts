import { DataSourceOptions } from 'typeorm';

/**
 * Define your named database connections here.
 * Copy this file to config.ts and update with your actual database credentials.
 *
 * The 'default' connection will be used when no --connection flag is specified.
 *
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

    /**
     * To use the Docker demo databases:
     * 1. Run: npm run setup:demo
     * 2. Run: docker-compose up -d
     * 3. Use the 'chinook-mysql' or 'chinook-postgres' connections below
     *
     * These connections are also used for the `db-query.spec.ts` tests
     */
    'chinook-mysql': {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'dbuser',
        password: 'password',
        database: 'chinook',
    },
    'chinook-postgres': {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'dbuser',
        password: 'password',
        database: 'chinook',
    },
};
