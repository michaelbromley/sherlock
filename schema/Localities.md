# Localities Table

## Overview

The `Localities` table represents the fundamental geographic units where Baha'i community life unfolds on a daily basis - specific villages, towns, city neighborhoods, or other defined geographic areas within a cluster where individuals reside and activities take place. As the primary operational level in the SRP database's geographic hierarchy, localities serve as the critical link between the strategic planning that happens at cluster and regional levels and the actual implementation of educational activities and community-building efforts in neighborhoods and towns across the world. Every individual is assigned to a locality, every activity occurs in a locality, and most community statistics are first collected and understood at this locality level before being aggregated upward.

This table captures not only the geographic identity and hierarchical placement of each locality but also tracks vital community metrics that indicate the maturity and vibrancy of community life. Fields tracking Nineteen Day Feast observance, Holy Day celebrations, devotional meetings, home visits, and the presence of Local Spiritual Assemblies provide a comprehensive picture of how well the community is functioning and growing. These metrics enable coordinators to understand which localities are developing patterns of community life, where additional support might be needed, and how activities in the locality contribute to broader patterns of growth. The locality is where the vision of community building becomes concrete - where children gather for classes, where junior youth explore their potential, where neighbors come together for devotional meetings, and where the rhythms of Baha'i community life take root.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id (bigint, NOT NULL)

The primary key and unique identifier for each locality record. This auto-incrementing field provides the stable reference point that connects localities to all other tables in the system - linking individuals to their place of residence, activities to their geographic location, and enabling the entire geographic hierarchy to function as an integrated whole. The Id serves as the fundamental join key in countless queries throughout the system, from simple locality lookups to complex regional aggregations that roll up statistics from hundreds or thousands of localities. In distributed database scenarios or during data synchronization operations, this Id works in concert with the GUID field to maintain record identity across systems while providing the performance benefits of integer-based joins within a single database instance.

### Name (nvarchar, NULL)

The name of the locality in its native script and language, preserving the authentic local identity of the place. This field might contain Arabic script for localities in the Middle East, Cyrillic for communities in Russia and Central Asia, Chinese characters for East Asian localities, or any of dozens of other writing systems used across the global Baha'i community. The nvarchar data type ensures full Unicode support, allowing any language or script to be accurately stored and displayed. The nullable nature of this field reflects that in some cases, particularly for newly created records or during initial data entry, the local-script name might not yet be available, with the LatinName serving as the primary identifier until the local name can be properly recorded. For localities in regions using Latin alphabets, the Name and LatinName fields often contain identical or very similar values, but the distinction remains important for data integrity and multi-language support.

### LatinName (nvarchar, NOT NULL)

A romanized or Latin-script representation of the locality name, required for every locality record. This field serves multiple critical purposes: it provides a searchable, sortable identifier that works across all system interfaces regardless of language settings; it enables international coordination by giving coordinators a consistent way to reference localities; it supports data integration scenarios where external systems might not handle Unicode characters properly; and it ensures that every locality has at least one name format that can be reliably displayed and processed. The requirement that this field not be null reflects its fundamental importance - even if the local-script Name is the primary identifier for community members, the LatinName provides the universal fallback that keeps the system functional across linguistic boundaries. For localities with names that don't naturally romanize (such as Chinese place names), standard transliteration systems like Pinyin are typically used to populate this field.

### HasLocalSpiritualAssembly (bit, NOT NULL)

A boolean indicator tracking whether the locality has an elected Local Spiritual Assembly, one of the most significant milestones in Baha'i community development. The formation of a Local Spiritual Assembly - requiring nine or more adult Baha'is residing in a locality - marks a fundamental transition from an informal gathering of believers to a formal, self-governing community with its own administrative institution. This field is crucial for understanding community maturity, planning regional support and resources, tracking the expansion of Baha'i administrative order, and identifying which localities are ready to take on greater responsibilities for community coordination. The presence of an LSA typically correlates with other indicators of community vitality: regular Nineteen Day Feasts, Holy Day observances, a local fund, and sustained educational activities. In reports and statistics, LSA-equipped localities are often analyzed separately as they represent more established communities with different support needs than emerging localities.

### HasLocalFund (bit, NOT NULL)

Indicates whether the locality maintains its own treasury or fund for local Baha'i activities, another significant marker of administrative and community maturity. A local fund represents the community's capacity for financial independence and self-reliance, enabling the locality to support its own activities, maintain local properties, contribute to higher levels of the faith's administration, and respond to local needs without constant external support. The presence of a local fund is closely related to having a Local Spiritual Assembly (which typically administers the fund), though the two don't always coincide perfectly - some localities might maintain informal funds before forming an LSA, while newly-formed LSAs might take time to establish financial systems. This field helps regional and national institutions understand which localities have achieved financial sustainability and which might need support or mentoring in developing their local administrative capacity.

