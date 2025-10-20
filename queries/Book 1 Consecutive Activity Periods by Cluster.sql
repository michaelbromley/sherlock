-- ==================================================================
-- Book 1 Consecutive Activity Periods by Cluster
-- ==================================================================
-- Purpose: Identify time ranges where clusters maintained consecutive
--          quarters of Book 1 study circle activity (no gaps)
-- Output: Start/end year/cycle, total activities, and streak length
-- Ordered by: Longest consecutive periods first
-- ==================================================================

-- ==================================================================
-- RECOMMENDED INDEXES FOR OPTIMAL PERFORMANCE
-- ==================================================================
-- Run these index creation statements before executing this query
-- to achieve optimal performance, especially with large datasets.
--
-- Note: Indexes are dropped and recreated if they already exist,
--       ensuring the definitions match the requirements.
-- ==================================================================

-- 1. Activities table - filtered index for date range and location fields
DROP INDEX IF EXISTS IX_Activities_StartDate_Locality_Subdivision ON Activities;
CREATE NONCLUSTERED INDEX IX_Activities_StartDate_Locality_Subdivision
ON Activities (StartDate, LocalityId, SubdivisionId)
INCLUDE (Id)
WHERE StartDate >= '2020-01-01';

-- 2. ActivityStudyItems junction table - covering index
DROP INDEX IF EXISTS IX_ActivityStudyItems_ActivityId_StudyItemId ON ActivityStudyItems;
CREATE NONCLUSTERED INDEX IX_ActivityStudyItems_ActivityId_StudyItemId
ON ActivityStudyItems (ActivityId, StudyItemId);

-- 3. StudyItems table - filtered index for books
DROP INDEX IF EXISTS IX_StudyItems_Type_Sequence ON StudyItems;
CREATE NONCLUSTERED INDEX IX_StudyItems_Type_Sequence
ON StudyItems (ActivityStudyItemType, Sequence)
INCLUDE (Id)
WHERE ActivityStudyItemType = 'Book';

-- 4. Subdivisions table - locality lookup
DROP INDEX IF EXISTS IX_Subdivisions_Id_LocalityId ON Subdivisions;
CREATE NONCLUSTERED INDEX IX_Subdivisions_Id_LocalityId
ON Subdivisions (Id, LocalityId);

-- 5. Localities table - cluster lookup
DROP INDEX IF EXISTS IX_Localities_Id_ClusterId ON Localities;
CREATE NONCLUSTERED INDEX IX_Localities_Id_ClusterId
ON Localities (Id, ClusterId);

-- 6. Clusters table - covering index for final join
DROP INDEX IF EXISTS IX_Clusters_Id_Name ON Clusters;
CREATE NONCLUSTERED INDEX IX_Clusters_Id_Name
ON Clusters (Id, Name);

-- After creating indexes, update statistics for optimal query plans:
-- UPDATE STATISTICS Activities;
-- UPDATE STATISTICS ActivityStudyItems;
-- UPDATE STATISTICS StudyItems;
-- UPDATE STATISTICS Localities;
-- UPDATE STATISTICS Subdivisions;
-- UPDATE STATISTICS Clusters;
-- ==================================================================

