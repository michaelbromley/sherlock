# Sherlock

A read-only database query tool for AI assistants. Single binary, secure credential management, works with PostgreSQL, MySQL, SQLite, and Redis.

## Features

- **Single binary** - 57MB standalone executable, no runtime dependencies
- **Secure credentials** - OS keychain or environment variables, never plaintext in config
- **Read-only enforced** - SQL: only SELECT/SHOW/DESCRIBE/EXPLAIN. Redis: read-only command whitelist
- **Explicit connections** - Must specify which database to query (no accidental production queries)
- **Multiple databases** - PostgreSQL, MySQL/MariaDB, SQLite, Redis
- **SSL/TLS support** - Works with managed databases (Northflank, Supabase, Neon, RDS, Azure SQL) that require encrypted connections
- **Automatic tunnels** - Databases behind a port-forward (Northflank, kubectl, ssh) open on first use and shut down when idle
- **Paste a connection string** - Set up new connections by pasting a URL — sherlock parses out host, port, user, password, database, and SSL settings
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

The interactive wizard offers two ways to add a connection:

- **Paste a connection string** — paste a URL like `postgres://user:pass@host:5432/db?sslmode=require` and sherlock pulls out the host, port, user, password, database, and SSL settings. You'll only be prompted for whatever's missing.
- **Enter details manually** — answer prompts for database type, host, port, database name, credentials, and SSL/TLS.

After the details, you'll choose secure password storage (OS keychain or env file).

#### Without the wizard

`sherlock connection add` sets up a connection in one command, for scripting or for asking Claude to do it. The password is read from stdin and stored in the OS keychain, so it never appears in the process list or the shell history.

```bash
printf '%s' "$PASSWORD" | sherlock connection add prod \
  --type postgres --host db.example.com --database app --username dbuser \
  --password-stdin --ssl require
```

`--from-url postgres://dbuser@host:5432/app` replaces the individual flags. `--password-env VAR` stores a reference to an environment variable instead of a keychain entry. `--tunnel-command`, `--tunnel-northflank` and the other tunnel flags are covered under [Tunnels](#tunnels). Run `sherlock connection add --help` for the full list.

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
      "password": { "$keychain": "prod-db" },
      "ssl": true
    },
    "local-dev": {
      "type": "mysql",
      "host": "localhost",
      "port": 3306,
      "database": "myapp",
      "username": { "$env": "LOCAL_DB_USER" },
      "password": { "$env": "LOCAL_DB_PASS" },
      "logging": true
    },
    "redis-cache": {
      "type": "redis",
      "host": "localhost",
      "port": 6379,
      "password": { "$keychain": "redis-cache" },
      "database": "0"
    }
  }
}
```

### SSL/TLS

Add `ssl` to any connection to enable encryption. Managed databases (Northflank, Supabase, Neon, RDS, Azure SQL) typically require this:

| Value | Behaviour |
|---|---|
| omitted / `false` | No SSL (default) |
| `true` | Require SSL, do not verify server certificate — works for most managed DBs |
| `{ "rejectUnauthorized": true }` | Require SSL **and** verify the certificate against system CAs |

The `manage` wizard offers these as three options ("No SSL" / "Require SSL (accept any cert)" / "Require SSL + verify cert"). Use "Configure SSL/TLS" in the edit menu to change SSL on an existing connection.

If you pass an `ssl` field alongside a raw `url:` (instead of individual host/port fields), sherlock overlays the SSL settings onto the URL — handy when you've stored a `DATABASE_URL` and want to enable SSL without rewriting it.

### Tunnels

Some databases are only reachable through a port-forwarding process: a Northflank addon, a Kubernetes service, a host behind a bastion. Give the connection a `tunnel` block and sherlock starts the forwarding command on the first query, reuses it for later commands, and shuts it down once it has gone unused.

```json
{
  "connections": {
    "prod-behind-bastion": {
      "type": "postgres",
      "username": "vendure",
      "password": { "$keychain": "prod-behind-bastion" },
      "database": "vendure",
      "ssl": true,
      "tunnel": {
        "command": "ssh -N -L {{port}}:db.internal:5432 bastion.example.com",
        "idleTimeout": "10m"
      }
    }
  }
}
```

| Field | Required | Behaviour |
|---|---|---|
| `command` | yes | Shell command that forwards the remote database to a local port |
| `localPort` | no | Fixed local port. When omitted, sherlock picks a free one and substitutes it for `{{port}}` |
| `endpointPattern` | no | Regex that reads the endpoint out of the command's own output, for tools that choose their own port |
| `idleTimeout` | no | Shut down after this long with no queries (default `10m`) |
| `readyTimeout` | no | How long to wait for the port to start accepting (default `30s`) |

Write `{{port}}` wherever the command takes the local port. Sherlock replaces it with the port it allocated, so parallel tunnels never collide. Tools that take a port this way include `ssh -L`, `cloud-sql-proxy`, and `kubectl port-forward`. If the forwarding command needs a fixed port, set `localPort` instead and hard-code the same port in the command. If it takes no port at all, see the next section.

#### Tools that choose their own port

Some forwarding commands take no port argument and choose one themselves, printing it on startup. For those, set `endpointPattern` to a regex with a named `port` group and an optional named `host` group, and sherlock reads the endpoint out of the command's output instead of dictating it.

Northflank works this way. Its `forward` command needs root by default, because it writes the addon's hostname into `/etc/hosts`. Passing `--skipHostnames` removes that requirement, and the CLI's own help says "no root permissions are required". With that flag the addon is exposed on an IP address and northflank chooses the port:

```json
"northflank-prod": {
  "type": "postgres",
  "host": "pg.northflank.internal",
  "username": "vendure",
  "password": { "$keychain": "northflank-prod" },
  "database": "vendure",
  "ssl": true,
  "tunnel": {
    "command": "northflank forward addon --project my-proj --addon pg --skipHostnames",
    "endpointPattern": "exposed on (?<host>[\\d.]+):(?<port>\\d+)"
  }
}
```

`kubectl port-forward svc/postgres :5432` behaves the same way, and matches `"Forwarding from 127\\.0\\.0\\.1:(?<port>\\d+)"`.

`endpointPattern` cannot be combined with `localPort` or `{{port}}`, since those dictate an endpoint rather than discovering one. If the pattern never matches, the error shows the pattern alongside the command's actual output so you can see what to change.

#### Commands that need sudo

The forwarding process runs in the background with no terminal, so that it outlives the sherlock command that started it. `sudo` therefore has nowhere to prompt for a password, and the tunnel fails immediately. Three ways round it, best first:

1. **Use the tool's no-root option** if it has one, such as Northflank's `--skipHostnames` above. Nothing else to configure.
2. **Grant that one command passwordless sudo** with a `NOPASSWD` rule in `/etc/sudoers`.
3. **Use `sudo -A`** with `SUDO_ASKPASS` pointing at a helper that supplies the password without a terminal.

Sherlock detects this failure and lists these three options in the error.

The connection's `host` and `port` are replaced by the tunnel's local endpoint, so they can be left out or left pointing at the real remote address, whichever documents the connection better.

The `sherlock manage` wizard asks whether a connection needs a tunnel when you add one, and "Configure tunnel" in the edit menu changes it later.

To set one up in a single command, `sherlock connection add` takes the same settings as flags:

```bash
# northflank, which needs no port because it announces its own
printf '%s' "$PASSWORD" | sherlock connection add vcloud-dev \
  --type postgres --database app --username dbuser --password-stdin --ssl require \
  --tunnel-northflank my-project/my-addon