### IsObservesNineteenDayFeast (bit, NOT NULL)

Tracks whether the locality regularly observes the Nineteen Day Feast, the principal gathering of the Baha'i community held on the first day of each Baha'i month. The Feast is uniquely important in Baha'i community life, serving three essential purposes: spiritual devotion through prayers and readings, administrative consultation on community affairs, and social fellowship among believers. Regular Feast observance indicates an established pattern of community life, a core group of believers committed to maintaining Baha'i rhythms, and the administrative capacity to organize regular gatherings. This field is not about occasional Feasts but sustained patterns - a locality marked as observing Feast is one where believers can reliably expect this gathering to occur each Baha'i month. For localities transitioning from small gatherings to more established communities, the consistent observance of Feast is often one of the first stable patterns to emerge, making this metric valuable for tracking community development trajectories.

### NineteenDayFeastAttendance (int, NOT NULL)

Records the typical or average number of people attending Nineteen Day Feast in this locality, providing a quantitative measure of community participation and vitality. This metric serves multiple analytical purposes: it indicates the active core of the Baha'i community in the locality (since Feast is for Baha'is only); it helps coordinators understand capacity needs for hosting spaces; it provides a baseline for tracking growth over time; and when compared to the total number of Baha'is in the locality, it reveals engagement levels and potential opportunities for increasing participation. The attendance figure is particularly meaningful when tracked over multiple reporting cycles, as rising attendance indicates growing community vitality while declining numbers might signal the need for support or outreach to community members. This field works in conjunction with IsObservesNineteenDayFeast - if observance is false, this number would typically be zero; if true, the number helps quantify the strength of that observance.

### IsObservesHolyDays (bit, NOT NULL)

Indicates whether the locality regularly commemorates Baha'i Holy Days - the nine sacred days in the Baha'i calendar when work is suspended and special observances are held to mark the religion's most significant historical events. Holy Day observances represent a step beyond regular Feast attendance, as they often require more elaborate preparation, might attract believers from surrounding localities, and demonstrate the community's commitment to maintaining the full rhythm of Baha'i religious life. Regular Holy Day observance suggests sufficient community capacity to organize special gatherings, a level of commitment that goes beyond minimum administrative requirements, and often indicates a locality where Baha'i identity is strong enough to support public or semi-public religious celebrations. This field helps distinguish between minimally functioning localities (perhaps only maintaining Feast) and more vibrant communities that maintain the full calendar of Baha'i observances.

### HolyDayAttendance (int, NOT NULL)

Captures typical attendance numbers for Holy Day observances in the locality, often significantly higher than Feast attendance since Holy Days are more widely publicized, carry special spiritual significance, and may draw believers from neighboring areas who don't regularly attend Feast. This attendance figure serves as an important indicator of the locality's role in the broader cluster - localities with high Holy Day attendance relative to their resident Baha'i population may be serving as gathering points for multiple nearby localities, suggesting their importance as community centers. The metric also helps in planning logistics for major Holy Days that require larger spaces, in understanding the full scope of community participation beyond regular monthly gatherings, and in tracking how special observances contribute to community building and identity formation. Comparing Holy Day attendance to Feast attendance provides insights into community engagement patterns and potential opportunities for strengthening regular participation.

### HasDevotionalMeetings (bit, NOT NULL)

Tracks whether the locality hosts regular devotional meetings - informal gatherings for prayers and readings that are open to people of all backgrounds and represent one of the four core activities at the heart of Baha'i community building. Devotional meetings are particularly significant because they serve as an accessible entry point for neighbors and friends who might not be Baha'i, creating spaces where people of all backgrounds can experience the spirit of worship and community without any administrative formality or membership requirements. The presence of regular devotional meetings indicates that the locality has moved beyond serving only enrolled Baha'is to creating spaces that welcome the wider population, a crucial step in building inclusive communities. This field helps coordinators track the expansion of devotional culture across regions, identify localities where this vital core activity has taken root, and understand the geographic distribution of opportunities for wider community participation in spiritual activities.

### DevotionalMeetings (int, NOT NULL)

Records the number of distinct devotional gatherings regularly held in the locality, providing a quantitative measure of devotional activity intensity. A locality might have a single devotional meeting hosted monthly at one home, or it might have multiple devotional gatherings happening weekly in different neighborhoods or hosted by different families, each serving different social networks and age groups. The number of devotional meetings indicates both the breadth of devotional culture in the locality and the degree of initiative among residents to open their homes for these gatherings. Multiple devotional meetings suggest a locality where devotional life has expanded beyond a single core group to become a distributed pattern woven through the social fabric of the community. This metric helps in understanding not just whether devotional life exists but how extensively it has spread, which correlates strongly with other indicators of community vitality and growth.

