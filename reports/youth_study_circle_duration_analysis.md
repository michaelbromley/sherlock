# Youth Study Circle Duration Analysis Report

**Date:** November 17, 2025
**Project:** SRP Database Analysis
**Focus:** Duration analysis for Ruhi Books 5, 6, and 7 completions by youth (ages 15-30) in California

---

## Executive Summary

This report documents the development of custom SQL queries to analyze study circle completion durations for youth participants in California. The queries address a limitation in the SRP (Statistical Reporting Program) custom reporting interface that prevents access to activity start dates, making duration calculations impossible through the standard interface.

**Key Deliverable:** Three SQL queries (Books 5, 6, 7) that extract:
- Individual participant completions with start and end dates
- Calculated duration in days
- Age at completion
- Geographic context (locality and cluster)
- Filtered for youth ages 15-30 in California from 2021 onward

---

## Problem Statement

### SRP Limitation
The SRP custom report interface does not allow users to pull the "date started" field for study circles when generating completion reports. This prevents analysis of:
- How long study circles take to complete
- Variations in duration across different books
- Trends in completion times over different periods

### Business Need
Understanding study circle duration is critical for:
- Planning and scheduling future study circles
- Identifying best practices for book-specific study patterns
- Resource allocation and facilitator training
- Youth engagement strategy development

---

## Objectives

Create SQL queries that return individual-level completion data for youth study circles with the following specifications:

### Target Population
- **Age Range:** 15-30 years old (calculated at time of completion)
- **Geographic Scope:** California region only
- **Time Period:** Completions from January 1, 2021 to present

### Target Study Materials
- Ruhi Book 5
- Ruhi Book 6
- Ruhi Book 7

### Required Data Points
1. Participant name (First and Last)
2. Study circle start date
3. Completion date
4. Duration (in days)
5. Age at completion
6. Locality name
7. Cluster name

### Data Quality Constraints
- Only completed items (IsCompleted = 1)
- Duration must be positive (> 0 days, excluding same-day entries)
- Valid birth dates required for age calculation
- Valid start and end dates required

---

## Solution Overview

### Approach
Developed custom SQL Server queries that:
1. Join across multiple tables to access both activity start dates and individual completion dates
2. Calculate duration as the difference between `ActivityStudyItems.StartDate` and `ActivityStudyItemIndividuals.EndDate`
3. Apply comprehensive filters for age, geography, time period, and data quality
4. Use Common Table Expressions (CTEs) for clarity and maintainability

### File Location
**Query File:** `queries/youth_study_circle_durations.sql`

**Contents:**
- Query 1: Book 5 completions
- Query 2: Book 6 completions
- Query 3: Book 7 completions
- Bonus Query: Combined summary statistics for all three books

---

## Database Schema Analysis

### Core Tables Used

#### 1. Individuals
- **Purpose:** Participant demographic data
- **Key Fields:**
  - `Id`, `FirstName`, `FamilyName`
  - `BirthDate` (for age calculation)
  - `LocalityId` (for geographic filtering)

#### 2. ActivityStudyItemIndividuals
- **Purpose:** Individual participation and completion records
- **Key Fields:**
  - `IndividualId`, `ActivityId`, `StudyItemId`, `ActivityStudyItemId`
  - `EndDate` (completion date)
  - `IsCompleted` (completion status flag)

#### 3. ActivityStudyItems
- **Purpose:** Links activities to specific study materials (books)
- **Key Fields:**
  - `Id`, `ActivityId`, `StudyItemId`
  - `StartDate` (when the study circle began this book) **← Critical for duration calculation**
  - `EndDate`

#### 4. StudyItems
- **Purpose:** Catalog of study materials
- **Key Fields:**
  - `Id`, `Sequence` (book number: 5, 6, 7)
  - `ActivityType`

#### 5. Activities
- **Purpose:** Overall activity/study circle information
- **Key Fields:**
  - `Id`, `ActivityType`
  - `LocalityId`
  - `StartDate`, `EndDate`

#### 6. Geographic Hierarchy Tables
```
Regions (California)
    └── Clusters
        └── Localities
```

**Tables:**
- `Regions`: Top-level geography (California)
- `Clusters`: Operational units
- `Localities`: Specific communities where activities occur

