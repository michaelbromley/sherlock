# ClusterAuxiliaryBoardMembers Table

## Overview
The `ClusterAuxiliaryBoardMembers` table tracks Auxiliary Board Members assigned to support specific clusters. Auxiliary Board Members are appointed Bahai officials who serve under the Continental Counselors to promote teaching and administrative development. This table maintains the assignment of these officials to clusters they serve, enabling coordination and tracking of institutional support for cluster development.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each assignment

### BoardMemberName

Name of the Auxiliary Board Member

### Order

Display order for listing multiple board members

### ClusterId

Foreign key to Clusters table

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

## Privacy and Security

**CRITICAL PRIVACY CLASSIFICATION** ⚠️

This table contains names and assignments of institutional officials (Auxiliary Board members), constituting personally identifiable information requiring high-level privacy protection.

### Privacy Classification

**Reference:** See `reports/Privacy_and_Security_Classification_Matrix.md` for comprehensive privacy guidance.

This table is classified as **CRITICAL** for privacy:
- Contains names of appointed institutional officials
- Links officials to specific geographic assignments
- While assignments may be semi-public within the community, personal details require protection
- Unauthorized disclosure could lead to unwanted contact, harassment, or security concerns for institutional officials

###Field-Level Sensitivity

| Field Name | Sensitivity Level | Privacy Concerns |
|------------|------------------|------------------|
| **IndividualId** | **HIGH** | Links to institutional official identity - restrict access to authorized coordinators |
| **FirstName, FamilyName** | **CRITICAL** | Direct personal identifiers - protect from unauthorized access |
| ClusterId | LOW | Geographic assignment - generally safe in institutional contexts |
| StartDate, EndDate | MODERATE | Assignment timing - may identify individuals through correlation |
| Comments | HIGH | May contain personal notes about officials - review before export |

### Prohibited Query Patterns

**❌ NEVER DO THIS - Public Exposure of Official Names:**
```sql
-- This exposes institutional officials' names without authorization
SELECT [FirstName], [FamilyName], C.[Name] AS [ClusterName]
FROM [ClusterAuxiliaryBoardMembers] AB
INNER JOIN [Clusters] C ON AB.[ClusterId] = C.[Id];
```

**❌ NEVER DO THIS - Linking Officials to Contact Information:**
```sql
-- This creates an unauthorized contact list for institutional officials
SELECT AB.[FirstName], AB.[FamilyName], E.[Email], P.[PhoneNumber]
FROM [ClusterAuxiliaryBoardMembers] AB
INNER JOIN [IndividualEmails] E ON AB.[IndividualId] = E.[IndividualId]
INNER JOIN [IndividualPhones] P ON AB.[IndividualId] = P.[IndividualId];
```

### Secure Query Patterns

**✅ CORRECT - Cluster Support Coverage (No Names):**
```sql
-- Safe: Analyzes support coverage without exposing official names
SELECT
    R.[Name] AS [RegionName],
    COUNT(DISTINCT C.[Id]) AS [ClustersInRegion],
    COUNT(DISTINCT AB.[ClusterId]) AS [ClustersWithSupport],
    CAST(COUNT(DISTINCT AB.[ClusterId]) * 100.0 / COUNT(DISTINCT C.[Id]) AS DECIMAL(5,2)) AS [PercentCovered]
FROM [Regions] R
INNER JOIN [Clusters] C ON R.[Id] = C.[RegionId]
LEFT JOIN [ClusterAuxiliaryBoardMembers] AB ON C.[Id] = AB.[ClusterId]
GROUP BY R.[Name];
```

**✅ CORRECT - Support Distribution Statistics:**
```sql
-- Safe: Shows distribution of assignments without identifying officials
SELECT
    COUNT(DISTINCT [ClusterId]) AS [ClustersSupported],
    COUNT(*) AS [TotalAssignments]
FROM [ClusterAuxiliaryBoardMembers];
```

### Data Protection Requirements

**Access Control:**
- **Restricted Access:** Limit access to regional/national coordinators and authorized institutional personnel
- **Need-to-Know Basis:** Only those requiring knowledge for coordination should have access
- **Not Public Data:** Official assignments may be known within the community, but database access should be restricted
- **Audit Logging:** Log all access to this table for accountability

**Security Measures:**
- Protect names and assignment details from unauthorized access
- Do not publish official contact information without consent
- Restrict export capabilities for this table
- Implement row-level security if officials should only see their own assignments

**Special Considerations:**
- **Institutional Respect:** Handle information about appointed officials with appropriate respect and discretion
- **Security Concerns:** Officials may face security risks in some regions - be especially protective
- **Consent for Publication:** Obtain consent before publishing official names in newsletters, websites, or public reports
- **Contact Protection:** Never expose personal contact information of officials without explicit authorization

### Compliance

- **GDPR:** Names of institutional officials are personal data requiring lawful basis and protection
- **Right to Privacy:** Officials have privacy rights even in their institutional capacity
- **Data Minimization:** Only collect necessary information for coordination purposes
- **Retention:** Remove historical assignments when no longer needed for institutional purposes

### Privacy Checklist

Before any query or operation involving board member data:
- [ ] User is authorized to access institutional official information
- [ ] Purpose is legitimate institutional coordination need
- [ ] Official names will NOT be exposed in public or unauthorized contexts
- [ ] Contact information (if accessed) has explicit consent for use
- [ ] Access is logged for audit
- [ ] Result complies with institutional privacy policies

### Best Practices for Institutional Data

1. **Respect Institutional Appointments:** Handle official information with appropriate discretion
2. **Protect Personal Details:** Never combine institutional assignments with personal contact info without authorization
3. **Secure Communications:** When communicating about officials, use secure channels
4. **Consent for Publication:** Always obtain consent before publishing official names externally
5. **Regional Sensitivity:** Some regions require extra protection due to security concerns
6. **Historical Privacy:** When officials complete their service, protect their historical assignment records

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
