# ListSortColumns Table

## Overview

The `ListSortColumns` table implements the ORDER BY clause logic of the SRP database's dynamic list system, defining how query results should be sorted to present data in the most useful and intuitive sequence. This configuration table transforms user preferences about result ordering - whether to sort activities by start date (newest first), arrange individuals alphabetically by name, or organize localities by geographic hierarchy - into precise SQL ORDER BY clauses without requiring users to understand database sorting concepts. Each record specifies one column to sort by, the direction (ascending or descending), and the priority when multiple sort columns are combined, enabling sophisticated multi-level sorting that presents data exactly as users need to see it.

Effective sorting transforms raw query results into actionable information by imposing meaningful order on potentially chaotic data. A list of 500 activities becomes immediately useful when sorted first by completion status (incomplete activities requiring attention appear first), then by cluster (grouping activities geographically), then by start date (showing which started most recently). The ListSortColumns table enables this multi-level sorting while maintaining simplicity - users don't need to understand that "ASC" means ascending or that sort priority is determined by order in the ORDER BY clause; they simply specify "show incomplete first, then group by location, then newest first" and the system translates their intent into correct SQL. This abstraction is crucial for enabling non-technical coordinators to create precisely ordered views of their data.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id (bigint, NULL)

The primary key and unique identifier for each sort column configuration record, providing a stable reference point for this specific sort specification within a list's overall ordering strategy. While the combination of ListId, ListColumnId, and Order conceptually defines the sort configuration, the Id field provides a single-value identifier useful for modification operations, deletion, and maintaining referential integrity in administrative operations. Although marked as nullable in the schema, this field serves as the primary key and should always contain a unique value for operational records.

### SortDirection (varchar, NULL)

Specifies whether to sort the column in ascending or descending order, using values like "ASC", "DESC", "Ascending", or "Descending" depending on the application's convention. Ascending order sorts from lowest to highest (1, 2, 3... for numbers; A, B, C... for text; oldest to newest for dates; false before true for booleans), while descending order reverses this sequence (highest to lowest, Z to A, newest to oldest, true before false). The choice of direction depends on the column's meaning and the user's analytical needs: date fields often sort descending to show most recent items first, status fields might sort to show incomplete items before completed ones, while name fields typically sort ascending for alphabetical presentation. The varchar type allows for flexible representation of direction values, though the application should normalize these to consistent values (e.g., always "ASC" or "DESC") for reliable SQL generation.

### Order (smallint, NULL)

Controls the priority or sequence of this sort column within the overall sort specification, with lower values having higher priority and determining the primary sort order. When multiple sort columns are specified, the database first sorts by the column with Order=1 (primary sort), then breaks ties using the column with Order=2 (secondary sort), then Order=3 (tertiary sort), and so forth. This enables sophisticated multi-level sorting: an Individual list might use Order=1 for Region (grouping everyone by geographic area), Order=2 for Cluster (within each region, group by cluster), and Order=3 for FamilyName (within each cluster, alphabetize by last name). The smallint type provides a range of -32,768 to 32,767, though practical sort configurations rarely exceed 3-5 levels. Using gaps (10, 20, 30) rather than consecutive numbers (1, 2, 3) allows for future sort column insertions without renumbering.

### ListId (bigint, NULL)

A foreign key referencing the Lists table, identifying which list definition this sort specification belongs to and linking the sort configuration to the overall list specification. This relationship enables the system to retrieve all sort columns for a given list when constructing the ORDER BY clause, with each list potentially having multiple sort columns that together define the complete result ordering. When users run a list, the system queries ListSortColumns WHERE ListId = @ListId, then orders the results by the Order field to determine the sequence of columns in the generated ORDER BY clause.

### ListColumnId (bigint, NULL)