### Table Relationships

```
ActivityStudyItemIndividuals
    ├── IndividualId → Individuals.Id
    ├── ActivityId → Activities.Id
    ├── StudyItemId → StudyItems.Id
    └── ActivityStudyItemId → ActivityStudyItems.Id

Individuals
    └── LocalityId → Localities.Id

Localities
    └── ClusterId → Clusters.Id

Clusters
    └── RegionId → Regions.Id

ActivityStudyItems
    ├── ActivityId → Activities.Id
    └── StudyItemId → StudyItems.Id
```

---

## Query Design & Rationale

### Duration Calculation Strategy

**Formula:**
```sql
DATEDIFF(DAY, asi.StartDate, asii.EndDate) AS DurationDays
```

**Where:**
- `asi.StartDate` = ActivityStudyItems.StartDate (when this book began in the study circle)
- `asii.EndDate` = ActivityStudyItemIndividuals.EndDate (when the individual completed)

**Rationale:**
- `ActivityStudyItems.StartDate` provides the book-specific start date within a study circle
- `ActivityStudyItemIndividuals.EndDate` provides the individual's completion date
- This gives the actual duration for each participant's journey through that specific book

### Age Calculation Strategy

**Formula:**
```sql
DATEDIFF(YEAR, i.BirthDate, asii.EndDate) AS AgeAtCompletion
```

**Rationale:**
- Calculates age at the time of completion (not current age)
- Uses year-based difference for simplicity
- Allows filtering for youth ages 15-30 at time of completion

### Geographic Filtering

**Filter:**
```sql
WHERE (r.Name = 'California' OR r.LatinName = 'California')
```

**Rationale:**
- Checks both `Name` and `LatinName` fields for robustness
- Follows the geographic hierarchy: Individual → Locality → Cluster → Region
- Ensures all participants are from California localities

### Date Range Filtering

**Filter:**
```sql
WHERE asii.EndDate >= '2021-01-01'
  AND asii.EndDate IS NOT NULL
  AND asi.StartDate IS NOT NULL
```

**Rationale:**
- Filters for completions from 2021 onward
- No upper bound constraint (includes all dates in database)
- Requires both dates to be non-NULL to calculate valid duration

### Data Quality Filters

**Filters:**
```sql
WHERE asii.IsCompleted = 1
  AND DurationDays > 0
  AND i.BirthDate IS NOT NULL
```

**Rationale:**
- `IsCompleted = 1`: Only include confirmed completions
- `DurationDays > 0`: Exclude zero-day durations (likely data entry errors or same-day start/end)
- `BirthDate IS NOT NULL`: Required for valid age calculation

### CTE Pattern for Clarity

**Structure:**
```sql
WITH BookXCompletions AS (
    SELECT ... [data gathering and initial calculations]
)
SELECT ... [filtering on calculated fields]
```

**Rationale:**
- Separates data gathering from filtering logic
- Allows filtering on calculated fields (age, duration)
- Improves query readability and maintainability
- Makes debugging easier

---

## Data Exploration Findings

### Database-Wide Date Range
Queried the `ActivityStudyItemIndividuals` table to understand the overall data landscape:

**Overall Completions:**
- Earliest completion: January 1, 1900 (likely placeholder date)
- Latest completion: October 13, 2025
- Total completed items: 36,822
- Future-dated completions: 0 (all dates ≤ query execution time)

### Filtered Data Analysis
For youth (ages 15-30) in California completing Books 5, 6, 7 from 2021 onward:

#### Book 5 Completions
| Year | Count | Date Range |
|------|-------|------------|
| 2021 | 44    | Feb 2021 - Dec 2021 |
| 2022 | 11    | Feb 2022 - Dec 2022 |
| 2023 | 19    | Jan 2023 - Dec 2023 |
| 2024 | 23    | Jan 2024 - Oct 2024 |
| 2025 | 11    | Feb 2025 - Aug 2025 |
| **Total** | **108** | **Feb 2021 - Aug 2025** |