# anything that takes a port
printf '%s' "$PASSWORD" | sherlock connection add bastion \
  --type postgres --host db.internal --database app --username dbuser --password-stdin \
  --tunnel-command 'ssh -N -L {{port}}:db.internal:5432 bastion.example.com'
```

`--tunnel-northflank <project>/<addon>` expands to the full `northflank forward ... --skipHostnames` command along with the pattern that reads the port back out of that command's output, so neither has to be typed by hand. `--tunnel-local-port`, `--tunnel-endpoint-pattern`, `--tunnel-idle-timeout` and `--tunnel-ready-timeout` map to the config fields above. The tunnel settings are validated as the connection is written, so a bad command or duration fails there rather than on the first query.

Manage running tunnels with:

```bash
sherlock tunnel status                 # Show running tunnels
sherlock tunnel stop northflank-prod   # Stop one tunnel
sherlock tunnel stop                   # Stop all tunnels
```

Sherlock waits for the local port to start accepting before it connects, so a tunnel that fails to come up reports the forwarding command's own error rather than a connection refusal. The forwarding command's output is kept in `~/.config/sherlock/tunnels/`.

- **Tunnels are ignored in a project-local `.sherlock.json`.** A tunnel runs a shell command. Reading one from the current directory would mean that cloning a repository and running any sherlock command executes the command that repository put in the file. Tunnels are read only from your user config directory, a config next to the binary, `--config`, or `SHERLOCK_CONFIG`.
- **`{ "rejectUnauthorized": true }` cannot work through a tunnel.** Certificate verification checks the hostname, which after tunnelling is `127.0.0.1` and will never match the database's certificate. Use `"ssl": true` to keep the connection encrypted without hostname verification. Sherlock warns if you configure both.

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

### Moving Connections to Another Machine

`sherlock config export` writes your connections, passwords included, to one file encrypted with a passphrase. `sherlock config import` adds them on the other machine.

```bash
# on your laptop
sherlock config export                  # every connection, to ./sherlock-connections.enc
sherlock config export prod -o prod.enc # only "prod"
scp sherlock-connections.enc server:

