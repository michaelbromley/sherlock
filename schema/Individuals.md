# Individuals Table

## Overview
The `Individuals` table is the central entity for tracking all people involved in the Bahai community's educational and community-building activities. This includes Bahai believers, friends of the faith, children, junior youth, youth, and adults participating in various activities. The table stores comprehensive personal information, registration status, demographic data, and geographic assignment. It supports the tracking of individual progress through the institute process and participation in core activities.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier for each individual |
| **FirstName** | nvarchar(255) | NO | Given name(s) of the individual |
| **FamilyName** | nvarchar(255) | NO | Surname or family name |
| **Gender** | varchar(1) | YES | Gender: 'M' (Male), 'F' (Female) |
| **BirthYear** | int | YES | Year of birth (YYYY format) |
| **IsBirthYearEstimated** | bit | NO | Flag indicating if birth year is estimated vs. exact |
| **IsBahai** | bit | NO | Indicates if person is a registered Bahai believer |
| **BahaiRegistrationDate** | datetime | YES | Date when person enrolled as a Bahai |
| **DisplayBahaiRegistrationDate** | varchar(20) | YES | Human-readable registration date |
| **IsArchived** | bit | NO | Flag indicating if record is archived (inactive) |
| **ArchivedTimestamp** | datetime | YES | When the record was archived |
| **ArchivedBy** | uniqueidentifier | YES | User ID who archived the record |
| **Comments** | nvarchar(max) | YES | Free-text notes about the individual |
| **LocalityId** | bigint | NO | Foreign key to Localities table (residence) |
| **SubdivisionId** | bigint | YES | Foreign key to Subdivisions table (neighborhood) |
| **CreatedTimestamp** | datetime | NO | When the record was created |
| **CreatedBy** | uniqueidentifier | NO | User ID who created the record |
| **LastUpdatedTimestamp** | datetime | NO | When the record was last modified |
| **LastUpdatedBy** | uniqueidentifier | NO | User ID who last modified the record |
| **ImportedTimestamp** | datetime | YES | When data was imported from external system |
| **ImportedFrom** | uniqueidentifier | YES | Source system identifier for imported data |
| **ImportedFileType** | varchar(50) | YES | File format of imported data |
| **GUID** | uniqueidentifier | NO | Globally unique identifier for synchronization |
| **LegacyId** | nvarchar(255) | YES | Original ID from legacy system |
| **InstituteId** | nvarchar(50) | YES | External institute system identifier |
| **WasLegacyRecord** | bit | YES | Flag indicating record was migrated from legacy system |

## Key Relationships

1. **Localities** (LocalityId → Localities.Id)
   - Every individual must be assigned to a locality
   - Primary residence assignment
   - Used for geographic reporting and analysis

2. **Subdivisions** (SubdivisionId → Subdivisions.Id)
   - Optional more precise location within locality
   - Used in urban areas for neighborhood-level tracking
   - May be NULL for most individuals

3. **ActivityStudyItemIndividuals** (One-to-Many)
   - Links individuals to their activity participation
   - Tracks roles (facilitator, participant, etc.)
   - Records study item completion status
   - Primary relationship for tracking educational progress

4. **IndividualEmails** (One-to-Many)
   - Stores email addresses for the individual
   - Supports multiple emails per person
   - Flags primary email address

5. **IndividualPhones** (One-to-Many)
   - Stores phone numbers for the individual
   - Supports multiple phones per person
   - Different phone types (mobile, home, work)

## Personal Information

### Name Fields
- **FirstName**: Given name(s), may include middle names
- **FamilyName**: Surname, last name, family name
- Together form the individual's full name
- Stored in local script/language

### Demographic Data
- **Gender**: Male (M) or Female (F)
  - Used for statistical reporting
  - Age-gender breakdowns in Cycles table
  - May be NULL if not provided

- **BirthYear**: Year of birth
  - Enables age calculation and cohort analysis
  - Used for determining children/junior youth/youth/adult categories
  - May be NULL if unknown

- **IsBirthYearEstimated**: Indicates approximate age
  - TRUE when exact birth year unknown
  - Common in areas without birth records
  - Allows participation even without precise age

## Bahai Registration Status

### IsBahai Flag
- **TRUE**: Person is a registered Bahai believer
  - Counted in Bahai population statistics
  - Eligible for Bahai administrative functions
  - Included in community census