#### Book 6 Completions
| Year | Count | Date Range |
|------|-------|------------|
| 2021 | 2     | Jan 2021 - Jan 2021 |
| 2022 | 0     | (No completions recorded) |
| 2023 | 21    | Jan 2023 - Aug 2023 |
| 2024 | 26    | Mar 2024 - Dec 2024 |
| 2025 | 16    | Feb 2025 - Apr 2025 |
| **Total** | **65** | **Jan 2021 - Apr 2025** |

#### Book 7 Completions
| Year | Count | Date Range |
|------|-------|------------|
| 2021 | 16    | Feb 2021 - Nov 2021 |
| 2022 | 65    | Jan 2022 - Aug 2022 |
| 2023 | 8     | Jan 2023 - Dec 2023 |
| 2024 | 11    | Feb 2024 - Sep 2024 |
| 2025 | 17    | Feb 2025 - Sep 2025 |
| **Total** | **117** | **Feb 2021 - Sep 2025** |

### Key Observations

1. **Book 7 has the highest completion count** (117 total) among youth in California
2. **Book 7 saw exceptional activity in 2022** (65 completions - 55% of all Book 7 completions)
3. **Book 6 has a gap year** - no recorded completions in 2022
4. **Book 5 shows steady activity** across all years with slight decline in 2022
5. **2025 data is partial** (queries run in November 2025, so full year not yet complete)

---

## Query Specifications

### Query 1: Book 5 Completions

**Filter:** `StudyItems.Sequence = 5`

**Output Fields:**
- FirstName
- FamilyName
- CompletionDate
- StudyStartDate
- DurationDays
- AgeAtCompletion
- LocalityName
- ClusterName

**Sort Order:** CompletionDate DESC, FamilyName, FirstName

### Query 2: Book 6 Completions

**Filter:** `StudyItems.Sequence = 6`

**Output:** Same as Query 1

### Query 3: Book 7 Completions

**Filter:** `StudyItems.Sequence = 7`

**Output:** Same as Query 1

### Bonus Query: Combined Statistics

**Filter:** `StudyItems.Sequence IN (5, 6, 7)`

**Output Fields (Aggregated by Book):**
- BookNumber
- TotalCompletions
- AvgDurationDays
- MinDurationDays
- MaxDurationDays
- StdDevDurationDays
- AvgAgeAtCompletion
- EarliestCompletion
- LatestCompletion

**Purpose:** Provides comparative statistics across all three books

---

## Usage Instructions

### Running Individual Book Queries

1. **Open the query file:**
   ```bash
   code queries/youth_study_circle_durations.sql
   ```

2. **Copy the desired query:**
   - Lines 12-71: Book 5
   - Lines 77-136: Book 6
   - Lines 142-201: Book 7

3. **Execute using the database explorer tool:**
   ```bash
   npx tsx src/query-db.ts query "PASTE_QUERY_HERE"
   ```

4. **Or execute directly in SQL Server Management Studio** or your preferred SQL client

### Running the Summary Statistics Query

**Copy lines 207-253** and execute to get comparative statistics for all three books.

### Expected Results

Each individual book query will return a list of youth participants with:
- Personal identifiers
- Temporal data (dates and duration)
- Geographic context
- Age information

The summary query will return aggregate metrics for comparison across books.

### Saving Results

To save query results as a report:
```bash
npx tsx src/query-db.ts query "YOUR_QUERY" > reports/book_5_results_$(date +%Y%m%d).json
```

---

## Key Findings Summary

### Data Availability
- **290 total youth completions** across Books 5, 6, 7 from 2021-2025
- Book distribution: Book 7 (117) > Book 5 (108) > Book 6 (65)
- All three books have consistent data from 2021 onwards

### Data Quality Insights
- Zero-day durations exist in the raw data (filtered out by `DurationDays > 0`)
- All completion dates are valid (no future dates detected)
- Birth dates and geographic assignments are well-populated for this cohort

### Temporal Patterns
- 2022 shows interesting patterns: Book 7 surge (65), Book 6 gap (0), Book 5 decline (11)
- 2021 had strong Book 5 activity (44 completions)
- 2024 shows balanced activity across all three books

---

## Future Refinements and Next Steps

### Potential Query Enhancements

1. **Add median duration calculation**
   - Current: AVG, MIN, MAX, STDEV
   - Future: PERCENTILE_CONT for median values

2. **Segment by completion year**
   - Analyze if durations are changing over time
   - Compare 2021 durations vs 2024 durations

