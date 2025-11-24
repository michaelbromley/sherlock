# SRP Database Schema Documentation

## Overview
This directory contains comprehensive documentation for all tables in the SRP (Statistical Reporting Program) database. The SRP system tracks educational activities, participant engagement, and organizational hierarchies within the Bahá'í community framework.

## Database Statistics
- **Database Type**: Microsoft SQL Server
- **Total Tables**: 28
- **Documentation Coverage**: 100% (all tables documented)

## Table Categories

### 📍 Geographic Hierarchy
The database implements a sophisticated 7-level geographic hierarchy for organizing communities:

- [NationalCommunities.md](NationalCommunities.md) - Top-level country/territory entities
- [GroupOfRegions.md](GroupOfRegions.md) - Optional high-level grouping for large countries
- [Regions.md](Regions.md) - Major administrative divisions within national communities
- [Subregions.md](Subregions.md) - Optional intermediate level between regions and clusters
- [Clusters.md](Clusters.md) - Primary operational units with development stages
- [GroupOfClusters.md](GroupOfClusters.md) - Optional coordination grouping of clusters
- [Localities.md](Localities.md) - Specific local communities where activities occur
- [ElectoralUnits.md](ElectoralUnits.md) - Bahá'í administrative jurisdictions for elections
- [Subdivisions.md](Subdivisions.md) - Optional neighborhood-level divisions within localities

### 📚 Educational Activities
Core tables for tracking classes, groups, and study circles:

- [Activities.md](Activities.md) - Central table for all educational activities
- [ActivityStudyItems.md](ActivityStudyItems.md) - Links activities to curriculum elements
- [ActivityStudyItemIndividuals.md](ActivityStudyItemIndividuals.md) - Tracks individual participation and roles

### 👥 People and Contacts
Managing participants and their contact information:

- [Individuals.md](Individuals.md) - Central repository for all participants and believers
- [IndividualEmails.md](IndividualEmails.md) - Email contact information
- [IndividualPhones.md](IndividualPhones.md) - Phone contact information

### 📖 Curriculum and Study Materials
Educational content and multi-language support:

- [StudyItems.md](StudyItems.md) - Curriculum elements (books, grades, texts)
- [LocalizedStudyItems.md](LocalizedStudyItems.md) - Multi-language translations

### 📊 Reporting and Statistics
Comprehensive tracking and analysis:

- [Cycles.md](Cycles.md) - Statistical reporting periods with extensive metrics
- [ClusterAuxiliaryBoardMembers.md](ClusterAuxiliaryBoardMembers.md) - Institutional support assignments

### 🔧 System Administration
Application configuration and management:

- [ApplicationConfigurations.md](ApplicationConfigurations.md) - System-wide settings
- [ApplicationHistories.md](ApplicationHistories.md) - Deployment and version history
- [DBScriptHistories.md](DBScriptHistories.md) - Database migration tracking
- [LoadDataFiles.md](LoadDataFiles.md) - Data import tracking

### 📋 Dynamic List Management
Customizable reporting and view system:

- [Lists.md](Lists.md) - Custom list/report definitions
- [ListColumns.md](ListColumns.md) - Available columns for lists
- [ListDisplayColumns.md](ListDisplayColumns.md) - Selected columns per list
- [ListFilterColumns.md](ListFilterColumns.md) - Filter criteria configuration
- [ListSortColumns.md](ListSortColumns.md) - Sort order specifications

## Key Relationships

### Activity Participation Flow
```
Individuals → ActivityStudyItemIndividuals ← Activities
                           ↓
                      StudyItems
```

### Geographic Assignment
```
Individuals → Localities → Clusters → Regions → NationalCommunities
Activities → Localities → Clusters → Regions
```

### Curriculum Structure
```
StudyItems (self-referential parent-child)
     ↓
LocalizedStudyItems (multi-language support)
```

## Common Field Patterns

### Audit Fields (present in most tables)
- **CreatedTimestamp**: Record creation time
- **CreatedBy**: User ID (uniqueidentifier)
- **LastUpdatedTimestamp**: Last modification time
- **LastUpdatedBy**: User ID of last modifier

### Data Migration Fields
- **ImportedTimestamp**: Data import tracking
- **ImportedFrom**: Source system identifier
- **ImportedFileType**: Import format tracking
- **GUID**: Unique identifiers for synchronization
- **LegacyId**: Original system identifiers

### Date Management Pattern
- **DisplayDate**: Human-readable format (varchar)
- **ActualDate**: System processing (datetime)

## Query Best Practices