- **FALSE**: Friend of the faith or participant
  - Participating in activities but not enrolled
  - Counted separately in "friends of faith" metrics
  - May be children of Bahai parents or community participants

### Registration Date
- **BahaiRegistrationDate**: Actual date of enrollment
- **DisplayBahaiRegistrationDate**: Human-readable format
- Dual date pattern allows flexibility
- Important for tracking new believers
- Used in expansion statistics

## Archival System

### IsArchived Flag
- **FALSE**: Active record, current participant
  - Included in standard queries and reports
  - Counted in population statistics
  - Available for activity assignment

- **TRUE**: Archived record, inactive
  - Excluded from standard reports
  - Historical record preserved
  - Not counted in current statistics

### Archival Tracking
- **ArchivedTimestamp**: When record was archived
- **ArchivedBy**: User who performed archival
- Enables audit trail and potential restoration
- Reasons for archival:
  - Individual moved away
  - Passed away
  - No longer participating
  - Data quality issues (duplicates)

## Geographic Assignment

### Location Hierarchy
- **LocalityId**: Required, primary residence
- **SubdivisionId**: Optional, neighborhood detail
- Determines which cluster's statistics include this individual
- Used for:
  - Population demographics
  - Activity proximity
  - Communication and outreach
  - Administrative boundaries

## Age Categories

Based on BirthYear, individuals fall into categories:
- **Children** (0-11 years): Eligible for children's classes
- **Junior Youth** (12-15 years): Eligible for junior youth groups
- **Youth** (15-21 years): Youth activities and institute courses
- **Adults** (21+ years): Full participation in all activities

These categories are calculated dynamically based on current date and birth year.

## Common Query Patterns

### Active Individuals in a Locality
```sql
SELECT
    [FirstName],
    [FamilyName],
    [Gender],
    [BirthYear],
    [IsBahai]
FROM [Individuals]
WHERE [LocalityId] = @LocalityId
    AND [IsArchived] = 0
ORDER BY [FamilyName], [FirstName]
```

### Age Distribution
```sql
SELECT
    CASE
        WHEN YEAR(GETDATE()) - [BirthYear] < 12 THEN 'Children'
        WHEN YEAR(GETDATE()) - [BirthYear] BETWEEN 12 AND 14 THEN 'Junior Youth'
        WHEN YEAR(GETDATE()) - [BirthYear] BETWEEN 15 AND 20 THEN 'Youth'
        ELSE 'Adults'
    END AS AgeCategory,
    COUNT(*) AS IndividualCount
FROM [Individuals]
WHERE [IsArchived] = 0
    AND [BirthYear] IS NOT NULL
GROUP BY
    CASE
        WHEN YEAR(GETDATE()) - [BirthYear] < 12 THEN 'Children'
        WHEN YEAR(GETDATE()) - [BirthYear] BETWEEN 12 AND 14 THEN 'Junior Youth'
        WHEN YEAR(GETDATE()) - [BirthYear] BETWEEN 15 AND 20 THEN 'Youth'
        ELSE 'Adults'
    END
```

### Bahai Population by Cluster
```sql
SELECT
    C.[Name] AS ClusterName,
    COUNT(I.[Id]) AS TotalIndividuals,
    SUM(CASE WHEN I.[IsBahai] = 1 THEN 1 ELSE 0 END) AS BahaiCount,
    SUM(CASE WHEN I.[IsBahai] = 0 THEN 1 ELSE 0 END) AS FriendsOfFaith
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[IsArchived] = 0
GROUP BY C.[Id], C.[Name]
ORDER BY BahaiCount DESC
```

### Recent Enrollments
```sql
SELECT
    [FirstName],
    [FamilyName],
    [DisplayBahaiRegistrationDate],
    [BahaiRegistrationDate],
    L.[Name] AS Locality
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
WHERE I.[IsBahai] = 1
    AND I.[IsArchived] = 0
    AND I.[BahaiRegistrationDate] >= DATEADD(YEAR, -1, GETDATE())
ORDER BY I.[BahaiRegistrationDate] DESC
```