### DevotionalMeetingAttendance (int, NOT NULL)

Captures the total number of people attending devotional meetings across all gatherings in the locality, providing a measure of overall participation in this core activity. This aggregate attendance figure, when combined with the DevotionalMeetings count, enables calculation of average attendance per gathering, revealing whether the locality has many small intimate devotionals or fewer larger gatherings. The attendance metric is particularly significant because it includes people of all backgrounds - Baha'is, friends, neighbors, children, youth - making it a measure of how broadly the community is creating spaces for spiritual connection. Rising devotional attendance over time indicates growing community influence and expanding circles of friendship, while the composition of attendance (tracked in more detail through other tables) reveals how effectively devotionals are serving as a bridge to the wider population. This field helps quantify the locality's success in building devotional culture and creating welcoming spiritual spaces.

### DevotionalMeetingFriendAttendance (int, NOT NULL)

Specifically tracks attendance by friends and neighbors who are not enrolled members of the Baha'i Faith, providing a critical measure of how successfully devotional meetings are reaching beyond the Baha'i community. This "friend attendance" metric is one of the most important indicators of community building success, as it directly measures the extent to which activities are genuinely inclusive and attractive to the wider population. High friend attendance relative to total devotional attendance suggests that devotional gatherings are truly serving as bridges to the broader community rather than functioning as closed gatherings for believers only. This field enables powerful analytical insights: comparing friend attendance to Baha'i attendance reveals the inclusive character of gatherings; tracking friend attendance over time shows whether community building efforts are expanding circles of participation; and correlating friend attendance with other activities (like children's classes with non-Baha'i participants) helps identify localities where genuine inclusive community is emerging versus those where activities remain primarily internal to the Baha'i community.

### IsConductsHomeVisits (bit, NOT NULL)

Indicates whether the locality has an active pattern of home visits - the practice of visiting believers and friends in their homes for prayer, fellowship, and mutual support. Home visits represent a foundational community-building practice in the Baha'i framework, serving to strengthen bonds of friendship, extend spiritual and practical support, maintain connection with less active community members, and express care and interest in families who might not regularly attend gatherings. The presence of systematic home visiting indicates a locality with strong relational culture, capacity for pastoral care, and commitment to maintaining personal connections that go beyond formal activities. This field helps coordinators understand which localities have developed this important practice and which might need encouragement or training to establish patterns of visitation. In communities where home visits are strong, other indicators of vitality typically follow, as the relational foundation supports everything else.

### HomesVisited (int, NOT NULL)

Records the number of homes visited during a reporting period, quantifying the extent of home visitation activity in the locality. This metric provides a concrete measure of community outreach and relational engagement that goes beyond the attendance numbers captured for organized activities. A high number of homes visited relative to the locality's population indicates intensive relational work and suggests a community deeply engaged in person-to-person connection and support. The homes visited count, when tracked over time, reveals patterns of outreach expansion or contraction, helps identify localities with particularly strong visitation cultures that might mentor other localities, and provides a measure of pastoral care capacity. This field is particularly valuable for understanding the "invisible" work of community building that happens in living rooms and kitchens rather than in organized activities, work that is essential for sustaining healthy communities but often goes unmeasured in traditional activity statistics.

### Comments (nvarchar, NOT NULL)

A free-text field for capturing additional context, notes, historical information, or observations about the locality that don't fit into the structured fields. This field serves multiple important purposes: documenting the locality's history and development, recording special circumstances or challenges affecting community life, noting decisions about locality boundaries or subdivision changes, preserving institutional memory about significant events or transitions, and providing context that helps future coordinators understand the locality's unique character. Comments might explain why a locality shows unusual patterns in its statistics, document the decision-making process around electoral unit assignments, note relationships with neighboring localities, or record information about local conditions that affect activity planning. The nvarchar specification ensures that comments can be recorded in any language or script, important for a global database where coordinators might naturally write notes in their local languages. While the field is marked NOT NULL (presumably defaulting to empty string rather than null), many localities will have minimal comments, with the field becoming most valuable for localities with complex situations or rich histories.

### ClusterId (bigint, NULL)

A foreign key linking this locality to its parent cluster in the geographic hierarchy, representing the most important structural relationship in the table. Every locality exists within a cluster - the primary operational unit for planning and coordinating community-building activities. The cluster assignment places the locality within the broader strategic context: cluster planning meetings guide activity development in the locality; cluster coordinators support and mentor locality-level efforts; and cluster-level statistics aggregate upward from individual localities. The nullable specification seems unusual given that every locality should belong to a cluster; this might accommodate temporary states during data entry or migration, or historical records where cluster assignments were unclear. In practice, queries typically treat a NULL ClusterId as a data quality issue requiring attention. The cluster relationship is so fundamental that most queries involving localities include the ClusterId, both for filtering (showing localities in a specific cluster) and for aggregation (rolling up locality statistics to cluster level).

