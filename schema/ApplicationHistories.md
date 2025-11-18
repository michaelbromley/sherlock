# ApplicationHistories Table

## Overview
The `ApplicationHistories` table tracks the deployment and operational history of the SRP application, including version upgrades, deployments, restores, and other significant application-level events. This audit log is critical for troubleshooting, compliance, and understanding the application's evolution.

## Table Structure

### Id (bigint, NOT NULL, PRIMARY KEY)

The primary key and unique identifier for each application history entry, ensuring that every deployment event, version change, or operational action has a distinct, permanent record in the audit trail. This auto-incrementing field provides the foundational indexing structure for the history log, allowing efficient queries and maintaining referential integrity across the table.

The Id field serves as the immutable anchor for each history record, remaining constant throughout the record's lifetime and enabling precise references to specific events in the application's operational history. Unlike other identifiers in the system which might represent logical entities that can be synchronized across instances, this Id is purely database-internal and specific to this particular history table instance. When analyzing deployment patterns, troubleshooting issues, or generating compliance reports, the sequential nature of this Id provides an implicit chronological ordering that complements the explicit ActionTimestamp field. In practice, queries rarely reference records by this Id directly—instead, administrators typically query by ActionTimestamp, ApplicationVersion, or Action type—but the Id ensures database integrity and provides a stable reference point for any operations that need to uniquely identify a specific history entry, such as when linking to related logs or creating detailed audit reports that reference specific deployment events.

### ApplicationVersion (varchar, NULL)

The semantic version number of the SRP application at the time of the recorded action, following standard versioning conventions to identify the exact software build deployed or operated upon. This field captures version identifiers in various formats including production releases (e.g., "2.5.1"), pre-release versions (e.g., "3.0.0-beta"), release candidates (e.g., "2.6.0-rc1"), or development builds (e.g., "2.5.2-dev.20240115").

The ApplicationVersion field serves as the primary identifier for tracking the evolution of the SRP software across its lifecycle, enabling administrators to understand which version was deployed when, how long each version remained in production, and the sequence of upgrades or rollbacks over time. This version string becomes particularly critical during troubleshooting, as it allows correlation between reported issues and specific software versions—if a problem appeared after a particular deployment, this field makes it immediately clear which version introduced the change. The field supports various versioning schemes but most commonly employs semantic versioning (MAJOR.MINOR.PATCH) where major versions indicate breaking changes, minor versions introduce new features in a backward-compatible manner, and patch versions contain backward-compatible bug fixes. Pre-release identifiers like "beta", "rc1", or "preview" can be appended to indicate non-production versions. The nullable nature of this field accommodates edge cases such as action entries that don't directly relate to a specific version (e.g., a backup action that isn't tied to application code), though in practice most entries should have a version specified. When analyzing deployment history, this field enables powerful queries about version stability, upgrade frequency, and the production lifespan of each release, supporting both operational metrics and strategic planning for future releases.

### Action (varchar, NULL)

A categorical field that identifies the type of operational event being recorded, using standardized action names to classify deployment activities, version changes, and significant application lifecycle events. Common action values include "Deploy" for new installations, "Upgrade" for version updates, "Rollback" for reverting to previous versions, "Restore" for recovery from backups, "Patch" for hotfixes, "Start" and "Stop" for application lifecycle events, "Configure" for major configuration changes, and "Backup" for backup creation events.

The Action field serves as the primary classifier for understanding what happened to the application at each point in its operational history, enabling administrators to quickly filter history records to specific event types when investigating issues or generating reports. Standardizing action names across all history entries ensures consistency in reporting and querying—for example, always using "Upgrade" rather than mixing "Update", "Upgrade", and "Version Change" allows simple WHERE clauses to reliably find all upgrade events. This field becomes particularly valuable during incident response when administrators need to quickly identify recent changes that might have triggered problems; by querying for Action IN ('Deploy', 'Upgrade', 'Patch', 'Configure'), they can rapidly surface any changes that occurred around the time issues appeared. The field also supports operational metrics like deployment frequency, rollback rates, and stability indicators—a high ratio of "Rollback" actions to "Upgrade" actions might indicate quality issues with the release process. While technically nullable to accommodate database schema flexibility, in practice every history entry should have a clearly defined Action value that unambiguously describes what event occurred. Organizations should maintain a documented set of standard Action values and ensure that deployment automation, manual operations, and administrative procedures all use these consistent values when creating history records, building a reliable and searchable audit trail over time.

### ActionTimestamp (datetime, NULL)

Records the precise date and time when the documented action occurred, providing the temporal anchor for understanding when each deployment, configuration change, or operational event took place in the application's lifecycle. This timestamp field captures the moment the action was executed, whether that's when a new version was deployed, when a rollback was initiated, when the application was started or stopped, or when any other significant event occurred.

