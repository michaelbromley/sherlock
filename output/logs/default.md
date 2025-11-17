2025-11-11T22:28:01.157Z

```sql
SELECT COUNT(DISTINCT [ActivityStudyItemType]) AS [DistinctBookTypes] FROM [StudyItems] WHERE [Id] IN (SELECT DISTINCT [StudyItemId] FROM [ActivityStudyItems])
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "DistinctBookTypes": 3
    }
  ]
}
```

---

2025-11-11T22:28:10.166Z

```sql
SELECT DISTINCT [ActivityStudyItemType] FROM [StudyItems] WHERE [Id] IN (SELECT DISTINCT [StudyItemId] FROM [ActivityStudyItems]) ORDER BY [ActivityStudyItemType]
```

```json
{
  "rowCount": 3,
  "rows": [
    {
      "ActivityStudyItemType": "Book"
    },
    {
      "ActivityStudyItemType": "Grade"
    },
    {
      "ActivityStudyItemType": "Text"
    }
  ]
}
```

---

2025-11-11T22:29:28.971Z

```sql
SELECT DISTINCT si.[ActivityStudyItemType], lsi.[Title], lsi.[Name], lsi.[ShortName] FROM [StudyItems] si JOIN [LocalizedStudyItems] lsi ON si.[Id] = lsi.[StudyItemId] WHERE si.[Id] IN (SELECT DISTINCT [StudyItemId] FROM [ActivityStudyItems]) ORDER BY si.[ActivityStudyItemType], lsi.[Title]
```

```json
{
  "rowCount": 715,
  "rows": [
    {
      "ActivityStudyItemType": "Book",
      "Title": "A Casa Universal de Justiça",
      "Name": "Livro 8 (U3)",
      "ShortName": "L8 (U3)"
    },
    {
      "ActivityStudyItemType": "Book",
      "Title": "A Instituição do Casamento",
      "Name": "Livro 12 (U1)",
      "ShortName": "L12 (U1)"
    },
    {
      "ActivityStudyItemType": "Book",
      "Title": "A Instituição do Fundo",
      "Name": "Livro 11 (U2)",
      "ShortName": "L11 (U2)"
    },
    {
      "ActivityStudyItemType": "Book",
      "Title": "A Lei do Ḥuqúqu’lláh",
      "Name": "Livro 11 (U3)",
      "ShortName": "L11 (U3)"
    },
    {
      "ActivityStudyItemType": "Book",
      "Title": "A Natureza de Nossas Contribuições",
      "Name": "Livro 14 (U1)",
      "ShortName": "L14 (U1)"
    },
    {
      "ActivityStudyItemType": "Book",
      "Title": "A Sacred Enterprise",
      "Name": "Book 9 (U3)",
      "ShortName": "B9 (U3)"
    },
    {
      "ActivityStudyItemType": "Book",
      "Title": "Accompagnarsi reciprocamente sulla via del servizio",
      "Name": "Libro 10 (U1)",
      "ShortName": "L10 (U1)"
    },
    {
      "ActivityStudyItemType": "Book",
      "Title": "Accompanying One Another on the Path of Service",
      "Name": "Book 10 (U1)",
      "ShortName": "B10 (U1)"
    },
    {
      "ActivityStudyItemType": "Book",
      "Title": "Acompañarse unos a otros en el sendero del servicio",
      "Name": "Libro 10 (U1)",
      "ShortName": "L10 (U1)"
    },
    {
      "ActivityStudyItemType": "Book",
      "Title": "Acompanhando Um ao Outro no Caminho do Serviço",
      "Name": "Livro 10 (U1)",
      "ShortName": "L10 (U1)"
    },
    "... 705 results omitted ..."
  ]
}
```

---

2025-11-11T22:29:44.744Z

```sql
SELECT [ActivityStudyItemType], COUNT(*) AS [Count] FROM [StudyItems] WHERE [Id] IN (SELECT DISTINCT [StudyItemId] FROM [ActivityStudyItems]) GROUP BY [ActivityStudyItemType] ORDER BY [Count] DESC
```

```json
{
  "rowCount": 3,
  "rows": [
    {
      "ActivityStudyItemType": "Book",
      "Count": 35
    },
    {
      "ActivityStudyItemType": "Text",
      "Count": 15
    },
    {
      "ActivityStudyItemType": "Grade",
      "Count": 6
    }
  ]
}
```

---

2025-11-11T22:29:53.628Z

```sql
SELECT DISTINCT lsi.[Title], lsi.[Name] FROM [StudyItems] si JOIN [LocalizedStudyItems] lsi ON si.[Id] = lsi.[StudyItemId] WHERE si.[Id] IN (SELECT DISTINCT [StudyItemId] FROM [ActivityStudyItems]) AND si.[ActivityStudyItemType] = 'Book' AND lsi.[Language] = 'en' ORDER BY lsi.[Name]
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T22:30:02.085Z

```sql
SELECT DISTINCT [Language], COUNT(*) AS [Count] FROM [LocalizedStudyItems] WHERE [StudyItemId] IN (SELECT DISTINCT [StudyItemId] FROM [ActivityStudyItems]) GROUP BY [Language] ORDER BY [Count] DESC
```

```json
{
  "rowCount": 13,
  "rows": [
    {
      "Language": "en-US",
      "Count": 56
    },
    {
      "Language": "es-ES",
      "Count": 56
    },
    {
      "Language": "fi-FI",
      "Count": 56
    },
    {
      "Language": "fr-FR",
      "Count": 56
    },
    {
      "Language": "id-ID",
      "Count": 56
    },
    {
      "Language": "it-IT",
      "Count": 56
    },
    {
      "Language": "ms-MY",
      "Count": 56
    },
    {
      "Language": "my-MM",
      "Count": 56
    },
    {
      "Language": "pt-PT",
      "Count": 56
    },
    {
      "Language": "ru-RU",
      "Count": 56
    },
    "... 3 results omitted ..."
  ]
}
```

---

2025-11-11T22:30:09.151Z

```sql
SELECT DISTINCT lsi.[Title], lsi.[Name] FROM [StudyItems] si JOIN [LocalizedStudyItems] lsi ON si.[Id] = lsi.[StudyItemId] WHERE si.[Id] IN (SELECT DISTINCT [StudyItemId] FROM [ActivityStudyItems]) AND si.[ActivityStudyItemType] = 'Book' AND lsi.[Language] = 'en-US' ORDER BY lsi.[Name]
```

```json
{
  "rowCount": 35,
  "rows": [
    {
      "Title": "Reflections on the Life of the Spirit",
      "Name": "Book 1"
    },
    {
      "Title": "Building Vibrant Communities",
      "Name": "Book 10"
    },
    {
      "Title": "Accompanying One Another on the Path of Service",
      "Name": "Book 10 (U1)"
    },
    {
      "Title": "Consultation",
      "Name": "Book 10 (U2)"
    },
    {
      "Title": "Dynamics of Service on an Area Teaching Committee",
      "Name": "Book 10 (U3)"
    },
    {
      "Title": "Material Means",
      "Name": "Book 11"
    },
    {
      "Title": "Giving: The Spiritual Basis of Prosperity",
      "Name": "Book 11 (U1)"
    },
    {
      "Title": "The Institution of the Fund",
      "Name": "Book 11 (U2)"
    },
    {
      "Title": "The Law of Ḥuqúqu’lláh",
      "Name": "Book 11 (U3)"
    },
    {
      "Title": "The Institution of Marriage",
      "Name": "Book 12 (U1)"
    },
    "... 25 results omitted ..."
  ]
}
```

---

2025-11-11T22:37:19.779Z

```sql
SELECT TOP 5 [Id], [ActivityType], [DisplayStartDate], [StartDate], [EndDate], [IsCompleted], [Participants] FROM [Activities] ORDER BY [StartDate] DESC
```

```json
{
  "rowCount": 5,
  "rows": [
    {
      "Id": "5643",
      "ActivityType": 0,
      "DisplayStartDate": "2025-11",
      "StartDate": "2025-11-01T07:00:00.000Z",
      "EndDate": null,
      "IsCompleted": false,
      "Participants": 6
    },
    {
      "Id": "6005",
      "ActivityType": 2,
      "DisplayStartDate": "2025-10-07",
      "StartDate": "2025-10-07T07:00:00.000Z",
      "EndDate": null,
      "IsCompleted": false,
      "Participants": 7
    },
    {
      "Id": "5993",
      "ActivityType": 2,
      "DisplayStartDate": "2025-10-06",
      "StartDate": "2025-10-06T07:00:00.000Z",
      "EndDate": null,
      "IsCompleted": false,
      "Participants": 1
    },
    {
      "Id": "6015",
      "ActivityType": 2,
      "DisplayStartDate": "2025-10-05",
      "StartDate": "2025-10-05T07:00:00.000Z",
      "EndDate": null,
      "IsCompleted": false,
      "Participants": 4
    },
    {
      "Id": "6016",
      "ActivityType": 2,
      "DisplayStartDate": "2025-10-05",
      "StartDate": "2025-10-05T07:00:00.000Z",
      "EndDate": null,
      "IsCompleted": false,
      "Participants": 3
    }
  ]
}
```

---

2025-11-11T22:37:27.107Z

```sql
SELECT [Id], [Name], [MaterialType], [CurriculumType], [Order] FROM [StudyItems] ORDER BY [MaterialType], [Order]
```

```json
{
  "error": "Error: Invalid column name 'Order'."
}
```

---

2025-11-11T22:39:45.182Z

```sql
SELECT TOP 20 SI.[Id], SI.[ActivityType], SI.[ActivityStudyItemType], SI.[Sequence], LSI.[Name] FROM [StudyItems] SI LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[LanguageCode] = 'en' ORDER BY SI.[ActivityType], SI.[Sequence]
```

```json
{
  "error": "Error: Invalid column name 'LanguageCode'."
}
```

---

2025-11-11T22:42:01.841Z

```sql
SELECT TOP 30 SI.[Id], SI.[ActivityType], SI.[ActivityStudyItemType], SI.[Sequence], LSI.[Name], LSI.[ShortName] FROM [StudyItems] SI LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en' ORDER BY SI.[ActivityType], SI.[Sequence]
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T22:42:07.677Z

```sql
SELECT DISTINCT [Language] FROM [LocalizedStudyItems]
```

```json
{
  "rowCount": 13,
  "rows": [
    {
      "Language": "fi-FI"
    },
    {
      "Language": "my-MM"
    },
    {
      "Language": "ms-MY"
    },
    {
      "Language": "sw-KE"
    },
    {
      "Language": "zh-CN"
    },
    {
      "Language": "fr-FR"
    },
    {
      "Language": "pt-PT"
    },
    {
      "Language": "tr-TR"
    },
    {
      "Language": "en-US"
    },
    {
      "Language": "id-ID"
    },
    "... 3 results omitted ..."
  ]
}
```

---

2025-11-11T22:42:13.499Z

```sql
SELECT SI.[Id], SI.[ActivityType], SI.[ActivityStudyItemType], SI.[Sequence], LSI.[Name], LSI.[ShortName] FROM [StudyItems] SI LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en-US' ORDER BY SI.[ActivityType], SI.[Sequence]
```

```json
{
  "rowCount": 68,
  "rows": [
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "Grade 1",
      "ShortName": "G1"
    },
    {
      "Id": "2",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 2,
      "Name": "Grade 2",
      "ShortName": "G2"
    },
    {
      "Id": "3",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 3,
      "Name": "Grade 3",
      "ShortName": "G3"
    },
    {
      "Id": "4",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 4,
      "Name": "Grade 4",
      "ShortName": "G4"
    },
    {
      "Id": "5",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 5,
      "Name": "Grade 5",
      "ShortName": "G5"
    },
    {
      "Id": "6",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 6,
      "Name": "Grade 6",
      "ShortName": "G6"
    },
    {
      "Id": "7",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 1,
      "Name": "Breezes of Confirmation",
      "ShortName": "BC"
    },
    {
      "Id": "40",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 2,
      "Name": "Wellspring of Joy",
      "ShortName": "WJ"
    },
    {
      "Id": "41",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 3,
      "Name": "Habits of an Orderly Mind",
      "ShortName": "HO"
    },
    {
      "Id": "8",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 4,
      "Name": "Glimmerings of Hope",
      "ShortName": "GH"
    },
    "... 58 results omitted ..."
  ]
}
```

---

2025-11-11T22:42:27.827Z

```sql
SELECT [Id], [Name] FROM [GroupOfClusters] ORDER BY [Name]
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T22:42:33.922Z

```sql
SELECT [Id], [Name], [RegionId] FROM [Subregions] ORDER BY [Name]
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T22:42:40.291Z

```sql
SELECT [Id], [Name] FROM [Regions] ORDER BY [Name]
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "Id": "1",
      "Name": "California"
    }
  ]
}
```

---

2025-11-11T22:42:48.074Z

```sql
SELECT TOP 10 [Id], [Name], [InstituteId] FROM [Clusters] ORDER BY [Name]
```

```json
{
  "rowCount": 10,
  "rows": [
    {
      "Id": "20",
      "Name": "CA:NC02 Alameda County Central (Pleasanton)",
      "InstituteId": null
    },
    {
      "Id": "22",
      "Name": "CA:NC03 Alameda County South (Fremont)",
      "InstituteId": null
    },
    {
      "Id": "25",
      "Name": "CA:NC04 Santa Clara County West",
      "InstituteId": null
    },
    {
      "Id": "27",
      "Name": "CA:NC05 San Jose",
      "InstituteId": null
    },
    {
      "Id": "14",
      "Name": "CA:NC06 Napa County",
      "InstituteId": null
    },
    {
      "Id": "16",
      "Name": "CA:NC07 Marin County",
      "InstituteId": null
    },
    {
      "Id": "21",
      "Name": "CA:NC08 East Bay",
      "InstituteId": null
    },
    {
      "Id": "24",
      "Name": "CA:NC09 San Mateo",
      "InstituteId": null
    },
    {
      "Id": "26",
      "Name": "CA:NC10 Campos de Alianza",
      "InstituteId": null
    },
    {
      "Id": "30",
      "Name": "CA:NC11 Fortaleza de Generosidad",
      "InstituteId": null
    }
  ]
}
```

---

2025-11-11T22:43:00.441Z

```sql
SELECT TOP 5 A.[Id], A.[ActivityType], A.[DisplayStartDate], A.[StartDate], A.[IsCompleted], C.[Name] AS ClusterName, L.[Name] AS LocalityName FROM [Activities] A LEFT JOIN [Localities] L ON A.[LocalityId] = L.[Id] LEFT JOIN [Clusters] C ON L.[ClusterId] = C.[Id] WHERE A.[StartDate] >= '2025-10-01' AND A.[StartDate] < '2026-01-01' ORDER BY A.[StartDate] DESC
```

```json
{
  "rowCount": 5,
  "rows": [
    {
      "Id": "5643",
      "ActivityType": 0,
      "DisplayStartDate": "2025-11",
      "StartDate": "2025-11-01T07:00:00.000Z",
      "IsCompleted": false,
      "ClusterName": "CA:SW01 Los Angeles",
      "LocalityName": "Los Angeles"
    },
    {
      "Id": "6005",
      "ActivityType": 2,
      "DisplayStartDate": "2025-10-07",
      "StartDate": "2025-10-07T07:00:00.000Z",
      "IsCompleted": false,
      "ClusterName": "CA:SE05 Orange County South",
      "LocalityName": "Lake Forest"
    },
    {
      "Id": "5993",
      "ActivityType": 2,
      "DisplayStartDate": "2025-10-06",
      "StartDate": "2025-10-06T07:00:00.000Z",
      "IsCompleted": false,
      "ClusterName": "CA:NC14 Sonoma County",
      "LocalityName": "Santa Rosa"
    },
    {
      "Id": "6015",
      "ActivityType": 2,
      "DisplayStartDate": "2025-10-05",
      "StartDate": "2025-10-05T07:00:00.000Z",
      "IsCompleted": false,
      "ClusterName": "CA:NI10 Sacramento",
      "LocalityName": "Sacramento"
    },
    {
      "Id": "6016",
      "ActivityType": 2,
      "DisplayStartDate": "2025-10-05",
      "StartDate": "2025-10-05T07:00:00.000Z",
      "IsCompleted": false,
      "ClusterName": "CA:NI10 Sacramento",
      "LocalityName": "Sacramento"
    }
  ]
}
```

---

2025-11-11T22:43:17.392Z