A foreign key referencing the ListColumns table, identifying which specific column from the available column catalog should be used for sorting. This relationship provides access to all the column's metadata - its database table and column name, data type, and most importantly, how it should be referenced in sort expressions through the SortColumnName or DBSortColumnName fields. The column's data type determines how sorting behaves (numeric sorting for numbers, lexicographic for strings, chronological for dates), and the column's source determines what table joins might be necessary to include the sort column in the query. The same ListColumn can be used for sorting in multiple different lists, enabling consistent sorting definitions across the system.

### CreatedTimestamp (datetime, NULL)

Records the precise moment when this sort column was added to the list configuration, providing an audit trail for how result ordering evolves over time. This timestamp captures when users modified their lists to include this sort criterion, which helps administrators understand how list configurations change in response to user needs and analytical requirements. For sorts created during bulk list import or system initialization, this timestamp reflects the setup time rather than individual user decisions, but it still provides valuable information about configuration history.

### CreatedBy (uniqueidentifier, NULL)

Stores the GUID of the user account that added this sort column to the list's configuration, establishing accountability for sort ordering decisions. This field enables tracking who is customizing result ordering, understanding which users actively engage with list configuration features, and attributing configuration choices to specific individuals. For system-generated or predefined list sorts, this might be NULL or reference a system account, distinguishing between user customizations and official system configurations.

### LastUpdatedTimestamp (datetime, NULL)

Captures the most recent moment when this sort column configuration was modified - typically changes to the SortDirection (reversing from ascending to descending) or Order (changing sort priority), though it could reflect other updates. This timestamp is important for cache invalidation in multi-tier applications, as it indicates when the list's sorting logic changed and cached results should be discarded. It helps administrators identify recently modified lists and understand when sort changes might have affected the presentation order of results.

### LastUpdatedBy (uniqueidentifier, NULL)

Records the GUID of the user who most recently modified this sort column configuration, completing the audit trail for sort specification changes. When multiple coordinators or administrators have permission to modify list configurations, this field provides clear accountability for sort modifications. Combined with LastUpdatedTimestamp, it creates a complete picture of when and by whom result ordering was adjusted, which is valuable for troubleshooting unexpected list presentation or understanding the evolution of list configurations.

## Key Relationships

### Parent List (Many-to-One)

The ListId foreign key creates a many-to-one relationship to the Lists table:
- Each sort column specification belongs to exactly one list
- Each list can have multiple sort columns (typically 1-5)
- Together, all ListSortColumns records for a given ListId define the complete ORDER BY clause
- Deleting a list typically cascades to delete all its sort configurations

This relationship enables retrieval of all sort specifications for a list via WHERE ListId = @ListId.

### Sorted Column (Many-to-One)

The ListColumnId foreign key creates a many-to-one relationship to the ListColumns table:
- Each sort specification operates on exactly one column
- Each column can be used for sorting in multiple lists
- The referenced ListColumn provides metadata needed for correct sort construction
- The column's data type determines sort behavior (numeric, alphabetic, chronological)

This relationship provides access to DBSortColumnName for SQL ORDER BY construction.

### List-Column Association for Sorting (Many-to-Many)

Together, the ListId and ListColumnId fields create a many-to-many relationship between Lists and ListColumns:
- A list can sort by many columns
- A column can be used for sorting in many lists
- The Order field adds priority/sequence information to this relationship
- The SortDirection field adds direction information

This architecture separates "what columns exist" from "which columns this list sorts by" from "in what order and direction."

## Sort Logic and Behavior

### Sort Direction Semantics

**Ascending (ASC)** - Low to High, First to Last, A to Z:
- **Numbers**: 1, 2, 3, 10, 100, 1000
- **Strings**: A, B, C... Z (case-sensitive or insensitive based on collation)
- **Dates**: Oldest first → Newest last (1990-01-01, 2000-01-01, 2024-01-01)
- **Booleans**: False (0) before True (1)
- **NULL values**: Typically appear first (database-dependent)

