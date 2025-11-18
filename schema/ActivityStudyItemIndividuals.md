# ActivityStudyItemIndividuals Table

## Overview

The `ActivityStudyItemIndividuals` table represents the heart of participant tracking within the SRP database, serving as the critical junction point that connects individuals with their educational journey through the institute process. This table captures the complex, multifaceted relationships between people, the activities they participate in, the curriculum they study, and the roles they play in the community-building process. Each record in this table tells a story of an individual's engagement with a specific aspect of the educational framework - whether as a student progressing through the Ruhi sequence, a tutor facilitating others' learning, a junior youth exploring concepts of moral empowerment, or a child learning spiritual principles through age-appropriate activities.

This table goes beyond simple enrollment tracking to capture the dynamic nature of participation in Bahá'í educational activities. It recognizes that individuals often wear multiple hats - someone might be a participant in one study circle while simultaneously serving as a children's class teacher in another activity. The same person might be completing Book 7 to become a tutor while also assisting with a junior youth group. This complexity is essential to understanding the organic growth of human resources within communities, where capacity building is not linear but rather a rich tapestry of simultaneous learning and service experiences.

The design of this table also reflects the principle that education within the Bahá'í framework is not merely about knowledge acquisition but about transformation and service. By tracking not just participation but also roles, completion status, and progression through materials, the table enables communities to understand how individuals are developing their capacities and contributing to the growth of their communities.

## Table Structure

### Id (bigint, NOT NULL)

The primary key serving as the unique identifier for each participation record. This auto-incrementing field ensures that every instance of an individual's engagement with an educational activity is distinctly tracked. The Id is particularly important because an individual might have dozens or even hundreds of records in this table over time, representing their journey through various books, their service in different capacities, and their involvement in multiple activities. Each Id captures a specific moment or phase in someone's educational and service path.

### IndividualType (tinyint, NOT NULL)

This field categorizes participants into distinct types that reflect their demographic, spiritual, or functional classification within the community. The typing system helps communities understand the composition of their activities and track progress across different population segments.

Common type categories typically include:
- Type 1: Adult Bahá'í believers (ages 15+)
- Type 2: Bahá'í youth (ages 15-30, sometimes tracked separately)
- Type 3: Bahá'í junior youth (ages 12-14)
- Type 4: Bahá'í children (ages 5-11)
- Type 5: Friends of the Faith (non-Bahá'í participants of any age)
- Type 6: Seekers or those investigating the Faith
- Type 7: Special categories (visiting participants, etc.)

This categorization is crucial for understanding community demographics, measuring the reach of activities beyond the Bahá'í community, and ensuring age-appropriate educational experiences. It also helps in generating statistics about community integration and the inclusive nature of core activities.

### IndividualRole (tinyint, NOT NULL)

This critical field captures the specific capacity in which an individual participates in an activity, reflecting the diverse ways people contribute to the educational process. The role system recognizes that learning in the Bahá'í context is not passive but involves various levels of service and responsibility.

**Role 1: Teacher/Primary Instructor**
The main facilitator responsible for delivering the curriculum. In children's classes, this is the teacher who plans lessons, prepares materials, and guides the class. In study circles, this might be the lead tutor. Teachers typically have completed the relevant training (Book 3 for children's class teachers, Book 7 for tutors) and carry primary responsibility for the activity's success.

**Role 2: Co-Teacher/Assistant Teacher**
A secondary instructor who shares teaching responsibilities. This role often represents someone in training or providing support to the primary teacher. Co-teachers might lead specific portions of activities, help with classroom management, or provide continuity when the primary teacher is absent.

**Role 3: Tutor/Facilitator**
Specifically used for those facilitating study circles or leading discussion-based learning. Tutors guide participants through the study materials, facilitate consultations, and help create an environment conducive to spiritual transformation. This role requires completion of Book 7 and represents a significant level of capacity in accompanying others through the institute process.

