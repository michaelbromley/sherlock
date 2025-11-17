# CLAUDE.md
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The SRP (Statistical Reporting Program) database project provides tools and documentation for working with a comprehensive Microsoft SQL Server database that tracks educational and community activities, participant engagement, and organizational hierarchies within a multi-national educational framework.

## Database Schema

When constructing queries, consult the file `output/reports/default/SRP_Database_Schema_Analysis.md` for a detailed understanding of the database schema and its table relationships.

Key schema characteristics:
- **Database Type**: Microsoft SQL Server
- **Total Tables**: 28 core tables
- **Multi-Language Support**: Localized content in 11+ languages
- **Audit Trail**: Comprehensive tracking with timestamps and user tracking

## Database Explorer Tool

The `db-tool/` subdirectory contains a TypeScript-based database introspection and query tool. This tool provides:
- Read-only database access
- Schema exploration and introspection
- Natural language to SQL query conversion
- Query logging and reporting capabilities

**Important**: The db-tool is maintained as a separate project in the `db-tool/` subdirectory. See `db-tool/CLAUDE.md` and `db-tool/README.md` for detailed documentation on using the tool.

### Quick Usage

To use the database explorer from the srp-db project root:

```bash
# Navigate to db-tool directory
cd db-tool

# List all tables in the SRP database
npx tsx src/query-db.ts tables

# Introspect the database schema
npx tsx src/query-db.ts introspect

# Run a SQL query
npx tsx src/query-db.ts query "SELECT TOP 10 * FROM [Individuals]"
```

The db-tool uses a `config.ts` file for database connection configuration (gitignored for security).

## Query Formatting for SQL Server

When constructing queries for the SRP database, always use **square brackets** for identifiers:

```sql
SELECT [Id], [FirstName], [FamilyName]
FROM [Individuals]
WHERE [IsArchived] = 0
```

## Key Database Entities

### 1. People Management
- **Individuals**: Central entity for tracking all participants
- **IndividualEmails**, **IndividualPhones**: Contact information

### 2. Activity Management
- **Activities**: Tracks educational activities with dates and participants
- **ActivityStudyItems**: Links activities to curriculum
- **ActivityStudyItemIndividuals**: Participant roles in activities

### 3. Educational Curriculum
- **StudyItems**: Hierarchical curriculum structure
- **LocalizedStudyItems**: Multi-language support for curriculum

### 4. Geographic Hierarchy
```
NationalCommunities
  └── Regions
      └── Clusters
          └── Localities
              └── Subdivisions (optional)
```

### 5. Reporting
- **Cycles**: Comprehensive reporting periods with activity metrics

## Common Query Patterns

### Active Individuals in a Locality
```sql
SELECT [Id], [FirstName], [FamilyName], [BirthDate]
FROM [Individuals]
WHERE [LocalityId] = @LocalityId
  AND [IsArchived] = 0
```

### Activities by Type
```sql
SELECT A.[Id], A.[StartDate], A.[EndDate], L.[Name] AS LocalityName
FROM [Activities] A
JOIN [Localities] L ON A.[LocalityId] = L.[Id]
WHERE A.[ActivityType] = @ActivityType
  AND A.[IsCompleted] = 0
```

### Geographic Rollup
```sql
SELECT
    R.[Name] AS RegionName,
    C.[Name] AS ClusterName,
    L.[Name] AS LocalityName,
    COUNT(I.[Id]) AS IndividualCount
FROM [Localities] L
JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
JOIN [Regions] R ON C.[RegionId] = R.[Id]
LEFT JOIN [Individuals] I ON L.[Id] = I.[LocalityId] AND I.[IsArchived] = 0
GROUP BY R.[Name], C.[Name], L.[Name]
```

## Output Structure

- **Query logs**: `output/logs/<connection_name>.md` - Timestamped queries and results
- **Reports**: `output/reports/<connection_name>/<descriptive_filename>.md` - Analysis reports
- **Schema documentation**: `output/reports/default/SRP_Database_Schema_Analysis.md`

## Best Practices

1. **Always filter archived records**: Include `WHERE [IsArchived] = 0` when querying Individuals
2. **Use proper identifier quoting**: Always use square brackets `[TableName]` for SQL Server
3. **Leverage multi-language support**: Join with LocalizedStudyItems using appropriate language codes (e.g., 'en-US')
4. **Respect audit fields**: Don't manually modify CreatedTimestamp, LastUpdatedTimestamp, etc.
5. **Use geographic hierarchy**: Leverage the relationship structure for regional analysis

## Development Files

- `queries/`: SQL query files for common reporting tasks
- `schema/`: Database schema documentation
- `reports/`: Generated reports and analysis
- `.env`: Database connection credentials (gitignored)

## Security Considerations

- Database credentials are stored in `.env` file (never commit to git)
- The db-tool enforces read-only operations (SELECT, SHOW, DESCRIBE, EXPLAIN only)
- Query logs may contain sensitive data - ensure proper access controls
- Use read-only database users when possible
