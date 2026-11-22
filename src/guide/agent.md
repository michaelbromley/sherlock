# Sherlock: agent guide

Read-only database access for SQL and Redis, through the `sherlock` command. This guide describes the sherlock binary that printed it. For every flag of a command, run `sherlock <command> --help`.

## Ad Hoc Connections (`--url`)

Use `--url` (`-u`) to connect directly via a database URL without any config file setup. This is ideal when a project has a `DATABASE_URL` in its `.env` file.

```bash
sherlock -u "postgres://user:pass@localhost:5432/mydb" tables
sherlock -u "mysql://user:pass@localhost:3306/mydb" query "SELECT 1"
sherlock -u "redis://localhost:6379" info
```

- `--url` and `-c` are mutually exclusive — use one or the other
- Database type is auto-detected from the URL prefix (`postgres://`, `mysql://`, `mssql://`, `sqlserver://`, `sqlite://`, `redis://`, `rediss://`)
- Schema caching and introspection work normally (cached under a synthetic name derived from the URL)
- Query logging is disabled for ad hoc connections

**When to use `--url` vs `-c`:** Use `--url` for quick one-off access, especially when the project already has a `DATABASE_URL`. Use `-c` for repeated access to the same database with config-managed credentials.

## SQL Commands

All SQL commands require `-c <connection>` or `-u <url>`. Output is JSON by default. `-f markdown` prints tables instead for `query`, `sample`, `stats`, `fk` and `indexes`; other commands always print JSON.

```bash
sherlock connection list                # List connections and what each points at
sherlock doctor <conn>                  # Find out why a connection does not work
sherlock -c <conn> tables               # List tables
sherlock -c <conn> describe <table>     # Table schema
sherlock -c <conn> introspect           # Full schema (cached)
sherlock -c <conn> introspect --refresh # Refresh cached schema
sherlock -c <conn> query "SELECT ..."   # Execute read-only query
sherlock -c <conn> query --file q.sql   # Read the query from a file
sherlock -c <conn> query - < q.sql      # ...or from stdin
sherlock -c <conn> query --timeout 5m "SELECT ..."  # Allow longer than the 60s default
sherlock -c <conn> sample <table> -n 10 # Random sample rows
sherlock -c <conn> stats <table>        # Data profiling (nulls, distinct counts)
sherlock -c <conn> indexes <table>      # Table indexes
sherlock -c <conn> fk <table>           # Foreign key relationships
```

For anything longer than a line, or with quotes in it, write the SQL to a file and use `--file`, or pipe it to `query -`. A long query passed as a shell argument is easily broken by quoting. Note that `-f` is the output format, not the file.

## Redis Commands

All Redis commands require `-c <connection>` pointing to a Redis connection, or `-u redis://...`.

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
# a Northflank addon, forwarded through the Northflank API
printf '%s' "$PASSWORD" | sherlock connection add prod \
  --type postgres --host primary.pg--my-project--abc1.addon.code.run --database app --username dbuser \
  --password-stdin --ssl require \
  --tunnel-provider northflank \
  --tunnel-option context=my-team --tunnel-option project=my-project --tunnel-option addon=pg

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
- A MySQL 8 login that fails with an error naming `caching_sha2_password` needs TLS or the server's public key. Try `--ssl require` (or `?ssl-mode=REQUIRED` on a `-u` URL) first. Only if the server has no TLS, ask the user before adding `?allowPublicKeyRetrieval=true` to the `-u` or `--from-url` URL: without TLS, anyone who can intercept the connection can read the password.
- `--tunnel-provider northflank` takes its settings as repeated `--tunnel-option key=value`. It needs `context` (a login name from `northflank context ls`), `project` and `addon` (the ids from the Northflank URL, not the display names). Optional: `endpoint=read` or `endpoint=primary` (default: the read replica if the addon has one), `configDir=~/.northflank-other` when that login lives in a separate CLI config directory, and `port=<name or number>` when the addon exposes several. Ask the user for the context, project and addon if you do not know them. Set `--host` to the addon's internal hostname so `doctor` can check that the tunnel goes to the right addon.
- `--tunnel-northflank <project>/<addon>` writes a `northflank forward --skipHostnames` command tunnel instead. That uses whichever Northflank login is current in the user's terminal, so prefer `--tunnel-provider northflank`.
- `--force` replaces an existing connection of the same name. Without it, an existing name is an error.
- Bad flag combinations fail immediately with a message naming the flag, before anything is written.

Ask the user for the password rather than guessing it, and never pass it as a command-line argument.

`connection add --password-stdin` stores the password in the OS keychain. Connections created in other ways may keep it elsewhere: `{ "$env": "VAR" }` (read from the environment or the sherlock `.env` file), `{ "$keychain": "name" }`, or a plaintext string in config.json. Sherlock warns about the plaintext form on every query.

## Moving Connections to Another Machine

