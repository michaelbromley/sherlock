# ListSortColumns Table

## Overview
The `ListSortColumns` table specifies the sort order for custom lists. It defines which columns to sort by, whether to sort ascending or descending, and the priority of multiple sort columns. This table implements the ORDER BY clause logic for the dynamic list system.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier |
| **SortDirection** | varchar(10) | NO | Sort direction: ASC (ascending) or DESC (descending) |
| **Order** | int | NO | Priority order when sorting by multiple columns |
| **ListId** | bigint | NO | Foreign key to Lists table |
| **ListColumnId** | bigint | NO | Foreign key to ListColumns table |
| **CreatedTimestamp** | datetime | NO | When the record was created |
| **CreatedBy** | uniqueidentifier | NO | User ID who created the record |
| **LastUpdatedTimestamp** | datetime | NO | When the record was last modified |
| **LastUpdatedBy** | uniqueidentifier | NO | User ID who last modified the record |

## Key Relationships

1. **Lists** (ListId → Lists.Id)
   - Defines which list this sort belongs to
   - Each list can have multiple sort columns

2. **ListColumns** (ListColumnId → ListColumns.Id)
   - Specifies which column to sort by
   - Same column can be in multiple lists' sort orders

## Sort Direction

### ASC (Ascending)
- Numbers: Low to high (1, 2, 3...)
- Dates: Old to new (earliest first)
- Text: A to Z (alphabetical)
- Boolean: False before True

### DESC (Descending)
- Numbers: High to low (10, 9, 8...)
- Dates: New to old (most recent first)
- Text: Z to A (reverse alphabetical)
- Boolean: True before False

## Multi-Column Sorting

### Order Priority
When multiple sort columns exist:
- **Order 1**: Primary sort (most important)
- **Order 2**: Secondary sort (breaks ties)
- **Order 3**: Tertiary sort (further ties)
- **Order n**: Additional tie-breaking

### Example
```
Order 1: Region (ASC)          -- Sort by region name A-Z
Order 2: Cluster (ASC)         -- Within region, sort clusters A-Z
Order 3: StartDate (DESC)      -- Within cluster, newest first
```

Results in SQL:
```sql
ORDER BY Region ASC, Cluster ASC, StartDate DESC
```

## Common Query Patterns

### Get Sort Columns for List
```sql
SELECT
    LC.[DisplayName] AS ColumnName,
    LSC.[SortDirection],
    LSC.[Order] AS SortPriority
FROM [ListSortColumns] LSC
INNER JOIN [ListColumns] LC ON LSC.[ListColumnId] = LC.[Id]
WHERE LSC.[ListId] = @ListId
ORDER BY LSC.[Order]
```

### Complete List Definition with Sort
```sql
SELECT
    L.[Name] AS ListName,
    LC.[DisplayName] AS SortColumn,
    LSC.[SortDirection],
    LSC.[Order]
FROM [Lists] L
INNER JOIN [ListSortColumns] LSC ON L.[Id] = LSC.[ListId]
INNER JOIN [ListColumns] LC ON LSC.[ListColumnId] = LC.[Id]
WHERE L.[Id] = @ListId
ORDER BY LSC.[Order]
```

### Lists Sorted by Specific Column
```sql
SELECT
    L.[Name] AS ListName,
    LSC.[SortDirection],
    LSC.[Order] AS Priority
FROM [ListSortColumns] LSC
INNER JOIN [Lists] L ON LSC.[ListId] = L.[Id]
INNER JOIN [ListColumns] LC ON LSC.[ListColumnId] = LC.[Id]
WHERE LC.[ColumnName] = @ColumnName
ORDER BY L.[Name]
```

## Business Rules and Constraints

1. **Required Fields**: ListId, ListColumnId, SortDirection, Order
2. **Valid Direction**: SortDirection must be ASC or DESC
3. **Unique Order**: Within a list, Order values should be unique
4. **Sortable Columns**: ListColumnId must reference sortable column
5. **Valid References**: Both ListId and ListColumnId must exist

## Usage Patterns

### Simple Sort
Single column sort:
```
Sort by: LastName (ASC)
```

### Multi-Level Sort
Multiple columns with priority:
```
Sort by:
  1. Region (ASC)
  2. Cluster (ASC)
  3. ActivityType (ASC)
```

### Mixed Directions
Different directions for different columns:
```
Sort by:
  1. Cluster (ASC)        -- A to Z
  2. StartDate (DESC)     -- Newest first
  3. LastName (ASC)       -- A to Z
```

## Common Sort Patterns

### Geographic Sorting
```
Order 1: Region (ASC)
Order 2: Cluster (ASC)
Order 3: Locality (ASC)
```

### Chronological Sorting
```
Order 1: StartDate (DESC)      -- Most recent first
Order 2: EndDate (DESC)
```

### Hierarchical Sorting
```
Order 1: ParentId (ASC)
Order 2: Order (ASC)
Order 3: Name (ASC)
```

### Status-Based Sorting
```
Order 1: IsCompleted (ASC)     -- Incomplete first
Order 2: StartDate (DESC)      -- Then newest
```

## Notes for Developers

- Build ORDER BY clause from sort columns
- Respect sort priority (Order field)
- Validate SortDirection values
- Ensure columns are sortable
- Handle NULL values in sorting
- Consider collation for text sorting
- Provide UI for sort configuration
- Allow drag-and-drop reordering

## Performance Considerations

### Index Usage
- Sorting uses indexes when available
- Multi-column sorts benefit from composite indexes
- Consider creating indexes on commonly sorted columns
- NULLS FIRST/LAST may affect performance

### Query Optimization
- Limit sort columns to reasonable number
- Sort by indexed columns when possible
- Avoid sorting by computed columns
- Consider materialized views for complex sorts

### Large Result Sets
- Sorting large datasets is expensive
- Combine with pagination
- Consider server-side sorting only
- Client-side sorting for small datasets

## UI Considerations

### Sort Configuration Interface
- Column selector
- Direction toggle (ASC/DESC)
- Priority order (drag-and-drop)
- Add/remove sort columns
- Preview sort results

### Visual Indicators
- Show current sort in headers
- Arrows for direction (↑↓)
- Numbers for multi-column priority
- Highlight active sort column

### User Experience
- Click header to sort
- Click again to reverse direction
- Shift-click for multi-column
- Clear all sorts option

## Data Type Considerations

### String Sorting
- Case-sensitive vs. case-insensitive
- Collation (language-specific)
- Unicode characters
- Null values (first or last)

### Numeric Sorting
- Integer vs. decimal
- Scientific notation
- NULL handling
- Infinity/-infinity

### Date Sorting
- DateTime vs. Date only
- Time zones
- NULL dates
- Partial dates

### Boolean Sorting
- TRUE/FALSE order
- NULL handling
- Tri-state (TRUE/FALSE/NULL)

## Best Practices

1. **Primary Sort**: Choose most important column first
2. **Meaningful Order**: Sort logically for use case
3. **Tie Breaking**: Add secondary sorts to break ties
4. **Index Awareness**: Sort on indexed columns when possible
5. **Reasonable Limit**: Don't sort by too many columns
6. **NULL Handling**: Consider NULL placement
7. **User Control**: Allow users to customize sort
8. **Performance**: Test with large datasets
9. **Defaults**: Provide sensible default sort orders
10. **Consistency**: Use consistent sort patterns across similar lists