```sql
SELECT COUNT(*) AS TotalActivities, SUM(CASE WHEN [ActivityType] = 0 THEN 1 ELSE 0 END) AS ChildrenClasses, SUM(CASE WHEN [ActivityType] = 1 THEN 1 ELSE 0 END) AS JuniorYouth, SUM(CASE WHEN [ActivityType] = 2 THEN 1 ELSE 0 END) AS StudyCircles FROM [Activities] WHERE [StartDate] <= '2025-10-01' AND ([EndDate] IS NULL OR [EndDate] >= '2025-10-01')
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "TotalActivities": 1012,
      "ChildrenClasses": 237,
      "JuniorYouth": 173,
      "StudyCircles": 602
    }
  ]
}
```

---

2025-11-11T22:43:26.735Z

```sql
SELECT [Id], [Name] FROM [Clusters] ORDER BY [Name]
```

```json
{
  "rowCount": 64,
  "rows": [
    {
      "Id": "20",
      "Name": "CA:NC02 Alameda County Central (Pleasanton)"
    },
    {
      "Id": "22",
      "Name": "CA:NC03 Alameda County South (Fremont)"
    },
    {
      "Id": "25",
      "Name": "CA:NC04 Santa Clara County West"
    },
    {
      "Id": "27",
      "Name": "CA:NC05 San Jose"
    },
    {
      "Id": "14",
      "Name": "CA:NC06 Napa County"
    },
    {
      "Id": "16",
      "Name": "CA:NC07 Marin County"
    },
    {
      "Id": "21",
      "Name": "CA:NC08 East Bay"
    },
    {
      "Id": "24",
      "Name": "CA:NC09 San Mateo"
    },
    {
      "Id": "26",
      "Name": "CA:NC10 Campos de Alianza"
    },
    {
      "Id": "30",
      "Name": "CA:NC11 Fortaleza de Generosidad"
    },
    "... 54 results omitted ..."
  ]
}
```

---

2025-11-11T22:45:06.960Z

```sql
WITH ClusterGroupings AS ( SELECT [Id], [Name], CASE WHEN [Name] IN ('CA:SE13 Escondido', 'CA:SE14 East San Diego County', 'CA:SE15 San Diego North Coast', 'CA:SE18 San Diego') THEN 'San Diego' WHEN [Name] IN ('CA:SW01 Los Angeles', 'CA:SW08 Glendale', 'CA:SW17 Thousand Oaks', 'CA:SW27 San Luis Obispo County', 'CA:SW28 Ventura', 'CA:SW29 Santa Clarita', 'CA:SW30 Whittier', 'CA:SW31 South Bay', 'CA:SW32 Long Beach') THEN 'Los Angeles' WHEN [Name] IN ('CA:NC02 Alameda County Central (Pleasanton)', 'CA:NC03 Alameda County South (Fremont)', 'CA:NC06 Napa County', 'CA:NC07 Marin County', 'CA:NC08 East Bay', 'CA:NC14 Sonoma County', 'CA:NC16 Contra Costa County East (Concord)', 'CA:NC18 Solano County', 'CA:NC20 Humboldt County', 'CA:NC21 Lake County', 'CA:NC22 Mendocino County', 'CA:NC25 Trinity County', 'CA:NC26 Del Norte County') THEN 'East Bay' WHEN [Name] IN ('CA:NC04 Santa Clara County West', 'CA:NC05 San Jose', 'CA:NC09 San Mateo', 'CA:NC10 Campos de Alianza', 'CA:NC11 Fortaleza de Generosidad', 'CA:NC15 Santa Cruz County', 'CA:NC19 San Francisco', 'CA:NC23 Monterey County') THEN 'Santa Clara County West' WHEN [Name] IN ('CA:NI07 Stanislaus County', 'CA:NI08 Tuolumne-Calaveras Counties', 'CA:NI09 Stockton', 'CA:NI10 Sacramento', 'CA:NI11 Placer County', 'CA:NI12 Yolo County', 'CA:NI13 Grass Valley', 'CA:NI14 Yuba County', 'CA:NI16 Chico', 'CA:NI17 Redding-Red Bluff', 'CA:NI18  Lassen-Modoc Counties', 'CA:NI19 El Dorado County') THEN 'Sacramento' WHEN [Name] IN ('CA:SW06 San Gabriel Valley', 'CA:SW10 Claremont') THEN 'San Gabriel Valley' WHEN [Name] IN ('CA:NI02 Exeter-Visalia', 'CA:NI03 Inyo County', 'CA:NI04 Fresno', 'CA:NI05 Madera County North', 'CA:NI06 Merced County') THEN 'Fresno' ELSE 'Rest of California' END AS [Grouping] FROM [Clusters] ), ActivitiesInProgress AS ( SELECT A.[Id] AS ActivityId, A.[ActivityType], CG.[Grouping] FROM [Activities] A LEFT JOIN [Localities] L ON A.[LocalityId] = L.[Id] LEFT JOIN [Clusters] C ON L.[ClusterId] = C.[Id] LEFT JOIN ClusterGroupings CG ON C.[Id] = CG.[Id] WHERE A.[StartDate] <= '2025-10-01' AND (A.[EndDate] IS NULL OR A.[EndDate] >= '2025-10-01') ) SELECT [Grouping], SUM(CASE WHEN [ActivityType] = 2 THEN 1 ELSE 0 END) AS [StudyCircles], SUM(CASE WHEN [ActivityType] = 1 THEN 1 ELSE 0 END) AS [JuniorYouth], SUM(CASE WHEN [ActivityType] = 0 THEN 1 ELSE 0 END) AS [ChildrenClasses] FROM ActivitiesInProgress WHERE [Grouping] IS NOT NULL GROUP BY [Grouping] ORDER BY [Grouping]
```

```json
{
  "rowCount": 8,
  "rows": [
    {
      "Grouping": "East Bay",
      "StudyCircles": 75,
      "JuniorYouth": 30,
      "ChildrenClasses": 38
    },
    {
      "Grouping": "Fresno",
      "StudyCircles": 24,
      "JuniorYouth": 7,
      "ChildrenClasses": 6
    },
    {
      "Grouping": "Los Angeles",
      "StudyCircles": 124,
      "JuniorYouth": 19,
      "ChildrenClasses": 44
    },
    {
      "Grouping": "Rest of California",
      "StudyCircles": 75,
      "JuniorYouth": 23,
      "ChildrenClasses": 44
    },
    {
      "Grouping": "Sacramento",
      "StudyCircles": 76,
      "JuniorYouth": 21,
      "ChildrenClasses": 30
    },
    {
      "Grouping": "San Diego",
      "StudyCircles": 88,
      "JuniorYouth": 37,
      "ChildrenClasses": 41
    },
    {
      "Grouping": "San Gabriel Valley",
      "StudyCircles": 31,
      "JuniorYouth": 10,
      "ChildrenClasses": 10
    },
    {
      "Grouping": "Santa Clara County West",
      "StudyCircles": 109,
      "JuniorYouth": 26,
      "ChildrenClasses": 24
    }
  ]
}
```

---

2025-11-11T22:45:28.175Z

```sql
SELECT TOP 10 ASII.[Id], ASII.[IndividualType], ASII.[IndividualRole], ASII.[IsCurrent], ASI.[ActivityId], SI.[ActivityType], LSI.[ShortName] FROM [ActivityStudyItemIndividuals] ASII LEFT JOIN [ActivityStudyItems] ASI ON ASII.[ActivityStudyItemId] = ASI.[Id] LEFT JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en-US' ORDER BY ASII.[Id] DESC
```

```json
{
  "rowCount": 10,
  "rows": [
    {
      "Id": "115132",
      "IndividualType": 0,
      "IndividualRole": 3,
      "IsCurrent": true,
      "ActivityId": "5393",
      "ActivityType": 1,
      "ShortName": "BC"
    },
    {
      "Id": "115130",
      "IndividualType": 1,
      "IndividualRole": 7,
      "IsCurrent": true,
      "ActivityId": "5937",
      "ActivityType": 1,
      "ShortName": "BC"
    },
    {
      "Id": "115128",
      "IndividualType": 1,
      "IndividualRole": 7,
      "IsCurrent": true,
      "ActivityId": "4607",
      "ActivityType": 1,
      "ShortName": "WJ"
    },
    {
      "Id": "115126",
      "IndividualType": 1,
      "IndividualRole": 7,
      "IsCurrent": true,
      "ActivityId": "4607",
      "ActivityType": 1,
      "ShortName": "WJ"
    },
    {
      "Id": "115125",
      "IndividualType": 1,
      "IndividualRole": 7,
      "IsCurrent": true,
      "ActivityId": "4607",
      "ActivityType": 1,
      "ShortName": "WJ"
    },
    {
      "Id": "115124",
      "IndividualType": 1,
      "IndividualRole": 7,
      "IsCurrent": true,
      "ActivityId": "4607",
      "ActivityType": 1,
      "ShortName": "WJ"
    },
    {
      "Id": "115123",
      "IndividualType": 1,
      "IndividualRole": 7,
      "IsCurrent": true,
      "ActivityId": "4607",
      "ActivityType": 1,
      "ShortName": "WJ"
    },
    {
      "Id": "115122",
      "IndividualType": 1,
      "IndividualRole": 7,
      "IsCurrent": true,
      "ActivityId": "4607",
      "ActivityType": 1,
      "ShortName": "WJ"
    },
    {
      "Id": "115121",
      "IndividualType": 1,
      "IndividualRole": 7,
      "IsCurrent": true,
      "ActivityId": "4607",
      "ActivityType": 1,
      "ShortName": "WJ"
    },
    {
      "Id": "115120",
      "IndividualType": 1,
      "IndividualRole": 7,
      "IsCurrent": true,
      "ActivityId": "4607",
      "ActivityType": 1,
      "ShortName": "WJ"
    }
  ]
}
```

---

2025-11-11T22:45:41.803Z

```sql
SELECT SI.[Id], LSI.[ShortName], SI.[ActivityType] FROM [StudyItems] SI LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en-US' AND SI.[ActivityType] = 2 AND SI.[Id] IN (45293, 45356, 45450) ORDER BY SI.[Id]
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-11T22:47:44.352Z

```sql
WITH ClusterGroupings AS ( SELECT [Id], [Name], CASE WHEN [Name] IN ('CA:SE13 Escondido', 'CA:SE14 East San Diego County', 'CA:SE15 San Diego North Coast', 'CA:SE18 San Diego') THEN 'San Diego' WHEN [Name] IN ('CA:SW01 Los Angeles', 'CA:SW08 Glendale', 'CA:SW17 Thousand Oaks', 'CA:SW27 San Luis Obispo County', 'CA:SW28 Ventura', 'CA:SW29 Santa Clarita', 'CA:SW30 Whittier', 'CA:SW31 South Bay', 'CA:SW32 Long Beach') THEN 'Los Angeles' WHEN [Name] IN ('CA:NC02 Alameda County Central (Pleasanton)', 'CA:NC03 Alameda County South (Fremont)', 'CA:NC06 Napa County', 'CA:NC07 Marin County', 'CA:NC08 East Bay', 'CA:NC14 Sonoma County', 'CA:NC16 Contra Costa County East (Concord)', 'CA:NC18 Solano County', 'CA:NC20 Humboldt County', 'CA:NC21 Lake County', 'CA:NC22 Mendocino County', 'CA:NC25 Trinity County', 'CA:NC26 Del Norte County') THEN 'East Bay' WHEN [Name] IN ('CA:NC04 Santa Clara County West', 'CA:NC05 San Jose', 'CA:NC09 San Mateo', 'CA:NC10 Campos de Alianza', 'CA:NC11 Fortaleza de Generosidad', 'CA:NC15 Santa Cruz County', 'CA:NC19 San Francisco', 'CA:NC23 Monterey County') THEN 'Santa Clara County West' WHEN [Name] IN ('CA:NI07 Stanislaus County', 'CA:NI08 Tuolumne-Calaveras Counties', 'CA:NI09 Stockton', 'CA:NI10 Sacramento', 'CA:NI11 Placer County', 'CA:NI12 Yolo County', 'CA:NI13 Grass Valley', 'CA:NI14 Yuba County', 'CA:NI16 Chico', 'CA:NI17 Redding-Red Bluff', 'CA:NI18  Lassen-Modoc Counties', 'CA:NI19 El Dorado County') THEN 'Sacramento' WHEN [Name] IN ('CA:SW06 San Gabriel Valley', 'CA:SW10 Claremont') THEN 'San Gabriel Valley' WHEN [Name] IN ('CA:NI02 Exeter-Visalia', 'CA:NI03 Inyo County', 'CA:NI04 Fresno', 'CA:NI05 Madera County North', 'CA:NI06 Merced County') THEN 'Fresno' ELSE NULL END AS [Grouping], CASE WHEN [Name] IN ('CA:SE18 San Diego', 'CA:SW01 Los Angeles', 'CA:NC02 Alameda County Central (Pleasanton)', 'CA:NC04 Santa Clara County West', 'CA:NI10 Sacramento', 'CA:SW06 San Gabriel Valley', 'CA:NI04 Fresno') THEN 1 ELSE 0 END AS [IsReservoir] FROM [Clusters] ), StudyCirclesData AS ( SELECT CG.[Grouping], CG.[IsReservoir], A.[Id] AS ActivityId FROM [Activities] A INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id] INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id] INNER JOIN ClusterGroupings CG ON C.[Id] = CG.[Id] WHERE A.[ActivityType] = 2 AND A.[StartDate] <= '2025-10-01' AND (A.[EndDate] IS NULL OR A.[EndDate] >= '2025-10-01') AND CG.[Grouping] IS NOT NULL ) SELECT [Grouping], CASE WHEN [IsReservoir] = 1 THEN 'Reservoir' ELSE 'Rest of Grouping' END AS [ClusterType], COUNT(DISTINCT [ActivityId]) AS [TotalActivities] FROM StudyCirclesData GROUP BY [Grouping], [IsReservoir] ORDER BY [Grouping], [IsReservoir] DESC
```

```json
{
  "rowCount": 14,
  "rows": [
    {
      "Grouping": "East Bay",
      "ClusterType": "Reservoir",
      "TotalActivities": 7
    },
    {
      "Grouping": "East Bay",
      "ClusterType": "Rest of Grouping",
      "TotalActivities": 68
    },
    {
      "Grouping": "Fresno",
      "ClusterType": "Reservoir",
      "TotalActivities": 16
    },
    {
      "Grouping": "Fresno",
      "ClusterType": "Rest of Grouping",
      "TotalActivities": 8
    },
    {
      "Grouping": "Los Angeles",
      "ClusterType": "Reservoir",
      "TotalActivities": 72
    },
    {
      "Grouping": "Los Angeles",
      "ClusterType": "Rest of Grouping",
      "TotalActivities": 52
    },
    {
      "Grouping": "Sacramento",
      "ClusterType": "Reservoir",
      "TotalActivities": 27
    },
    {
      "Grouping": "Sacramento",
      "ClusterType": "Rest of Grouping",
      "TotalActivities": 49
    },
    {
      "Grouping": "San Diego",
      "ClusterType": "Reservoir",
      "TotalActivities": 45
    },
    {
      "Grouping": "San Diego",
      "ClusterType": "Rest of Grouping",
      "TotalActivities": 43
    },
    "... 4 results omitted ..."
  ]
}
```

---

2025-11-14T20:47:40.277Z

```sql
SELECT [TABLE_NAME] FROM [INFORMATION_SCHEMA].[VIEWS] ORDER BY [TABLE_NAME]
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-14T20:48:05.459Z

```sql
SELECT 
    FK.name AS [ForeignKeyName],
    FK_TABLE.name AS [ChildTable],
    FK_COLUMN.name AS [ChildColumn],
    PK_TABLE.name AS [ParentTable],
    PK_COLUMN.name AS [ParentColumn]
FROM sys.foreign_keys AS FK
INNER JOIN sys.foreign_key_columns AS FKC ON FK.object_id = FKC.constraint_object_id
INNER JOIN sys.tables AS FK_TABLE ON FKC.parent_object_id = FK_TABLE.object_id
INNER JOIN sys.columns AS FK_COLUMN ON FKC.parent_column_id = FK_COLUMN.column_id 
    AND FKC.parent_object_id = FK_COLUMN.object_id
INNER JOIN sys.tables AS PK_TABLE ON FKC.referenced_object_id = PK_TABLE.object_id
INNER JOIN sys.columns AS PK_COLUMN ON FKC.referenced_column_id = PK_COLUMN.column_id 
    AND FKC.referenced_object_id = PK_COLUMN.object_id
ORDER BY [ChildTable], [ChildColumn]
```

