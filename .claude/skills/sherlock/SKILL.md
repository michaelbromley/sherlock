---
name: sherlock
description: Allows read-only access to SQL databases for querying and analysis using natural language
allowed-tools:
   - Bash(~/.claude/skills/sherlock/sherlock:*)
---

# Sherlock

Read-only SQL database access. Binary: `~/.claude/skills/sherlock/sherlock`

## Commands

All DB commands require `-c <connection>`. Output is JSON.

```bash
sherlock connections                    # List available connections
sherlock -c <conn> tables               # List tables
sherlock -c <conn> describe <table>     # Table schema
sherlock -c <conn> introspect           # Full schema (all tables)
sherlock -c <conn> query "SELECT ..."   # Execute read-only query
sherlock                                # Show help (all available commands)
```

## Constraints

- **Read-only**: Only SELECT, SHOW, DESCRIBE, EXPLAIN, WITH allowed
- **Connection required**: Always specify `-c <connection>` (no default)
- **Quoting**: PostgreSQL/SQLite use `"identifier"`, MySQL uses `` `identifier` ``

## Workflow

1. Run `connections` to see available databases
2. Use `tables` or `introspect` to understand schema (cache this)
3. Write SQL based on user's question and schema
4. Execute with `query`, present results clearly

## Tips

- Always use LIMIT to avoid large result sets
- Warn user before potentially expensive queries (JOINs on large tables, no WHERE clause)
- Config: `~/.claude/skills/sherlock/config.json`
