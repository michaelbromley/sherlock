# California Statistics Bulletin - Quarterly Report Generator

## Overview

This guide explains how to generate quarterly statistics for the California Statistics Bulletin using the SQL queries in `queries/generate_quarterly_report_data.sql`.

The queries generate data for three activity types:
1. **Study Circles** - Main Sequence Books 1-7
2. **Junior Youth** - Texts BC through RL
3. **Children's Classes** - Grades 1-6

Data is broken down by:
- **Groupings**: San Diego, Los Angeles, East Bay, Santa Clara County West, Sacramento, San Gabriel Valley, and Fresno
- **Reservoir vs Rest of Grouping**: Each grouping has a main "reservoir" cluster and "rest of grouping" clusters
- **Book/Grade/Text Levels**: Different educational material levels within each activity type

## Quick Start

### For Jan 2026 Report

1. Open `queries/generate_quarterly_report_data.sql`
2. Find all instances of `'2025-10-01'` (there are 15 occurrences marked with ⚠️)
3. Replace with `'2026-01-01'`
4. Execute the query against your database

### Using the Query Tool

```bash
# For a specific quarter (e.g., Jan 2026)
# First, update the dates in the SQL file, then:

npx tsx src/query-db.ts query "$(sed 's/2025-10-01/2026-01-01/g' queries/generate_quarterly_report_data.sql)"
```

Or use your preferred SQL client (SQL Server Management Studio, Azure Data Studio, etc.)

## Understanding the Output

### Part 1: Study Circles

```
Grouping               | ClusterType      | Books1_2 | Books3_5 | Books6_7 | TotalActivities
-----------------------|------------------|----------|----------|----------|----------------
East Bay               | Reservoir        | 5        | 3        | 2        | 7
East Bay               | Rest of Grouping | 45       | 30       | 18       | 68
```

- **Reservoir**: The main cluster in each grouping (e.g., CA:NC02 Alameda County Central for East Bay)
- **Rest of Grouping**: All other clusters in that grouping combined
- **Books1_2**: Activities studying Books 1-2
- **Books3_5**: Activities studying Books 3-5
- **Books6_7**: Activities studying Books 6-7

### Part 2: Junior Youth

```
Grouping        | ClusterType      | TotalActivities | Texts_BC_WS | Texts_HW_OI | Texts_HT_RL
----------------|------------------|-----------------|-------------|-------------|------------
San Diego       | Reservoir        | 20              | 15          | 8           | 3
```

- **Texts_BC_WS**: Texts BC, WJ, HO, GH, WS (early texts)
- **Texts_HW_OI**: Texts HW, SF, LE, TN, OI (middle texts)
- **Texts_HT_RL**: Texts HT, DP, PH, RL (advanced texts)

### Part 3: Children's Classes

```
Grouping        | ClusterType      | TotalActivities | Grade1 | Grade2 | Grades3_6
----------------|------------------|-----------------|--------|--------|----------
Los Angeles     | Reservoir        | 25              | 10     | 8      | 15
```

## Cluster-to-Grouping Mapping

### San Diego Grouping
**Reservoir**: CA:SE18 San Diego
- CA:SE13 Escondido
- CA:SE14 East San Diego County
- CA:SE15 San Diego North Coast

### Los Angeles Grouping
**Reservoir**: CA:SW01 Los Angeles
- CA:SW08 Glendale
- CA:SW17 Thousand Oaks
- CA:SW27 San Luis Obispo County
- CA:SW28 Ventura
- CA:SW29 Santa Clarita
- CA:SW30 Whittier
- CA:SW31 South Bay
- CA:SW32 Long Beach

### East Bay Grouping
**Reservoir**: CA:NC02 Alameda County Central (Pleasanton)
- CA:NC03 Alameda County South (Fremont)
- CA:NC06 Napa County
- CA:NC07 Marin County
- CA:NC08 East Bay
- CA:NC14 Sonoma County
- CA:NC16 Contra Costa County East (Concord)
- CA:NC18 Solano County
- CA:NC20 Humboldt County
- CA:NC21 Lake County
- CA:NC22 Mendocino County
- CA:NC25 Trinity County
- CA:NC26 Del Norte County

### Santa Clara County West Grouping
**Reservoir**: CA:NC04 Santa Clara County West
- CA:NC05 San Jose
- CA:NC09 San Mateo
- CA:NC10 Campos de Alianza
- CA:NC11 Fortaleza de Generosidad
- CA:NC15 Santa Cruz County
- CA:NC19 San Francisco
- CA:NC23 Monterey County