```json
{
  "rowCount": 35,
  "rows": [
    {
      "ForeignKeyName": "FK_LocalityActivity",
      "ChildTable": "Activities",
      "ChildColumn": "LocalityId",
      "ParentTable": "Localities",
      "ParentColumn": "Id"
    },
    {
      "ForeignKeyName": "FK_SubdivisionActivity",
      "ChildTable": "Activities",
      "ChildColumn": "SubdivisionId",
      "ParentTable": "Subdivisions",
      "ParentColumn": "Id"
    },
    {
      "ForeignKeyName": "FK_ActivityActivityStudyItemIndividual",
      "ChildTable": "ActivityStudyItemIndividuals",
      "ChildColumn": "ActivityId",
      "ParentTable": "Activities",
      "ParentColumn": "Id"
    },
    {
      "ForeignKeyName": "FK_ActivityStudyItemActivityStudyItemIndividual",
      "ChildTable": "ActivityStudyItemIndividuals",
      "ChildColumn": "ActivityStudyItemId",
      "ParentTable": "ActivityStudyItems",
      "ParentColumn": "Id"
    },
    {
      "ForeignKeyName": "FK_IndividualActivityStudyItemIndividual",
      "ChildTable": "ActivityStudyItemIndividuals",
      "ChildColumn": "IndividualId",
      "ParentTable": "Individuals",
      "ParentColumn": "Id"
    },
    {
      "ForeignKeyName": "FK_StudyItemActivityStudyItemIndividual",
      "ChildTable": "ActivityStudyItemIndividuals",
      "ChildColumn": "StudyItemId",
      "ParentTable": "StudyItems",
      "ParentColumn": "Id"
    },
    {
      "ForeignKeyName": "FK_ActivityActivityStudyItem",
      "ChildTable": "ActivityStudyItems",
      "ChildColumn": "ActivityId",
      "ParentTable": "Activities",
      "ParentColumn": "Id"
    },
    {
      "ForeignKeyName": "FK_StudyItemActivityStudyItem",
      "ChildTable": "ActivityStudyItems",
      "ChildColumn": "StudyItemId",
      "ParentTable": "StudyItems",
      "ParentColumn": "Id"
    },
    {
      "ForeignKeyName": "FK_ClusterClusterAuxiliaryBoardMember",
      "ChildTable": "ClusterAuxiliaryBoardMembers",
      "ChildColumn": "ClusterId",
      "ParentTable": "Clusters",
      "ParentColumn": "Id"
    },
    {
      "ForeignKeyName": "FK_ClusterGroupOfCluster",
      "ChildTable": "Clusters",
      "ChildColumn": "GroupOfClusterId",
      "ParentTable": "GroupOfClusters",
      "ParentColumn": "Id"
    },
    "... 25 results omitted ..."
  ]
}
```

---

2025-11-14T20:48:14.048Z

```sql
SELECT 
    [ActivityType], 
    COUNT(*) AS [Count]
FROM [Activities]
GROUP BY [ActivityType]
ORDER BY [ActivityType]
```

```json
{
  "rowCount": 3,
  "rows": [
    {
      "ActivityType": 0,
      "Count": 586
    },
    {
      "ActivityType": 1,
      "Count": 600
    },
    {
      "ActivityType": 2,
      "Count": 4837
    }
  ]
}
```

---

2025-11-14T20:48:21.299Z

```sql
SELECT TOP 10 
    [Id],
    [Name],
    [StudyItemType],
    [IsSequence],
    [DisplayOrder],
    [ParentStudyItemId]
FROM [StudyItems]
ORDER BY [DisplayOrder], [Name]
```

```json
{
  "error": "Error: Invalid column name 'DisplayOrder'."
}
```

---

2025-11-14T20:50:40.239Z

```sql
SELECT TOP 10 
    SI.[Id],
    SI.[ActivityType],
    SI.[ActivityStudyItemType],
    SI.[Sequence],
    LSI.[Name],
    LSI.[Culture],
    SI.[ParentStudyItemId]
FROM [StudyItems] SI
LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId]
ORDER BY SI.[ActivityType], SI.[Sequence]
```

```json
{
  "error": "Error: Invalid column name 'Culture'."
}
```

---

2025-11-14T20:52:56.299Z

```sql
SELECT TOP 10 
    SI.[Id],
    SI.[ActivityType],
    SI.[ActivityStudyItemType],
    SI.[Sequence],
    LSI.[Name],
    LSI.[Title],
    LSI.[ShortName],
    LSI.[Language]
FROM [StudyItems] SI
LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId]
WHERE LSI.[Language] = 'en'
ORDER BY SI.[ActivityType], SI.[Sequence]
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-14T20:53:03.028Z

```sql
SELECT TOP 10 
    SI.[Id],
    SI.[ActivityType],
    SI.[ActivityStudyItemType],
    SI.[Sequence],
    LSI.[Name],
    LSI.[Title],
    LSI.[ShortName],
    LSI.[Language]
FROM [StudyItems] SI
LEFT JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId]
ORDER BY SI.[ActivityType], SI.[Sequence]
```

```json
{
  "rowCount": 10,
  "rows": [
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "Grade 1",
      "Title": "Grade 1",
      "ShortName": "G1",
      "Language": "en-US"
    },
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "Année 1",
      "Title": "Année 1",
      "ShortName": "A1",
      "Language": "fr-FR"
    },
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "Grado 1",
      "Title": "Grado 1",
      "ShortName": "G1",
      "Language": "es-ES"
    },
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "Série 1",
      "Title": "Série 1",
      "ShortName": "S1",
      "Language": "pt-PT"
    },
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "Уровень 1",
      "Title": "Уровень 1",
      "ShortName": "У1",
      "Language": "ru-RU"
    },
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "အဆင့် ၁",
      "Title": "အဆင့် ၁",
      "ShortName": "G၁",
      "Language": "my-MM"
    },
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "级数 1",
      "Title": "级数 1",
      "ShortName": "G1",
      "Language": "zh-CN"
    },
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "Seviye 1",
      "Title": "Seviye 1",
      "ShortName": "S1",
      "Language": "tr-TR"
    },
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "Opintotaso 1",
      "Title": "Opintotaso 1",
      "ShortName": "T1",
      "Language": "fi-FI"
    },
    {
      "Id": "1",
      "ActivityType": 0,
      "ActivityStudyItemType": "Grade",
      "Sequence": 1,
      "Name": "Grado 1",
      "Title": "Grado 1",
      "ShortName": "G1",
      "Language": "it-IT"
    }
  ]
}
```

---

2025-11-14T20:53:30.652Z

```sql
SELECT TOP 1 
    L.[Name] AS LocalityName,
    L.[ClusterId],
    L.[ElectoralUnitId]
FROM [Localities] L
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "LocalityName": "Placer County - Granite Bay",
      "ClusterId": "3",
      "ElectoralUnitId": null
    }
  ]
}
```

---

2025-11-14T20:53:37.712Z

```sql
SELECT TOP 5
    [Id],
    [Name],
    [RegionId],
    [SubregionId],
    [GroupOfClusterId],
    [StageOfDevelopment],
    [TotalPopulation]