The ActionTimestamp serves as the crucial chronological reference for all application history analysis, enabling time-based queries, trend analysis, and correlation with external events like reported issues, performance changes, or user complaints. This timestamp allows administrators to construct a precise timeline of the application's evolution—understanding not just what happened, but exactly when it happened and in what sequence relative to other events. During troubleshooting, the ActionTimestamp becomes invaluable for narrowing down root causes: if users reported problems beginning at 14:30, examining all actions with timestamps between 14:00 and 14:30 can quickly identify potentially causal events. The field also supports sophisticated temporal analyses like calculating the duration between deployments, identifying maintenance windows when most changes occur, or measuring the production lifespan of each application version (time from Deploy to next Upgrade). In disaster recovery scenarios, the ActionTimestamp for the most recent "Backup" action indicates the recovery point objective—how much data might be lost if a restore is necessary. The nullable nature accommodates database flexibility, but in practice this field should always be populated with the accurate timestamp of when the action occurred, typically captured using the database server's current time function at the moment the history record is inserted. For actions that span a duration (like a long-running upgrade), this timestamp typically represents the start time, with completion indicated by other mechanisms or additional records.

### ApplicationGUID (uniqueidentifier, NOT NULL)

A globally unique identifier that distinguishes this specific instance of the SRP application from all other instances that might exist across different environments, servers, or installations. This GUID remains constant for a particular application installation throughout its lifetime, even as the software version changes through upgrades, providing a stable identity that survives version transitions and enables tracking of a single application instance across its full operational history.

The ApplicationGUID serves several critical purposes in multi-instance environments where the same SRP software might be deployed in production, staging, development, or regional installations. First, it enables history records to be aggregated or separated by instance—when viewing consolidated logs from multiple environments, the ApplicationGUID allows filtering to a specific instance's history. Second, it supports disaster recovery and migration scenarios where understanding which specific application instance generated which history records is essential for reconstruction or analysis. Third, it enables detection of configuration drift or version skew across multiple instances—by comparing the most recent history records for each ApplicationGUID, administrators can identify instances that haven't been updated to the latest version or that have diverged in their deployment history. The NOT NULL constraint ensures that every history entry is definitively associated with a specific application instance, preventing ambiguity in multi-instance environments. In practice, this GUID is typically generated once during the initial installation or setup of an application instance and then consistently recorded in all subsequent history entries for that instance. When viewing deployment history, grouping or filtering by ApplicationGUID allows administrators to see the complete lifecycle of a specific installation, understand its unique deployment pattern, and make decisions about maintenance, upgrades, or retirement based on that instance's specific history and stability characteristics.

### IsRestored (bit, NOT NULL)

A boolean flag indicating whether the current application version was deployed through a restore operation from a backup rather than through a normal deployment or upgrade process. When set to true (1), this flag signals that the application was recovered from a backup—typically after a failure, data corruption incident, or other disaster recovery scenario—providing crucial context about the nature of this deployment in the application's history.

The IsRestored flag serves as an important marker for understanding the application's operational reliability and the circumstances surrounding specific versions in production. A true value indicates that at this point in the timeline, normal operations were disrupted and recovery procedures were invoked, which has several important implications for analysis and reporting. First, it helps explain apparent anomalies in version progression—if version 2.5.1 is followed by version 2.4.8 with IsRestored = true, this clearly indicates a rollback recovery rather than a confusing version downgrade. Second, it enables queries that specifically identify recovery events, allowing administrators to analyze patterns like recovery frequency, time to recovery, and recovery success rates. Third, when combined with the Timestamp field (which in restore scenarios indicates the backup creation time), it enables calculation of the Recovery Point Objective (RPO)—how much time elapsed between the backup and the restore, representing potential data loss. Fourth, this flag helps in compliance and audit scenarios where documented evidence of disaster recovery events is required. The NOT NULL constraint ensures that every history record explicitly indicates whether it represents a restore operation, with false (0) being the normal case for standard deployments, upgrades, and patches. During post-incident reviews, filtering for IsRestored = true quickly identifies all recovery events, enabling analysis of what went wrong, how quickly recovery occurred, and whether patterns exist that might indicate systemic issues requiring preventive measures.

### Timestamp (datetime, NOT NULL)

A secondary timestamp field that provides additional temporal context beyond the ActionTimestamp, with its specific meaning varying by the type of action recorded. For restore operations, this field typically stores when the backup being restored was originally created, enabling calculation of data loss windows. For other actions, it might store completion times, original deployment times when recording migrations, or other contextually relevant temporal markers that complement the primary ActionTimestamp.

The dual-timestamp design—ActionTimestamp and Timestamp—enables richer temporal analysis of application lifecycle events, particularly for operations that span duration or reference multiple time points. The most critical use case is in restore operations: when IsRestored is true, the ActionTimestamp records when the restore occurred (when the recovery action was executed), while the Timestamp records when the backup being restored was created. The difference between these two timestamps represents the Recovery Point Objective (RPO) in disaster recovery terminology—the window of time from which data might be lost. For example, if a restore action has ActionTimestamp of "2024-01-15 14:30:00" (when the restore ran) and Timestamp of "2024-01-15 06:00:00" (when the backup was created), this indicates 8.5 hours of potential data loss. For non-restore actions, the Timestamp field might store other relevant temporal markers: completion time for long-running operations, original creation time for migrated records, scheduled time versus actual execution time for planned maintenance, or other temporal data points that provide valuable context for analysis. The NOT NULL constraint ensures this field is always populated, though its interpretation depends on the Action type. When analyzing application history, particularly for disaster recovery post-mortems, the interplay between ActionTimestamp and Timestamp provides rich insights into both operational events and their temporal characteristics, supporting detailed analysis of how long operations took, how current backups were at restore time, and what temporal patterns exist in application lifecycle management.

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