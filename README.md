# Sherlock

A read-only database query tool for AI assistants. Single binary, secure credential management, works with PostgreSQL, MySQL, and SQLite.

## Features

- **Single binary** - 57MB standalone executable, no runtime dependencies
- **Secure credentials** - OS keychain or environment variables, never plaintext in config
- **Read-only enforced** - Only SELECT, SHOW, DESCRIBE, EXPLAIN queries allowed
- **Explicit connections** - Must specify which database to query (no accidental production queries)
- **Multiple databases** - PostgreSQL, MySQL/MariaDB, SQLite
- **Claude Code integration** - Works as a skill for AI-assisted database exploration

## Installation

### From Binary

Download the latest release for your platform and add to your PATH:

```bash
# macOS / Linux
chmod +x sherlock
sudo mv sherlock /usr/local/bin/
```

### From Source (requires Bun 1.3+)

```bash
git clone <repo>
cd db-tool
bun install
bun build ./src/query-db.ts --compile --outfile sherlock
```

## Quick Start

### 1. Set up your first connection

```bash
sherlock setup
```

This interactive wizard will:
- Create config at `~/.config/sherlock/config.json`
- Store your password securely in the OS keychain
- Test the connection

### 2. Query your database

```bash
# List tables
sherlock -c mydb tables

# Describe a table
sherlock -c mydb describe users

# Run a query
sherlock -c mydb query "SELECT * FROM users LIMIT 10"

# Full schema introspection
sherlock -c mydb introspect
```

## Configuration

Config lives at `~/.config/sherlock/config.json`:

```json
{
  "version": "2.0",
  "connections": {
    "prod-db": {
      "type": "postgres",
      "host": "prod.example.com",
      "port": 5432,
      "database": "myapp",
      "username": { "$env": "PROD_DB_USER" },
      "password": { "$keychain": "prod-db" }
    },
    "local-mysql": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "database": "myapp",
      "username": { "$env": "LOCAL_DB_USER" },
      "password": { "$env": "LOCAL_DB_PASS" }
    }
  }
}
```

### Credential Sources

Credentials can come from:

| Source | Config syntax | Notes |
|--------|--------------|-------|
| Environment variable | `{ "$env": "VAR_NAME" }` | Also reads from `~/.config/sherlock/.env` |
| OS Keychain | `{ "$keychain": "account-name" }` | macOS Keychain, Windows Credential Manager, Linux Secret Service |

### Managing Keychain Credentials

```bash
# Store a password
sherlock keychain set prod-db

# Check which connections have keychain passwords
sherlock keychain list

# Delete a password
sherlock keychain delete prod-db
```

## Commands

### Database Commands (require `-c <connection>`)

```bash
sherlock -c <conn> tables              # List all tables
sherlock -c <conn> describe <table>    # Show table schema
sherlock -c <conn> introspect          # Full schema dump (JSON)
sherlock -c <conn> query "SELECT ..."  # Execute read-only query
```

### Management Commands

```bash
sherlock connections          # List configured connections
sherlock test <connection>    # Test a connection
sherlock setup                # Interactive setup wizard
sherlock add                  # Add a new connection (interactive)
sherlock edit                 # Edit/delete connections (interactive)
sherlock manage               # Connection manager menu
```

### Options

```bash
-c, --connection <name>    # Required for DB commands
--config <path>            # Override config file location
--no-log                   # Disable query logging
```

## Query Logging

By default, queries are logged to `~/.config/sherlock/logs/<connection>.md`. Disable with `--no-log`.

## Claude Code Skill

Sherlock integrates with Claude Code as the `database-explorer` skill. Once configured, ask questions like:

- "Show me the top 10 customers by order value"
- "What's the schema of the users table?"
- "How many orders were placed last month?"

Claude will use Sherlock to introspect schemas and run queries.

## Demo Database

Test with the included Chinook sample database:

```bash
# Download sample data and start Docker containers
bun run setup:demo
docker-compose up -d

# Add the demo connection
sherlock setup  # or manually add to config

# Try some queries
sherlock -c chinook tables
sherlock -c chinook query "SELECT Name FROM Artist LIMIT 5"
```

## Security

- **Read-only enforced** - INSERT, UPDATE, DELETE, DROP etc. are blocked
- **No default connection** - Must explicitly specify `-c` to prevent accidents
- **Secure credential storage** - Keychain or env vars, never plaintext
- **Config permissions** - Files created with 0600 (owner read/write only)
- **Query validation** - Dangerous keywords blocked even in subqueries

### Allowed Query Types

- `SELECT`
- `SHOW`
- `DESCRIBE`
- `EXPLAIN`
- `WITH` (CTEs)

## Building

```bash
# Development
bun run src/query-db.ts -c mydb tables

# Build binary
bun build ./src/query-db.ts --compile --outfile sherlock

# Cross-platform builds
bun build ./src/query-db.ts --compile --target=bun-darwin-arm64 --outfile sherlock-macos-arm64
bun build ./src/query-db.ts --compile --target=bun-linux-x64 --outfile sherlock-linux-x64
```

## License

MIT
