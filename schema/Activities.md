# Activities Table

## Overview

The `Activities` table serves as the cornerstone of the SRP database's educational activity tracking system, capturing all organized spiritual and educational programs conducted within the Bahá'í community framework. This table represents the practical implementation of the institute process - a systematic approach to building capacity for service and spiritual transformation at the grassroots level. Each record represents a distinct educational activity that brings together participants in a specific location over a defined period, whether it's children learning moral concepts through stories and games, junior youth exploring their emerging powers, or adults studying the sequence of Ruhi Institute books to deepen their understanding and capacity for service.

The activities tracked in this table form the core of community-building efforts, representing the four core activities that are central to Bahá'í community life: children's classes, junior youth groups, study circles, and devotional meetings (though devotional meetings are not explicitly tracked in this particular table structure). These activities are not merely educational programs but are integral to a broader vision of social transformation, where individuals of all backgrounds come together to build vibrant communities characterized by devotion, learning, and service.

## Table Structure

### Id (bigint, NOT NULL)

The primary key and unique identifier for each activity record. This auto-incrementing field ensures that every activity in the system has a distinct reference point that remains constant throughout its lifecycle. The Id serves as the fundamental link between this table and related tables such as ActivityStudyItems and ActivityStudyItemIndividuals, creating a web of relationships that capture the full complexity of each educational activity. In data migration scenarios or system integrations, this Id provides the stable anchor point while other identifiers like LegacyId or GUID handle cross-system synchronization needs.

### ActivityType (tinyint, NOT NULL)

This field encodes the fundamental categorization of educational activities within the institute process, using a simple numeric system where 0 represents Children's Classes, 1 represents Junior Youth Groups, and 2 represents Study Circles. This classification is crucial for understanding the nature of each activity and its target demographic.

Children's Classes (Type 0) typically serve ages 5-11 and focus on developing spiritual qualities, moral concepts, and habits of prayer through age-appropriate lessons that often include stories, songs, games, and artistic activities. These classes are usually organized in a graded sequence, with each grade building on the concepts learned in previous years.

Junior Youth Groups (Type 1) serve the critical age range of 12-15, a period of significant intellectual and moral development. These groups use specially designed materials that help junior youth explore concepts of moral excellence, develop their powers of expression, and engage in acts of service to their communities. The junior youth spiritual empowerment program recognizes this age group's unique potential to contribute to social transformation.

Study Circles (Type 2) primarily serve youth and adults, offering a systematic study of the Ruhi Institute sequence or similar educational materials. These circles create a collaborative learning environment where participants study, reflect, and practice together, building their capacity to serve their communities in various ways.

### DisplayStartDate (varchar(20), NOT NULL)

This field stores a human-readable representation of when the activity began, formatted in a way that makes sense for user interfaces and reports. Unlike the precise StartDate field, DisplayStartDate might contain partial dates like "October 2024" or "Fall 2024" when exact dates are uncertain or when activities began informally before formal registration. This flexibility is particularly important in communities where activities might emerge organically and only later be formally registered in the system. The 20-character limit accommodates various date formats while maintaining reasonable constraints for display purposes.

### StartDate (datetime, NOT NULL)

The precise datetime when the activity officially commenced, stored in a format suitable for system calculations, date comparisons, and reporting queries. This field enables the system to perform accurate temporal analyses, such as determining which activities were active during a specific reporting cycle, calculating activity duration, or identifying patterns in activity initiation across different seasons or periods. The datetime precision allows for tracking not just the date but also the specific time of day, which can be relevant for scheduling and coordination purposes.

### DisplayEndDate (varchar(20), NULL)

Similar to DisplayStartDate, this nullable field provides a human-friendly representation of when an activity concluded or is expected to conclude. The ability to store NULL values is significant, as many activities, particularly study circles, may continue indefinitely or have uncertain end dates. When populated, this field might contain approximate dates or descriptive periods that wouldn't fit in a strict datetime format, providing flexibility in how completion is communicated to users while maintaining data integrity in the system.

### EndDate (datetime, NULL)