### CreatedTimestamp (datetime, NULL)

Records the exact date and time when this locality record was first created in the database, providing a foundational audit trail that helps administrators understand data entry patterns, track system usage, and investigate data quality issues. This timestamp reveals when information about the locality was first captured in the current system, which may or may not correspond to when the locality itself was first recognized as a distinct community unit - the creation timestamp tracks database events, not community development milestones. The field is valuable for understanding data migration patterns (localities created in bulk on the same date suggest an import operation), identifying recently-added localities that might need additional data verification, and supporting change tracking workflows. The nullable specification allows for historical records where creation time might not have been tracked in legacy systems, though new records should always populate this field automatically.

### CreatedBy (uniqueidentifier, NULL)

Stores the GUID of the user account that created this locality record, establishing accountability and enabling administrators to track who is entering data about new localities. This field is essential for audit purposes, quality control, and training - if certain users consistently create records with data quality issues, this field enables targeted follow-up and training. In distributed systems where multiple regional or cluster coordinators might have permission to create locality records, the CreatedBy field maintains clear responsibility for each record. The GUID format references user records in the system's authentication and authorization infrastructure, enabling queries that join to user tables to retrieve creator names or contact information when investigating data issues. The nullable specification accommodates historical records created before user tracking was implemented, or records created through automated import processes where individual user attribution doesn't apply.

### LastUpdatedTimestamp (datetime, NULL)

Captures the most recent moment when any field in this locality record was modified, providing a critical audit trail for tracking changes and understanding data freshness. This timestamp is automatically updated whenever any change is made to the record - whether updating community metrics like attendance numbers, adjusting geographic assignments, or modifying names or comments. The field serves multiple purposes: identifying which localities have recently had data updates, supporting incremental synchronization between distributed databases, enabling change tracking reports that show what's been modified since a given date, and helping administrators understand patterns of ongoing data maintenance. For localities showing outdated metrics, an old LastUpdatedTimestamp can flag records that might need attention or data refresh. The nullable specification handles historical records, but active records should always maintain current timestamps.

### LastUpdatedBy (uniqueidentifier, NULL)

Records the GUID of the user who most recently modified this locality record, completing the audit trail for changes. Together with LastUpdatedTimestamp, this field provides full visibility into data maintenance patterns - who is updating locality information, how frequently different coordinators are maintaining their data, and where to direct questions about recent changes. This field becomes particularly valuable when investigating unexpected changes or data quality issues, as it immediately identifies who made the most recent modification and can provide context for why changes were made. In environments where multiple users have update permissions (cluster coordinators, regional coordinators, national office staff), this field maintains accountability and supports proper data stewardship. The GUID references user authentication records, enabling joins to retrieve updater details when needed for audit or training purposes.

### ImportedTimestamp (datetime, NOT NULL)

For records originating from external systems or data migration operations, this field captures when the import occurred, providing crucial data provenance information distinct from the CreatedTimestamp. While CreatedTimestamp marks when the record was created in the current database, ImportedTimestamp specifically identifies that the record came from an external source and when that transfer occurred. This distinction is important for understanding data quality, troubleshooting issues that might be related to import processes, and maintaining connections to source systems during transition periods. The NOT NULL specification with what is likely a default value (such as a sentinel date like '1900-01-01' for non-imported records) ensures the field always contains useful information - either a real import date or a clear indicator that the record wasn't imported.

### ImportedFrom (uniqueidentifier, NOT NULL)

Identifies the source system, import batch, or migration operation from which this locality record originated, using a GUID that can be traced back to specific import metadata. This field enables administrators to track data lineage, understand which records came from which legacy systems, and potentially trace back to original sources if questions arise about data accuracy or interpretation. In scenarios where data is consolidated from multiple regional databases or legacy systems, this field maintains the essential connection to original sources. The GUID might reference records in an import tracking table that stores details about each migration operation, including source system information, import date, data formats, and transformation rules applied. The NOT NULL specification with a default value (likely a special GUID indicating "not imported" or "created directly") ensures the field always provides meaningful provenance information.

### ImportedFileType (varchar(50), NOT NULL)

Documents the format or type of file from which locality data was imported, such as "CSV", "Excel", "SRP_Regional_Export", or other specific format identifiers. This information is valuable for understanding import processes, troubleshooting format-specific data issues, maintaining documentation about data sources, and supporting reproducible migration workflows. The 50-character limit accommodates descriptive format specifications while preventing excessive storage use. The NOT NULL specification likely uses a default value (such as an empty string or "DIRECT_ENTRY") for records created directly in the system rather than imported. This field becomes particularly important when dealing with data quality issues that might be related to import transformation logic - knowing the source format helps trace how data was interpreted and converted during the import process.

