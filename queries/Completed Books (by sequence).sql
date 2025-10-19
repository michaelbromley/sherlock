SELECT i.SubdivisionId,
       YEAR(a.StartDate) AS [Year],
       si.Sequence,
       COUNT(DISTINCT asi.IndividualId) AS CompletedBooks
FROM   ActivityStudyItemIndividuals asi
       JOIN Activities a          ON asi.ActivityId = a.Id
       JOIN Individuals i        ON asi.IndividualId = i.Id
       JOIN StudyItems si        ON asi.StudyItemId = si.Id
WHERE  a.StartDate BETWEEN '2020-01-01' AND '2025-12-31'
  AND  si.ActivityStudyItemType = 'Book'
  AND  asi.IsCompleted = 1
  AND  asi.IndividualRole = 7
  AND  i.SubdivisionId IN (5,142)
GROUP BY i.SubdivisionId, YEAR(a.StartDate), si.Sequence
ORDER BY i.SubdivisionId, [Year], si.Sequence;
