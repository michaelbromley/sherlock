---
name: sherlock
description: Allows read-only access to SQL databases for querying and analysis using natural language
allowed-tools: 
   - Bash(~/.claude/skills/sherlock/sherlock:*)
---

# Sherlock

## Instructions

This skill allows read-only access to SQL databases, enabling you to convert natural language queries into SQL and analyze data without requiring the user to write complex SQL by hand.

### Prerequisites

The sherlock binary must be installed. Users can install it with:

```bash
curl -fsSL https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.sh | bash
```

Then run `~/.claude/skills/sherlock/sherlock setup` to configure database connections.

### Available Commands

Use the sherlock binary at `~/.claude/skills/sherlock/sherlock`. **All database commands require `-c <connection>` to specify which database to use.**

1. **List configured connections**:
   ```bash
   ~/.claude/skills/sherlock/sherlock connections
   ```

2. **List all tables**:
   ```bash
   ~/.claude/skills/sherlock/sherlock -c mydb tables
   ```

3. **Introspect entire schema** (get all tables and their columns):
   ```bash
   ~/.claude/skills/sherlock/sherlock -c mydb introspect
   ```

4. **Describe a specific table**:
   ```bash
   ~/.claude/skills/sherlock/sherlock -c mydb describe users
   ```

5. **Execute a SQL query** (read-only):
   ```bash
   ~/.claude/skills/sherlock/sherlock -c mydb query "SELECT * FROM users LIMIT 10"
   ```

6. **Test a connection**:
   ```bash
   ~/.claude/skills/sherlock/sherlock test mydb
   ```

### Important Notes

- **Read-only mode**: Only SELECT, SHOW, DESCRIBE, EXPLAIN, and WITH queries are allowed. Any attempt to execute INSERT, UPDATE, DELETE, or DDL statements will be rejected.
- **Connection required**: You must always specify `-c <connection>` for database commands. There is no default connection (this prevents accidental queries to production).
- **JSON output**: All results are returned as JSON for easy parsing.
- **Configuration**: Connections are defined in `~/.claude/skills/sherlock/config.json` (same directory as the binary). Credentials use `$env` or `$keychain` references - never plaintext.

### Configuration Example

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
    }
  }
}
```

### Workflow

When the user asks a database question:

1. **Check available connections**:
   ```bash
   ~/.claude/skills/sherlock/sherlock connections
   ```

2. **First time or unclear schema**: Introspect to understand the database structure:
   ```bash
   ~/.claude/skills/sherlock/sherlock -c mydb tables
   ```

3. **Understand table structure**: Get details about specific tables:
   ```bash
   ~/.claude/skills/sherlock/sherlock -c mydb describe users
   ```

4. **Convert natural language to SQL**: Based on the user's question and schema, write an appropriate SQL query. Format identifiers correctly for the database type:
   - PostgreSQL/SQLite: `SELECT "column" FROM "table"`
   - MySQL/MariaDB: ``SELECT `column` FROM `table` ``

5. **Execute the query**:
   ```bash
   ~/.claude/skills/sherlock/sherlock -c mydb query "SELECT id, name, email FROM users WHERE created_at > '2024-01-01' LIMIT 20"
   ```

6. **Present results**: Format the JSON results in a user-friendly way, highlighting key insights.

### Best Practices

- Cache schema information during a conversation to avoid repeated introspection calls
- Use LIMIT clauses to avoid overwhelming results
- For large tables, describe them first before querying
- Explain your SQL queries to the user in plain language
- If a query fails, explain why and suggest alternatives
- Use aggregate functions (COUNT, SUM, AVG) for statistical queries
- If you think a query might cause performance issues (CPU, memory usage on DB server), warn the user first

## Examples

### Example 1: Finding recent records

**User**: "Show me the 10 most recent users from the production database"

**Assistant**:
1. Execute:
   ```bash
   ~/.claude/skills/sherlock/sherlock -c prod-db query "SELECT id, username, email, created_at FROM users ORDER BY created_at DESC LIMIT 10"
   ```
2. Present the results in a formatted table

### Example 2: Analyzing data distribution

**User**: "How many items do we have in each category?"

**Assistant**:
1. Check schema to understand table relationships
2. Execute:
   ```bash
   ~/.claude/skills/sherlock/sherlock -c mydb query "SELECT category, COUNT(*) as item_count FROM items GROUP BY category ORDER BY item_count DESC"
   ```
3. Present results with insights

### Example 3: Comparing databases

**User**: "Compare user counts between development and production"

**Assistant**:
1. Query development database:
   ```bash
   ~/.claude/skills/sherlock/sherlock -c dev-db query "SELECT COUNT(*) as user_count FROM users"
   ```
2. Query production database:
   ```bash
   ~/.claude/skills/sherlock/sherlock -c prod-db query "SELECT COUNT(*) as user_count FROM users"
   ```
3. Present comparison with analysis