### GUID (uniqueidentifier, NULL)

A globally unique identifier that provides a universal, stable reference for this locality across all systems, databases, and synchronization operations. Unlike the Id field which is specific to this database instance and might differ in other installations, the GUID remains constant for this locality regardless of where the data is stored or how many times it's exported and imported. This field is essential for distributed database scenarios where multiple SRP installations need to share data, synchronize updates, or consolidate information from regional systems into national databases. The GUID enables matching records across systems without requiring coordination of Id values, supports robust data synchronization that can handle updates from multiple sources, and maintains record identity through export/import cycles. The nullable specification might accommodate historical records created before GUID assignment was implemented, though modern practice should assign GUIDs to all new localities.

### LegacyId (nvarchar(255), NOT NULL)

Preserves the original identifier from legacy systems during migration processes, maintaining a crucial link to historical records and enabling gradual transition scenarios where both old and new systems might operate in parallel. This field might contain various formats depending on the source system - numeric IDs, alphanumeric codes, composite keys formatted as strings, or even human-readable identifiers from paper-based tracking systems. The 255-character limit provides generous space for most legacy identifier schemes while maintaining reasonable storage constraints. The field's importance lies in supporting data reconciliation during transitions, enabling verification that migrated data correctly matches source records, and providing a reference point for users who might still think of localities by their old identifiers. The NOT NULL specification with what is likely a default empty string ensures the field is always populated, even for localities created after migration.

### InstituteId (nvarchar(50), NOT NULL)

An external identifier linking this locality to records in separate institute management systems that might be used alongside the SRP database for detailed curriculum tracking and tutor coordination. Some regions or national communities use specialized institute tracking systems to manage training programs, coordinate tutors, and track participant progress through the sequence of courses. This field maintains the connection between the SRP's comprehensive community data and those specialized educational systems, enabling integrated analysis that combines activity data with detailed institute process information. The 50-character limit accommodates most external system ID formats while keeping the field manageable. The NOT NULL specification likely uses a default value (such as empty string) for localities not linked to external institute systems, ensuring the field is always populated without requiring external references for every locality.

### ElectoralUnitId (bigint, NOT NULL)

A foreign key linking the locality to its Electoral Unit - a Baha'i administrative grouping that determines voting jurisdictions for Local Spiritual Assembly elections and defines the geographic scope of LSA authority. Electoral units represent a parallel administrative structure that often, but not always, aligns with locality boundaries. In some cases, a single locality constitutes an electoral unit (typically when the locality has nine or more adult Baha'is); in other cases, multiple small localities are combined into one electoral unit to reach the minimum number required for LSA formation; and in still other cases, large urban localities might be divided into multiple electoral units to ensure effective local administration. This relationship is fundamental to understanding Baha'i administrative structure and properly managing election processes. The NOT NULL specification (though it might use a default value or zero for unassigned localities) reflects the importance of electoral unit assignment, though the documentation notes that not all localities have electoral unit assignments, suggesting either the constraint is not strictly enforced or a sentinel value indicates "no assignment".

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

## Privacy and Security

**MODERATE-HIGH PRIVACY CLASSIFICATION**

The Localities table requires careful privacy handling due to its combination of geographic specificity with community vitality metrics that could identify small communities or reveal sensitive information about community development patterns.

### Privacy Classification

**Reference:** See `reports/Privacy_and_Security_Classification_Matrix.md` for comprehensive privacy guidance.

This table is classified as **MODERATE-HIGH** for privacy:
- **Small locality identification:** Communities with small populations can enable individual/family identification
- **Community metrics:** Attendance numbers in small localities may reveal specific families or individuals
- **Comments field:** May contain personal observations or identifiable information
- **Combined with activities/individuals:** Can reveal participation patterns of identifiable people
- **Geographic sensitivity:** Some regions face persecution or restrictions requiring enhanced protection

### Field-Level Sensitivity

| Field Name | Sensitivity Level | Privacy Concerns |
|------------|------------------|------------------|
| **Comments** | **HIGH** | May contain names, personal observations, sensitive situations - **ALWAYS review before export** |
| **Name, LatinName** | **MODERATE-HIGH** | Small or unique locality names in sensitive regions can identify communities |
| **Attendance Fields** | **MODERATE-HIGH** | Small numbers (< 10) may identify specific families, especially in sensitive regions |
| **HasLocalSpiritualAssembly** | **MODERATE** | In persecution contexts, revealing LSA presence could endanger community |
| **DevotionalMeetingFriendAttendance** | **MODERATE** | In restricted regions, revealing non-Baha'i participation could create risks |
| **HomesVisited** | **MODERATE** | Could reveal community size and outreach patterns in sensitive contexts |
| **ClusterId, ElectoralUnitId** | **LOW** | Geographic hierarchy data - generally safe |
| **Audit/System fields** | **LOW** | Operational metadata - generally safe |

