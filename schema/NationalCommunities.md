# NationalCommunities Table

## Overview
The `NationalCommunities` table represents the highest level in the geographic hierarchy of the SRP database. Each record represents a country or territory where the Bahai Faith is established and organized. National communities are the top-level administrative units, typically corresponding to countries with National Spiritual Assemblies or Regional Bahai Councils. This table serves as the root of the entire geographic organizational structure.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier for each national community |
| **Name** | nvarchar(255) | NO | Name of the national community (country/territory) |
| **LatinName** | nvarchar(255) | YES | Romanized/Latin script version of the name |
| **Comments** | nvarchar(max) | YES | Free-text notes and additional information |
| **CreatedTimestamp** | datetime | NO | When the record was created |
| **CreatedBy** | uniqueidentifier | NO | User ID who created the record |
| **LastUpdatedTimestamp** | datetime | NO | When the record was last modified |
| **LastUpdatedBy** | uniqueidentifier | NO | User ID who last modified the record |
| **ImportedTimestamp** | datetime | YES | When data was imported from external system |
| **ImportedFrom** | uniqueidentifier | YES | Source system identifier for imported data |
| **ImportedFileType** | varchar(50) | YES | File format of imported data |
| **GUID** | uniqueidentifier | NO | Globally unique identifier for synchronization |
| **LegacyId** | nvarchar(255) | YES | Original ID from legacy system |
| **InstituteId** | nvarchar(50) | YES | External institute system identifier |

## Key Relationships

1. **Regions** (One-to-Many)
   - National communities contain multiple regions
   - Regions.NationalCommunityId references this table
   - Primary organizational subdivision

2. **GroupOfRegions** (One-to-Many)
   - Optional intermediate level for large countries
   - GroupOfRegions.NationalCommunityId references this table
   - Used in countries with many regions

## Geographic Hierarchy

National communities are the root of the entire geographic structure:
```
NationalCommunities (Root Level)
  └── GroupOfRegions (optional)
      └── Regions
          └── Subregions (optional)
              └── Clusters
                  └── GroupOfClusters (optional)
                      └── Localities
                          └── Subdivisions (optional)
```

## Administrative Significance

### National Spiritual Assemblies
- Each national community typically has a National Spiritual Assembly
- Highest elected administrative body for the country
- Coordinates all Bahai activities within the country
- Reports to the Universal House of Justice

### Regional Bahai Councils
- Some countries have Regional Bahai Councils instead of NSAs
- Appointed bodies coordinating regional development
- Transitional structure for emerging communities
- Report to the Universal House of Justice

### National-Level Functions
- Strategic planning for national growth
- Resource allocation across regions
- Training institute coordination
- Publishing and distribution
- External affairs and representation
- National conferences and gatherings

## Multi-Language Support

### Name Fields
- **Name**: Country name in local official language(s)
  - May use national script (Arabic, Chinese, etc.)
  - Official governmental name conventions
  - Examples: "中国" (China), "ایران" (Iran)

- **LatinName**: Romanized/English version
  - International standard name
  - Used for global coordination
  - Examples: "China", "Iran", "United States"

## Common Query Patterns

### List All National Communities
```sql
SELECT
    [Name],
    [LatinName]
FROM [NationalCommunities]
ORDER BY [LatinName]
```

### National Community with Regional Breakdown
```sql
SELECT
    NC.[Name] AS NationalCommunity,
    COUNT(DISTINCT R.[Id]) AS RegionCount,
    COUNT(DISTINCT C.[Id]) AS ClusterCount,
    COUNT(DISTINCT L.[Id]) AS LocalityCount
FROM [NationalCommunities] NC
LEFT JOIN [Regions] R ON NC.[Id] = R.[NationalCommunityId]
LEFT JOIN [Clusters] C ON R.[Id] = C.[RegionId]
LEFT JOIN [Localities] L ON C.[Id] = L.[ClusterId]
WHERE NC.[Id] = @NationalCommunityId
GROUP BY NC.[Id], NC.[Name]
```

### National Statistics Summary
```sql
SELECT
    NC.[Name],
    COUNT(DISTINCT C.[Id]) AS TotalClusters,
    SUM(CASE WHEN C.[StageOfDevelopment] LIKE 'Milestone%' THEN 1 ELSE 0 END) AS MilestoneClusters,
    COUNT(DISTINCT A.[Id]) AS ActiveActivities,
    COUNT(DISTINCT I.[Id]) AS RegisteredIndividuals
FROM [NationalCommunities] NC
LEFT JOIN [Regions] R ON NC.[Id] = R.[NationalCommunityId]
LEFT JOIN [Clusters] C ON R.[Id] = C.[RegionId]
LEFT JOIN [Localities] L ON C.[Id] = L.[ClusterId]
LEFT JOIN [Activities] A ON L.[Id] = A.[LocalityId] AND A.[IsCompleted] = 0
LEFT JOIN [Individuals] I ON L.[Id] = I.[LocalityId] AND I.[IsArchived] = 0
WHERE NC.[Id] = @NationalCommunityId
GROUP BY NC.[Id], NC.[Name]
```

