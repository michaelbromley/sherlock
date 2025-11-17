# Clusters Table

## Overview
The `Clusters` table represents the primary operational unit in the Bahai administrative structure. A cluster is a geographic area that serves as the basic unit for community development and growth activities. Clusters can range from a small town to a large metropolitan area, depending on population density and the distribution of Bahai believers. Each cluster is categorized by its stage of development (milestones) which indicates its capacity for sustained community-building activities.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each cluster

### Name

Name of the cluster in local language/script

### LatinName

Romanized/Latin script version of the name for international use

### StageOfDevelopment

Development stage: Milestone1, Milestone2, Milestone3, etc.

### GeographicSize

Numeric value for the cluster's geographic area

### GeographicSizeUnit

Unit of measurement (e.g., "km²", "mi²")

### TotalPopulation

Estimated total population living in the cluster area

### ChildrenClassCoordinators

Number of individuals coordinating children's classes

### JuniorYouthGroupCoordinators

Number of individuals coordinating junior youth groups

### StudyCircleCoordinators

Number of individuals coordinating study circles

### Comments

Free-text notes and additional information about the cluster

### RegionId

Foreign key to Regions table

### SubregionId

Foreign key to Subregions table (optional intermediate level)

### GroupOfClusterId

Foreign key to GroupOfClusters table (optional grouping)

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

1. **Regions** (RegionId → Regions.Id)
   - Every cluster must belong to a region
   - Regions are higher-level administrative divisions

2. **Subregions** (SubregionId → Subregions.Id)
   - Optional intermediate level between regions and clusters
   - Used in larger regions for better organization

3. **GroupOfClusters** (GroupOfClusterId → GroupOfClusters.Id)
   - Optional grouping of related clusters
   - Used for coordinated planning and resource allocation

4. **Localities** (One-to-Many)
   - Clusters contain multiple localities (villages, towns, neighborhoods)
   - Localities.ClusterId references this table

5. **Cycles** (One-to-Many)
   - Statistical reporting periods for the cluster
   - Tracks growth and activity metrics over time

6. **ClusterAuxiliaryBoardMembers** (One-to-Many)
   - Bahai administrative officials assigned to support the cluster
   - Provides guidance and coordination

## Development Stages

The **StageOfDevelopment** field tracks the cluster's progression through milestones that indicate increasing capacity for sustained growth:

### Milestone Progression
- **Milestone 1**: Cluster demonstrates initial capacity for systematic growth
  - Regular core activities established
  - Small but growing number of participants

- **Milestone 2**: Cluster reaches a level of sustained expansion
  - Significant increase in core activities
  - Growing involvement of community members
  - Regular cycles of growth established

- **Milestone 3**: Cluster achieves intensive program of growth
  - Large-scale expansion activities
  - Strong pattern of community life
  - Significant numbers progressing through institute process

- **Higher Milestones**: Some clusters progress beyond Milestone 3
  - Advanced community-building capacity
  - Complex patterns of activity
  - Multiplication of growth initiatives

## Coordinator Tracking

The table tracks three types of coordinators who facilitate the cluster's core activities:

1. **ChildrenClassCoordinators**: Individuals who organize and oversee children's classes
2. **JuniorYouthGroupCoordinators**: Those facilitating junior youth empowerment programs
3. **StudyCircleCoordinators**: Coordinators of adult study circle programs

These coordinators are critical human resources for implementing the cluster's educational activities.

## Geographic Information

### Size Tracking
- **GeographicSize** and **GeographicSizeUnit**: Physical area of the cluster
- Used for planning resource allocation and understanding population density
- Common units: square kilometers (km²), square miles (mi²)

### Population Data
- **TotalPopulation**: Estimated total inhabitants in the cluster area
- Important for calculating penetration rates of educational activities
- Used in strategic planning and goal setting

## Hierarchical Geographic Context

Clusters fit into the broader geographic hierarchy:
```
NationalCommunities
  └── GroupOfRegions (optional)
      └── Regions
          └── Subregions (optional)
              └── Clusters
                  └── GroupOfClusters (optional)
                      └── Localities
```

## Common Query Patterns

### Clusters by Development Stage
```sql
SELECT
    [StageOfDevelopment],
    COUNT(*) AS [ClusterCount]
FROM [Clusters]
WHERE [StageOfDevelopment] IS NOT NULL
GROUP BY [StageOfDevelopment]
ORDER BY [StageOfDevelopment]
```

### Clusters with Coordinator Information
```sql
SELECT
    C.[Name],
    C.[StageOfDevelopment],
    C.[ChildrenClassCoordinators],
    C.[JuniorYouthGroupCoordinators],
    C.[StudyCircleCoordinators],
    (C.[ChildrenClassCoordinators] +
     C.[JuniorYouthGroupCoordinators] +
     C.[StudyCircleCoordinators]) AS [TotalCoordinators]
FROM [Clusters] C
ORDER BY [TotalCoordinators] DESC
```

### Clusters within a Region
```sql
SELECT
    C.[Name],
    C.[StageOfDevelopment],
    C.[TotalPopulation],
    R.[Name] AS [RegionName]
FROM [Clusters] C
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE R.[Id] = @RegionId
ORDER BY C.[Name]
```

### Population Density Analysis
```sql
SELECT
    C.[Name],
    C.[TotalPopulation],
    C.[GeographicSize],
    C.[GeographicSizeUnit],
    CASE
        WHEN C.[GeographicSize] > 0
        THEN CAST(C.[TotalPopulation] AS FLOAT) / C.[GeographicSize]
        ELSE NULL
    END AS [PopulationDensity]
FROM [Clusters] C
WHERE C.[GeographicSize] IS NOT NULL
    AND C.[TotalPopulation] IS NOT NULL
ORDER BY [PopulationDensity] DESC
```

## Business Rules and Constraints

1. **Required Region**: Every cluster must belong to a region (RegionId is NOT NULL)
2. **Name Required**: Cluster must have a name in local language
3. **Development Stage**: Should follow milestone progression (1 → 2 → 3)
4. **Coordinator Counts**: Should be non-negative integers
5. **Population Logic**: TotalPopulation should be positive when specified
6. **Geographic Size**: Must have both size and unit, or neither
7. **Unique Names**: Within a region, cluster names should be unique

## Usage in Reporting

Clusters are central to most statistical reporting:
- **Cycle Reports**: Activity statistics aggregated by cluster
- **Regional Analysis**: Comparison of cluster development across regions
- **Resource Planning**: Coordinator needs and support requirements
- **Growth Tracking**: Progression through development stages over time

## Notes for Developers

- Always join with Regions to get full geographic context
- Consider both Name and LatinName for international applications
- Use StageOfDevelopment for filtering advanced vs. emerging clusters
- Coordinator counts indicate human resource capacity
- Population data helps contextualize activity statistics
- Check for NULL values in optional geographic hierarchy fields (SubregionId, GroupOfClusterId)

## Special Considerations

### Multi-Language Support
- **Name**: Stores cluster name in local script (Arabic, Chinese, etc.)
- **LatinName**: Provides romanized version for systems requiring Latin characters
- Both fields help with international coordination and reporting

### Optional Hierarchy Levels
Not all clusters use Subregions or GroupOfClusters:
- These are organizational tools for larger or more complex regions
- Always check for NULL before joining to these tables
- Their presence varies by regional administrative preferences