3. **Add cluster-level analysis**
   - Which clusters have shortest/longest durations?
   - Identify high-performing clusters

4. **Include facilitator information**
   - If available in ActivityStudyItemIndividuals (IndividualRole field)
   - Analyze duration by facilitator experience

5. **Compare youth vs. adult durations**
   - Modify age filter to compare youth (15-30) vs adults (31+)
   - Understand if age impacts completion time

### Additional Analysis Questions

1. **What percentage of study circles are completed vs. abandoned?**
   - Filter for IsCompleted = 0 to analyze non-completion patterns

2. **What's the dropout pattern by book?**
   - Are certain books more challenging (higher dropout)?

3. **Geographic distribution analysis**
   - Which localities/clusters are most active?
   - Are there geographic patterns in duration?

4. **Sequential book progression**
   - Do individuals who complete Book 5 continue to Books 6 and 7?
   - What's the typical time gap between books?

5. **Cohort analysis**
   - Track specific age cohorts over time
   - Analyze youth engagement retention

### Data Quality Improvements

1. **Investigate zero-day durations**
   - Query to understand why same-day start/end dates occur
   - Work with data entry teams to improve date recording

2. **Validate book identification**
   - Confirm StudyItems.Sequence correctly maps to Ruhi Books 5, 6, 7
   - Check for any sub-book or section-level entries

3. **Date field standardization**
   - Database has both DisplayDate (varchar) and actual Date (datetime) fields
   - Ensure queries use datetime fields for calculations

### Performance Optimization

1. **Index recommendations**
   - ActivityStudyItemIndividuals.ActivityStudyItemId
   - StudyItems.Sequence
   - ActivityStudyItemIndividuals.IsCompleted
   - ActivityStudyItemIndividuals.EndDate
   - Regions.Name and Regions.LatinName

2. **Materialized views**
   - Consider creating a view for the youth California cohort
   - Pre-join geographic hierarchy for faster queries

### Reporting Enhancements

1. **Automate report generation**
   - Script to run queries and generate formatted reports
   - Schedule monthly/quarterly report generation

2. **Visualization**
   - Export results to CSV for visualization in Tableau/PowerBI
   - Create duration distribution histograms
   - Time-series charts of completion trends

3. **Dashboard integration**
   - Expose these metrics in a web dashboard
   - Real-time monitoring of study circle progress

---

## Technical Notes

### Database Type
- Microsoft SQL Server
- Uses square bracket `[]` identifier quoting
- Date functions: DATEDIFF, GETDATE()

### Query Complexity
- Multiple INNER JOINs (7 tables per query)
- CTE pattern for readability
- Mixed filtering (pre-calculation and post-calculation filters)

### Estimated Performance
- Baseline dataset: 36,822 completed items
- Filtered dataset: ~290 records
- Expected execution time: < 1 second for individual queries

### Maintenance Considerations
- Queries assume StudyItems.Sequence = 5, 6, 7 for book identification
- Assumes Regions table has 'California' entry
- Relies on IsCompleted flag for data integrity

---

## Change Log

| Date | Change | Rationale |
|------|--------|-----------|
| 2025-11-17 | Initial query creation | Address SRP limitation for duration reporting |
| 2025-11-17 | Changed `DurationDays >= 0` to `> 0` | Exclude zero-day durations (likely data errors) |
| 2025-11-17 | Verified date range constraint | Confirmed 2021+ filter captures all relevant data |
| 2025-11-17 | Database exploration via database-explorer skill | Validated data availability and distribution |

---

## Conclusion

These SQL queries successfully address the SRP limitation by directly accessing the database to calculate study circle durations for youth participants in California. The queries are:

- **Comprehensive:** Cover all specified requirements
- **Robust:** Include data quality filters and NULL handling
- **Maintainable:** Use clear CTEs and meaningful aliases
- **Documented:** Well-commented for future reference
- **Validated:** Tested against actual database with confirmed results

The queries provide actionable insights into youth study circle completion patterns and serve as a foundation for ongoing analysis and reporting.

---

**Report Prepared By:** Claude Code (AI Assistant)
**Reviewed By:** [Your Name]
**Next Review Date:** [To be determined]
