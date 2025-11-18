# ApplicationConfigurations Table

## Overview
The `ApplicationConfigurations` table stores system-wide configuration settings for the SRP application. This key-value store allows dynamic configuration management without code changes, supporting runtime adjustments to application behavior.

## Table Structure

### Id (bigint, NOT NULL, PRIMARY KEY)

The primary key and unique identifier for each configuration entry in the system. This auto-incrementing field ensures that every configuration setting has a stable, distinct reference point throughout the application's lifecycle, even if the Name field is modified (though this is rare in practice). The Id serves as the fundamental database key, though most application logic will reference configurations by the Name field rather than this numeric identifier.

In practice, this Id field provides the underlying relational integrity for the table while the Name field serves as the practical identifier for retrieving configuration values. During database operations such as backups, migrations, or synchronization across environments, the Id may differ between systems, but the Name field remains the consistent identifier that applications rely upon. This design pattern allows for flexibility in database management while maintaining stable configuration references in application code.

### Name (varchar, NULL)

The configuration setting name or key that uniquely identifies each configuration value within the system. This field serves as the primary identifier used by application code when retrieving configuration values, following a hierarchical dot-notation convention that organizes related settings into logical categories (e.g., "System.MaintenanceMode", "Feature.EnableAdvancedReporting", "Email.Smtp.Host").

The naming convention employed in this field is critical to the maintainability and clarity of the configuration system. Settings are typically organized using PascalCase with dot separators to denote category hierarchies, allowing administrators and developers to quickly understand the scope and purpose of each configuration. For example, all email-related settings might be prefixed with "Email.", making it easy to identify and manage related configurations as a group. While the field is technically nullable from a database perspective, in practice every configuration entry must have a meaningful, unique Name value to be functional. The varchar type accommodates configuration names of varying lengths while maintaining efficient storage and query performance. When creating new configurations, developers should follow established naming patterns and document each setting's purpose to ensure the configuration system remains organized and comprehensible as the application evolves.

### Value (varchar, NULL)

The configuration value itself, stored as a varchar to accommodate the widest possible range of configuration data types and formats. This flexible field can store simple string values, numeric values as strings, boolean values (conventionally stored as lowercase "true" or "false"), ISO date formats, JSON objects for complex configurations, encrypted credentials prefixed with encryption indicators, or delimited lists of values.

The varchar storage type provides maximum flexibility in what can be configured, as the application layer is responsible for parsing and interpreting the value according to the expected type for each specific configuration name. For example, a configuration named "System.MaxUploadSize" might store "10485760" as a string that the application parses as an integer representing bytes, while "Feature.EnableAdvancedReporting" might store "true" as a string that the application interprets as a boolean. More complex configurations might store entire JSON objects, such as {"enabled": true, "threshold": 100, "regions": ["North", "South"]} for a feature that requires multiple related settings. Sensitive values like API keys or passwords should be encrypted before storage, often with a prefix convention like "ENC:AES256:" to indicate that the value requires decryption before use. The nullable nature of this field allows for configurations that simply mark the presence or absence of a setting (where NULL might indicate "not configured" versus an empty string which might mean "explicitly set to empty"). When working with configuration values, applications should implement proper validation, type checking, and error handling to ensure that string values can be successfully converted to their expected types, with sensible fallback behavior when configuration values are missing, null, or malformed.

### Order (int, NULL)

A numeric field that controls the display sequence and processing order of configuration entries, enabling logical grouping of related settings and ensuring that configurations are presented or processed in a meaningful sequence. This field is particularly valuable when configurations are displayed in administrative interfaces, where grouping related settings together improves usability, or when configuration values must be applied in a specific order during application initialization.

The Order field allows administrators to organize configurations by category, priority, or functional relationship without relying solely on alphabetical sorting by Name. For example, critical system configurations might be assigned lower Order values (e.g., 1-100) to ensure they appear first and are processed before optional feature flags (which might have Order values of 200-300). Related configurations can be given consecutive Order values to keep them visually grouped together in configuration management interfaces. When Order values are NULL or identical, the system typically falls back to sorting by the Name field, providing predictable behavior. The nullable nature of this field allows configurations to be added without explicitly assigning an order, which can be useful for quick additions where positioning isn't critical. In application initialization scenarios where configuration load order matters—such as when one configuration's value depends on or modifies another—the Order field provides a simple mechanism to control the sequence without complex dependency logic. Administrative interfaces should display configurations sorted by this field (with Name as a secondary sort key) to present a organized, coherent view of all system settings to administrators who need to review or modify configuration values.

### CreatedTimestamp (datetime, NULL)

