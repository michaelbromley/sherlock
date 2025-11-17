-- Junior Youth Cohort Progression Analysis - INDIVIDUAL DETAILS TABLE
-- San Gabriel Cluster: Id = 40, Name = "CA:SW06 San Gabriel Valley"
--
-- This query lists all junior youth participants with their individual progression
-- for verification and detailed analysis.
--
-- COHORT DEFINITION:
--   A junior youth "starts" the program when they first participate in a JY activity
--   (ActivityType = 1) in the San Gabriel cluster while aged 11-15.
--
-- PROGRESSION TRACKING:
--   For each individual, we track cumulative completions across ALL subsequent years
--   (i.e., a JY who started in 2017 may complete texts in 2017, 2018, 2019, etc.)

WITH JYCohorts AS (
    -- Identify each individual's first JY activity year in San Gabriel cluster
    -- Filter for those who were ages 11-15 at start
    SELECT
        I.[Id] AS IndividualId,
        MIN(YEAR(A.[StartDate])) AS CohortYear,
        I.[BirthDate]
    FROM [Individuals] I
    JOIN [ActivityStudyItemIndividuals] ASI ON I.[Id] = ASI.[IndividualId]
    JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
    JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    WHERE L.[ClusterId] = 40  -- San Gabriel cluster
        AND A.[ActivityType] = 1  -- Junior Youth activities
        AND I.[IsArchived] = 0
        AND DATEDIFF(YEAR, I.[BirthDate], A.[StartDate]) BETWEEN 11 AND 15  -- Age 11-15 at start
    GROUP BY I.[Id], I.[BirthDate]
),

JYTextCompletions AS (
    -- Count completed JY texts per individual (cumulative across all time)
    -- Junior Youth Texts: Breezes of Confirmation, Wellspring of Joy, Habits of an Orderly Mind,
    --   Glimmerings of Hope, Walking the Straight Path, On Health and Well-Being,
    --   Learning About Excellence, Drawing on the Power of the Word, Thinking About Numbers,
    --   Observation and Insight, The Human Temple, Making Sense of Data, Spirit of Faith,
    --   Power of the Holy Spirit, Rays of Light
    SELECT
        ASI.[IndividualId],
        COUNT(DISTINCT ASI.[StudyItemId]) AS JYTextsCompleted
    FROM [ActivityStudyItemIndividuals] ASI
    WHERE ASI.[IsCompleted] = 1
        AND ASI.[StudyItemId] IN (7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 40, 41, 42, 43, 44)  -- JY texts
    GROUP BY ASI.[IndividualId]
),

BookCompletions AS (
    -- Track Book 1, 3, 5, 7 completions per individual
    -- Book 1: Id 17
    -- Book 3: Ids 19, 20, 21, 48, 49 (any grade counts as completion)
    -- Book 5: Id 23
    -- Book 7: Id 25
    SELECT
        ASI.[IndividualId],
        MAX(CASE WHEN ASI.[StudyItemId] = 17 AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook1,
        MAX(CASE WHEN ASI.[StudyItemId] IN (19, 20, 21, 48, 49) AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook3,
        MAX(CASE WHEN ASI.[StudyItemId] = 23 AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook5,
        MAX(CASE WHEN ASI.[StudyItemId] = 25 AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook7
    FROM [ActivityStudyItemIndividuals] ASI
    GROUP BY ASI.[IndividualId]
)

-- Individual details with names and progression for verification
SELECT
    C.CohortYear,
    I.[FirstName],
    I.[FamilyName],
    YEAR(I.[BirthDate]) AS [BirthYear],
    DATEDIFF(YEAR, I.[BirthDate], CAST(CAST(C.CohortYear AS VARCHAR) + '-01-01' AS DATE)) AS [AgeAtCohortStart],
    L.[Name] AS [CurrentLocality],
    ISNULL(JT.JYTextsCompleted, 0) AS [JYTextsCompleted],
    BC.CompletedBook1 AS [Book1],
    BC.CompletedBook3 AS [Book3],
    BC.CompletedBook5 AS [Book5],
    BC.CompletedBook7 AS [Book7]
FROM JYCohorts C
JOIN [Individuals] I ON C.IndividualId = I.[Id]
JOIN [Localities] L ON I.[LocalityId] = L.[Id]
LEFT JOIN JYTextCompletions JT ON C.IndividualId = JT.IndividualId
LEFT JOIN BookCompletions BC ON C.IndividualId = BC.IndividualId
WHERE C.CohortYear BETWEEN 2017 AND 2025
ORDER BY C.CohortYear, I.[FamilyName], I.[FirstName];