The precise datetime when the activity concluded or is scheduled to conclude. The nullable nature of this field is fundamental to the system's design, as many educational activities in the Bahá'í framework are ongoing processes rather than fixed-term programs. A NULL value typically indicates an active, ongoing activity, while a populated EndDate marks the formal conclusion of the activity. This field is crucial for calculating activity duration, determining completion rates, and identifying which activities were active during specific reporting periods.

### Comments (nvarchar(MAX), NULL)

A free-text field that captures additional context, observations, or notes about the activity that don't fit into the structured fields. This field serves multiple purposes: documenting special circumstances (like the examples in the data showing participants who completed portions of books or had scheduling challenges), recording decisions made by facilitators, noting adaptations made to standard curricula, or preserving institutional memory about the activity's development. The nvarchar(MAX) specification allows for extensive notes when needed, supporting Unicode characters for multilingual comments. Comments often provide valuable qualitative insights that complement the quantitative data, helping coordinators understand the full story behind the numbers.

### IsCompleted (bit, NOT NULL)

A boolean flag that definitively marks whether an activity has reached its conclusion. This field is distinct from simply having an EndDate, as an activity might have a scheduled end date but not actually complete (due to suspension or cancellation), or might complete earlier or later than originally planned. The IsCompleted flag provides a clear, binary indication that helps in filtering queries, generating completion statistics, and understanding the current status of educational programs across the community. For ongoing activities that cycle through multiple iterations of content, this flag helps distinguish between a completed cycle and an activity that continues with new material.

### HasServiceProjects (bit, NULL)

This nullable boolean field indicates whether the activity incorporates a service component, reflecting the Bahá'í principle that education should lead to action and service. Service projects are particularly emphasized in certain books of the Ruhi sequence (notably Books 3, 5, and 7) and are a fundamental aspect of the junior youth program. When true, this flag indicates that participants are not just studying concepts but actively applying them through acts of service in their communities. The nullable nature allows for cases where this information might not be tracked or applicable, particularly for historical data or certain types of activities.

### Participants (int, NULL)

Stores the total number of individuals participating in the activity, regardless of their religious affiliation or formal registration status. This count provides a high-level view of the activity's reach and can be manually overridden (as indicated by the IsOverrideParticipantCounts flag) when automated counts from linked tables don't accurately reflect reality. This might occur when some participants attend informally, when technical issues prevent proper registration, or when historical data is being entered retrospectively. The field's nullable nature accommodates situations where participant counts are unknown or still being determined.

### BahaiParticipants (int, NULL)

A subset count of participants who are registered members of the Bahá'í community. This distinction is important for understanding the activity's role in both deepening the knowledge of community members and extending educational opportunities to the broader population. The ratio between BahaiParticipants and total Participants provides insights into the activity's reach beyond the Bahá'í community, which is a key metric for understanding community integration and the inclusive nature of the educational programs. This field helps communities track their progress in making core activities accessible to all residents, regardless of religious background.

### LocalityId (bigint, NOT NULL)

A foreign key linking the activity to its geographic location within the Localities table. This relationship places the activity within the broader geographic hierarchy of the Bahá'í administrative structure (Locality → Cluster → Region → National Community). The locality represents a specific city, town, or village where the activity takes place, providing the primary geographic context for reporting and analysis. This mandatory field ensures that every activity can be aggregated and analyzed at various geographic levels, supporting both local coordination and regional or national planning efforts.

### SubdivisionId (bigint, NULL)

An optional foreign key that provides more granular geographic specificity when a locality is large enough to be divided into neighborhoods or sectors. This field becomes particularly relevant in urban areas where a single locality might have dozens of activities running simultaneously in different neighborhoods. By tracking activities at the subdivision level, coordinators can better understand patterns of growth, identify underserved areas, and coordinate resources more effectively. The nullable nature reflects that not all localities have or need subdivisions.

### IsOverrideParticipantCounts (bit, NOT NULL)

A flag indicating that the participant count fields (Participants and BahaiParticipants) have been manually set rather than calculated from linked participant records. This override mechanism is essential for maintaining accurate statistics when the detailed participant-level data in ActivityStudyItemIndividuals is incomplete, incorrect, or not yet entered. This might occur when activities are recorded retrospectively, when technical issues prevent detailed tracking, or when informal participants attend without formal registration. The flag helps maintain data integrity by clearly marking when counts are manually adjusted.

