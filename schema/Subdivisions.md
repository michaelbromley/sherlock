# Subdivisions Table

## Overview
The `Subdivisions` table represents the finest level of geographic granularity in the SRP database. Subdivisions are neighborhoods, sectors, or districts within a locality, used primarily in urban areas where a locality (city) needs to be divided into smaller units for better organization and management of activities and individuals. This is an optional level in the geographic hierarchy, used only when finer detail is needed.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier for each subdivision |
| **Name** | nvarchar(255) | NO | Name of the subdivision (neighborhood, sector, district) |
| **LatinName** | nvarchar(255) | YES | Romanized/Latin script version of the name |
| **Comments** | nvarchar(max) | YES | Free-text notes and additional information |
| **LocalityId** | bigint | NO | Foreign key to Localities table |
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

1. **Localities** (LocalityId → Localities.Id)
   - Every subdivision must belong to a locality
   - Provides neighborhood-level organization within cities

2. **Activities** (One-to-Many)
   - Activities can optionally be assigned to subdivisions
   - Activities.SubdivisionId references this table
   - Enables precise location tracking for activities

3. **Individuals** (One-to-Many)
   - Individuals can optionally be assigned to subdivisions
   - Individuals.SubdivisionId references this table
   - Provides precise residence information

## Geographic Hierarchy Context

Subdivisions are the most detailed level in the hierarchy:
```
Region
  └── Cluster
      └── Locality
          └── Subdivision (optional, finest level)
```

### When Subdivisions Are Used

**Urban Areas**
- Large cities divided into neighborhoods
- Districts or sectors for management
- Postal zones or administrative divisions

**Population Density**
- High-density localities requiring finer detail
- Multiple activities in different parts of city
- Distinct community groupings within locality

**Not Used**
- Small towns and villages (locality level sufficient)
- Rural areas (typically one locality = one community)
- Low-density regions

## Usage Patterns

### Optional Nature
- Subdivisions are completely optional
- Most localities do not have subdivisions
- Used only where added detail provides value
- Activities and individuals can be assigned directly to localities

### Common Scenarios
1. **Large Cities**: "Downtown", "North Side", "East End"
2. **Administrative Districts**: "Ward 1", "Ward 2", "District A"
3. **Neighborhoods**: "Capitol Hill", "Georgetown", "Dupont Circle"
4. **Postal Areas**: Based on postal codes or delivery zones
5. **Natural Divisions**: Rivers, highways, or geographic features

## Multi-Language Support

### Name Fields
- **Name**: Subdivision name in local language/script
  - Local neighborhood names
  - May include colloquial or historical names
  - Examples: "حی شمالی" (Northern Neighborhood)

- **LatinName**: Romanized version
  - For international systems
  - Consistent sorting and searching
  - Examples: "Northern Neighborhood"

## Common Query Patterns

### Subdivisions in a Locality
```sql
SELECT
    S.[Name],
    S.[LatinName],
    L.[Name] AS LocalityName
FROM [Subdivisions] S
INNER JOIN [Localities] L ON S.[LocalityId] = L.[Id]
WHERE L.[Id] = @LocalityId
ORDER BY S.[Name]
```

### Activities by Subdivision
```sql
SELECT
    S.[Name] AS Subdivision,
    L.[Name] AS Locality,
    COUNT(A.[Id]) AS ActivityCount
FROM [Subdivisions] S
INNER JOIN [Localities] L ON S.[LocalityId] = L.[Id]
LEFT JOIN [Activities] A ON S.[Id] = A.[SubdivisionId]
GROUP BY S.[Id], S.[Name], L.[Name]
ORDER BY ActivityCount DESC
```

### Individuals by Subdivision
```sql
SELECT
    S.[Name] AS Subdivision,
    COUNT(I.[Id]) AS IndividualCount,
    SUM(CASE WHEN I.[IsBahai] = 1 THEN 1 ELSE 0 END) AS BahaiCount
FROM [Subdivisions] S
INNER JOIN [Localities] L ON S.[LocalityId] = L.[Id]
LEFT JOIN [Individuals] I ON S.[Id] = I.[SubdivisionId] AND I.[IsArchived] = 0
GROUP BY S.[Id], S.[Name]
ORDER BY IndividualCount DESC
```

