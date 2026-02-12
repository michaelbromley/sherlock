# Sherlock

A read-only database query tool for AI assistants. Single binary, secure credential management, works with PostgreSQL, MySQL, and SQLite.

## Features

- **Single binary** - 57MB standalone executable, no runtime dependencies
- **Secure credentials** - OS keychain or environment variables, never plaintext in config
- **Read-only enforced** - Only SELECT, SHOW, DESCRIBE, EXPLAIN queries allowed
- **Explicit connections** - Must specify which database to query (no accidental production queries)
- **Multiple databases** - PostgreSQL, MySQL/MariaDB, SQLite
- **Claude Code integration** - Works as a skill for AI-assisted database exploration

## Quick Start

### 1. Install

```bash
curl -fsSL https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.sh | bash
```

This installs the `sherlock` binary and the Claude Code skill.

#### Windows (PowerShell)

From sourcecode:

```powershell
npm run build:windows   # build dist/sherlock-windows.exe first
.\install.ps1           # installs from local dist/
```

### 2. Set up a connection

```bash
sherlock setup
```

The interactive wizard will guide you through:
- Database type (PostgreSQL, MySQL, SQLite)
- Connection details (host, port, database, credentials)
- Secure password storage (OS keychain or env file)

### 3. Use with Claude Code

Once configured, just ask Claude Code questions about your data:

> "Show me the top 10 customers by order value from prod-db"

> "What tables are in the staging database?"

> "How many users signed up last week?"

Claude will use Sherlock to explore schemas and run queries on your behalf.

## Upgrading

Run the same install command to upgrade to the latest version:

```bash
curl -fsSL https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.sh | bash
```

On Windows:

```powershell
irm https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.ps1 | iex
```

The installer will detect your existing installation, preserve your `config.json`, and show the version change:

```
==> Existing installation found (v0.0.1) - upgrading...
==> Upgrade complete! (v0.0.1 -> v0.0.3)
```

---

## Manual Installation

### From Binary

Download from [GitHub Releases](https://github.com/michaelbromley/sherlock/releases) and add to your PATH:

```bash
chmod +x sherlock
mv sherlock ~/.local/bin/
```

### From Source (requires Bun 1.3+)

```bash
git clone https://github.com/michaelbromley/sherlock
cd sherlock
bun install
bun build ./src/query-db.ts --compile --outfile sherlock
```

## Commands

### Query your database

```bash
sherlock -c mydb tables                         # List tables
sherlock -c mydb describe users                 # Show table schema
sherlock -c mydb query "SELECT * FROM users LIMIT 10"
sherlock -c mydb introspect                     # Full schema dump (cached)
sherlock -c mydb introspect --refresh           # Refresh cached schema
sherlock -c mydb sample users -n 10             # Random sample rows
sherlock -c mydb stats users                    # Data profiling (nulls, distinct)
sherlock -c mydb indexes users                  # Show table indexes
sherlock -c mydb fk users                       # Foreign key relationships
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
    "local-dev": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "database": "myapp",
      "username": { "$env": "LOCAL_DB_USER" },
      "password": { "$env": "LOCAL_DB_PASS" },
      "logging": true
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
sherlock -c <conn> introspect          # Full schema dump (cached)
sherlock -c <conn> introspect --refresh # Refresh cached schema
sherlock -c <conn> query "SELECT ..."  # Execute read-only query
sherlock -c <conn> sample <table>      # Random sample rows (-n <limit>)
sherlock -c <conn> stats <table>       # Data profiling (row count, nulls, distinct)
sherlock -c <conn> indexes <table>     # Show table indexes
sherlock -c <conn> fk <table>          # Foreign key relationships
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
--no-log                   # Disable query logging (overrides config)
-f, --format <format>      # Output format: json (default) or markdown
```

## Query Logging

Query logging is **disabled by default** to protect sensitive production data. When enabled, queries and results are logged to `~/.config/sherlock/logs/<connection>.md`.

### Enabling Logging

Enable logging per-connection in your config:

```json
{
  "connections": {
    "local-dev": {
      "type": "postgres",
      "logging": true
    }
  }
}
```

Or toggle it via the interactive wizard:

```bash
sherlock edit
# Select connection → Toggle query logging
```

The `--no-log` CLI flag can override to force logging off even if enabled in config.

## Claude Code Skill

Sherlock integrates with Claude Code as the `sherlock` skill. Once configured, ask questions like:

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

## Releasing a New Version

1. Update the version in `package.json`
2. Add release notes to `CHANGELOG.md`
3. Commit the changes:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Bump version to X.Y.Z"
   ```
4. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin main --tags
   ```

The GitHub Actions workflow will automatically build binaries for all platforms and create a release.

## License

MIT
