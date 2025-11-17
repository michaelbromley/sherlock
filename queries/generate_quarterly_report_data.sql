-- =====================================================
-- California Statistics Bulletin - Quarterly Report Generator
-- =====================================================
-- This query generates statistics for Study Circles, Junior Youth, and Children's Classes
-- broken down by groupings and book/grade/text levels for a specific quarter.
--
-- IMPORTANT: Replace '2025-10-01' with your target quarter date (first day of quarter)
-- For Jan 2026: '2026-01-01'
-- For Apr 2026: '2026-04-01'
-- For Jul 2026: '2026-07-01'
-- For Oct 2026: '2026-10-01'

-- =====================================================
-- PART 1: STUDY CIRCLES (Main Sequence: Books 1-7)
-- =====================================================

-- Cluster-to-Grouping Mapping
WITH ClusterGroupings AS (
    SELECT [Id], [Name],
        CASE
            WHEN [Name] IN ('CA:SE13 Escondido', 'CA:SE14 East San Diego County', 'CA:SE15 San Diego North Coast', 'CA:SE18 San Diego')
                THEN 'San Diego'
            WHEN [Name] = 'CA:SE18 San Diego'
                THEN 'San Diego'
            WHEN [Name] IN ('CA:SW01 Los Angeles', 'CA:SW08 Glendale', 'CA:SW17 Thousand Oaks', 'CA:SW27 San Luis Obispo County',
                           'CA:SW28 Ventura', 'CA:SW29 Santa Clarita', 'CA:SW30 Whittier', 'CA:SW31 South Bay', 'CA:SW32 Long Beach')
                THEN 'Los Angeles'
            WHEN [Name] IN ('CA:NC02 Alameda County Central (Pleasanton)', 'CA:NC03 Alameda County South (Fremont)', 'CA:NC06 Napa County',
                           'CA:NC07 Marin County', 'CA:NC08 East Bay', 'CA:NC14 Sonoma County', 'CA:NC16 Contra Costa County East (Concord)',
                           'CA:NC18 Solano County', 'CA:NC20 Humboldt County', 'CA:NC21 Lake County', 'CA:NC22 Mendocino County',
                           'CA:NC25 Trinity County', 'CA:NC26 Del Norte County')
                THEN 'East Bay'
            WHEN [Name] IN ('CA:NC04 Santa Clara County West', 'CA:NC05 San Jose', 'CA:NC09 San Mateo', 'CA:NC10 Campos de Alianza',
                           'CA:NC11 Fortaleza de Generosidad', 'CA:NC15 Santa Cruz County', 'CA:NC19 San Francisco', 'CA:NC23 Monterey County')
                THEN 'Santa Clara County West'
            WHEN [Name] IN ('CA:NI07 Stanislaus County', 'CA:NI08 Tuolumne-Calaveras Counties', 'CA:NI09 Stockton', 'CA:NI10 Sacramento',
                           'CA:NI11 Placer County', 'CA:NI12 Yolo County', 'CA:NI13 Grass Valley', 'CA:NI14 Yuba County', 'CA:NI16 Chico',
                           'CA:NI17 Redding-Red Bluff', 'CA:NI18  Lassen-Modoc Counties', 'CA:NI19 El Dorado County')
                THEN 'Sacramento'
            WHEN [Name] IN ('CA:SW06 San Gabriel Valley', 'CA:SW10 Claremont')
                THEN 'San Gabriel Valley'
            WHEN [Name] IN ('CA:NI02 Exeter-Visalia', 'CA:NI03 Inyo County', 'CA:NI04 Fresno', 'CA:NI05 Madera County North', 'CA:NI06 Merced County')
                THEN 'Fresno'
            ELSE NULL
        END AS [Grouping],
        CASE
            WHEN [Name] IN ('CA:SE18 San Diego', 'CA:SW01 Los Angeles', 'CA:NC02 Alameda County Central (Pleasanton)',
                           'CA:NC04 Santa Clara County West', 'CA:NI10 Sacramento', 'CA:SW06 San Gabriel Valley', 'CA:NI04 Fresno')
                THEN 1  -- Reservoir cluster
            ELSE 0      -- Rest of grouping
        END AS [IsReservoir]
    FROM [Clusters]
),

