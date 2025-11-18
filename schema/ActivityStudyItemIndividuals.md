# ActivityStudyItemIndividuals Table

## Overview

The `ActivityStudyItemIndividuals` table represents the heart of participant tracking within the SRP database, serving as the critical junction point that connects individuals with their educational journey through the institute process. This table captures the complex, multifaceted relationships between people, the activities they participate in, the curriculum they study, and the roles they play in the community-building process. Each record in this table tells a story of an individual's engagement with a specific aspect of the educational framework - whether as a student progressing through the Ruhi sequence, a tutor facilitating others' learning, a junior youth exploring concepts of moral empowerment, or a child learning spiritual principles through age-appropriate activities.

This table goes beyond simple enrollment tracking to capture the dynamic nature of participation in Bahá'í educational activities. It recognizes that individuals often wear multiple hats - someone might be a participant in one study circle while simultaneously serving as a children's class teacher in another activity. The same person might be completing Book 7 to become a tutor while also assisting with a junior youth group. This complexity is essential to understanding the organic growth of human resources within communities, where capacity building is not linear but rather a rich tapestry of simultaneous learning and service experiences.

The design of this table also reflects the principle that education within the Bahá'í framework is not merely about knowledge acquisition but about transformation and service. By tracking not just participation but also roles, completion status, and progression through materials, the table enables communities to understand how individuals are developing their capacities and contributing to the growth of their communities.

## Table Structure

### Id (bigint, NOT NULL, PRIMARY KEY)

The primary key serving as the unique identifier for each individual participation record within the educational tracking system. This auto-incrementing bigint field ensures that every discrete instance of an individual's engagement with an educational activity is distinctly tracked and can be uniquely referenced throughout the database's complex web of relationships. The Id is particularly important and meaningful because a single individual might accumulate dozens or even hundreds of records in this table over their lifetime of engagement with the community's educational system, with each record representing a specific chapter in their journey - progressing through various books of the Ruhi sequence, serving in different teaching and facilitation capacities, participating in multiple concurrent activities, or re-engaging with materials in new contexts.

Each Id captures not just a static snapshot but a specific moment or phase in someone's educational and service path. For example, Individual #1523 might have record Id #8847 representing their participation as a student in Book 1 in 2015, Id #12901 showing their completion of Book 3 and transition to children's class teacher in 2016, Id #19445 documenting their simultaneous participation as a student in Book 7 while teaching children's classes in 2018, and Id #24673 marking their emergence as a tutor facilitating Book 1 study circles in 2020. This granular tracking enables the system to construct complete educational biographies, understand capacity development trajectories, and identify patterns in how individuals progress from learning to service across the community. The Id field's role as primary key also makes it the foundation for any future expansions of the schema that might need to reference specific participation instances, such as detailed assessment records or service project tracking linked to particular study circle participations.

### IndividualType (tinyint, NULL)

This tinyint field categorizes participants into distinct types that reflect their demographic characteristics, spiritual affiliation, or functional classification within the community structure. The typing system is fundamental to understanding the composition of educational activities and tracking the progress and engagement of different population segments. While nullable in the schema (allowing NULL values), this field when populated provides critical information for demographic analysis, measuring community reach, and ensuring educational programs serve diverse populations appropriately.

The type categories commonly used across SRP implementations typically include: Type 1 for Adult Bahá'í believers (ages 15 and above), representing enrolled members of the Faith who are engaging in the institute process to deepen their understanding and develop capacity for service; Type 2 for Bahá'í youth (ages roughly 15-30), sometimes tracked separately from general adults to understand youth engagement patterns and specific youth-focused initiatives; Type 3 for Bahá'í junior youth (ages 12-14), representing young Bahá'ís in this critical developmental period who participate in the junior youth spiritual empowerment program; Type 4 for Bahá'í children (ages 5-11), representing younger members of the community enrolled in children's spiritual education classes; Type 5 for Friends of the Faith or non-Bahá'í participants of any age, representing the crucial population of interested neighbors, seekers, and community members who participate in educational activities without formal membership in the Faith; Type 6 for Seekers or those actively investigating the Faith, sometimes distinguished from general friends to track those on a specific journey toward potential enrollment; and Type 7 for Special categories such as visiting participants from other communities, temporary participants, or other classifications that don't fit standard categories.