### CreatedTimestamp (datetime, NOT NULL)

Records the exact moment when this activity record was first created in the database. This audit field is crucial for understanding data entry patterns, tracking system usage, and troubleshooting data quality issues. It helps answer questions about when information was first recorded (which might be different from when the activity actually started), supports change tracking, and can be used to identify records created during specific data migration or bulk import operations.

### CreatedBy (uniqueidentifier, NOT NULL)

Stores the GUID of the user account that created this record, providing accountability and traceability in the data entry process. This field is essential for audit purposes, allowing administrators to track who is entering data, identify training needs, and investigate any data quality issues. In multi-user environments where various coordinators, assistants, or administrators might enter data, this field maintains a clear chain of responsibility for the information in the system.

### LastUpdatedTimestamp (datetime, NOT NULL)

Captures the most recent moment when any field in this record was modified, providing a critical audit trail for data changes. This timestamp is automatically updated whenever any change is made to the record, helping administrators understand data freshness, identify recently modified records, and track patterns of updates. This field is particularly useful for synchronization scenarios, incremental reporting, and understanding how information about activities evolves over time.

### LastUpdatedBy (uniqueidentifier, NOT NULL)

Records the GUID of the user who most recently modified this record, completing the audit trail for changes. Together with LastUpdatedTimestamp, this field provides full visibility into who is maintaining and updating activity information. This is particularly important in distributed systems where multiple users might have access to update records, helping maintain accountability and enabling administrators to follow up on changes when necessary.

### ImportedTimestamp (datetime, NULL)

For records that were imported from external systems rather than entered directly, this field captures when the import occurred. This timestamp is distinct from CreatedTimestamp, as it specifically marks when data was brought in from another system, which might be significantly later than when the record was originally created in the source system. This field is crucial for understanding data provenance, tracking migration waves, and troubleshooting any issues related to imported data.

### ImportedFrom (uniqueidentifier, NULL)

Identifies the source system or import batch from which this record originated, using a GUID that can be traced back to specific import operations. This field enables administrators to track data lineage, understand which records came from which sources, and potentially trace back to original systems if questions arise about data accuracy or completeness. In scenarios where data is consolidated from multiple regional or local systems, this field maintains the connection to the original source.

### ImportedFileType (varchar(50), NULL)

Documents the format or type of file from which data was imported, such as "CSV", "Excel", "SRP_3_1_Region_File", or other specific format identifiers. This information is valuable for understanding the import process, troubleshooting format-specific issues, and maintaining documentation about data sources. The 50-character limit accommodates most file type descriptions while preventing excessive storage use. As seen in the sample data, this often includes version information about the specific SRP file format used.

### GUID (uniqueidentifier, NOT NULL)

A globally unique identifier that remains constant for this activity record across all systems and synchronization operations. Unlike the Id field which is specific to this database instance, the GUID provides a universal reference that can be used to match records across distributed systems, support data synchronization, and maintain record identity through export/import cycles. This field is essential for maintaining data integrity in scenarios where multiple SRP installations need to share or synchronize data.

### LegacyId (nvarchar(255), NULL)

Preserves the original identifier from legacy systems during migration processes, maintaining a link to historical records and supporting gradual transition scenarios. This field might contain various formats of identifiers depending on the source system - numeric IDs, alphanumeric codes, or even composite keys formatted as strings. The 255-character limit provides ample space for most legacy identifier schemes while maintaining reasonable storage constraints. Although the sample data shows this field as commonly NULL, it becomes crucial during system transitions.

### InstituteId (nvarchar(50), NULL)

An external identifier that links this activity to records in separate institute management systems that might be used alongside the SRP database. Some communities or regions might use specialized institute tracking systems for detailed curriculum management, and this field maintains the connection between the SRP's comprehensive community data and those specialized educational systems. The 50-character limit accommodates most external system ID formats while keeping the field manageable.

## Key Relationships