**Descending (DESC)** - High to Low, Last to First, Z to A:
- **Numbers**: 1000, 100, 10, 3, 2, 1
- **Strings**: Z, Y, X... A
- **Dates**: Newest first → Oldest last (2024-01-01, 2000-01-01, 1990-01-01)
- **Booleans**: True (1) before False (0)
- **NULL values**: Typically appear last (database-dependent)

### Multi-Level Sort Priority

When multiple sort columns are specified, SQL evaluates them in order:

**Example Configuration:**
```
Order 1: Region (ASC)
Order 2: Cluster (ASC)
Order 3: StartDate (DESC)
```

**Sort Process:**
1. **Primary Sort**: Sort all records by Region alphabetically (A→Z)
2. **Secondary Sort**: Within each region, sort by Cluster alphabetically (A→Z)
3. **Tertiary Sort**: Within each cluster, sort by StartDate newest first (DESC)

**Result SQL:**
```sql
ORDER BY Region ASC, Cluster ASC, StartDate DESC
```

**Result Presentation:**
```
Region: Northern, Cluster: Davis, StartDate: 2024-06-01
Region: Northern, Cluster: Davis, StartDate: 2024-03-15
Region: Northern, Cluster: Sacramento, StartDate: 2024-05-20
Region: Northern, Cluster: Sacramento, StartDate: 2024-01-10
Region: Southern, Cluster: Los Angeles, StartDate: 2024-04-22
Region: Southern, Cluster: Los Angeles, StartDate: 2024-02-14
```

### Data Type-Specific Sorting

**Numeric Sorting:**
- Proper mathematical order: 1, 2, 10, 20, 100 (not lexicographic: 1, 10, 100, 2, 20)
- Decimals sort by value: 1.1, 1.2, 1.11, 2.0
- Negative numbers sort correctly: -10, -5, 0, 5, 10

**String Sorting (Collation-Dependent):**
- Case-sensitive: A, B, Z, a, b, z
- Case-insensitive: A, a, B, b, Z, z
- Unicode support: Handles accented characters, non-Latin scripts
- Locale-specific: Some languages have special sort rules

**Date/DateTime Sorting:**
- Chronological order based on timestamp
- Date-only columns sort by date, ignoring time
- DateTime columns sort by full timestamp
- Timezone considerations in datetime comparisons

**Boolean Sorting:**
- Typically False (0) < True (1)
- Useful for grouping completed vs. incomplete
- Often combined with other sorts

**NULL Handling:**
- NULLs typically sort first in ASC or last in DESC (database-dependent)
- SQL Server default: NULLs sort first
- Can be controlled with NULLS FIRST / NULLS LAST (if supported)

## Common Query Patterns

### Get Sort Columns for List

```sql
SELECT
    LC.[DisplayName] AS ColumnName,
    LC.[DBSortColumnName],
    LC.[ColumnType],
    LSC.[SortDirection],
    LSC.[Order] AS SortPriority
FROM [ListSortColumns] LSC
INNER JOIN [ListColumns] LC ON LSC.[ListColumnId] = LC.[Id]
WHERE LSC.[ListId] = @ListId
ORDER BY LSC.[Order]
```

### Complete List Configuration with Sort

```sql
SELECT
    L.[Name] AS ListName,
    L.[EntityType],
    LC.[DisplayName] AS SortColumn,
    LC.[DBSortColumnName],
    LSC.[SortDirection],
    LSC.[Order] AS Priority
FROM [Lists] L
INNER JOIN [ListSortColumns] LSC ON L.[Id] = LSC.[ListId]
INNER JOIN [ListColumns] LC ON LSC.[ListColumnId] = LC.[Id]
WHERE L.[Id] = @ListId
ORDER BY LSC.[Order]
```

### Generate ORDER BY Clause

