# Activities Table

## Overview
The `Activities` table is a central entity in the SRP database that tracks all educational and spiritual activities conducted within the Bahá'í community framework. This includes children's classes, junior youth groups, and study circles. Each activity represents a specific program or class that occurs over a period of time and serves participants at a particular location.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each activity

### ActivityType

Type of activity: 0=Children's Classes, 1=Junior Youth Groups, 2=Study Circles

### DisplayStartDate

Human-readable start date for display purposes (e.g., "October 2024")

### StartDate

Actual start date for system processing and calculations

### DisplayEndDate

Human-readable end date for display purposes

### EndDate

Actual end date; NULL indicates ongoing activity

### Comments

Free-text comments or notes about the activity

### IsCompleted

Boolean flag indicating if the activity has been completed

### HasServiceProjects

Indicates if the activity includes service projects component

### Participants

Total number of participants (can be overridden)

### BahaiParticipants

Number of participants who are Bahá'í believers

### LocalityId

Foreign key to Localities table, identifies where the activity takes place

### SubdivisionId

Foreign key to Subdivisions table for more precise location (neighborhood level)

### IsOverrideParticipantCounts

Flag indicating manual override of calculated participant counts

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

File format of imported data (e.g., "CSV", "Excel")

### GUID

Globally unique identifier for synchronization across systems

### LegacyId

Original ID from legacy system for migration tracking

### InstituteId

External institute system identifier

## Key Relationships

1. **Localities** (LocalityId → Localities.Id)
   - Every activity must be associated with a locality
   - Localities are part of the geographic hierarchy (Locality → Cluster → Region)

2. **Subdivisions** (SubdivisionId → Subdivisions.Id)
   - Optional more specific location within a locality
   - Used for neighborhood-level tracking

3. **ActivityStudyItems** (One-to-Many)
   - Links activities to specific study items or curriculum elements
   - Tracks which books/materials are being studied

4. **ActivityStudyItemIndividuals** (Through ActivityStudyItems)
   - Links individual participants to activities
   - Tracks roles (facilitator, participant, etc.)

## Activity Types Explained

### Type 0: Children's Classes
- Educational programs for children (typically ages 5-11)
- Focus on spiritual education, moral concepts, and character development
- Often organized in grades (Grade 1, Grade 2, etc.)

### Type 1: Junior Youth Groups
- Programs for pre-teens and early teens (typically ages 12-15)
- Focus on moral and intellectual empowerment
- Study specific texts designed for this age group

### Type 2: Study Circles
- Adult education programs
- Study of sequence of books (Ruhi Institute curriculum)
- Most common activity type in the database (4,837 records vs 586 and 600)

## Date Management Pattern
The dual date storage system provides flexibility:
- **Display dates**: Human-friendly format for reports and user interfaces
- **Actual dates**: Precise datetime for calculations and queries
- Supports partial or estimated dates in display format

## Participant Tracking
- **Participants**: Total count including all participants
- **BahaiParticipants**: Subset who are registered Bahá'í believers
- **IsOverrideParticipantCounts**: Allows manual correction when automated counts are incorrect
- Detailed participant information stored in ActivityStudyItemIndividuals table

## Service Projects
The **HasServiceProjects** flag indicates activities that include a service component, where participants engage in community service as part of their learning experience. This is particularly common in junior youth groups and later books of the study circle sequence.

## Data Import and Migration
Multiple fields support data integration:
- **ImportedTimestamp**, **ImportedFrom**, **ImportedFileType**: Track data imports
- **GUID**: Enables synchronization across distributed systems
- **LegacyId**: Preserves reference to original system during migration
- **InstituteId**: Links to external institute management systems

## Common Query Patterns

### Active Activities by Type
```sql
SELECT
    [ActivityType],
    COUNT(*) as [Count]
FROM [Activities]
WHERE [IsCompleted] = 0
    AND ([EndDate] IS NULL OR [EndDate] > GETDATE())
GROUP BY [ActivityType]
```

### Activities in a Specific Cluster
```sql
SELECT
    A.*,
    L.[Name] AS LocalityName
FROM [Activities] A
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE C.[Id] = @ClusterId
ORDER BY A.[StartDate] DESC
```

### Activities with Service Projects
```sql
SELECT
    [ActivityType],
    COUNT(*) as [TotalActivities],
    SUM(CAST([HasServiceProjects] AS INT)) as [WithServiceProjects]
FROM [Activities]
WHERE [StartDate] >= '2024-01-01'
GROUP BY [ActivityType]
```

## Business Rules and Constraints

1. **Required Location**: Every activity must have a LocalityId
2. **Date Logic**: EndDate must be after StartDate when both are provided
3. **Completion Status**: IsCompleted should align with EndDate presence
4. **Participant Counts**: BahaiParticipants should not exceed total Participants
5. **Activity Type Validation**: ActivityType must be 0, 1, or 2

## Notes for Developers

- Always filter by IsCompleted when looking for active activities
- Consider both display and actual dates when presenting information
- Join with LocalizedStudyItems for multi-language support
- Use ActivityStudyItemIndividuals for detailed participant analysis
- Respect override flags when calculating aggregate statistics