### Geographic Hierarchy
Every activity exists within a specific geographic context, primarily defined by its LocalityId, which places it within the hierarchy: National Community → Region → Cluster → Locality → (optionally) Subdivision. This geographic placement enables activities to be aggregated and analyzed at multiple levels, supporting everything from neighborhood coordination to national strategic planning.

### Curriculum Connection
Through the ActivityStudyItems table, activities are linked to specific elements of the educational curriculum stored in the StudyItems table. This relationship captures which books, units, or lessons are being studied in each activity, enabling detailed tracking of educational progress across the community.

### Participant Tracking
The ActivityStudyItemIndividuals table creates a many-to-many relationship between activities and individuals, capturing not just who participates but in what capacity (facilitator, participant, observer, etc.). This detailed tracking enables rich analysis of participation patterns, facilitator development, and individual progress through the educational sequence.

### Reporting Cycles
While not directly linked via foreign key, activities are closely related to the Cycles table through their date ranges. The StartDate and EndDate fields allow activities to be associated with specific reporting cycles, enabling periodic statistical reports that track the growth and development of educational activities over time.

## Data Quality Considerations

The quality and completeness of data in the Activities table directly impacts the accuracy of community statistics and the effectiveness of planning efforts. Key considerations include ensuring that dates are accurately recorded, participant counts are regularly updated, and the completion status accurately reflects reality. The override flags provide necessary flexibility but should be used judiciously and documented in the Comments field when applied.

The dual date system (Display and actual dates) requires careful coordination to ensure consistency while maintaining the flexibility needed for real-world scenarios where precise dates might not always be available. Similarly, the relationship between IsCompleted and EndDate requires attention to ensure logical consistency - typically, a completed activity should have an end date, though the reverse isn't always true.

## Integration and Synchronization

The multiple identifier fields (Id, GUID, LegacyId, InstituteId) reflect the reality of distributed data management in a global community. These fields work together to support various integration scenarios: GUID enables synchronization between peer systems, LegacyId maintains continuity during system transitions, and InstituteId connects to specialized educational management tools. Understanding these relationships is crucial for anyone working with data integration or migration tasks involving the Activities table.

## Privacy and Security

**HIGH PRIVACY CLASSIFICATION** ⚠️

While the Activities table primarily contains operational data about educational activities, it requires careful privacy handling due to the Comments field and potential identification of small groups.

### Privacy Classification

**Reference:** See `reports/Privacy_and_Security_Classification_Matrix.md` for comprehensive privacy guidance.

This table is classified as **HIGH** for privacy:
- **Comments field may contain personal names** or observations about participants
- Small activity groups in small localities can enable individual identification
- Activity participation linked to individuals via ActivityStudyItemIndividuals table

### Field-Level Sensitivity

| Field Name | Sensitivity Level | Privacy Concerns |
|------------|------------------|------------------|
| **Comments** | **HIGH** | May contain participant names, personal observations - **ALWAYS review before export** |
| LocalityId, SubdivisionId | MODERATE | Small localities with few activities may enable identification |
| Participants, BahaiParticipants | MODERATE | Small numbers (< 5) in reports may identify specific groups |
| All other fields | LOW | Operational activity data - generally safe |

### Prohibited Query Patterns

**❌ NEVER DO THIS - Exposing Comments with Activity Details:**
```sql
-- Comments may contain personal information - never export without review
SELECT L.[Name], A.[ActivityType], A.[Comments]
FROM [Activities] A
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
WHERE A.[Comments] IS NOT NULL;
```

**❌ NEVER DO THIS - Small Group Identification:**
```sql
-- This could identify specific small groups in small localities
SELECT L.[Name], A.[ActivityType], A.[Participants]
FROM [Activities] A
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
WHERE A.[Participants] < 5;  -- Dangerous - could identify specific children or families
```

### Secure Query Patterns