### Geographic Sensitivity Levels

Different localities require different privacy protections based on context:

**HIGH SENSITIVITY (Extra Protection Required):**
- Localities in countries with religious restrictions or persecution
- Communities with very small populations (< 50 total population)
- Localities in areas experiencing social unrest or conflict
- Single-Baha'i or very small Baha'i communities that could face targeting

**MODERATE SENSITIVITY (Standard Protection):**
- Localities with small Baha'i communities (< 20 adult believers)
- Communities in stable countries but with small populations
- Urban neighborhoods in countries with strong religious freedom

**LOWER SENSITIVITY (Aggregate Protection):**
- Large urban localities with substantial Baha'i populations
- Localities in countries with established religious freedom
- Communities with diverse, large populations

### Prohibited Query Patterns

**NEVER DO THIS - Exposing Small Locality Details:**
```sql
-- Dangerous: Could identify specific small communities or families
SELECT
    L.[Name],
    L.[LatinName],
    L.[NineteenDayFeastAttendance],
    L.[HolyDayAttendance],
    L.[HasLocalSpiritualAssembly]
FROM [Localities] L
WHERE L.[NineteenDayFeastAttendance] < 10  -- Very small communities identifiable
ORDER BY L.[NineteenDayFeastAttendance];
```

**NEVER DO THIS - Comments with Locality Names:**
```sql
-- Comments may contain personal information - never export without review
SELECT L.[Name], L.[Comments]
FROM [Localities] L
WHERE L.[Comments] IS NOT NULL AND LEN(L.[Comments]) > 0;
```

**NEVER DO THIS - Detailed Metrics in Sensitive Regions:**
```sql
-- Exposing detailed community metrics could endanger believers in restricted areas
SELECT
    NC.[Name] AS Country,
    L.[Name] AS Locality,
    L.[HasLocalSpiritualAssembly],
    L.[DevotionalMeetings],
    L.[DevotionalMeetingFriendAttendance],
    L.[HomesVisited]
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
INNER JOIN [NationalCommunities] NC ON R.[NationalCommunityId] = NC.[Id]
WHERE NC.[Name] = 'SensitiveCountry';  -- Never expose this level of detail
```

**NEVER DO THIS - Small Group Exposure via Combined Tables:**
```sql
-- Combining localities with individuals could identify specific families
SELECT
    L.[Name],
    L.[NineteenDayFeastAttendance],
    COUNT(I.[Id]) AS IndividualCount,
    STRING_AGG(I.[FirstName], ', ') AS Participants  -- Extremely dangerous!
FROM [Localities] L
LEFT JOIN [Individuals] I ON L.[Id] = I.[LocalityId]
WHERE L.[NineteenDayFeastAttendance] < 15
GROUP BY L.[Name], L.[NineteenDayFeastAttendance];
```

### Secure Query Patterns

**CORRECT - Cluster-Level Aggregates with Minimum Thresholds:**
```sql
-- Safe: Aggregates to cluster level, excludes small populations
SELECT
    C.[Name] AS ClusterName,
    COUNT(L.[Id]) AS LocalityCount,
    SUM(CASE WHEN L.[HasLocalSpiritualAssembly] = 1 THEN 1 ELSE 0 END) AS LSACount,
    AVG(L.[DevotionalMeetings]) AS AvgDevotionalMeetings,
    SUM(L.[DevotionalMeetingAttendance]) AS TotalDevotionalAttendance
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE L.[NineteenDayFeastAttendance] >= 10  -- Exclude very small communities
GROUP BY C.[Id], C.[Name]
HAVING COUNT(L.[Id]) >= 5  -- Only show clusters with 5+ qualifying localities
ORDER BY C.[Name];
```

**CORRECT - Regional Statistics (No Sensitive Details):**
```sql
-- Safe: Regional aggregates with no small-community identification
SELECT
    R.[Name] AS RegionName,
    COUNT(DISTINCT C.[Id]) AS ClusterCount,
    COUNT(DISTINCT L.[Id]) AS LocalityCount,
    SUM(CASE WHEN L.[HasLocalSpiritualAssembly] = 1 THEN 1 ELSE 0 END) AS TotalLSAs,
    AVG(L.[DevotionalMeetingAttendance]) AS AvgDevotionalAttendance
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE L.[NineteenDayFeastAttendance] >= 10  -- Minimum threshold
GROUP BY R.[Id], R.[Name]
ORDER BY R.[Name];
```

