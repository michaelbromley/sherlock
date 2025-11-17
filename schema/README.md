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

## Notes for Developers

- Always use transactions for multi-table updates
- Respect audit fields in all data modifications
- Handle NULL values appropriately (many fields are optional)
- Consider multi-language support through LocalizedStudyItems
- Maintain referential integrity through proper foreign keys
- Use appropriate data types for performance
- Implement proper indexing strategies

---

*Generated: November 17, 2024*
*Database: SRP (Statistical Reporting Program)*
*Documentation Tool: Claude Code*