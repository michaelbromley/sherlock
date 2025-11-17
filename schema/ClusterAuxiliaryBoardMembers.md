# ClusterAuxiliaryBoardMembers Table

## Overview
The `ClusterAuxiliaryBoardMembers` table tracks Auxiliary Board Members assigned to support specific clusters. Auxiliary Board Members are appointed Bahai officials who serve under the Continental Counselors to promote teaching and administrative development. This table maintains the assignment of these officials to clusters they serve, enabling coordination and tracking of institutional support for cluster development.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier for each assignment |
| **BoardMemberName** | nvarchar(255) | NO | Name of the Auxiliary Board Member |
| **Order** | smallint | NO | Display order for listing multiple board members |
| **ClusterId** | bigint | NO | Foreign key to Clusters table |
| **CreatedTimestamp** | datetime | NO | When the record was created |
| **CreatedBy** | uniqueidentifier | NO | User ID who created the record |
| **LastUpdatedTimestamp** | datetime | NO | When the record was last modified |
| **LastUpdatedBy** | uniqueidentifier | NO | User ID who last modified the record |
| **ImportedTimestamp** | datetime | YES | When data was imported from external system |
| **ImportedFrom** | uniqueidentifier | YES | Source system identifier for imported data |
| **ImportedFileType** | varchar(50) | YES | File format of imported data |

## Key Relationships

1. **Clusters** (ClusterId → Clusters.Id)
   - Each assignment links a board member to a cluster
   - One cluster may have multiple board members assigned
   - One board member may serve multiple clusters

## Bahai Administrative Context

### Auxiliary Board Members
- **Appointment**: Appointed by Continental Counselors
- **Service Areas**: Protection and Propagation branches
- **Role**: Promote teaching, support community development
- **Geographic Assignment**: Typically serve specific regions or clusters
- **Term**: Renewable appointments

### Functions
- **Guidance**: Provide spiritual and administrative guidance
- **Coordination**: Coordinate teaching and growth activities
- **Support**: Support Local Spiritual Assemblies and Regional Councils
- **Communication**: Channel between clusters and higher institutions
- **Encouragement**: Inspire and motivate community members

## Assignment Patterns

### Single Board Member
- Most common pattern
- One board member assigned to cluster
- Clear point of contact
- Simple coordination

### Multiple Board Members
- Large or complex clusters
- Different branches (Protection and Propagation)
- Transitional periods
- Special development needs

### Shared Assignment
- One board member serves multiple clusters
- Common in areas with fewer board members
- Requires coordination across clusters
- Regional approach

## Common Query Patterns

### Board Members for Cluster
```sql
SELECT
    [BoardMemberName],
    [Order]
FROM [ClusterAuxiliaryBoardMembers]
WHERE [ClusterId] = @ClusterId
ORDER BY [Order]
```

### Clusters Served by Board Member
```sql
SELECT
    C.[Name] AS ClusterName,
    C.[StageOfDevelopment],
    R.[Name] AS Region
FROM [ClusterAuxiliaryBoardMembers] CABM
INNER JOIN [Clusters] C ON CABM.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE CABM.[BoardMemberName] = @BoardMemberName
ORDER BY R.[Name], C.[Name]
```

### Board Member Assignments by Region
```sql
SELECT
    R.[Name] AS Region,
    C.[Name] AS Cluster,
    CABM.[BoardMemberName]
FROM [ClusterAuxiliaryBoardMembers] CABM
INNER JOIN [Clusters] C ON CABM.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE R.[Id] = @RegionId
ORDER BY CABM.[BoardMemberName], C.[Name]
```

### Clusters Without Board Member Assignment
```sql
SELECT
    C.[Name] AS Cluster,
    R.[Name] AS Region
FROM [Clusters] C
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
LEFT JOIN [ClusterAuxiliaryBoardMembers] CABM ON C.[Id] = CABM.[ClusterId]
WHERE CABM.[Id] IS NULL
ORDER BY R.[Name], C.[Name]
```

### Board Member Workload
```sql
SELECT
    [BoardMemberName],
    COUNT(DISTINCT [ClusterId]) AS ClusterCount
FROM [ClusterAuxiliaryBoardMembers]
GROUP BY [BoardMemberName]
ORDER BY ClusterCount DESC
```

## Business Rules and Constraints

1. **Required Fields**: BoardMemberName and ClusterId must be provided
2. **Order for Multiple**: When multiple board members, Order determines display sequence
3. **Active Assignments**: Table tracks current assignments
4. **Name Consistency**: Board member names should be consistent across assignments
5. **Valid Cluster**: ClusterId must reference existing cluster

## Usage Patterns

### Cluster Reports
- Include board member information in cluster reports
- Show institutional support for cluster
- Contact information for coordination
- Reporting line identification

### Board Member Reports
- List of clusters served by each board member
- Workload distribution
- Geographic coverage
- Support needs assessment

### Coordination
- Identify appropriate board member for cluster
- Facilitate communication between cluster and institutions
- Plan visits and consultations
- Resource allocation and support

## Data Quality Considerations

### Name Standardization
- Use consistent name format
- Full name (first and last)
- Avoid nicknames or abbreviations
- Consider cultural naming conventions

### Assignment Currency
- Keep assignments up to date
- Remove when appointments end
- Add new appointments promptly
- Track appointment terms

### Multiple Assignments
- Use Order field for consistent display
- Document reason for multiple board members if unusual
- Ensure coordination between board members

## Notes for Developers

- One cluster may have zero, one, or multiple board members
- One board member may serve zero, one, or many clusters
- Use Order field for consistent display sequence
- Handle cases where no board member assigned
- Provide UI for managing assignments
- Consider date ranges for assignment terms (future enhancement)

## Integration Considerations

### Institutional Communication
- Facilitate communication with board members
- Coordinate visits and consultations
- Share reports and statistics
- Support planning processes

### Reporting Systems
- Include board member information in reports
- Track institutional support coverage
- Analyze assignment patterns
- Workload distribution

## Special Considerations

### Appointment Terms
Current table doesn't track:
- Start date of assignment
- End date or term length
- Historical assignments
- Could be enhanced with date fields

### Protection vs. Propagation
Table doesn't distinguish:
- Protection board members
- Propagation board members
- Could add branch field if needed
- Currently relies on external knowledge

### Contact Information
Table stores only name:
- No email or phone in this table
- Contact info maintained elsewhere
- Consider linking to Individuals table for board members
- Or add contact fields if needed

## Best Practices

1. **Current Assignments**: Keep assignments up to date
2. **Consistent Names**: Use standard name format
3. **Order Management**: Use Order field appropriately when multiple board members
4. **Coverage**: Ensure all clusters have board member support
5. **Workload**: Balance assignments across board members
6. **Communication**: Facilitate coordination between clusters and board members
7. **Respect**: Recognize appointed position in reports and communications
8. **Privacy**: Handle board member information appropriately
9. **Historical Data**: Consider preserving historical assignments
10. **Updates**: Promptly update when appointments change
