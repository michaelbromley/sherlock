# GroupOfClusters Table

## Overview
The `GroupOfClusters` table represents an optional grouping of related clusters within a region. This organizational level is used when multiple clusters can benefit from coordinated planning, resource sharing, and joint activities. Like subregions, groups of clusters are optional and used only when they provide clear organizational benefit.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier for each group |
| **Name** | nvarchar(255) | NO | Name of the group of clusters |
| **LatinName** | nvarchar(255) | YES | Romanized/Latin script version of the name |
| **Comments** | nvarchar(max) | YES | Free-text notes and additional information |
| **RegionId** | bigint | NO | Foreign key to Regions table |
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

1. **Regions** (RegionId → Regions.Id)
   - Every group belongs to a region
   - Used for coordinated cluster planning

2. **Clusters** (One-to-Many)
   - Clusters can optionally belong to groups
   - Clusters.GroupOfClusterId references this table
   - Provides coordination structure for related clusters

## Purpose and Function

### Coordination Benefits
Groups of clusters enable:
- **Joint Planning**: Coordinated growth plans across clusters
- **Resource Sharing**: Share tutors, materials, facilitators
- **Joint Activities**: Combined conferences, training events
- **Mutual Support**: Stronger clusters support emerging ones
- **Collective Learning**: Share experiences and insights

### When Groups Are Used
- **Geographic Proximity**: Clusters near each other
- **Shared Resources**: Common pool of human resources
- **Similar Characteristics**: Similar development stages
- **Historical Ties**: Traditional connections between areas
- **Practical Coordination**: Regular joint meetings and plans

### Difference from Subregions
- **Subregions**: Administrative subdivision of region
- **Groups of Clusters**: Coordination mechanism
- **Can Coexist**: May have both subregions and cluster groups
- **Different Purpose**: Admin structure vs. collaboration

## Common Query Patterns

### Groups of Clusters in Region
```sql
SELECT
    GC.[Name],
    R.[Name] AS Region,
    COUNT(C.[Id]) AS ClusterCount
FROM [GroupOfClusters] GC
INNER JOIN [Regions] R ON GC.[RegionId] = R.[Id]
LEFT JOIN [Clusters] C ON GC.[Id] = C.[GroupOfClusterId]
WHERE R.[Id] = @RegionId
GROUP BY GC.[Id], GC.[Name], R.[Name]
ORDER BY GC.[Name]
```

### Clusters in Group
```sql
SELECT
    C.[Name] AS ClusterName,
    C.[StageOfDevelopment],
    GC.[Name] AS GroupName
FROM [Clusters] C
INNER JOIN [GroupOfClusters] GC ON C.[GroupOfClusterId] = GC.[Id]
WHERE GC.[Id] = @GroupId
ORDER BY C.[Name]
```

### Group Statistics
```sql
SELECT
    GC.[Name] AS GroupName,
    COUNT(DISTINCT C.[Id]) AS Clusters,
    COUNT(DISTINCT L.[Id]) AS Localities,
    COUNT(DISTINCT A.[Id]) AS Activities
FROM [GroupOfClusters] GC
LEFT JOIN [Clusters] C ON GC.[Id] = C.[GroupOfClusterId]
LEFT JOIN [Localities] L ON C.[Id] = L.[ClusterId]
LEFT JOIN [Activities] A ON L.[Id] = A.[LocalityId] AND A.[IsCompleted] = 0
WHERE GC.[RegionId] = @RegionId
GROUP BY GC.[Id], GC.[Name]
ORDER BY Clusters DESC
```

### Clusters Without Group Assignment
```sql
SELECT
    C.[Name] AS Cluster,
    R.[Name] AS Region
FROM [Clusters] C
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE C.[GroupOfClusterId] IS NULL
ORDER BY R.[Name], C.[Name]
```

## Business Rules and Constraints

1. **Required Region**: Every group must belong to a region
2. **Name Required**: Group must have a name
3. **Optional Assignment**: Clusters may or may not belong to groups
4. **Within Region**: Group members typically from same region
5. **Flexible Membership**: Clusters can join/leave groups

## Usage Patterns

### Joint Planning
- Coordinated growth plans
- Shared goals and milestones
- Collective campaign planning
- Resource allocation across group

### Training and Development
- Joint training institutes
- Tutor development programs
- Facilitator preparation
- Shared learning events

### Resource Sharing
- Tutors serving multiple clusters
- Shared materials and equipment
- Coordinators supporting group
- Financial resources pooling

### Events and Conferences
- Group conferences
- Joint reflection meetings
- Cluster gatherings
- Training events

## Data Quality Considerations

### When to Create Groups
Consider when:
- **Geographic Proximity**: Clusters close together
- **Shared Infrastructure**: Common facilities, transportation
- **Resource Pool**: Shared human resources
- **Coordination Need**: Benefit from joint planning
- **Leadership**: Coordinators span multiple clusters

### When NOT to Create Groups
Avoid when:
- **Far Apart**: Geographic distance prevents coordination
- **Independent**: Clusters function well independently
- **Added Complexity**: Extra structure not helpful
- **Adequate Coordination**: Regional level sufficient

### Group Composition
- Usually 2-5 clusters per group
- Geographically contiguous preferred
- Similar development stages helpful
- Natural affinity and relationships

## Notes for Developers

- Groups of clusters are OPTIONAL
- Always use LEFT JOIN when joining from Clusters
- Check for NULL GroupOfClusterId in Clusters table
- Not all regions use this grouping
- May coexist with subregions (different purposes)
- Provide UI only when groups exist in region
- Allow flexible group membership

## Integration Considerations

### Planning Systems
- Coordinate with regional plans
- Support cluster planning process
- Resource allocation systems
- Event management platforms

### Reporting
- Aggregate statistics by group
- Compare groups within region
- Track group development
- Resource utilization analysis

## Special Considerations

### Flexible Structure
Groups of clusters are:
- More flexible than subregions
- Can change more easily
- Based on practical coordination needs
- Respond to development patterns

### Evolution Over Time
- Groups may form and dissolve
- Membership may change
- New groups created as region grows
- Structure adapted to needs

### Complementary to Subregions
Both can exist:
- Subregions: Administrative structure
- Groups: Coordination mechanism
- Serve different purposes
- May overlap or differ in membership

## Best Practices

1. **Natural Groupings**: Follow existing relationships and geography
2. **Practical Size**: Keep groups manageable (2-5 clusters)
3. **Clear Purpose**: Define coordination objectives
4. **Regular Review**: Reevaluate group composition periodically
5. **Flexibility**: Allow groups to evolve
6. **Documentation**: Record rationale in Comments
7. **Coordination**: Ensure group members benefit from collaboration
8. **Optional**: Don't force groups where not needed