### Sacramento Grouping
**Reservoir**: CA:NI10 Sacramento
- CA:NI07 Stanislaus County
- CA:NI08 Tuolumne-Calaveras Counties
- CA:NI09 Stockton
- CA:NI11 Placer County
- CA:NI12 Yolo County
- CA:NI13 Grass Valley
- CA:NI14 Yuba County
- CA:NI16 Chico
- CA:NI17 Redding-Red Bluff
- CA:NI18 Lassen-Modoc Counties
- CA:NI19 El Dorado County

### San Gabriel Valley Grouping
**Reservoir**: CA:SW06 San Gabriel Valley
- CA:SW10 Claremont

### Fresno Grouping
**Reservoir**: CA:NI04 Fresno
- CA:NI02 Exeter-Visalia
- CA:NI03 Inyo County
- CA:NI05 Madera County North
- CA:NI06 Merced County

## Query Logic

### "In Progress" Definition

An activity is considered "in progress" for a quarter if:
1. It started on or before the quarter date (e.g., 2026-01-01)
2. Either:
   - It has no end date (ongoing), OR
   - Its end date is on or after the quarter date

This means an activity that started before the quarter and ended during the quarter will be included.

### Activity Study Items

For more granular breakdowns (by book/grade/text), the queries also check:
- `ActivityStudyItems` table links activities to specific study materials
- Study items must also meet the "in progress" criteria (no end date or end date >= quarter date)

## Quarterly Dates

| Quarter    | Date to Use |
|------------|-------------|
| Jan 2026   | 2026-01-01  |
| Apr 2026   | 2026-04-01  |
| Jul 2026   | 2026-07-01  |
| Oct 2026   | 2026-10-01  |
| Jan 2027   | 2027-01-01  |

## Automation Tips

### Using sed for Quick Date Changes

```bash
# Create a query for Jan 2026
sed 's/2025-10-01/2026-01-01/g' queries/generate_quarterly_report_data.sql > /tmp/jan2026.sql

# Execute it
npx tsx src/query-db.ts query "$(cat /tmp/jan2026.sql)"
```

### Saving Results

```bash
# Save to JSON
npx tsx src/query-db.ts query "$(sed 's/2025-10-01/2026-01-01/g' queries/generate_quarterly_report_data.sql)" > output/reports/default/jan2026_statistics.json
```

### Creating a Script

You can create a bash script to automate the process:

```bash
#!/bin/bash
# generate_quarterly_report.sh

QUARTER_DATE=$1

if [ -z "$QUARTER_DATE" ]; then
    echo "Usage: ./generate_quarterly_report.sh YYYY-MM-DD"
    echo "Example: ./generate_quarterly_report.sh 2026-01-01"
    exit 1
fi

OUTPUT_FILE="output/reports/default/report_${QUARTER_DATE}.json"

echo "Generating report for quarter: $QUARTER_DATE"

# Replace date in SQL file and execute
sed "s/2025-10-01/${QUARTER_DATE}/g" queries/generate_quarterly_report_data.sql | \
    npx tsx src/query-db.ts query "$(cat -)" > "$OUTPUT_FILE"

echo "Report saved to: $OUTPUT_FILE"
```

## Troubleshooting

### Issue: Numbers don't match historical reports exactly

**Possible causes:**
1. The database has been updated since the historical report was generated
2. Different counting methodology (activities vs. participants vs. activity-study-items)
3. Historical reports may have included manual adjustments

**Solution**: Use these queries as a foundation and adjust the counting logic as needed based on your specific requirements.

### Issue: Query timeout or slow performance

**Solution**: Add indexes to improve performance:

```sql
CREATE INDEX IX_Activities_StartDate_EndDate
    ON Activities(StartDate, EndDate)
    INCLUDE (ActivityType, LocalityId);

CREATE INDEX IX_ActivityStudyItems_ActivityId_StudyItemId
    ON ActivityStudyItems(ActivityId, StudyItemId)
    INCLUDE (EndDate);
```

### Issue: Missing clusters in groupings

**Solution**: Check the `ClusterGroupings` CTE in the SQL file and add any missing cluster names to the appropriate CASE WHEN clause.

## Next Steps

1. **Verify Data**: Run the queries for Oct 2025 and compare with your existing Excel report
2. **Adjust Mappings**: If clusters are missing or incorrectly grouped, update the `ClusterGroupings` CTE
3. **Customize Breakdowns**: Modify the book/grade/text groupings to match your reporting needs
4. **Automate**: Create scripts or stored procedures to generate reports on a schedule

## Questions or Issues?

Document any discrepancies or questions in the project repository so adjustments can be made to improve accuracy.
