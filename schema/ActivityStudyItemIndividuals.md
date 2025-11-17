# ActivityStudyItemIndividuals Table

## Overview
The `ActivityStudyItemIndividuals` table is a critical junction table that creates the many-to-many-to-many relationship between individuals (participants), activities, and study items (curriculum elements). This table tracks who participates in which activities, what role they play, which specific curriculum items they're studying, and their completion status.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each enrollment record

### IndividualType

Category/type of the individual participant

### IndividualRole

Role the individual plays in the activity (see Role Definitions below)

### IsCurrent

Boolean indicating if the individual is currently active in this activity

### IsCompleted

Boolean indicating if the individual has completed the study item

### DisplayEndDate

Human-readable completion/end date for display

### EndDate

Actual completion/end date for the individual's participation

### IndividualId

Foreign key to Individuals table

### ActivityId

Foreign key to Activities table

### StudyItemId

Foreign key to StudyItems table (specific curriculum element)

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

### ActivityStudyItemId

Foreign key to ActivityStudyItems table

## Key Relationships

1. **Individuals** (IndividualId → Individuals.Id)
   - Links to the person participating in the activity
   - Required relationship

2. **Activities** (ActivityId → Activities.Id)
   - Links to the specific activity (class, group, or circle)
   - Can be NULL in some cases

3. **StudyItems** (StudyItemId → StudyItems.Id)
   - Links to the specific curriculum element being studied
   - Can be NULL if tracking general participation

4. **ActivityStudyItems** (ActivityStudyItemId → ActivityStudyItems.Id)
   - Links to the activity-study item combination
   - Provides additional context about the curriculum in the activity

## Individual Roles

Based on usage patterns in the database:

| Role Value | Role Description | Typical Usage | Record Count |
|------------|-----------------|---------------|--------------|
| **7** | Participant | Standard participant/student in the activity | 95,139 |
| **5** | Assistant/Helper | Assists with activity delivery | 12,720 |
| **3** | Tutor/Facilitator | Leads small group discussions | 4,101 |
| **1** | Teacher/Instructor | Primary instructor for the activity | 2,335 |
| **4** | Coordinator | Coordinates multiple activities | 336 |
| **6** | Observer/Visitor | Temporary or observing participant | 321 |
| **2** | Co-Teacher | Secondary instructor role | 180 |

## Individual Types

The `IndividualType` field categorizes participants, likely based on:
- Age group (child, junior youth, youth, adult)
- Registration status (Bahá'í, friend of the Faith)
- Special categories (animator, tutor-in-training)

## Participation Status Tracking

### IsCurrent Flag
- **TRUE**: Individual is actively participating
- **FALSE**: Individual has stopped attending or moved to another activity

### IsCompleted Flag
- **TRUE**: Individual has successfully completed the study item
- **FALSE**: Individual has not yet completed or dropped out

### Date Management
- **DisplayEndDate/EndDate**: When the individual stopped participating or completed
- NULL EndDate with IsCurrent=TRUE indicates ongoing participation

## Common Usage Patterns

### Junior Youth Spiritual Empowerment Program (JYSEP)
```sql
-- Junior youth who entered JYSEP (Role 7 = Participant)
SELECT COUNT(DISTINCT IndividualId)
FROM [ActivityStudyItemIndividuals]
WHERE [IndividualRole] = 7
  AND [ActivityId] IN (
    SELECT [Id] FROM [Activities]
    WHERE [ActivityType] = 1  -- Junior Youth Groups
  )
```

### Tracking Completion Rates
```sql
-- Completion rate by role
SELECT
    [IndividualRole],
    COUNT(*) as Total,
    SUM(CAST([IsCompleted] AS INT)) as Completed,
    CAST(SUM(CAST([IsCompleted] AS INT)) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as CompletionRate
FROM [ActivityStudyItemIndividuals]
WHERE [IsCurrent] = 1
GROUP BY [IndividualRole]
```

### Multiple Roles
An individual can have multiple records in this table, representing:
- Different roles in different activities (teacher in one, participant in another)
- Progression through multiple study items in the same activity
- Historical record of past participations

## Business Logic

### Progression Tracking
Individuals typically progress through study items in sequence:
1. Start as participant (Role 7) in Book 1
2. Complete Book 1 (IsCompleted = TRUE)
3. Move to Book 2 (new record, IsCurrent = TRUE)
4. May become assistant (Role 5) in Book 1 while studying Book 2

### Activity Study Item Relationship
The combination of ActivityId and StudyItemId indicates:
- Which specific book/grade/text is being studied
- In which activity context (which class or group)
- Allows tracking the same curriculum across different activities

## Data Quality Considerations

### Nullable Foreign Keys
- **ActivityId** can be NULL for historical or imported records
- **StudyItemId** can be NULL for general participation tracking
- **ActivityStudyItemId** provides additional linkage when available

### Current vs Historical Records
- Historical participations kept for reporting (IsCurrent = FALSE)
- Multiple records per individual common for progression tracking
- EndDate marks when participation ended or item was completed

## Query Optimization

### Common Filters
```sql
-- Active participants only
WHERE [IsCurrent] = 1 AND [EndDate] IS NULL

-- Completed study items
WHERE [IsCompleted] = 1

-- Specific roles (e.g., participants)
WHERE [IndividualRole] = 7

-- Date range
WHERE [CreatedTimestamp] BETWEEN @StartDate AND @EndDate
```

### Efficient Joins
```sql
-- Get participant details with activity and study item info
SELECT
    I.[FirstName] + ' ' + I.[FamilyName] AS ParticipantName,
    A.[ActivityType],
    SI.[Sequence] AS BookNumber,
    ASI.[IndividualRole],
    ASI.[IsCompleted]
FROM [ActivityStudyItemIndividuals] ASI
INNER JOIN [Individuals] I ON ASI.[IndividualId] = I.[Id]
LEFT JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
LEFT JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
WHERE ASI.[IsCurrent] = 1
```

## Important Notes

1. **Role Changes**: An individual's role can change over time (participant becomes assistant)
2. **Multiple Enrollments**: Same individual can be in multiple activities simultaneously
3. **Completion Tracking**: IsCompleted refers to the study item, not the entire activity
4. **Audit Trail**: All changes tracked through Created/Updated timestamps and user IDs
5. **Import Support**: Fields for tracking data imported from external systems

## Related Tables
- **Individuals**: Personal information about participants
- **Activities**: The classes, groups, or circles
- **StudyItems**: The curriculum elements (books, texts, grades)
- **ActivityStudyItems**: Links activities to their curriculum