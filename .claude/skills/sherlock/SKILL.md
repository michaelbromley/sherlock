---
name: sherlock
description: Allows read-only access to SQL databases and Redis for querying and analysis using natural language
allowed-tools:
   - Bash(~/.claude/skills/sherlock/sherlock:*)
---

# Sherlock

Read-only database access for SQL and Redis. Binary: `~/.claude/skills/sherlock/sherlock`

## Ad Hoc Connections (`--url`)

Use `--url` (`-u`) to connect directly via a database URL without any config file setup. This is ideal when a project has a `DATABASE_URL` in its `.env` file.

```bash
sherlock -u "postgres://user:pass@localhost:5432/mydb" tables
sherlock -u "mysql://user:pass@localhost:3306/mydb" query "SELECT 1"
sherlock -u "redis://localhost:6379" info
```

- `--url` and `-c` are mutually exclusive — use one or the other
- Database type is auto-detected from the URL prefix (`postgres://`, `mysql://`, `sqlite://`, `redis://`)
- Schema caching and introspection work normally (cached under a synthetic name derived from the URL)
- Query logging is disabled for ad hoc connections

**When to use `--url` vs `-c`:** Use `--url` for quick one-off access, especially when the project already has a `DATABASE_URL`. Use `-c` for repeated access to the same database with config-managed credentials.

## SQL Commands

All SQL commands require `-c <connection>` or `-u <url>`. Output is JSON by default, use `-f markdown` for tables.

```bash
sherlock connections                    # List available connections
sherlock -c <conn> tables               # List tables
sherlock -c <conn> describe <table>     # Table schema
sherlock -c <conn> introspect           # Full schema (cached)
sherlock -c <conn> introspect --refresh # Refresh cached schema
sherlock -c <conn> query "SELECT ..."   # Execute read-only query
sherlock -c <conn> sample <table> -n 10 # Random sample rows
sherlock -c <conn> stats <table>        # Data profiling (nulls, distinct counts)
sherlock -c <conn> indexes <table>      # Table indexes
sherlock -c <conn> fk <table>           # Foreign key relationships
```

## Redis Commands

All Redis commands require `-c <connection>` pointing to a Redis connection.

```bash
sherlock -c <conn> info                 # Server info, memory, keyspace
sherlock -c <conn> info --section memory # Specific INFO section
sherlock -c <conn> keys "user:*"        # Scan for keys matching pattern
sherlock -c <conn> keys --limit 50      # Limit number of results
sherlock -c <conn> get <key>            # Get value (auto-detects type)
sherlock -c <conn> get <key> --limit 50 # Limit items for lists/sets/zsets
sherlock -c <conn> inspect <key>        # Key metadata (type, TTL, memory, encoding)
sherlock -c <conn> slowlog              # Recent slow queries
sherlock -c <conn> slowlog -n 20        # Last 20 slow log entries
sherlock -c <conn> command GET mykey    # Execute any read-only Redis command
```

## Setting Up a Connection

Add a connection without the interactive wizard. The password is read from stdin and stored in the OS keychain, so it never appears in the process list or the shell history.

```bash
# a database behind a northflank addon tunnel
printf '%s' "$PASSWORD" | sherlock connection add prod \
  --type postgres --host db.example.com --database app --username dbuser \
  --password-stdin --ssl require --tunnel-northflank my-project/my-addon

# a plain database, no tunnel
printf '%s' "$PASSWORD" | sherlock connection add local \
  --from-url postgres://dbuser@localhost:5432/app --password-stdin

# a tunnel through anything else; {{port}} receives a free local port
printf '%s' "$PASSWORD" | sherlock connection add bastion \
  --type postgres --host db.internal --database app --username dbuser --password-stdin \
  --tunnel-command 'ssh -N -L {{port}}:db.internal:5432 bastion.example.com'
```

- `--from-url <url>` replaces `--host`, `--port`, `--username` and `--database`. A password in the URL is ignored, since it would already be in the shell history. This is a separate flag from the global `-u/--url`, which connects to a URL without saving it.
- `--password-env VAR` stores only the variable name. Sherlock reads the password from that variable on each query.
- `--ssl` takes `off`, `require` or `verify`. `require` is right for most managed databases.
- `--tunnel-northflank <project>/<addon>` writes the full `northflank forward --skipHostnames` command, and the pattern that reads the port back out of that command's output. Ask the user for the project and addon names if you do not know them.
- `--force` replaces an existing connection of the same name. Without it, an existing name is an error.
- Bad flag combinations fail immediately with a message naming the flag, before anything is written.

Ask the user for the password rather than guessing it, and never pass it as a command-line argument.

## Tunnelled Connections

Some connections reach the database through a port-forwarding process (Northflank, kubectl, ssh). Sherlock starts that tunnel on the first query and reuses it for later commands. You do not need to open one yourself.

```bash
sherlock tunnel status                  # Show running tunnels
sherlock tunnel stop <conn>             # Stop one tunnel
sherlock tunnel stop                    # Stop all tunnels
```

**Stop the tunnel when you have finished with a database.** An idle tunnel shuts itself down eventually, so leaving one running does no harm. Stopping it releases the database connection and the local port straight away.

If a tunnel fails to start, the error includes the forwarding command's own output. Read it before retrying. The usual causes are a missing CLI and an expired login. A command that needs `sudo` cannot work at all, because the tunnel runs with no terminal for sudo to prompt at, and the error names the alternatives.

## Constraints

- **Read-only**: SQL allows SELECT, SHOW, DESCRIBE, EXPLAIN, WITH only. Redis allows read commands only (GET, HGETALL, SCAN, etc.) — mutations (SET, DEL, HSET, etc.) are blocked.
- **Connection required**: Always specify `-c <connection>` or `-u <url>` (no default)
- **Type-aware**: SQL commands only work with SQL connections, Redis commands only work with Redis connections
- **Quoting**: PostgreSQL/SQLite use `"identifier"`, MySQL uses `` `identifier` ``

## SQL Workflow

1. Run `connections` to see available databases
2. Use `tables` or `introspect` to understand schema (introspect is cached per-connection)
3. Use `fk` to understand table relationships before writing JOINs
4. Use `sample` to see real data examples before writing queries
5. Write SQL based on user's question and schema
6. Execute with `query`, present results clearly

## Redis Workflow

1. Run `connections` to see available connections
2. Use `info` to understand the Redis instance (version, memory, keyspace)
3. Use `keys "pattern:*"` to find keys of interest
4. Use `get <key>` to retrieve values (auto-detects string/hash/list/set/zset)
5. Use `inspect <key>` for metadata (TTL, memory usage, encoding)
6. Use `command` for any other read-only operation

## Tips

- Always use LIMIT to avoid large result sets
- Use `stats` for SQL data profiling (row counts, null counts, distinct values)
- Use `-f markdown` for human-readable table output
- For Redis, use `keys` with specific patterns rather than `*` on large databases
- Use `--no-types` with `keys` for faster scanning when type info isn't needed
- Config: `~/.claude/skills/sherlock/config.json`
