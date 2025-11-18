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

### Documentation Files
- **Schema documentation (CRITICAL)**: `schema/[TableName].md` - Individual table documentation (**MUST READ**)
  - 28 comprehensive table documentation files following 9-section template
  - Privacy sections in CRITICAL/HIGH sensitivity tables
  - Field descriptions, relationships, query examples, business rules
- **Schema master index**: `schema/README.md` - Navigation hub with persona-specific quick-start guides

### Analysis Reports
- **Overall schema analysis**: `reports/SRP_Database_Schema_Analysis.md` - Database-wide relationships
- **Privacy guide**: `reports/Privacy_and_Security_Classification_Matrix.md` - 5-tier classification, compliance requirements
- **Foreign key matrix**: `reports/Foreign_Key_Cross_Reference_Matrix.md` - Complete FK relationship mapping, join patterns
- **Custom reports**: `reports/<descriptive_filename>.md` - Ad-hoc analysis reports

### Query Logs
- **Query logs**: `output/logs/<connection_name>.md` - Timestamped queries and results from db-tool

## Documentation Standards

All schema documentation files follow a **9-section template** for consistency:

1. **Overview** - Table purpose and business context
2. **Table Structure** - Complete field descriptions with data types and meanings
3. **Key Relationships** - Foreign keys and related tables
4. **Common Query Patterns** - Practical SQL examples with explanations
5. **Business Rules and Constraints** - Validation rules and data quality requirements
6. **Data Quality Considerations** - Consistency checks and missing data patterns
7. **Performance Notes** - Indexing recommendations and optimization tips
8. **Integration Points** - External systems and import/export patterns
9. **Developer Notes** - Implementation guidance and best practices

**Privacy sections** are added to CRITICAL and HIGH sensitivity tables, including:
- Field-level sensitivity classifications
- Prohibited query patterns (showing unsafe examples)
- Secure query patterns (showing safe aggregation)
- Compliance requirements (GDPR, CCPA, COPPA, TCPA, CAN-SPAM)
- Privacy checklists for validation

**Fictitious data standards** for all examples:
- Email domains: `.invalid`, `.example`, `.test` (RFC 2606 reserved)
- Phone numbers: `(555) 01XX-XXXX` range (North American reserved)
- Names: Use diverse, culturally-appropriate fictitious names
- Never use real personal data in documentation

## Best Practices

### Query Development
1. **READ SCHEMA DOCUMENTATION FIRST**: Always read `schema/[TableName].md` before working with any table
2. **Check Privacy Classification**: Consult `reports/Privacy_and_Security_Classification_Matrix.md` for sensitivity level
3. **Use proper identifier quoting**: Always use square brackets `[TableName]` for SQL Server
4. **Filter archived records**: Include `WHERE [IsArchived] = 0` when querying Individuals, Activities, etc.
5. **Leverage multi-language support**: Join with LocalizedStudyItems using appropriate language codes (e.g., 'en-US')

### Privacy and Security
6. **Apply privacy thresholds**: Use `HAVING COUNT(*) >= 10` for individual-level aggregations
7. **Aggregate before reporting**: Never expose individual names/emails/phones without authorization
8. **Small locality protection**: Aggregate localities with population < 500 to cluster level
9. **Children's data protection**: Verify COPPA compliance for participants under 13/16
10. **Use fictitious data**: Follow documentation standards for examples (`.invalid` emails, `555-01XX` phones)

### Data Quality
11. **Respect audit fields**: Don't manually modify CreatedTimestamp, LastUpdatedTimestamp, CreatedBy, LastUpdatedBy
12. **Use geographic hierarchy**: Leverage relationships for regional analysis (Localities → Clusters → Regions)
13. **Understand field meanings**: Schema documentation explains business purpose of each field
14. **Check referential integrity**: Use validation queries from `reports/Foreign_Key_Cross_Reference_Matrix.md`

### Performance
15. **Index foreign keys**: All FK columns should have indexes for join performance
16. **Limit result sets**: Use `TOP N` or date ranges to avoid full table scans
17. **Filter early in JOINs**: Push WHERE predicates down to reduce intermediate result sets
18. **Use EXISTS vs COUNT**: Prefer `EXISTS` over `COUNT(*) > 0` for existence checks