**CORRECT - Community Vitality Index (Aggregated, Protected):**
```sql
-- Safe: Uses ranges instead of exact numbers, aggregated view
SELECT
    C.[Name] AS ClusterName,
    COUNT(L.[Id]) AS TotalLocalities,
    SUM(CASE
        WHEN L.[NineteenDayFeastAttendance] >= 20 THEN 1
        ELSE 0
    END) AS LocalitiesWithStrongFeast,
    SUM(CASE
        WHEN L.[HasDevotionalMeetings] = 1 AND L.[DevotionalMeetings] >= 3 THEN 1
        ELSE 0
    END) AS LocalitiesWithMultipleDevotionals
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
GROUP BY C.[Id], C.[Name]
HAVING COUNT(L.[Id]) >= 5  -- Sufficient localities to prevent identification
ORDER BY C.[Name];
```

**CORRECT - Growth Trends (Time Series, Aggregated):**
```sql
-- Safe: Aggregated over time and geography, no small-group exposure
SELECT
    R.[Name] AS RegionName,
    YEAR(L.[LastUpdatedTimestamp]) AS YearUpdated,
    COUNT(DISTINCT C.[Id]) AS ClustersWithData,
    AVG(L.[DevotionalMeetingAttendance]) AS AvgDevotionalAttendance,
    AVG(L.[DevotionalMeetingFriendAttendance]) AS AvgFriendAttendance
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE L.[NineteenDayFeastAttendance] >= 15  -- Exclude small communities
  AND L.[LastUpdatedTimestamp] >= DATEADD(YEAR, -3, GETDATE())  -- Recent data only
GROUP BY R.[Id], R.[Name], YEAR(L.[LastUpdatedTimestamp])
HAVING COUNT(DISTINCT C.[Id]) >= 3  -- At least 3 clusters contributing to average
ORDER BY R.[Name], YearUpdated;
```

### Data Protection Requirements

**Comments Field Protection:**
- **ALWAYS manually review** Comments field contents before ANY export or public report
- **Redact personal information:** Remove names of individuals, families, or facilitators
- **Redact sensitive observations:** Remove observations about specific people, families, or sensitive situations
- **Redact location details:** In sensitive regions, remove specific addresses or precise location descriptions
- **Keep operational notes:** Retain general operational information ("Locality boundaries adjusted", "Name spelling corrected")

**Small Community Protection:**
- Apply **minimum threshold of 10 for Feast/Holy Day attendance** before including in reports
- Apply **minimum threshold of 15 for devotional attendance** before detailed reporting
- For localities with very small populations (< 100 total), aggregate to cluster level
- Never report exact attendance numbers for localities in sensitive regions - use ranges only
- Consider excluding entire countries or regions facing persecution from public reports

**Geographic Sensitivity:**
- Maintain lists of countries/regions requiring enhanced privacy protection
- For sensitive regions, never publish locality-level data - aggregate to national level only
- Be aware of current events that might temporarily increase sensitivity
- Consult with regional or national coordinators before publishing any geographic data
- Consider that "safe" countries may have localities requiring protection (refugee communities, etc.)

**Access Control:**
- **National coordinators:** Full access to localities in their national community
- **Regional coordinators:** Access to localities in their region only
- **Cluster coordinators:** Access to localities in their cluster only
- **Locality coordinators:** Access to their own locality only
- **Public reports:** Highly aggregated statistics only, strict minimum thresholds applied
- **Researchers:** Anonymized data with geographic randomization or generalization

### Privacy Checklist for Locality Queries

Before querying or reporting on Localities data:
- [ ] Comments field excluded OR manually reviewed and redacted
- [ ] Attendance numbers meet minimum thresholds (≥10 for Feast, ≥15 for devotionals) OR aggregated
- [ ] Small localities (population < 100 or Feast attendance < 10) aggregated to cluster level
- [ ] Sensitive regions excluded or aggregated to national level
- [ ] No combination with Individuals table that could reveal names + locality
- [ ] No exact counts for sensitive metrics - use ranges or aggregates
- [ ] Query results reviewed for potential small-group identification
- [ ] Results appropriate for intended audience (public vs. coordinator vs. administrative)
- [ ] Query complies with privacy guidelines from classification matrix
- [ ] Current geopolitical situation considered (new conflicts, persecution, etc.)

### Context-Specific Privacy Considerations

**Religious Freedom Context:**
In countries with strong religious freedom protections, locality-level reporting may be appropriate with standard minimum thresholds. However, even in these contexts:
- Protect small communities that could be identified
- Be aware of local sensitivities or tensions
- Consider impact on children and families
- Maintain minimum thresholds for all published data

**Restricted/Sensitive Context:**
In countries or regions with religious restrictions, persecution, or social instability:
- **NEVER publish locality-level data** - aggregate to regional or national level only
- **Use extreme caution with any geographic data** - even cluster or regional names might be sensitive
- **Exclude sensitive metrics entirely:** LSA presence, friend attendance, home visits
- **Consider complete geographic anonymization** for research purposes
- **Consult with national institutions** before ANY data publication