FROM [dbo].[Clusters]
```

```json
{
  "rowCount": 5,
  "rows": [
    {
      "Id": "1",
      "Name": "CA:SE02 Coachella Valley",
      "RegionId": "1",
      "SubregionId": null,
      "GroupOfClusterId": null,
      "StageOfDevelopment": "Milestone2",
      "TotalPopulation": 441622
    },
    {
      "Id": "2",
      "Name": "CA:NI17 Redding-Red Bluff",
      "RegionId": "1",
      "SubregionId": null,
      "GroupOfClusterId": null,
      "StageOfDevelopment": "Milestone2",
      "TotalPopulation": 285586
    },
    {
      "Id": "3",
      "Name": "CA:NI11 Placer County",
      "RegionId": "1",
      "SubregionId": null,
      "GroupOfClusterId": null,
      "StageOfDevelopment": "Milestone2",
      "TotalPopulation": 348432
    },
    {
      "Id": "4",
      "Name": "CA:NI16 Chico",
      "RegionId": "1",
      "SubregionId": null,
      "GroupOfClusterId": null,
      "StageOfDevelopment": "Milestone2",
      "TotalPopulation": 268129
    },
    {
      "Id": "5",
      "Name": "CA:NI12 Yolo County",
      "RegionId": "1",
      "SubregionId": null,
      "GroupOfClusterId": null,
      "StageOfDevelopment": "Milestone3",
      "TotalPopulation": 200849
    }
  ]
}
```

---

2025-11-14T23:03:38.069Z

```sql
SELECT TOP 20 SI.[Id], SI.[ActivityType], LSI.[Name], LSI.[Language] FROM [StudyItems] SI JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en-US' ORDER BY SI.[Id]
```

```json
{
  "rowCount": 20,
  "rows": [
    {
      "Id": "1",
      "ActivityType": 0,
      "Name": "Grade 1",
      "Language": "en-US"
    },
    {
      "Id": "2",
      "ActivityType": 0,
      "Name": "Grade 2",
      "Language": "en-US"
    },
    {
      "Id": "3",
      "ActivityType": 0,
      "Name": "Grade 3",
      "Language": "en-US"
    },
    {
      "Id": "4",
      "ActivityType": 0,
      "Name": "Grade 4",
      "Language": "en-US"
    },
    {
      "Id": "5",
      "ActivityType": 0,
      "Name": "Grade 5",
      "Language": "en-US"
    },
    {
      "Id": "6",
      "ActivityType": 0,
      "Name": "Grade 6",
      "Language": "en-US"
    },
    {
      "Id": "7",
      "ActivityType": 1,
      "Name": "Breezes of Confirmation",
      "Language": "en-US"
    },
    {
      "Id": "8",
      "ActivityType": 1,
      "Name": "Glimmerings of Hope",
      "Language": "en-US"
    },
    {
      "Id": "9",
      "ActivityType": 1,
      "Name": "Thinking About Numbers",
      "Language": "en-US"
    },
    {
      "Id": "10",
      "ActivityType": 1,
      "Name": "Spirit of Faith",
      "Language": "en-US"
    },
    "... 10 results omitted ..."
  ]
}
```

---

2025-11-14T23:04:12.165Z

```sql
SELECT TOP 10 I.[Id], I.[FirstName], I.[FamilyName], DATEDIFF(year, I.[BirthDate], GETDATE()) AS [CurrentAge], ASI.[IsCompleted], ASI.[EndDate], LSI.[Name] AS [StudyItemName] FROM [Individuals] I JOIN [ActivityStudyItemIndividuals] ASI ON I.[Id] = ASI.[IndividualId] JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Name] = 'Book 1' AND LSI.[Language] = 'en-US' AND ASI.[IsCompleted] = 1 AND I.[IsArchived] = 0 AND DATEDIFF(year, I.[BirthDate], GETDATE()) BETWEEN 11 AND 14 ORDER BY I.[FamilyName], I.[FirstName]
```

```json
{
  "rowCount": 4,
  "rows": [
    {
      "Id": "12382",
      "FirstName": "Donna",
      "FamilyName": null,
      "CurrentAge": 14,
      "IsCompleted": true,
      "EndDate": null,
      "StudyItemName": "Book 1"
    },
    {
      "Id": "22024",
      "FirstName": "Susan",
      "FamilyName": null,
      "CurrentAge": 13,
      "IsCompleted": true,
      "EndDate": "2021-03-04T08:00:00.000Z",
      "StudyItemName": "Book 1"
    },
    {
      "Id": "13277",
      "FirstName": "Darian",
      "FamilyName": "Baghaee",
      "CurrentAge": 14,
      "IsCompleted": true,
      "EndDate": "2025-09-18T07:00:00.000Z",
      "StudyItemName": "Book 1"
    },
    {
      "Id": "24213",
      "FirstName": "Zaya",
      "FamilyName": "Mills",
      "CurrentAge": 13,
      "IsCompleted": true,
      "EndDate": "2023-07-09T07:00:00.000Z",
      "StudyItemName": "Book 1"
    }
  ]
}
```

---

2025-11-14T23:13:47.816Z

```sql
SELECT TOP 50 SI.[Id], SI.[ActivityType], LSI.[Name], LSI.[ShortName] FROM [StudyItems] SI JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en-US' AND SI.[ActivityType] = 2 ORDER BY SI.[SequenceOrder]
```

```json
{
  "error": "Error: Invalid column name 'SequenceOrder'."
}
```

---

2025-11-14T23:16:01.951Z

```sql
SELECT TOP 50 SI.[Id], SI.[ActivityType], SI.[Sequence], LSI.[Name], LSI.[ShortName] FROM [StudyItems] SI JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en-US' AND SI.[ActivityType] = 2 ORDER BY SI.[Sequence]
```

```json
{
  "rowCount": 44,
  "rows": [
    {
      "Id": "17",
      "ActivityType": 2,
      "Sequence": 1,
      "Name": "Book 1",
      "ShortName": "B1"
    },
    {
      "Id": "18",
      "ActivityType": 2,
      "Sequence": 2,
      "Name": "Book 2",
      "ShortName": "B2"
    },
    {
      "Id": "19",
      "ActivityType": 2,
      "Sequence": 3,
      "Name": "Book 3 (G1)",
      "ShortName": "B3 (G1)"
    },
    {
      "Id": "20",
      "ActivityType": 2,
      "Sequence": 4,
      "Name": "Book 3 (G2)",
      "ShortName": "B3 (G2)"
    },
    {
      "Id": "21",
      "ActivityType": 2,
      "Sequence": 5,
      "Name": "Book 3 (G3)",
      "ShortName": "B3 (G3)"
    },
    {
      "Id": "48",
      "ActivityType": 2,
      "Sequence": 6,
      "Name": "Book 3 (G4)",
      "ShortName": "B3 (G4)"
    },
    {
      "Id": "49",
      "ActivityType": 2,
      "Sequence": 7,
      "Name": "Book 3 (G5)",
      "ShortName": "B3 (G5)"
    },
    {
      "Id": "22",
      "ActivityType": 2,
      "Sequence": 8,
      "Name": "Book 4",
      "ShortName": "B4"
    },
    {
      "Id": "23",
      "ActivityType": 2,
      "Sequence": 9,
      "Name": "Book 5",
      "ShortName": "B5"
    },
    {
      "Id": "50",
      "ActivityType": 2,
      "Sequence": 10,
      "Name": "Book 5 BR1",
      "ShortName": "B5 BR1"
    },
    "... 34 results omitted ..."
  ]
}
```

---

2025-11-14T23:16:48.155Z

```sql
SELECT A.[Id] AS ActivityId, LSI.[Name] AS StudyItem, A.[StartDate], A.[EndDate], DATEDIFF(day, A.[StartDate], A.[EndDate]) AS DurationDays, DATEDIFF(week, A.[StartDate], A.[EndDate]) AS DurationWeeks, COUNT(DISTINCT I.[Id]) AS YouthParticipants, AVG(DATEDIFF(year, I.[BirthDate], A.[StartDate])) AS AvgAge FROM [Activities] A INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND LSI.[Language] = 'en-US' AND DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND A.[EndDate] IS NOT NULL AND I.[IsArchived] = 0 GROUP BY A.[Id], LSI.[Name], A.[StartDate], A.[EndDate] ORDER BY LSI.[Name], A.[StartDate]
```

```json
{
  "rowCount": 300,
  "rows": [
    {
      "ActivityId": "974",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "YouthParticipants": 3,
      "AvgAge": 18
    },
    {
      "ActivityId": "1221",
      "StudyItem": "Book 5",
      "StartDate": "2015-10-19T07:00:00.000Z",
      "EndDate": "2015-12-01T08:00:00.000Z",
      "DurationDays": 43,
      "DurationWeeks": 6,
      "YouthParticipants": 1,
      "AvgAge": 19
    },
    {
      "ActivityId": "1245",
      "StudyItem": "Book 5",
      "StartDate": "2016-02-14T08:00:00.000Z",
      "EndDate": "2017-03-02T08:00:00.000Z",
      "DurationDays": 382,
      "DurationWeeks": 54,
      "YouthParticipants": 1,
      "AvgAge": 25
    },
    {
      "ActivityId": "990",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "YouthParticipants": 2,
      "AvgAge": 18
    },
    {
      "ActivityId": "977",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "YouthParticipants": 5,
      "AvgAge": 20
    },
    {
      "ActivityId": "517",
      "StudyItem": "Book 5",
      "StartDate": "2016-08-02T07:00:00.000Z",
      "EndDate": "2017-07-01T07:00:00.000Z",
      "DurationDays": 333,
      "DurationWeeks": 47,
      "YouthParticipants": 8,
      "AvgAge": 18
    },
    {
      "ActivityId": "4",
      "StudyItem": "Book 5",
      "StartDate": "2016-08-28T07:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 216,
      "DurationWeeks": 30,
      "YouthParticipants": 7,
      "AvgAge": 17
    },
    {
      "ActivityId": "25",
      "StudyItem": "Book 5",
      "StartDate": "2016-09-19T07:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 255,
      "DurationWeeks": 36,
      "YouthParticipants": 1,
      "AvgAge": 16
    },
    {
      "ActivityId": "1028",
      "StudyItem": "Book 5",
      "StartDate": "2016-09-25T07:00:00.000Z",
      "EndDate": "2017-05-29T07:00:00.000Z",
      "DurationDays": 246,
      "DurationWeeks": 35,
      "YouthParticipants": 4,
      "AvgAge": 18
    },
    {
      "ActivityId": "12",
      "StudyItem": "Book 5",
      "StartDate": "2016-10-09T07:00:00.000Z",
      "EndDate": "2017-03-29T07:00:00.000Z",
      "DurationDays": 171,
      "DurationWeeks": 24,
      "YouthParticipants": 1,
      "AvgAge": 17
    },
    "... 290 results omitted ..."
  ]
}
```

---

2025-11-14T23:17:10.478Z

```sql
SELECT LSI.[Name] AS StudyItem, COUNT(DISTINCT A.[Id]) AS TotalActivities, AVG(CAST(DATEDIFF(day, A.[StartDate], A.[EndDate]) AS FLOAT)) AS AvgDurationDays, MIN(DATEDIFF(day, A.[StartDate], A.[EndDate])) AS MinDurationDays, MAX(DATEDIFF(day, A.[StartDate], A.[EndDate])) AS MaxDurationDays, SUM(ASII_Count.[ParticipantCount]) AS TotalYouthParticipants FROM [Activities] A INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] INNER JOIN (SELECT ASI2.[ActivityId], COUNT(DISTINCT I2.[Id]) AS ParticipantCount FROM [ActivityStudyItemIndividuals] ASII2 INNER JOIN [Individuals] I2 ON ASII2.[IndividualId] = I2.[Id] INNER JOIN [ActivityStudyItems] ASI2 ON ASII2.[ActivityStudyItemId] = ASI2.[Id] WHERE DATEDIFF(year, I2.[BirthDate], (SELECT [StartDate] FROM [Activities] WHERE [Id] = ASI2.[ActivityId])) BETWEEN 15 AND 30 AND I2.[IsArchived] = 0 GROUP BY ASI2.[ActivityId]) ASII_Count ON A.[Id] = ASII_Count.[ActivityId] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND LSI.[Language] = 'en-US' AND A.[EndDate] IS NOT NULL GROUP BY LSI.[Name] ORDER BY LSI.[Name]
```

```json
{
  "rowCount": 5,
  "rows": [
    {
      "StudyItem": "Book 5",
      "TotalActivities": 141,
      "AvgDurationDays": 258.4751773049645,
      "MinDurationDays": 0,
      "MaxDurationDays": 1411,
      "TotalYouthParticipants": 430
    },
    {
      "StudyItem": "Book 5 BR1",
      "TotalActivities": 27,
      "AvgDurationDays": 76.4074074074074,
      "MinDurationDays": 0,
      "MaxDurationDays": 395,
      "TotalYouthParticipants": 103
    },
    {
      "StudyItem": "Book 5 BR2",
      "TotalActivities": 5,
      "AvgDurationDays": 180,
      "MinDurationDays": 2,
      "MaxDurationDays": 435,
      "TotalYouthParticipants": 16
    },
    {
      "StudyItem": "Book 6",
      "TotalActivities": 48,
      "AvgDurationDays": 234.5625,
      "MinDurationDays": 0,
      "MaxDurationDays": 839,
      "TotalYouthParticipants": 162
    },
    {
      "StudyItem": "Book 7",
      "TotalActivities": 79,
      "AvgDurationDays": 227.8227848101266,
      "MinDurationDays": 0,
      "MaxDurationDays": 602,
      "TotalYouthParticipants": 219
    }
  ]
}
```

---

2025-11-14T23:38:06.857Z

```sql
SELECT A.[Id] AS ActivityId, C.[Name] AS ClusterName, L.[Name] AS LocalityName, LSI.[Name] AS StudyItem, A.[StartDate], A.[EndDate], DATEDIFF(day, A.[StartDate], A.[EndDate]) AS DurationDays, DATEDIFF(week, A.[StartDate], A.[EndDate]) AS DurationWeeks, COUNT(DISTINCT I.[Id]) AS YouthParticipants, AVG(DATEDIFF(year, I.[BirthDate], A.[StartDate])) AS AvgAge FROM [Activities] A INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id] INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id] INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND LSI.[Language] = 'en-US' AND DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND A.[EndDate] IS NOT NULL AND I.[IsArchived] = 0 GROUP BY A.[Id], C.[Name], L.[Name], LSI.[Name], A.[StartDate], A.[EndDate] ORDER BY LSI.[Name], A.[StartDate]
```

```json
{
  "rowCount": 300,
  "rows": [
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "YouthParticipants": 3,
      "AvgAge": 18
    },
    {
      "ActivityId": "1221",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2015-10-19T07:00:00.000Z",
      "EndDate": "2015-12-01T08:00:00.000Z",
      "DurationDays": 43,
      "DurationWeeks": 6,
      "YouthParticipants": 1,
      "AvgAge": 19
    },
    {
      "ActivityId": "1245",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2016-02-14T08:00:00.000Z",
      "EndDate": "2017-03-02T08:00:00.000Z",
      "DurationDays": 382,
      "DurationWeeks": 54,
      "YouthParticipants": 1,
      "AvgAge": 25
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "YouthParticipants": 5,
      "AvgAge": 20
    },
    {
      "ActivityId": "990",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "YouthParticipants": 2,
      "AvgAge": 18
    },
    {
      "ActivityId": "517",
      "ClusterName": "CA:NC08 East Bay",
      "LocalityName": "San Pablo",
      "StudyItem": "Book 5",
      "StartDate": "2016-08-02T07:00:00.000Z",
      "EndDate": "2017-07-01T07:00:00.000Z",
      "DurationDays": 333,
      "DurationWeeks": 47,
      "YouthParticipants": 8,
      "AvgAge": 18
    },
    {
      "ActivityId": "4",
      "ClusterName": "CA:NI08 Tuolumne-Calaveras Counties",
      "LocalityName": "Sonora",
      "StudyItem": "Book 5",
      "StartDate": "2016-08-28T07:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 216,
      "DurationWeeks": 30,
      "YouthParticipants": 7,
      "AvgAge": 17
    },
    {
      "ActivityId": "25",
      "ClusterName": "CA:NI02 Exeter-Visalia",
      "LocalityName": "Visalia",
      "StudyItem": "Book 5",
      "StartDate": "2016-09-19T07:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 255,
      "DurationWeeks": 36,
      "YouthParticipants": 1,
      "AvgAge": 16
    },
    {
      "ActivityId": "1028",
      "ClusterName": "CA:NC16 Contra Costa County East (Concord)",
      "LocalityName": "Concord",
      "StudyItem": "Book 5",
      "StartDate": "2016-09-25T07:00:00.000Z",
      "EndDate": "2017-05-29T07:00:00.000Z",
      "DurationDays": 246,
      "DurationWeeks": 35,
      "YouthParticipants": 4,
      "AvgAge": 18
    },
    {
      "ActivityId": "12",
      "ClusterName": "CA:NI13 Grass Valley",
      "LocalityName": "Nevada City",
      "StudyItem": "Book 5",
      "StartDate": "2016-10-09T07:00:00.000Z",
      "EndDate": "2017-03-29T07:00:00.000Z",
      "DurationDays": 171,
      "DurationWeeks": 24,
      "YouthParticipants": 1,
      "AvgAge": 17
    },
    "... 290 results omitted ..."
  ]
}
```

---

2025-11-14T23:40:28.120Z

```sql
SELECT ROW_NUMBER() OVER (ORDER BY LSI.[Name], A.[StartDate]) AS ActivityKey, A.[Id] AS ActivityId, C.[Name] AS ClusterName, L.[Name] AS LocalityName, LSI.[Name] AS StudyItem, A.[StartDate], A.[EndDate], DATEDIFF(day, A.[StartDate], A.[EndDate]) AS DurationDays, DATEDIFF(week, A.[StartDate], A.[EndDate]) AS DurationWeeks, COUNT(DISTINCT I.[Id]) AS YouthParticipants, AVG(DATEDIFF(year, I.[BirthDate], A.[StartDate])) AS AvgAge FROM [Activities] A INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id] INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id] INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND LSI.[Language] = 'en-US' AND DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND A.[EndDate] IS NOT NULL AND I.[IsArchived] = 0 GROUP BY A.[Id], C.[Name], L.[Name], LSI.[Name], A.[StartDate], A.[EndDate] ORDER BY LSI.[Name], A.[StartDate]
```

```json
{
  "rowCount": 300,
  "rows": [
    {
      "ActivityKey": "1",
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "YouthParticipants": 3,
      "AvgAge": 18
    },
    {
      "ActivityKey": "2",
      "ActivityId": "1221",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2015-10-19T07:00:00.000Z",
      "EndDate": "2015-12-01T08:00:00.000Z",
      "DurationDays": 43,
      "DurationWeeks": 6,
      "YouthParticipants": 1,
      "AvgAge": 19
    },
    {
      "ActivityKey": "3",
      "ActivityId": "1245",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2016-02-14T08:00:00.000Z",
      "EndDate": "2017-03-02T08:00:00.000Z",
      "DurationDays": 382,
      "DurationWeeks": 54,
      "YouthParticipants": 1,
      "AvgAge": 25
    },
    {
      "ActivityKey": "4",
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "YouthParticipants": 5,
      "AvgAge": 20
    },
    {
      "ActivityKey": "5",
      "ActivityId": "990",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "YouthParticipants": 2,
      "AvgAge": 18
    },
    {
      "ActivityKey": "6",
      "ActivityId": "517",
      "ClusterName": "CA:NC08 East Bay",
      "LocalityName": "San Pablo",
      "StudyItem": "Book 5",
      "StartDate": "2016-08-02T07:00:00.000Z",
      "EndDate": "2017-07-01T07:00:00.000Z",
      "DurationDays": 333,
      "DurationWeeks": 47,
      "YouthParticipants": 8,
      "AvgAge": 18
    },
    {
      "ActivityKey": "7",
      "ActivityId": "4",
      "ClusterName": "CA:NI08 Tuolumne-Calaveras Counties",
      "LocalityName": "Sonora",
      "StudyItem": "Book 5",
      "StartDate": "2016-08-28T07:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 216,
      "DurationWeeks": 30,
      "YouthParticipants": 7,
      "AvgAge": 17
    },
    {
      "ActivityKey": "8",
      "ActivityId": "25",
      "ClusterName": "CA:NI02 Exeter-Visalia",
      "LocalityName": "Visalia",
      "StudyItem": "Book 5",
      "StartDate": "2016-09-19T07:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 255,
      "DurationWeeks": 36,
      "YouthParticipants": 1,
      "AvgAge": 16
    },
    {
      "ActivityKey": "9",
      "ActivityId": "1028",
      "ClusterName": "CA:NC16 Contra Costa County East (Concord)",
      "LocalityName": "Concord",
      "StudyItem": "Book 5",
      "StartDate": "2016-09-25T07:00:00.000Z",
      "EndDate": "2017-05-29T07:00:00.000Z",
      "DurationDays": 246,
      "DurationWeeks": 35,
      "YouthParticipants": 4,
      "AvgAge": 18
    },
    {
      "ActivityKey": "10",
      "ActivityId": "12",
      "ClusterName": "CA:NI13 Grass Valley",
      "LocalityName": "Nevada City",
      "StudyItem": "Book 5",
      "StartDate": "2016-10-09T07:00:00.000Z",
      "EndDate": "2017-03-29T07:00:00.000Z",
      "DurationDays": 171,
      "DurationWeeks": 24,
      "YouthParticipants": 1,
      "AvgAge": 17
    },
    "... 290 results omitted ..."
  ]
}
```

---

2025-11-14T23:40:43.415Z

```sql
WITH ActivityKeys AS (SELECT ROW_NUMBER() OVER (ORDER BY LSI.[Name], A.[StartDate]) AS ActivityKey, A.[Id] AS ActivityId FROM [Activities] A INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND LSI.[Language] = 'en-US' AND DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND A.[EndDate] IS NOT NULL AND I.[IsArchived] = 0 GROUP BY A.[Id], LSI.[Name], A.[StartDate]) SELECT AK.[ActivityKey], A.[Id] AS ActivityId, I.[FirstName], I.[FamilyName], I.[Gender], DATEDIFF(year, I.[BirthDate], A.[StartDate]) AS AgeAtStart, I.[BirthDate], A.[StartDate] AS ActivityStartDate FROM ActivityKeys AK INNER JOIN [Activities] A ON AK.[ActivityId] = A.[Id] INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND I.[IsArchived] = 0 ORDER BY AK.[ActivityKey], I.[FamilyName], I.[FirstName]
```

```json
{
  "rowCount": 935,
  "rows": [
    {
      "ActivityKey": "1",
      "ActivityId": "974",
      "FirstName": "Natalie",
      "FamilyName": "Gonzalez",
      "Gender": 0,
      "AgeAtStart": 21,
      "BirthDate": "1994-12-16T08:00:00.000Z",
      "ActivityStartDate": "2015-07-13T07:00:00.000Z"
    },
    {
      "ActivityKey": "1",
      "ActivityId": "974",
      "FirstName": "Juan Manuel",
      "FamilyName": "Guillen",
      "Gender": 1,
      "AgeAtStart": 18,
      "BirthDate": "1997-03-17T08:00:00.000Z",
      "ActivityStartDate": "2015-07-13T07:00:00.000Z"
    },
    {
      "ActivityKey": "1",
      "ActivityId": "974",
      "FirstName": "Christian",
      "FamilyName": "Hunt",
      "Gender": 1,
      "AgeAtStart": 17,
      "BirthDate": "1998-01-01T08:00:00.000Z",
      "ActivityStartDate": "2015-07-13T07:00:00.000Z"
    },
    {
      "ActivityKey": "2",
      "ActivityId": "1221",
      "FirstName": "Juan Carlos (Juancarlos / JC)",
      "FamilyName": "Figueroa",
      "Gender": 1,
      "AgeAtStart": 19,
      "BirthDate": "1996-05-14T07:00:00.000Z",
      "ActivityStartDate": "2015-10-19T07:00:00.000Z"
    },
    {
      "ActivityKey": "3",
      "ActivityId": "1245",
      "FirstName": "Nakisa",
      "FamilyName": "Ahmadiiveli",
      "Gender": 0,
      "AgeAtStart": 25,
      "BirthDate": "1991-08-14T07:00:00.000Z",
      "ActivityStartDate": "2016-02-14T08:00:00.000Z"
    },
    {
      "ActivityKey": "4",
      "ActivityId": "990",
      "FirstName": "Yeimy Lucia",
      "FamilyName": "Hernandez",
      "Gender": 0,
      "AgeAtStart": 18,
      "BirthDate": "1998-10-09T07:00:00.000Z",
      "ActivityStartDate": "2016-03-01T08:00:00.000Z"
    },
    {
      "ActivityKey": "4",
      "ActivityId": "990",
      "FirstName": "Christian",
      "FamilyName": "Hunt",
      "Gender": 1,
      "AgeAtStart": 18,
      "BirthDate": "1998-01-01T08:00:00.000Z",
      "ActivityStartDate": "2016-03-01T08:00:00.000Z"
    },
    {
      "ActivityKey": "5",
      "ActivityId": "977",
      "FirstName": "Kevin",
      "FamilyName": "Flores",
      "Gender": 1,
      "AgeAtStart": 23,
      "BirthDate": "1993-01-01T08:00:00.000Z",
      "ActivityStartDate": "2016-03-01T08:00:00.000Z"
    },
    {
      "ActivityKey": "5",
      "ActivityId": "977",
      "FirstName": "Natalie",
      "FamilyName": "Gonzalez",
      "Gender": 0,
      "AgeAtStart": 22,
      "BirthDate": "1994-12-16T08:00:00.000Z",
      "ActivityStartDate": "2016-03-01T08:00:00.000Z"
    },
    {
      "ActivityKey": "5",
      "ActivityId": "977",
      "FirstName": "Yeimy Lucia",
      "FamilyName": "Hernandez",
      "Gender": 0,
      "AgeAtStart": 18,
      "BirthDate": "1998-10-09T07:00:00.000Z",
      "ActivityStartDate": "2016-03-01T08:00:00.000Z"
    },
    "... 925 results omitted ..."
  ]
}
```

---

2025-11-14T23:46:10.558Z

```sql
SELECT A.[Id] AS ActivityId, C.[Name] AS ClusterName, L.[Name] AS LocalityName, LSI.[Name] AS StudyItem, A.[StartDate], A.[EndDate], DATEDIFF(day, A.[StartDate], A.[EndDate]) AS DurationDays, DATEDIFF(week, A.[StartDate], A.[EndDate]) AS DurationWeeks, COUNT(DISTINCT I.[Id]) AS YouthParticipants, AVG(DATEDIFF(year, I.[BirthDate], A.[StartDate])) AS AvgAge FROM [Activities] A INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id] INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id] INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND LSI.[Language] = 'en-US' AND DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND A.[EndDate] IS NOT NULL AND I.[IsArchived] = 0 GROUP BY A.[Id], C.[Name], L.[Name], LSI.[Name], A.[StartDate], A.[EndDate] ORDER BY LSI.[Name], A.[StartDate]
```

```json
{
  "rowCount": 300,
  "rows": [
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "YouthParticipants": 3,
      "AvgAge": 18
    },
    {
      "ActivityId": "1221",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2015-10-19T07:00:00.000Z",
      "EndDate": "2015-12-01T08:00:00.000Z",
      "DurationDays": 43,
      "DurationWeeks": 6,
      "YouthParticipants": 1,
      "AvgAge": 19
    },
    {
      "ActivityId": "1245",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2016-02-14T08:00:00.000Z",
      "EndDate": "2017-03-02T08:00:00.000Z",
      "DurationDays": 382,
      "DurationWeeks": 54,
      "YouthParticipants": 1,
      "AvgAge": 25
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "YouthParticipants": 5,
      "AvgAge": 20
    },
    {
      "ActivityId": "990",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "YouthParticipants": 2,
      "AvgAge": 18
    },
    {
      "ActivityId": "517",
      "ClusterName": "CA:NC08 East Bay",
      "LocalityName": "San Pablo",
      "StudyItem": "Book 5",
      "StartDate": "2016-08-02T07:00:00.000Z",
      "EndDate": "2017-07-01T07:00:00.000Z",
      "DurationDays": 333,
      "DurationWeeks": 47,
      "YouthParticipants": 8,
      "AvgAge": 18
    },
    {
      "ActivityId": "4",
      "ClusterName": "CA:NI08 Tuolumne-Calaveras Counties",
      "LocalityName": "Sonora",
      "StudyItem": "Book 5",
      "StartDate": "2016-08-28T07:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 216,
      "DurationWeeks": 30,
      "YouthParticipants": 7,
      "AvgAge": 17
    },
    {
      "ActivityId": "25",
      "ClusterName": "CA:NI02 Exeter-Visalia",
      "LocalityName": "Visalia",
      "StudyItem": "Book 5",
      "StartDate": "2016-09-19T07:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 255,
      "DurationWeeks": 36,
      "YouthParticipants": 1,
      "AvgAge": 16
    },
    {
      "ActivityId": "1028",
      "ClusterName": "CA:NC16 Contra Costa County East (Concord)",
      "LocalityName": "Concord",
      "StudyItem": "Book 5",
      "StartDate": "2016-09-25T07:00:00.000Z",
      "EndDate": "2017-05-29T07:00:00.000Z",
      "DurationDays": 246,
      "DurationWeeks": 35,
      "YouthParticipants": 4,
      "AvgAge": 18
    },
    {
      "ActivityId": "12",
      "ClusterName": "CA:NI13 Grass Valley",
      "LocalityName": "Nevada City",
      "StudyItem": "Book 5",
      "StartDate": "2016-10-09T07:00:00.000Z",
      "EndDate": "2017-03-29T07:00:00.000Z",
      "DurationDays": 171,
      "DurationWeeks": 24,
      "YouthParticipants": 1,
      "AvgAge": 17
    },
    "... 290 results omitted ..."
  ]
}
```

---

2025-11-14T23:46:21.509Z

```sql
SELECT A.[Id] AS ActivityId, I.[FirstName], I.[FamilyName], I.[Gender], DATEDIFF(year, I.[BirthDate], A.[StartDate]) AS AgeAtStart, I.[BirthDate], A.[StartDate] AS ActivityStartDate FROM [Activities] A INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND A.[EndDate] IS NOT NULL AND I.[IsArchived] = 0 ORDER BY A.[Id], I.[FamilyName], I.[FirstName]
```

```json
{
  "rowCount": 935,
  "rows": [
    {
      "ActivityId": "4",
      "FirstName": "Erik",
      "FamilyName": null,
      "Gender": 1,
      "AgeAtStart": 18,
      "BirthDate": "1998-01-01T08:00:00.000Z",
      "ActivityStartDate": "2016-08-28T07:00:00.000Z"
    },
    {
      "ActivityId": "4",
      "FirstName": "Ian",
      "FamilyName": null,
      "Gender": 1,
      "AgeAtStart": 18,
      "BirthDate": "1998-01-01T08:00:00.000Z",
      "ActivityStartDate": "2016-08-28T07:00:00.000Z"
    },
    {
      "ActivityId": "4",
      "FirstName": "Jade",
      "FamilyName": null,
      "Gender": 0,
      "AgeAtStart": 18,
      "BirthDate": "1998-01-01T08:00:00.000Z",
      "ActivityStartDate": "2016-08-28T07:00:00.000Z"
    },
    {
      "ActivityId": "4",
      "FirstName": "Savannah",
      "FamilyName": null,
      "Gender": 0,
      "AgeAtStart": 18,
      "BirthDate": "1998-01-01T08:00:00.000Z",
      "ActivityStartDate": "2016-08-28T07:00:00.000Z"
    },
    {
      "ActivityId": "4",
      "FirstName": "Tomi",
      "FamilyName": null,
      "Gender": 0,
      "AgeAtStart": 18,
      "BirthDate": "1998-01-01T08:00:00.000Z",
      "ActivityStartDate": "2016-08-28T07:00:00.000Z"
    },
    {
      "ActivityId": "4",
      "FirstName": "Tyler",
      "FamilyName": null,
      "Gender": 1,
      "AgeAtStart": 18,
      "BirthDate": "1998-01-01T08:00:00.000Z",
      "ActivityStartDate": "2016-08-28T07:00:00.000Z"
    },
    {
      "ActivityId": "4",
      "FirstName": "Caelan Sebastian",
      "FamilyName": "Winslow",
      "Gender": 1,
      "AgeAtStart": 16,
      "BirthDate": "2000-03-24T08:00:00.000Z",
      "ActivityStartDate": "2016-08-28T07:00:00.000Z"
    },
    {
      "ActivityId": "12",
      "FirstName": "Haven",
      "FamilyName": "Masters",
      "Gender": 0,
      "AgeAtStart": 17,
      "BirthDate": "1999-09-28T07:00:00.000Z",
      "ActivityStartDate": "2016-10-09T07:00:00.000Z"
    },
    {
      "ActivityId": "25",
      "FirstName": "Tiaam Alexander",
      "FamilyName": "Majzoubi",
      "Gender": 1,
      "AgeAtStart": 16,
      "BirthDate": "2000-11-16T08:00:00.000Z",
      "ActivityStartDate": "2016-09-19T07:00:00.000Z"
    },
    {
      "ActivityId": "27",
      "FirstName": "Chaz",
      "FamilyName": null,
      "Gender": 1,
      "AgeAtStart": 16,
      "BirthDate": "2000-01-01T08:00:00.000Z",
      "ActivityStartDate": "2016-12-03T08:00:00.000Z"
    },
    "... 925 results omitted ..."
  ]
}
```

---

2025-11-14T23:48:47.021Z

```sql
SELECT A.[Id] AS ActivityId, C.[Name] AS ClusterName, L.[Name] AS LocalityName, LSI.[Name] AS StudyItem, A.[StartDate], A.[EndDate], DATEDIFF(day, A.[StartDate], A.[EndDate]) AS DurationDays, DATEDIFF(week, A.[StartDate], A.[EndDate]) AS DurationWeeks, I.[FirstName], I.[FamilyName], I.[Gender], DATEDIFF(year, I.[BirthDate], A.[StartDate]) AS AgeAtStart, I.[BirthDate] FROM [Activities] A INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id] INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id] INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND LSI.[Language] = 'en-US' AND DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND A.[EndDate] IS NOT NULL AND I.[IsArchived] = 0 ORDER BY LSI.[Name], A.[StartDate], I.[FamilyName], I.[FirstName]
```

```json
{
  "rowCount": 935,
  "rows": [
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "FirstName": "Natalie",
      "FamilyName": "Gonzalez",
      "Gender": 0,
      "AgeAtStart": 21,
      "BirthDate": "1994-12-16T08:00:00.000Z"
    },
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "FirstName": "Juan Manuel",
      "FamilyName": "Guillen",
      "Gender": 1,
      "AgeAtStart": 18,
      "BirthDate": "1997-03-17T08:00:00.000Z"
    },
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "FirstName": "Christian",
      "FamilyName": "Hunt",
      "Gender": 1,
      "AgeAtStart": 17,
      "BirthDate": "1998-01-01T08:00:00.000Z"
    },
    {
      "ActivityId": "1221",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2015-10-19T07:00:00.000Z",
      "EndDate": "2015-12-01T08:00:00.000Z",
      "DurationDays": 43,
      "DurationWeeks": 6,
      "FirstName": "Juan Carlos (Juancarlos / JC)",
      "FamilyName": "Figueroa",
      "Gender": 1,
      "AgeAtStart": 19,
      "BirthDate": "1996-05-14T07:00:00.000Z"
    },
    {
      "ActivityId": "1245",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2016-02-14T08:00:00.000Z",
      "EndDate": "2017-03-02T08:00:00.000Z",
      "DurationDays": 382,
      "DurationWeeks": 54,
      "FirstName": "Nakisa",
      "FamilyName": "Ahmadiiveli",
      "Gender": 0,
      "AgeAtStart": 25,
      "BirthDate": "1991-08-14T07:00:00.000Z"
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "FirstName": "Kevin",
      "FamilyName": "Flores",
      "Gender": 1,
      "AgeAtStart": 23,
      "BirthDate": "1993-01-01T08:00:00.000Z"
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "FirstName": "Natalie",
      "FamilyName": "Gonzalez",
      "Gender": 0,
      "AgeAtStart": 22,
      "BirthDate": "1994-12-16T08:00:00.000Z"
    },
    {
      "ActivityId": "990",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "FirstName": "Yeimy Lucia",
      "FamilyName": "Hernandez",
      "Gender": 0,
      "AgeAtStart": 18,
      "BirthDate": "1998-10-09T07:00:00.000Z"
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "FirstName": "Yeimy Lucia",
      "FamilyName": "Hernandez",
      "Gender": 0,
      "AgeAtStart": 18,
      "BirthDate": "1998-10-09T07:00:00.000Z"
    },
    {
      "ActivityId": "990",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "FirstName": "Christian",
      "FamilyName": "Hunt",
      "Gender": 1,
      "AgeAtStart": 18,
      "BirthDate": "1998-01-01T08:00:00.000Z"
    },
    "... 925 results omitted ..."
  ]
}
```

---

2025-11-14T23:55:22.250Z

```sql
SELECT 
    I.[FirstName] + ' ' + I.[FamilyName] AS [ParticipantName],
    LSI.[Name] AS [ActivityName],
    C.[Name] AS [ClusterName],
    A.[DisplayStartDate] AS [StartDate],
    COALESCE(A.[DisplayEndDate], ASII.[DisplayEndDate]) AS [EndDate],
    DATEDIFF(day, A.[StartDate], COALESCE(A.[EndDate], ASII.[EndDate])) AS [TotalDays],
    DATEDIFF(year, I.[BirthDate], COALESCE(A.[EndDate], ASII.[EndDate])) AS [AgeAtCompletion]