**Role 4: Coordinator**
Individuals who coordinate multiple activities or oversee the educational programs in a locality or cluster. Coordinators might not directly teach but ensure activities run smoothly, resources are available, and communication flows between different actors. They often serve as a bridge between grassroots activities and institutional support structures.

**Role 5: Assistant/Helper**
Those who provide practical support without primary teaching responsibilities. In children's classes, assistants might help with crafts, games, or managing younger children. In study circles, they might help with logistics, refreshments, or technical support. This role often serves as a stepping stone for those developing their capacities.

**Role 6: Observer/Visitor**
Temporary participants who are observing activities, perhaps considering joining or learning how activities function. This might include parents observing children's classes, potential tutors observing study circles, or visitors from other communities learning about local practices.

**Role 7: Participant/Student**
The standard learner role, representing the vast majority of records (95,139 in the sample data). Participants are actively engaged in studying the curriculum, whether children learning prayers and virtues, junior youth exploring their potential, or adults studying the Ruhi sequence. This role is fundamental as it represents the primary purpose of educational activities.

The distribution of roles (with participants being most numerous, followed by assistants, then tutors and teachers) reflects the natural pyramid of capacity building, where many participate, some assist, and a smaller number take on full teaching responsibilities.

### IsCurrent (bit, NOT NULL)

A boolean flag indicating whether the individual's participation in this particular activity-study item combination is currently active. This field is essential for distinguishing between historical records (kept for reporting and tracking purposes) and active engagements.

When TRUE, this indicates the individual is actively involved in this capacity. They're attending sessions, progressing through materials, or fulfilling their role responsibilities. Current participants are included in active statistics and ongoing activity counts.

When FALSE, this represents historical participation - the person has moved on, completed their involvement, or discontinued for any reason. These records are preserved to maintain a complete educational history, track completion rates over time, and understand patterns of participation and attrition.

The IsCurrent flag allows the same individual to have multiple records for the same study item (perhaps attempting it multiple times) while clearly identifying which represents their current status.

### IsCompleted (bit, NOT NULL)

This boolean field specifically tracks whether the individual has successfully completed the study item associated with this record. Completion has specific meaning within the institute process and represents more than just attendance.

For study circles, completion typically means the participant has:
- Attended the required percentage of sessions
- Completed all practical components
- Demonstrated understanding through participation
- Fulfilled any service requirements associated with the book

For children's classes and junior youth groups, completion might indicate:
- Finishing a grade level or text
- Achieving learning objectives
- Regular attendance through the program period

The IsCompleted flag is distinct from the activity's completion status and the IsCurrent flag. An individual might be currently enrolled (IsCurrent=TRUE) but not yet completed (IsCompleted=FALSE), or might have completed (IsCompleted=TRUE) but still be recorded as current if they're continuing to serve in that capacity or reviewing materials.

### DisplayEndDate (varchar(20), NULL)

A human-readable representation of when the individual's participation ended or when they completed the study item. This field provides flexibility in how completion or departure dates are recorded and displayed, accommodating various levels of precision.

The field might contain:
- Exact dates: "2018-07-20" for precise completion
- Month indicators: "July 2018" when the exact day is unknown
- Approximate periods: "Summer 2018" for less precise records
- Descriptive text: "End of cycle" or "Before move" for contextual dating

This flexibility is particularly valuable for historical data entry, imported records, or situations where exact dates weren't tracked but approximate timing is known. The 20-character limit provides sufficient space for most date representations while maintaining reasonable constraints.

### EndDate (datetime, NULL)

The precise datetime when the individual's participation concluded, whether through completion, withdrawal, or transition to another role. This field enables accurate duration calculations and temporal analysis of participation patterns.

A NULL EndDate combined with IsCurrent=TRUE typically indicates ongoing participation. When populated, it might represent:
- Successful completion of a study item
- Departure from the community
- Transition to a different activity or role
- Temporary suspension with intention to return

The relationship between EndDate, IsCompleted, and IsCurrent provides nuanced tracking:
- EndDate + IsCompleted=TRUE: Successfully finished
- EndDate + IsCompleted=FALSE: Discontinued without completing
- NULL EndDate + IsCurrent=TRUE: Actively participating
- NULL EndDate + IsCurrent=FALSE: Status uncertain or data incomplete

