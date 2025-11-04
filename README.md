# Database Explorer Tool

A database introspection and query tool designed to help AI assistants like Claude Code interact with SQL databases using natural language. This tool provides read-only access to databases, enabling schema exploration, data analysis, and complex SQL query generation.

## Features

- **Read-only access**: Safe database exploration with enforced read-only operations
- **Multiple database support**: MySQL/MariaDB, PostgreSQL, and SQLite
- **Named connections**: Define and switch between multiple database connections
- **Schema introspection**: Explore database structure and relationships
- **Natural language queries**: AI assistants can convert natural language to SQL
- **Claude Code skill**: Integrated as a skill for seamless AI interaction

## Quick Start with Demo Database

The easiest way to get started is with the included Docker setup and Chinook sample database:

```bash
# 1. Install dependencies
npm install

# 2. Download Chinook sample database
npm run setup:demo

# 3. Start Docker databases
docker-compose up -d

# 4. Verify everything is working
npm run verify:docker

# 5. Try some queries!
tsx src/query-db.ts tables
tsx src/query-db.ts query "SELECT * FROM Artist LIMIT 5"
```

The Chinook database represents a digital media store with artists, albums, tracks, customers, invoices, and more.

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

    // Local SQLite database
    'local-dev': {
        type: 'better-sqlite3',
        database: './data/dev.sqlite',
    },
};
```

### Connection Names

- A connection named `default` will be used when the `--connection` flag is not specified
- Use any naming convention you prefer (e.g., 'production', 'staging', 'my-db')
- Switch between connections using the `--connection` or `-c` flag

## Usage

All commands are executed via the `query-db.ts` script using tsx:

### List all tables
```bash
tsx src/query-db.ts tables

# With specific connection:
tsx src/query-db.ts --connection production tables
```

### Introspect entire schema
Get all tables and their columns:
```bash
tsx src/query-db.ts introspect

# With specific connection:
tsx src/query-db.ts -c local-dev introspect
```

### Describe a specific table
```bash
tsx src/query-db.ts describe users

# With specific connection:
tsx src/query-db.ts --connection production describe orders
```

### Execute SQL queries (read-only)
```bash
tsx src/query-db.ts query "SELECT * FROM users LIMIT 10"

# With specific connection:
tsx src/query-db.ts --connection=production query "SELECT COUNT(*) FROM orders WHERE created_at > '2024-01-01'"
```

## Read-Only Enforcement

For safety, the tool enforces read-only operations. Only the following query types are allowed:
- `SELECT`
- `SHOW`
- `DESCRIBE`
- `EXPLAIN`

Any attempt to execute `INSERT`, `UPDATE`, `DELETE`, or DDL statements will be rejected with an error.

## Supported Databases

- **MySQL / MariaDB**: Full support with proper table and column introspection
- **PostgreSQL**: Full support including schema-aware queries
- **SQLite**: Full support via better-sqlite3

## Demo Databases (Docker)

This project includes a Docker Compose setup with MySQL and PostgreSQL databases pre-populated with the [Chinook sample database](https://github.com/lerocha/chinook-database).

### What is Chinook?

Chinook is a sample database representing a digital media store. It includes tables for:
- **Artists** and **Albums**: Music catalog information
- **Tracks** and **MediaTypes**: Individual songs and formats
- **Customers** and **Employees**: User and staff data
- **Invoices** and **InvoiceLines**: Sales transactions
- **Playlists**: User-created collections

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

# 3. Verify databases are running
docker-compose ps

# 4. Test the connection
tsx src/query-db.ts tables
tsx src/query-db.ts --connection chinook-postgres tables

# Or run the verification script
npm run verify:docker
```

### Managing Docker Databases

```bash
# Start databases
docker-compose up -d

# Stop databases (preserves data)
docker-compose stop

# Stop and remove databases (deletes data)
docker-compose down

# Stop and remove databases including volumes (complete cleanup)
docker-compose down -v

# View logs
docker-compose logs -f

# Restart databases
docker-compose restart
```

### Database Credentials

- **MySQL**:
  - Host: `localhost:3306`
  - Database: `chinook`
  - Username: `dbuser`
  - Password: `password`

- **PostgreSQL**:
  - Host: `localhost:5432`
  - Database: `chinook`
  - Username: `dbuser`
  - Password: `password`

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

## Testing

Run the test suite to validate your connections:

```bash
tsx src/db-query.spec.ts
```

The test suite will:
- Discover all connections in your `config.ts`
- Test each available connection
- Verify all commands (tables, introspect, describe, query)
- Validate read-only enforcement

## Security Considerations

- **Credentials**: The `config.ts` file is excluded from git (via `.gitignore`) to prevent committing credentials
- **Read-only access**: Use database users with read-only permissions
- **Query validation**: All queries are validated before execution
- **Connection strings**: Never commit connection strings with real credentials
- **Production access**: Consider using read-only replicas for production database access

## Project Structure

```
.
├── config.ts                          # Your database connections (gitignored)
├── config.example.ts                  # Example configuration
├── src/
│   ├── query-db.ts                   # Main CLI tool
│   └── test-db-query.ts              # Test suite
├── .claude/
│   └── skills/
│       └── database-explorer/
│           ├── SKILL.md              # Skill documentation
│           ├── config.ts             # Skill config helper
│           └── README.md             # Skill README
└── README.md                          # This file
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

[Your chosen license]


