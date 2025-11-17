# ApplicationHistories Table

## Overview
The `ApplicationHistories` table tracks the deployment and operational history of the SRP application, including version upgrades, deployments, restores, and other significant application-level events. This audit log is critical for troubleshooting, compliance, and understanding the application's evolution.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each history entry

### ApplicationVersion

Version number of the application (e.g., "2.5.1", "3.0.0-beta")

### Action

Type of action performed (Deploy, Upgrade, Rollback, Restore, etc.)

### ActionTimestamp

When the action occurred

### ApplicationGUID

Unique identifier for the application instance

### IsRestored

Flag indicating if this version was restored from backup

### Timestamp

Additional timestamp for related events or backup time

## Purpose and Usage

### Deployment Tracking
Records every deployment event:
- **New Deployments**: Fresh installations
- **Upgrades**: Version updates
- **Patches**: Minor fixes and updates
- **Rollbacks**: Reverting to previous versions

### Audit Trail
Provides accountability for:
- Who deployed what version and when
- Recovery actions taken
- System restore points
- Deployment success/failure patterns

### Version Management
Tracks application evolution:
- Version progression over time
- Feature release history
- Patch management
- Beta/preview deployments

## Action Types

Common action values and their meanings:

| Action | Description | Typical Scenario |
|--------|-------------|------------------|
| **Deploy** | New deployment of application | Initial installation or fresh deployment |
| **Upgrade** | Version upgrade | Moving from v2.1 to v2.2 |
| **Patch** | Minor update/hotfix | Security patches, bug fixes |
| **Rollback** | Revert to previous version | Issues with new version |
| **Restore** | Restore from backup | Disaster recovery |
| **Start** | Application startup | Service restart |
| **Stop** | Application shutdown | Maintenance or issues |
| **Configure** | Configuration change | Major settings update |
| **Backup** | Backup creation | Scheduled or manual backup |

## Common Queries

### Deployment History
```sql
-- Recent deployment history
SELECT
    [ApplicationVersion],
    [Action],
    [ActionTimestamp],
    [IsRestored]
FROM [ApplicationHistories]
ORDER BY [ActionTimestamp] DESC
```

### Version Timeline
```sql
-- Track version progression
SELECT
    [ApplicationVersion],
    MIN([ActionTimestamp]) AS FirstDeployed,
    MAX([ActionTimestamp]) AS LastAction,
    COUNT(*) AS ActionCount
FROM [ApplicationHistories]
WHERE [Action] IN ('Deploy', 'Upgrade')
GROUP BY [ApplicationVersion]
ORDER BY MIN([ActionTimestamp])
```

### Rollback Analysis
```sql
-- Find rollback events and their context
SELECT
    h1.[ApplicationVersion] AS RolledBackFrom,
    h1.[ActionTimestamp] AS RollbackTime,
    h2.[ApplicationVersion] AS RolledBackTo
FROM [ApplicationHistories] h1
LEFT JOIN [ApplicationHistories] h2
    ON h2.[ActionTimestamp] = (
        SELECT MAX([ActionTimestamp])
        FROM [ApplicationHistories]
        WHERE [ActionTimestamp] < h1.[ActionTimestamp]
        AND [Action] IN ('Deploy', 'Upgrade')
    )
WHERE h1.[Action] = 'Rollback'
```

### Restore Operations
```sql
-- Track restore operations
SELECT
    [ApplicationVersion],
    [ActionTimestamp] AS RestoreTime,
    [Timestamp] AS OriginalBackupTime,
    DATEDIFF(HOUR, [Timestamp], [ActionTimestamp]) AS HoursOfDataLoss
FROM [ApplicationHistories]
WHERE [IsRestored] = 1
ORDER BY [ActionTimestamp] DESC
```

## Version Numbering Patterns

### Semantic Versioning
Standard format: `MAJOR.MINOR.PATCH[-PRERELEASE]`
- **2.5.1**: Production release
- **3.0.0-beta**: Beta version
- **2.5.2-hotfix1**: Emergency patch

### Build Numbers
May include build identifiers:
- **2.5.1.1234**: Build number appended
- **2.5.1-20240115**: Date-based build

## ApplicationGUID Usage

The ApplicationGUID field:
- Identifies unique application instances
- Tracks deployments across environments
- Links related actions together
- Helps in multi-server deployments

```sql
-- Track actions for a specific application instance
SELECT
    [Action],
    [ActionTimestamp],
    [ApplicationVersion]
FROM [ApplicationHistories]
WHERE [ApplicationGUID] = @InstanceGUID
ORDER BY [ActionTimestamp]
```

## Timestamp Fields Explained

