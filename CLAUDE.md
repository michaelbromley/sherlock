# CLAUDE.md
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The SRP (Statistical Reporting Program) database project provides tools and documentation for working with a comprehensive Microsoft SQL Server database that tracks educational and community activities, participant engagement, and organizational hierarchies within a multi-national educational framework.

## Database Schema

When constructing queries, consult the file `reports/SRP_Database_Schema_Analysis.md` for a detailed understanding of the database schema and its table relationships. Also see the notes in the following section on “Schema Documentation Usage”.

Key schema characteristics:
- **Database Type**: Microsoft SQL Server
- **Total Tables**: 28 core tables
- **Multi-Language Support**: Localized content in 11+ languages
- **Audit Trail**: Comprehensive tracking with timestamps and user tracking

## IMPORTANT: Schema Documentation Usage

**⚠️ CRITICAL INSTRUCTION**: Whenever you are working with or referencing ANY database table, you MUST read the corresponding schema documentation file from the `schema/` directory to understand the meaning and purpose of each field.

### How to Use Schema Documentation

1. **Before Writing Any Query**: If a query involves a table, read its schema documentation FIRST
2. **When Discussing Tables**: Always consult the schema file to ensure accurate field descriptions
3. **For Complex Queries**: Read schema files for ALL tables involved in JOINs
4. **Understanding Field Meanings**: Schema files explain the business purpose of each field

### Schema Files Quick Reference

All schema documentation files are located in the `schema/` directory. Each file follows the pattern `[TableName].md` and contains:
- Detailed field descriptions explaining the business meaning
- Key relationships to other tables
- Common usage patterns and query examples
- Business rules and constraints

**Complete Table-to-Documentation Mapping:**

| Table Name | Schema File | Purpose |
|------------|-------------|---------|
| Activities | `schema/Activities.md` | Educational activities (classes, groups, circles) |
| ActivityStudyItemIndividuals | `schema/ActivityStudyItemIndividuals.md` | Individual participation in activities |
| ActivityStudyItems | `schema/ActivityStudyItems.md` | Links activities to curriculum |
| ApplicationConfigurations | `schema/ApplicationConfigurations.md` | System configuration settings |
| ApplicationHistories | `schema/ApplicationHistories.md` | Application deployment history |
| ClusterAuxiliaryBoardMembers | `schema/ClusterAuxiliaryBoardMembers.md` | Institutional support assignments |
| Clusters | `schema/Clusters.md` | Primary operational geographic units |
| Cycles | `schema/Cycles.md` | Statistical reporting periods |
| DBScriptHistories | `schema/DBScriptHistories.md` | Database migration tracking |
| ElectoralUnits | `schema/ElectoralUnits.md` | Administrative jurisdictions |
| GroupOfClusters | `schema/GroupOfClusters.md` | Cluster coordination groups |
| GroupOfRegions | `schema/GroupOfRegions.md` | Regional groupings |
| IndividualEmails | `schema/IndividualEmails.md` | Email contact information |
| IndividualPhones | `schema/IndividualPhones.md` | Phone contact information |
| Individuals | `schema/Individuals.md` | All participants and believers |
| ListColumns | `schema/ListColumns.md` | Available columns for lists |
| ListDisplayColumns | `schema/ListDisplayColumns.md` | Selected columns per list |
| ListFilterColumns | `schema/ListFilterColumns.md` | Filter criteria configuration |
| Lists | `schema/Lists.md` | Custom list/report definitions |
| ListSortColumns | `schema/ListSortColumns.md` | Sort order specifications |
| LoadDataFiles | `schema/LoadDataFiles.md` | Data import tracking |
| Localities | `schema/Localities.md` | Specific geographic locations |
| LocalizedStudyItems | `schema/LocalizedStudyItems.md` | Multi-language curriculum |
| NationalCommunities | `schema/NationalCommunities.md` | Country/territory entities |
| Regions | `schema/Regions.md` | Major administrative divisions |
| StudyItems | `schema/StudyItems.md` | Curriculum elements |
| Subdivisions | `schema/Subdivisions.md` | Neighborhood-level divisions |
| Subregions | `schema/Subregions.md` | Intermediate geographic level |

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