```sql
-- This query result can be concatenated to build ORDER BY clause
SELECT
    LC.[DBSortColumnName] + ' ' + LSC.[SortDirection] AS SortClause,
    LSC.[Order]
FROM [ListSortColumns] LSC
INNER JOIN [ListColumns] LC ON LSC.[ListColumnId] = LC.[Id]
WHERE LSC.[ListId] = @ListId
ORDER BY LSC.[Order]

-- Application code then builds: ORDER BY [clause1], [clause2], [clause3]
```

### Find Lists Sorting by Specific Column

```sql
SELECT
    L.[Name] AS ListName,
    L.[EntityType],
    LSC.[SortDirection],
    LSC.[Order] AS Priority
FROM [ListSortColumns] LSC
INNER JOIN [Lists] L ON LSC.[ListId] = L.[Id]
INNER JOIN [ListColumns] LC ON LSC.[ListColumnId] = LC.[Id]
WHERE LC.[ColumnName] = @ColumnName
    OR LC.[DisplayName] = @DisplayName
ORDER BY L.[Name], LSC.[Order]
```

### Detect Duplicate Sort Columns

```sql
-- Identify lists with same column specified multiple times
SELECT
    ListId,
    ListColumnId,
    COUNT(*) AS Occurrences
FROM [ListSortColumns]
GROUP BY ListId, ListColumnId
HAVING COUNT(*) > 1
```

## Business Rules and Constraints

1. **ListId Required**: Every sort specification must belong to a specific list
2. **ListColumnId Required**: Every sort must reference a valid sortable column
3. **SortDirection Required**: Must specify ASC or DESC (or equivalent)
4. **Order Required**: Sort priority must be specified
5. **Unique Column Per List**: A column should be sorted only once per list (ListId, ListColumnId unique)
6. **Unique Order Per List**: Within a list, Order values should be unique for unambiguous priority
7. **Sortable Columns**: ListColumnId must reference column where IsOrderableListColumn=true
8. **Valid Direction Values**: SortDirection should be normalized (ASC/DESC or consistent alternatives)
9. **Positive Order Values**: Typically use positive values (1, 10, 20) for intuitive sequencing
10. **Reasonable Sort Count**: Practical lists typically have 1-5 sort columns, rarely more

## Usage Patterns

### Single Column Sort

Simplest sorting scenario:
```
Sort by: LastName (Ascending)
```

Implementation:
- One ListSortColumns record
- Order = 1 (or 10)
- SortDirection = "ASC"
- Generates ORDER BY: `LastName ASC`

### Two-Level Sort (Primary + Secondary)

Common pattern for breaking ties:
```
Sort by: Cluster (Ascending), then StartDate (Descending)
```

Implementation:
- Two ListSortColumns records
- Record 1: Order = 1, Column = Cluster, Direction = ASC
- Record 2: Order = 2, Column = StartDate, Direction = DESC
- Generates ORDER BY: `Cluster ASC, StartDate DESC`

Result: Groups activities by cluster, within each cluster shows newest first

### Geographic Hierarchy Sort

Organizing by administrative structure:
```
Sort by: Region, then Cluster, then Locality
```

Implementation:
- Three ListSortColumns records
- Order = 1: Region (ASC)
- Order = 2: Cluster (ASC)
- Order = 3: Locality (ASC)
- Generates ORDER BY: `Region ASC, Cluster ASC, Locality ASC`

Result: Natural geographic hierarchy presentation

### Status-Priority Sort

Showing actionable items first:
```
Sort by: IsCompleted (Ascending - incomplete first),
         then Priority (Descending - high priority first),
         then StartDate (Descending - newest first)
```

Implementation:
- Three ListSortColumns records
- Order = 1: IsCompleted (ASC) - False(0) before True(1), so incomplete first
- Order = 2: Priority (DESC) - Higher numbers first
- Order = 3: StartDate (DESC) - Most recent first
- Generates ORDER BY: `IsCompleted ASC, Priority DESC, StartDate DESC`

Result: Incomplete high-priority recent items appear first (most actionable)

### Reversing Sort Direction