### Full Address Information
```sql
SELECT
    I.[FirstName] + ' ' + I.[FamilyName] AS FullName,
    S.[Name] AS Subdivision,
    L.[Name] AS Locality,
    C.[Name] AS Cluster,
    R.[Name] AS Region
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
LEFT JOIN [Subdivisions] S ON I.[SubdivisionId] = S.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE I.[Id] = @IndividualId
```

## Business Rules and Constraints

1. **Required Locality**: Every subdivision must belong to a locality
2. **Name Required**: Subdivision must have a name
3. **Unique Names**: Within a locality, subdivision names should be unique
4. **Optional Assignment**: Activities and individuals may or may not have subdivisions
5. **Locality Required First**: Subdivision only makes sense within a locality context

## Data Quality Considerations

### When to Create Subdivisions
- **Need**: Clear organizational benefit
- **Size**: Locality large enough to warrant subdivision
- **Activities**: Multiple activities in different areas
- **Management**: Improves coordination and planning

### When NOT to Create Subdivisions
- **Small Localities**: Few activities or individuals
- **Rural Areas**: Natural locality boundaries sufficient
- **Complexity**: Additional level adds unnecessary complexity
- **Maintenance**: Overhead of managing extra geographic level

### Name Standardization
- Use consistent naming conventions within locality
- Align with governmental or postal divisions when possible
- Document common/colloquial vs. official names
- Maintain both local and Latin names for clarity

## Performance Considerations

### Query Optimization
- Always filter by LocalityId first
- Use LEFT JOIN when joining from Activities or Individuals
- Remember that SubdivisionId is often NULL
- Index on LocalityId for subdivision lookups

### Data Volume
- Typically far fewer subdivisions than localities
- Most localities have zero subdivisions
- Urban clusters may have dozens of subdivisions
- Total records usually in hundreds, not thousands

## Integration Considerations

### Import and Migration
Standard tracking fields support:
- **ImportedFrom**: Source system for subdivision data
- **LegacyId**: Original subdivision identifiers
- **GUID**: Synchronization across systems
- **InstituteId**: Links to external institute systems

### Synchronization
- Subdivisions may be managed locally
- GUID enables multi-site synchronization
- Changes propagate to dependent records (Activities, Individuals)
- Referential integrity must be maintained

## Notes for Developers

- Always check for NULL SubdivisionId in queries
- Use LEFT JOIN when joining to this table
- Most records in system will not have subdivisions
- Provide UI only when locality has subdivisions
- Consider locality size before suggesting subdivisions
- Validate subdivision belongs to correct locality

## User Interface Considerations

### Dynamic Forms
- Show subdivision field only when subdivisions exist for selected locality
- Cascade selection: Locality → Subdivisions
- Make subdivision optional even when available
- Provide "Add new subdivision" functionality inline

### Display
- Show full address hierarchy when subdivision present
- Format as: "Subdivision, Locality, Cluster"
- Allow searching by any level of geography
- Filter lists appropriately by locality

## Reporting Implications

### Statistical Aggregation
- Subdivision-level reports for detailed urban analysis
- Roll up to locality for standard reporting
- Provide drill-down capability in reports
- Compare subdivisions within locality

### Geographic Analysis
- Identify growth patterns within cities
- Resource allocation at neighborhood level
- Targeted outreach in specific areas
- Track activity concentration

## Special Cases

### Historical Changes
- Subdivisions may merge or split
- Name changes (governmental reorganization)
- Boundary adjustments
- Archive old subdivisions rather than delete

### Cultural Considerations
- Local naming customs and preferences
- Formal vs. informal names
- Historical vs. current names
- Community identity and boundaries

## Best Practices

1. **Only When Needed**: Create subdivisions only when they add clear value
2. **Consistent Names**: Use standardized naming within locality
3. **Documentation**: Use Comments field to explain boundaries or special cases
4. **Validation**: Ensure subdivision belongs to correct locality
5. **Optional Usage**: Never require subdivision when locality is sufficient
6. **User Choice**: Let users decide whether to specify subdivision level detail
