# Regions Table

## Overview
The `Regions` table represents major administrative divisions within a national Bahai community. Regions are the primary organizational level for coordinating community-building activities across multiple clusters. They serve as the intermediate level between national administration and local cluster operations, providing coordination, resource allocation, and strategic planning for community growth.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each region

### Name

Name of the region in local language/script

### LatinName

Romanized/Latin script version of the name

### Comments

Free-text notes and additional information

### NationalCommunityId

Foreign key to NationalCommunities table

### GroupOfRegionId

Foreign key to GroupOfRegions table (optional grouping)

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

1. **NationalCommunities** (NationalCommunityId → NationalCommunities.Id)
   - Every region must belong to a national community
   - Primary hierarchical relationship

2. **GroupOfRegions** (GroupOfRegionId → GroupOfRegions.Id)
   - Optional grouping of related regions
   - Used in large countries for intermediate coordination
   - May be NULL for most regions

3. **Clusters** (One-to-Many)
   - Regions contain multiple clusters
   - Clusters.RegionId references this table
   - Primary organizational subdivision

4. **Subregions** (One-to-Many)
   - Optional intermediate level between regions and clusters
   - Subregions.RegionId references this table
   - Used in large or complex regions

## Geographic Hierarchy Context

Regions fit into the full geographic hierarchy:
```
NationalCommunities
  └── GroupOfRegions (optional)
      └── Regions
          └── Subregions (optional)
              └── Clusters
                  └── Localities
                      └── Subdivisions (optional)
```

### Typical Hierarchy Patterns

**Simple Pattern** (smaller countries):
```
National Community → Regions → Clusters → Localities
```

**Complex Pattern** (larger countries):
```
National Community → Group of Regions → Regions → Subregions → Clusters → Localities
```

## Administrative Functions

Regions serve several key administrative purposes:

### Coordination
- Regional Teaching Committees coordinate growth activities
- Regional Councils oversee community development
- Resource allocation across clusters
- Training coordination and tutor development

### Planning
- Regional growth plans and goals
- Cluster support and development strategies
- Conference and gathering organization
- Communication with national institutions

### Monitoring
- Track cluster development stages
- Monitor activity statistics across region
- Identify support needs and opportunities
- Report progress to national level

## Multi-Language Support

### Name Fields
- **Name**: Region name in local script
  - May use national language characters
  - Primary identifier for local users
  - Examples: Arabic, Chinese, Persian, etc.

- **LatinName**: Romanized version
  - Enables international coordination
  - Useful for cross-border collaboration
  - Facilitates global reporting

## Common Query Patterns

### Regions in a National Community
```sql
SELECT
    R.[Name],
    R.[LatinName],
    NC.[Name] AS NationalCommunity
FROM [Regions] R
INNER JOIN [NationalCommunities] NC ON R.[NationalCommunityId] = NC.[Id]
WHERE NC.[Id] = @NationalCommunityId
ORDER BY R.[Name]
```

### Regions with Cluster Counts
```sql
SELECT
    R.[Name],
    COUNT(C.[Id]) AS ClusterCount,
    SUM(CASE WHEN C.[StageOfDevelopment] = 'Milestone1' THEN 1 ELSE 0 END) AS Milestone1Count,
    SUM(CASE WHEN C.[StageOfDevelopment] = 'Milestone2' THEN 1 ELSE 0 END) AS Milestone2Count,
    SUM(CASE WHEN C.[StageOfDevelopment] = 'Milestone3' THEN 1 ELSE 0 END) AS Milestone3Count
FROM [Regions] R
LEFT JOIN [Clusters] C ON R.[Id] = C.[RegionId]
GROUP BY R.[Id], R.[Name]
ORDER BY R.[Name]
```

### Regional Activity Summary
```sql
SELECT
    R.[Name] AS RegionName,
    COUNT(DISTINCT C.[Id]) AS ClusterCount,
    COUNT(DISTINCT L.[Id]) AS LocalityCount,
    COUNT(DISTINCT A.[Id]) AS ActivityCount
FROM [Regions] R
INNER JOIN [Clusters] C ON R.[Id] = C.[RegionId]
INNER JOIN [Localities] L ON C.[Id] = L.[ClusterId]
LEFT JOIN [Activities] A ON L.[Id] = A.[LocalityId]
WHERE A.[IsCompleted] = 0
GROUP BY R.[Id], R.[Name]
ORDER BY ActivityCount DESC
```

