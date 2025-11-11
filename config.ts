export const connections: Record<string, DataSourceOptions> = {
    default: {
        type: 'mssql',
        host: process.env.SQL_HOST || 'localhost',
        port: parseInt(process.env.SQL_PORT || '1433'),
        username: process.env.SQL_USERNAME,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DATABASE,
        options: {
            encrypt: process.env.SQL_ENCRYPT === 'true',
            trustServerCertificate: process.env.SQL_TRUST_CERT === 'true',
        },
    }
};