FROM [Individuals] I
INNER JOIN [ActivityStudyItemIndividuals] ASII ON I.[Id] = ASII.[IndividualId]
INNER JOIN [Activities] A ON ASII.[ActivityId] = A.[Id]
INNER JOIN [StudyItems] SI ON ASII.[StudyItemId] = SI.[Id]
INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId]
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[FirstName] = 'Natalie' 
    AND I.[FamilyName] = 'Gonzalez'
    AND ASII.[IsCompleted] = 1
    AND LSI.[Language] = 'en-US'
    AND I.[IsArchived] = 0
ORDER BY COALESCE(A.[EndDate], ASII.[EndDate])
```

```json
{
  "rowCount": 27,
  "rows": [
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 6",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2015-08-05",
      "EndDate": "2016-02",
      "TotalDays": 180,
      "AgeAtCompletion": 22
    },
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 5",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2015-07-13",
      "EndDate": "2016-03",
      "TotalDays": 232,
      "AgeAtCompletion": 22
    },
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 1",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2016-08-01",
      "EndDate": "2016-09",
      "TotalDays": 31,
      "AgeAtCompletion": 22
    },
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 5",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2016-03-01",
      "EndDate": "2017-04",
      "TotalDays": 396,
      "AgeAtCompletion": 23
    },
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 1",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2016-07",
      "EndDate": "2018-01",
      "TotalDays": 549,
      "AgeAtCompletion": 24
    },
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 2",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2017-12",
      "EndDate": "2019-06",
      "TotalDays": 547,
      "AgeAtCompletion": 25
    },
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 3 (G1)",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2019-01-01",
      "EndDate": "2019-06-23",
      "TotalDays": 173,
      "AgeAtCompletion": 25
    },
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 3 (G1)",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2019-01",
      "EndDate": "2019-06-23",
      "TotalDays": 173,
      "AgeAtCompletion": 25
    },
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 2",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2018-01",
      "EndDate": "2019-12",
      "TotalDays": 699,
      "AgeAtCompletion": 25
    },
    {
      "ParticipantName": "Natalie Gonzalez",
      "ActivityName": "Book 5",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "StartDate": "2019-08-22",
      "EndDate": "2019-12",
      "TotalDays": 101,
      "AgeAtCompletion": 25
    },
    "... 17 results omitted ..."
  ]
}
```

---

2025-11-14T23:59:25.134Z

```sql
SELECT DISTINCT [IndividualRole], COUNT(*) AS Count FROM [ActivityStudyItemIndividuals] GROUP BY [IndividualRole] ORDER BY [IndividualRole]
```

```json
{
  "rowCount": 7,
  "rows": [
    {
      "IndividualRole": 1,
      "Count": 2335
    },
    {
      "IndividualRole": 2,
      "Count": 180
    },
    {
      "IndividualRole": 3,
      "Count": 4101
    },
    {
      "IndividualRole": 4,
      "Count": 336
    },
    {
      "IndividualRole": 5,
      "Count": 12720
    },
    {
      "IndividualRole": 6,
      "Count": 321
    },
    {
      "IndividualRole": 7,
      "Count": 95139
    }
  ]
}
```

---

2025-11-14T23:59:33.034Z

```sql
SELECT TOP 20 ASII.[IndividualRole], ASII.[IndividualType], A.[ActivityType], I.[FirstName], I.[FamilyName] FROM [ActivityStudyItemIndividuals] ASII INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] INNER JOIN [Activities] A ON ASII.[ActivityId] = A.[Id] WHERE A.[ActivityType] = 2 ORDER BY ASII.[IndividualRole]
```

```json
{
  "rowCount": 20,
  "rows": [
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Selena   #OS",
      "FamilyName": "Trotter"
    },
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Joy    #DV",
      "FamilyName": "Behi Judd"
    },
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Jerome (Jerry)",
      "FamilyName": "Schreiber"
    },
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Christina Michelle \"Chris\"",
      "FamilyName": "Wright"
    },
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Erfan",
      "FamilyName": "Alizadeh Asl"
    },
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Mary  Ann",
      "FamilyName": "Perdue"
    },
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Erfan",
      "FamilyName": "Alizadeh Asl"
    },
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Joan",
      "FamilyName": "Fogg"
    },
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Selena   #OS",
      "FamilyName": "Trotter"
    },
    {
      "IndividualRole": 5,
      "IndividualType": 0,
      "ActivityType": 2,
      "FirstName": "Joy    #DV",
      "FamilyName": "Behi Judd"
    },
    "... 10 results omitted ..."
  ]
}
```

---

2025-11-14T23:59:46.180Z

```sql
SELECT A.[Id] AS ActivityId, C.[Name] AS ClusterName, L.[Name] AS LocalityName, LSI.[Name] AS StudyItem, A.[StartDate], A.[EndDate], DATEDIFF(day, A.[StartDate], A.[EndDate]) AS DurationDays, DATEDIFF(week, A.[StartDate], A.[EndDate]) AS DurationWeeks, I.[FirstName], I.[FamilyName], I.[Gender], DATEDIFF(year, I.[BirthDate], A.[StartDate]) AS AgeAtStart, ASII.[IndividualRole], CASE WHEN ASII.[IndividualRole] = 5 THEN 'Tutor' ELSE 'Participant' END AS Role FROM [Activities] A INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id] INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id] INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND LSI.[Language] = 'en-US' AND DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND A.[EndDate] IS NOT NULL AND I.[IsArchived] = 0 ORDER BY LSI.[Name], A.[StartDate], I.[FamilyName], I.[FirstName]
```

```json
{
  "rowCount": 935,
  "rows": [
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "FirstName": "Natalie",
      "FamilyName": "Gonzalez",
      "Gender": 0,
      "AgeAtStart": 21,
      "IndividualRole": 5,
      "Role": "Tutor"
    },
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "FirstName": "Juan Manuel",
      "FamilyName": "Guillen",
      "Gender": 1,
      "AgeAtStart": 18,
      "IndividualRole": 7,
      "Role": "Participant"
    },
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "FirstName": "Christian",
      "FamilyName": "Hunt",
      "Gender": 1,
      "AgeAtStart": 17,
      "IndividualRole": 7,
      "Role": "Participant"
    },
    {
      "ActivityId": "1221",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2015-10-19T07:00:00.000Z",
      "EndDate": "2015-12-01T08:00:00.000Z",
      "DurationDays": 43,
      "DurationWeeks": 6,
      "FirstName": "Juan Carlos (Juancarlos / JC)",
      "FamilyName": "Figueroa",
      "Gender": 1,
      "AgeAtStart": 19,
      "IndividualRole": 7,
      "Role": "Participant"
    },
    {
      "ActivityId": "1245",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2016-02-14T08:00:00.000Z",
      "EndDate": "2017-03-02T08:00:00.000Z",
      "DurationDays": 382,
      "DurationWeeks": 54,
      "FirstName": "Nakisa",
      "FamilyName": "Ahmadiiveli",
      "Gender": 0,
      "AgeAtStart": 25,
      "IndividualRole": 5,
      "Role": "Tutor"
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "FirstName": "Kevin",
      "FamilyName": "Flores",
      "Gender": 1,
      "AgeAtStart": 23,
      "IndividualRole": 7,
      "Role": "Participant"
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "FirstName": "Natalie",
      "FamilyName": "Gonzalez",
      "Gender": 0,
      "AgeAtStart": 22,
      "IndividualRole": 5,
      "Role": "Tutor"
    },
    {
      "ActivityId": "990",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "FirstName": "Yeimy Lucia",
      "FamilyName": "Hernandez",
      "Gender": 0,
      "AgeAtStart": 18,
      "IndividualRole": 7,
      "Role": "Participant"
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "FirstName": "Yeimy Lucia",
      "FamilyName": "Hernandez",
      "Gender": 0,
      "AgeAtStart": 18,
      "IndividualRole": 7,
      "Role": "Participant"
    },
    {
      "ActivityId": "990",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "FirstName": "Christian",
      "FamilyName": "Hunt",
      "Gender": 1,
      "AgeAtStart": 18,
      "IndividualRole": 7,
      "Role": "Participant"
    },
    "... 925 results omitted ..."
  ]
}
```

---

2025-11-15T00:00:02.901Z

```sql
SELECT A.[Id] AS ActivityId, C.[Name] AS ClusterName, L.[Name] AS LocalityName, LSI.[Name] AS StudyItem, A.[StartDate], A.[EndDate], DATEDIFF(day, A.[StartDate], A.[EndDate]) AS DurationDays, DATEDIFF(week, A.[StartDate], A.[EndDate]) AS DurationWeeks, I.[FirstName], I.[FamilyName], I.[Gender], DATEDIFF(year, I.[BirthDate], A.[StartDate]) AS AgeAtStart, CASE WHEN ASII.[IndividualRole] = 5 THEN 'Tutor' ELSE 'Participant' END AS Role, ASII.[IsCompleted] AS CompletedBook FROM [Activities] A INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id] INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id] INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id] INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[ActivityType] = 2 AND SI.[Id] IN (23, 50, 51, 52, 24, 25, 53, 54) AND LSI.[Language] = 'en-US' AND DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND A.[EndDate] IS NOT NULL AND I.[IsArchived] = 0 ORDER BY LSI.[Name], A.[StartDate], I.[FamilyName], I.[FirstName]
```

```json
{
  "rowCount": 935,
  "rows": [
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "FirstName": "Natalie",
      "FamilyName": "Gonzalez",
      "Gender": 0,
      "AgeAtStart": 21,
      "Role": "Tutor",
      "CompletedBook": true
    },
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "FirstName": "Juan Manuel",
      "FamilyName": "Guillen",
      "Gender": 1,
      "AgeAtStart": 18,
      "Role": "Participant",
      "CompletedBook": false
    },
    {
      "ActivityId": "974",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "EndDate": "2016-03-01T08:00:00.000Z",
      "DurationDays": 232,
      "DurationWeeks": 33,
      "FirstName": "Christian",
      "FamilyName": "Hunt",
      "Gender": 1,
      "AgeAtStart": 17,
      "Role": "Participant",
      "CompletedBook": true
    },
    {
      "ActivityId": "1221",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2015-10-19T07:00:00.000Z",
      "EndDate": "2015-12-01T08:00:00.000Z",
      "DurationDays": 43,
      "DurationWeeks": 6,
      "FirstName": "Juan Carlos (Juancarlos / JC)",
      "FamilyName": "Figueroa",
      "Gender": 1,
      "AgeAtStart": 19,
      "Role": "Participant",
      "CompletedBook": true
    },
    {
      "ActivityId": "1245",
      "ClusterName": "CA:SE18 San Diego",
      "LocalityName": "San Diego",
      "StudyItem": "Book 5",
      "StartDate": "2016-02-14T08:00:00.000Z",
      "EndDate": "2017-03-02T08:00:00.000Z",
      "DurationDays": 382,
      "DurationWeeks": 54,
      "FirstName": "Nakisa",
      "FamilyName": "Ahmadiiveli",
      "Gender": 0,
      "AgeAtStart": 25,
      "Role": "Tutor",
      "CompletedBook": true
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "FirstName": "Kevin",
      "FamilyName": "Flores",
      "Gender": 1,
      "AgeAtStart": 23,
      "Role": "Participant",
      "CompletedBook": true
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "FirstName": "Natalie",
      "FamilyName": "Gonzalez",
      "Gender": 0,
      "AgeAtStart": 22,
      "Role": "Tutor",
      "CompletedBook": true
    },
    {
      "ActivityId": "990",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "FirstName": "Yeimy Lucia",
      "FamilyName": "Hernandez",
      "Gender": 0,
      "AgeAtStart": 18,
      "Role": "Participant",
      "CompletedBook": true
    },
    {
      "ActivityId": "977",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-04-01T07:00:00.000Z",
      "DurationDays": 396,
      "DurationWeeks": 56,
      "FirstName": "Yeimy Lucia",
      "FamilyName": "Hernandez",
      "Gender": 0,
      "AgeAtStart": 18,
      "Role": "Participant",
      "CompletedBook": true
    },
    {
      "ActivityId": "990",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "LocalityName": "Pasadena",
      "StudyItem": "Book 5",
      "StartDate": "2016-03-01T08:00:00.000Z",
      "EndDate": "2017-06-01T07:00:00.000Z",
      "DurationDays": 457,
      "DurationWeeks": 65,
      "FirstName": "Christian",
      "FamilyName": "Hunt",
      "Gender": 1,
      "AgeAtStart": 18,
      "Role": "Participant",
      "CompletedBook": true
    },
    "... 925 results omitted ..."
  ]
}
```

---

2025-11-15T00:03:39.096Z

```sql
SELECT I.[FirstName], I.[FamilyName], I.[BirthDate], A.[StartDate], DATEDIFF(year, I.[BirthDate], A.[StartDate]) AS AgeAtStart, CASE WHEN ASII.[IndividualRole] = 5 THEN 'Tutor' ELSE 'Participant' END AS Role FROM [Activities] A INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[Id] = 974 AND I.[IsArchived] = 0 ORDER BY I.[FamilyName], I.[FirstName]
```

```json
{
  "rowCount": 3,
  "rows": [
    {
      "FirstName": "Natalie",
      "FamilyName": "Gonzalez",
      "BirthDate": "1994-12-16T08:00:00.000Z",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "AgeAtStart": 21,
      "Role": "Tutor"
    },
    {
      "FirstName": "Juan Manuel",
      "FamilyName": "Guillen",
      "BirthDate": "1997-03-17T08:00:00.000Z",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "AgeAtStart": 18,
      "Role": "Participant"
    },
    {
      "FirstName": "Christian",
      "FamilyName": "Hunt",
      "BirthDate": "1998-01-01T08:00:00.000Z",
      "StartDate": "2015-07-13T07:00:00.000Z",
      "AgeAtStart": 17,
      "Role": "Participant"
    }
  ]
}
```

---

2025-11-15T00:03:45.576Z

```sql
SELECT [Id], [FirstName], [FamilyName], [BirthDate], [IsArchived] FROM [Individuals] WHERE [FamilyName] LIKE '%Perales%' OR [FirstName] LIKE '%Wendy%'
```

```json
{
  "rowCount": 22,
  "rows": [
    {
      "Id": "526",
      "FirstName": "Wendy",
      "FamilyName": "Mather",
      "BirthDate": "1961-10-19T08:00:00.000Z",
      "IsArchived": false
    },
    {
      "Id": "2003",
      "FirstName": "Wendy",
      "FamilyName": null,
      "BirthDate": "1967-01-01T08:00:00.000Z",
      "IsArchived": false
    },
    {
      "Id": "3315",
      "FirstName": "Wendy",
      "FamilyName": null,
      "BirthDate": "2004-01-01T08:00:00.000Z",
      "IsArchived": false
    },
    {
      "Id": "3638",
      "FirstName": "Wendy",
      "FamilyName": "Darling",
      "BirthDate": "1955-06-05T07:00:00.000Z",
      "IsArchived": false
    },
    {
      "Id": "3997",
      "FirstName": "Wendy Myra",
      "FamilyName": "Scott",
      "BirthDate": "1960-05-31T07:00:00.000Z",
      "IsArchived": false
    },
    {
      "Id": "5198",
      "FirstName": "Wendy E",
      "FamilyName": "Clemons",
      "BirthDate": "1956-08-22T07:00:00.000Z",
      "IsArchived": false
    },
    {
      "Id": "6824",
      "FirstName": "Wendy",
      "FamilyName": null,
      "BirthDate": "1967-01-01T08:00:00.000Z",
      "IsArchived": false
    },
    {
      "Id": "7163",
      "FirstName": "Wendy Yamileth",
      "FamilyName": "Salazar",
      "BirthDate": "1999-09-02T07:00:00.000Z",
      "IsArchived": false
    },
    {
      "Id": "9380",
      "FirstName": "Wendy",
      "FamilyName": "Graver-Dowd",
      "BirthDate": "1990-10-10T07:00:00.000Z",
      "IsArchived": false
    },
    {
      "Id": "10790",
      "FirstName": "Wendy",
      "FamilyName": "Kleeb",
      "BirthDate": "1956-08-26T07:00:00.000Z",
      "IsArchived": false
    },
    "... 12 results omitted ..."
  ]
}
```

---

2025-11-15T00:03:56.997Z

```sql
SELECT I.[Id], I.[FirstName], I.[FamilyName], I.[BirthDate], DATEDIFF(year, I.[BirthDate], A.[StartDate]) AS AgeAtStart, CASE WHEN ASII.[IndividualRole] = 5 THEN 'Tutor' ELSE 'Participant' END AS Role FROM [Activities] A INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[Id] = 974 AND (I.[FirstName] LIKE '%Wendy%' OR I.[FamilyName] LIKE '%Perales%')
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-15T00:04:08.623Z

