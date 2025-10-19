SELECT i.SubdivisionId,
       YEAR(a.StartDate) AS [Year],
       COUNT(DISTINCT asi.IndividualId) AS JYEntered
FROM   ActivityStudyItemIndividuals asi
       JOIN Activities a          ON asi.ActivityId = a.Id
       JOIN Individuals i        ON asi.IndividualId = i.Id
WHERE  a.StartDate BETWEEN '2020-01-01' AND '2025-12-31'
  AND  asi.IndividualRole = 7
  AND  i.SubdivisionId IN (5,142)          -- Florin & Summit
GROUP BY i.SubdivisionId, YEAR(a.StartDate)
ORDER BY i.SubdivisionId, [Year];