**Mixed Context (Some Sensitive Localities):**
In regions where some localities are sensitive while others are not:
- Apply protection to all localities in the region if any are sensitive
- Default to higher privacy standards across the entire region
- Consider separate reporting: public (highly protected) and internal (detailed)
- Flag sensitive localities in database with special handling requirements

### Examples with Fictitious Data

When documenting queries or creating examples, use fictitious data:
- **Locality names:** "Example Village", "Sample Town", "Test City", "Demo Neighborhood"
- **Regions/Clusters:** "Northern Sample Region", "Central Example Cluster"
- **Attendance numbers:** Use clearly illustrative ranges (10, 25, 50, 100) not real data
- **Countries:** Use "Example Country A", "Sample Nation B" for sensitive contexts
- **NEVER use real locality names** with any metrics or statistics
- **NEVER include actual Comments field content** in documentation

### Special Considerations

**Small Community Safety:**
- Localities with < 10 adult Baha'is are especially vulnerable to identification
- Single-family or few-family communities require maximum protection
- Even aggregate statistics might identify specific families if locality is small enough
- Default to cluster or regional aggregation for all small communities

**Children and Youth Protection:**
- Locality data combined with activity data could identify children's participation
- Protect information that could reveal which children/families are involved
- Be especially careful with devotional "friend attendance" that might identify families
- Consider child safety implications of any geographic specificity

**LSA Information Sensitivity:**
- In some contexts, revealing LSA existence could create legal or social complications
- LSA formation/dissolution is significant and should be handled sensitively
- Electoral unit information is administrative - protect accordingly
- Never publish names of LSA members in connection with locality data

**Home Visit Data:**
- Home visits data reveals outreach intensity and community relationships
- High home visit numbers might indicate missionary activity (sensitive in some contexts)
- Could reveal patterns of contact with specific populations
- Protect this metric carefully in any restricted or sensitive context

**Temporal Sensitivity:**
- Current geopolitical situations may temporarily increase sensitivity
- Recent LSA formations might be especially sensitive during transition periods
- Growth spurts or declines might reveal community dynamics requiring protection
- Consider recency when determining appropriate aggregation levels

## Notes for Developers

When working with the Localities table:
- **Always assess geographic sensitivity:** Know which regions/countries require enhanced protection
- **Check Comments carefully:** Never export Comments without manual review and redaction
- **Apply minimum thresholds:** Feast attendance ≥10, devotional attendance ≥15, or aggregate further
- **Default to aggregation:** When in doubt, aggregate to cluster or regional level
- **Consider context:** Apply stricter protections in sensitive regions or for small communities
- **Combine tables carefully:** Localities + Individuals or Localities + Activities can reveal identities
- **Use access controls:** Ensure queries respect user permissions and geographic scope
- **ClusterId is essential:** Almost all queries should filter or aggregate by cluster
- **Handle NULL values:** Check for NULL in ClusterId, Name, ElectoralUnitId before joining
- **Multi-language support:** Consider both Name and LatinName for search and display
- **Audit trail matters:** LastUpdatedTimestamp helps identify stale data needing refresh

## Performance Optimization

### Indexing Recommendations
- **ClusterId** (high priority) - Most queries filter or aggregate by cluster
- **ElectoralUnitId** (moderate priority) - Administrative queries and reports
- **Name, LatinName** (moderate priority) - Search and lookup operations
- **GUID** (moderate priority) - Synchronization operations
- **HasLocalSpiritualAssembly** (low priority) - Filtering LSA localities
- **LastUpdatedTimestamp** (low priority) - Data freshness queries

### Query Tips
- **Filter by cluster first** to dramatically reduce result sets
- **Use appropriate indexes** for geographic hierarchy traversal
- **Consider materialized views** for complex community vitality aggregations
- **Cache locality lists per cluster** for UI dropdowns (they change infrequently)
- **Implement query result caching** for expensive regional aggregations
- **Use covering indexes** for frequently-accessed field combinations
- **Partition by region** for very large multi-national databases

## Relationship to Other Systems

### Institute Tracking
The InstituteId field links localities to external institute management systems:
- Training program coordination and tutor assignments
- Course scheduling and venue management
- Resource allocation for educational materials
- Participant progress tracking across institute and SRP systems
- Integrated reporting on educational capacity building

### External Synchronization
The GUID field enables:
- Multi-site deployments across regional and national databases
- Mobile app synchronization for field coordinators
- Backup/restore operations maintaining record identity
- Data exchange between regional databases
- Conflict resolution in distributed update scenarios
- Integration with national or international consolidation systems