```sql
SELECT A.[Id], A.[TotalParticipants], A.[TotalBahai], COUNT(DISTINCT ASII.[IndividualId]) AS LinkedIndividuals, COUNT(DISTINCT CASE WHEN DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 THEN ASII.[IndividualId] END) AS YouthParticipants FROM [Activities] A INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[Id] = 974 AND I.[IsArchived] = 0 GROUP BY A.[Id], A.[TotalParticipants], A.[TotalBahai]
```

```json
{
  "error": "Error: Invalid column name 'TotalBahai'."
}
```

---

2025-11-15T00:05:29.698Z

```sql
SELECT 
    I.[FirstName] + ' ' + I.[FamilyName] AS [ParticipantName],
    LSI.[Name] AS [ActivityName],
    C.[Name] AS [ClusterName],
    A.[DisplayStartDate] AS [StartDate],
    COALESCE(A.[DisplayEndDate], ASII.[DisplayEndDate]) AS [EndDate],
    DATEDIFF(day, A.[StartDate], COALESCE(A.[EndDate], ASII.[EndDate])) AS [TotalDays],
    DATEDIFF(year, I.[BirthDate], COALESCE(A.[EndDate], ASII.[EndDate])) AS [AgeAtCompletion]
FROM [Individuals] I
INNER JOIN [ActivityStudyItemIndividuals] ASII ON I.[Id] = ASII.[IndividualId]
INNER JOIN [Activities] A ON ASII.[ActivityId] = A.[Id]
INNER JOIN [StudyItems] SI ON ASII.[StudyItemId] = SI.[Id]
INNER JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId]
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[FirstName] = 'Wendy' 
    AND I.[FamilyName] = 'Perales'
    AND ASII.[IsCompleted] = 1
    AND LSI.[Language] = 'en-US'
    AND I.[IsArchived] = 0
ORDER BY COALESCE(A.[EndDate], ASII.[EndDate])
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-15T00:05:36.581Z

```sql
SELECT 
    [Id],
    [FirstName],
    [FamilyName],
    [IsArchived]
FROM [Individuals]
WHERE [FirstName] = 'Wendy' 
    AND [FamilyName] = 'Perales'
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-15T00:05:43.372Z

```sql
SELECT 
    [FirstName],
    [FamilyName]
FROM [Individuals]
WHERE [FirstName] LIKE 'Wendy%' 
    OR [FamilyName] LIKE 'Perales%'
    OR [FirstName] LIKE 'Wend%'
ORDER BY [FirstName], [FamilyName]
```

```json
{
  "rowCount": 25,
  "rows": [
    {
      "FirstName": "Scarlet",
      "FamilyName": "Perales"
    },
    {
      "FirstName": "Wende",
      "FamilyName": "Witherspoon Gholar"
    },
    {
      "FirstName": "Wendel   #UA",
      "FamilyName": "Western"
    },
    {
      "FirstName": "Wendell",
      "FamilyName": "Harris"
    },
    {
      "FirstName": "Wendy",
      "FamilyName": null
    },
    {
      "FirstName": "Wendy",
      "FamilyName": null
    },
    {
      "FirstName": "Wendy",
      "FamilyName": null
    },
    {
      "FirstName": "Wendy",
      "FamilyName": "Alfaro"
    },
    {
      "FirstName": "Wendy",
      "FamilyName": "Darling"
    },
    {
      "FirstName": "Wendy",
      "FamilyName": "Emigdio"
    },
    "... 15 results omitted ..."
  ]
}
```