### IndividualId (bigint, NOT NULL)

The foreign key linking this participation record to the Individuals table, identifying the specific person involved. This mandatory relationship ensures every participation record is associated with a known individual in the system.

This link enables:
- Tracking an individual's complete educational journey across multiple activities and study items
- Understanding progression patterns through the institute curriculum
- Identifying those ready for new responsibilities based on their completion history
- Generating individual progress reports and transcripts

The IndividualId allows the system to construct a comprehensive view of each person's development, service record, and current involvements across all activities in the community.

### ActivityId (bigint, NULL)

A foreign key linking this participation to a specific activity in the Activities table. Interestingly, this field is nullable, which reveals an important design flexibility in the system.

When populated, ActivityId creates the full connection: Individual → Activity → Study Item, enabling queries like "Who is participating in this Tuesday evening study circle studying Book 1?"

When NULL (as seen in several sample records), it indicates that study item completion is being tracked independently of a formal activity. This might occur when:
- Individuals complete books through intensive courses not tracked as regular activities
- Historical completions are recorded retrospectively without activity details
- Self-study or informal study is recognized
- Records are imported from systems that tracked completions differently

This flexibility allows the system to maintain comprehensive educational records even when the specific activity context is unknown or not applicable.

### StudyItemId (bigint, NULL)

The foreign key identifying the specific curriculum element (book, unit, grade, or text) being studied, linking to the StudyItems table. While nullable, this field is typically populated as it identifies what educational content the individual is engaging with.

The StudyItemId enables tracking of:
- Progression through the Ruhi sequence (Books 1-9 and beyond)
- Completion of specific units within books
- Grade levels in children's classes
- Junior youth texts and materials
- Specialized study materials

When NULL, the record might represent:
- General participation without specific curriculum tracking
- Administrative or support roles not tied to particular materials
- Placeholder records awaiting curriculum assignment
- Historical data where curriculum details weren't preserved

### CreatedTimestamp (datetime, NOT NULL)

Records the exact moment this participation record was created in the database. This audit field serves multiple purposes beyond simple record-keeping.

For data quality, it helps identify:
- When participants were enrolled relative to activity start dates
- Patterns in data entry (batch processing vs. real-time entry)
- Delays between actual enrollment and system recording

For analysis, it enables understanding of:
- Growth patterns in program participation
- Seasonal variations in enrollment
- Response times to community campaigns or initiatives

The timestamp might differ significantly from when the actual participation began, especially for:
- Retrospective data entry
- Migrated historical records
- Batch imports from paper-based systems

### CreatedBy (uniqueidentifier, NOT NULL)

The GUID of the user account that created this participation record, providing accountability and traceability in the enrollment process. This field is crucial for maintaining data quality and understanding data entry patterns.

This identifier helps:
- Track which coordinators or administrators are entering data
- Identify training needs based on data entry patterns
- Investigate discrepancies or unusual entries
- Maintain accountability in multi-user environments

In practice, the CreatedBy field often points to:
- Activity coordinators entering their own activity data
- Cluster coordinators doing centralized data entry
- System administrators performing bulk imports
- Migration accounts used during system transitions

### LastUpdatedTimestamp (datetime, NOT NULL)

Captures when this participation record was most recently modified, providing crucial information for understanding how participant data evolves over time.

Updates might occur when:
- Completion status changes (IsCompleted becomes TRUE)
- Roles change (participant becomes assistant)
- Current status updates (IsCurrent changes)
- End dates are added or modified
- Corrections are made to historical data

This timestamp is essential for:
- Incremental reporting and synchronization
- Identifying recently changed records for review
- Understanding the freshness of participation data
- Tracking the lifecycle of participant records

### LastUpdatedBy (uniqueidentifier, NOT NULL)

Records the GUID of the user who most recently modified this record, completing the audit trail for changes.

