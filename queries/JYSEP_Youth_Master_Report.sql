-- ==================================================================
-- JYSEP Youth Master Report - Combined Metrics with Pocket Rollup
-- ==================================================================
-- This master query combines all 5 individual JYSEP youth involvement
-- queries into a single report with years as columns.
--
-- Output Format:
-- SubdivisionName | Metric | 2017 | 2018 | 2019 | 2020 | 2021
--
-- Neighborhoods (with pocket rollup):
--   Florin (5): Includes 132, 140, 143, 199
--   Summit (142): No pockets
-- ==================================================================

WITH EffectiveSubdivisions AS (
    -- ================================================
    -- Shared CTE: Map pocket neighborhoods to parents
    -- ================================================
    SELECT
        i.Id AS IndividualId,
        CASE
            -- Florin and all its pockets roll up to SubdivisionId 5
            WHEN i.SubdivisionId IN (5, 132, 140, 143, 199) THEN 5
            -- Summit (no pockets, stays as 142)
            WHEN i.SubdivisionId = 142 THEN 142
            -- All other subdivisions remain unchanged
            ELSE i.SubdivisionId
        END AS EffectiveSubdivisionId
    FROM Individuals i
),

-- ================================================
-- Query 1: JY that entered JYSEP (role = 7)
-- ================================================
JYEntered AS (
    SELECT
        es.EffectiveSubdivisionId AS SubdivisionId,
        YEAR(a.StartDate) AS [Year],
        COUNT(DISTINCT asi.IndividualId) AS MetricValue
    FROM ActivityStudyItemIndividuals asi
        JOIN Activities a ON asi.ActivityId = a.Id
        JOIN EffectiveSubdivisions es ON asi.IndividualId = es.IndividualId
    WHERE a.StartDate BETWEEN '2017-01-01' AND '2025-12-31'
        AND asi.IndividualRole = 7
        AND es.EffectiveSubdivisionId IN (5, 142)
    GROUP BY es.EffectiveSubdivisionId, YEAR(a.StartDate)
),

-- ================================================
-- Query 2: JY that completed ≥ 1 text
-- ================================================
Completed1Text AS (
    SELECT
        es.EffectiveSubdivisionId AS SubdivisionId,
        YEAR(a.StartDate) AS [Year],
        COUNT(DISTINCT asi.IndividualId) AS MetricValue
    FROM ActivityStudyItemIndividuals asi
        JOIN Activities a ON asi.ActivityId = a.Id
        JOIN EffectiveSubdivisions es ON asi.IndividualId = es.IndividualId
        JOIN StudyItems si ON asi.StudyItemId = si.Id
    WHERE a.StartDate BETWEEN '2017-01-01' AND '2025-12-31'
        AND si.ActivityStudyItemType = 'Text'
        AND asi.IsCompleted = 1
        AND asi.IndividualRole = 7
        AND es.EffectiveSubdivisionId IN (5, 142)
    GROUP BY es.EffectiveSubdivisionId, YEAR(a.StartDate)
),

-- ================================================
-- Query 3: JY that completed ≥ 5 texts and ≥ 10 texts
-- ================================================
PerIndividualTexts AS (
    SELECT
        es.EffectiveSubdivisionId AS SubdivisionId,
        YEAR(a.StartDate) AS [Year],
        asi.IndividualId,
        COUNT(*) AS CompletedTexts
    FROM ActivityStudyItemIndividuals asi
        JOIN Activities a ON asi.ActivityId = a.Id
        JOIN EffectiveSubdivisions es ON asi.IndividualId = es.IndividualId
        JOIN StudyItems si ON asi.StudyItemId = si.Id
    WHERE a.StartDate BETWEEN '2017-01-01' AND '2025-12-31'
        AND si.ActivityStudyItemType = 'Text'
        AND asi.IsCompleted = 1
        AND asi.IndividualRole = 7
        AND es.EffectiveSubdivisionId IN (5, 142)
    GROUP BY es.EffectiveSubdivisionId, YEAR(a.StartDate), asi.IndividualId
),
Completed5Texts AS (
    SELECT
        SubdivisionId,
        [Year],
        SUM(CASE WHEN CompletedTexts >= 5 THEN 1 ELSE 0 END) AS MetricValue
    FROM PerIndividualTexts
    GROUP BY SubdivisionId, [Year]
),
Completed10Texts AS (
    SELECT
        SubdivisionId,
        [Year],
        SUM(CASE WHEN CompletedTexts >= 10 THEN 1 ELSE 0 END) AS MetricValue
    FROM PerIndividualTexts
    GROUP BY SubdivisionId, [Year]
),