Records the exact date and time when this configuration entry was first created in the database, providing an essential audit trail for understanding when specific settings were introduced into the system. This timestamp field captures the moment of record insertion and remains unchanged throughout the configuration's lifetime, even as the Value or other fields may be modified.

The CreatedTimestamp serves several important purposes in configuration management and system administration. First, it provides valuable context for understanding the evolution of the application's configuration over time—administrators can identify which settings were part of the original system setup versus which were added during later updates, feature additions, or troubleshooting efforts. Second, it aids in debugging and root cause analysis when investigating issues that may be related to configuration changes; by examining creation timestamps, administrators can correlate the introduction of new configurations with changes in system behavior or performance. Third, it supports compliance and audit requirements by maintaining a record of when each configuration setting entered the system, which can be important for regulated environments. While the field is nullable from a database schema perspective, best practices dictate that it should always be populated when new configuration records are created, typically using the database server's current timestamp function. Unlike the LastUpdatedTimestamp which changes with each modification, the CreatedTimestamp provides a stable historical marker that never changes, making it a reliable reference point for understanding the configuration's age and origin within the system.

### LastUpdatedTimestamp (datetime, NULL)

Captures the most recent date and time when any aspect of this configuration record was modified, automatically updating whenever changes are made to provide a living audit trail of configuration maintenance activity. This timestamp is crucial for change tracking, synchronization, and understanding the currency of configuration values across the system.

The LastUpdatedTimestamp field serves as a key element in configuration change management and system administration workflows. It enables administrators to quickly identify which configurations were recently modified, which is invaluable when troubleshooting issues that may have been triggered by configuration changes—if a problem appeared at a specific time, checking which configurations were updated around that time can rapidly identify potential causes. This field is also essential for configuration synchronization scenarios where multiple application instances or environments need to stay aligned; by comparing LastUpdatedTimestamp values, synchronization processes can identify which configurations have changed since the last sync operation and need to be propagated. In caching scenarios, where configuration values are loaded into application memory for performance, this timestamp helps determine when the cache needs to be invalidated and refreshed because the underlying configuration has changed in the database. Additionally, this field supports incremental backup strategies and change auditing, allowing administrators to track configuration evolution over time and maintain a record of when the system's behavior was modified through configuration adjustments. The nullable nature of the field accommodates legacy data or edge cases, but in practice it should always be populated—initially matching CreatedTimestamp when a configuration is first created, then updating to the current timestamp whenever any field in the record is modified through UPDATE operations.

## Purpose and Usage

### Configuration Management
This table serves as a central repository for:
- **System Settings**: Database connection strings, API endpoints
- **Feature Flags**: Enable/disable application features
- **Business Rules**: Thresholds, limits, default values
- **Display Settings**: UI preferences, localization settings
- **Integration Settings**: External system URLs, credentials (encrypted)

### Key Characteristics
- **No User Tracking**: Unlike other tables, doesn't track CreatedBy/UpdatedBy
- **Simple Structure**: Minimal fields for maximum flexibility
- **Ordered Display**: Order field allows logical grouping of related settings

## Common Configuration Types

### System Settings
```sql
-- Example system configurations
SELECT [Name], [Value], [Order]
FROM [ApplicationConfigurations]
WHERE [Name] LIKE 'System.%'
ORDER BY [Order]
```

Typical examples:
- `System.MaintenanceMode`: "false"
- `System.MaxUploadSize`: "10485760"
- `System.SessionTimeout`: "30"
- `System.DefaultLanguage`: "en-US"

### Feature Flags
```sql
-- Check if a feature is enabled
SELECT [Value]
FROM [ApplicationConfigurations]
WHERE [Name] = 'Feature.EnableAdvancedReporting'
```

### Business Rules
```sql
-- Business rule configurations
SELECT [Name], [Value]
FROM [ApplicationConfigurations]
WHERE [Name] LIKE 'BusinessRule.%'
```

Examples:
- `BusinessRule.MinimumParticipants`: "3"
- `BusinessRule.CycleDurationDays`: "90"
- `BusinessRule.MaxActivitiesPerLocality`: "50"

## Order Field Usage

The Order field enables:
1. **Grouped Display**: Related settings appear together
2. **Processing Sequence**: Settings applied in specific order
3. **Priority Levels**: Higher priority settings processed first

```sql
-- Configurations grouped by category with ordering
SELECT
    CASE
        WHEN [Name] LIKE 'System.%' THEN 'System'
        WHEN [Name] LIKE 'Feature.%' THEN 'Features'
        WHEN [Name] LIKE 'BusinessRule.%' THEN 'Business Rules'
        ELSE 'Other'
    END AS Category,
    [Name],
    [Value],
    [Order]
FROM [ApplicationConfigurations]
ORDER BY [Order], [Name]
```

