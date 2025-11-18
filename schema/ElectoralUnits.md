# ElectoralUnits Table

## Overview
The `ElectoralUnits` table represents Bahai administrative jurisdictions used for Local Spiritual Assembly elections and governance. Electoral units group one or more localities together to form the voting jurisdiction for a Local Spiritual Assembly. This is distinct from the geographic cluster structure and serves the Bahai administrative framework rather than community-building organization.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id (bigint, NOT NULL)

The primary key and unique identifier for each electoral unit record. This auto-incrementing field ensures that every electoral unit has a distinct reference point that remains constant throughout its lifecycle. The Id serves as the fundamental link between this table and the Localities table, where localities may optionally reference their electoral unit to indicate which Local Spiritual Assembly jurisdiction they belong to. Electoral units are central to the Bahai administrative structure, defining where believers vote and which assembly has administrative authority over specific geographic areas. The Id provides the stable anchor point for tracking these administrative jurisdictions over time, even as boundaries or assembly statuses may evolve. When querying for assembly-related information or preparing election materials, this Id enables efficient identification of which localities participate in which assembly elections.

### Name (nvarchar, NULL)

The official name of the electoral unit, typically corresponding to the name of the Local Spiritual Assembly that governs this jurisdiction. This field captures how the administrative unit is commonly known and referenced within the Bahai community, often taking the form "Local Spiritual Assembly of [City Name]" or simply the city/area name that defines the jurisdiction. For example, "Local Spiritual Assembly of Chicago", "Portland Electoral Unit", or "Northern District Assembly Area". The nvarchar data type ensures full Unicode support, allowing names to be stored in any script including Arabic, Persian, Cyrillic, Chinese characters, or other non-Latin writing systems, which is essential for a global faith community. While technically nullable in the database schema, in practice every electoral unit should have a meaningful name that clearly identifies the administrative jurisdiction to facilitate communication about elections, assembly governance, and administrative matters. The name helps believers, national assembly offices, and coordinators quickly identify which electoral unit is being discussed when organizing elections or communicating administrative decisions.

### LatinName (nvarchar, NOT NULL)

The romanized or Latin-script version of the electoral unit name, providing a standardized representation that can be universally read and processed across different systems and administrative contexts. This field is particularly important for national-level record keeping, international coordination, and technical system operations where consistent character encoding is essential. For electoral units whose native Name is already in Latin script, this field typically contains the same value. For electoral units with names in other scripts (such as "المحفل الروحاني المحلي لطهران" in Persian or "新德里地方靈體會" in Chinese), the LatinName provides a transliterated equivalent (like "Local Spiritual Assembly of Tehran" or "Local Spiritual Assembly of New Delhi") that can be reliably sorted, searched, and displayed in administrative systems. The NOT NULL constraint reflects the critical importance of this field for administrative record-keeping - every electoral unit must have a Latin name to ensure it can be properly referenced in national records, international correspondence, and system operations across diverse linguistic contexts.

### DelegatesAllocated (int, NOT NULL)

An integer field that tracks the number of delegates allocated to this electoral unit for National Convention purposes. In the Bahai administrative system, Local Spiritual Assemblies (represented by electoral units) elect delegates who attend the National Convention to elect the National Spiritual Assembly. The number of delegates allocated to each electoral unit is determined by the National Spiritual Assembly based on factors such as the number of believers in the jurisdiction and considerations of balanced representation. This field captures that allocation decision, enabling the system to track delegate quotas across all electoral units in a country. The NOT NULL constraint indicates this is a required piece of information for electoral units - even newly formed assemblies that might initially have minimal delegate allocation would have this field set to at least 1 or 0. This field is essential for preparing delegate election materials, tracking delegate election results, and ensuring proper representation at National Convention. Changes to this field over time reflect how the National Assembly adjusts representation as communities grow or administrative structures evolve.

### Comments (nvarchar, NOT NULL)