### ActionTimestamp vs Timestamp
- **ActionTimestamp**: When the action was performed
- **Timestamp**: Additional context (backup time, original deployment time, etc.)

Example usage:
```sql
-- For restore operations
-- ActionTimestamp = when restore happened
-- Timestamp = when the backup was created

-- Calculate recovery point objective (RPO)
SELECT
    [ApplicationVersion],
    [ActionTimestamp] AS RestoreExecuted,
    [Timestamp] AS BackupCreated,
    DATEDIFF(MINUTE, [Timestamp], [ActionTimestamp]) AS RecoveryTime
FROM [ApplicationHistories]
WHERE [Action] = 'Restore'
```

## Deployment Patterns Analysis

### Deployment Frequency
```sql
-- Deployments per month
SELECT
    YEAR([ActionTimestamp]) AS Year,
    MONTH([ActionTimestamp]) AS Month,
    COUNT(*) AS Deployments
FROM [ApplicationHistories]
WHERE [Action] IN ('Deploy', 'Upgrade')
GROUP BY YEAR([ActionTimestamp]), MONTH([ActionTimestamp])
ORDER BY Year, Month
```

### Stability Metrics
```sql
-- Rollback rate by version
WITH Deployments AS (
    SELECT
        [ApplicationVersion],
        COUNT(*) AS DeployCount
    FROM [ApplicationHistories]
    WHERE [Action] IN ('Deploy', 'Upgrade')
    GROUP BY [ApplicationVersion]
),
Rollbacks AS (
    SELECT
        [ApplicationVersion],
        COUNT(*) AS RollbackCount
    FROM [ApplicationHistories]
    WHERE [Action] = 'Rollback'
    GROUP BY [ApplicationVersion]
)
SELECT
    d.[ApplicationVersion],
    d.DeployCount,
    ISNULL(r.RollbackCount, 0) AS RollbackCount,
    CAST(ISNULL(r.RollbackCount, 0) * 100.0 / d.DeployCount AS DECIMAL(5,2)) AS RollbackRate
FROM Deployments d
LEFT JOIN Rollbacks r ON d.[ApplicationVersion] = r.[ApplicationVersion]
ORDER BY d.[ApplicationVersion]
```

## Integration with Operations

### Health Monitoring
Track application health over time:
```sql
-- Application uptime analysis
SELECT
    [ApplicationVersion],
    [Action],
    [ActionTimestamp],
    LAG([ActionTimestamp]) OVER (ORDER BY [ActionTimestamp]) AS PreviousAction,
    DATEDIFF(HOUR,
        LAG([ActionTimestamp]) OVER (ORDER BY [ActionTimestamp]),
        [ActionTimestamp]
    ) AS HoursSinceLast
FROM [ApplicationHistories]
WHERE [Action] IN ('Start', 'Stop', 'Deploy', 'Upgrade')
```

### Maintenance Windows
Identify maintenance patterns:
```sql
-- Common maintenance times
SELECT
    DATENAME(WEEKDAY, [ActionTimestamp]) AS DayOfWeek,
    DATEPART(HOUR, [ActionTimestamp]) AS HourOfDay,
    COUNT(*) AS ActionCount
FROM [ApplicationHistories]
WHERE [Action] IN ('Deploy', 'Upgrade', 'Patch')
GROUP BY DATENAME(WEEKDAY, [ActionTimestamp]), DATEPART(HOUR, [ActionTimestamp])
ORDER BY ActionCount DESC
```

## Best Practices

### Recording Actions
1. **Be Consistent**: Use standardized action names
2. **Be Comprehensive**: Record all significant events
3. **Include Context**: Use both timestamp fields appropriately
4. **Link Related Events**: Use ApplicationGUID for correlation

### Version Management
1. **Semantic Versioning**: Follow consistent versioning scheme
2. **Pre-release Tracking**: Include beta/RC in version string
3. **Hotfix Notation**: Clear identification of emergency fixes

### Retention Policy
Consider data retention:
```sql
-- Archive old history (keep last 2 years)
DELETE FROM [ApplicationHistories]
WHERE [ActionTimestamp] < DATEADD(YEAR, -2, GETDATE())
  AND [Action] NOT IN ('Deploy', 'Upgrade', 'Restore')  -- Keep major events
```

## Notes for Developers

1. **Automated Logging**: Integrate with CI/CD pipeline
2. **Error Handling**: Record failed deployments
3. **Correlation**: Link with error logs and monitoring
4. **Recovery Planning**: Use for disaster recovery documentation
5. **Compliance**: May be required for audit compliance
6. **Performance**: Index ActionTimestamp for query performance