-- Study Circles In Progress
StudyCirclesData AS (
    SELECT
        CG.[Grouping],
        CG.[IsReservoir],
        C.[Name] AS ClusterName,
        A.[Id] AS ActivityId,
        ASI.[StudyItemId],
        SI.[Sequence],
        CASE
            WHEN SI.[Sequence] IN (1, 2) THEN 'Books1-2'
            WHEN SI.[Sequence] IN (3, 4, 5) THEN 'Books3-5'
            WHEN SI.[Sequence] IN (6, 7) THEN 'Books6-7'
            ELSE 'Other'
        END AS [BookRange]
    FROM [Activities] A
    INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
    INNER JOIN ClusterGroupings CG ON C.[Id] = CG.[Id]
    LEFT JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId]
    LEFT JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
    WHERE A.[ActivityType] = 2  -- Study Circles
      AND A.[StartDate] <= '2025-10-01'  -- ⚠️ CHANGE THIS DATE
      AND (A.[EndDate] IS NULL OR A.[EndDate] >= '2025-10-01')  -- ⚠️ CHANGE THIS DATE
      AND CG.[Grouping] IS NOT NULL
      AND (ASI.[EndDate] IS NULL OR ASI.[EndDate] >= '2025-10-01')  -- ⚠️ CHANGE THIS DATE
)

-- Summary for Study Circles
SELECT
    '=== STUDY CIRCLES (Main Sequence: Books 1-7) ===' AS [ReportSection],
    [Grouping],
    CASE WHEN [IsReservoir] = 1 THEN 'Reservoir' ELSE 'Rest of Grouping' END AS [ClusterType],
    COUNT(DISTINCT CASE WHEN [BookRange] = 'Books1-2' THEN [ActivityId] END) AS [Books1_2],
    COUNT(DISTINCT CASE WHEN [BookRange] = 'Books3-5' THEN [ActivityId] END) AS [Books3_5],
    COUNT(DISTINCT CASE WHEN [BookRange] = 'Books6-7' THEN [ActivityId] END) AS [Books6_7],
    COUNT(DISTINCT [ActivityId]) AS [TotalActivities]
FROM StudyCirclesData
GROUP BY [Grouping], [IsReservoir]
ORDER BY [Grouping], [IsReservoir] DESC;

-- =====================================================
-- PART 2: JUNIOR YOUTH (Texts BC through RL)
-- =====================================================

WITH ClusterGroupings AS (
    SELECT [Id], [Name],
        CASE
            WHEN [Name] IN ('CA:SE13 Escondido', 'CA:SE14 East San Diego County', 'CA:SE15 San Diego North Coast', 'CA:SE18 San Diego')
                THEN 'San Diego'
            WHEN [Name] IN ('CA:SW01 Los Angeles', 'CA:SW08 Glendale', 'CA:SW17 Thousand Oaks', 'CA:SW27 San Luis Obispo County',
                           'CA:SW28 Ventura', 'CA:SW29 Santa Clarita', 'CA:SW30 Whittier', 'CA:SW31 South Bay', 'CA:SW32 Long Beach')
                THEN 'Los Angeles'
            WHEN [Name] IN ('CA:NC02 Alameda County Central (Pleasanton)', 'CA:NC03 Alameda County South (Fremont)', 'CA:NC06 Napa County',
                           'CA:NC07 Marin County', 'CA:NC08 East Bay', 'CA:NC14 Sonoma County', 'CA:NC16 Contra Costa County East (Concord)',
                           'CA:NC18 Solano County', 'CA:NC20 Humboldt County', 'CA:NC21 Lake County', 'CA:NC22 Mendocino County',
                           'CA:NC25 Trinity County', 'CA:NC26 Del Norte County')
                THEN 'East Bay'
            WHEN [Name] IN ('CA:NC04 Santa Clara County West', 'CA:NC05 San Jose', 'CA:NC09 San Mateo', 'CA:NC10 Campos de Alianza',
                           'CA:NC11 Fortaleza de Generosidad', 'CA:NC15 Santa Cruz County', 'CA:NC19 San Francisco', 'CA:NC23 Monterey County')
                THEN 'Santa Clara County West'
            WHEN [Name] IN ('CA:NI07 Stanislaus County', 'CA:NI08 Tuolumne-Calaveras Counties', 'CA:NI09 Stockton', 'CA:NI10 Sacramento',
                           'CA:NI11 Placer County', 'CA:NI12 Yolo County', 'CA:NI13 Grass Valley', 'CA:NI14 Yuba County', 'CA:NI16 Chico',
                           'CA:NI17 Redding-Red Bluff', 'CA:NI18  Lassen-Modoc Counties', 'CA:NI19 El Dorado County')
                THEN 'Sacramento'
            WHEN [Name] IN ('CA:SW06 San Gabriel Valley', 'CA:SW10 Claremont')
                THEN 'San Gabriel Valley'
            WHEN [Name] IN ('CA:NI02 Exeter-Visalia', 'CA:NI03 Inyo County', 'CA:NI04 Fresno', 'CA:NI05 Madera County North', 'CA:NI06 Merced County')
                THEN 'Fresno'
            ELSE NULL
        END AS [Grouping],
        CASE
            WHEN [Name] IN ('CA:SE18 San Diego', 'CA:SW01 Los Angeles', 'CA:NC02 Alameda County Central (Pleasanton)',
                           'CA:NC04 Santa Clara County West', 'CA:NI10 Sacramento', 'CA:SW06 San Gabriel Valley', 'CA:NI04 Fresno')
                THEN 1
            ELSE 0
        END AS [IsReservoir]
    FROM [Clusters]
),

