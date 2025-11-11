# Database Explorer Tool

A database introspection and query tool designed to help AI assistants like Claude Code interact with SQL databases 
using natural language. This tool provides read-only access to databases, enabling schema exploration, 
data analysis, and complex SQL query generation.

## Features

- **Read-only access**: Safe database exploration with enforced read-only operations
- **Multiple database support**: MySQL/MariaDB, PostgreSQL, and SQLite
- **Named connections**: Define and switch between multiple database connections
- **Schema introspection**: Explore database structure and relationships
- **Natural language queries**: AI assistants can convert natural language to SQL
- **Claude Code skill**: Integrated as a skill for seamless AI interaction

## Quick Start

Install dependencies

```bash
npm install
```

Add your database details to `config.ts` as the default connection:

```ts
import { DataSourceOptions } from 'typeorm';

export const connections: Record<string, DataSourceOptions> = {
    // Default connection (used when --connection is not specified)
    default: {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'password',
        database: 'my_database',
    },
    // ...
}
```

Run Claude Code and use the `database-explorer` skill:

```
Create a report of sales from the past month
```

## Testing with Demo Database

To try out the db-tool with some sample data, use the included Docker setup and Chinook sample database:

```bash
# 1. Install dependencies
npm install

# 2. Download Chinook sample database
npm run setup:demo

# 3. Start Docker databases
docker-compose up -d

# 5. Try some queries!
tsx src/query-db.ts tables
tsx src/query-db.ts query "SELECT * FROM Artist LIMIT 5"
```

The [Chinook database](https://github.com/lerocha/chinook-database) represents a digital media store with artists, albums, tracks, customers, invoices, and more.

## Configuration

The tool uses a `config.ts` file in the project root to define named database connections. Each connection has a unique name and TypeORM DataSourceOptions.

### Example Configuration

```typescript
import { DataSourceOptions } from 'typeorm';

export const connections: Record<string, DataSourceOptions> = {
    // Default connection (used when --connection is not specified)
    default: {
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        username: 'root',
        password: 'password',
        database: 'my_database',
    },

    // Production database
    production: {
        type: 'postgres',
        host: 'prod.example.com',
        port: 5432,
        username: 'readonly_user',
        password: 'secure_password',
        database: 'prod_db',
    },
};
```

### Connection Names

- A connection named `default` will be used when the `--connection` flag is not specified
- Use any naming convention you prefer (e.g., 'production', 'staging', 'my-db')
- Switch between connections using the `--connection` or `-c` flag

## Usage

All commands are executed via the `query-db.ts` script using tsx:

```bash
# list all tables
tsx src/query-db.ts --connection production tables

# introspect entire schema
tsx src/query-db.ts introspect

# introspect single table
tsx src/query-db.ts describe users

# run SQL query
tsx src/query-db.ts query "SELECT * FROM users LIMIT 10"
```

### Command-Line Flags

All commands support the following optional flags:

- **`--connection <name>`** or **`-c <name>`**: Specify which database connection to use (from `config.ts`)
  - If not specified, the `default` connection is used
  - Example: `tsx src/query-db.ts --connection production tables`

- **`--no-log`**: Disable query logging to the `output/logs` directory
  - By default, all queries and their results are logged to `output/logs/<connection_name>.md`
  - Use this flag to prevent logging (useful for tests or sensitive queries)
  - Example: `tsx src/query-db.ts --no-log query "SELECT * FROM users"`

### Query Logging

By default, all executed queries and their results are automatically logged to connection-specific markdown files in the `output/logs` directory:

- **Log location**: `output/logs/<connection_name>.md`
- **Log format**: Markdown with timestamp, SQL query, and JSON results
- **Disable logging**: Use the `--no-log` flag

## Supported Databases

- **MySQL / MariaDB**: Full support with proper table and column introspection
- **PostgreSQL**: Full support including schema-aware queries
- **SQLite**: Full support via better-sqlite3
- **Microsoft SQL Server**: Full support with proper table and column introspection

## Demo Databases (Docker)

This project includes a Docker Compose setup with MySQL, PostgreSQL, and SQL Server databases pre-populated with the [Chinook sample database](https://github.com/lerocha/chinook-database).

This makes it perfect for testing queries like:
- "Show me the top 10 best-selling tracks"
- "What are the total sales by country?"
- "Which artists have the most albums?"

See [CHINOOK.md](./CHINOOK.md) for a complete schema reference with example queries.

### Setting Up Demo Databases

```bash
# 1. Download the Chinook SQL files
npm run setup:demo

# 2. Start the Docker containers
docker-compose up -d

# 3. Initialize the SQL Server database (required for SQL Server only)
npm run init:mssql

# 4. Verify databases are running
docker-compose ps

# 5. Test the connections
tsx src/query-db.ts tables
tsx src/query-db.ts --connection chinook-postgres tables
tsx src/query-db.ts --connection chinook-mssql tables

# Or run the verification script
npm run verify:docker
```

**Note**: SQL Server runs on port 14330 (instead of the default 1433) to avoid conflicts. The SQL Server container uses platform emulation on Apple Silicon Macs, which may result in slower startup times.

## Claude Code Skill

This tool includes a Claude Code skill for seamless AI interaction. The skill enables Claude to:
- Convert natural language questions into SQL queries
- Explore database schemas automatically
- Generate reports and insights from data
- Suggest optimizations and explain query results

### Using the Skill

Once configured, Claude Code can automatically use this skill when you ask database-related questions:

```
"How many users signed up last month?"
"Show me the top 10 products by revenue"
"What's the average order value for customers in California?"
```

Claude will automatically introspect the schema, formulate appropriate SQL queries, and present the results in a user-friendly format.

## Tests

```bash
docker compose up -d # start the demo database containers
tsx src/db-query.spec.ts # run the tests
```

## Security Considerations

- **Credentials**: The `config.ts` file is excluded from git (via `.gitignore`) to prevent committing credentials
- **Read-only access**: Use database users with read-only permissions
- **Query validation**: All queries are validated before execution
- **Connection strings**: Never commit connection strings with real credentials
- **Production access**: Consider using read-only replicas for production database access

For safety, the tool enforces read-only operations. Only the following query types are allowed:
- `SELECT`
- `SHOW`
- `DESCRIBE`
- `EXPLAIN`

Any attempt to execute `INSERT`, `UPDATE`, `DELETE`, or DDL statements will be rejected with an error.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT


