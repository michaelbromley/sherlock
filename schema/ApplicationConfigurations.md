# ApplicationConfigurations Table

## Overview
The `ApplicationConfigurations` table stores system-wide configuration settings for the SRP application. This key-value store allows dynamic configuration management without code changes, supporting runtime adjustments to application behavior.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each configuration entry

### Name

Configuration setting name/key (unique identifier for the setting)

### Value

Configuration value (can store strings, numbers, JSON, etc.)

### Order

Display/processing order for related configurations

### CreatedTimestamp

When the configuration was first created

### LastUpdatedTimestamp

When the configuration was last modified

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