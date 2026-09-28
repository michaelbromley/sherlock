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

`connection add --password-stdin` stores the password in the OS keychain. Connections created in other ways may keep it elsewhere: `{ "$env": "VAR" }` (read from the environment or the sherlock `.env` file), `{ "$keychain": "name" }`, or a plaintext string in config.json. Sherlock warns about the plaintext form on every query.

## Moving Connections to Another Machine

Use this when the user wants their connections on another machine, such as a server where sherlock has just been installed. Do everything yourself except the one command that needs the user.

**The user must be involved for exactly two things:** typing the passphrase, which you must never see, and deciding whether to replace connections that already exist on the other machine. Do not ask them anything else. Work out the rest yourself.

`sherlock config export` and `sherlock config import` read the passphrase from a hidden prompt in a real terminal. They refuse piped input, take no passphrase flag, and fail in your shell. Never ask the user for the passphrase, and never try to supply it.

### 1. Check both machines yourself

First find the sherlock binary on each machine, and use those full paths in every later command. It is not always in the same place. A non-interactive `ssh` does not load the PATH set in the shell profile, so search the usual install locations as well:

```bash
FIND='for p in "$(command -v sherlock)" ~/.claude/skills/sherlock/sherlock ~/.local/bin/sherlock /usr/local/bin/sherlock; do [ -x "$p" ] && echo "$p" && break; done'
sh -c "$FIND"                     # <local-sherlock>
ssh <host> "$FIND"                # <remote-sherlock>
```

Then check that both have the commands, and list what is already on each side:

```bash
<local-sherlock> config import --help >/dev/null && echo local-ok
<local-sherlock> connection list
ssh <host> '<remote-sherlock> config import --help >/dev/null && echo remote-ok'
ssh <host> '<remote-sherlock> connection list'
```

- **The host:** use the SSH alias or `user@host` the user named. If they did not name one, look in `~/.ssh/config`. Ask only when there is no way to tell.
- **Sherlock is missing on the remote**, or has no `config import` command: install or update it yourself with `ssh <host> 'curl -fsSL https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.sh | bash'`. Do the same locally if the local binary is too old.
- **Which connections:** export all of them unless the user named some. The command below exports one connection by adding its name after `export`. For several, but not all, run the whole command once per connection.
- **Names that exist on both machines:** this is the one decision to ask about. Ask once, listing the names: replace them (add `--force` to the import) or keep the remote ones (leave it off, and import skips them). If nothing overlaps, do not ask.
- **Tunnelled connections** need their forwarding tool on the remote, for example `ssh <host> 'command -v northflank'`. Check this and report anything missing. It does not block the import.

### 2. Give the user one command to paste into their own terminal

Fill in `<host>`, both binary paths, and `--force` in place of `[--force]` if they chose to replace (otherwise remove it). Present it as a single block to copy:

```bash
D="$(mktemp -d)" && F="$D/sherlock-connections.enc" && { <local-sherlock> config export -o "$F"; [ -f "$F" ] && scp -q "$F" <host>:sherlock-connections.enc && ssh -t <host> '<remote-sherlock> config import sherlock-connections.enc [--force]; rm -f sherlock-connections.enc'; rm -f "$F"; rmdir "$D"; }
```

It exports, copies the file, imports on the remote, and deletes the file on both machines, including after a failure. Nothing runs unless the temporary directory was created. Do not change the cleanup to `rm -rf`. Tell the user, briefly, what they will be asked:

1. A new passphrase, twice. They only need it for the next minute, so a long random phrase is fine.
2. The same passphrase once more, on the remote.
3. Possibly "Store the imported passwords in config.json?". This appears when the remote has no usable OS keychain, which is usual on a headless Linux server. Answering yes stores the passwords in plaintext in a file only their user can read. Answering no imports nothing.

**A Mac as the remote** (check with `ssh <host> uname`, which prints `Darwin`): its login keychain is usually locked over SSH, and import would then offer plaintext. Put `security unlock-keychain; ` at the start of the quoted remote command, before `<remote-sherlock>`, and tell the user they will be asked for their Mac login password there.

Then ask them to tell you when it has finished. You do not need them to paste the output back.

### 3. Check the result yourself

```bash
ssh <host> '<remote-sherlock> connection list'
ssh <host> '<remote-sherlock> -c <one imported connection> tables'
```

Compare the remote list with what you meant to export. A connection is missing when it was skipped:

- **Skipped on export:** its keychain entry could not be read on this machine. Fix that entry locally, then repeat step 2 for that connection alone.
- **Skipped on import:** the name already existed and `--force` was not given. This is expected if the user chose to keep the remote connections.

Report what arrived, what was skipped and why, and anything still missing on the remote, such as a tunnel tool that is not installed. If import stopped with "Giving up after 3 attempts", the passphrase was mistyped on the remote. Give them the same command again. Any other import error, such as "not valid JSON" or "corrupted", means the file did not arrive intact, and running the command again makes a fresh file.

Two things do not carry over in a useful form. The `directory` auto-select paths are local-machine paths. A `$env` password whose variable was not set here arrives as a reference to that variable, which must then be set on the remote.

### Reference

```bash
sherlock config export [conn] [-o file] [--force]   # --force overwrites the output file
sherlock config import <file> [--force]             # --force replaces same-named connections
```

- Export reads each password from wherever it is stored and encrypts the file with the passphrase (scrypt + AES-256-GCM). A wrong passphrase and a modified file are both refused.
- Import stores passwords in the OS keychain, and falls back to config.json only after the user agrees. It always writes to the user config, never a project `.sherlock.json`, and does not accept `--config`.
- If an import fails part-way, it leaves config.json unchanged and puts back the keychain entries it wrote. Running it again is safe. If the error also names keychain entries it "could not put back", tell the user. Once the keychain is usable, give them exactly the same command again. Add `--force` only if they chose it the first time, because it would also replace connections the first run skipped.
- Export exits 1 if it skipped any connection, even though the file was still written.

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
