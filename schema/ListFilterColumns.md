# ListFilterColumns Table

## Overview
The `ListFilterColumns` table defines filter criteria for custom lists. It specifies which columns to filter on, what operators to use, and what values to filter by. This table implements the WHERE clause logic for the dynamic list system, enabling users to create complex filtered views without writing SQL.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier

### FilterOperator

Comparison operator (Equals, Contains, GreaterThan, etc.)

### FilterValue

Value to filter by

### LogicalOperator

AND/OR for combining with other filters

### ParentFilterColumnId

For nested filter groups (self-referential)

### Order

Order of filter application

### ListId

Foreign key to Lists table

### ListColumnId

Foreign key to ListColumns table

### CreatedTimestamp

When the record was created

### CreatedBy

User ID who created the record

### LastUpdatedTimestamp

When the record was last modified

### LastUpdatedBy

User ID who last modified the record

## Key Relationships

1. **Lists** (ListId → Lists.Id)
   - Defines which list this filter belongs to
   - Each list can have multiple filters

2. **ListColumns** (ListColumnId → ListColumns.Id)
   - Specifies which column to filter on
   - Same column can have multiple filters

3. **Self-Referential** (ParentFilterColumnId → ListFilterColumns.Id)
   - Creates hierarchical filter groups
   - Enables complex nested logic

## Filter Operators

### String Operators
- **Equals**: Exact match
- **NotEquals**: Exclude exact match
- **Contains**: Substring search
- **StartsWith**: Begins with value
- **EndsWith**: Ends with value
- **IsEmpty**: NULL or empty string
- **IsNotEmpty**: Has value

### Numeric Operators
- **Equals**: Exact numeric match
- **NotEquals**: Not equal to
- **GreaterThan**: > value
- **GreaterThanOrEqual**: >= value
- **LessThan**: < value
- **LessThanOrEqual**: <= value
- **Between**: Range (requires two values)

### Date Operators
- **Equals**: Exact date match
- **Before**: Earlier than date
- **After**: Later than date
- **Between**: Date range
- **InLast**: Last N days/weeks/months
- **InNext**: Next N days/weeks/months

### Boolean Operators
- **IsTrue**: Value is TRUE
- **IsFalse**: Value is FALSE
- **IsNull**: Value is NULL
- **IsNotNull**: Value is not NULL

## Logical Operators

### AND
- All conditions must be true
- Narrows results
- Default when not specified

### OR
- Any condition can be true
- Expands results
- Used for alternatives

## Hierarchical Filters

### Parent-Child Structure
Enables complex filter logic:
```
Filter Group 1 (AND)
  ├── Cluster = "Sacramento" (AND)
  └── Filter Group 2 (OR)
      ├── ActivityType = 2
      └── ActivityType = 1
```

### ParentFilterColumnId
- **NULL**: Top-level filter
- **Value**: Child of parent filter
- Enables nested filter groups
- Supports complex WHERE clauses

## Common Query Patterns

### Get Filters for List
```sql
SELECT
    LC.[DisplayName] AS ColumnName,
    LFC.[FilterOperator],
    LFC.[FilterValue],
    LFC.[LogicalOperator],
    LFC.[Order]
FROM [ListFilterColumns] LFC
INNER JOIN [ListColumns] LC ON LFC.[ListColumnId] = LC.[Id]
WHERE LFC.[ListId] = @ListId
    AND LFC.[ParentFilterColumnId] IS NULL
ORDER BY LFC.[Order]
```

### Complete Filter Hierarchy
```sql
WITH FilterHierarchy AS (
    -- Root level filters
    SELECT
        LFC.[Id],
        LFC.[FilterOperator],
        LFC.[FilterValue],
        LFC.[LogicalOperator],
        LC.[DisplayName],
        0 AS Level,
        LFC.[Order]
    FROM [ListFilterColumns] LFC
    INNER JOIN [ListColumns] LC ON LFC.[ListColumnId] = LC.[Id]
    WHERE LFC.[ListId] = @ListId
        AND LFC.[ParentFilterColumnId] IS NULL

    UNION ALL

    -- Child filters
    SELECT
        LFC.[Id],
        LFC.[FilterOperator],
        LFC.[FilterValue],
        LFC.[LogicalOperator],
        LC.[DisplayName],
        FH.Level + 1,
        LFC.[Order]
    FROM [ListFilterColumns] LFC
    INNER JOIN [ListColumns] LC ON LFC.[ListColumnId] = LC.[Id]
    INNER JOIN FilterHierarchy FH ON LFC.[ParentFilterColumnId] = FH.[Id]
)
SELECT * FROM FilterHierarchy
ORDER BY Level, [Order]
```

## Business Rules and Constraints

1. **Required Fields**: ListId, ListColumnId, FilterOperator, Order
2. **Valid Operator**: FilterOperator must be appropriate for column data type
3. **Value Required**: FilterValue typically required except for IS NULL operators
4. **Valid Logic**: LogicalOperator must be AND or OR
5. **Filterable Columns**: ListColumnId must reference filterable column

## Usage Patterns

### Simple Filter
Single condition:
```
Cluster Equals "Sacramento"
```

### Multiple Filters (AND)
All conditions must match:
```
Cluster Equals "Sacramento" AND
ActivityType Equals 2 AND
IsCompleted Equals False
```

### Multiple Filters (OR)
Any condition matches:
```
Cluster Equals "Sacramento" OR
Cluster Equals "San Francisco"
```

### Complex Nested
Combination of AND/OR:
```
(Cluster = "Sacramento" OR Cluster = "San Francisco") AND
ActivityType = 2 AND
StartDate > '2024-01-01'
```

## Filter Value Formats

### String Values
- Store as-is in FilterValue
- Case-sensitive or insensitive based on database

### Numeric Values
- Store as string, convert during query building
- Example: "42" → 42

### Date Values
- Store in ISO format: "2024-01-15"
- Parse to datetime during query

### Boolean Values
- Store as "true" or "false"
- Convert to bit during query

### Multi-Value (BETWEEN, IN)
- Separate with delimiter (e.g., pipe |)
- Example: "10|20" for BETWEEN 10 AND 20

## Notes for Developers

- Build WHERE clause dynamically from filters
- Respect hierarchical structure (parentheses)
- Validate operator matches column data type
- Sanitize filter values (SQL injection prevention)
- Support query parameter binding
- Provide filter builder UI
- Test with various data types
- Handle NULL values appropriately

## Filter Builder UI

### User Interface Components
- Column selector
- Operator dropdown
- Value input (varies by data type)
- Add filter button
- Remove filter button
- Group filters (AND/OR)
- Preview results

### Validation
- Ensure valid operator for data type
- Require value for non-NULL operators
- Validate date formats
- Range check numeric values

## Performance Considerations

### Index Usage
- Filters should use indexed columns when possible
- Avoid functions in filter columns (prevents index use)
- LIKE with leading wildcard slow
- Consider full-text search for text

### Query Optimization
- Apply most selective filters first
- Avoid OR when possible (use IN instead)
- Minimize nested queries
- Use appropriate data types

## Best Practices

1. **Selective Filters**: Use filters that narrow results significantly
2. **Indexed Columns**: Filter on indexed columns for performance
3. **Appropriate Operators**: Use operators matching data type
4. **Valid Values**: Validate filter values
5. **Logical Grouping**: Group related filters logically
6. **Clear Logic**: Make AND/OR logic clear
7. **Test Queries**: Test filter combinations with data
8. **User Guidance**: Provide examples and help text