**✅ CORRECT - Activity Statistics with Minimum Thresholds:**
```sql
-- Safe: Aggregates to cluster level with minimum thresholds
SELECT
    C.[Name] AS [ClusterName],
    CASE A.[ActivityType]
        WHEN 0 THEN 'Children''s Classes'
        WHEN 1 THEN 'Junior Youth Groups'
        WHEN 2 THEN 'Study Circles'
    END AS [ActivityType],
    COUNT(*) AS [ActivityCount],
    AVG(A.[Participants]) AS [AvgParticipants]
FROM [Activities] A
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE A.[IsCompleted] = 0
  AND A.[Participants] >= 5  -- Minimum threshold to protect small groups
GROUP BY C.[Name], A.[ActivityType]
HAVING COUNT(*) >= 3  -- Only show if cluster has 3+ activities of this type
ORDER BY C.[Name], A.[ActivityType];
```

**✅ CORRECT - Regional Activity Trends (No Small Groups):**
```sql
-- Safe: Regional aggregates exclude small localities
SELECT
    R.[Name] AS [RegionName],
    COUNT(DISTINCT C.[Id]) AS [ClustersWithActivities],
    COUNT(DISTINCT A.[Id]) AS [TotalActivities],
    SUM(A.[Participants]) AS [TotalParticipants]
FROM [Activities] A
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id] AND L.[TotalPopulation] >= 500  -- Exclude small localities
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE A.[IsCompleted] = 0
  AND A.[Participants] >= 5  -- Exclude very small groups
GROUP BY R.[Name]
ORDER BY R.[Name];
```

### Data Protection Requirements

**Comments Field Protection:**
- **ALWAYS manually review** Comments field contents before ANY export or public report
- **Redact personal names:** Remove participant names, facilitator names, family names
- **Redact observations:** Remove personal observations about individuals ("Sarah excels at...", "John struggles with...")
- **Keep operational notes:** Retain relevant operational information ("Moved to larger room", "Schedule changed to Saturdays")

**Small Group Protection:**
- Apply **minimum threshold of 5 participants** before including activity data in reports
- For localities with population < 500, aggregate to cluster level in public reports
- Never report activity details that could identify specific children's classes or family groups
- Consider geographic sensitivity - even larger activities may need protection in sensitive regions

**Access Control:**
- Regional coordinators: Access to activities in their region
- Cluster coordinators: Access to activities in their cluster
- Teachers/facilitators: Access to activities they lead only
- Public reports: Aggregated statistics only, minimum thresholds applied

### Privacy Checklist for Activity Queries

Before querying or reporting on Activities data:
- [ ] Comments field excluded OR manually reviewed and redacted
- [ ] Participant counts meet minimum threshold (≥ 5) OR aggregated
- [ ] Small localities (population < 500) aggregated to cluster level
- [ ] No combination with Individuals table that could reveal names + participation
- [ ] Result appropriate for intended audience (public vs. coordinator vs. administrative)
- [ ] Query complies with privacy guidelines from classification matrix

### Examples with Fictitious Data

When documenting queries or creating examples, use fictitious data:
- Locality names: "Example City", "Sample Town", "Test Village"
- Activity counts and participant numbers that are clearly illustrative (10, 25, 50)
- **Never** use real locality names with specific participant counts
- **Never** include actual Comments field content in documentation

### Special Considerations

**Children's Safety:**
- Children's class activities require extra privacy protection
- Never publish information that could identify specific children or their participation
- Protect information about which children attend which classes
- Consider safety implications before sharing any activity details publicly

**Small Community Sensitivity:**
- In small localities, even aggregate activity statistics may identify families
- Be especially protective in communities with only 1-2 activities
- Consider that "5 children in Ruhi Book 3, Grade 2" in a small village may identify specific families
- Default to cluster-level reporting in small or sensitive communities

**Facilitator Privacy:**
- Facilitator/teacher names often appear in Comments field
- Protect facilitator identity unless they've consented to being named
- Don't expose patterns that could identify facilitators (e.g., "same person teaches all 5 classes in locality")

## Notes for Developers

When working with the Activities table:
- **Always filter archived records:** Use `WHERE [IsArchived] = 0` for current data
- **Check Comments carefully:** Never export Comments without manual review
- **Apply minimum thresholds:** Ensure participant counts ≥ 5 or aggregate further
- **Consider geography:** Small localities need special handling
- **Link carefully to Individuals:** Never create queries that link names to activity participation without authorization