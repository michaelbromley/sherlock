# ActivityStudyItems Table

## Overview
The `ActivityStudyItems` table creates the many-to-many relationship between Activities and StudyItems, tracking which curriculum elements (books, grades, texts) are being studied in each activity. This table enables an activity to cover multiple study items and allows the same study item to be taught across different activities.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier for each activity-study item combination |
| **DisplayStartDate** | varchar(20) | YES | Human-readable start date when this study item began in the activity |
| **StartDate** | datetime | YES | Actual start date for this study item in the activity |
| **DisplayEndDate** | varchar(20) | YES | Human-readable end date when this study item ended in the activity |
| **EndDate** | datetime | YES | Actual end date; NULL indicates ongoing study |
| **IsCompleted** | bit | NO | Boolean indicating if this study item has been completed in this activity |
| **ActivityId** | bigint | NO | Foreign key to Activities table |
| **StudyItemId** | bigint | NO | Foreign key to StudyItems table |
| **CreatedTimestamp** | datetime | NO | When the record was created |
| **CreatedBy** | uniqueidentifier | NO | User ID who created the record |
| **LastUpdatedTimestamp** | datetime | NO | When the record was last modified |
| **LastUpdatedBy** | uniqueidentifier | NO | User ID who last modified the record |
| **ImportedTimestamp** | datetime | YES | When data was imported from external system |
| **ImportedFrom** | uniqueidentifier | YES | Source system identifier for imported data |
| **ImportedFileType** | varchar(50) | YES | File format of imported data |

## Key Relationships

1. **Activities** (ActivityId → Activities.Id)
   - Links to the specific activity (required)
   - One activity can have multiple study items

2. **StudyItems** (StudyItemId → StudyItems.Id)
   - Links to the curriculum element (required)
   - One study item can be used in multiple activities

3. **ActivityStudyItemIndividuals** (One-to-Many)
   - This table has child records tracking individual participants
   - Each participant's progress is tracked separately

## Purpose and Usage

### Curriculum Tracking
This table enables:
- **Multi-book study circles**: A single study circle studying Books 1-3 sequentially
- **Grade progression**: Children's classes covering multiple grades
- **Text sequences**: Junior youth groups working through multiple texts

### Timeline Management
- **StartDate/EndDate**: Track when each curriculum element is active
- **Overlapping items**: Multiple study items can be active simultaneously
- **Sequential progression**: Track progression through curriculum sequence

### Completion Status
- **IsCompleted**: Indicates the study item is finished for this activity
- **Individual tracking**: Participants may complete at different rates (tracked in ActivityStudyItemIndividuals)

## Common Patterns

### Sequential Study Items
Study circles typically progress through books in sequence:
```sql
-- Activities with multiple sequential books
SELECT
    A.[Id] AS ActivityId,
    SI.[Sequence],
    ASI.[StartDate],
    ASI.[EndDate],
    ASI.[IsCompleted]
FROM [ActivityStudyItems] ASI
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
WHERE A.[ActivityType] = 2  -- Study Circles
ORDER BY A.[Id], SI.[Sequence]
```

### Active Study Items
Find what's currently being studied:
```sql
-- Currently active study items by activity type
SELECT
    A.[ActivityType],
    SI.[Name],
    COUNT(*) AS ActiveCount
FROM [ActivityStudyItems] ASI
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
WHERE ASI.[EndDate] IS NULL
  AND ASI.[IsCompleted] = 0
  AND A.[IsCompleted] = 0
GROUP BY A.[ActivityType], SI.[Name]
```

### Completion Rates
Track curriculum completion:
```sql
-- Completion rate by study item
SELECT
    SI.[Name],
    COUNT(*) AS TotalInstances,
    SUM(CAST(ASI.[IsCompleted] AS INT)) AS Completed,
    CAST(SUM(CAST(ASI.[IsCompleted] AS INT)) * 100.0 / COUNT(*) AS DECIMAL(5,2)) AS CompletionRate
FROM [ActivityStudyItems] ASI
INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
GROUP BY SI.[Name]
ORDER BY CompletionRate DESC
```

## Business Rules

### Date Logic
1. **StartDate** should align with or be after the Activity's StartDate
2. **EndDate** should not exceed the Activity's EndDate
3. **IsCompleted** = TRUE typically requires an EndDate

### Progression Logic
1. For sequential curriculum (like Ruhi books):
   - Book N should complete before Book N+1 starts
   - Some overlap allowed for transition periods

2. For parallel curriculum:
   - Multiple study items can be active simultaneously
   - Common in children's classes (multiple grades)

### Activity Type Patterns

#### Study Circles (Type 2)
- Usually one book at a time
- Sequential progression through numbered books
- May have brief overlaps during transitions

#### Children's Classes (Type 0)
- Often multiple grades simultaneously
- May repeat grades with new cohorts
- Seasonal patterns common

#### Junior Youth Groups (Type 1)
- Multiple texts can be active
- Service components tracked separately
- Flexible progression paths

## Data Quality Considerations

### Validation Checks
```sql
-- Check for study items extending beyond activity dates
SELECT
    ASI.*,
    A.[StartDate] AS ActivityStart,
    A.[EndDate] AS ActivityEnd
FROM [ActivityStudyItems] ASI
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
WHERE ASI.[StartDate] < A.[StartDate]
   OR (A.[EndDate] IS NOT NULL AND ASI.[EndDate] > A.[EndDate])
```

### Duplicate Prevention
```sql
-- Check for duplicate study items in same activity
SELECT
    [ActivityId],
    [StudyItemId],
    COUNT(*) AS DuplicateCount
FROM [ActivityStudyItems]
GROUP BY [ActivityId], [StudyItemId]
HAVING COUNT(*) > 1
```

## Reporting Queries

### Curriculum Coverage Report
```sql
-- Study items by cluster and activity type
SELECT
    C.[Name] AS ClusterName,
    A.[ActivityType],
    SI.[Name] AS StudyItem,
    COUNT(DISTINCT ASI.[ActivityId]) AS Activities,
    SUM(CASE WHEN ASI.[IsCompleted] = 1 THEN 1 ELSE 0 END) AS Completed
FROM [ActivityStudyItems] ASI
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
INNER JOIN [StudyItems] SI ON ASI.[StudyItemId] = SI.[Id]
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE A.[StartDate] >= DATEADD(MONTH, -3, GETDATE())
GROUP BY C.[Name], A.[ActivityType], SI.[Name]
ORDER BY C.[Name], A.[ActivityType], SI.[Name]
```

## Integration Points

### With ActivityStudyItemIndividuals
- This table provides the activity-curriculum framework
- Individual progress tracked separately in child table
- Completion at activity level vs. individual level

### With LocalizedStudyItems
- StudyItem names can be localized for reporting
- Multi-language support for international programs

### With Cycles Reporting
- Aggregated data flows up to cycle statistics
- Completion counts influence cycle metrics

## Performance Optimization

### Recommended Indexes
- Composite index on (ActivityId, StudyItemId) for uniqueness
- Index on StudyItemId for reverse lookups
- Index on IsCompleted for completion reporting
- Index on EndDate for active item queries

### Query Optimization Tips
1. Filter by activity type early in joins
2. Use date ranges to limit data set
3. Consider materialized views for complex reports
4. Cache commonly accessed combinations

## Notes for Developers

1. **Enforce Uniqueness**: Ensure one record per Activity-StudyItem combination
2. **Date Validation**: Validate dates against parent activity dates
3. **Completion Logic**: IsCompleted should trigger related updates
4. **Cascade Behavior**: Consider impact when deleting activities
5. **Audit Trail**: Always populate audit fields for tracking