JuniorYouthData AS (
    SELECT
        CG.[Grouping],
        CG.[IsReservoir],
        A.[Id] AS ActivityId,
        LSI.[ShortName] AS TextName
    FROM [Activities] A
    INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
    INNER JOIN ClusterGroupings CG ON C.[Id] = CG.[Id]
    LEFT JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId]
    LEFT JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
    LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId]
    WHERE A.[ActivityType] = 1  -- Junior Youth
      AND A.[StartDate] <= '2025-10-01'  -- ⚠️ CHANGE THIS DATE
      AND (A.[EndDate] IS NULL OR A.[EndDate] >= '2025-10-01')  -- ⚠️ CHANGE THIS DATE
      AND CG.[Grouping] IS NOT NULL
      AND LSI.[Language] = 'en-US'
      AND (ASI.[EndDate] IS NULL OR ASI.[EndDate] >= '2025-10-01')  -- ⚠️ CHANGE THIS DATE
)

SELECT
    '=== JUNIOR YOUTH (Texts BC through RL) ===' AS [ReportSection],
    [Grouping],
    CASE WHEN [IsReservoir] = 1 THEN 'Reservoir' ELSE 'Rest of Grouping' END AS [ClusterType],
    COUNT(DISTINCT [ActivityId]) AS [TotalActivities],
    COUNT(DISTINCT CASE WHEN [TextName] IN ('BC', 'WJ', 'HO', 'GH', 'WS') THEN [ActivityId] END) AS [Texts_BC_WS],
    COUNT(DISTINCT CASE WHEN [TextName] IN ('HW', 'SF', 'LE', 'TN', 'OI') THEN [ActivityId] END) AS [Texts_HW_OI],
    COUNT(DISTINCT CASE WHEN [TextName] IN ('HT', 'DP', 'PH', 'RL') THEN [ActivityId] END) AS [Texts_HT_RL]
FROM JuniorYouthData
GROUP BY [Grouping], [IsReservoir]
ORDER BY [Grouping], [IsReservoir] DESC;

-- =====================================================
-- PART 3: CHILDREN'S CLASSES (Grades 1-6)
-- =====================================================