This field helps track:
- Who is maintaining and updating participation records
- Whether updates come from coordinators, participants, or administrators
- Patterns in data maintenance across different users
- Authorization and access patterns

Together with LastUpdatedTimestamp, this creates a clear picture of how participation data is maintained and by whom.

### ImportedTimestamp (datetime, NULL)

For records that originated from external systems, this field captures when the import occurred. This timestamp is distinct from CreatedTimestamp and provides specific information about data migration and integration processes.

Import timestamps help:
- Track waves of data migration from legacy systems
- Identify records that might need verification
- Understand the vintage of different data sets
- Coordinate phased migration approaches

The field is particularly relevant for:
- Initial system implementations importing historical data
- Periodic imports from regional or national systems
- Integration with external institute management tools
- Consolidation of data from multiple sources

### ImportedFrom (uniqueidentifier, NULL)

Identifies the specific source system or import batch from which this record originated. This GUID can be traced back to import logs, source systems, or batch identifiers.

This field enables:
- Tracing data lineage back to original sources
- Grouping records by import source for validation
- Understanding which systems contributed which data
- Troubleshooting import-related issues

In practice, this might identify:
- Legacy database systems being replaced
- Regional SRP installations being consolidated
- Excel or CSV import batches
- External institute management systems

### ImportedFileType (varchar(50), NULL)

Documents the specific format or type of file from which this record was imported, providing context about the import process and potential data quality considerations.

Common values include:
- "SRP_3_1_Region_File": Specific SRP format versions
- "CSV": Comma-separated value files
- "Excel": Spreadsheet imports
- "LegacyDB": Direct database migrations
- Custom format identifiers

This information helps in:
- Understanding potential format-related issues
- Documenting import procedures
- Troubleshooting data quality problems
- Maintaining import process documentation

### ActivityStudyItemId (bigint, NULL)

A foreign key to the ActivityStudyItems table, providing an additional layer of relationship when activities and study items are formally linked. This field represents a denormalization that can improve query performance and maintain referential integrity.

When populated, this field:
- Confirms the activity-study item relationship
- Enables faster joins without going through multiple tables
- Provides redundancy for data validation
- Supports scenarios where the activity-study item combination has specific properties

When NULL, it might indicate:
- Direct individual-study item relationships without activity context
- Historical data before this relationship was tracked
- Simplified tracking scenarios
- Import situations where this relationship wasn't established

## Key Relationships and Data Patterns

### Individual Learning Journeys

The table enables tracking of complete educational pathways. For instance, an individual's journey might look like:
1. Starts as a participant (Role 7) in Book 1
2. Completes Book 1, continues to Book 2
3. Completes Book 3, becomes a children's class teacher (Role 1)
4. While teaching, continues as participant in Books 4-6
5. Completes Book 7, becomes a tutor (Role 3)
6. Serves as tutor for Books 1-3 while participating in Book 8

Each step creates a new record, building a comprehensive history of development and service.

### Concurrent Participation Patterns

The table's structure supports complex, real-world participation patterns:
- An individual can be in multiple activities simultaneously
- The same person can have different roles in different contexts
- Progression through materials can be non-linear
- Service and study can occur in parallel

### Completion and Progression Tracking

The combination of IsCompleted, IsCurrent, and date fields enables sophisticated tracking:
- Completion rates by demographic (using IndividualType)
- Time-to-completion analysis
- Dropout patterns and re-enrollment
- Success factors based on role and activity type

### Data Quality and Integrity

The nullable foreign keys (ActivityId, StudyItemId, ActivityStudyItemId) provide flexibility but require careful handling:
- Validation rules should ensure at least minimal relationship data
- NULL handling in queries must be explicit
- Reports should account for varying levels of data completeness
- Import processes need clear rules for handling incomplete relationships

## Business Logic and Usage Patterns

### Enrollment Management

When a new participant joins an activity:
1. A record is created with IsCurrent=TRUE, IsCompleted=FALSE
2. IndividualRole is set based on their capacity
3. IndividualType reflects their demographic category
4. Links are established to Individual, Activity, and StudyItem

