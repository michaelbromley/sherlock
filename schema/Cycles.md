# Cycles Table

## Overview
The `Cycles` table is one of the most comprehensive and important tables in the SRP database. It stores statistical snapshots for each cluster during specific time periods (cycles), capturing a complete picture of community activities, educational progress, population demographics, and community life. Each cycle represents a reporting period (typically 3 months) during which the cluster's activities and growth are measured and recorded.

This table is central to tracking the growth and development of the Bahai community over time, enabling trend analysis, strategic planning, and evaluation of community-building efforts.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier for each cycle record |
| **DisplayStartDate** | varchar(20) | NO | Human-readable cycle start date |
| **StartDate** | datetime | NO | Actual cycle start date for system processing |
| **DisplayEndDate** | varchar(20) | NO | Human-readable cycle end date |
| **EndDate** | datetime | NO | Actual cycle end date |
| **FriendsParticipatingInExpansionPhase** | int | YES | Number of individuals active in expansion activities |
| **CompletedBook1** | int | YES | Number who completed Book 1 (Reflections on the Life of the Spirit) |
| **CompletedBook2** | int | YES | Number who completed Book 2 (Arising to Serve) |
| **CompletedBook3G1** | int | YES | Number who completed Book 3 Grade 1 (Teaching Children's Classes) |
| **CompletedBook3G2** | int | YES | Number who completed Book 3 Grade 2 |
| **CompletedBook3G3** | int | YES | Number who completed Book 3 Grade 3 |
| **CompletedBook4** | int | YES | Number who completed Book 4 (The Twin Manifestations) |
| **CompletedBook5** | int | YES | Number who completed Book 5 (Releasing the Powers of Junior Youth) |
| **CompletedBook6** | int | YES | Number who completed Book 6 (Teaching the Cause) |
| **CompletedBook7** | int | YES | Number who completed Book 7 (Walking Together on a Path of Service) |
| **CompletedBook9U1** | int | YES | Number who completed Book 9 Unit 1 (Gaining an Historical Perspective) |
| **CompletedBook9U2** | int | YES | Number who completed Book 9 Unit 2 |
| **IsOverrideCompletedBookData** | bit | NO | Manual override flag for book completion data |
| **DevotionalMeetingsNumber** | int | YES | Count of devotional meetings held |
| **DevotionalMeetingsAttendance** | int | YES | Total attendance at devotional meetings |
| **DevotionalMeetingsFriendsOfFaith** | int | YES | Non-Bahai participants in devotional meetings |
| **IsOverrideDevotionalMeetingsData** | bit | NO | Manual override flag for devotional data |
| **ChildrenClassesNumber** | int | YES | Number of children's classes operating |
| **ChildrenClassesAttendance** | int | YES | Total children attending classes |
| **ChildrenClassesFriendsOfFaith** | int | YES | Non-Bahai children in classes |
| **JuniorYouthGroupsNumber** | int | YES | Number of junior youth groups operating |
| **JuniorYouthGroupsAttendance** | int | YES | Total junior youth participating |
| **JuniorYouthGroupsFriendsOfFaith** | int | YES | Non-Bahai junior youth in groups |
| **IsOverrideJuniorYouthGroupsData** | bit | NO | Manual override flag for junior youth data |
| **StudyCirclesNumber** | int | YES | Number of study circles operating |
| **StudyCirclesAttendance** | int | YES | Total participants in study circles |
| **StudyCirclesFriendsOfFaith** | int | YES | Non-Bahai participants in study circles |
| **IsOverrideStudyCirclesData** | bit | NO | Manual override flag for study circle data |
| **ChildrenAndJuniorYouthRegisteredDuringCycle** | int | YES | New child/junior youth enrollments |
| **YouthAndAdultsEnrolledDuringCycle** | int | YES | New youth/adult enrollments |
| **NewlyEnrolledBelieversInInstituteProcess** | int | YES | New believers who entered institute process |
| **IsOverrideExpansionDuringCycleData** | bit | NO | Manual override flag for expansion data |
| **BahaiChildren** | int | YES | Number of Bahai children (ages 0-11) |
| **BahaiJuniorYouth** | int | YES | Number of Bahai junior youth (ages 12-15) |
| **BahaiYouth** | int | YES | Number of Bahai youth (ages 15-21) |
| **BahaiAdultMen** | int | YES | Number of adult male Bahai believers |
| **BahaiAdultWomen** | int | YES | Number of adult female Bahai believers |
| **TotalBahaiBelievers** | int | YES | Total Bahai population in cluster |
| **IsOverrideBahaiPopulationData** | bit | NO | Manual override flag for population data |
| **HomesVisitedForDeepening** | int | YES | Number of homes visited for spiritual education |
| **LocalitiesInNineteenDayFeastHeld** | int | YES | Number of localities holding Nineteen Day Feast |
| **NineteenDayFeastAttendanceEstimated** | int | YES | Estimated attendance at Feasts |
| **LocalitiesObservedOneOrMoreHolyDays** | int | YES | Localities celebrating Bahai Holy Days |
| **HolyDayAttendanceEstimated** | int | YES | Estimated attendance at Holy Day observances |
| **IsOverrideCommunityDevelopmentData** | bit | NO | Manual override flag for community development data |
| **ClusterId** | bigint | NO | Foreign key to Clusters table |
| **IsCycleDateChanged** | bit | NO | Flag indicating cycle dates were modified |
| **IsLocalityDataChanged** | bit | NO | Flag indicating locality-level data changed |
| **IsRecalculated** | bit | NO | Flag indicating statistics were recalculated |
| **CreatedTimestamp** | datetime | NO | When the record was created |
| **CreatedBy** | uniqueidentifier | NO | User ID who created the record |
| **LastUpdatedTimestamp** | datetime | NO | When the record was last modified |
| **LastUpdatedBy** | uniqueidentifier | NO | User ID who last modified the record |
| **ImportedTimestamp** | datetime | YES | When data was imported from external system |
| **ImportedFrom** | uniqueidentifier | YES | Source system identifier for imported data |
| **ImportedFileType** | varchar(50) | YES | File format of imported data |

## Key Relationships

1. **Clusters** (ClusterId → Clusters.Id)
   - Each cycle record belongs to exactly one cluster
   - Enables tracking of cluster progress over time

## Data Categories

The Cycles table organizes data into several major categories:

### 1. Book Completion Statistics
Tracks progress through the Ruhi Institute curriculum sequence:
- **Books 1-7**: Main sequence of institute courses
- **Book 3**: Has three grades (G1, G2, G3) for children's class teacher training
- **Book 9**: Has two units (U1, U2) for advanced study
- These metrics show educational advancement in the cluster

### 2. Core Activities Statistics
The four core activities of community building:

**Devotional Meetings**
- Gatherings for prayer and spiritual reflection
- Open to all community members
- Tracks number, attendance, and friends of the faith participation

**Children's Classes**
- Spiritual education for ages 5-11
- Tracks number of classes, total attendance, and non-Bahai children

**Junior Youth Groups**
- Empowerment program for ages 12-15
- Tracks groups, participants, and friends of the faith

**Study Circles**
- Adult education programs
- Sequential study of institute materials
- Tracks circles, participants, and friends of the faith

### 3. Expansion Metrics
Growth indicators for the cycle:
- **FriendsParticipatingInExpansionPhase**: Active participants in teaching efforts
- **ChildrenAndJuniorYouthRegisteredDuringCycle**: New young enrollments
- **YouthAndAdultsEnrolledDuringCycle**: New adult enrollments
- **NewlyEnrolledBelieversInInstituteProcess**: New believers entering education process

### 4. Population Demographics
Complete demographic breakdown:
- Age categories: Children, Junior Youth, Youth, Adults
- Gender breakdown: Adult Men and Women
- Total population for reference and calculation

### 5. Community Development Indicators
Measures of community life vitality:
- **HomesVisitedForDeepening**: Home-based spiritual education visits
- **NineteenDayFeastAttendance**: Monthly Bahai community gathering
- **HolyDayObservances**: Celebration of Bahai Holy Days
- Tracks both number of localities and attendance estimates

## Override Mechanism

The table includes six override flags that allow manual correction of calculated data:
1. **IsOverrideCompletedBookData**: Override institute completion statistics
2. **IsOverrideDevotionalMeetingsData**: Override devotional meeting counts
3. **IsOverrideJuniorYouthGroupsData**: Override junior youth statistics
4. **IsOverrideStudyCirclesData**: Override study circle counts
5. **IsOverrideExpansionDuringCycleData**: Override expansion metrics
6. **IsOverrideBahaiPopulationData**: Override population demographics
7. **IsOverrideCommunityDevelopmentData**: Override community life indicators

When an override flag is TRUE, the corresponding data fields were manually entered and should not be recalculated from source data.

## Change Tracking Flags

Three flags track data modifications:
- **IsCycleDateChanged**: Cycle period was adjusted
- **IsLocalityDataChanged**: Underlying locality data was modified
- **IsRecalculated**: Statistics were recomputed from source data

These flags help maintain data integrity and audit trails.

## Common Query Patterns

### Cycle Progression for a Cluster
```sql
SELECT
    [DisplayStartDate],
    [DisplayEndDate],
    [StudyCirclesNumber],
    [JuniorYouthGroupsNumber],
    [ChildrenClassesNumber],
    [DevotionalMeetingsNumber]
FROM [Cycles]
WHERE [ClusterId] = @ClusterId
ORDER BY [StartDate]
```

### Book Completion Trends
```sql
SELECT
    [DisplayStartDate],
    [CompletedBook1],
    [CompletedBook2],
    [CompletedBook3G1],
    [CompletedBook4],
    [CompletedBook5],
    [CompletedBook6],
    [CompletedBook7]
FROM [Cycles]
WHERE [ClusterId] = @ClusterId
ORDER BY [StartDate]
```

### Core Activities Summary
```sql
SELECT
    C.[Name] AS ClusterName,
    CY.[DisplayStartDate],
    CY.[DevotionalMeetingsNumber] + CY.[ChildrenClassesNumber] +
    CY.[JuniorYouthGroupsNumber] + CY.[StudyCirclesNumber] AS [TotalCoreActivities]
FROM [Cycles] CY
INNER JOIN [Clusters] C ON CY.[ClusterId] = C.[Id]
WHERE CY.[StartDate] >= '2024-01-01'
ORDER BY [TotalCoreActivities] DESC
```

### Friends of the Faith Participation
```sql
SELECT
    [DisplayStartDate],
    ([DevotionalMeetingsFriendsOfFaith] +
     [ChildrenClassesFriendsOfFaith] +
     [JuniorYouthGroupsFriendsOfFaith] +
     [StudyCirclesFriendsOfFaith]) AS [TotalFriendsParticipating]
FROM [Cycles]
WHERE [ClusterId] = @ClusterId
ORDER BY [StartDate]
```

### Population Demographics
```sql
SELECT
    [DisplayStartDate],
    [BahaiChildren],
    [BahaiJuniorYouth],
    [BahaiYouth],
    [BahaiAdultMen],
    [BahaiAdultWomen],
    [TotalBahaiBelievers]
FROM [Cycles]
WHERE [ClusterId] = @ClusterId
ORDER BY [StartDate]
```

## Business Rules and Constraints

1. **Date Ranges**: EndDate must be after StartDate
2. **Cluster Assignment**: Every cycle must belong to a cluster
3. **Non-Negative Counts**: All numeric statistics should be ≥ 0
4. **Population Totals**: TotalBahaiBelievers should equal sum of demographic categories
5. **Friends of Faith**: Should not exceed total attendance figures
6. **Book Sequence**: Completions generally follow sequence (most Book 1, fewer Book 7)
7. **Override Consistency**: When override flag is true, corresponding data should be manually verified

## Usage in Reporting

The Cycles table is the primary source for:
- **Quarterly Reports**: Cluster statistics for each reporting period
- **Trend Analysis**: Growth patterns over multiple cycles
- **Regional Aggregation**: Rolling up cluster data to regional level
- **Milestone Assessment**: Evaluating cluster development progress
- **Resource Planning**: Identifying needs based on activity levels

## Notes for Developers

- Always join with Clusters to get cluster name and context
- Respect override flags when calculating aggregates
- Use StartDate for chronological sorting and filtering
- Consider both display and actual dates for user interfaces
- NULL values in statistics indicate data not collected for that cycle
- Check change tracking flags to understand data history
- Population demographics help contextualize activity statistics

## Performance Considerations

- Index on ClusterId for cluster-specific queries
- Index on StartDate for time-based analysis
- Large result sets when querying multiple cycles across regions
- Consider date range limits when running aggregations

## Special Notes

### Data Completeness
Not all cycles will have complete data:
- Early cycles may have limited statistics
- Some metrics introduced in later versions of the system
- NULL values are normal and should be handled gracefully

### Calculation vs. Manual Entry
The system can calculate many statistics from activity and individual records, but override flags allow manual entry when:
- Calculated data is incomplete
- External sources have more accurate information
- Data corrections are needed
- Importing from legacy systems