### Individual Activity Participation
```sql
SELECT
    I.[FirstName] + ' ' + I.[FamilyName] AS FullName,
    COUNT(DISTINCT ASII.[ActivityId]) AS ActivitiesCount,
    COUNT(DISTINCT ASII.[StudyItemId]) AS StudyItemsCount
FROM [Individuals] I
INNER JOIN [ActivityStudyItemIndividuals] ASII ON I.[Id] = ASII.[IndividualId]
WHERE I.[IsArchived] = 0
    AND ASII.[IsCurrent] = 1
GROUP BY I.[Id], I.[FirstName], I.[FamilyName]
ORDER BY ActivitiesCount DESC
```

### Full Contact Information
```sql
SELECT
    I.[FirstName],
    I.[FamilyName],
    IE.[Email] AS EmailAddress,
    IP.[PhoneNumber],
    L.[Name] AS Locality,
    S.[Name] AS Subdivision
FROM [Individuals] I
LEFT JOIN [IndividualEmails] IE ON I.[Id] = IE.[IndividualId] AND IE.[IsPrimary] = 1
LEFT JOIN [IndividualPhones] IP ON I.[Id] = IP.[IndividualId] AND IP.[IsPrimary] = 1
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
LEFT JOIN [Subdivisions] S ON I.[SubdivisionId] = S.[Id]
WHERE I.[Id] = @IndividualId
```

## Business Rules and Constraints

1. **Required Fields**: FirstName, FamilyName, LocalityId must be provided
2. **Archival Logic**: Archived individuals excluded from active queries
3. **Age Validation**: BirthYear should be reasonable (not future, not too old)
4. **Registration Date**: Should not precede BirthYear + reasonable age (e.g., 15)
5. **Gender**: Should be 'M' or 'F' when provided
6. **IsBahai Consistency**: If TRUE, should have registration date
7. **Unique Individuals**: Avoid duplicates (same name, birth year, locality)

## Data Quality Considerations

### Duplicate Prevention
- Check for existing individuals before creating
- Compare FirstName, FamilyName, BirthYear, LocalityId
- Use GUID for synchronization across systems
- LegacyId tracks migrated records

### Data Completeness
- Core fields (name, locality) required
- Demographic data (gender, birth year) strongly encouraged
- Contact information (emails, phones) in separate tables
- Comments field for special circumstances

### Privacy and Security
- Personal information requires protection
- Access controls on individual data
- Archival instead of deletion preserves history
- GUID enables secure synchronization

## Import and Migration

### Legacy System Support
- **LegacyId**: Original system identifier
- **WasLegacyRecord**: Flags migrated records
- **ImportedFrom**: Source system tracking
- **ImportedFileType**: Data format (CSV, Excel, etc.)
- **ImportedTimestamp**: When imported

### Synchronization
- **GUID**: Global unique identifier
- Enables multi-site deployments
- Mobile app synchronization
- Backup and restore operations

## Usage in Reporting

Individuals table feeds many reports:
- **Population Demographics**: Age/gender breakdowns
- **Growth Tracking**: New enrollments over time
- **Participation Analysis**: Activity involvement
- **Geographic Distribution**: Population by locality/cluster
- **Institute Progress**: Course completions
- **Community Development**: Active participants

## Performance Considerations

### Indexing Recommendations
- LocalityId (frequent joins and filters)
- IsArchived (exclude from most queries)
- IsBahai (filtering believers vs. friends)
- BirthYear (age calculations)
- GUID (synchronization lookups)

### Query Optimization
- Always filter IsArchived = 0 for active records
- Index on (LocalityId, IsArchived, IsBahai) for common queries
- Consider materialized views for complex age calculations
- Cache locality lists for filtering

## Notes for Developers

- **ALWAYS** filter IsArchived = 0 unless specifically querying archived records
- Join with Localities to get cluster context
- Use LEFT JOIN for Subdivisions (commonly NULL)
- Calculate age dynamically from BirthYear
- Handle NULL BirthYear gracefully in age calculations
- Contact information in separate tables (one-to-many)
- Respect privacy - limit data exposure in APIs/reports

## Special Considerations

### Children and Parents
- System doesn't explicitly track family relationships
- Children often tracked through parents' activities
- Parent contact information typically used for children
- Age-appropriate activity assignment

### Data Retention
- Archive instead of delete to preserve history
- Archival is reversible if needed
- Historical participation records maintained
- Statistical integrity preserved

### Cultural Sensitivity
- Name formats vary by culture
- Single name field may not suit all cultures
- Gender may be culturally sensitive in some contexts
- Age information may not be available in all regions