### Progression Tracking

As participants move through the curriculum:
1. Completion of a study item sets IsCompleted=TRUE
2. Moving to the next item creates a new record
3. Previous record might remain IsCurrent if they're still serving
4. EndDate is set when participation truly ends

### Role Evolution

When participants develop new capacities:
1. New records reflect new roles
2. Historical roles are preserved for reporting
3. Multiple concurrent roles are supported
4. Transitions are tracked through timestamps

### Statistical Reporting

The table supports various analytical needs:
- Active participant counts (WHERE IsCurrent=TRUE)
- Completion statistics (WHERE IsCompleted=TRUE)
- Role distribution analysis
- Demographic breakdowns using IndividualType
- Temporal trends using date fields

## Performance Considerations

### Indexing Strategy

Given the table's role as a junction table with multiple foreign keys and common query patterns:
- Composite indexes on (IndividualId, IsCurrent) for individual history queries
- Indexes on (ActivityId, IsCurrent) for activity participant lists
- Indexes on (StudyItemId, IsCompleted) for curriculum completion analysis
- Indexes on role and type fields for demographic analysis

### Query Optimization

Common query patterns that need optimization:
- Current participants in an activity
- Individual completion history
- Role-based participant lists
- Temporal cohort analysis
- Cross-activity participation patterns

### Data Volume Considerations

With 115,132 records in the sample database and growing:
- Archiving strategies for historical data
- Partitioning by date ranges or activity types
- Summary tables for frequently accessed statistics
- Careful management of NULL values in foreign keys

## Data Migration and Integration

### Import Considerations

When importing participant data:
- Preserve original identifiers where possible
- Map roles and types to standard values
- Validate foreign key relationships
- Document any data transformations
- Maintain audit trail through import fields

### Export Requirements

For reporting and integration:
- Include related entity data (names, activity details)
- Handle NULL foreign keys appropriately
- Provide both display and system dates
- Include completion and current status
- Preserve role and type meanings

### Synchronization Patterns

For distributed systems:
- Use IndividualId as the primary reference
- Maintain activity associations where known
- Preserve completion status across systems
- Coordinate role and type definitions
- Track synchronization through timestamps

## Privacy and Security

**HIGH PRIVACY CLASSIFICATION** ⚠️

This table creates direct links between individuals and their activity participation, making it highly sensitive from a privacy perspective. It reveals WHO participates in WHAT activities in WHICH roles.

### Privacy Classification

**Reference:** See `reports/Privacy_and_Security_Classification_Matrix.md` for comprehensive privacy guidance.

This table is classified as **HIGH** for privacy:
- **Directly links IndividualId to ActivityId** - reveals participation patterns
- **IndividualType field reveals religious affiliation** and age category
- **IndividualRole reveals service capacity** and responsibility level
- Combined with Individuals and Activities tables, can expose complete participation profiles

### Field-Level Sensitivity

| Field Name | Sensitivity Level | Privacy Concerns |
|------------|------------------|------------------|
| **IndividualId** | **CRITICAL** | Direct link to personal identity - **NEVER expose in reports** |
| **ActivityId** | **MODERATE** | Links to activity details that may identify small groups |
| **IndividualType** | **HIGH** | Categorizes by religious affiliation and age - aggregate only |
| **IndividualRole** | **MODERATE** | Reveals service capacity - safe in aggregates |
| StudyItemId | LOW | Curriculum reference - generally safe |
| IsCurrent, IsCompleted | LOW | Status flags - safe when aggregated |
| All other fields | LOW | Operational data |

### Prohibited Query Patterns

**❌ NEVER DO THIS - Linking Names to Activity Participation:**
```sql
-- This violates privacy by exposing who participates in which activities
SELECT
    I.[FirstName],
    I.[FamilyName],
    A.[ActivityType],
    L.[Name] AS [Locality],
    CASE ASI.[IndividualRole]
        WHEN 1 THEN 'Teacher'
        WHEN 7 THEN 'Participant'
        ELSE 'Other'
    END AS [Role]
FROM [ActivityStudyItemIndividuals] ASI
INNER JOIN [Individuals] I ON ASI.[IndividualId] = I.[Id]
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id];
```

