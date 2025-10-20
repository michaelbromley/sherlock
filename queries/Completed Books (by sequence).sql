-- =====================================================
-- Completed Books (by sequence) - WITH POCKET ROLLUP
-- =====================================================
-- Updated to include pocket neighborhoods that roll up to Florin and Summit
--
-- Florin pocket SubdivisionIds (all roll up to 5):
--   5: Florin
--   132: Florin: Willowood
--   140: Florin: Sky
--   143: Florin: Orchard Woods
--   199: Florin: Spartan Apartments
--
-- Summit SubdivisionId:
--   142: Summit (no pockets)
-- =====================================================

WITH EffectiveSubdivisions AS (
    -- ================================================
    -- Step 1: Map pocket neighborhoods to parent neighborhoods
    -- All Florin pockets roll up to SubdivisionId 5
    -- ================================================
    SELECT
        i.Id AS IndividualId,
        i.SubdivisionId AS OriginalSubdivisionId,
        CASE
            -- Florin and all its pockets roll up to SubdivisionId 5
            WHEN i.SubdivisionId IN (5, 132, 140, 143, 199) THEN 5
            -- Summit (no pockets, stays as 142)
            WHEN i.SubdivisionId = 142 THEN 142
            -- All other subdivisions remain unchanged
            ELSE i.SubdivisionId
        END AS EffectiveSubdivisionId
    FROM Individuals i
)
-- ================================================
-- Step 2: Main query with rolled-up subdivisions
-- ================================================
SELECT es.EffectiveSubdivisionId AS SubdivisionId,
       YEAR(a.StartDate) AS [Year],
       si.Sequence,
       COUNT(DISTINCT asi.IndividualId) AS CompletedBooks
FROM   ActivityStudyItemIndividuals asi
       JOIN Activities a          ON asi.ActivityId = a.Id
       JOIN EffectiveSubdivisions es ON asi.IndividualId = es.IndividualId
       JOIN StudyItems si        ON asi.StudyItemId = si.Id
WHERE  a.StartDate BETWEEN '2020-01-01' AND '2025-12-31'
  AND  si.ActivityStudyItemType = 'Book'
  AND  asi.IsCompleted = 1
  AND  asi.IndividualRole = 7
  AND  es.EffectiveSubdivisionId IN (5, 142)  -- Florin & Summit (including pockets)
GROUP BY es.EffectiveSubdivisionId, YEAR(a.StartDate), si.Sequence
ORDER BY es.EffectiveSubdivisionId, [Year], si.Sequence;
