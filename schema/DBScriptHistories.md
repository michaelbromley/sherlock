# DBScriptHistories Table

## Overview
The `DBScriptHistories` table tracks all database schema changes, migrations, and script executions. This is essentially a database version control system that ensures schema consistency, tracks migration history, and prevents duplicate script execution.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each script execution

### Version

Version number or identifier of the database script

### ScriptName

Name/filename of the executed script

### ExecutedTimestamp

When the script was executed

### ExecutedBy

User ID who executed the script

### ScriptHash

Hash of the script content for integrity verification

### ExecutionTime

Time taken to execute the script (in milliseconds)

### Success

Whether the script executed successfully

### ErrorMessage

Error details if the script failed

### RollbackScript

SQL to rollback this change if needed

## Purpose and Usage

### Schema Version Control
- **Migration Tracking**: Records every schema change
- **Version Management**: Maintains database version history
- **Idempotency**: Prevents running the same script twice
- **Rollback Support**: Stores rollback scripts for reversal

### Deployment Automation
- **CI/CD Integration**: Supports automated deployments
- **Script Ordering**: Ensures scripts run in correct sequence
- **Environment Sync**: Keeps multiple environments aligned

### Audit and Compliance
- **Change History**: Complete audit trail of schema changes
- **Accountability**: Tracks who made changes and when
- **Error Tracking**: Records failed attempts and reasons

## Version Numbering Schemes

### Sequential Versioning
```
001_InitialSchema.sql
002_AddIndividualsTable.sql
003_AddIndexes.sql
```

### Date-Based Versioning
```
20240115_01_AddNewColumn.sql
20240115_02_UpdateStoredProc.sql
20240116_01_CreateIndex.sql
```

### Semantic Versioning
```
v1.0.0_InitialRelease.sql
v1.1.0_AddReportingTables.sql
v1.1.1_FixConstraint.sql
```

## Common Queries

### Check Current Database Version
```sql
-- Get latest successful migration
SELECT TOP 1
    [Version],
    [ScriptName],
    [ExecutedTimestamp]
FROM [DBScriptHistories]
WHERE [Success] = 1
ORDER BY [ExecutedTimestamp] DESC
```

### Migration History
```sql
-- Full migration history
SELECT
    [Version],
    [ScriptName],
    [ExecutedTimestamp],
    [ExecutedBy],
    [ExecutionTime],
    [Success]
FROM [DBScriptHistories]
ORDER BY [ExecutedTimestamp]
```

### Failed Migrations
```sql
-- Find failed script executions
SELECT
    [Version],
    [ScriptName],
    [ExecutedTimestamp],
    [ErrorMessage]
FROM [DBScriptHistories]
WHERE [Success] = 0
ORDER BY [ExecutedTimestamp] DESC
```

### Pending Migrations
```sql
-- Assuming you have a list of all scripts
-- This finds scripts not yet executed
WITH AllScripts AS (
    SELECT '004_NewFeature.sql' AS ScriptName
    UNION SELECT '005_Performance.sql'
    -- etc.
)
SELECT
    a.ScriptName AS PendingScript
FROM AllScripts a
LEFT JOIN [DBScriptHistories] h
    ON a.ScriptName = h.[ScriptName]
    AND h.[Success] = 1
WHERE h.[Id] IS NULL
```

## Script Hash Usage

The ScriptHash field ensures script integrity:

```sql
-- Detect modified scripts
SELECT
    [ScriptName],
    [ScriptHash],
    [ExecutedTimestamp]
FROM [DBScriptHistories]
WHERE [ScriptName] = @ScriptName
  AND [ScriptHash] != @CurrentHash
```

### Hash Calculation Example
```sql
-- Pseudo-code for hash calculation
-- SHA256 hash of script content
DECLARE @ScriptContent NVARCHAR(MAX) = 'CREATE TABLE Example...'
DECLARE @ScriptHash VARCHAR(64) = HASHBYTES('SHA2_256', @ScriptContent)
```

## Execution Time Tracking

Monitor script performance:

```sql
-- Find slow-running scripts
SELECT
    [ScriptName],
    [ExecutionTime] / 1000.0 AS ExecutionSeconds,
    [ExecutedTimestamp]
FROM [DBScriptHistories]
WHERE [ExecutionTime] > 10000  -- Scripts taking > 10 seconds
ORDER BY [ExecutionTime] DESC
```

### Performance Trends
```sql
-- Average execution time by script type
SELECT
    CASE
        WHEN [ScriptName] LIKE '%Table%' THEN 'Table Changes'
        WHEN [ScriptName] LIKE '%Index%' THEN 'Index Changes'
        WHEN [ScriptName] LIKE '%Proc%' THEN 'Stored Procedures'
        ELSE 'Other'
    END AS ScriptType,
    AVG([ExecutionTime]) AS AvgExecutionMs,
    COUNT(*) AS ScriptCount
FROM [DBScriptHistories]
WHERE [Success] = 1
GROUP BY
    CASE
        WHEN [ScriptName] LIKE '%Table%' THEN 'Table Changes'
        WHEN [ScriptName] LIKE '%Index%' THEN 'Index Changes'
        WHEN [ScriptName] LIKE '%Proc%' THEN 'Stored Procedures'
        ELSE 'Other'
    END
```