**❌ NEVER DO THIS - Exposing Individual Learning Journeys:**
```sql
-- This reveals an individual's complete educational path
SELECT
    I.[FirstName],
    I.[FamilyName],
    SI.[Name] AS [StudyItem],
    ASI.[IsCompleted],
    ASI.[EndDate]
FROM [ActivityStudyItemIndividuals] ASI
INNER JOIN [Individuals] I ON ASI.[IndividualId] = I.[Id]
INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
WHERE I.[Id] = @IndividualId;  -- Even with consent, be very careful with such queries
```

**❌ NEVER DO THIS - Identifying Children in Specific Classes:**
```sql
-- This could identify which children attend which classes
SELECT
    I.[FirstName],
    I.[FamilyName],
    A.[ActivityType],
    L.[Name] AS [Locality]
FROM [ActivityStudyItemIndividuals] ASI
INNER JOIN [Individuals] I ON ASI.[IndividualId] = I.[Id]
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id] AND A.[ActivityType] = 0  -- Children's classes
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
WHERE ASI.[IsCurrent] = 1;
```

### Secure Query Patterns

**✅ CORRECT - Role Distribution Statistics (No Personal Identifiers):**
```sql
-- Safe: Analyzes role patterns without exposing individuals
SELECT
    CASE ASI.[IndividualRole]
        WHEN 1 THEN 'Teacher/Primary Instructor'
        WHEN 2 THEN 'Co-Teacher'
        WHEN 3 THEN 'Tutor/Facilitator'
        WHEN 4 THEN 'Coordinator'
        WHEN 5 THEN 'Assistant/Helper'
        WHEN 7 THEN 'Participant/Student'
        ELSE 'Other'
    END AS [RoleType],
    COUNT(DISTINCT ASI.[IndividualId]) AS [UniqueIndividuals],
    COUNT(*) AS [TotalRoleInstances],
    CAST(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS DECIMAL(5,2)) AS [Percentage]
FROM [ActivityStudyItemIndividuals] ASI
WHERE ASI.[IsCurrent] = 1
GROUP BY ASI.[IndividualRole]
ORDER BY COUNT(DISTINCT ASI.[IndividualId]) DESC;
```

**✅ CORRECT - Cluster-Level Participation Trends (Aggregated):**
```sql
-- Safe: Shows participation trends at cluster level without individual details
SELECT
    C.[Name] AS [ClusterName],
    COUNT(DISTINCT ASI.[IndividualId]) AS [UniqueParticipants],
    COUNT(DISTINCT ASI.[ActivityId]) AS [DistinctActivities],
    SUM(CASE WHEN ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS [CompletedParticipations],
    CAST(SUM(CASE WHEN ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) * 100.0 /
         NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) AS [CompletionRate]
FROM [ActivityStudyItemIndividuals] ASI
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE ASI.[IsCurrent] = 1
GROUP BY C.[Id], C.[Name]
HAVING COUNT(DISTINCT ASI.[IndividualId]) >= 10  -- Minimum threshold
ORDER BY C.[Name];
```

**✅ CORRECT - StudyItem Popularity (No Individual Links):**
```sql
-- Safe: Shows which study items are most commonly being studied, no personal data
SELECT
    SI.[Name] AS [StudyItemName],
    SI.[ActivityStudyItemType],
    COUNT(DISTINCT ASI.[ActivityId]) AS [ActivitiesUsingItem],
    COUNT(*) AS [TotalEnrollments],
    SUM(CASE WHEN ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS [Completions]
FROM [ActivityStudyItemIndividuals] ASI
INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
WHERE ASI.[IsCurrent] = 1
GROUP BY SI.[Id], SI.[Name], SI.[ActivityStudyItemType]
ORDER BY COUNT(*) DESC;
```

### Data Protection Requirements

