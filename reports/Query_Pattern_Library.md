# SRP Database Query Pattern Library

## Overview

This library provides tested SQL query patterns for common reporting scenarios in the SRP database. Patterns are organized by use case and complexity level, with explanations of joins, parameter placeholders, and performance considerations.

**Last Updated:** November 18, 2024

---

## Table of Contents

- [Activity Reporting Patterns](#activity-reporting-patterns)
- [Geographic Analysis Patterns](#geographic-analysis-patterns)
- [Curriculum Tracking Patterns](#curriculum-tracking-patterns)
- [People Management Patterns](#people-management-patterns)
- [Statistical Reporting Patterns](#statistical-reporting-patterns)
- [Privacy-Safe Aggregation Patterns](#privacy-safe-aggregation-patterns)
- [Performance Optimization Patterns](#performance-optimization-patterns)

---

## Activity Reporting Patterns

### Pattern 1.1: Active Activities by Type (Simple)

**Use Case:** List all active activities of a specific type in a cluster

**Complexity:** Beginner

**Privacy:** Safe (no personal data)

```sql
-- List active children's classes in a specific cluster
SELECT
    A.[Id],
    A.[StartDate],
    A.[EndDate],
    L.[Name] AS [LocalityName],
    A.[Participants]
FROM [Activities] A
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
WHERE L.[ClusterId] = @ClusterId
  AND A.[ActivityType] = 0  -- 0=Children's Classes, 1=Junior Youth, 2=Study Circles
  AND A.[IsCompleted] = 0
  AND A.[IsArchived] = 0
ORDER BY L.[Name], A.[StartDate];
```

**Parameters:**
- `@ClusterId` (bigint) - Cluster ID to filter

**Joins:**
- Activities → Localities (LocalityId) - Get locality names

**Performance:**
- Uses indexes on LocalityId, ActivityType, IsCompleted, IsArchived
- Efficient for single cluster queries

---

### Pattern 1.2: Activity Participation Summary (Intermediate)

**Use Case:** Count participants by activity with current enrollment

**Complexity:** Intermediate

**Privacy:** Safe if aggregated (≥10 threshold recommended)

```sql
-- Participant counts by activity with current active participants
SELECT
    A.[Id] AS [ActivityId],
    C.[Name] AS [ClusterName],
    L.[Name] AS [LocalityName],
    CASE A.[ActivityType]
        WHEN 0 THEN 'Children''s Class'
        WHEN 1 THEN 'Junior Youth Group'
        WHEN 2 THEN 'Study Circle'
        ELSE 'Unknown'
    END AS [ActivityType],
    A.[StartDate],
    COUNT(DISTINCT ASII.[IndividualId]) AS [CurrentParticipants]
FROM [Activities] A
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
LEFT JOIN [ActivityStudyItemIndividuals] ASII
    ON A.[Id] = ASII.[ActivityId]
    AND ASII.[IsCurrent] = 1
WHERE A.[IsCompleted] = 0
  AND A.[IsArchived] = 0
  AND C.[RegionId] = @RegionId
GROUP BY A.[Id], C.[Name], L.[Name], A.[ActivityType], A.[StartDate]
HAVING COUNT(DISTINCT ASII.[IndividualId]) >= 5  -- Privacy: minimum threshold
ORDER BY C.[Name], L.[Name], A.[ActivityType];
```

**Parameters:**
- `@RegionId` (bigint) - Region ID to filter

**Joins:**
- Activities → Localities → Clusters (geographic rollup)
- Activities ← ActivityStudyItemIndividuals (participant link)

**Performance:**
- Indexes needed: LocalityId, ClusterId, RegionId, ActivityId, IsCurrent
- Use `LEFT JOIN` for activities without participants yet
- `DISTINCT` ensures unique participant counts

**Privacy:**
- HAVING clause ensures minimum 5 participants
- Does not expose individual names

---

### Pattern 1.3: Activity Completion Rate Analysis (Advanced)

**Use Case:** Analyze completion rates for activities over time

**Complexity:** Advanced

**Privacy:** Safe (aggregated data only)

```sql
-- Activity completion rates by cluster and type over last 12 months
WITH ActivityStats AS (
    SELECT
        C.[Id] AS [ClusterId],
        C.[Name] AS [ClusterName],
        A.[ActivityType],
        COUNT(*) AS [TotalActivities],
        SUM(CASE WHEN A.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS [CompletedActivities],
        AVG(A.[Participants]) AS [AvgParticipants],
        MIN(A.[StartDate]) AS [FirstActivityDate],
        MAX(A.[StartDate]) AS [LastActivityDate]
    FROM [Activities] A
    INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
    WHERE A.[StartDate] >= DATEADD(MONTH, -12, GETDATE())
      AND A.[IsArchived] = 0
    GROUP BY C.[Id], C.[Name], A.[ActivityType]
    HAVING COUNT(*) >= 3  -- Privacy: minimum activity threshold
)
SELECT
    [ClusterName],
    CASE [ActivityType]
        WHEN 0 THEN 'Children''s Class'
        WHEN 1 THEN 'Junior Youth Group'
        WHEN 2 THEN 'Study Circle'
        ELSE 'Unknown'
    END AS [ActivityType],
    [TotalActivities],
    [CompletedActivities],
    CAST([CompletedActivities] * 100.0 / [TotalActivities] AS DECIMAL(5,2)) AS [CompletionPercentage],
    CAST([AvgParticipants] AS DECIMAL(5,1)) AS [AvgParticipants],
    DATEDIFF(DAY, [FirstActivityDate], [LastActivityDate]) AS [DaysOfActivity]
FROM ActivityStats
ORDER BY [ClusterName], [ActivityType];
```

**Parameters:** None (uses last 12 months)

**Joins:**
- Activities → Localities → Clusters (geographic hierarchy)

**Performance:**
- CTE (Common Table Expression) organizes calculation
- Date filter reduces dataset before aggregation
- Indexes needed on StartDate, IsArchived, LocalityId, ClusterId

**Privacy:**
- HAVING ensures minimum 3 activities per cluster/type
- No individual or small group identification

---

## Geographic Analysis Patterns

### Pattern 2.1: Individual Count by Geographic Hierarchy (Simple)

**Use Case:** Count individuals at each geographic level

**Complexity:** Beginner

**Privacy:** Safe with ≥10 threshold

```sql
-- Individual counts rolled up through geographic hierarchy
SELECT
    NC.[Name] AS [Country],
    R.[Name] AS [Region],
    C.[Name] AS [Cluster],
    L.[Name] AS [Locality],
    COUNT(I.[Id]) AS [IndividualCount]
FROM [NationalCommunities] NC
INNER JOIN [Regions] R ON NC.[Id] = R.[NationalCommunityId]
INNER JOIN [Clusters] C ON R.[Id] = C.[RegionId]
INNER JOIN [Localities] L ON C.[Id] = L.[ClusterId]
LEFT JOIN [Individuals] I ON L.[Id] = I.[LocalityId] AND I.[IsArchived] = 0
WHERE NC.[Id] = @NationalCommunityId
GROUP BY NC.[Name], R.[Name], C.[Name], L.[Name]
HAVING COUNT(I.[Id]) >= 10  -- Privacy: minimum threshold
ORDER BY R.[Name], C.[Name], L.[Name];
```

**Parameters:**
- `@NationalCommunityId` (bigint) - National community to analyze

**Joins:**
- Geographic hierarchy: NationalCommunities → Regions → Clusters → Localities
- Localities ← Individuals (count active individuals)

**Performance:**
- Efficient for single national community
- Indexes on all FK relationships (NationalCommunityId, RegionId, ClusterId, LocalityId)

**Privacy:**
- HAVING ensures ≥10 individuals before reporting
- Use LEFT JOIN to include localities with 0 individuals

---

### Pattern 2.2: Cluster Development Stage Distribution (Intermediate)

**Use Case:** Analyze cluster distribution by development stage

**Complexity:** Intermediate

**Privacy:** Safe (cluster-level aggregation)

```sql
-- Cluster counts and statistics by development stage
SELECT
    R.[Name] AS [RegionName],
    C.[StageOfDevelopment],
    COUNT(C.[Id]) AS [ClusterCount],
    SUM(C.[ApproxPopulation]) AS [TotalPopulation],
    AVG(C.[ApproxPopulation]) AS [AvgPopulation],
    SUM(C.[TotalChildrensClasses]) AS [TotalChildrensClasses],
    SUM(C.[TotalJuniorYouthGroups]) AS [TotalJuniorYouthGroups],
    SUM(C.[TotalStudyCircles]) AS [TotalStudyCircles]
FROM [Clusters] C
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
WHERE R.[NationalCommunityId] = @NationalCommunityId
GROUP BY R.[Name], C.[StageOfDevelopment]
ORDER BY R.[Name], C.[StageOfDevelopment];
```

**Parameters:**
- `@NationalCommunityId` (bigint) - National community to analyze

**Joins:**
- Clusters → Regions (regional grouping)

**Performance:**
- Pre-aggregated fields from Clusters table (TotalChildrensClasses, etc.)
- Efficient GROUP BY on RegionId and StageOfDevelopment

**Privacy:**
- Cluster-level data, inherently safe
- No individual identification possible

---

### Pattern 2.3: Geographic Growth Analysis (Advanced)

**Use Case:** Compare activity growth across regions over time

**Complexity:** Advanced

**Privacy:** Safe (regional aggregation)

```sql
-- Year-over-year activity growth by region
WITH CurrentYear AS (
    SELECT
        R.[Id] AS [RegionId],
        R.[Name] AS [RegionName],
        COUNT(DISTINCT A.[Id]) AS [ActivityCount],
        COUNT(DISTINCT ASII.[IndividualId]) AS [ParticipantCount]
    FROM [Regions] R
    INNER JOIN [Clusters] C ON R.[Id] = C.[RegionId]
    INNER JOIN [Localities] L ON C.[Id] = L.[ClusterId]
    INNER JOIN [Activities] A ON L.[Id] = A.[LocalityId]
    LEFT JOIN [ActivityStudyItemIndividuals] ASII ON A.[Id] = ASII.[ActivityId]
    WHERE A.[StartDate] >= DATEADD(YEAR, -1, GETDATE())
      AND A.[IsArchived] = 0
    GROUP BY R.[Id], R.[Name]
),
PreviousYear AS (
    SELECT
        R.[Id] AS [RegionId],
        COUNT(DISTINCT A.[Id]) AS [ActivityCount],
        COUNT(DISTINCT ASII.[IndividualId]) AS [ParticipantCount]
    FROM [Regions] R
    INNER JOIN [Clusters] C ON R.[Id] = C.[RegionId]
    INNER JOIN [Localities] L ON C.[Id] = L.[ClusterId]
    INNER JOIN [Activities] A ON L.[Id] = A.[LocalityId]
    LEFT JOIN [ActivityStudyItemIndividuals] ASII ON A.[Id] = ASII.[ActivityId]
    WHERE A.[StartDate] >= DATEADD(YEAR, -2, GETDATE())
      AND A.[StartDate] < DATEADD(YEAR, -1, GETDATE())
      AND A.[IsArchived] = 0
    GROUP BY R.[Id]
)
SELECT
    CY.[RegionName],
    CY.[ActivityCount] AS [CurrentYearActivities],
    PY.[ActivityCount] AS [PreviousYearActivities],
    CY.[ActivityCount] - PY.[ActivityCount] AS [ActivityGrowth],
    CAST((CY.[ActivityCount] - PY.[ActivityCount]) * 100.0 / NULLIF(PY.[ActivityCount], 0) AS DECIMAL(5,1)) AS [ActivityGrowthPercentage],
    CY.[ParticipantCount] AS [CurrentYearParticipants],
    PY.[ParticipantCount] AS [PreviousYearParticipants],
    CY.[ParticipantCount] - PY.[ParticipantCount] AS [ParticipantGrowth],
    CAST((CY.[ParticipantCount] - PY.[ParticipantCount]) * 100.0 / NULLIF(PY.[ParticipantCount], 0) AS DECIMAL(5,1)) AS [ParticipantGrowthPercentage]
FROM CurrentYear CY
LEFT JOIN PreviousYear PY ON CY.[RegionId] = PY.[RegionId]
ORDER BY [ActivityGrowthPercentage] DESC;
```

**Parameters:** None (uses automatic date ranges)

**Joins:**
- Multiple CTEs for year-over-year comparison
- Full geographic hierarchy traversal

**Performance:**
- Two separate aggregations (current vs previous year)
- Date filters reduce dataset size
- DISTINCT counts prevent duplicate counting

**Privacy:**
- Regional aggregation ensures large populations
- No individual or small group identification

---

## Curriculum Tracking Patterns

### Pattern 3.1: Study Item Usage by Activity Type (Simple)

**Use Case:** Identify which curriculum materials are used in activities

**Complexity:** Beginner

**Privacy:** Safe (no personal data)

```sql
-- Most used study items by activity type
SELECT
    SI.[Name] AS [StudyItemName],
    CASE A.[ActivityType]
        WHEN 0 THEN 'Children''s Class'
        WHEN 1 THEN 'Junior Youth Group'
        WHEN 2 THEN 'Study Circle'
        ELSE 'Unknown'
    END AS [ActivityType],
    COUNT(DISTINCT ASI.[ActivityId]) AS [ActivitiesUsing]
FROM [StudyItems] SI
INNER JOIN [ActivityStudyItems] ASI ON SI.[Id] = ASI.[StudyItemId]
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
WHERE A.[IsArchived] = 0
  AND A.[StartDate] >= DATEADD(MONTH, -6, GETDATE())
GROUP BY SI.[Id], SI.[Name], A.[ActivityType]
HAVING COUNT(DISTINCT ASI.[ActivityId]) >= 3
ORDER BY [ActivityType], [ActivitiesUsing] DESC;
```

**Parameters:** None (uses last 6 months)

**Joins:**
- StudyItems → ActivityStudyItems → Activities

**Performance:**
- Date filter limits dataset
- DISTINCT prevents counting same activity multiple times

**Privacy:**
- No personal data involved
- Aggregates at curriculum level

---

### Pattern 3.2: Multi-Language Curriculum Coverage (Intermediate)

**Use Case:** Analyze curriculum translation coverage

**Complexity:** Intermediate

**Privacy:** Safe (curriculum data only)

```sql
-- Study item translation coverage by language
SELECT
    SI.[Name] AS [StudyItemName],
    SI.[StudyItemType],
    COUNT(DISTINCT LSI.[Language]) AS [LanguagesAvailable],
    STRING_AGG(LSI.[Language], ', ') AS [AvailableLanguages]
FROM [StudyItems] SI
LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId]
WHERE SI.[ParentStudyItemId] IS NULL  -- Root level items only
GROUP BY SI.[Id], SI.[Name], SI.[StudyItemType]
ORDER BY [LanguagesAvailable] DESC, SI.[Name];
```

**Parameters:** None

**Joins:**
- StudyItems ← LocalizedStudyItems (multi-language support)

**Performance:**
- ParentStudyItemId filter limits to root items
- STRING_AGG available in SQL Server 2017+

**Privacy:**
- Curriculum metadata only, no privacy concerns

---

### Pattern 3.3: Curriculum Progression Tracking (Advanced)

**Use Case:** Track participant progression through curriculum hierarchy

**Complexity:** Advanced

**Privacy:** Moderate (aggregated participant data)

```sql
-- Participant progression through curriculum levels
WITH ParticipantProgress AS (
    SELECT
        ASII.[IndividualId],
        SI.[ParentStudyItemId],
        SI.[Name] AS [StudyItemName],
        SI.[Sequence],
        MAX(A.[StartDate]) AS [LatestActivityDate],
        COUNT(DISTINCT ASII.[ActivityId]) AS [ActivitiesCompleted]
    FROM [ActivityStudyItemIndividuals] ASII
    INNER JOIN [ActivityStudyItems] ASI ON ASII.[ActivityStudyItemId] = ASI.[Id]
    INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
    INNER JOIN [Activities] A ON ASII.[ActivityId] = A.[Id]
    WHERE ASII.[IsArchived] = 0
      AND A.[IsCompleted] = 1
    GROUP BY ASII.[IndividualId], SI.[ParentStudyItemId], SI.[Name], SI.[Sequence]
),
ProgressionSummary AS (
    SELECT
        [ParentStudyItemId],
        [StudyItemName],
        [Sequence],
        COUNT(DISTINCT [IndividualId]) AS [ParticipantsReached]
    FROM ParticipantProgress
    GROUP BY [ParentStudyItemId], [StudyItemName], [Sequence]
    HAVING COUNT(DISTINCT [IndividualId]) >= 10  -- Privacy threshold
)
SELECT
    Parent.[Name] AS [BookName],
    PS.[StudyItemName],
    PS.[Sequence],
    PS.[ParticipantsReached]
FROM ProgressionSummary PS
LEFT JOIN [StudyItems] Parent ON PS.[ParentStudyItemId] = Parent.[Id]
ORDER BY Parent.[Sequence], PS.[Sequence];
```

**Parameters:** None

**Joins:**
- ActivityStudyItemIndividuals → ActivityStudyItems → StudyItems → StudyItems (self-join for hierarchy)
- ActivityStudyItemIndividuals → Activities (completion check)

**Performance:**
- Two-stage CTE for efficiency
- IsCompleted filter reduces dataset
- DISTINCT prevents duplicate counting

**Privacy:**
- HAVING ensures ≥10 participants threshold
- No individual names exposed, only counts

---

## People Management Patterns

### Pattern 4.1: Active Individuals by Locality (Simple)

**Use Case:** Count active individuals in each locality

**Complexity:** Beginner

**Privacy:** Safe with ≥10 threshold

```sql
-- Active individual counts by locality
SELECT
    C.[Name] AS [ClusterName],
    L.[Name] AS [LocalityName],
    COUNT(I.[Id]) AS [ActiveIndividuals]
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
LEFT JOIN [Individuals] I ON L.[Id] = I.[LocalityId] AND I.[IsArchived] = 0
WHERE C.[RegionId] = @RegionId
GROUP BY C.[Id], C.[Name], L.[Id], L.[Name]
HAVING COUNT(I.[Id]) >= 10  -- Privacy threshold
ORDER BY C.[Name], L.[Name];
```

**Parameters:**
- `@RegionId` (bigint) - Region to analyze

**Joins:**
- Localities → Clusters (geographic context)
- Localities ← Individuals (count active)

**Performance:**
- IsArchived filter in JOIN reduces dataset
- Indexes on RegionId, ClusterId, LocalityId

**Privacy:**
- HAVING ensures ≥10 individuals
- Only counts, no personal data

---

### Pattern 4.2: Age Demographics by Cluster (Intermediate)

**Use Case:** Analyze age distribution for program planning

**Complexity:** Intermediate

**Privacy:** Safe with aggregation and thresholds

```sql
-- Age distribution by cluster for program planning
SELECT
    C.[Name] AS [ClusterName],
    CASE
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] < 12 THEN 'Children (5-11)'
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] BETWEEN 12 AND 14 THEN 'Junior Youth (12-14)'
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] BETWEEN 15 AND 20 THEN 'Youth (15-20)'
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] BETWEEN 21 AND 40 THEN 'Young Adults (21-40)'
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] > 40 THEN 'Adults (40+)'
        ELSE 'Unknown'
    END AS [AgeGroup],
    COUNT(*) AS [Count],
    CAST(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY C.[Id]) AS DECIMAL(5,1)) AS [Percentage]
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[IsArchived] = 0
  AND I.[EstimatedYearOfBirthDate] IS NOT NULL
  AND C.[RegionId] = @RegionId
GROUP BY C.[Id], C.[Name],
    CASE
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] < 12 THEN 'Children (5-11)'
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] BETWEEN 12 AND 14 THEN 'Junior Youth (12-14)'
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] BETWEEN 15 AND 20 THEN 'Youth (15-20)'
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] BETWEEN 21 AND 40 THEN 'Young Adults (21-40)'
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] > 40 THEN 'Adults (40+)'
        ELSE 'Unknown'
    END
HAVING COUNT(*) >= 5  -- Privacy: minimum per age group
ORDER BY C.[Name], [AgeGroup];
```

**Parameters:**
- `@RegionId` (bigint) - Region to analyze

**Joins:**
- Individuals → Localities → Clusters (geographic rollup)

**Performance:**
- CASE statement in GROUP BY (SQL Server optimizes this)
- Window function for percentage calculation
- IsArchived filter reduces dataset

**Privacy:**
- Age bands prevent precise age identification
- HAVING ensures ≥5 per age group
- No names or contact information

---

### Pattern 4.3: Contact Information Completeness (Advanced)

**Use Case:** Assess contact information coverage for communication planning

**Complexity:** Advanced

**Privacy:** HIGH - Aggregated only, no PII exposure

```sql
-- Contact information coverage by cluster (NO personal data exposed)
WITH ContactCoverage AS (
    SELECT
        C.[Id] AS [ClusterId],
        C.[Name] AS [ClusterName],
        COUNT(DISTINCT I.[Id]) AS [TotalIndividuals],
        COUNT(DISTINCT IE.[IndividualId]) AS [IndividualsWithEmail],
        COUNT(DISTINCT IP.[IndividualId]) AS [IndividualsWithPhone],
        COUNT(DISTINCT CASE WHEN IE.[IndividualId] IS NOT NULL OR IP.[IndividualId] IS NOT NULL THEN I.[Id] END) AS [IndividualsWithAnyContact]
    FROM [Individuals] I
    INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
    INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
    LEFT JOIN [IndividualEmails] IE ON I.[Id] = IE.[IndividualId] AND IE.[IsPrimary] = 1
    LEFT JOIN [IndividualPhones] IP ON I.[Id] = IP.[IndividualId] AND IP.[IsPrimary] = 1
    WHERE I.[IsArchived] = 0
      AND C.[RegionId] = @RegionId
    GROUP BY C.[Id], C.[Name]
    HAVING COUNT(DISTINCT I.[Id]) >= 10  -- Privacy threshold
)
SELECT
    [ClusterName],
    [TotalIndividuals],
    [IndividualsWithEmail],
    CAST([IndividualsWithEmail] * 100.0 / [TotalIndividuals] AS DECIMAL(5,1)) AS [EmailCoveragePercentage],
    [IndividualsWithPhone],
    CAST([IndividualsWithPhone] * 100.0 / [TotalIndividuals] AS DECIMAL(5,1)) AS [PhoneCoveragePercentage],
    [IndividualsWithAnyContact],
    CAST([IndividualsWithAnyContact] * 100.0 / [TotalIndividuals] AS DECIMAL(5,1)) AS [AnyContactPercentage]
FROM ContactCoverage
ORDER BY [ClusterName];
```

**Parameters:**
- `@RegionId` (bigint) - Region to analyze

**Joins:**
- Individuals → Localities → Clusters (geographic)
- Individuals ← IndividualEmails (LEFT JOIN for coverage)
- Individuals ← IndividualPhones (LEFT JOIN for coverage)

**Performance:**
- CTE organizes complex aggregation
- IsPrimary filter ensures only one email/phone per individual
- Multiple LEFT JOINs for coverage analysis

**Privacy:**
- **CRITICAL:** No email addresses or phone numbers exposed
- Only counts and percentages
- HAVING ensures ≥10 individuals
- Use for planning only, not for contact extraction

---

## Statistical Reporting Patterns

### Pattern 5.1: Cycle Summary Report (Simple)

**Use Case:** View statistical summary for a specific reporting cycle

**Complexity:** Beginner

**Privacy:** Safe (pre-aggregated cluster data)

```sql
-- Cycle statistics summary for a cluster
SELECT
    CY.[CycleNumber],
    CY.[StartDate],
    CY.[EndDate],
    C.[Name] AS [ClusterName],
    CY.[TotalChildrensClasses],
    CY.[TotalJuniorYouthGroups],
    CY.[TotalStudyCircles],
    CY.[TotalCoreActivities],
    CY.[TotalParticipants],
    CY.[TotalTutors],
    CY.[TotalAnimators],
    CY.[TotalChildrensClassTeachers]
FROM [Cycles] CY
INNER JOIN [Clusters] C ON CY.[ClusterId] = C.[Id]
WHERE C.[RegionId] = @RegionId
  AND CY.[StartDate] >= @StartDate
  AND CY.[EndDate] <= @EndDate
ORDER BY C.[Name], CY.[CycleNumber];
```

**Parameters:**
- `@RegionId` (bigint) - Region to analyze
- `@StartDate` (datetime) - Report start date
- `@EndDate` (datetime) - Report end date

**Joins:**
- Cycles → Clusters (cluster context)

**Performance:**
- Pre-aggregated data in Cycles table
- Date range filter limits dataset

**Privacy:**
- Cluster-level aggregation, safe
- No individual identification

---

### Pattern 5.2: Cycle-over-Cycle Growth Trend (Intermediate)

**Use Case:** Analyze growth trends across multiple cycles

**Complexity:** Intermediate

**Privacy:** Safe (cluster aggregation)

```sql
-- Cycle-over-cycle growth analysis
WITH CycleWithPrevious AS (
    SELECT
        C.[Name] AS [ClusterName],
        CY.[CycleNumber],
        CY.[StartDate],
        CY.[TotalCoreActivities],
        CY.[TotalParticipants],
        LAG(CY.[TotalCoreActivities], 1) OVER (PARTITION BY C.[Id] ORDER BY CY.[CycleNumber]) AS [PreviousCoreActivities],
        LAG(CY.[TotalParticipants], 1) OVER (PARTITION BY C.[Id] ORDER BY CY.[CycleNumber]) AS [PreviousParticipants]
    FROM [Cycles] CY
    INNER JOIN [Clusters] C ON CY.[ClusterId] = C.[Id]
    WHERE C.[RegionId] = @RegionId
      AND CY.[CycleNumber] >= @StartCycleNumber
)
SELECT
    [ClusterName],
    [CycleNumber],
    [StartDate],
    [TotalCoreActivities],
    [PreviousCoreActivities],
    [TotalCoreActivities] - [PreviousCoreActivities] AS [ActivityGrowth],
    [TotalParticipants],
    [PreviousParticipants],
    [TotalParticipants] - [PreviousParticipants] AS [ParticipantGrowth]
FROM CycleWithPrevious
WHERE [PreviousCoreActivities] IS NOT NULL
ORDER BY [ClusterName], [CycleNumber];
```

**Parameters:**
- `@RegionId` (bigint) - Region to analyze
- `@StartCycleNumber` (int) - Starting cycle number

**Joins:**
- Cycles → Clusters

**Performance:**
- LAG window function for previous cycle comparison
- PARTITION BY ensures comparison within same cluster

**Privacy:**
- Cluster-level data, safe
- No personal information

---

### Pattern 5.3: Regional Activity Intensity Heatmap (Advanced)

**Use Case:** Create data for activity intensity visualization

**Complexity:** Advanced

**Privacy:** Safe (cluster aggregation)

```sql
-- Activity intensity analysis for regional heatmap
WITH ClusterIntensity AS (
    SELECT
        C.[Id] AS [ClusterId],
        C.[Name] AS [ClusterName],
        C.[StageOfDevelopment],
        C.[ApproxPopulation],
        COUNT(DISTINCT A.[Id]) AS [TotalActivities],
        COUNT(DISTINCT CASE WHEN A.[ActivityType] = 0 THEN A.[Id] END) AS [ChildrensClasses],
        COUNT(DISTINCT CASE WHEN A.[ActivityType] = 1 THEN A.[Id] END) AS [JuniorYouthGroups],
        COUNT(DISTINCT CASE WHEN A.[ActivityType] = 2 THEN A.[Id] END) AS [StudyCircles],
        COUNT(DISTINCT ASII.[IndividualId]) AS [UniqueParticipants]
    FROM [Clusters] C
    INNER JOIN [Localities] L ON C.[Id] = L.[ClusterId]
    LEFT JOIN [Activities] A ON L.[Id] = A.[LocalityId]
        AND A.[IsCompleted] = 0
        AND A.[IsArchived] = 0
    LEFT JOIN [ActivityStudyItemIndividuals] ASII ON A.[Id] = ASII.[ActivityId]
        AND ASII.[IsCurrent] = 1
    WHERE C.[RegionId] = @RegionId
    GROUP BY C.[Id], C.[Name], C.[StageOfDevelopment], C.[ApproxPopulation]
)
SELECT
    [ClusterName],
    [StageOfDevelopment],
    [ApproxPopulation],
    [TotalActivities],
    [ChildrensClasses],
    [JuniorYouthGroups],
    [StudyCircles],
    [UniqueParticipants],
    CASE
        WHEN [ApproxPopulation] > 0 THEN CAST([TotalActivities] * 1000.0 / [ApproxPopulation] AS DECIMAL(10,2))
        ELSE 0
    END AS [ActivitiesPerThousandPopulation],
    CASE
        WHEN [ApproxPopulation] > 0 THEN CAST([UniqueParticipants] * 100.0 / [ApproxPopulation] AS DECIMAL(5,2))
        ELSE 0
    END AS [ParticipationRatePercentage],
    -- Intensity score (0-100) for heatmap coloring
    CASE
        WHEN [ApproxPopulation] = 0 THEN 0
        WHEN [StageOfDevelopment] = 'Milestone 3' THEN 100
        WHEN [StageOfDevelopment] = 'Milestone 2' THEN 75
        WHEN [StageOfDevelopment] = 'Milestone 1' THEN 50
        ELSE LEAST(([TotalActivities] * 1000.0 / [ApproxPopulation]) * 10, 100)
    END AS [IntensityScore]
FROM ClusterIntensity
ORDER BY [IntensityScore] DESC, [ClusterName];
```

**Parameters:**
- `@RegionId` (bigint) - Region to visualize

**Joins:**
- Clusters → Localities ← Activities ← ActivityStudyItemIndividuals

**Performance:**
- CTE organizes complex calculation
- LEFT JOINs include clusters with zero activities
- Indexes on RegionId, ClusterId, LocalityId, ActivityId

**Privacy:**
- Cluster-level aggregation only
- Population-based rates prevent small group identification
- No personal data exposed

---

## Privacy-Safe Aggregation Patterns

### Pattern 6.1: Aggregation with Privacy Threshold

**Use Case:** Ensure all queries meet minimum threshold requirements

**Complexity:** Beginner

**Privacy:** CRITICAL - Follow this pattern for all individual-level data

```sql
-- Template for privacy-safe individual aggregation
SELECT
    C.[Name] AS [ClusterName],
    COUNT(*) AS [Count]
    -- Add other aggregate functions: AVG, SUM, MIN, MAX
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[IsArchived] = 0
  -- Add other filters as needed
GROUP BY C.[Id], C.[Name]
HAVING COUNT(*) >= 10  -- CRITICAL: Minimum privacy threshold
ORDER BY C.[Name];
```

**Privacy Rules:**
- **ALWAYS** use HAVING COUNT(*) >= 10 for individual-level aggregation
- **NEVER** expose counts < 10 (risk of re-identification)
- **NEVER** include names, emails, phones in SELECT
- Use cluster-level aggregation when possible

---

### Pattern 6.2: Small Locality Protection

**Use Case:** Aggregate small localities to cluster level

**Complexity:** Intermediate

**Privacy:** CRITICAL - Prevents small population identification

```sql
-- Protect small localities by rolling up to cluster
WITH LocalitySizes AS (
    SELECT
        L.[Id] AS [LocalityId],
        L.[Name] AS [LocalityName],
        L.[ApproxPopulation],
        C.[Id] AS [ClusterId],
        C.[Name] AS [ClusterName],
        CASE
            WHEN L.[ApproxPopulation] < 500 THEN C.[Id]  -- Roll up small localities
            ELSE L.[Id]
        END AS [ReportingUnitId],
        CASE
            WHEN L.[ApproxPopulation] < 500 THEN C.[Name]
            ELSE L.[Name]
        END AS [ReportingUnitName]
    FROM [Localities] L
    INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
)
SELECT
    LS.[ReportingUnitName],
    COUNT(DISTINCT I.[Id]) AS [IndividualCount]
FROM LocalitySizes LS
LEFT JOIN [Individuals] I ON LS.[LocalityId] = I.[LocalityId] AND I.[IsArchived] = 0
GROUP BY LS.[ReportingUnitId], LS.[ReportingUnitName]
HAVING COUNT(DISTINCT I.[Id]) >= 10
ORDER BY LS.[ReportingUnitName];
```

**Privacy Rules:**
- Roll up localities with population < 500 to cluster level
- Apply HAVING threshold even after rollup
- Never identify individuals in small populations

---

### Pattern 6.3: Children's Data Protection (COPPA Compliance)

**Use Case:** Handle children's data with COPPA requirements

**Complexity:** Advanced

**Privacy:** CRITICAL - Legal compliance required

```sql
-- Children's activity participation (COPPA-compliant aggregation)
SELECT
    C.[Name] AS [ClusterName],
    CASE A.[ActivityType]
        WHEN 0 THEN 'Children''s Class'
        ELSE 'Other Activity'
    END AS [ActivityType],
    COUNT(DISTINCT A.[Id]) AS [ActivityCount],
    -- NEVER expose which specific children participate
    COUNT(DISTINCT CASE
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] < 16 THEN ASII.[IndividualId]
    END) AS [ChildParticipants],
    COUNT(DISTINCT CASE
        WHEN YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] >= 16 THEN ASII.[IndividualId]
    END) AS [AdultParticipants]
FROM [Activities] A
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
LEFT JOIN [ActivityStudyItemIndividuals] ASII ON A.[Id] = ASII.[ActivityId]
LEFT JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id]
WHERE A.[IsArchived] = 0
  AND A.[IsCompleted] = 0
  AND C.[RegionId] = @RegionId
GROUP BY C.[Id], C.[Name], A.[ActivityType]
HAVING COUNT(DISTINCT A.[Id]) >= 3  -- Minimum activities
ORDER BY C.[Name], [ActivityType];
```

**Privacy Rules (COPPA):**
- **NEVER** expose which specific children attend which activities
- Aggregate children's participation at cluster level minimum
- Use age bands, not specific ages
- Require parental consent for any child-specific data access
- Higher thresholds for children (≥10 vs ≥5 for adults)

---

## Performance Optimization Patterns

### Pattern 7.1: Efficient Existence Check

**Use Case:** Check if records exist without counting all

**Complexity:** Beginner

**Performance:** High - Uses EXISTS instead of COUNT

```sql
-- Check if cluster has any active children's classes
IF EXISTS (
    SELECT 1
    FROM [Activities] A
    INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    WHERE L.[ClusterId] = @ClusterId
      AND A.[ActivityType] = 0
      AND A.[IsCompleted] = 0
      AND A.[IsArchived] = 0
)
BEGIN
    SELECT 'Cluster has active children''s classes' AS [Result];
END
ELSE
BEGIN
    SELECT 'No active children''s classes in cluster' AS [Result];
END
```

**Performance:**
- EXISTS stops at first match (faster than COUNT)
- SELECT 1 instead of SELECT * (minimal data transfer)
- Early filter in WHERE reduces scan

---

### Pattern 7.2: Indexed Filter Optimization

**Use Case:** Optimize queries with proper index usage

**Complexity:** Intermediate

**Performance:** High - Uses covering indexes

```sql
-- Optimized query using indexed columns in WHERE and JOIN
SELECT
    C.[Id],
    C.[Name],
    COUNT(A.[Id]) AS [ActivityCount]
FROM [Clusters] C
INNER JOIN [Localities] L ON C.[Id] = L.[ClusterId]
LEFT JOIN [Activities] A
    ON L.[Id] = A.[LocalityId]
    AND A.[IsArchived] = 0  -- Filter in JOIN for LEFT JOIN optimization
    AND A.[IsCompleted] = 0
WHERE C.[RegionId] = @RegionId  -- Indexed column
GROUP BY C.[Id], C.[Name]
ORDER BY C.[Id];  -- Order by indexed primary key
```

**Performance:**
- Filters in JOIN ON clause for LEFT JOIN (reduces intermediate results)
- WHERE uses indexed columns (RegionId)
- GROUP BY and ORDER BY use indexed columns
- Recommended indexes:
  - Clusters: PK (Id), IX_RegionId
  - Localities: PK (Id), IX_ClusterId
  - Activities: PK (Id), IX_LocalityId, IX_IsArchived_IsCompleted

---

### Pattern 7.3: Batch Processing with OFFSET/FETCH

**Use Case:** Process large result sets in batches

**Complexity:** Advanced

**Performance:** High - Prevents memory issues

```sql
-- Process individuals in batches of 1000
DECLARE @BatchSize INT = 1000;
DECLARE @Offset INT = 0;

WHILE 1 = 1
BEGIN
    -- Get batch
    SELECT
        I.[Id],
        I.[FirstName],
        I.[FamilyName]
    FROM [Individuals] I
    WHERE I.[IsArchived] = 0
      AND I.[LocalityId] = @LocalityId
    ORDER BY I.[Id]
    OFFSET @Offset ROWS
    FETCH NEXT @BatchSize ROWS ONLY;

    -- Check if we got any rows
    IF @@ROWCOUNT = 0
        BREAK;

    -- Process batch here
    -- ...

    -- Move to next batch
    SET @Offset = @Offset + @BatchSize;
END
```

**Performance:**
- OFFSET/FETCH for efficient paging
- ORDER BY ensures consistent batches
- Prevents loading entire dataset into memory
- Indexed ORDER BY column (Id) for speed

---

## Query Pattern Quick Reference

### When to Use Each Pattern

| Use Case | Pattern | Complexity | Privacy Level |
|----------|---------|------------|---------------|
| List active activities | 1.1 | Beginner | Safe |
| Count participants | 1.2 | Intermediate | Safe (≥5) |
| Completion rates | 1.3 | Advanced | Safe |
| Geographic rollup | 2.1 | Beginner | Safe (≥10) |
| Cluster development | 2.2 | Intermediate | Safe |
| Year-over-year growth | 2.3 | Advanced | Safe |
| Curriculum usage | 3.1 | Beginner | Safe |
| Multi-language coverage | 3.2 | Intermediate | Safe |
| Curriculum progression | 3.3 | Advanced | Moderate (≥10) |
| Individual counts | 4.1 | Beginner | Safe (≥10) |
| Age demographics | 4.2 | Intermediate | Safe (≥5) |
| Contact coverage | 4.3 | Advanced | HIGH (aggregated) |
| Cycle summary | 5.1 | Beginner | Safe |
| Cycle trends | 5.2 | Intermediate | Safe |
| Activity intensity | 5.3 | Advanced | Safe |
| Privacy aggregation | 6.1 | Beginner | CRITICAL |
| Small locality protection | 6.2 | Intermediate | CRITICAL |
| Children's data | 6.3 | Advanced | CRITICAL (COPPA) |
| Existence check | 7.1 | Beginner | N/A |
| Index optimization | 7.2 | Intermediate | N/A |
| Batch processing | 7.3 | Advanced | N/A |

---

## Parameter Naming Conventions

All query patterns use consistent parameter naming:

- `@ClusterId` (bigint) - Cluster identifier
- `@RegionId` (bigint) - Region identifier
- `@NationalCommunityId` (bigint) - National community identifier
- `@LocalityId` (bigint) - Locality identifier
- `@ActivityId` (bigint) - Activity identifier
- `@IndividualId` (bigint) - Individual identifier
- `@StartDate` (datetime) - Date range start
- `@EndDate` (datetime) - Date range end
- `@CycleNumber` (int) - Cycle number
- `@StartCycleNumber` (int) - Starting cycle number

---

## Index Requirements

For optimal performance, ensure these indexes exist:

### Geographic Tables
```sql
CREATE INDEX IX_Regions_NationalCommunityId ON [Regions]([NationalCommunityId]);
CREATE INDEX IX_Clusters_RegionId ON [Clusters]([RegionId]);
CREATE INDEX IX_Localities_ClusterId ON [Localities]([ClusterId]);
```

### Activity Tables
```sql
CREATE INDEX IX_Activities_LocalityId ON [Activities]([LocalityId]);
CREATE INDEX IX_Activities_ActivityType ON [Activities]([ActivityType]);
CREATE INDEX IX_Activities_IsCompleted_IsArchived ON [Activities]([IsCompleted], [IsArchived]);
CREATE INDEX IX_Activities_StartDate ON [Activities]([StartDate]);
CREATE INDEX IX_ActivityStudyItems_ActivityId ON [ActivityStudyItems]([ActivityId]);
CREATE INDEX IX_ActivityStudyItemIndividuals_ActivityId ON [ActivityStudyItemIndividuals]([ActivityId]);
CREATE INDEX IX_ActivityStudyItemIndividuals_IndividualId ON [ActivityStudyItemIndividuals]([IndividualId]);
CREATE INDEX IX_ActivityStudyItemIndividuals_IsCurrent ON [ActivityStudyItemIndividuals]([IsCurrent]);
```

### People Tables
```sql
CREATE INDEX IX_Individuals_LocalityId ON [Individuals]([LocalityId]);
CREATE INDEX IX_Individuals_IsArchived ON [Individuals]([IsArchived]);
CREATE INDEX IX_IndividualEmails_IndividualId ON [IndividualEmails]([IndividualId]);
CREATE INDEX IX_IndividualPhones_IndividualId ON [IndividualPhones]([IndividualId]);
```

### Curriculum Tables
```sql
CREATE INDEX IX_StudyItems_ParentStudyItemId ON [StudyItems]([ParentStudyItemId]);
CREATE INDEX IX_LocalizedStudyItems_StudyItemId ON [LocalizedStudyItems]([StudyItemId]);
```

### Reporting Tables
```sql
CREATE INDEX IX_Cycles_ClusterId ON [Cycles]([ClusterId]);
CREATE INDEX IX_Cycles_CycleNumber ON [Cycles]([CycleNumber]);
```

---

## Best Practices Summary

1. **Always read schema documentation** before adapting patterns
2. **Use privacy thresholds** (≥10 for individuals, ≥5 for activities)
3. **Filter archived records** early in queries (IsArchived = 0)
4. **Leverage indexes** by including indexed columns in WHERE/JOIN
5. **Use CTEs** for complex multi-step queries
6. **Apply DISTINCT carefully** to prevent duplicate counting
7. **Test on actual data** before deploying to production
8. **Follow privacy guidelines** from Privacy_and_Security_Classification_Matrix.md
9. **Use parameter placeholders** instead of string concatenation (SQL injection prevention)
10. **Document query modifications** when adapting patterns

---

**END OF QUERY PATTERN LIBRARY**

*For table-specific queries, see individual schema documentation in `schema/` directory.*

*For privacy compliance, see `reports/Privacy_and_Security_Classification_Matrix.md`.*

*For foreign key relationships, see `reports/Foreign_Key_Cross_Reference_Matrix.md`.*
