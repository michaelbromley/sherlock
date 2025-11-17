-- ============================================================================
-- Youth Study Circle Duration Analysis - Books 5, 6, and 7
-- ============================================================================
-- Purpose: Analyze completion durations for youth (ages 15-30) in California
-- Date Range: 2021-01-01 to present
-- Target Books: Ruhi Books 5, 6, and 7
-- ============================================================================

-- ============================================================================
-- QUERY 1: Book 5 - Youth Completions (Ages 15-30) in California
-- ============================================================================
WITH Book5Completions AS (
    SELECT
        i.Id AS IndividualId,
        i.FirstName,
        i.FamilyName,
        i.BirthDate,
        asii.EndDate AS CompletionDate,
        asi.StartDate AS StudyStartDate,
        asi.ActivityId,
        asi.StudyItemId,
        l.Name AS LocalityName,
        c.Name AS ClusterName,
        r.Name AS RegionName,
        -- Calculate age at completion
        DATEDIFF(YEAR, i.BirthDate, asii.EndDate) AS AgeAtCompletion,
        -- Calculate duration in days
        DATEDIFF(DAY, asi.StartDate, asii.EndDate) AS DurationDays
    FROM
        ActivityStudyItemIndividuals asii
        INNER JOIN Individuals i ON asii.IndividualId = i.Id
        INNER JOIN ActivityStudyItems asi ON asii.ActivityStudyItemId = asi.Id
        INNER JOIN StudyItems si ON asii.StudyItemId = si.Id
        INNER JOIN Activities a ON asii.ActivityId = a.Id
        INNER JOIN Localities l ON i.LocalityId = l.Id
        INNER JOIN Clusters c ON l.ClusterId = c.Id
        INNER JOIN Regions r ON c.RegionId = r.Id
    WHERE
        -- Book 5 filter
        si.Sequence = 5
        -- Completed items only
        AND asii.IsCompleted = 1
        -- Date range: 2021 to present
        AND asii.EndDate >= '2021-01-01'
        AND asii.EndDate IS NOT NULL
        AND asi.StartDate IS NOT NULL
        -- California region filter
        AND (r.Name = 'California' OR r.LatinName = 'California')
        -- Valid birth date
        AND i.BirthDate IS NOT NULL
)
SELECT
    FirstName,
    FamilyName,
    CompletionDate,
    StudyStartDate,
    DurationDays,
    AgeAtCompletion,
    LocalityName,
    ClusterName
FROM
    Book5Completions
WHERE
    -- Age range filter: 15-30 at time of completion
    AgeAtCompletion BETWEEN 15 AND 30
    -- Ensure duration is positive (exclude zero-day durations)
    AND DurationDays > 0
ORDER BY
    CompletionDate DESC,
    FamilyName,
    FirstName;


-- ============================================================================
-- QUERY 2: Book 6 - Youth Completions (Ages 15-30) in California
-- ============================================================================
WITH Book6Completions AS (
    SELECT
        i.Id AS IndividualId,
        i.FirstName,
        i.FamilyName,
        i.BirthDate,
        asii.EndDate AS CompletionDate,
        asi.StartDate AS StudyStartDate,
        asi.ActivityId,
        asi.StudyItemId,
        l.Name AS LocalityName,
        c.Name AS ClusterName,
        r.Name AS RegionName,
        -- Calculate age at completion
        DATEDIFF(YEAR, i.BirthDate, asii.EndDate) AS AgeAtCompletion,
        -- Calculate duration in days
        DATEDIFF(DAY, asi.StartDate, asii.EndDate) AS DurationDays
    FROM
        ActivityStudyItemIndividuals asii
        INNER JOIN Individuals i ON asii.IndividualId = i.Id
        INNER JOIN ActivityStudyItems asi ON asii.ActivityStudyItemId = asi.Id
        INNER JOIN StudyItems si ON asii.StudyItemId = si.Id
        INNER JOIN Activities a ON asii.ActivityId = a.Id
        INNER JOIN Localities l ON i.LocalityId = l.Id
        INNER JOIN Clusters c ON l.ClusterId = c.Id
        INNER JOIN Regions r ON c.RegionId = r.Id
    WHERE
        -- Book 6 filter
        si.Sequence = 6
        -- Completed items only
        AND asii.IsCompleted = 1
        -- Date range: 2021 to present
        AND asii.EndDate >= '2021-01-01'
        AND asii.EndDate IS NOT NULL
        AND asi.StartDate IS NOT NULL
        -- California region filter
        AND (r.Name = 'California' OR r.LatinName = 'California')
        -- Valid birth date
        AND i.BirthDate IS NOT NULL
)
SELECT
    FirstName,
    FamilyName,
    CompletionDate,
    StudyStartDate,
    DurationDays,
    AgeAtCompletion,
    LocalityName,
    ClusterName
FROM
    Book6Completions
WHERE
    -- Age range filter: 15-30 at time of completion
    AgeAtCompletion BETWEEN 15 AND 30
    -- Ensure duration is positive (exclude zero-day durations)
    AND DurationDays > 0