`sherlock config export` and `sherlock config import` move connections, passwords included, in a passphrase-encrypted file. Both need the user to type the passphrase in their own terminal, so you cannot run them yourself. When the user wants their connections on another machine, run `sherlock guide transfer` and follow it. It has you do all the checks and give the user one command to paste.

## Tunnelled Connections

Some connections reach the database through a tunnel: a Northflank addon forwarded through the Northflank API, or a port-forwarding command (kubectl, ssh). Sherlock opens the tunnel on the first query and reuses it for later commands. You do not need to open one yourself. `connection list` shows each connection's tunnel provider and target.

```bash
sherlock tunnel status                  # Show running tunnels
sherlock tunnel stop <conn>             # Stop one tunnel
sherlock tunnel stop                    # Stop all tunnels
```

**Stop the tunnel when you have finished with a database.** An idle tunnel shuts itself down eventually, so leaving one running does no harm. Stopping it releases the database connection and the local port straight away.

A connection that gets no answer within 10s fails. Through a tunnel, the error says the tunnel's far end is the problem and gives the `sherlock tunnel stop <conn>` command that restarts it. Run that once and retry. If it fails the same way again, run `doctor` and report what it says rather than retrying further. Agents running sherlock inside a network sandbox may see this on every attempt, because the sandbox's proxy can block the tunnel's connection to Northflank.

If a tunnel fails to start, the error includes the provider's or the forwarding command's own output. Read it before retrying. The usual causes are a missing CLI and an expired login. A command that needs `sudo` cannot work at all, because the tunnel runs with no terminal for sudo to prompt at, and the error names the alternatives.

## When a Connection Does Not Work

Run `sherlock doctor <conn>` before trying fixes of your own. It checks, in order, and stops at the first failure:

1. the config and tunnel are valid;
2. the tunnel forwards to the database the connection's host names, which catches a tunnel copied from another connection;
3. the tunnel provider can see its target (for Northflank: the context exists and can see the project and the addon);
4. every credential resolves, reported by where it comes from, never by value;
5. the tunnel comes up;
6. the session is encrypted, when `ssl` is set;
7. `SELECT 1` succeeds (PING for Redis).

The output is JSON. Each failed check has a `detail` and usually a `fix`. Tell the user what failed and what the fix is. Changing their Northflank login, keychain or config is for them to do unless they ask you to.

## Constraints

- **Read-only**: SQL allows a single SELECT, SHOW, DESCRIBE, EXPLAIN or WITH statement, with no write keywords in its code. Words inside string literals, quoted identifiers and comments do not count, so `WHERE action = 'delete'` is fine. On PostgreSQL and MySQL every statement also runs in a read-only transaction that is rolled back, as a prepared statement, so the database refuses even a function that writes, and anything chained after the statement. SQLite connections refuse writes too. SQL Server has no such protection: there the keyword check is the only guard. If a refused word is a column name, quote it as an identifier. Redis allows read commands only (GET, HGETALL, SCAN, etc.) — mutations (SET, DEL, HSET, etc.) are blocked.
- **Timeout**: a statement is cancelled after 60s unless the connection sets `statementTimeout` or the query passes `--timeout`. The error says so. Rerun with a longer `--timeout` only if the query is expected to be slow.
- **Errors**: a failed command prints `{"error": "..."}` on stderr and exits 1. Three commands report on stdout instead, and exit 1 when the report has a failure: `doctor` (a check failed), `keychain list` (a password cannot be found) and `tunnel stop <conn>` (no such tunnel was running).
- **Connection required**: Always specify `-c <connection>` or `-u <url>`, unless the current directory is inside a connection's configured `directory`, which selects that connection.
- **Type-aware**: SQL commands only work with SQL connections, Redis commands only work with Redis connections
- **Quoting**: PostgreSQL/SQLite use `"identifier"`, MySQL uses `` `identifier` ``, SQL Server uses `[identifier]`

## SQL Workflow

1. Run `connection list` to see available databases
2. Use `tables` or `introspect` to understand schema (introspect is cached per-connection)
3. Use `fk` to understand table relationships before writing JOINs
4. Use `sample` to see real data examples before writing queries
5. Write SQL based on user's question and schema
6. Execute with `query`, present results clearly

## Redis Workflow

1. Run `connection list` to see available connections
2. Use `info` to understand the Redis instance (version, memory, keyspace)
3. Use `keys "pattern:*"` to find keys of interest
4. Use `get <key>` to retrieve values (auto-detects string/hash/list/set/zset)
5. Use `inspect <key>` for metadata (TTL, memory usage, encoding)
6. Use `command` for any other read-only operation

## Tips

- Always use LIMIT to avoid large result sets
- Use `stats` for SQL data profiling (row counts, null counts, distinct values)
- Use `-f markdown` for human-readable table output from `query`, `sample`, `stats`, `fk` and `indexes`
- For Redis, use `keys` with specific patterns rather than `*` on large databases
- Use `--no-types` with `keys` for faster scanning when type info isn't needed
- Config: `~/.config/sherlock/config.json`, unless a `.sherlock.json` in the current directory or `SHERLOCK_CONFIG` points elsewhere