WITH ClusterGroupings AS (
    SELECT [Id], [Name],
        CASE
            WHEN [Name] IN ('CA:SE13 Escondido', 'CA:SE14 East San Diego County', 'CA:SE15 San Diego North Coast', 'CA:SE18 San Diego')
                THEN 'San Diego'
            WHEN [Name] IN ('CA:SW01 Los Angeles', 'CA:SW08 Glendale', 'CA:SW17 Thousand Oaks', 'CA:SW27 San Luis Obispo County',
                           'CA:SW28 Ventura', 'CA:SW29 Santa Clarita', 'CA:SW30 Whittier', 'CA:SW31 South Bay', 'CA:SW32 Long Beach')
                THEN 'Los Angeles'
            WHEN [Name] IN ('CA:NC02 Alameda County Central (Pleasanton)', 'CA:NC03 Alameda County South (Fremont)', 'CA:NC06 Napa County',
                           'CA:NC07 Marin County', 'CA:NC08 East Bay', 'CA:NC14 Sonoma County', 'CA:NC16 Contra Costa County East (Concord)',
                           'CA:NC18 Solano County', 'CA:NC20 Humboldt County', 'CA:NC21 Lake County', 'CA:NC22 Mendocino County',
                           'CA:NC25 Trinity County', 'CA:NC26 Del Norte County')
                THEN 'East Bay'
            WHEN [Name] IN ('CA:NC04 Santa Clara County West', 'CA:NC05 San Jose', 'CA:NC09 San Mateo', 'CA:NC10 Campos de Alianza',
                           'CA:NC11 Fortaleza de Generosidad', 'CA:NC15 Santa Cruz County', 'CA:NC19 San Francisco', 'CA:NC23 Monterey County')
                THEN 'Santa Clara County West'
            WHEN [Name] IN ('CA:NI07 Stanislaus County', 'CA:NI08 Tuolumne-Calaveras Counties', 'CA:NI09 Stockton', 'CA:NI10 Sacramento',
                           'CA:NI11 Placer County', 'CA:NI12 Yolo County', 'CA:NI13 Grass Valley', 'CA:NI14 Yuba County', 'CA:NI16 Chico',
                           'CA:NI17 Redding-Red Bluff', 'CA:NI18  Lassen-Modoc Counties', 'CA:NI19 El Dorado County')
                THEN 'Sacramento'
            WHEN [Name] IN ('CA:SW06 San Gabriel Valley', 'CA:SW10 Claremont')
                THEN 'San Gabriel Valley'
            WHEN [Name] IN ('CA:NI02 Exeter-Visalia', 'CA:NI03 Inyo County', 'CA:NI04 Fresno', 'CA:NI05 Madera County North', 'CA:NI06 Merced County')
                THEN 'Fresno'
            ELSE NULL
        END AS [Grouping],
        CASE
            WHEN [Name] IN ('CA:SE18 San Diego', 'CA:SW01 Los Angeles', 'CA:NC02 Alameda County Central (Pleasanton)',
                           'CA:NC04 Santa Clara County West', 'CA:NI10 Sacramento', 'CA:SW06 San Gabriel Valley', 'CA:NI04 Fresno')
                THEN 1
            ELSE 0
        END AS [IsReservoir]
    FROM [Clusters]
),

ChildrenClassesData AS (
    SELECT
        CG.[Grouping],
        CG.[IsReservoir],
        A.[Id] AS ActivityId,
        LSI.[ShortName] AS GradeName
    FROM [Activities] A
    INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
    INNER JOIN ClusterGroupings CG ON C.[Id] = CG.[Id]
    LEFT JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId]
    LEFT JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
    LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId]
    WHERE A.[ActivityType] = 0  -- Children's Classes
      AND A.[StartDate] <= '2025-10-01'  -- ⚠️ CHANGE THIS DATE
      AND (A.[EndDate] IS NULL OR A.[EndDate] >= '2025-10-01')  -- ⚠️ CHANGE THIS DATE
      AND CG.[Grouping] IS NOT NULL
      AND LSI.[Language] = 'en-US'
      AND (ASI.[EndDate] IS NULL OR ASI.[EndDate] >= '2025-10-01')  -- ⚠️ CHANGE THIS DATE
)

SELECT
    '=== CHILDREN''S CLASSES (Grades 1-6) ===' AS [ReportSection],
    [Grouping],
    CASE WHEN [IsReservoir] = 1 THEN 'Reservoir' ELSE 'Rest of Grouping' END AS [ClusterType],
    COUNT(DISTINCT [ActivityId]) AS [TotalActivities],
    COUNT(DISTINCT CASE WHEN [GradeName] = 'G1' THEN [ActivityId] END) AS [Grade1],
    COUNT(DISTINCT CASE WHEN [GradeName] = 'G2' THEN [ActivityId] END) AS [Grade2],
    COUNT(DISTINCT CASE WHEN [GradeName] IN ('G3', 'G4', 'G5', 'G6') THEN [ActivityId] END) AS [Grades3_6]
FROM ChildrenClassesData
GROUP BY [Grouping], [IsReservoir]
ORDER BY [Grouping], [IsReservoir] DESC;
