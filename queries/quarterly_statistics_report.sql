-- =====================================================
-- Quarterly Statistics Report
-- Generates data for California Statistics Bulletin
-- =====================================================
--
-- This query calculates statistics for activities (Study Circles, Junior Youth, Children's Classes)
-- grouped by reservoir clusters for a specific quarter.
--
-- Usage: Update @QuarterDate to the first day of the quarter (e.g., '2026-01-01' for Jan 2026)

DECLARE @QuarterDate DATE = '2025-10-01';  -- Oct 2025 quarter

-- Cluster-to-Grouping Mapping CTE
WITH ClusterGroupings AS (
    SELECT [Id], [Name],
        CASE
            -- San Diego Grouping (SE region, San Diego area)
            WHEN [Name] IN (
                'CA:SE13 Escondido',
                'CA:SE14 East San Diego County',
                'CA:SE15 San Diego North Coast',
                'CA:SE18 San Diego'
            ) THEN 'San Diego'

            -- Los Angeles Grouping (SW region, Los Angeles area)
            WHEN [Name] IN (
                'CA:SW01 Los Angeles',
                'CA:SW08 Glendale',
                'CA:SW17 Thousand Oaks',
                'CA:SW27 San Luis Obispo County',
                'CA:SW28 Ventura',
                'CA:SW29 Santa Clarita',
                'CA:SW30 Whittier',
                'CA:SW31 South Bay',
                'CA:SW32 Long Beach'
            ) THEN 'Los Angeles'

            -- East Bay Grouping (NC region, East Bay area)
            WHEN [Name] IN (
                'CA:NC02 Alameda County Central (Pleasanton)',
                'CA:NC03 Alameda County South (Fremont)',
                'CA:NC06 Napa County',
                'CA:NC07 Marin County',
                'CA:NC08 East Bay',
                'CA:NC14 Sonoma County',
                'CA:NC16 Contra Costa County East (Concord)',
                'CA:NC18 Solano County',
                'CA:NC20 Humboldt County',
                'CA:NC21 Lake County',
                'CA:NC22 Mendocino County',
                'CA:NC25 Trinity County',
                'CA:NC26 Del Norte County'
            ) THEN 'East Bay'

            -- Santa Clara County West Grouping (NC region, South Bay)
            WHEN [Name] IN (
                'CA:NC04 Santa Clara County West',
                'CA:NC05 San Jose',
                'CA:NC09 San Mateo',
                'CA:NC10 Campos de Alianza',
                'CA:NC11 Fortaleza de Generosidad',
                'CA:NC15 Santa Cruz County',
                'CA:NC19 San Francisco',
                'CA:NC23 Monterey County'
            ) THEN 'Santa Clara County West'

            -- Sacramento Grouping (NI region, Sacramento area)
            WHEN [Name] IN (
                'CA:NI07 Stanislaus County',
                'CA:NI08 Tuolumne-Calaveras Counties',
                'CA:NI09 Stockton',
                'CA:NI10 Sacramento',
                'CA:NI11 Placer County',
                'CA:NI12 Yolo County',
                'CA:NI13 Grass Valley',
                'CA:NI14 Yuba County',
                'CA:NI16 Chico',
                'CA:NI17 Redding-Red Bluff',
                'CA:NI18  Lassen-Modoc Counties',
                'CA:NI19 El Dorado County'
            ) THEN 'Sacramento'

            -- San Gabriel Valley Grouping (SW region)
            WHEN [Name] IN (
                'CA:SW06 San Gabriel Valley',
                'CA:SW10 Claremont'
            ) THEN 'San Gabriel Valley'

            -- Fresno Grouping (NI region, Fresno area)
            WHEN [Name] IN (
                'CA:NI02 Exeter-Visalia',
                'CA:NI03 Inyo County',
                'CA:NI04 Fresno',
                'CA:NI05 Madera County North',
                'CA:NI06 Merced County'
            ) THEN 'Fresno'

            -- Other clusters not in main groupings
            ELSE 'Rest of California'
        END AS [Grouping]
    FROM [Clusters]
),

-- Activities In Progress for the Quarter
ActivitiesInProgress AS (
    SELECT
        A.[Id] AS ActivityId,
        A.[ActivityType],
        A.[IsCompleted],
        A.[LocalityId],
        CG.[Grouping],
        C.[Name] AS ClusterName
    FROM [Activities] A
    LEFT JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    LEFT JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
    LEFT JOIN ClusterGroupings CG ON C.[Id] = CG.[Id]
    WHERE A.[StartDate] <= @QuarterDate
      AND (A.[EndDate] IS NULL OR A.[EndDate] >= @QuarterDate)
)

-- Summary by Activity Type and Grouping
SELECT
    [Grouping],
    SUM(CASE WHEN [ActivityType] = 2 THEN 1 ELSE 0 END) AS [StudyCircles],
    SUM(CASE WHEN [ActivityType] = 1 THEN 1 ELSE 0 END) AS [JuniorYouth],
    SUM(CASE WHEN [ActivityType] = 0 THEN 1 ELSE 0 END) AS [ChildrenClasses]
FROM ActivitiesInProgress
WHERE [Grouping] IS NOT NULL
GROUP BY [Grouping]
ORDER BY [Grouping];