### Cross-National Comparison
```sql
SELECT
    NC.[LatinName] AS Country,
    COUNT(DISTINCT C.[Id]) AS Clusters,
    COUNT(DISTINCT CASE WHEN C.[StageOfDevelopment] = 'Milestone3' THEN C.[Id] END) AS Milestone3Clusters,
    COUNT(DISTINCT A.[Id]) AS CoreActivities
FROM [NationalCommunities] NC
LEFT JOIN [Regions] R ON NC.[Id] = R.[NationalCommunityId]
LEFT JOIN [Clusters] C ON R.[Id] = C.[RegionId]
LEFT JOIN [Localities] L ON C.[Id] = L.[ClusterId]
LEFT JOIN [Activities] A ON L.[Id] = A.[LocalityId] AND A.[IsCompleted] = 0
GROUP BY NC.[Id], NC.[LatinName]
ORDER BY CoreActivities DESC
```

## Business Rules and Constraints

1. **Name Required**: Every national community must have a name
2. **Unique Names**: National community names should be globally unique
3. **Stable Records**: National communities rarely added/removed
4. **No Parent**: National communities are root-level entities (no foreign keys to higher levels)
5. **Latin Name**: Strongly recommended for international coordination

## Usage in Reporting

National communities are used for:
- **Continental Reports**: Aggregation for continental counselors
- **Global Statistics**: Worldwide growth tracking
- **International Comparison**: Cross-country analysis
- **Resource Planning**: National-level resource allocation
- **Strategic Planning**: Five Year Plan goals and achievements

## Data Scope

### Typical Instances
- Countries with National Spiritual Assemblies (e.g., United States, India, Brazil)
- Territories with Regional Bahai Councils (e.g., various countries)
- Dependencies and territories (e.g., Puerto Rico, territories)
- Regions under development (emerging communities)

### Special Cases
- **Multi-Country NSAs**: Some NSAs serve multiple countries
- **Island Nations**: Multiple islands may form one national community
- **Political Changes**: Occasionally boundaries change with geopolitical events
- **Dependencies**: Some territories may be separate or grouped

## Data Quality Considerations

### Name Standardization
- Use official country names
- Maintain consistency with UN or governmental standards
- Both local and international names
- Avoid abbreviations in formal name field

### Historical Continuity
- Preserve historical data when boundaries change
- Legacy IDs track previous configurations
- Comments field documents significant changes
- Maintain referential integrity through changes

## Integration Points

### Global Coordination
The GUID field enables:
- Synchronization with global Bahai databases
- Continental-level reporting systems
- World Centre data integration
- Cross-border coordination

### Institute Systems
The InstituteId field links to:
- National training institutes
- Regional training institute coordination
- Global institute curriculum systems
- Resource sharing across countries

## Performance Considerations

### Caching
- National community list is small and stable
- Cache for dropdown lists and lookups
- Infrequent updates mean long cache validity
- Refresh on administrative changes only

### Indexing
- Primary key for direct lookup
- Name and LatinName for search
- GUID for synchronization operations
- Minimal indexes needed due to small table size

## Statistical Aggregation

National-level statistics typically include:
- Total regions, clusters, localities
- Population demographics (Bahai and general)
- Core activity counts and participation
- Institute course completions
- Cluster development stage distribution
- Growth trends over time

## Notes for Developers

- Small table (typically < 200 rows globally)
- Very stable - changes are rare
- Root of all geographic hierarchies
- Always use for top-level filtering and grouping
- Consider both Name and LatinName for international applications
- Cache aggressively due to stability
- Use LatinName for consistent sorting across languages

## Special Considerations

### Continental Structure
While not explicitly in the database, national communities group into continents:
- **Africa**: Various national communities
- **Americas**: North, Central, and South America
- **Asia**: East, South, Southeast, and West Asia
- **Australasia**: Australia, Pacific Islands, New Zealand
- **Europe**: European countries

Continental-level reporting requires grouping national communities appropriately.

### Emerging Communities
Some entries may represent:
- Countries with developing Bahai communities
- Territories transitioning to full NSA status
- Regions under Continental Counselors' direct oversight
- Areas with Regional Bahai Councils

### Multi-Instance Deployments
The SRP system may be deployed:
- **Single National Community**: One database per country
- **Multi-National**: Continental or regional deployments
- **Global**: Worldwide coordination database

The NationalCommunities table accommodates all deployment models.
