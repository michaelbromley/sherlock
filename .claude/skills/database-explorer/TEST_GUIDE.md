# Database Explorer Test Guide

## Overview

The database-explorer skill includes a comprehensive test suite that validates all functionality across all supported database types.

## Running Tests

### Full Test Suite

Run all tests for all available databases:

```bash
npx tsx .claude/skills/database-explorer/scripts/db-query.spec.ts
```

### Manual Testing

Test individual commands:

```bash
# List tables
npx tsx .claude/skills/database-explorer/scripts/query-db.ts tables

# Get full schema
npx tsx .claude/skills/database-explorer/scripts/query-db.ts introspect

# Describe a specific table
npx tsx .claude/skills/database-explorer/scripts/query-db.ts describe product

# Execute a query
npx tsx .claude/skills/database-explorer/scripts/query-db.ts query "SELECT COUNT(*) FROM product"
```

## Test Coverage

The test suite validates the following for each database type:

### 1. Tables Command
- **Tests**: Retrieves list of all tables in the database
- **Validates**:
  - Command executes successfully
  - Output is valid JSON
  - Returns an array of table names
  - At least one table exists

### 2. Introspect Command
- **Tests**: Retrieves complete schema information for all tables
- **Validates**:
  - Command executes successfully
  - Output is valid JSON
  - Schema contains at least one table
  - Each table has column information
  - Handles reserved keywords (e.g., 'order' table)

### 3. Describe Command
- **Tests**: Retrieves column details for a specific table (uses 'product' table)
- **Validates**:
  - Command executes successfully
  - Output is valid JSON
  - Returns table name and columns array
  - At least one column exists

### 4. Query Command
- **Tests**: Executes a SELECT query (counts products)
- **Validates**:
  - Command executes successfully
  - Output is valid JSON
  - Returns 'rowCount' and 'rows' fields
  - Query results are properly formatted

### 5. Read-Only Enforcement
- **Tests**: Attempts to execute a DELETE query
- **Validates**:
  - Command fails (as expected)
  - Error message mentions 'read-only' mode
  - Write operations are properly blocked

## Supported Databases

The test suite automatically detects and tests against available databases:

- **MySQL/MariaDB** (default)
- **PostgreSQL**
- **SQLite**

If a database is not available, the tests for that database are skipped with a warning.

## Test Output

The test suite provides:
- ✅ **Pass/Fail status** for each test
- ⏱️ **Execution time** for each test
- 📊 **Summary** with total/passed/failed counts
- 🎨 **Color-coded output** (green for pass, red for fail)

Example output:
```
🧪 Database Explorer Test Suite
================================

============================================================
Testing MYSQL
============================================================
✓ mysql database is available
✓ mysql: tables command (348ms)
✓ mysql: introspect command (429ms)
✓ mysql: describe command (product) (348ms)
✓ mysql: query command (351ms)
✓ mysql: read-only enforcement (341ms)
...
============================================================
TEST SUMMARY
============================================================
Total tests: 15
Passed: 15
Failed: 0

✅ All tests passed!
```

## Troubleshooting

### Database Not Available
If you see "⚠️ [database] not available - skipping tests":
- Ensure the database server is running
- Check connection settings in `config.ts`
- Verify environment variables are set correctly

### Test Failures
If tests fail:
1. Check the error message for details
2. Verify database has expected tables (especially 'product' table)
3. Ensure database connection credentials are correct
4. Check that no other process is blocking the database

### Reserved Keyword Issues
The test suite validates that reserved SQL keywords (like 'order') are properly escaped with backticks or quotes depending on the database type.

## Adding New Tests

To add new tests, modify `scripts/test-db-query.ts`:

1. Add a new test method to the `TestRunner` class
2. Call it in the `runTestsForDB` method
3. Ensure it returns a `TestResult` object with `name`, `passed`, and optionally `error` and `duration`

Example:
```typescript
private testNewFeature(dbType: string, env: Record<string, string>): TestResult {
    const testName = `${dbType}: new feature test`;
    const startTime = Date.now();

    // Test logic here

    return {
        name: testName,
        passed: true,
        duration: Date.now() - startTime,
    };
}
```

## CI/CD Integration

The test suite exits with:
- **Exit code 0**: All tests passed
- **Exit code 1**: One or more tests failed

This makes it suitable for CI/CD pipelines:

```bash
npm test || exit 1
```
