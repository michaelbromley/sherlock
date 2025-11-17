# ElectoralUnits Table

## Overview
The `ElectoralUnits` table represents Bahai administrative jurisdictions used for Local Spiritual Assembly elections and governance. Electoral units group one or more localities together to form the voting jurisdiction for a Local Spiritual Assembly. This is distinct from the geographic cluster structure and serves the Bahai administrative framework rather than community-building organization.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each electoral unit

### Name

Name of the electoral unit

### LatinName

Romanized/Latin script version of the name

### Comments

Free-text notes and additional information

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

1. **Localities** (One-to-Many)
   - Localities can be assigned to electoral units
   - Localities.ElectoralUnitId references this table
   - One electoral unit may include multiple localities

## Purpose and Function

### Bahai Administrative Structure
Electoral units serve the Bahai administrative framework:
- **Local Spiritual Assemblies**: Nine-member elected bodies
- **Election Jurisdictions**: Define who votes in which assembly election
- **Governance Boundaries**: Administrative authority areas
- **Distinct from Clusters**: Serve different organizational purposes

### Cluster vs. Electoral Unit
- **Clusters**: Community-building and growth focus
- **Electoral Units**: Administrative and governance focus
- **May Overlap**: Geographic areas may overlap or align differently
- **Different Purposes**: One for activities, one for administration

## Common Scenarios

### Single Locality Electoral Unit
- Large city or town with one Local Spiritual Assembly
- Electoral unit contains one locality
- Most common in urban areas

### Multi-Locality Electoral Unit
- Rural area with scattered small localities
- Multiple villages form one electoral unit
- Share one Local Spiritual Assembly
- Common in low-density regions

### No Electoral Unit Assignment
- Localities without Local Spiritual Assemblies
- Emerging communities
- Localities.ElectoralUnitId is NULL

## Common Query Patterns

### Localities in Electoral Unit
```sql
SELECT
    L.[Name] AS LocalityName,
    EU.[Name] AS ElectoralUnit,
    C.[Name] AS Cluster
FROM [Localities] L
INNER JOIN [ElectoralUnits] EU ON L.[ElectoralUnitId] = EU.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE EU.[Id] = @ElectoralUnitId
ORDER BY L.[Name]
```

### Electoral Units in Cluster
```sql
SELECT DISTINCT
    EU.[Name],
    COUNT(L.[Id]) AS LocalityCount
FROM [ElectoralUnits] EU
INNER JOIN [Localities] L ON EU.[Id] = L.[ElectoralUnitId]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE C.[Id] = @ClusterId
GROUP BY EU.[Id], EU.[Name]
ORDER BY EU.[Name]
```

### Localities Without Electoral Units
```sql
SELECT
    L.[Name] AS Locality,
    C.[Name] AS Cluster
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE L.[ElectoralUnitId] IS NULL
ORDER BY C.[Name], L.[Name]
```

### Electoral Unit Coverage
```sql
SELECT
    EU.[Name],
    COUNT(L.[Id]) AS LocalityCount,
    COUNT(I.[Id]) AS BahaiPopulation
FROM [ElectoralUnits] EU
INNER JOIN [Localities] L ON EU.[Id] = L.[ElectoralUnitId]
LEFT JOIN [Individuals] I
    ON L.[Id] = I.[LocalityId]
    AND I.[IsBahai] = 1
    AND I.[IsArchived] = 0
GROUP BY EU.[Id], EU.[Name]
ORDER BY BahaiPopulation DESC
```

## Business Rules and Constraints

1. **Name Required**: Electoral unit must have a name
2. **Optional Assignment**: Localities may or may not have electoral units
3. **Assembly Requirement**: Electoral units typically represent areas with Local Spiritual Assemblies
4. **Boundary Integrity**: Electoral unit boundaries should not conflict
5. **Voting Eligibility**: Used to determine voting jurisdiction for elections

## Administrative Functions

### Election Management
- Define voting jurisdictions
- Determine eligible voters
- Organize election events
- Track assembly formation

### Governance
- Local Spiritual Assembly jurisdiction
- Administrative authority boundaries
- Community organization
- Institutional coordination

### Membership
- Track Bahai believers by electoral unit
- Voting eligibility
- Assembly membership
- Community census

## Data Quality Considerations

### Boundary Definition
- Clear geographic boundaries
- Non-overlapping jurisdictions
- Documented in Comments field
- Reviewed by National Assembly

### Name Standardization
- Consistent naming conventions
- Align with assembly names
- Both local and Latin names
- Official names documented

### Updates and Changes
- Electoral units can change over time
- New assemblies formed
- Boundaries adjusted
- Assemblies may dissolve

## Notes for Developers

- Electoral units are optional (many localities have NULL ElectoralUnitId)
- Always use LEFT JOIN when joining from Localities
- Not all clusters will have electoral units
- Separate from cluster structure conceptually
- Used primarily for administrative reports
- May cross cluster boundaries in some cases

## Integration Considerations

### National Database Systems
- Synchronize with National Assembly records
- Election management systems
- Membership tracking systems
- Assembly reporting systems

### Reporting
- Assembly membership reports
- Election preparation lists
- Voting eligibility verification
- Community statistics by assembly

## Special Considerations

### Formation Criteria
Local Spiritual Assemblies typically formed when:
- At least 9 adult Bahais reside in area
- Annually elected on April 21
- Recognized by National Spiritual Assembly
- Electoral unit defines jurisdiction

### Emerging Communities
Not all localities have electoral units:
- Small Bahai populations (< 9 adults)
- Emerging communities
- Rural scattered populations
- Under development

### Urban vs. Rural
- **Urban**: Usually one electoral unit per city/town
- **Rural**: May combine multiple localities
- **Mixed**: Varies by population density
- **Special Cases**: Islands, remote areas

## Best Practices

1. **Clear Boundaries**: Document electoral unit boundaries clearly
2. **Coordination**: Align with National Assembly records
3. **Updates**: Keep current with assembly formation/dissolution
4. **Documentation**: Use Comments for boundary descriptions
5. **Consistency**: Maintain consistent naming
6. **Validation**: Verify against official assembly lists
7. **History**: Preserve historical electoral unit records
