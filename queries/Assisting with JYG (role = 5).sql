SELECT i.SubdivisionId,
       YEAR(a.StartDate) AS [Year],
       COUNT(DISTINCT asi.IndividualId) AS AssistingJYG
FROM   ActivityStudyItemIndividuals asi
       JOIN Activities a          ON asi.ActivityId = a.Id
       JOIN Individuals i        ON asi.IndividualId = i.Id
WHERE  a.StartDate BETWEEN '2020-01-01' AND '2025-12-31'
  AND  asi.IndividualRole = 5
  AND  i.SubdivisionId IN (5,142)
GROUP BY i.SubdivisionId, YEAR(a.StartDate)
ORDER BY i.SubdivisionId, [Year];