---

2025-11-15T00:06:18.448Z

```sql
SELECT A.[Id], A.[TotalParticipants], COUNT(DISTINCT ASII.[IndividualId]) AS LinkedIndividuals, COUNT(DISTINCT CASE WHEN DATEDIFF(year, I.[BirthDate], A.[StartDate]) BETWEEN 15 AND 30 AND I.[IsArchived] = 0 THEN ASII.[IndividualId] END) AS YouthParticipants FROM [Activities] A INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] INNER JOIN [Individuals] I ON ASII.[IndividualId] = I.[Id] WHERE A.[Id] = 974 GROUP BY A.[Id], A.[TotalParticipants]
```

```json
{
  "error": "Error: Invalid column name 'TotalParticipants'."
}
```

---

2025-11-15T00:06:39.068Z

```sql
SELECT 
    I.[Id],
    I.[FirstName],
    I.[FamilyName],
    L.[Name] AS [LocalityName],
    C.[Name] AS [ClusterName],
    I.[IsArchived]
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[FirstName] = 'Wendy' 
    AND L.[Name] LIKE '%Mundelein%'
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-15T00:06:50.104Z

```sql
SELECT 
    I.[Id],
    I.[FirstName],
    I.[FamilyName],
    L.[Name] AS [LocalityName],
    C.[Name] AS [ClusterName],
    I.[IsArchived]
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[FamilyName] = 'Perales'
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "Id": "14486",
      "FirstName": "Scarlet",
      "FamilyName": "Perales",
      "LocalityName": "Pasadena",
      "ClusterName": "CA:SW06 San Gabriel Valley",
      "IsArchived": false
    }
  ]
}
```

---

2025-11-15T00:06:51.404Z

```sql
SELECT DISTINCT
    [Name]
FROM [Localities]
WHERE [Name] LIKE '%Mundelein%' OR [Name] LIKE '%Mundel%'
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-15T00:06:57.910Z

```sql
SELECT 
    [Id],
    [Name]
FROM [Localities]
WHERE [Name] LIKE '%Mun%' 
    OR [Name] LIKE '%mund%'
    OR [Name] LIKE '%lein%'
ORDER BY [Name]
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "Id": "652",
      "Name": "Woodfords Community"
    }
  ]
}
```

---

2025-11-15T00:07:06.069Z

```sql
SELECT 
    I.[Id],
    I.[FirstName],
    I.[FamilyName],
    L.[Name] AS [LocalityName],
    C.[Name] AS [ClusterName],
    I.[IsArchived]
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE I.[FirstName] = 'Wendy'
ORDER BY I.[FamilyName]
```

```json
{
  "rowCount": 16,
  "rows": [
    {
      "Id": "6824",
      "FirstName": "Wendy",
      "FamilyName": null,
      "LocalityName": "Los Angeles",
      "ClusterName": "CA:SW01 Los Angeles",
      "IsArchived": false
    },
    {
      "Id": "2003",
      "FirstName": "Wendy",
      "FamilyName": null,
      "LocalityName": "Stockton",
      "ClusterName": "CA:NI09 Stockton",
      "IsArchived": false
    },
    {
      "Id": "3315",
      "FirstName": "Wendy",
      "FamilyName": null,
      "LocalityName": "Hayward",
      "ClusterName": "CA:NC03 Alameda County South (Fremont)",
      "IsArchived": false
    },
    {
      "Id": "23573",
      "FirstName": "Wendy",
      "FamilyName": "Alfaro",
      "LocalityName": "Modesto",
      "ClusterName": "CA:NI07 Stanislaus County",
      "IsArchived": false
    },
    {
      "Id": "3638",
      "FirstName": "Wendy",
      "FamilyName": "Darling",
      "LocalityName": "Oceanside",
      "ClusterName": "CA:SE15 San Diego North Coast",
      "IsArchived": false
    },
    {
      "Id": "19339",
      "FirstName": "Wendy",
      "FamilyName": "Emigdio",
      "LocalityName": "San Diego",
      "ClusterName": "CA:SE18 San Diego",
      "IsArchived": false
    },
    {
      "Id": "9380",
      "FirstName": "Wendy",
      "FamilyName": "Graver-Dowd",
      "LocalityName": "San Ramon",
      "ClusterName": "CA:NC02 Alameda County Central (Pleasanton)",
      "IsArchived": false
    },
    {
      "Id": "15829",
      "FirstName": "Wendy",
      "FamilyName": "Jimenez",
      "LocalityName": "Sunnyvale",
      "ClusterName": "CA:NC04 Santa Clara County West",
      "IsArchived": false
    },
    {
      "Id": "21640",
      "FirstName": "Wendy",
      "FamilyName": "Keedy",
      "LocalityName": "Rocklin",
      "ClusterName": "CA:NI11 Placer County",
      "IsArchived": true
    },
    {
      "Id": "10790",
      "FirstName": "Wendy",
      "FamilyName": "Kleeb",
      "LocalityName": "Irvine",
      "ClusterName": "CA:SE16 Orange County Central",
      "IsArchived": false
    },
    "... 6 results omitted ..."
  ]
}
```

---

2025-11-15T00:07:16.183Z

```sql
SELECT TOP 20
    L.[Name] AS [LocalityName],
    C.[Name] AS [ClusterName]
FROM [Localities] L
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE C.[Name] NOT LIKE 'CA:%'
ORDER BY C.[Name]
```

```json
{
  "rowCount": 0,
  "rows": []
}
```

---

2025-11-15T00:08:31.913Z

```sql
SELECT COUNT(DISTINCT ASII.[IndividualId]) AS TotalLinkedIndividuals FROM [Activities] A INNER JOIN [ActivityStudyItems] ASI ON A.[Id] = ASI.[ActivityId] INNER JOIN [ActivityStudyItemIndividuals] ASII ON ASI.[Id] = ASII.[ActivityStudyItemId] WHERE A.[Id] = 974
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "TotalLinkedIndividuals": 3
    }
  ]
}
```

---

2025-11-17T18:37:07.082Z

```sql
SELECT TOP 5 [ActivityType], COUNT(*) as Count FROM [Activities] GROUP BY [ActivityType] ORDER BY [ActivityType]
```

```json
{
  "rowCount": 3,
  "rows": [
    {
      "ActivityType": 0,
      "Count": 586
    },
    {
      "ActivityType": 1,
      "Count": 600
    },
    {
      "ActivityType": 2,
      "Count": 4837
    }
  ]
}
```

---

2025-11-17T18:38:24.674Z

```sql
SELECT DISTINCT [IndividualRole], COUNT(*) as Count FROM [ActivityStudyItemIndividuals] GROUP BY [IndividualRole] ORDER BY [IndividualRole]
```

```json
{
  "rowCount": 7,
  "rows": [
    {
      "IndividualRole": 1,
      "Count": 2335
    },
    {
      "IndividualRole": 2,
      "Count": 180
    },
    {
      "IndividualRole": 3,
      "Count": 4101
    },
    {
      "IndividualRole": 4,
      "Count": 336
    },
    {
      "IndividualRole": 5,
      "Count": 12720
    },
    {
      "IndividualRole": 6,
      "Count": 321
    },
    {
      "IndividualRole": 7,
      "Count": 95139
    }
  ]
}
```

---

2025-11-17T18:57:55.290Z

```sql
SELECT 
    MIN([EndDate]) AS EarliestCompletion,
    MAX([EndDate]) AS LatestCompletion,
    COUNT(*) AS TotalCompletions,
    SUM(CASE WHEN [EndDate] > GETDATE() THEN 1 ELSE 0 END) AS FutureCompletions
FROM [ActivityStudyItemIndividuals]
WHERE [IsCompleted] = 1 
    AND [EndDate] IS NOT NULL
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "EarliestCompletion": "1900-01-01T08:00:00.000Z",
      "LatestCompletion": "2025-10-13T07:00:00.000Z",
      "TotalCompletions": 36822,
      "FutureCompletions": 0
    }
  ]
}
```

---

2025-11-17T18:58:14.547Z

```sql
WITH FilteredCompletions AS (
    SELECT
        asii.[EndDate] AS CompletionDate,
        YEAR(asii.[EndDate]) AS CompletionYear,
        si.[Sequence] AS BookNumber
    FROM
        [ActivityStudyItemIndividuals] asii
        INNER JOIN [Individuals] i ON asii.[IndividualId] = i.[Id]
        INNER JOIN [ActivityStudyItems] asi ON asii.[ActivityStudyItemId] = asi.[Id]
        INNER JOIN [StudyItems] si ON asii.[StudyItemId] = si.[Id]
        INNER JOIN [Localities] l ON i.[LocalityId] = l.[Id]
        INNER JOIN [Clusters] c ON l.[ClusterId] = c.[Id]
        INNER JOIN [Regions] r ON c.[RegionId] = r.[Id]
    WHERE
        si.[Sequence] IN (5, 6, 7)
        AND asii.[IsCompleted] = 1
        AND asii.[EndDate] >= '2021-01-01'
        AND asii.[EndDate] IS NOT NULL
        AND asi.[StartDate] IS NOT NULL
        AND (r.[Name] = 'California' OR r.[LatinName] = 'California')
        AND i.[BirthDate] IS NOT NULL
        AND DATEDIFF(YEAR, i.[BirthDate], asii.[EndDate]) BETWEEN 15 AND 30
        AND DATEDIFF(DAY, asi.[StartDate], asii.[EndDate]) > 0
)
SELECT
    BookNumber,
    CompletionYear,
    COUNT(*) AS CompletionCount,
    MIN(CompletionDate) AS EarliestDate,
    MAX(CompletionDate) AS LatestDate
FROM FilteredCompletions
GROUP BY BookNumber, CompletionYear
ORDER BY BookNumber, CompletionYear
```

```json
{
  "rowCount": 14,
  "rows": [
    {
      "BookNumber": 5,
      "CompletionYear": 2021,
      "CompletionCount": 44,
      "EarliestDate": "2021-02-01T08:00:00.000Z",
      "LatestDate": "2021-12-01T08:00:00.000Z"
    },
    {
      "BookNumber": 5,
      "CompletionYear": 2022,
      "CompletionCount": 11,
      "EarliestDate": "2022-02-01T08:00:00.000Z",
      "LatestDate": "2022-12-01T08:00:00.000Z"
    },
    {
      "BookNumber": 5,
      "CompletionYear": 2023,
      "CompletionCount": 19,
      "EarliestDate": "2023-01-01T08:00:00.000Z",
      "LatestDate": "2023-12-01T08:00:00.000Z"
    },
    {
      "BookNumber": 5,
      "CompletionYear": 2024,
      "CompletionCount": 23,
      "EarliestDate": "2024-01-01T08:00:00.000Z",
      "LatestDate": "2024-10-05T07:00:00.000Z"
    },
    {
      "BookNumber": 5,
      "CompletionYear": 2025,
      "CompletionCount": 11,
      "EarliestDate": "2025-02-01T08:00:00.000Z",
      "LatestDate": "2025-08-11T07:00:00.000Z"
    },
    {
      "BookNumber": 6,
      "CompletionYear": 2021,
      "CompletionCount": 2,
      "EarliestDate": "2021-01-01T08:00:00.000Z",
      "LatestDate": "2021-01-01T08:00:00.000Z"
    },
    {
      "BookNumber": 6,
      "CompletionYear": 2023,
      "CompletionCount": 21,
      "EarliestDate": "2023-01-01T08:00:00.000Z",
      "LatestDate": "2023-08-01T07:00:00.000Z"
    },
    {
      "BookNumber": 6,
      "CompletionYear": 2024,
      "CompletionCount": 26,
      "EarliestDate": "2024-03-20T07:00:00.000Z",
      "LatestDate": "2024-12-01T08:00:00.000Z"
    },
    {
      "BookNumber": 6,
      "CompletionYear": 2025,
      "CompletionCount": 16,
      "EarliestDate": "2025-02-28T08:00:00.000Z",
      "LatestDate": "2025-04-27T07:00:00.000Z"
    },
    {
      "BookNumber": 7,
      "CompletionYear": 2021,
      "CompletionCount": 16,
      "EarliestDate": "2021-02-01T08:00:00.000Z",
      "LatestDate": "2021-11-01T07:00:00.000Z"
    },
    "... 4 results omitted ..."
  ]
}
```

---

2025-11-17T19:02:20.955Z

```sql
WITH FilteredCompletions AS (
    SELECT
        si.[Sequence] AS BookNumber,
        YEAR(asii.[EndDate]) AS CompletionYear,
        COUNT(*) AS CompletionCount
    FROM
        [ActivityStudyItemIndividuals] asii
        INNER JOIN [Individuals] i ON asii.[IndividualId] = i.[Id]
        INNER JOIN [ActivityStudyItems] asi ON asii.[ActivityStudyItemId] = asi.[Id]
        INNER JOIN [StudyItems] si ON asii.[StudyItemId] = si.[Id]
        INNER JOIN [Localities] l ON i.[LocalityId] = l.[Id]
        INNER JOIN [Clusters] c ON l.[ClusterId] = c.[Id]
        INNER JOIN [Regions] r ON c.[RegionId] = r.[Id]
    WHERE
        si.[Sequence] IN (5, 6, 7)
        AND asii.[IsCompleted] = 1
        AND asii.[EndDate] >= '2021-01-01'
        AND asii.[EndDate] <= GETDATE()
        AND asii.[EndDate] IS NOT NULL
        AND asi.[StartDate] IS NOT NULL
        AND (r.[Name] = 'California' OR r.[LatinName] = 'California')
        AND i.[BirthDate] IS NOT NULL
        AND DATEDIFF(YEAR, i.[BirthDate], asii.[EndDate]) BETWEEN 15 AND 30
        AND DATEDIFF(DAY, asi.[StartDate], asii.[EndDate]) > 0
    GROUP BY si.[Sequence], YEAR(asii.[EndDate])
)
SELECT
    BookNumber,
    CompletionYear,
    CompletionCount
FROM FilteredCompletions
ORDER BY BookNumber, CompletionYear
```

```json
{
  "rowCount": 14,
  "rows": [
    {
      "BookNumber": 5,
      "CompletionYear": 2021,
      "CompletionCount": 44
    },
    {
      "BookNumber": 5,
      "CompletionYear": 2022,
      "CompletionCount": 11
    },
    {
      "BookNumber": 5,
      "CompletionYear": 2023,
      "CompletionCount": 19
    },
    {
      "BookNumber": 5,
      "CompletionYear": 2024,
      "CompletionCount": 23
    },
    {
      "BookNumber": 5,
      "CompletionYear": 2025,
      "CompletionCount": 11
    },
    {
      "BookNumber": 6,
      "CompletionYear": 2021,
      "CompletionCount": 2
    },
    {
      "BookNumber": 6,
      "CompletionYear": 2023,
      "CompletionCount": 21
    },
    {
      "BookNumber": 6,
      "CompletionYear": 2024,
      "CompletionCount": 26
    },
    {
      "BookNumber": 6,
      "CompletionYear": 2025,
      "CompletionCount": 16
    },
    {
      "BookNumber": 7,
      "CompletionYear": 2021,
      "CompletionCount": 16
    },
    "... 4 results omitted ..."
  ]
}
```

---

2025-11-17T19:16:25.871Z

```sql
SELECT [Id], [Name], [Code] FROM [Clusters] WHERE [Name] LIKE '%Gabriel%' OR [Code] LIKE '%Gabriel%'
```

```json
{
  "error": "Error: Invalid column name 'Code'."
}
```

---

2025-11-17T19:18:38.505Z

```sql
SELECT [Id], [Name], [InstituteId] FROM [Clusters] WHERE [Name] LIKE '%Gabriel%'
```

```json
{
  "rowCount": 1,
  "rows": [
    {
      "Id": "40",
      "Name": "CA:SW06 San Gabriel Valley",
      "InstituteId": null
    }
  ]
}
```

---

2025-11-17T19:18:58.952Z

```sql
SELECT SI.[Id], SI.[ActivityType], LSI.[Name], LSI.[ShortName] FROM [StudyItems] SI JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en-US' AND SI.[ActivityType] = 1 ORDER BY SI.[OrderNumber]
```

```json
{
  "error": "Error: Invalid column name 'OrderNumber'."
}
```

---

2025-11-17T19:21:11.707Z