-- ================================================
-- Query 4: Completed Books by Sequence (1, 2, 3)
-- ================================================
CompletedBooksRaw AS (
    SELECT
        es.EffectiveSubdivisionId AS SubdivisionId,
        YEAR(a.StartDate) AS [Year],
        si.Sequence,
        COUNT(DISTINCT asi.IndividualId) AS MetricValue
    FROM ActivityStudyItemIndividuals asi
        JOIN Activities a ON asi.ActivityId = a.Id
        JOIN EffectiveSubdivisions es ON asi.IndividualId = es.IndividualId
        JOIN StudyItems si ON asi.StudyItemId = si.Id
    WHERE a.StartDate BETWEEN '2017-01-01' AND '2025-12-31'
        AND si.ActivityStudyItemType = 'Book'
        AND asi.IsCompleted = 1
        AND asi.IndividualRole = 7
        AND es.EffectiveSubdivisionId IN (5, 142)
    GROUP BY es.EffectiveSubdivisionId, YEAR(a.StartDate), si.Sequence
),
CompletedBook1 AS (
    SELECT SubdivisionId, [Year], MetricValue
    FROM CompletedBooksRaw
    WHERE Sequence = 1
),
CompletedBook2 AS (
    SELECT SubdivisionId, [Year], MetricValue
    FROM CompletedBooksRaw
    WHERE Sequence = 2
),
CompletedBook3 AS (
    SELECT SubdivisionId, [Year], MetricValue
    FROM CompletedBooksRaw
    WHERE Sequence = 3
),

-- ================================================
-- Query 5: Assisting with JYG (role = 5)
-- ================================================
AssistingJYG AS (
    SELECT
        es.EffectiveSubdivisionId AS SubdivisionId,
        YEAR(a.StartDate) AS [Year],
        COUNT(DISTINCT asi.IndividualId) AS MetricValue
    FROM ActivityStudyItemIndividuals asi
        JOIN Activities a ON asi.ActivityId = a.Id
        JOIN EffectiveSubdivisions es ON asi.IndividualId = es.IndividualId
    WHERE a.StartDate BETWEEN '2017-01-01' AND '2025-12-31'
        AND asi.IndividualRole = 5
        AND es.EffectiveSubdivisionId IN (5, 142)
    GROUP BY es.EffectiveSubdivisionId, YEAR(a.StartDate)
),

-- ================================================
-- Combine All Metrics with Labels
-- ================================================
AllMetrics AS (
    SELECT SubdivisionId, [Year], 1 AS MetricOrder, '# of JY that entered the JYSEP' AS Metric, MetricValue FROM JYEntered
    UNION ALL
    SELECT SubdivisionId, [Year], 2, '# of JY that completed 1 text', MetricValue FROM Completed1Text
    UNION ALL
    SELECT SubdivisionId, [Year], 3, '# of JY that completed at least 5 text', MetricValue FROM Completed5Texts
    UNION ALL
    SELECT SubdivisionId, [Year], 4, '# of JY that completed at least 10 text', MetricValue FROM Completed10Texts
    UNION ALL
    SELECT SubdivisionId, [Year], 5, 'Completed Book 1', MetricValue FROM CompletedBook1
    UNION ALL
    SELECT SubdivisionId, [Year], 6, 'Completed Book 2', MetricValue FROM CompletedBook2
    UNION ALL
    SELECT SubdivisionId, [Year], 7, 'Completed Book 3', MetricValue FROM CompletedBook3
    UNION ALL
    SELECT SubdivisionId, [Year], 8, 'Assisting with JYG', MetricValue FROM AssistingJYG
),

