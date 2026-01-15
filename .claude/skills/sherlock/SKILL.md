---
name: sherlock
description: Allows read-only access to SQL databases for querying and analysis using natural language
allowed-tools:
   - Bash(~/.claude/skills/sherlock/sherlock:*)
---

# Sherlock

Read-only SQL database access. Binary: `~/.claude/skills/sherlock/sherlock`

## Commands

All DB commands require `-c <connection>`. Output is JSON by default, use `-f markdown` for tables.

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
sherlock                                # Show help (all available commands)
```

## Constraints

- **Read-only**: Only SELECT, SHOW, DESCRIBE, EXPLAIN, WITH allowed
- **Connection required**: Always specify `-c <connection>` (no default)
- **Quoting**: PostgreSQL/SQLite use `"identifier"`, MySQL uses `` `identifier` ``

## Workflow

1. Run `connections` to see available databases
2. Use `tables` or `introspect` to understand schema (introspect is cached per-connection)
3. Use `fk` to understand table relationships before writing JOINs
4. Use `sample` to see real data examples before writing queries
5. Write SQL based on user's question and schema
6. Execute with `query`, present results clearly

## Tips

- Always use LIMIT to avoid large result sets
- Use `stats` for data profiling (row counts, null counts, distinct values)
- Use `-f markdown` for human-readable table output
- Warn user before potentially expensive queries (JOINs on large tables, no WHERE clause)
- Config: `~/.claude/skills/sherlock/config.json`