### Regions by Group
```sql
SELECT
    GOR.[Name] AS GroupOfRegions,
    R.[Name] AS RegionName,
    COUNT(C.[Id]) AS ClusterCount
FROM [Regions] R
LEFT JOIN [GroupOfRegions] GOR ON R.[GroupOfRegionId] = GOR.[Id]
LEFT JOIN [Clusters] C ON R.[Id] = C.[RegionId]
GROUP BY GOR.[Name], R.[Id], R.[Name]
ORDER BY GOR.[Name], R.[Name]
```

### Regional Population and Activities
```sql
SELECT
    R.[Name],
    COUNT(DISTINCT I.[Id]) AS TotalIndividuals,
    COUNT(DISTINCT CASE WHEN I.[IsBahai] = 1 THEN I.[Id] END) AS BahaiCount,
    COUNT(DISTINCT A.[Id]) AS ActivityCount
FROM [Regions] R
INNER JOIN [Clusters] C ON R.[Id] = C.[RegionId]
INNER JOIN [Localities] L ON C.[Id] = L.[ClusterId]
LEFT JOIN [Individuals] I ON L.[Id] = I.[LocalityId] AND I.[IsArchived] = 0
LEFT JOIN [Activities] A ON L.[Id] = A.[LocalityId]
GROUP BY R.[Id], R.[Name]
ORDER BY BahaiCount DESC
```

## Business Rules and Constraints

1. **Required National Community**: Every region must belong to a national community
2. **Name Required**: Region must have a name
3. **Unique Names**: Within a national community, region names should be unique
4. **Optional Grouping**: GroupOfRegionId is optional (commonly NULL)
5. **Stable Boundaries**: Regional boundaries rarely change

## Usage in Reporting

Regions are critical for:
- **Regional Reports**: Aggregating cluster statistics
- **Comparison Analysis**: Comparing regions within a country
- **Resource Planning**: Allocating tutors, materials, funds
- **Strategic Planning**: Setting regional goals and priorities
- **Progress Tracking**: Monitoring cluster development across region

## Statistical Aggregation

Regional statistics typically aggregate:
- Cluster counts and development stages
- Total activities across all localities
- Population demographics (Bahai and general)
- Institute course completions
- Core activity participation numbers

## Special Considerations

### Group of Regions
The optional GroupOfRegionId allows for:
- **Large Countries**: Intermediate coordination level
- **Geographic Zones**: Natural geographic groupings
- **Administrative Convenience**: Easier management of many regions
- **Flexibility**: Not all regions need to belong to groups

### Subregions
Large or complex regions may use subregions:
- **Population**: High-population regions
- **Geography**: Geographically dispersed regions
- **Administration**: Easier cluster coordination
- **Optional**: Most regions operate without subregions

## Data Quality Considerations

### Boundary Consistency
- Regional boundaries should align with cluster boundaries
- All clusters in a region belong to that region exclusively
- Boundary changes require careful data migration
- Historical data preservation important

### Name Management
- Consistent naming conventions
- Both local and Latin names maintained
- Official names vs. colloquial names
- Regular validation against national records

## Notes for Developers

- Regions are relatively stable - infrequent changes
- Always join through clusters for locality/activity data
- Check for NULL GroupOfRegionId before joining
- Consider both Name and LatinName for international systems
- Regional aggregations can be expensive - consider caching
- Use appropriate indexes for hierarchical traversal

## Performance Considerations

### Indexing
- NationalCommunityId for national-level queries
- GroupOfRegionId for group-based queries
- Name for search and lookup
- GUID for synchronization

### Caching Strategies
- Regional hierarchies change infrequently
- Cache region-cluster mappings
- Precompute regional statistics periodically
- Invalidate cache on boundary changes

## Integration Points

### Institute Systems
The InstituteId field enables:
- Regional Training Institute coordination
- Tutor assignment and tracking
- Course scheduling and locations
- Resource distribution

### External Systems
Standard synchronization fields support:
- National database integration
- Continental reporting systems
- Global data aggregation
- Mobile application synchronization

## Historical Context

Regions represent the Bahai administrative structure:
- Correspond to Regional Bahai Councils in some countries
- May align with governmental administrative divisions
- Evolved from earlier district/state structures
- Support decentralized growth planning
- Balance local initiative with national coordination