## Rollback Support

### Storing Rollback Scripts
Each migration can include its rollback:

```sql
-- Example entry with rollback
INSERT INTO [DBScriptHistories] (
    [Version],
    [ScriptName],
    [ExecutedTimestamp],
    [Success],
    [RollbackScript]
) VALUES (
    '2.5.0',
    'AddNewColumn.sql',
    GETDATE(),
    1,
    'ALTER TABLE [Users] DROP COLUMN [NewColumn];'
)
```

### Executing Rollbacks
```sql
-- Get rollback script for a version
SELECT
    [Version],
    [ScriptName],
    [RollbackScript]
FROM [DBScriptHistories]
WHERE [Version] = @VersionToRollback
  AND [RollbackScript] IS NOT NULL
ORDER BY [ExecutedTimestamp] DESC
```

## Error Handling

### Common Error Patterns
```sql
-- Analyze error patterns
SELECT
    CASE
        WHEN [ErrorMessage] LIKE '%timeout%' THEN 'Timeout'
        WHEN [ErrorMessage] LIKE '%constraint%' THEN 'Constraint Violation'
        WHEN [ErrorMessage] LIKE '%permission%' THEN 'Permission Issue'
        WHEN [ErrorMessage] LIKE '%syntax%' THEN 'Syntax Error'
        ELSE 'Other'
    END AS ErrorType,
    COUNT(*) AS ErrorCount
FROM [DBScriptHistories]
WHERE [Success] = 0
  AND [ErrorMessage] IS NOT NULL
GROUP BY
    CASE
        WHEN [ErrorMessage] LIKE '%timeout%' THEN 'Timeout'
        WHEN [ErrorMessage] LIKE '%constraint%' THEN 'Constraint Violation'
        WHEN [ErrorMessage] LIKE '%permission%' THEN 'Permission Issue'
        WHEN [ErrorMessage] LIKE '%syntax%' THEN 'Syntax Error'
        ELSE 'Other'
    END
```

### Retry Logic
```sql
-- Find scripts that need retry
SELECT
    [ScriptName],
    [Version],
    MAX([ExecutedTimestamp]) AS LastAttempt,
    COUNT(*) AS AttemptCount
FROM [DBScriptHistories]
WHERE [Success] = 0
GROUP BY [ScriptName], [Version]
HAVING COUNT(*) < 3  -- Retry up to 3 times
```

## Migration Workflow Integration

### Pre-Migration Checks
```sql
-- Verify no pending migrations are running
IF EXISTS (
    SELECT 1 FROM [DBScriptHistories]
    WHERE [ExecutedTimestamp] > DATEADD(MINUTE, -30, GETDATE())
      AND [Success] IS NULL  -- Still running
)
BEGIN
    RAISERROR('Migration in progress', 16, 1)
    RETURN
END
```

### Post-Migration Validation
```sql
-- Verify migration success
DECLARE @ScriptName VARCHAR(255) = 'CreateNewTable.sql'
IF NOT EXISTS (
    SELECT 1 FROM [DBScriptHistories]
    WHERE [ScriptName] = @ScriptName
      AND [Success] = 1
)
BEGIN
    RAISERROR('Migration %s not completed successfully', 16, 1, @ScriptName)
END
```

## Best Practices

### Script Naming
1. **Prefix with Version/Date**: Ensures proper ordering
2. **Descriptive Names**: Clear indication of changes
3. **Consistent Format**: Aids in automation

### Recording Practices
1. **Atomic Recording**: Record before and after execution
2. **Complete Information**: Include all relevant details
3. **Error Capture**: Full error messages and stack traces

### Rollback Scripts
1. **Always Include**: Every change should be reversible
2. **Test Rollbacks**: Verify rollback scripts work
3. **Order Matters**: Rollbacks must run in reverse order

## Integration with Deployment Tools

### Typical Workflow
```sql
-- 1. Check if script already executed
SELECT COUNT(*)
FROM [DBScriptHistories]
WHERE [ScriptName] = @ScriptName
  AND [Success] = 1

-- 2. Record script start
INSERT INTO [DBScriptHistories] ([Version], [ScriptName], [ExecutedTimestamp], [Success])
VALUES (@Version, @ScriptName, GETDATE(), NULL)

-- 3. Execute script
-- ... actual script execution ...

-- 4. Update with result
UPDATE [DBScriptHistories]
SET [Success] = @Success,
    [ExecutionTime] = @Duration,
    [ErrorMessage] = @ErrorMsg
WHERE [Id] = @ScriptId
```

## Notes for Developers

1. **Idempotency**: Scripts should be safe to run multiple times
2. **Transaction Management**: Use transactions for complex changes
3. **Version Ordering**: Ensure scripts execute in correct order
4. **Environment Awareness**: Track which scripts run in which environments
5. **Backup First**: Always backup before major migrations
6. **Monitor Performance**: Track execution times for optimization