ORDER BY
    CompletionDate DESC,
    FamilyName,
    FirstName;


-- ============================================================================
-- QUERY 3: Book 7 - Youth Completions (Ages 15-30) in California
-- ============================================================================
WITH Book7Completions AS (
    SELECT
        i.Id AS IndividualId,
        i.FirstName,
        i.FamilyName,
        i.BirthDate,
        asii.EndDate AS CompletionDate,
        asi.StartDate AS StudyStartDate,
        asi.ActivityId,
        asi.StudyItemId,
        l.Name AS LocalityName,
        c.Name AS ClusterName,
        r.Name AS RegionName,
        -- Calculate age at completion
        DATEDIFF(YEAR, i.BirthDate, asii.EndDate) AS AgeAtCompletion,
        -- Calculate duration in days
        DATEDIFF(DAY, asi.StartDate, asii.EndDate) AS DurationDays
    FROM
        ActivityStudyItemIndividuals asii
        INNER JOIN Individuals i ON asii.IndividualId = i.Id
        INNER JOIN ActivityStudyItems asi ON asii.ActivityStudyItemId = asi.Id
        INNER JOIN StudyItems si ON asii.StudyItemId = si.Id
        INNER JOIN Activities a ON asii.ActivityId = a.Id
        INNER JOIN Localities l ON i.LocalityId = l.Id
        INNER JOIN Clusters c ON l.ClusterId = c.Id
        INNER JOIN Regions r ON c.RegionId = r.Id
    WHERE
        -- Book 7 filter
        si.Sequence = 7
        -- Completed items only
        AND asii.IsCompleted = 1
        -- Date range: 2021 to present
        AND asii.EndDate >= '2021-01-01'
        AND asii.EndDate IS NOT NULL
        AND asi.StartDate IS NOT NULL
        -- California region filter
        AND (r.Name = 'California' OR r.LatinName = 'California')
        -- Valid birth date
        AND i.BirthDate IS NOT NULL
)
SELECT
    FirstName,
    FamilyName,
    CompletionDate,
    StudyStartDate,
    DurationDays,
    AgeAtCompletion,
    LocalityName,
    ClusterName
FROM
    Book7Completions
WHERE
    -- Age range filter: 15-30 at time of completion
    AgeAtCompletion BETWEEN 15 AND 30
    -- Ensure duration is positive (exclude zero-day durations)
    AND DurationDays > 0
ORDER BY
    CompletionDate DESC,
    FamilyName,
    FirstName;


-- ============================================================================
-- BONUS: Combined Summary Statistics for All Three Books
-- ============================================================================
WITH AllBookCompletions AS (
    SELECT
        si.Sequence AS BookNumber,
        i.FirstName,
        i.FamilyName,
        asii.EndDate AS CompletionDate,
        asi.StartDate AS StudyStartDate,
        l.Name AS LocalityName,
        c.Name AS ClusterName,
        DATEDIFF(YEAR, i.BirthDate, asii.EndDate) AS AgeAtCompletion,
        DATEDIFF(DAY, asi.StartDate, asii.EndDate) AS DurationDays
    FROM
        ActivityStudyItemIndividuals asii
        INNER JOIN Individuals i ON asii.IndividualId = i.Id
        INNER JOIN ActivityStudyItems asi ON asii.ActivityStudyItemId = asi.Id
        INNER JOIN StudyItems si ON asii.StudyItemId = si.Id
        INNER JOIN Activities a ON asii.ActivityId = a.Id
        INNER JOIN Localities l ON i.LocalityId = l.Id
        INNER JOIN Clusters c ON l.ClusterId = c.Id
        INNER JOIN Regions r ON c.RegionId = r.Id
    WHERE
        si.Sequence IN (5, 6, 7)
        AND asii.IsCompleted = 1
        AND asii.EndDate >= '2021-01-01'
        AND asii.EndDate IS NOT NULL
        AND asi.StartDate IS NOT NULL
        AND (r.Name = 'California' OR r.LatinName = 'California')
        AND i.BirthDate IS NOT NULL
        AND DATEDIFF(YEAR, i.BirthDate, asii.EndDate) BETWEEN 15 AND 30
        AND DATEDIFF(DAY, asi.StartDate, asii.EndDate) > 0
)
SELECT
    BookNumber,
    COUNT(*) AS TotalCompletions,
    AVG(DurationDays) AS AvgDurationDays,
    MIN(DurationDays) AS MinDurationDays,
    MAX(DurationDays) AS MaxDurationDays,
    STDEV(DurationDays) AS StdDevDurationDays,
    AVG(AgeAtCompletion) AS AvgAgeAtCompletion,
    MIN(CompletionDate) AS EarliestCompletion,
    MAX(CompletionDate) AS LatestCompletion
FROM
    AllBookCompletions
GROUP BY
    BookNumber
ORDER BY
    BookNumber;
