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

## If sherlock is not found

Try these paths in order, and use the first that works as the full path for this session:

1. `~/.local/bin/sherlock`, where the installer puts it. It is installed but `~/.local/bin` is not on PATH. Tell the user once to add `export PATH="$HOME/.local/bin:$PATH"` to their shell config.
2. `~/.claude/skills/sherlock/sherlock`, where versions up to 1.7.0 put it. Tell the user once to run the installer from this skill's `compatibility` field. It moves the old installation to the current layout and keeps their connections.

If neither exists, sherlock is not installed. Ask the user to run that installer.

## Rules that apply whatever the version

- Sherlock is read-only. Do not try to work around a refused query; tell the user what was refused and why.
- Ask the user for a database password rather than guessing it, and never pass one as a command-line argument. The guide shows how to pass it on stdin.
- Always say which database you mean: with `-c <connection>` or `-u <url>`, or in the other ways the guide describes. Never assume a default connection.