## Value Storage Patterns

### Simple Values
```
"true"
"100"
"en-US"
"2024-01-01"
```

### Complex Values (JSON)
```json
{
  "enabled": true,
  "threshold": 100,
  "regions": ["North", "South", "East"]
}
```

### Encrypted Values
Sensitive data should be encrypted:
```
"ENC:AES256:base64encodedstring..."
```

## Common Queries

### Get Configuration Value
```sql
-- Retrieve a specific configuration
SELECT [Value]
FROM [ApplicationConfigurations]
WHERE [Name] = @ConfigName
```

### Update Configuration
```sql
-- Update a configuration value
UPDATE [ApplicationConfigurations]
SET [Value] = @NewValue,
    [LastUpdatedTimestamp] = GETDATE()
WHERE [Name] = @ConfigName
```

### List All Configurations
```sql
-- Get all configurations ordered
SELECT
    [Name],
    [Value],
    [Order],
    [LastUpdatedTimestamp]
FROM [ApplicationConfigurations]
ORDER BY [Order], [Name]
```

### Configuration Categories
```sql
-- Count configurations by category
SELECT
    SUBSTRING([Name], 1, CHARINDEX('.', [Name]) - 1) AS Category,
    COUNT(*) AS ConfigCount
FROM [ApplicationConfigurations]
WHERE CHARINDEX('.', [Name]) > 0
GROUP BY SUBSTRING([Name], 1, CHARINDEX('.', [Name]) - 1)
```

## Best Practices

### Naming Conventions
- Use dot notation for categorization: `Category.Subcategory.Setting`
- Use PascalCase or camelCase consistently
- Be descriptive but concise

Examples:
- `Email.Smtp.Host`
- `Report.Quarterly.IncludeInactive`
- `Cache.Duration.Minutes`

### Value Formatting
- **Booleans**: Store as "true"/"false" (lowercase)
- **Numbers**: Store as strings without formatting
- **Dates**: Use ISO 8601 format (YYYY-MM-DD)
- **Lists**: Use JSON arrays or delimited strings

### Security Considerations
1. **Encryption**: Encrypt sensitive values (passwords, API keys)
2. **Validation**: Validate values before use in application
3. **Auditing**: Changes to critical settings should be logged
4. **Access Control**: Limit who can modify configurations

## Integration with Application

### Configuration Cache
Applications typically:
1. Load configurations at startup
2. Cache in memory for performance
3. Refresh cache on changes or periodically

### Dynamic Reloading
```sql
-- Check for recent changes
SELECT COUNT(*)
FROM [ApplicationConfigurations]
WHERE [LastUpdatedTimestamp] > @LastCacheRefresh
```

### Default Values
Applications should handle missing configurations:
```sql
-- Get configuration with default
SELECT ISNULL(
    (SELECT [Value] FROM [ApplicationConfigurations] WHERE [Name] = @ConfigName),
    @DefaultValue
) AS ConfigValue
```

## Maintenance Operations

### Backup Configurations
```sql
-- Export configurations for backup
SELECT
    [Name],
    [Value],
    [Order],
    [CreatedTimestamp],
    [LastUpdatedTimestamp]
FROM [ApplicationConfigurations]
ORDER BY [Order]
-- Export to JSON or CSV
```

### Bulk Update
```sql
-- Update multiple related configurations
UPDATE [ApplicationConfigurations]
SET [Value] = CASE [Name]
    WHEN 'Email.Smtp.Host' THEN 'newmail.server.com'
    WHEN 'Email.Smtp.Port' THEN '587'
    WHEN 'Email.Smtp.EnableSsl' THEN 'true'
    ELSE [Value]
END,
[LastUpdatedTimestamp] = GETDATE()
WHERE [Name] LIKE 'Email.Smtp.%'
```

## Migration Support

### Version-Specific Configurations
Track application version compatibility:
```
AppVersion.Minimum: "2.0.0"
AppVersion.Current: "2.5.1"
Migration.LastRun: "2024-01-15"
```

### Environment-Specific Settings
Different values per environment:
```
Environment.Name: "Production"
Environment.DebugMode: "false"
Environment.LogLevel: "Warning"
```

## Notes for Developers

1. **Cache Management**: Implement proper cache invalidation
2. **Type Safety**: Parse and validate configuration values
3. **Defaults**: Always provide sensible defaults
4. **Documentation**: Document all configuration options
5. **Change Tracking**: Consider logging configuration changes
6. **Thread Safety**: Ensure thread-safe access to cached values