```sql
SELECT SI.[Id], SI.[ActivityType], SI.[ActivityStudyItemType], SI.[Sequence], LSI.[Name], LSI.[ShortName] FROM [StudyItems] SI JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en-US' AND SI.[ActivityType] = 1 ORDER BY SI.[Sequence]
```

```json
{
  "rowCount": 18,
  "rows": [
    {
      "Id": "7",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 1,
      "Name": "Breezes of Confirmation",
      "ShortName": "BC"
    },
    {
      "Id": "40",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 2,
      "Name": "Wellspring of Joy",
      "ShortName": "WJ"
    },
    {
      "Id": "41",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 3,
      "Name": "Habits of an Orderly Mind",
      "ShortName": "HO"
    },
    {
      "Id": "8",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 4,
      "Name": "Glimmerings of Hope",
      "ShortName": "GH"
    },
    {
      "Id": "11",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 5,
      "Name": "Walking the Straight Path",
      "ShortName": "WS"
    },
    {
      "Id": "42",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 6,
      "Name": "On Health and Well-Being",
      "ShortName": "HW"
    },
    {
      "Id": "12",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 7,
      "Name": "Learning About Excellence",
      "ShortName": "LE"
    },
    {
      "Id": "16",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 8,
      "Name": "Drawing on the Power of the Word",
      "ShortName": "DP"
    },
    {
      "Id": "9",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 9,
      "Name": "Thinking About Numbers",
      "ShortName": "TN"
    },
    {
      "Id": "13",
      "ActivityType": 1,
      "ActivityStudyItemType": "Text",
      "Sequence": 10,
      "Name": "Observation and Insight",
      "ShortName": "OI"
    },
    "... 8 results omitted ..."
  ]
}
```

---

2025-11-17T19:21:18.055Z

```sql
SELECT SI.[Id], SI.[ActivityType], SI.[ActivityStudyItemType], SI.[Sequence], LSI.[Name], LSI.[ShortName] FROM [StudyItems] SI JOIN [LocalizedStudyItems] LSI ON SI.[Id] = LSI.[StudyItemId] WHERE LSI.[Language] = 'en-US' AND SI.[ActivityType] = 2 AND LSI.[Name] LIKE '%Book%' ORDER BY SI.[Sequence]
```

```json
{
  "rowCount": 44,
  "rows": [
    {
      "Id": "17",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 1,
      "Name": "Book 1",
      "ShortName": "B1"
    },
    {
      "Id": "18",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 2,
      "Name": "Book 2",
      "ShortName": "B2"
    },
    {
      "Id": "19",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 3,
      "Name": "Book 3 (G1)",
      "ShortName": "B3 (G1)"
    },
    {
      "Id": "20",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 4,
      "Name": "Book 3 (G2)",
      "ShortName": "B3 (G2)"
    },
    {
      "Id": "21",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 5,
      "Name": "Book 3 (G3)",
      "ShortName": "B3 (G3)"
    },
    {
      "Id": "48",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 6,
      "Name": "Book 3 (G4)",
      "ShortName": "B3 (G4)"
    },
    {
      "Id": "49",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 7,
      "Name": "Book 3 (G5)",
      "ShortName": "B3 (G5)"
    },
    {
      "Id": "22",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 8,
      "Name": "Book 4",
      "ShortName": "B4"
    },
    {
      "Id": "23",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 9,
      "Name": "Book 5",
      "ShortName": "B5"
    },
    {
      "Id": "50",
      "ActivityType": 2,
      "ActivityStudyItemType": "Book",
      "Sequence": 10,
      "Name": "Book 5 BR1",
      "ShortName": "B5 BR1"
    },
    "... 34 results omitted ..."
  ]
}
```

---

2025-11-17T19:22:03.403Z

```sql
SELECT TOP 5 ASI.[IndividualId], ASI.[ActivityId], ASI.[StudyItemId], ASI.[IsCompleted], A.[StartDate], A.[ActivityType] FROM [ActivityStudyItemIndividuals] ASI JOIN [Activities] A ON ASI.[ActivityId] = A.[Id] JOIN [Localities] L ON A.[LocalityId] = L.[Id] WHERE L.[ClusterId] = 40 AND A.[ActivityType] = 1 ORDER BY A.[StartDate]
```

```json
{
  "rowCount": 5,
  "rows": [
    {
      "IndividualId": "14340",
      "ActivityId": "982",
      "StudyItemId": "10",
      "IsCompleted": true,
      "StartDate": "2013-11-01T07:00:00.000Z",
      "ActivityType": 1
    },
    {
      "IndividualId": "14340",
      "ActivityId": "982",
      "StudyItemId": null,
      "IsCompleted": false,
      "StartDate": "2013-11-01T07:00:00.000Z",
      "ActivityType": 1
    },
    {
      "IndividualId": "14340",
      "ActivityId": "982",
      "StudyItemId": "11",
      "IsCompleted": true,
      "StartDate": "2013-11-01T07:00:00.000Z",
      "ActivityType": 1
    },
    {
      "IndividualId": "14555",
      "ActivityId": "982",
      "StudyItemId": null,
      "IsCompleted": false,
      "StartDate": "2013-11-01T07:00:00.000Z",
      "ActivityType": 1
    },
    {
      "IndividualId": "14555",
      "ActivityId": "982",
      "StudyItemId": "11",
      "IsCompleted": true,
      "StartDate": "2013-11-01T07:00:00.000Z",
      "ActivityType": 1
    }
  ]
}
```

---

2025-11-17T19:23:46.113Z

```sql

WITH JYCohorts AS (
    SELECT
        I.[Id] AS IndividualId,
        MIN(YEAR(A.[StartDate])) AS CohortYear,
        I.[BirthDate]
    FROM [Individuals] I
    JOIN [ActivityStudyItemIndividuals] ASI ON I.[Id] = ASI.[IndividualId]
    JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
    JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    WHERE L.[ClusterId] = 40
        AND A.[ActivityType] = 1
        AND I.[IsArchived] = 0
        AND DATEDIFF(YEAR, I.[BirthDate], A.[StartDate]) BETWEEN 11 AND 15
    GROUP BY I.[Id], I.[BirthDate]
),
JYTextCompletions AS (
    SELECT
        ASI.[IndividualId],
        COUNT(DISTINCT ASI.[StudyItemId]) AS JYTextsCompleted
    FROM [ActivityStudyItemIndividuals] ASI
    WHERE ASI.[IsCompleted] = 1
        AND ASI.[StudyItemId] IN (7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 40, 41, 42, 43, 44)
    GROUP BY ASI.[IndividualId]
),
BookCompletions AS (
    SELECT
        ASI.[IndividualId],
        MAX(CASE WHEN ASI.[StudyItemId] = 17 AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook1,
        MAX(CASE WHEN ASI.[StudyItemId] IN (19, 20, 21, 48, 49) AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook3,
        MAX(CASE WHEN ASI.[StudyItemId] = 23 AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook5,
        MAX(CASE WHEN ASI.[StudyItemId] = 25 AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook7
    FROM [ActivityStudyItemIndividuals] ASI
    GROUP BY ASI.[IndividualId]
)
SELECT
    C.CohortYear,
    COUNT(DISTINCT C.IndividualId) AS [TotalJYStarted],
    COUNT(DISTINCT CASE WHEN ISNULL(JT.JYTextsCompleted, 0) >= 1 THEN C.IndividualId END) AS [Completed1PlusJYTexts],
    COUNT(DISTINCT CASE WHEN ISNULL(JT.JYTextsCompleted, 0) >= 4 THEN C.IndividualId END) AS [Completed4PlusJYTexts],
    COUNT(DISTINCT CASE WHEN ISNULL(JT.JYTextsCompleted, 0) >= 8 THEN C.IndividualId END) AS [Completed8PlusJYTexts],
    COUNT(DISTINCT CASE WHEN BC.CompletedBook1 = 1 THEN C.IndividualId END) AS [CompletedBook1],
    COUNT(DISTINCT CASE WHEN BC.CompletedBook3 = 1 THEN C.IndividualId END) AS [CompletedBook3],
    COUNT(DISTINCT CASE WHEN BC.CompletedBook5 = 1 THEN C.IndividualId END) AS [CompletedBook5],
    COUNT(DISTINCT CASE WHEN BC.CompletedBook7 = 1 THEN C.IndividualId END) AS [CompletedBook7]
FROM JYCohorts C
LEFT JOIN JYTextCompletions JT ON C.IndividualId = JT.IndividualId
LEFT JOIN BookCompletions BC ON C.IndividualId = BC.IndividualId
WHERE C.CohortYear BETWEEN 2017 AND 2025
GROUP BY C.CohortYear
ORDER BY C.CohortYear

```

```json
{
  "rowCount": 8,
  "rows": [
    {
      "CohortYear": 2017,
      "TotalJYStarted": 39,
      "Completed1PlusJYTexts": 38,
      "Completed4PlusJYTexts": 14,
      "Completed8PlusJYTexts": 7,
      "CompletedBook1": 8,
      "CompletedBook3": 2,
      "CompletedBook5": 0,
      "CompletedBook7": 0
    },
    {
      "CohortYear": 2018,
      "TotalJYStarted": 47,
      "Completed1PlusJYTexts": 44,
      "Completed4PlusJYTexts": 20,
      "Completed8PlusJYTexts": 13,
      "CompletedBook1": 6,
      "CompletedBook3": 0,
      "CompletedBook5": 0,
      "CompletedBook7": 0
    },
    {
      "CohortYear": 2019,
      "TotalJYStarted": 8,
      "Completed1PlusJYTexts": 4,
      "Completed4PlusJYTexts": 2,
      "Completed8PlusJYTexts": 0,
      "CompletedBook1": 1,
      "CompletedBook3": 1,
      "CompletedBook5": 0,
      "CompletedBook7": 0
    },
    {
      "CohortYear": 2021,
      "TotalJYStarted": 16,
      "Completed1PlusJYTexts": 7,
      "Completed4PlusJYTexts": 3,
      "Completed8PlusJYTexts": 0,
      "CompletedBook1": 0,
      "CompletedBook3": 0,
      "CompletedBook5": 0,
      "CompletedBook7": 0
    },
    {
      "CohortYear": 2022,
      "TotalJYStarted": 20,
      "Completed1PlusJYTexts": 17,
      "Completed4PlusJYTexts": 9,
      "Completed8PlusJYTexts": 0,
      "CompletedBook1": 0,
      "CompletedBook3": 0,
      "CompletedBook5": 0,
      "CompletedBook7": 0
    },
    {
      "CohortYear": 2023,
      "TotalJYStarted": 15,
      "Completed1PlusJYTexts": 13,
      "Completed4PlusJYTexts": 1,
      "Completed8PlusJYTexts": 0,
      "CompletedBook1": 0,
      "CompletedBook3": 0,
      "CompletedBook5": 0,
      "CompletedBook7": 0
    },
    {
      "CohortYear": 2024,
      "TotalJYStarted": 11,
      "Completed1PlusJYTexts": 2,
      "Completed4PlusJYTexts": 1,
      "Completed8PlusJYTexts": 0,
      "CompletedBook1": 0,
      "CompletedBook3": 0,
      "CompletedBook5": 0,
      "CompletedBook7": 0
    },
    {
      "CohortYear": 2025,
      "TotalJYStarted": 16,
      "Completed1PlusJYTexts": 0,
      "Completed4PlusJYTexts": 0,
      "Completed8PlusJYTexts": 0,
      "CompletedBook1": 0,
      "CompletedBook3": 0,
      "CompletedBook5": 0,
      "CompletedBook7": 0
    }
  ]
}
```

---

2025-11-17T19:27:25.587Z

```sql

WITH JYCohorts AS (
    SELECT
        I.[Id] AS IndividualId,
        MIN(YEAR(A.[StartDate])) AS CohortYear,
        I.[BirthDate]
    FROM [Individuals] I
    JOIN [ActivityStudyItemIndividuals] ASI ON I.[Id] = ASI.[IndividualId]
    JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
    JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    WHERE L.[ClusterId] = 40
        AND A.[ActivityType] = 1
        AND I.[IsArchived] = 0
        AND DATEDIFF(YEAR, I.[BirthDate], A.[StartDate]) BETWEEN 11 AND 15
    GROUP BY I.[Id], I.[BirthDate]
),
JYTextCompletions AS (
    SELECT
        ASI.[IndividualId],
        COUNT(DISTINCT ASI.[StudyItemId]) AS JYTextsCompleted
    FROM [ActivityStudyItemIndividuals] ASI
    WHERE ASI.[IsCompleted] = 1
        AND ASI.[StudyItemId] IN (7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 40, 41, 42, 43, 44)
    GROUP BY ASI.[IndividualId]
),
BookCompletions AS (
    SELECT
        ASI.[IndividualId],
        MAX(CASE WHEN ASI.[StudyItemId] = 17 AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook1,
        MAX(CASE WHEN ASI.[StudyItemId] IN (19, 20, 21, 48, 49) AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook3,
        MAX(CASE WHEN ASI.[StudyItemId] = 23 AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook5,
        MAX(CASE WHEN ASI.[StudyItemId] = 25 AND ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS CompletedBook7
    FROM [ActivityStudyItemIndividuals] ASI
    GROUP BY ASI.[IndividualId]
)
SELECT TOP 20
    C.CohortYear,
    I.[FirstName],
    I.[FamilyName],
    YEAR(I.[BirthDate]) AS [BirthYear],
    DATEDIFF(YEAR, I.[BirthDate], CAST(CAST(C.CohortYear AS VARCHAR) + '-01-01' AS DATE)) AS [AgeAtCohortStart],
    L.[Name] AS [CurrentLocality],
    ISNULL(JT.JYTextsCompleted, 0) AS [JYTextsCompleted],
    BC.CompletedBook1 AS [Book1],
    BC.CompletedBook3 AS [Book3],
    BC.CompletedBook5 AS [Book5],
    BC.CompletedBook7 AS [Book7]
FROM JYCohorts C
JOIN [Individuals] I ON C.IndividualId = I.[Id]
JOIN [Localities] L ON I.[LocalityId] = L.[Id]
LEFT JOIN JYTextCompletions JT ON C.IndividualId = JT.IndividualId
LEFT JOIN BookCompletions BC ON C.IndividualId = BC.IndividualId
WHERE C.CohortYear BETWEEN 2017 AND 2025
ORDER BY C.CohortYear, I.[FamilyName], I.[FirstName]

```

```json
{
  "rowCount": 20,
  "rows": [
    {
      "CohortYear": 2017,
      "FirstName": "Amy",
      "FamilyName": null,
      "BirthYear": 2005,
      "AgeAtCohortStart": 12,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 1,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    {
      "CohortYear": 2017,
      "FirstName": "Aylin",
      "FamilyName": null,
      "BirthYear": 2005,
      "AgeAtCohortStart": 12,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 3,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    {
      "CohortYear": 2017,
      "FirstName": "Barbara",
      "FamilyName": null,
      "BirthYear": 2005,
      "AgeAtCohortStart": 12,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 3,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    {
      "CohortYear": 2017,
      "FirstName": "Emily",
      "FamilyName": null,
      "BirthYear": 2005,
      "AgeAtCohortStart": 12,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 3,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    {
      "CohortYear": 2017,
      "FirstName": "Isaac",
      "FamilyName": null,
      "BirthYear": 2005,
      "AgeAtCohortStart": 12,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 3,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    {
      "CohortYear": 2017,
      "FirstName": "Isaiah",
      "FamilyName": null,
      "BirthYear": 2005,
      "AgeAtCohortStart": 12,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 3,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    {
      "CohortYear": 2017,
      "FirstName": "Jacob",
      "FamilyName": null,
      "BirthYear": 2005,
      "AgeAtCohortStart": 12,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 3,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    {
      "CohortYear": 2017,
      "FirstName": "Melanie",
      "FamilyName": null,
      "BirthYear": 2005,
      "AgeAtCohortStart": 12,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 3,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    {
      "CohortYear": 2017,
      "FirstName": "Mileena",
      "FamilyName": null,
      "BirthYear": 2005,
      "AgeAtCohortStart": 12,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 3,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    {
      "CohortYear": 2017,
      "FirstName": "Moises",
      "FamilyName": null,
      "BirthYear": 2003,
      "AgeAtCohortStart": 14,
      "CurrentLocality": "Pasadena",
      "JYTextsCompleted": 3,
      "Book1": 0,
      "Book3": 0,
      "Book5": 0,
      "Book7": 0
    },
    "... 10 results omitted ..."
  ]
}
```

---