# on the server
sherlock config import sherlock-connections.enc
rm sherlock-connections.enc
```

- **Every storage method is exported.** Sherlock reads each password from the keychain, the `.env` file, an environment variable or config.json, whichever holds it. A `$env` reference whose variable is not set on the exporting machine is exported as the reference, not a value.
- **Import stores passwords in the OS keychain**, the same way `connection add --password-stdin` does. A plaintext password in the source config.json arrives in the keychain, not in plaintext.
- **With no keychain** (a headless Linux server usually has none), import asks before writing passwords in plaintext into config.json. That file is readable by your user only. Answer no and nothing is imported. On a Mac reached over SSH, the keychain is usually locked rather than missing: answer no, run `security unlock-keychain`, and import again.
- **Existing connections are skipped.** A connection whose name already exists is left alone and reported. Pass `--force` to replace it. If an import fails part-way, config.json is not changed and sherlock puts back the keychain entries it had written, naming any it could not. With `--force`, a replaced connection's `sherlock/<name>` or `sherlock.url/<name>` keychain entry is deleted if it used that entry and nothing in your user config still does. Keychain entries under any other name are never deleted.
- **Import always writes to your user config** (`~/.config/sherlock/config.json`), even when run in a directory with a `.sherlock.json`. `--config` cannot be combined with import. If commands run in that directory, or with `SHERLOCK_CONFIG` set, read a different config, import warns that they will not see the imported connections.
- **The passphrase is always typed at a prompt**, never passed as an argument or piped in, so it stays out of the shell history and the process list. It must be at least 12 characters.
- **Encryption:** scrypt (N=2¹⁷, r=8, p=1) derives the key and AES-256-GCM encrypts the file. The GCM tag covers the file's header as well as its contents. A wrong passphrase, a corrupted file and an edited file all fail to decrypt, and nothing is imported. A file that is incomplete or not an export at all is reported before you are asked for the passphrase. No plaintext copy of a password is written to disk at any point.
- **Check tunnels after import.** A tunnel command runs on the machine that imports it, so import lists every tunnel command it added.
- Delete the export file once it has been imported. It is only as safe as its passphrase.

## Commands

### SQL Commands (require `-c <connection>`)

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

### Redis Commands (require `-c <connection>`)

```bash
sherlock -c <conn> info                # Server info, memory, keyspace
sherlock -c <conn> info --section memory # Specific INFO section
sherlock -c <conn> keys "user:*"       # Scan for keys matching pattern
sherlock -c <conn> keys --limit 50     # Limit results (default 100)
sherlock -c <conn> get <key>           # Get value (auto-detects type)
sherlock -c <conn> inspect <key>       # Key metadata (type, TTL, memory, encoding)
sherlock -c <conn> slowlog             # Recent slow queries
sherlock -c <conn> command GET mykey   # Any read-only Redis command
```

### Management Commands

```bash
sherlock manage               # Connection manager (add, edit, delete, test, keychain, tunnel)
sherlock connections          # List configured connections (JSON)
sherlock test <connection>    # Test a connection
sherlock tunnel status        # Show running tunnels
sherlock tunnel stop [conn]   # Stop one tunnel, or all when no name is given
sherlock config export [conn] # Write connections and passwords to an encrypted file
sherlock config import <file> # Add the connections from an export file
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

Claude will use Sherlock to introspect schemas, run queries, and inspect Redis data.

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

- **Read-only enforced** - SQL: INSERT, UPDATE, DELETE, DROP etc. are blocked. Redis: SET, DEL, FLUSHDB etc. are blocked
- **No default connection** - Must explicitly specify `-c` to prevent accidents
- **Secure credential storage** - Keychain or env vars, never plaintext
- **Config permissions** - Files created with 0600 (owner read/write only)
- **Query validation** - SQL: dangerous keywords blocked even in subqueries. Redis: whitelist of allowed commands with subcommand validation

### Allowed SQL Query Types

- `SELECT`
- `SHOW`
- `DESCRIBE`
- `EXPLAIN`
- `WITH` (CTEs)

### Allowed Redis Commands

Read-only commands only: `GET`, `MGET`, `HGETALL`, `LRANGE`, `SMEMBERS`, `ZRANGE`, `SCAN`, `TYPE`, `TTL`, `INFO`, `DBSIZE`, `SLOWLOG GET`, `MEMORY USAGE`, and more. Mutations (`SET`, `DEL`, `HSET`, `LPUSH`, etc.) and admin commands (`FLUSHDB`, `CONFIG SET`, `SHUTDOWN`, etc.) are blocked.

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
2. Update `CHANGELOG.md` with all changes since the last release (check `git log` since the last version tag)
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