A free-text field designed to capture contextual information, boundary descriptions, formation details, and administrative notes about the electoral unit. This field serves multiple critical purposes: documenting the geographic boundaries of the jurisdiction (which localities are included, what territorial limits define the assembly's authority), recording the formation date and circumstances of the Local Spiritual Assembly, noting any special administrative considerations or boundary adjustments over time, and preserving institutional memory about the electoral unit's development and history. For example, comments might explain "Formed April 21, 2018. Includes the city of Springfield and surrounding townships within county boundaries. Delegates allocated: 2" or "Boundary adjustment approved 2020 to include newly developed eastern suburbs. Previous separate electoral unit for East District merged into main city unit." The nvarchar specification with no length limit (typically MAX) allows for extensive documentation when needed, supporting Unicode characters for multilingual notes. The NOT NULL constraint is somewhat unusual for a comments field and may reflect default database values or a policy requiring minimal documentation for all electoral units - in practice, electoral units benefit from at least basic documentation explaining their boundaries and formation to help national administrators and believers understand jurisdiction questions.

### RegionId (bigint, NULL)

A foreign key optionally linking the electoral unit to a region in the Regions table. This relationship is somewhat unusual in the database structure because electoral units primarily function within the administrative framework (tied to Local Spiritual Assemblies) rather than the geographic growth framework (tied to clusters). However, this field provides a way to associate electoral units with regions for national-level organizational purposes, reporting, or to track which Regional Teaching Committee area an assembly falls within for coordination purposes. The nullable nature of this field is significant - not all electoral units may have a region assignment, particularly if the administrative and cluster structures don't align geographically, or if this relationship is not consistently maintained. In some national communities, electoral unit boundaries correspond closely with cluster boundaries and both fall within clear regional structures; in others, administrative and growth structures may overlap in complex ways. This optional relationship allows flexibility in how national communities choose to organize and track their administrative structures relative to their geographic growth frameworks.

### CreatedTimestamp (datetime, NULL)

Records the exact moment when this electoral unit record was first created in the database. This audit field provides crucial information for understanding when administrative jurisdictions were established in the system, tracking the formation of new Local Spiritual Assemblies over time, and troubleshooting data quality issues. The timestamp captures not necessarily when the Local Spiritual Assembly was first elected (that date would typically be recorded in comments or related assembly records) but when the electoral unit was formally registered in the SRP system, which might be considerably later if the assembly existed before systematic data entry began. This field is particularly valuable for national administrators tracking the growth in number of Local Spiritual Assemblies - comparing creation timestamps can reveal patterns in assembly formation, such as periods of rapid administrative expansion. While nullable in the schema, this field should typically be populated automatically by the database system at record insertion time, providing a complete audit trail of when administrative structures were added to the database.

### CreatedBy (uniqueidentifier, NULL)

Stores the GUID of the user account that initially created this electoral unit record, providing accountability and traceability in the data entry process. This field identifies who was responsible for formally establishing the electoral unit in the system, which is particularly important for administrative records that shape the governance structure of the Bahai community. Knowing who created the record allows national administrators to follow up with questions about the electoral unit's boundaries or delegate allocation, verify that the administrative record was properly authorized (likely by national assembly decision or secretariat action), and track patterns in how electoral units are being registered across the country. In systems where multiple national office staff, regional coordinators, or database administrators might have access to create electoral units, this field maintains a clear chain of responsibility. The uniqueidentifier format (GUID) enables this field to reference user accounts across distributed systems and supports audit requirements in administrative contexts where clear accountability for governance records is essential.

### LastUpdatedTimestamp (datetime, NULL)

Captures the most recent moment when any field in this electoral unit record was modified, providing a critical audit trail for tracking changes to administrative structures. This timestamp is automatically updated whenever any change is made to the record - whether modifying the name to reflect updated assembly designations, adjusting delegate allocations based on national assembly decisions, updating boundary descriptions in comments, or any other field modification. The field is essential for understanding how administrative structures evolve over time, identifying recently modified records that might need review, and supporting administrative coordination where knowing when information was last updated is important. For administrative records like electoral units that typically change infrequently once established (except for periodic delegate allocation adjustments), a recent LastUpdatedTimestamp might indicate boundary adjustments, assembly dissolution and reformation, merger of multiple electoral units, or updates to reflect current administrative status. Comparing this timestamp with CreatedTimestamp reveals whether an electoral unit has been modified since its initial creation, which can be relevant for assessing administrative stability and maturity.

### LastUpdatedBy (uniqueidentifier, NULL)

Records the GUID of the user who most recently modified this electoral unit record, completing the audit trail for changes to administrative structures. Together with LastUpdatedTimestamp, this field provides full visibility into who is maintaining and adjusting governance structures over time. This is particularly important for administrative records that affect assembly elections and governance - knowing who made recent changes allows national administrators to understand the context of modifications, verify that changes were properly authorized (typically requiring national assembly approval for boundary changes or delegate allocation adjustments), and follow up if clarification is needed about administrative decisions. In contexts where National Spiritual Assembly secretariats, national office staff, or authorized administrators manage electoral unit records, this field helps ensure that changes are being made by authorized personnel with proper authority. The uniqueidentifier format enables consistent user tracking across distributed systems and supports audit requirements in governance contexts where clear accountability for administrative decisions is essential.

### ImportedFrom (uniqueidentifier, NOT NULL)

Identifies the source system or import batch from which this electoral unit record originated, using a GUID that can be traced back to specific import operations or source systems. This field is essential for data provenance in scenarios where SRP databases are populated from existing national assembly records, legacy administrative systems, or historical electoral unit lists maintained by national offices. The uniqueidentifier format allows each import source or batch to be distinctly identified, enabling administrators to track which records came from which sources and potentially trace back to original authoritative records if questions arise about electoral unit boundaries, formation dates, or delegate allocations. For example, when transitioning from paper-based assembly records or older database systems to the SRP, this field maintains the connection to the original source, supporting validation that all officially recognized Local Spiritual Assemblies have been properly entered. The NOT NULL constraint indicates that every record must have a source identifier - even records created directly in the current system would have an ImportedFrom value identifying the current system as the source, ensuring complete data lineage tracking for all administrative records.

### ImportedTimestamp (datetime, NOT NULL)

Captures the specific moment when this record was imported into the current database from an external source or created through an import process. This timestamp is distinct from CreatedTimestamp in that it specifically marks import operations rather than general record creation. For records that originated in the current system rather than being imported, this field might contain the same value as CreatedTimestamp, or might be set to a default value indicating no import occurred. The field is particularly valuable for tracking data migration waves, troubleshooting import-related issues, and understanding when administrative structure data was brought into the system from authoritative sources like national assembly records. In scenarios where countries transition from paper assembly lists, spreadsheet tracking, or older administrative systems to the SRP database, this timestamp helps administrators understand which records are part of historical data imports versus ongoing operational data entry. The NOT NULL constraint ensures that import timing is always tracked, supporting complete audit trails for all administrative data in the system.

### ImportedFileType (varchar(50), NOT NULL)

Documents the format or type of file from which this electoral unit data was imported, such as "CSV", "Excel", "Assembly_List_2024", "National_Office_Records", or other specific format identifiers. This information is valuable for understanding the import process, troubleshooting format-specific issues that might affect data quality, and maintaining documentation about data sources and migration history. The 50-character limit accommodates most file type descriptions while preventing excessive storage use. For records created directly in the current system without an import process, this field might contain a default value like "Direct Entry" or "Native" to maintain the NOT NULL constraint while indicating no external file was involved. The field often includes version information or source descriptions that identify the authoritative source of electoral unit information, which is particularly important for administrative records where accuracy and authorization are critical. Understanding the source file type helps administrators assess data quality expectations and verify that electoral unit records originated from authoritative national assembly sources rather than unofficial compilations.

### GUID (uniqueidentifier, NULL)

A globally unique identifier that remains constant for this electoral unit record across all systems, database instances, and synchronization operations. Unlike the Id field which is specific to this particular database instance and might differ if the record exists in multiple systems, the GUID provides a universal reference that can be used to match and synchronize this same electoral unit across distributed SRP installations or administrative systems. This field is essential in scenarios where national administrative systems need to synchronize with regional or local SRP installations, where electoral unit information is shared between the national office and regional coordinators, or where administrative data is exported and imported between different database instances. The GUID ensures that the same electoral unit can be reliably identified and matched across systems regardless of differences in local Id values, which is particularly important for maintaining consistency in delegate allocations, election records, and assembly status across multiple systems. While nullable in the schema, in practice most electoral units should have a GUID assigned to support synchronization scenarios and to maintain consistent identity across the various systems that might track assembly information. The uniqueidentifier format (typically a 128-bit value represented as a formatted string) provides sufficient uniqueness to avoid collisions even when multiple systems generate GUIDs independently.

## Key Relationships

1. **Localities** (One-to-Many)
   - Localities can be assigned to electoral units
   - Localities.ElectoralUnitId references this table
   - One electoral unit may include multiple localities
   - Many localities have NULL ElectoralUnitId (no assembly yet)

2. **Regions** (RegionId → Regions.Id)
   - Optional relationship linking electoral units to regions
   - Helps track which regional area an assembly falls within
   - Not all electoral units have region assignments

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

### Electoral Units in Region
```sql
SELECT DISTINCT
    EU.[Name],
    EU.[DelegatesAllocated],
    COUNT(L.[Id]) AS LocalityCount
FROM [ElectoralUnits] EU
LEFT JOIN [Localities] L ON EU.[Id] = L.[ElectoralUnitId]
WHERE EU.[RegionId] = @RegionId
GROUP BY EU.[Id], EU.[Name], EU.[DelegatesAllocated]
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

### Electoral Unit Coverage with Believer Population
```sql
SELECT
    EU.[Name],
    EU.[DelegatesAllocated],
    COUNT(DISTINCT L.[Id]) AS LocalityCount,
    COUNT(CASE WHEN I.[IsBahai] = 1 THEN 1 END) AS BahaiPopulation
FROM [ElectoralUnits] EU
LEFT JOIN [Localities] L ON EU.[Id] = L.[ElectoralUnitId]
LEFT JOIN [Individuals] I
    ON L.[Id] = I.[LocalityId]
    AND I.[IsArchived] = 0
GROUP BY EU.[Id], EU.[Name], EU.[DelegatesAllocated]
ORDER BY BahaiPopulation DESC
```

### National Delegate Allocation Summary
```sql
SELECT
    R.[Name] AS Region,
    COUNT(DISTINCT EU.[Id]) AS AssemblyCount,
    SUM(EU.[DelegatesAllocated]) AS TotalDelegates
FROM [ElectoralUnits] EU
LEFT JOIN [Regions] R ON EU.[RegionId] = R.[Id]
GROUP BY R.[Id], R.[Name]
ORDER BY TotalDelegates DESC
```

## Business Rules and Constraints

1. **Name Required**: Electoral unit must have a name (though nullable, should always be populated)
2. **Latin Name Required**: Latin script version is mandatory for administrative records
3. **Delegates Allocated Required**: Must specify delegate allocation (may be 0 for new assemblies)
4. **Optional Assignment**: Localities may or may not have electoral units
5. **Assembly Requirement**: Electoral units typically represent areas with Local Spiritual Assemblies
6. **Boundary Integrity**: Electoral unit boundaries should not conflict
7. **Voting Eligibility**: Used to determine voting jurisdiction for elections

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

### Delegate Elections
- Track delegate allocations by National Assembly
- Prepare delegate election materials
- Record delegate election results
- Coordinate National Convention participation

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
- Delegate allocations updated periodically

## Notes for Developers

- Electoral units are optional (many localities have NULL ElectoralUnitId)
- Always use LEFT JOIN when joining from Localities
- Not all clusters will have electoral units
- Separate from cluster structure conceptually
- Used primarily for administrative reports
- May cross cluster boundaries in some cases
- Delegate allocations may change annually

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
- Delegate allocation tracking

## Special Considerations

### Formation Criteria
Local Spiritual Assemblies typically formed when:
- At least 9 adult Bahais reside in area
- Annually elected on April 21 (Ridvan)
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

### Delegate Allocation Changes
- National Assembly reviews delegate allocations periodically
- Based on believer population and representation needs
- DelegatesAllocated field updated to reflect current allocations
- Changes documented in Comments or separate records

## Best Practices

1. **Clear Boundaries**: Document electoral unit boundaries clearly in Comments
2. **Coordination**: Align with National Assembly records
3. **Updates**: Keep current with assembly formation/dissolution
4. **Documentation**: Use Comments for boundary descriptions and formation history
5. **Consistency**: Maintain consistent naming conventions
6. **Validation**: Verify against official assembly lists from National Assembly
7. **History**: Preserve historical electoral unit records
8. **Delegate Tracking**: Update DelegatesAllocated when National Assembly adjusts allocations
9. **Authorization**: Ensure changes are authorized by appropriate national bodies
10. **Synchronization**: Maintain consistency with national administrative records
