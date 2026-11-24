# Sherlock: agent guide

Read-only database access for SQL and Redis, through the `sherlock` command. This guide describes the sherlock binary that printed it. For every flag of a command, run `sherlock <command> --help`.

<!-- contract reference -->

## Ad Hoc Connections (`--url`)

`-u <url>` connects to a URL without saving a connection, in place of `-c`. The type comes from the scheme: `postgres://`, `mysql://`, `mssql://`, `sqlserver://`, `sqlite://`, `redis://` or `rediss://`. Queries through `-u` are not logged. For a database you will use again, set up a connection instead: `sherlock guide setup`.

## SQL Commands

All SQL commands require `-c <connection>` or `-u <url>`.

```bash
sherlock connection list                # List connections and what each points at
sherlock doctor <conn>                  # Find out why a connection does not work
sherlock -c <conn> tables               # List tables
sherlock -c <conn> describe <table>     # Table schema
sherlock -c <conn> introspect           # Full schema (cached)
sherlock -c <conn> introspect --refresh # Refresh cached schema
sherlock -c <conn> introspect --out schema.jsonl  # Every column of every table, for a large schema
sherlock -c <conn> query "SELECT ..."   # Execute read-only query
sherlock -c <conn> query --file q.sql   # Read the query from a file
sherlock -c <conn> query - < q.sql      # ...or from stdin
sherlock -c <conn> query --timeout 5m "SELECT ..."  # Allow longer than the 60s default
sherlock -c <conn> --max-rows 1000 query "SELECT ..."  # Raise the row cap
sherlock -c <conn> query "SELECT ..." --out rows.jsonl  # Every row to a file, with a preview
sherlock -c <conn> sample <table> -n 10 # Random sample rows
sherlock -c <conn> stats <table>        # Data profiling (nulls, distinct counts)
sherlock -c <conn> indexes <table>      # Table indexes
sherlock -c <conn> fk <table>           # Foreign key relationships
```

For anything longer than a line, or with quotes in it, write the SQL to a file and use `--file`, or pipe it to `query -`. A long query passed as a shell argument is easily broken by quoting. Note that `-f` is the output format, not the file.

`describe` gives every database's columns the same way: `name`, `type`, `nullable`, `default`, `primaryKey`. `introspect` gives every table's columns like that, from a cache kept per connection; a `SCHEMA_CACHE_STALE` warning means the cache is more than a day old.

## Redis Commands

All Redis commands require `-c <connection>` pointing to a Redis connection, or `-u redis://...`.

```bash
sherlock -c <conn> info                 # Server info, memory, keyspace
sherlock -c <conn> info --section memory # Specific INFO section
sherlock -c <conn> keys "user:*"        # Scan for keys matching pattern
sherlock -c <conn> keys --limit 50      # Limit number of results
sherlock -c <conn> get <key>            # Get value (auto-detects type)
sherlock -c <conn> get <key> --limit 50 # Items of a list, set, sorted set or hash
sherlock -c <conn> inspect <key>        # Key metadata (type, TTL, memory, encoding)
sherlock -c <conn> slowlog              # Recent slow queries
sherlock -c <conn> slowlog -n 20        # Last 20 slow log entries
sherlock -c <conn> command GET mykey    # Execute any read-only Redis command
```

## Connections

`sherlock connection list` shows the connections on this machine.

- **To set one up**, run `sherlock guide setup` and follow it. It covers using the project's database URL, having the user type a password where you cannot see it, SSL and tunnels.
- **When a connection fails**, run `sherlock doctor <conn>` before trying fixes of your own. It stops at the first check that fails: `error.code` is that check's cause, and `data.checks` holds every check that ran, each failed one with a `fix`. Tell the user what failed and what the fix is.
- **A tunnelled connection** opens its tunnel on the first query, and reuses it. On `CONNECT_TIMEOUT` or `TUNNEL_DOWN`, run the `sherlock tunnel stop <conn>` its `fix` gives once, and retry. If it fails the same way again, run `doctor`. When you have finished with the database, run `sherlock tunnel stop <conn>`.
- **To move connections to another machine**, run `sherlock guide transfer`.

## Constraints

- **Read-only**: SQL allows a single SELECT, SHOW, DESCRIBE, EXPLAIN or WITH statement, with no write keywords in its code. Words inside string literals, quoted identifiers and comments do not count, so `WHERE action = 'delete'` is fine. On PostgreSQL and MySQL every statement also runs in a read-only transaction that is rolled back, through a protocol on which the server refuses a second statement, so the database refuses even a function that writes (`READ_ONLY_VIOLATION`), and anything chained after the statement. SQLite databases are opened read-only. SQL Server has no such protection: there the keyword check is the only guard. If a refused word is a column name, quote it as an identifier. Redis allows read commands only (GET, HGETALL, SCAN, etc.) — mutations (SET, DEL, HSET, etc.) are blocked.
- **No writes by other means**: sherlock is read-only on purpose. When the user asks you to change data, such as fixing a row or reinstating an account, say that sherlock can't, and give them the SQL to run themselves. Don't make the change another way, with `psql`, the app's code, or credentials you found in the project, unless the user explicitly asks you to make the change that way.
- **Refused queries**: `QUERY_REFUSED` means sherlock's own check refused the query before sending it, and `details.reason` says why. Do not try to work around it.
- **Timeout**: a statement is cancelled after 60s unless the connection sets `statementTimeout` or the query passes `--timeout`, with `QUERY_TIMEOUT`. Rerun with a longer `--timeout` only if the query is expected to be slow.
- **Connection required**: Always specify `-c <connection>` or `-u <url>`, unless the current directory is inside a connection's configured `directory`, which selects that connection.
- **Type-aware**: SQL commands only work with SQL connections, Redis commands only work with Redis connections
- **Quoting**: PostgreSQL/SQLite use `"identifier"`, MySQL uses `` `identifier` ``, SQL Server uses `[identifier]`

## SQL Workflow

1. Run `connection list` to see available databases
2. Use `tables` or `introspect` to understand schema (introspect is cached per-connection)
3. Use `fk` to understand table relationships before writing JOINs
4. Use `sample` to see real data examples before writing queries
5. Write SQL based on user's question and schema
6. Execute with `query`, check `truncated` and the warnings, and present the results clearly

## Redis Workflow

1. Run `connection list` to see available connections
2. Use `info` to understand the Redis instance (version, memory, keyspace)
3. Use `keys "pattern:*"` to find keys of interest
4. Use `get <key>` to retrieve values (auto-detects string/hash/list/set/zset)
5. Use `inspect <key>` for metadata (TTL, memory usage, encoding)
6. Use `command` for any other read-only operation

## Tips

- Use LIMIT and name the columns you need: a result past the caps is cut, and the cut costs another call
- Use `stats` for SQL data profiling (row counts, null counts, distinct values)
- `-f human` prints tables for showing to the user; never parse it
- For Redis, use `keys` with specific patterns rather than `*` on large databases
- Use `--no-types` with `keys` for faster scanning when type info isn't needed
- Config: `~/.config/sherlock/config.json`, unless a `.sherlock.json` in the current directory or `SHERLOCK_CONFIG` points elsewhere