## Development Files

- `queries/`: SQL query files for common reporting tasks
- **`schema/`**: Database schema documentation (**MUST READ** before working with each table)
- `reports/`: Generated reports and analysis
- `.env`: Database connection credentials (gitignored)

## Privacy and Security 🔒

**CRITICAL**: This database contains personally identifiable information (PII) requiring strict privacy protections.

### Privacy Classification System

The SRP database implements a **5-tier sensitivity classification** for all 28 tables:

- **CRITICAL** (4 tables): Direct PII requiring maximum protection
  - Individuals, IndividualEmails, IndividualPhones, ClusterAuxiliaryBoardMembers
- **HIGH** (7 tables): Sensitive data requiring strong controls
  - Activities, ActivityStudyItemIndividuals, ActivityStudyItems, Cycles, Localities, Subdivisions, ElectoralUnits
- **MODERATE** (8 tables): Contextual sensitivity, moderate controls
  - Clusters, Regions, Subregions, GroupOfRegions, GroupOfClusters, StudyItems, LocalizedStudyItems, NationalCommunities
- **LOW** (5 tables): Limited sensitivity, basic controls
  - Lists, ListColumns, ListDisplayColumns, ListFilterColumns, ListSortColumns
- **MINIMAL** (4 tables): System data, minimal privacy concerns
  - ApplicationConfigurations, ApplicationHistories, DBScriptHistories, LoadDataFiles

**See comprehensive guide**: `reports/Privacy_and_Security_Classification_Matrix.md`

### Privacy Requirements

**Compliance**: GDPR (European Union), CCPA (California), COPPA (children under 13/16), TCPA (phone/SMS), CAN-SPAM Act (email)

**Core privacy rules:**
- ❌ **NEVER** expose personal names, emails, or phone numbers in public reports
- ❌ **NEVER** link individuals to activity participation without authorization
- ✅ **ALWAYS** aggregate personal data with minimum thresholds (≥5 or ≥10 individuals)
- ✅ **ALWAYS** use fictitious data in documentation (`.invalid`, `.example`, `.test` domains; `(555) 01XX` phone numbers)

### Secure Query Patterns

**✅ SAFE - Aggregated with Privacy Threshold:**
```sql
-- Safe: Cluster-level statistics with minimum threshold
SELECT
    C.[Name] AS [ClusterName],
    COUNT(*) AS [TotalIndividuals],
    AVG(YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate]) AS [AverageAge]
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[IsArchived] = 0
GROUP BY C.[Id], C.[Name]
HAVING COUNT(*) >= 10;  -- Privacy: minimum threshold
```

**❌ UNSAFE - Personal Data Exposure:**
```sql
-- DANGEROUS: Exposes names and contact information
SELECT I.[FirstName], I.[FamilyName], E.[Email], P.[PhoneNumber]
FROM [Individuals] I
LEFT JOIN [IndividualEmails] E ON I.[Id] = E.[IndividualId]
LEFT JOIN [IndividualPhones] P ON I.[Id] = P.[IndividualId];
-- This pattern is PROHIBITED without explicit authorization
```

### Privacy Checklist

Before any query involving personal data:
- [ ] User is authorized to access PII
- [ ] Purpose has legitimate institutional need
- [ ] Names/emails/phones will NOT be exposed publicly
- [ ] Aggregated data uses minimum threshold (≥5 or ≥10)
- [ ] Small populations (<500) aggregated to cluster level
- [ ] Children's data has parental consent (COPPA)
- [ ] Result complies with GDPR/CCPA requirements

## Security Considerations

- **Database credentials**: Stored in `.env` file (never commit to git)
- **Read-only operations**: The db-tool enforces SELECT, SHOW, DESCRIBE, EXPLAIN only
- **Query logs**: May contain sensitive data - ensure proper access controls
- **Database users**: Use read-only accounts when possible
- **Field-level encryption**: Encrypt CRITICAL PII (names, emails, phones) at rest
- **Row-level security**: Implement for coordinators (restrict to their clusters)
- **Audit logging**: Enable for all CRITICAL tables (Individuals, IndividualEmails, IndividualPhones, ClusterAuxiliaryBoardMembers)

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