**Access Control:**
- **Never allow public access** to this table or queries that join it to Individuals with names
- **Coordinators:** Access to participation data for their cluster only (implement row-level security)
- **Teachers:** Access to participants in activities they lead only
- **Researchers:** Aggregated, anonymized data only with minimum thresholds (≥10 individuals)
- **Database administrators:** Full access with comprehensive audit logging

**Query Restrictions:**
- **NEVER join to Individuals table** with FirstName/FamilyName in SELECT clause unless specifically authorized
- **Always aggregate** when reporting participation statistics
- **Apply minimum thresholds** (≥10 participants) before showing cluster-level data
- **Filter by authorization** - users should only see data for activities/clusters they're authorized for

**Special Protections:**
- **Children's participation** (ActivityType = 0) requires extra protection - never expose which children attend which classes
- **Religious affiliation** (IndividualType) must always be aggregated - never link to names
- **Small activities** (< 5 participants) should not appear in reports that could identify individuals

### Compliance Considerations

**GDPR:**
- Participation records are personal data requiring lawful basis (consent or legitimate interest)
- Individuals have **right to access** their participation records
- Individuals have **right to erasure** - implement through IsCurrent flag and archival
- **Purpose limitation** - use participation data only for coordination and educational planning
- **Data minimization** - only link participation to individuals when necessary for coordination

**CCPA:**
- Right to know what participation data is collected
- Right to delete participation records
- Participation data should not be "sold" or shared with third parties

**Child Protection:**
- Extra safeguards required for children under 13 (COPPA in USA) or 16 (GDPR)
- Parent/guardian consent may be required for tracking children's participation
- Never expose information that could enable identification or contact of specific children

### Privacy Checklist for Participation Queries

Before any query involving ActivityStudyItemIndividuals:
- [ ] Query does NOT join to Individuals with names in results
- [ ] All personal data is aggregated (COUNT, AVG, SUM) with minimum thresholds
- [ ] Small groups (< 10 participants) are suppressed or aggregated further
- [ ] No data linking specific individuals to specific activities without authorization
- [ ] User is authorized to access participation data for this geographic scope
- [ ] Children's participation data has extra protection
- [ ] Religious affiliation (IndividualType) never linked to names
- [ ] Result complies with GDPR, CCPA, COPPA, and institutional privacy policies

### Special Considerations

**Participation Patterns Can Identify Individuals:**
- In small communities, even aggregated data like "2 teachers and 8 participants in Book 5" may identify specific people
- Be especially careful with:
  - Small localities (population < 500)
  - Rare study items (only one activity in entire cluster)
  - High-level roles (coordinator, tutor) in small areas
  - Children's class participation in small villages

**Sensitive Role Information:**
- **IndividualRole** reveals capacity for service and responsibility level
- Listing all tutors in a cluster by name could create social pressure or unwanted attention
- Protect information about who serves in what capacity unless consent obtained for publication

**Religious Affiliation:**
- **IndividualType** field categorizes by religious affiliation (Bahá'í vs. friend of the Faith)
- This is **legally protected sensitive data** under GDPR and many other regulations
- NEVER create reports that link names to religious affiliation
- Always aggregate when analyzing participation by affiliation

**Historical Participation:**
- Past participation records (IsCurrent = 0) are still personal data
- Maintain historical records for reporting trends, but protect individual identities
- Consider data retention policies - how long to keep inactive participation records?

## Notes for Developers

When working with the ActivityStudyItemIndividuals table:
- **NEVER SELECT IndividualId with names** from Individuals table in same query for reporting
- **Always aggregate** participation data for statistical reports
- **Implement row-level security** so users only see data they're authorized for
- **Apply minimum thresholds** (≥10 participants) before showing statistics
- **Filter by IsCurrent = 1** for active participants, or include status in analysis
- **Check ActivityType** - children's activities (Type 0) need extra protection
- **Protect IndividualType** - religious affiliation must never link to names
- **Audit all queries** that access this table, especially those joining to Individuals
- **Consider geographic scope** - cluster-level aggregation is safer than locality-level