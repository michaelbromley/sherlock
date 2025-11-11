# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Database Explorer Tool - A TypeScript-based tool for safe, read-only SQL database introspection and querying. Designed to enable AI assistants to interact with databases using natural language queries. Supports MySQL/MariaDB, PostgreSQL, SQLite, and Microsoft SQL Server.

## Architecture

### Core Components

1. **query-db.ts** (`src/query-db.ts`): Main CLI application using Commander.js
   - Handles command routing (tables, introspect, describe, query)
   - Manages database connections via TypeORM DataSource
   - Enforces read-only access (only SELECT, SHOW, DESCRIBE, EXPLAIN allowed)
   - Implements query logging to `output/logs/<connection_name>.md`

2. **load-config.ts** (`src/load-config.ts`): Configuration loader
   - Loads named connections from `config.ts`
   - Validates connection existence
   - Returns TypeORM DataSourceOptions

3. **config.ts**: Connection configuration (gitignored)
   - Defines named database connections
   - Supports MySQL, PostgreSQL, and SQLite
   - `default` connection used when `--connection` flag not specified

4. **Claude Code Skill** (`.claude/skills/database-explorer/`):
   - Integrates tool as a Claude Code skill
   - Enables natural language to SQL conversion
   - Provides workflow guidance for database exploration

## Commands

### Development Setup
```bash
# Install dependencies
npm install

# Set up demo databases with Chinook sample data
npm run setup:demo

# Start Docker databases (MySQL, PostgreSQL, SQL Server)
docker-compose up -d

# Initialize SQL Server database (required for SQL Server)
npm run init:mssql

# Run tests
npm test
```

### Database Commands
All commands use `tsx src/query-db.ts` with optional flags:
- `--connection <name>` or `-c <name>`: Specify database connection
- `--no-log`: Disable query logging

```bash
# List all tables
tsx src/query-db.ts tables
tsx src/query-db.ts -c chinook-postgres tables

# Get full schema introspection
tsx src/query-db.ts introspect

# Describe specific table
tsx src/query-db.ts describe Artist

# Execute SQL query (read-only)
tsx src/query-db.ts query "SELECT * FROM Artist LIMIT 5"
```

## Query Formatting by Database Type

When executing queries, use appropriate identifier quoting based on the connection type in `config.ts`:

- **MySQL/MariaDB**: Use backticks for identifiers
  ```sql
  SELECT `id`, `name` FROM `users` WHERE `created_at` > '2024-01-01'
  ```

- **PostgreSQL/SQLite**: Use double quotes for identifiers
  ```sql
  SELECT "id", "name" FROM "users" WHERE "created_at" > '2024-01-01'
  ```

- **Microsoft SQL Server**: Use square brackets for identifiers
  ```sql
  SELECT [id], [name] FROM [users] WHERE [created_at] > '2024-01-01'
  ```

## Testing

Tests use the Chinook demo databases (MySQL, PostgreSQL, and SQL Server):

```bash
# Ensure Docker containers are running
docker-compose up -d

# Initialize SQL Server
npm run init:mssql

# Run test suite
tsx src/db-query.spec.ts
```

The test suite validates all commands (tables, introspect, describe, query) against configured `chinook-*` connections.

## Output Structure

- **Query logs**: `output/logs/<connection_name>.md` - Timestamped queries and results
- **Reports**: Save to `output/reports/<connection_name>/<descriptive_filename>.md` when users request reports

## Key Implementation Details

1. **Read-only enforcement**: Query validation in `query-db.ts` prevents destructive operations
2. **Connection management**: Uses TypeORM DataSource with automatic cleanup
3. **Error handling**: Structured JSON error output with stack traces
4. **Result truncation**: Logs show max 10 rows to prevent log bloat
5. **Commander.js CLI**: Structured command handling with proper option parsing

## Security Considerations

- `config.ts` is gitignored to prevent credential commits
- Tool enforces read-only operations at query validation level
- Recommend using read-only database users for production connections
- Query logs may contain sensitive data - ensure `output/` directory is properly secured

## Dependencies

Key packages:
- `typeorm`: Database abstraction and connection management
- `commander`: CLI framework
- `tsx`: TypeScript execution without compilation
- Database drivers: `mysql2`, `pg`, `better-sqlite3`, `mssql`

## SQL Server Specific Notes

- SQL Server connection uses the `mssql` package (Tedious driver)
- Docker container runs on port 14330 (not default 1433) to avoid conflicts
- Database initialization requires separate script (`npm run init:mssql`) due to SQL Server Docker image limitations
- Platform emulation on Apple Silicon may result in slower startup times
- Uses square bracket `[]` identifier quoting instead of backticks or double quotes