User clicks column header to reverse sort:
- Update SortDirection from ASC to DESC (or vice versa)
- Update LastUpdatedTimestamp and LastUpdatedBy
- Re-execute query with new sort direction
- Same data, reversed order

### Adding Secondary Sort

User adds tie-breaker sort:
- Existing sort: Order = 10, Column = Locality, Direction = ASC
- Add new sort: Order = 20, Column = StartDate, Direction = DESC
- Result: ORDER BY Locality ASC, StartDate DESC
- Within each locality, activities sorted newest first

### Reordering Sort Priority

User changes which column is primary:
- Original: Order 10 = Cluster, Order 20 = StartDate
- Swap priorities:
  - Update Cluster: Order = 20
  - Update StartDate: Order = 10
- New primary sort: StartDate, secondary: Cluster

## Sort Column Management Strategies

### Gap-Based Ordering (Recommended)

Use gaps between order values:
- Order values: 10, 20, 30, 40
- Allows insertion: Add between 20 and 30 with Order = 25
- Avoids frequent renumbering
- Easy to understand sequence

### Sequential Renumbering

When gaps fill up or for standardization:
- Read all sort columns ordered by current Order
- Reassign: Order = 10, 20, 30, 40, 50...
- Update all in transaction
- Clean, consistent numbering

### Priority-Based Values

Semantic ordering:
- Primary = 1, Secondary = 2, Tertiary = 3
- Clear priority levels
- Simple for users to understand
- Harder to insert new levels

## Performance Considerations

### Index Usage

Sorting can use indexes for improved performance:
- Indexes on sort columns enable faster sorting
- Composite indexes can optimize multi-column sorts
- Index on (Column1 ASC, Column2 ASC) helps: ORDER BY Column1, Column2
- Reverse index scans for DESC sorts on indexed columns

### Sort Performance

Large result sets require attention:
- Sorting 10,000 rows: Generally fast
- Sorting 100,000+ rows: May be slow without indexes
- Complex multi-column sorts: More expensive
- Calculated column sorts: Can't use indexes, potentially slow

### Optimization Strategies

Improve sort performance:
- **Index Sort Columns**: Create indexes on frequently sorted columns
- **Composite Indexes**: For common multi-column sorts
- **Limit Result Sets**: Apply filters to reduce rows before sorting
- **Avoid Calculated Sorts**: Sort on stored columns, not computed expressions when possible
- **Monitor Query Plans**: Check if sorts are using indexes or performing table scans

### UI Considerations

Sort impacts user experience:
- **Provide feedback**: Show which column(s) sorted, direction
- **Visual indicators**: Arrows (↑↓) in column headers
- **Click to sort**: Toggle direction on column header click
- **Multi-column hints**: Show sort priority (1, 2, 3) on multi-column sorts
- **Default sorts**: Provide sensible defaults for new lists

## Notes for Developers

When implementing sort functionality:

- **Enforce uniqueness** - Prevent duplicate columns in sort configuration (unique index on ListId, ListColumnId)
- **Validate order** - Ensure unique Order values within each list
- **Use DB-specific names** - Reference DBSortColumnName for SQL generation, not ColumnName
- **Normalize direction** - Standardize SortDirection values (always "ASC"/"DESC")
- **Handle NULLs** - Understand NULL sort behavior for your database
- **Build ORDER BY correctly** - Concatenate sort clauses in Order sequence
- **Support column header sorting** - Implement click-to-sort on column headers
- **Toggle direction** - Click sorted column header to reverse direction
- **Multi-column sort** - Shift-click or meta UI for adding secondary sorts
- **Show sort state** - Visual indicators (arrows, numbers) for current sort
- **Test with data** - Verify sort behavior with production-scale datasets
- **Cache configurations** - Cache compiled ORDER BY clauses for frequently-used lists

## Integration Considerations

### Visual List Builder