This categorization serves multiple crucial purposes in the educational tracking system. It enables understanding community demographics and the composition of educational activities, revealing whether study circles are predominantly attended by Bahá'ís or include significant participation from the wider community. It supports measuring the reach of core activities beyond the enrolled Bahá'í community, which is essential for understanding the inclusive nature of community life and the extent to which educational programs serve as vehicles for broader social engagement. The field helps ensure age-appropriate educational experiences by distinguishing children from junior youth from adults, each of whom require developmentally appropriate curriculum and pedagogical approaches. It generates vital statistics about community integration and the inclusive nature of core activities, tracking whether educational programs primarily serve an insular community or genuinely engage the broader population in processes of spiritual and moral education.

### IndividualRole (tinyint, NULL)

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

### IsCurrent (bit, NULL)

A boolean bit flag indicating whether the individual's participation in this particular activity-study item combination is currently active and ongoing, serving as the critical temporal filter that distinguishes between live,ongoing engagements versus historical records preserved for institutional memory and analysis. While nullable in the schema design (allowing NULL values for uncertain status), this field when set to TRUE or FALSE is essential for accurately understanding who is presently involved in educational activities versus who participated in the past.

When IsCurrent is TRUE, it signals that the individual is actively involved in this specific capacity at this moment in time - they are attending sessions regularly, progressively engaging with the curriculum materials, or actively fulfilling their role responsibilities whether as participant, teacher, tutor, or assistant. Current participants (IsCurrent=TRUE) are included in all active statistics used for planning and coordination, appear in ongoing activity participant counts distributed to coordinators, and represent the live engagement that coordinators work with directly in their clusters and localities. This TRUE status might persist for weeks, months, or even years depending on the nature of the activity - a children's class teacher might remain current for multiple years of continuous service, while a study circle participant's current status might span the 3-6 months typically needed to complete a single Ruhi book.

When IsCurrent is FALSE, it represents historical participation - documenting that the person previously engaged but has since moved on (completing the book and moving to the next one), completed their involvement (finishing their teaching commitment for a season), discontinued for any reason (moving away, life circumstances changing, or choosing to pause their participation), or transitioned to a different role or activity. These historical records are not discarded but carefully preserved to maintain a complete educational history for each individual, enable accurate calculation of completion rates and attrition patterns over time, support longitudinal studies of participation trends, and provide the full context needed to understand an individual's journey through the institute process. The IsCurrent flag's design allows the same individual to have multiple records for the same study item (perhaps attempting Book 5 multiple times across different years) while clearly identifying which record represents their current engagement status.

### IsCompleted (bit, NULL)

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

### DisplayEndDate (varchar(20), NOT NULL)

A human-readable, user-facing representation of when the individual's participation ended or when they completed the study item, stored as a varchar(20) field that provides the flexibility needed to capture how communities actually communicate about participation timelines rather than forcing strict computational date formats. This field serves the crucial bridge between the database's need for precision (served by the EndDate datetime field) and human communication patterns that often work with approximate or contextual timeframes.

The field's varchar design allows it to contain various forms of temporal expression that reflect real-world data collection scenarios: exact dates like "2018-07-20" when participation concluded on a precisely documented day, month indicators such as "July 2018" when the month is known but the specific day wasn't recorded or remembered, approximate periods like "Summer 2018" or "End of 2017" for less precise records where general timing is known, or contextual markers such as "End of cycle" or "Before move" that provide meaningful reference points even without specific dates. This flexibility acknowledges that educational participation doesn't always conclude on neat calendar boundaries - a participant might gradually fade from attendance, or a teacher might complete their commitment "at the end of the school year" without a specific final date.

The 20-character limit provides sufficient space for most human-readable date representations (accommodating formats like "September 15, 2018") while maintaining reasonable database constraints that prevent the field from being misused for extensive narrative text. The NOT NULL constraint reflects that every participation record should have some indication of its end timing, even if approximate or still ongoing.

### EndDate (datetime, NOT NULL)

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