### SQL Server Syntax
All queries use SQL Server syntax with square brackets for identifiers:
```sql
SELECT [Id], [Name] FROM [Clusters] WHERE [RegionId] = @RegionId
```

### Common Filters
- `WHERE [IsArchived] = 0` - Active records only
- `WHERE [IsCurrent] = 1` - Current participants
- `WHERE [IsCompleted] = 0` - Ongoing activities

### Performance Tips
- Index foreign key columns
- Filter by date ranges to limit result sets
- Join through geographic hierarchy efficiently
- Use appropriate language codes for localized content

## Business Context

The SRP database supports the Bahá'í community's educational framework:

### Core Activity Types
- **Type 0**: Children's Classes (ages 5-11)
- **Type 1**: Junior Youth Groups (ages 12-15)
- **Type 2**: Study Circles (youth and adults)

### Development Stages
Clusters progress through milestones indicating community development:
- Milestone 1: Initial activities established
- Milestone 2: Systematic programs in place
- Milestone 3: Intensive programs of growth

### Participant Roles
- Role 7: Regular participant (most common)
- Role 5: Assistant/helper
- Role 3: Tutor/facilitator
- Role 1: Primary teacher/instructor

## Documentation Standards

Each table documentation includes:
1. **Overview**: Purpose and context
2. **Table Structure**: Complete column specifications
3. **Key Relationships**: Foreign keys and related tables
4. **Common Queries**: Practical SQL examples
5. **Business Rules**: Constraints and validation
6. **Performance Notes**: Optimization tips
7. **Integration Points**: Related systems and processes

## Privacy and Security 🔒

**IMPORTANT:** This database contains personally identifiable information (PII) requiring strict privacy protections.

See **[Privacy_and_Security_Classification_Matrix.md](../reports/Privacy_and_Security_Classification_Matrix.md)** for comprehensive privacy guidance including:
- 5-tier sensitivity classification for all 28 tables
- CRITICAL tables: Individuals, IndividualEmails, IndividualPhones, ClusterAuxiliaryBoardMembers
- Field-level privacy assessments
- Secure vs. unsafe query patterns
- GDPR, CCPA, and COPPA compliance guidance
- Data protection requirements and access controls

**Privacy rules:**
- **NEVER** expose personal names, emails, or phone numbers in public reports
- **NEVER** link individuals to activity participation without authorization
- **ALWAYS** aggregate personal data with minimum thresholds (≥5 or ≥10 individuals)
- **ALWAYS** use fictitious data in documentation (.invalid, .example domains)

## Quick-Start Guides by Persona

### For Database Administrators 🛠️
**Getting Started:**
1. Review [ApplicationConfigurations.md](ApplicationConfigurations.md) for system settings
2. Check [DBScriptHistories.md](DBScriptHistories.md) for schema migrations
3. Study [Individuals.md](Individuals.md) and [Activities.md](Activities.md) - the core tables
4. Implement privacy controls from [Privacy Matrix](../reports/Privacy_and_Security_Classification_Matrix.md)

**Key Responsibilities:**
- Maintain referential integrity across geographic hierarchy
- Implement row-level security for coordinators (restrict to their clusters)
- Encrypt PII fields (names, emails, phones) at rest
- Configure audit logging for CRITICAL tables
- Regular backups and disaster recovery

**Critical indexes to verify:**
```sql
-- Foreign key indexes
CREATE INDEX IX_Activities_LocalityId ON [Activities]([LocalityId]);
CREATE INDEX IX_Individuals_LocalityId ON [Individuals]([LocalityId]);
CREATE INDEX IX_ActivityStudyItemIndividuals_IndividualId ON [ActivityStudyItemIndividuals]([IndividualId]);
CREATE INDEX IX_ActivityStudyItemIndividuals_ActivityId ON [ActivityStudyItemIndividuals]([ActivityId]);
```

