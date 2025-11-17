# Localities Table

## Overview
The `Localities` table represents specific geographic locations where Bahai community activities take place. A locality can be a village, town, city neighborhood, or any defined geographic area within a cluster. Localities are the level at which most activities are organized and where individuals reside. This table is central to the geographic hierarchy and serves as the primary location reference for both activities and individuals.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each locality

### Name

Name of the locality in local language/script

### LatinName

Romanized/Latin script version of the name

### Comments

Free-text notes and additional information

### ClusterId

Foreign key to Clusters table

### ElectoralUnitId

Foreign key to ElectoralUnits table (Bahai administrative unit)

### CreatedTimestamp

When the record was created

### CreatedBy

User ID who created the record

### LastUpdatedTimestamp

When the record was last modified

### LastUpdatedBy

User ID who last modified the record

### ImportedTimestamp

When data was imported from external system

### ImportedFrom

Source system identifier for imported data

### ImportedFileType

File format of imported data

### GUID

Globally unique identifier for synchronization

### LegacyId

Original ID from legacy system

### InstituteId

External institute system identifier

## Key Relationships

1. **Clusters** (ClusterId → Clusters.Id)
   - Every locality must belong to a cluster
   - Primary geographic containment relationship

2. **ElectoralUnits** (ElectoralUnitId → ElectoralUnits.Id)
   - Optional assignment to electoral unit for Bahai administrative purposes
   - Electoral units group localities for Bahai governance structures
   - Used for Local Spiritual Assembly elections and jurisdictions

3. **Subdivisions** (One-to-Many)
   - Localities can be divided into subdivisions (neighborhoods, sectors)
   - Subdivisions.LocalityId references this table
   - Provides finer geographic granularity

4. **Activities** (One-to-Many)
   - Activities are assigned to localities
   - Activities.LocalityId references this table
   - Core relationship for tracking where activities occur

5. **Individuals** (One-to-Many)
   - Individuals reside in localities
   - Individuals.LocalityId references this table
   - Primary residence assignment

## Geographic Hierarchy Context

Localities fit into the geographic hierarchy:
```
Region
  └── Cluster
      └── Locality
          └── Subdivision (optional)
```

This structure allows for:
- Regional aggregation of statistics
- Cluster-level planning and coordination
- Locality-specific activity tracking
- Neighborhood-level detail when needed

## Multi-Language Support

### Name Fields
- **Name**: Stores locality name in local script
  - May use Arabic, Chinese, Cyrillic, or other scripts
  - Primary identifier for local users

- **LatinName**: Romanized version
  - Enables international coordination
  - Useful for systems requiring Latin characters
  - Facilitates searching and sorting across languages

### Usage Patterns
- Display Name to local users
- Use LatinName for international reports
- Both fields aid in deduplication and data quality

## Common Query Patterns

### Localities in a Cluster
```sql
SELECT
    L.[Name],
    L.[LatinName],
    C.[Name] AS ClusterName
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE C.[Id] = @ClusterId
ORDER BY L.[Name]
```

### Localities with Activity Counts
```sql
SELECT
    L.[Name],
    COUNT(A.[Id]) AS ActivityCount
FROM [Localities] L
LEFT JOIN [Activities] A ON L.[Id] = A.[LocalityId]
WHERE L.[ClusterId] = @ClusterId
GROUP BY L.[Id], L.[Name]
ORDER BY ActivityCount DESC
```

### Localities with Population
```sql
SELECT
    L.[Name],
    COUNT(I.[Id]) AS IndividualCount
FROM [Localities] L
LEFT JOIN [Individuals] I ON L.[Id] = I.[LocalityId]
WHERE I.[IsArchived] = 0
GROUP BY L.[Id], L.[Name]
ORDER BY IndividualCount DESC
```

### Electoral Unit Assignment
```sql
SELECT
    L.[Name] AS LocalityName,
    EU.[Name] AS ElectoralUnitName,
    C.[Name] AS ClusterName
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
LEFT JOIN [ElectoralUnits] EU ON L.[ElectoralUnitId] = EU.[Id]
WHERE C.[Id] = @ClusterId
ORDER BY EU.[Name], L.[Name]
```

### Full Geographic Hierarchy
```sql
SELECT
    NC.[Name] AS NationalCommunity,
    R.[Name] AS Region,
    C.[Name] AS Cluster,
    L.[Name] AS Locality
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
INNER JOIN [NationalCommunities] NC ON R.[NationalCommunityId] = NC.[Id]
ORDER BY NC.[Name], R.[Name], C.[Name], L.[Name]
```

## Business Rules and Constraints

1. **Required Cluster**: Every locality must belong to a cluster (ClusterId NOT NULL)
2. **Name Required**: Locality must have a name
3. **Unique Names**: Within a cluster, locality names should be unique
4. **Electoral Unit**: Optional - not all localities assigned to electoral units
5. **Active Records**: Localities are rarely deleted; archival handled at individual/activity level

## Usage Patterns

### Activity Organization
Localities are the primary level for organizing activities:
- Children's classes held in specific localities
- Junior youth groups organized by locality
- Study circles meet in locality locations
- Devotional meetings hosted in locality homes

### Individual Assignment
Individuals are assigned to localities:
- Residence tracking
- Community membership
- Contact and communication
- Service area identification

### Statistical Reporting
Locality-level data rolls up to cluster statistics:
- Activity counts per locality
- Participant numbers aggregated
- Population demographics summed
- Used in Cycles table calculations

## Special Considerations

### Electoral Units
The ElectoralUnitId provides Bahai administrative structure:
- **Purpose**: Groups localities for Local Spiritual Assembly elections
- **Optional**: Not all localities belong to electoral units
- **Governance**: Defines voting jurisdictions
- **Multiple Localities**: One electoral unit may include several localities
- **Administrative**: Separate from geographic clusters

### Subdivisions
Some localities are further divided:
- **Urban Areas**: Large cities divided into neighborhoods
- **Optional**: Only used when finer granularity needed
- **Activities**: Can be assigned to specific subdivisions
- **Individuals**: May be assigned to subdivision within locality

## Data Quality Considerations

### Name Standardization
- Consistent naming conventions within cluster
- Both local and Latin names maintained
- Duplicate prevention through unique constraints
- Regular data cleaning for merged localities

### Import and Migration
Standard import tracking fields support:
- **ImportedFrom**: Source system identifier
- **LegacyId**: Original system ID preservation
- **GUID**: Synchronization across systems
- **InstituteId**: External institute system links

## Notes for Developers

- Always include ClusterId in queries for performance
- Check for NULL ElectoralUnitId before joining
- Consider both Name and LatinName for search functionality
- Use LEFT JOIN for subdivisions as they're optional
- Filter archived individuals/completed activities appropriately
- Locality is the most common join point in the schema

## Performance Optimization

### Indexing Recommendations
- ClusterId (high selectivity, frequent joins)
- ElectoralUnitId (for administrative queries)
- Name (for search and lookup)
- GUID (for synchronization operations)

### Query Tips
- Filter by cluster first to reduce result sets
- Use appropriate indexes for geographic traversal
- Consider materialized views for complex aggregations
- Cache locality lists per cluster for UI dropdowns

## Relationship to Other Systems

### Institute Tracking
The InstituteId field links localities to external institute management systems:
- Training program coordination
- Tutor/facilitator assignments
- Course scheduling
- Resource allocation

### External Synchronization
The GUID field enables:
- Multi-site deployments
- Mobile app synchronization
- Backup/restore operations
- Data exchange between regional databases