WITH ClusterAssignments AS (
    -- ==================================================================
    -- Step 1: Resolve cluster assignment for each Book 1 activity
    -- Handles both direct (via LocalityId) and indirect (via SubdivisionId) paths
    -- ==================================================================
    SELECT
        a.Id AS ActivityId,
        a.StartDate,
        COALESCE(loc_direct.ClusterId, loc_via_sub.ClusterId) AS ClusterId
    FROM Activities a
        INNER JOIN ActivityStudyItems asi
            ON a.Id = asi.ActivityId
        INNER JOIN StudyItems si
            ON asi.StudyItemId = si.Id
            AND si.ActivityStudyItemType = 'Book'  -- Filter early
            AND si.Sequence = 1                     -- Book 1 only
        -- Direct cluster resolution path
        LEFT JOIN Localities loc_direct
            ON a.LocalityId = loc_direct.Id
        -- Indirect cluster resolution path (via subdivision)
        LEFT JOIN Subdivisions sub
            ON a.SubdivisionId = sub.Id
        LEFT JOIN Localities loc_via_sub
            ON sub.LocalityId = loc_via_sub.Id
    WHERE
        a.StartDate >= '2020-01-01'
        -- Ensure activity is associated with a cluster (direct or indirect)
        AND (loc_direct.ClusterId IS NOT NULL OR loc_via_sub.ClusterId IS NOT NULL)
),
QuarterlyAggregation AS (
    -- ==================================================================
    -- Step 2: Pre-calculate year and quarter to avoid repeated function calls
    -- ==================================================================
    SELECT
        ClusterId,
        ActivityId,
        YEAR(StartDate) AS ActivityYear,
        DATEPART(QUARTER, StartDate) AS ActivityQuarter
    FROM ClusterAssignments
),
ClusterQuarterlyActivity AS (
    -- ==================================================================
    -- Step 3: Aggregate to cluster/year/quarter level with counts
    -- ==================================================================
    SELECT
        c.Id AS ClusterId,
        c.Name AS ClusterName,
        qa.ActivityYear,
        qa.ActivityQuarter,
        COUNT(DISTINCT qa.ActivityId) AS Book1Count
    FROM QuarterlyAggregation qa
        INNER JOIN Clusters c
            ON qa.ClusterId = c.Id
    GROUP BY
        c.Id,
        c.Name,
        qa.ActivityYear,
        qa.ActivityQuarter
),
IslandDetection AS (
    -- ==================================================================
    -- Step 4: Apply gaps-and-islands algorithm to find consecutive periods
    --
    -- Key technique: Convert Year/Quarter to sequential period numbers,
    -- then detect gaps by comparing period numbers with row numbers.
    --
    -- PeriodNumber: Sequential number starting from 2020 Q1 = 1
    --   Formula: ((Year - 2020) * 4) + Quarter
    --   Example: 2020 Q1 = 1, 2020 Q2 = 2, 2021 Q1 = 5
    --
    -- IslandGroup: Identifies consecutive sequences
    --   For consecutive quarters, (PeriodNumber - RowNumber) stays constant
    --   When there's a gap, this value changes, creating a new "island"
    -- ==================================================================
    SELECT
        ClusterId,
        ClusterName,
        ActivityYear,
        ActivityQuarter,
        Book1Count,
        -- Convert Year/Quarter to sequential period number
        ((ActivityYear - 2020) * 4 + ActivityQuarter) AS PeriodNumber,
        -- Island identifier: stays constant for consecutive quarters
        ((ActivityYear - 2020) * 4 + ActivityQuarter) -
            ROW_NUMBER() OVER (
                PARTITION BY ClusterId
                ORDER BY ActivityYear, ActivityQuarter
            ) AS IslandGroup
    FROM ClusterQuarterlyActivity
)
-- ==================================================================
-- Step 5: Group by islands to identify consecutive periods
-- Convert period numbers back to Year/Quarter for output
-- ==================================================================
SELECT
    ClusterName,
    -- Start of consecutive period
    2020 + ((MIN(PeriodNumber) - 1) / 4) AS StartYear,
    ((MIN(PeriodNumber) - 1) % 4) + 1 AS StartCycle,
    -- End of consecutive period
    2020 + ((MAX(PeriodNumber) - 1) / 4) AS EndYear,
    ((MAX(PeriodNumber) - 1) % 4) + 1 AS EndCycle,
    -- Total Book 1 activities started during this consecutive period
    SUM(Book1Count) AS TotalBook1sStarted,
    -- Number of consecutive quarters (cycles) in this period
    COUNT(*) AS ConsecutiveCycles
FROM IslandDetection
GROUP BY
    ClusterId,
    ClusterName,
    IslandGroup
HAVING
    COUNT(*) >= 2            -- Only include periods with at least 2 consecutive cycles
ORDER BY
    ConsecutiveCycles DESC,  -- Longest streaks first
    ClusterName,             -- Then alphabetically
    StartYear,               -- Then chronologically
    StartCycle;

-- ==================================================================
-- EXAMPLE OUTPUT:
-- ==================================================================
-- ClusterName              | StartYear | StartCycle | EndYear | EndCycle | TotalBook1sStarted | ConsecutiveCycles
-- -------------------------+-----------+------------+---------+----------+--------------------+-------------------
-- Greenfield Urban Cluster |   2020    |     1      |  2023   |    2     |        127         |        14
-- Metropolitan East        |   2020    |     3      |  2023   |    1     |         89         |        11
-- Riverside Community      |   2021    |     2      |  2023   |    4     |         64         |        11
--
-- INTERPRETATION:
-- - Greenfield maintained 14 consecutive quarters (Q1 2020 through Q2 2023)
--   with 127 total Book 1 study circles started
-- - Gaps in activity create separate rows for the same cluster
-- - Only periods with 2+ consecutive cycles are included (single quarters excluded)
-- - Results ordered by longest consecutive periods first

-- ==================================================================
-- HOW THE GAPS-AND-ISLANDS ALGORITHM WORKS:
-- ==================================================================
-- Example for a cluster with quarters: 2020 Q1, Q2, Q4, 2021 Q1
--
-- Quarter  | PeriodNumber | RowNumber | IslandGroup (Diff)
-- ---------+--------------+-----------+-------------------
-- 2020 Q1  |      1       |     1     |        0
-- 2020 Q2  |      2       |     2     |        0      <- Same island (consecutive)
-- 2020 Q4  |      4       |     3     |        1      <- New island (gap detected)
-- 2021 Q1  |      5       |     4     |        1      <- Same island (consecutive)
--
-- Result: TWO consecutive periods (both meet the 2+ cycle requirement):
--   1. 2020 Q1 - 2020 Q2 (2 quarters, IslandGroup=0)
--   2. 2020 Q4 - 2021 Q1 (2 quarters, IslandGroup=1)
--
-- Note: If 2020 Q4 was the only quarter in that island, it would be
--       filtered out by the HAVING clause (ConsecutiveCycles >= 2)