### For Developers 💻
**Getting Started:**
1. Read [Key Relationships](#key-relationships) section above
2. Study the 3 core activity tables: [Activities.md](Activities.md), [ActivityStudyItems.md](ActivityStudyItems.md), [ActivityStudyItemIndividuals.md](ActivityStudyItemIndividuals.md)
3. Understand the geographic hierarchy for filtering/aggregation
4. Review privacy sections in CRITICAL tables before any query development

**Essential patterns:**
- Use square brackets for all identifiers: `SELECT [Id], [Name] FROM [Individuals]`
- Always filter archived: `WHERE [IsArchived] = 0`
- Join through geography: `Localities → Clusters → Regions`
- Multi-language: Join to `LocalizedStudyItems` with language code

**Sample safe query (aggregated demographics):**
```sql
SELECT
    C.[Name] AS [ClusterName],
    COUNT(*) AS [TotalIndividuals],
    AVG(YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate]) AS [AverageAge]
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[IsArchived] = 0
GROUP BY C.[Id], C.[Name]
HAVING COUNT(*) >= 10  -- Privacy: minimum threshold
ORDER BY C.[Name];
```

### For Statisticians/Researchers 📊
**Getting Started:**
1. Start with [Cycles.md](Cycles.md) for understanding reporting periods
2. Review [Clusters.md](Clusters.md) for development stage concepts
3. Study activity participation through [ActivityStudyItemIndividuals.md](ActivityStudyItemIndividuals.md)
4. **Read privacy guidelines** - you'll work with aggregated data only

**Key analysis tables:**
- **Cycles**: Pre-aggregated statistics by cluster and period
- **Activities**: Activity counts, types, participants
- **Clusters**: Development stages, coordinator counts, population
- **Individuals**: Demographics (age, gender) - aggregate only!

**Privacy requirements for research:**
- Minimum 10 individuals in any statistic
- Never identify specific people or small groups
- Cluster-level aggregation is safer than locality-level
- Regional analysis is safest for publication

**Sample research query (participation trends):**
```sql
SELECT
    R.[Name] AS [RegionName],
    YEAR(A.[StartDate]) AS [Year],
    A.[ActivityType],
    COUNT(DISTINCT A.[Id]) AS [Activities],
    COUNT(DISTINCT ASI.[IndividualId]) AS [UniqueParticipants]
FROM [Activities] A
INNER JOIN [ActivityStudyItemIndividuals] ASI ON A.[Id] = ASI.[ActivityId]
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE ASI.[IsCurrent] = 1
GROUP BY R.[Name], YEAR(A.[StartDate]), A.[ActivityType]
HAVING COUNT(DISTINCT ASI.[IndividualId]) >= 10  -- Privacy threshold
ORDER BY R.[Name], YEAR(A.[StartDate]), A.[ActivityType];
```

### For Coordinators 📋
**Getting Started:**
1. Understand your cluster through [Clusters.md](Clusters.md)
2. View activities in your locality via [Activities.md](Activities.md)
3. Track participants through [Individuals.md](Individuals.md) (name access with authorization)
4. Use [Lists.md](Lists.md) system for custom reports

**Your data scope (typically restricted by row-level security):**
- **Full access**: Activities and individuals in your assigned cluster/locality
- **Aggregated only**: Statistics from other clusters
- **Prohibited**: Contact information without explicit need

**Common coordinator queries:**
- Active children's classes in your cluster
- Study circle participants and completion rates
- Coordinator capacity (from Clusters table)
- Junior youth group enrollment

**Privacy reminder:** You may see names for coordination, but never share contact info or participation details outside authorized channels.

## Integration with Database Tools

### Using the SRP Database Explorer (db-tool)

The project includes a TypeScript-based query tool in `db-tool/` directory:

**Quick commands:**
```bash
cd db-tool

# List all tables
npx tsx src/query-db.ts tables

# Introspect schema (useful for developers)
npx tsx src/query-db.ts introspect

# Run SQL query (read-only)
npx tsx src/query-db.ts query "SELECT TOP 10 [Name] FROM [Clusters]"
```

**Configuration:** Create `db-tool/config.ts` with your database connection (see `db-tool/CLAUDE.md` for details).

**Query logging:** All queries are logged to `output/logs/<connection>.md` with timestamps.

### External System Integration Points

**Institute Management Systems:**
- Use `InstituteId` fields in Activities, Individuals, StudyItems
- GUID-based synchronization for distributed deployments
- Import tracking via ImportedTimestamp, ImportedFrom, ImportedFileType

**Data Import/Export:**
- See [LoadDataFiles.md](LoadDataFiles.md) for import tracking
- Export respects privacy - aggregate only for public reports
- Use db-tool for testing export queries safely

## Glossary of Terms

**See comprehensive Bahá'í glossary in Task 10.4 documentation** (to be added).

**Quick reference:**
- **Cluster**: Primary operational geographic unit (town, city, or district) with development stage
- **Locality**: Specific village, town, or neighborhood within a cluster
- **Core Activities**: Children's classes (Type 0), Junior Youth groups (Type 1), Study Circles (Type 2)
- **Milestone**: Development stage of a cluster (1, 2, 3, indicating increasing capacity)
- **Study Circle**: Adult education group studying Ruhi Institute sequence
- **Junior Youth Group**: Ages 12-15 spiritual empowerment program
- **Tutor**: Person who facilitates a study circle (completed Book 7)
- **Auxiliary Board Member**: Institutional official supporting clusters
- **Institute Process**: Systematic educational framework for capacity building
- **Cycle**: Statistical reporting period (typically 3 months)

## Advanced Topics

### Performance Optimization

**Indexing strategies:**
- **Foreign keys**: Always index (LocalityId, ClusterId, RegionId, ActivityId, IndividualId, StudyItemId)
- **Filters**: Index IsArchived, IsCurrent, IsCompleted, ActivityType, StageOfDevelopment
- **Dates**: Index StartDate, EndDate, CreatedTimestamp for temporal queries
- **Composite indexes**: Consider for common filter combinations (e.g., LocalityId + IsArchived)

**Query optimization:**
- Limit result sets with `TOP` or date ranges
- Use `EXISTS` instead of `COUNT(*) > 0`
- Avoid `SELECT *` - specify columns
- Filter early in JOINs (push predicates down)
- Consider materialized views for complex aggregations (e.g., cycle statistics)

### Data Quality Patterns

**Consistency checks:**
- IsCompleted = 1 should have EndDate
- IsPrimary = 1 should be unique per Individual (for emails, phones)
- Participant counts should match ActivityStudyItemIndividuals counts (unless override flag set)
- Geographic hierarchy integrity (every Cluster has Region, every Locality has Cluster)

**Missing data handling:**
- EstimatedYearOfBirthDate: Use IsSelectedEstimatedYearOfBirthDate flag
- Optional hierarchy levels: Subregions, GroupOfClusters, Subdivisions may be NULL
- Contact info: Not all individuals have email/phone
- Multi-language: Not all study items translated to all languages

### Multi-Language Support

**Language codes:** Use ISO codes (en-US, es-ES, fr-FR, pt-BR, ar-SA, zh-CN, etc.)

**Query pattern for localized content:**
```sql
SELECT
    SI.[Id],
    COALESCE(LSI_Preferred.[Name], LSI_English.[Name]) AS [Name]
FROM [StudyItems] SI
LEFT JOIN [LocalizedStudyItems] LSI_Preferred
    ON SI.[Id] = LSI_Preferred.[StudyItemId]
    AND LSI_Preferred.[Language] = 'es-ES'  -- Preferred language
INNER JOIN [LocalizedStudyItems] LSI_English
    ON SI.[Id] = LSI_English.[StudyItemId]
    AND LSI_English.[Language] = 'en-US'  -- Fallback
ORDER BY SI.[Sequence];
```

## Additional Documentation

**Schema Analysis Reports** (in `reports/` directory):
- [SRP_Database_Schema_Analysis.md](../reports/SRP_Database_Schema_Analysis.md) - Database-wide relationships
- [Privacy_and_Security_Classification_Matrix.md](../reports/Privacy_and_Security_Classification_Matrix.md) - Comprehensive privacy guide
- [Schema_Documentation_Baseline_Audit.md](../reports/Schema_Documentation_Baseline_Audit.md) - Documentation quality assessment

**Project root documentation:**
- `CLAUDE.md` - Instructions for Claude Code when working with this database
- `prd.md` - Product requirements and project goals

## Notes for Developers

- **Transactions**: Always use for multi-table updates
- **Audit fields**: Automatically populated; don't modify CreatedTimestamp, CreatedBy, etc.
- **NULL handling**: Many fields optional; check for NULL before operations
- **Multi-language**: Use LocalizedStudyItems for display names
- **Referential integrity**: Maintain through proper foreign keys and cascading rules
- **Data types**: Use appropriate types for performance (bigint for IDs, nvarchar for Unicode)
- **Indexing**: Index all foreign keys and commonly filtered fields
- **Privacy**: Read privacy sections before developing any features touching personal data
- **Testing**: Use db-tool for query testing; queries logged for audit

## Contributing to Documentation

When updating schema documentation:
1. Follow the 9-section template (Overview, Structure, Relationships, Queries, Rules, Quality, Performance, Integration, Developer Notes)
2. Include SQL examples with square brackets
3. Add privacy sections for tables containing PII
4. Use fictitious data in examples
5. Update this README if adding new tables or categories
6. Test all query examples in db-tool before committing

---

**Last Updated:** November 18, 2024
**Database:** SRP (Statistical Reporting Program)
**Version:** 1.1 (Enhanced with Privacy & Integration Guidance)
**Documentation Tool:** Claude Code