-- ================================================
-- Generate all subdivision-metric-year combinations
-- to fill gaps with zeros
-- ================================================

-- Define all subdivisions explicitly (ensures all subdivisions appear)
Subdivisions AS (
    SELECT 5 AS SubdivisionId    -- Florin
    UNION ALL
    SELECT 142                    -- Summit
),

-- Define all metrics with their order and labels (ensures all metrics appear)
Metrics AS (
    SELECT 1 AS MetricOrder, '# of JY that entered the JYSEP' AS Metric
    UNION ALL
    SELECT 2, '# of JY that completed 1 text'
    UNION ALL
    SELECT 3, '# of JY that completed at least 5 text'
    UNION ALL
    SELECT 4, '# of JY that completed at least 10 text'
    UNION ALL
    SELECT 5, 'Completed Book 1'
    UNION ALL
    SELECT 6, 'Completed Book 2'
    UNION ALL
    SELECT 7, 'Completed Book 3'
    UNION ALL
    SELECT 8, 'Assisting with JYG'
),

-- Create Cartesian product of all subdivisions and all metrics
-- This guarantees every metric appears for every subdivision, even with no data
SubdivisionMetricCombos AS (
    SELECT
        s.SubdivisionId,
        m.MetricOrder,
        m.Metric
    FROM Subdivisions s
    CROSS JOIN Metrics m
),
Years AS (
    SELECT 2017 AS [Year] UNION ALL
    SELECT 2018 UNION ALL
    SELECT 2019 UNION ALL
    SELECT 2020 UNION ALL
    SELECT 2021 UNION ALL
    SELECT 2022 UNION ALL
    SELECT 2023 UNION ALL
    SELECT 2024 UNION ALL
    SELECT 2025
),
AllCombinations AS (
    SELECT
        smc.SubdivisionId,
        smc.MetricOrder,
        smc.Metric,
        y.[Year]
    FROM SubdivisionMetricCombos smc
    CROSS JOIN Years y
),

-- ================================================
-- Join actual data with all combinations (fill NULLs with 0)
-- ================================================
CompleteData AS (
    SELECT
        ac.SubdivisionId,
        ac.MetricOrder,
        ac.Metric,
        ac.[Year],
        COALESCE(am.MetricValue, 0) AS MetricValue
    FROM AllCombinations ac
    LEFT JOIN AllMetrics am
        ON ac.SubdivisionId = am.SubdivisionId
        AND ac.Metric = am.Metric
        AND ac.[Year] = am.[Year]
)

-- ================================================
-- Final Output: PIVOT years into columns
-- ================================================
SELECT
    CASE
        WHEN SubdivisionId = 5 THEN 'Florin'
        WHEN SubdivisionId = 142 THEN 'Summit'
        ELSE 'Other'
    END AS SubdivisionName,
    Metric,
    COALESCE([2017], 0) AS [2017],
    COALESCE([2018], 0) AS [2018],
    COALESCE([2019], 0) AS [2019],
    COALESCE([2020], 0) AS [2020],
    COALESCE([2021], 0) AS [2021],
    COALESCE([2022], 0) AS [2022],
    COALESCE([2023], 0) AS [2023],
    COALESCE([2024], 0) AS [2024],
    COALESCE([2025], 0) AS [2025]
FROM CompleteData
PIVOT (
    SUM(MetricValue)
    FOR [Year] IN ([2017], [2018], [2019], [2020], [2021], [2022], [2023], [2024], [2025])
) AS PivotTable
ORDER BY
    SubdivisionId,  -- Florin (5) first, then Summit (142)
    MetricOrder;    -- Metrics in defined order
