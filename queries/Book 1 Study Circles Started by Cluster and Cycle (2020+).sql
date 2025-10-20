-- ==================================================================
-- Book 1 Study Circle Starts by Cluster and Quarter (2020+)
-- ==================================================================
-- Purpose: Count distinct Book 1 study circles started per quarter
-- Grouping: By Cluster, Year, and Quarter (3-month cycle)
-- Date Range: January 1, 2020 onwards
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
    -- Step 1: Resolve cluster assignment for each activity
    -- Handles both direct (via LocalityId) and indirect (via SubdivisionId) paths
    -- ==================================================================
    SELECT
        a.Id AS ActivityId,
        a.StartDate,
        -- Determine cluster via direct locality link (prioritized)
        -- Falls back to indirect path through subdivision if direct is null
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
)
-- ==================================================================
-- Step 3: Final aggregation and join cluster names
-- ==================================================================
SELECT
    c.Id AS ClusterId,
    c.Name AS ClusterName,
    qa.ActivityYear AS Year,
    qa.ActivityQuarter AS Cycle,
    COUNT(DISTINCT qa.ActivityId) AS Book1StudyCirclesStarted
FROM QuarterlyAggregation qa
    INNER JOIN Clusters c
        ON qa.ClusterId = c.Id
GROUP BY
    c.Id,
    c.Name,
    qa.ActivityYear,
    qa.ActivityQuarter
ORDER BY
    c.Name,
    qa.ActivityYear,
    qa.ActivityQuarter;