UI for managing sort columns should provide:
- Column selector showing sortable columns only (IsOrderableListColumn=true)
- Direction toggle (ASC/DESC, ↑/↓, Ascending/Descending)
- Priority/order controls (drag to reorder, numeric input)
- Add sort column button
- Remove sort column button
- Visual hierarchy showing primary, secondary, tertiary sorts
- Preview of sort logic before saving

### Query Generation

Sort columns drive SQL ORDER BY clause construction:
1. Retrieve sort columns for list ordered by Order field
2. For each sort column, get DBSortColumnName from ListColumns
3. Build clause: `[DBSortColumnName] [SortDirection]`
4. Join all clauses with commas: `ORDER BY clause1, clause2, clause3`
5. Append to complete SQL query
6. Execute and return results in sorted order

### Interactive Sorting

User interface sorting features:
- **Column Header Click**: Set as primary sort, toggle direction
- **Shift+Click**: Add as secondary/tertiary sort
- **Drag Column Headers**: Reorder sort priority
- **Sort Menu**: Explicit multi-column sort configuration
- **Save Sort**: Persist sort preferences in ListSortColumns

## Best Practices

1. **Sensible Defaults** - Provide useful default sorts for new lists
2. **Primary Sort Matters** - Choose primary sort based on most important grouping/ordering
3. **Tie-Breakers** - Add secondary sorts to handle ties meaningfully
4. **Direction Logic** - Consider semantic meaning (dates DESC for newest first, names ASC for alphabetical)
5. **Reasonable Count** - Typically 1-3 sort columns sufficient, rarely >5
6. **Index Awareness** - Sort on indexed columns when possible for performance
7. **User Expectations** - Match sorting behavior to user mental models
8. **Consistent Patterns** - Use similar sort strategies for similar list types
9. **Test Edge Cases** - Verify NULL handling, tie-breaking, large datasets
10. **Document Complex Sorts** - Explain why specific multi-level sorts are configured

## Advanced Features

### Remembered Sort Preferences

User-specific sort customization:
- Track sort preferences per user per list
- Override default sort with user preference
- Reset to default option
- Share custom sorts with other users

### Dynamic Sort Criteria

Context-sensitive sorting:
- Different sorts for different user roles
- Adaptive sorting based on filter criteria
- Time-based sorts (this week vs. historical)
- Geographic-scoped sorting

### Sort Templates

Reusable sort configurations:
- Save sort pattern as template
- Apply to multiple similar lists
- Organization-wide standard sorts
- Domain-specific sort conventions

### Calculated Sort Columns

Sorting by computed values:
- Age (calculated from BirthDate)
- Duration (EndDate - StartDate)
- Percentage (Completed / Total)
- Complex expressions requiring special handling

## Mobile and Responsive Considerations

Different devices may support different sort capabilities:

### Desktop
- Full multi-column sort support
- Click headers to change sort
- Visual indicators for all sort columns
- Drag-and-drop sort reordering

### Tablet
- Primary + secondary sort
- Tap to toggle direction
- Sort menu for configuration
- Limited visual indicators

### Mobile
- Single column sort typically
- Tap header to cycle: Unsorted → ASC → DESC → Unsorted
- Simplified sort UI
- Possible sort menu for advanced

**Strategy**: Design primary sort for mobile use, additional sorts for desktop enhancement

## Security and Privacy Considerations

Sorting generally has minimal security implications, but consider:

- **Performance DOS**: Prevent users from creating expensive multi-column sorts on huge unfiltered datasets
- **Data Inference**: Sort order can reveal information (e.g., sorting by age might reveal youngest/oldest individuals)
- **Audit Columns**: Restrict sorting by CreatedBy/UpdatedBy to authorized users
- **Calculated Sensitive**: Don't allow sorting by calculated columns that might expose sensitive data

When configuring sorts:
- Ensure sort columns don't inadvertently expose sensitive data groupings
- Monitor performance impact of complex sorts
- Test sort behavior with various user permission levels
- Document any security-sensitive sort configurations