**Note**: Always read the corresponding schema file in `schema/[TableName].md` for complete field descriptions.

### 1. People Management
- **Individuals**: Central entity for tracking all participants → `schema/Individuals.md`
- **IndividualEmails**, **IndividualPhones**: Contact information → `schema/IndividualEmails.md`, `schema/IndividualPhones.md`

### 2. Activity Management
- **Activities**: Tracks educational activities with dates and participants → `schema/Activities.md`
- **ActivityStudyItems**: Links activities to curriculum → `schema/ActivityStudyItems.md`
- **ActivityStudyItemIndividuals**: Participant roles in activities → `schema/ActivityStudyItemIndividuals.md`

### 3. Educational Curriculum
- **StudyItems**: Hierarchical curriculum structure → `schema/StudyItems.md`
- **LocalizedStudyItems**: Multi-language support for curriculum → `schema/LocalizedStudyItems.md`

### 4. Geographic Hierarchy
```
NationalCommunities → schema/NationalCommunities.md
  └── Regions → schema/Regions.md
      └── Clusters → schema/Clusters.md
          └── Localities → schema/Localities.md
              └── Subdivisions (optional) → schema/Subdivisions.md
```

### 5. Reporting
- **Cycles**: Comprehensive reporting periods with activity metrics → `schema/Cycles.md`

## Common Query Patterns

**REMINDER**: Before using any of these patterns, you MUST read the relevant schema documentation files for the tables involved.

### Active Individuals in a Locality
```sql
-- Required reading: schema/Individuals.md, schema/Localities.md
SELECT [Id], [FirstName], [FamilyName], [BirthDate]
FROM [Individuals]
WHERE [LocalityId] = @LocalityId
  AND [IsArchived] = 0
```

### Activities by Type
```sql
-- Required reading: schema/Activities.md, schema/Localities.md
-- Note: ActivityType values are explained in Activities.md
SELECT A.[Id], A.[StartDate], A.[EndDate], L.[Name] AS LocalityName
FROM [Activities] A
JOIN [Localities] L ON A.[LocalityId] = L.[Id]
WHERE A.[ActivityType] = @ActivityType  -- 0=Children's Classes, 1=Junior Youth, 2=Study Circles
  AND A.[IsCompleted] = 0
```

### Geographic Rollup
```sql
-- Required reading: schema/Localities.md, schema/Clusters.md, schema/Regions.md, schema/Individuals.md
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
- **Reports**: `reports/<descriptive_filename>.md` - Analysis reports
- **Schema documentation (CRITICAL)**: `schema/[TableName].md` - Individual table documentation (**MUST READ**)
- **Overall schema analysis**: `reports/SRP_Database_Schema_Analysis.md` - Database-wide relationships

## Best Practices

1. **READ SCHEMA DOCUMENTATION FIRST**: Always read `schema/[TableName].md` before working with any table
2. **Always filter archived records**: Include `WHERE [IsArchived] = 0` when querying Individuals
3. **Use proper identifier quoting**: Always use square brackets `[TableName]` for SQL Server
4. **Leverage multi-language support**: Join with LocalizedStudyItems using appropriate language codes (e.g., 'en-US')
5. **Respect audit fields**: Don't manually modify CreatedTimestamp, LastUpdatedTimestamp, etc.
6. **Use geographic hierarchy**: Leverage the relationship structure for regional analysis
7. **Understand field meanings**: Schema documentation explains the business purpose of each field

## Development Files

- `queries/`: SQL query files for common reporting tasks
- **`schema/`**: Database schema documentation (**MUST READ** before working with each table)
- `reports/`: Generated reports and analysis
- `.env`: Database connection credentials (gitignored)

## Security Considerations

- Database credentials are stored in `.env` file (never commit to git)
- The db-tool enforces read-only operations (SELECT, SHOW, DESCRIBE, EXPLAIN only)
- Query logs may contain sensitive data - ensure proper access controls
- Use read-only database users when possible
