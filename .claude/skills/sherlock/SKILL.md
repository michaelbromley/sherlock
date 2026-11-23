---
name: sherlock
description: Read-only access to PostgreSQL, MySQL/MariaDB, SQL Server, SQLite and Redis through the sherlock CLI. Use when the user asks about data in a database, wants to explore tables, a schema or foreign keys, needs a SELECT query written and run, wants to inspect Redis keys, or wants a database connection set up, tunnelled, diagnosed or moved to another machine.
license: MIT
compatibility: Requires the sherlock CLI on PATH. Install it with `curl -fsSL https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.sh | bash` (macOS on Apple silicon, Linux x64, Linux arm64).
allowed-tools: Bash(sherlock:*)
---

# Sherlock

Read-only database access for SQL and Redis, through the `sherlock` command.

## Start by reading the guide

Before the first sherlock command in a session, run:

```bash
sherlock guide
```

It prints how to use the installed version: querying, setting up connections, tunnels, `doctor`, and the read-only rules. It is built into the binary, so it always matches the commands that binary has. Follow it over anything you remember about sherlock. `sherlock guide transfer` covers moving connections to another machine. For every flag of a command, run `sherlock <command> --help`.

If `sherlock guide` fails with "unknown command 'guide'", the binary predates the guide. Tell the user once that `sherlock update` brings it up to date, and meanwhile work from `sherlock --help` and `sherlock <command> --help`.

## Check the version once per session

Run `sherlock --version` once, before reading any output:

- **2.0 or later:** every command prints one JSON envelope on stdout, `{ ok, data, error, warnings, meta }`, and exits 0, 1, or 2 for a usage error. Check `ok`, branch on `error.code`, read `data`, and read `warnings`. `sherlock guide` describes it, with every error code.
- **Below 2.0:** tell the user once that `sherlock update` brings the 2.0 output. Until then, read the 1.x output: each command prints its own JSON shape on stdout, errors are `{"error": "..."}` on stderr with exit 1, and a failed `query` prints `{"error": ...}` on stdout and exits 0, so check for an `error` key as well as the exit code.

The version is the check rather than the output, because a 1.x error prints nothing on stdout to inspect.

## If sherlock is not found

Try these paths in order, and use the first that works as the full path for this session:

1. `~/.local/bin/sherlock`, where the installer puts it. It is installed but `~/.local/bin` is not on PATH. Tell the user once to add `export PATH="$HOME/.local/bin:$PATH"` to their shell config.
2. `~/.claude/skills/sherlock/sherlock`, where versions up to 1.7.0 put it. Tell the user once to run the installer from this skill's `compatibility` field. It moves the old installation to the current layout and keeps their connections.

If neither exists, sherlock is not installed. Ask the user to run that installer.

## Rules that apply whatever the version

- Sherlock is read-only. Do not try to work around a refused query; tell the user what was refused and why.
- Ask the user for a database password rather than guessing it, and never pass one as a command-line argument. The guide shows how to pass it on stdin.
- Always say which database you mean: with `-c <connection>` or `-u <url>`, or in the other ways the guide describes. Never assume a default connection.
