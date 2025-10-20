WITH PerInd AS
(
    SELECT i.SubdivisionId,
           YEAR(a.StartDate) AS [Year],
           asi.IndividualId,
           COUNT(*) AS CompletedTexts
    FROM   ActivityStudyItemIndividuals asi
           JOIN Activities a          ON asi.ActivityId = a.Id
           JOIN Individuals i        ON asi.IndividualId = i.Id
           JOIN StudyItems si        ON asi.StudyItemId = si.Id
    WHERE  a.StartDate BETWEEN '2020-01-01' AND '2025-12-31'
      AND  si.ActivityStudyItemType = 'Text'
      AND  asi.IsCompleted = 1
      AND  asi.IndividualRole = 7
      AND  i.SubdivisionId IN (5,142)
    GROUP BY i.SubdivisionId, YEAR(a.StartDate), asi.IndividualId
)
SELECT SubdivisionId,
       [Year],
       SUM(CASE WHEN CompletedTexts >= 5  THEN 1 ELSE 0 END) AS CompletedAtLeast5Texts,
       SUM(CASE WHEN CompletedTexts >= 10 THEN 1 ELSE 0 END) AS CompletedAtLeast10Texts
FROM   PerInd
GROUP BY SubdivisionId, [Year]
ORDER BY SubdivisionId, [Year];
