# ListFilterColumns Table

## Overview

The `ListFilterColumns` table implements the WHERE clause logic of the SRP database's dynamic list system, defining what filtering criteria should be applied to narrow and refine query results. This table transforms user-specified conditions like "show only activities in Sacramento" or "display individuals who completed Book 1 after January 2024" into database filter logic without requiring users to write SQL. Each record represents a single filter condition that contributes to the overall WHERE clause for a list, with support for complex logical combinations through AND/OR operators and hierarchical grouping for sophisticated filtering scenarios.

This filtering capability is central to making the vast datasets in the SRP database manageable and meaningful. A national database might contain hundreds of thousands of individuals and tens of thousands of activities, but a cluster coordinator needs to see only the few dozen activities in their geographic area, or a regional administrator might need to analyze only junior youth groups that started in the past quarter. The ListFilterColumns table enables these focused views by storing filter definitions that can be reused, shared, and modified without requiring technical expertise. Through hierarchical parent-child relationships, it supports complex logic like "(Cluster = 'Sacramento' OR Cluster = 'San Francisco') AND ActivityType = 'Study Circle' AND StartDate > '2024-01-01'", providing the flexibility needed for sophisticated data analysis while maintaining an intuitive user interface.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id (bigint, NULL)

The primary key and unique identifier for each filter condition record, serving as both the unique reference for this specific filter and the potential parent for other filter conditions in hierarchical filter structures. When one filter record has a ParentId pointing to another filter's Id, it creates a nested grouping structure that enables complex logical expressions with proper precedence handling. This self-referential capability is what allows the system to represent filters like "((A AND B) OR (C AND D)) AND E" without requiring users to understand parenthetical logic.

### ParentId (bigint, NOT NULL)

Specifies the Id of the parent filter record when this filter is part of a nested grouping structure, enabling hierarchical filter logic with proper logical precedence. When ParentId is 0 or points to a non-existent record (effectively NULL-equivalent), this filter is a top-level root condition that operates independently. When ParentId contains a valid Id reference, this filter becomes a child condition that is grouped with other children of the same parent before being combined with higher-level conditions. This mechanism enables complex filter expressions: if FilterA and FilterB both have ParentId pointing to FilterGroup1, and FilterGroup1 is a top-level filter combined with FilterC using AND, the result is "(FilterA OR FilterB) AND FilterC". The ParentId structure allows arbitrary nesting depth, though practical user interfaces typically limit to 2-3 levels to maintain comprehensibility.

### Operator (varchar, NULL)

Defines the comparison or evaluation operator to apply for this filter condition, using values such as "Equals", "NotEquals", "Contains", "StartsWith", "GreaterThan", "LessThan", "Between", "In", "IsNull", or "IsNotNull". The operator selected must be appropriate for the data type of the column being filtered: string columns support text operators like "Contains" and "StartsWith", numeric columns support comparison operators like "GreaterThan" and "Between", date columns support temporal operators like "Before" and "After", and all types support existence operators like "IsNull". The query generator uses this operator value to construct the appropriate SQL WHERE clause fragment - "Contains" becomes a LIKE expression with wildcards, "Between" generates a BETWEEN clause with two values, "In" creates an IN clause with a list of values, and so forth.

### Value (nvarchar, NOT NULL)

Stores the comparison value or values for this filter condition in string format, which the system interprets according to the operator and column data type. For simple operators like "Equals" or "GreaterThan", this contains a single value that gets converted to the appropriate type during query generation (e.g., "Sacramento" for string matching, "2024-01-15" for date comparison, "5" for numeric comparison). For operators requiring multiple values like "Between" or "In", this field contains a delimited list using a separator like pipe (|) or comma - "2024-01-01|2024-12-31" for date ranges or "Sacramento|San Francisco|Davis" for lists. The nvarchar type supports Unicode characters, ensuring that values in any language can be stored and filtered correctly. Special operators like "IsNull" might not use this field at all, as they don't require a comparison value.

### Order (smallint, NULL)

Controls the sequence in which filter conditions are evaluated and combined, particularly important when multiple filters share the same parent or exist at the same hierarchical level. While SQL engines can optimize query execution order, the Order field affects how conditions are presented to users and can influence query plan generation. Lower Order values typically represent more selective filters that should be applied first to reduce the dataset early in processing. For filters combined with AND, evaluation order might not matter logically (A AND B yields the same result as B AND A), but for OR combinations and complex nested structures, maintaining a consistent, predictable order improves user comprehension and troubleshooting.

### ListId (bigint, NULL)

A foreign key referencing the Lists table, identifying which list definition this filter belongs to. This relationship links the filter configuration to the overall list specification, enabling the system to retrieve all filters for a given list when constructing the WHERE clause. Each list can have multiple filter conditions that together define the complete filtering logic, from simple single-condition filters like "IsCompleted = false" to complex multi-level hierarchies. When users run a list, the system queries ListFilterColumns WHERE ListId = @ListId to gather all filter definitions, then processes them according to their Parent/Child relationships and logical operators to generate the final WHERE clause.

### ListColumnId (bigint, NOT NULL)

A foreign key referencing the ListColumns table, identifying which specific column this filter condition operates on. This relationship provides access to all the column's metadata - its database table and column name, data type, whether it's calculated, and how it should be referenced in filter expressions (through FilterColumnName or DBFilterColumnName). The column's data type determines which operators are valid for this filter, and the column's source determines what table joins might be necessary to apply the filter. A single list might filter on columns from multiple related tables (e.g., filtering Activities by ActivityType from the Activities table and Locality name from the Localities table), with the system automatically constructing necessary joins based on the ListColumnId references.

### CreatedTimestamp (datetime, NULL)

Records the precise moment when this filter condition was added to the list configuration, providing an audit trail for how filtering logic evolves over time. This timestamp captures when users refined their lists by adding new filter criteria, which helps administrators understand how users interact with the filtering system, when specific lists were configured for particular purposes, and how filter complexity grows in response to data analysis needs. For filters created during bulk list import or system initialization, this reflects the setup time rather than individual user decisions.

### CreatedBy (uniqueidentifier, NULL)

Stores the GUID of the user account that created this filter condition, establishing accountability for filter configuration decisions. This field enables tracking who is building complex filtered views, understanding which users need training on filter capabilities, and attributing filter logic to specific individuals when questions arise about why a list shows certain results. For system-generated or predefined list filters, this might be NULL or reference a system account, distinguishing between user-created filters and official system configurations.

### LastUpdatedTimestamp (datetime, NULL)

Captures the most recent moment when this filter condition was modified - changes to the operator, value, logical relationships, or any other aspect of the filter. This timestamp is crucial for cache invalidation in multi-tier applications, as it indicates when the list's filtering logic changed and cached results should be discarded. It helps administrators identify recently modified lists and understand when filter changes might have affected report outputs or user-visible results.

### LastUpdatedBy (uniqueidentifier, NULL)

Records the GUID of the user who most recently modified this filter condition, completing the audit trail for filter logic changes. When multiple coordinators or administrators have permission to modify list configurations, this field provides clear accountability for filter modifications. Combined with LastUpdatedTimestamp, it creates a complete picture of when and by whom filtering logic was adjusted, which is invaluable for troubleshooting unexpected list results or understanding why a list's output changed between runs.

## Key Relationships

### Parent List (Many-to-One)

The ListId foreign key creates a many-to-one relationship to the Lists table:
- Each filter condition belongs to exactly one list
- Each list can have multiple filter conditions (often many)
- Together, all ListFilterColumns records for a given ListId define the complete WHERE clause logic
- Deleting a list typically cascades to delete all its filter configurations

This relationship enables retrieval of all filters for a list via WHERE ListId = @ListId.

### Filtered Column (Many-to-One)

The ListColumnId foreign key creates a many-to-one relationship to the ListColumns table:
- Each filter condition operates on exactly one column
- Each column can be filtered in multiple lists and multiple times within a list
- The referenced ListColumn provides metadata needed for correct filter construction
- The column's data type determines valid operators and value interpretation

This relationship provides access to DBFilterColumnName for query construction.

### Hierarchical Self-Relationship (Tree Structure)

The ParentId field creates a self-referential relationship enabling tree structures:
- Records with ParentId = 0 or NULL are root-level filters
- Records with valid ParentId are child filters grouped under that parent
- Children of the same parent are combined using their logical operators
- Enables arbitrary nesting depth: Parent → Children → Grandchildren → etc.
- Supports complex logical expressions like ((A OR B) AND C) OR (D AND E)

This hierarchical capability is what distinguishes sophisticated filtering from simple condition lists.

## Filter Logic and Evaluation

### Logical Operator Combinations

The system supports two primary logical operators:

**AND - Conjunction (Narrowing)**
- All conditions must be true
- Reduces result set size
- Example: "ActivityType = 'Study Circle' AND StartDate > '2024-01-01'"
- Combining N conditions with AND produces a subset of each individual condition's results

**OR - Disjunction (Broadening)**
- Any condition can be true
- Expands result set size
- Example: "Cluster = 'Sacramento' OR Cluster = 'San Francisco'"
- Combining N conditions with OR produces a union of individual condition results

### Hierarchical Filter Evaluation

Filters are evaluated in hierarchical order:

1. **Leaf-Level Evaluation** - Process innermost filters first (those with no children)
2. **Combination Within Group** - Combine sibling filters under same parent using their operators
3. **Parent-Level Processing** - Treat combined child results as single unit for parent-level logic
4. **Recursive Upward** - Continue upward through hierarchy until root level
5. **Final WHERE Clause** - Combine all root-level filter groups

**Example Structure:**
```
FilterGroup1 (Root, combines children with OR)
  ├── FilterA: Cluster = "Sacramento"
  └── FilterB: Cluster = "San Francisco"
FilterC (Root, combined with FilterGroup1 via AND)
  └── ActivityType = "Study Circle"

Result: (Cluster = 'Sacramento' OR Cluster = 'San Francisco') AND ActivityType = 'Study Circle'
```

### Operator Implementation

Different operators generate different SQL constructs:

**Equals**
- SQL: `ColumnName = 'Value'`
- Example: `ActivityType = 2`

**NotEquals**
- SQL: `ColumnName <> 'Value'` or `ColumnName != 'Value'`
- Example: `IsCompleted <> 1`

**Contains (String)**
- SQL: `ColumnName LIKE '%Value%'`
- Example: `LocalityName LIKE '%Sacramento%'`

**StartsWith (String)**
- SQL: `ColumnName LIKE 'Value%'`
- Example: `FirstName LIKE 'John%'`

**GreaterThan**
- SQL: `ColumnName > Value`
- Example: `Participants > 10`

**LessThan**
- SQL: `ColumnName < Value`
- Example: `BirthYear < 2010`

**Between**
- SQL: `ColumnName BETWEEN Value1 AND Value2`
- Values stored as: "Value1|Value2"
- Example: `StartDate BETWEEN '2024-01-01' AND '2024-12-31'`

**In (List)**
- SQL: `ColumnName IN ('Value1', 'Value2', 'Value3')`
- Values stored as: "Value1|Value2|Value3"
- Example: `ActivityType IN (0, 1, 2)`

**IsNull**
- SQL: `ColumnName IS NULL`
- Value field not used

**IsNotNull**
- SQL: `ColumnName IS NOT NULL`
- Value field not used

## Common Query Patterns

### Get Filters for List

```sql
SELECT
    LC.[DisplayName] AS ColumnName,
    LC.[ColumnType],
    LFC.[Operator],
    LFC.[Value],
    LFC.[ParentId],
    LFC.[Order]
FROM [ListFilterColumns] LFC
INNER JOIN [ListColumns] LC ON LFC.[ListColumnId] = LC.[Id]
WHERE LFC.[ListId] = @ListId
ORDER BY LFC.[ParentId], LFC.[Order]
```

### Get Root-Level Filters Only

```sql
SELECT
    LC.[DisplayName],
    LC.[DBFilterColumnName],
    LFC.[Operator],
    LFC.[Value]
FROM [ListFilterColumns] LFC
INNER JOIN [ListColumns] LC ON LFC.[ListColumnId] = LC.[Id]
WHERE LFC.[ListId] = @ListId
    AND (LFC.[ParentId] = 0 OR LFC.[ParentId] IS NULL)
ORDER BY LFC.[Order]
```

### Get Complete Filter Hierarchy (Recursive)

```sql
WITH FilterHierarchy AS (
    -- Root level filters (no parent)
    SELECT
        LFC.[Id],
        LFC.[ParentId],
        LC.[DisplayName] AS ColumnName,
        LC.[DBFilterColumnName],
        LFC.[Operator],
        LFC.[Value],
        0 AS Level,
        LFC.[Order],
        CAST(RIGHT('000' + CAST(LFC.[Order] AS VARCHAR), 3) AS VARCHAR(MAX)) AS HierarchyPath
    FROM [ListFilterColumns] LFC
    INNER JOIN [ListColumns] LC ON LFC.[ListColumnId] = LC.[Id]
    WHERE LFC.[ListId] = @ListId
        AND (LFC.[ParentId] = 0 OR LFC.[ParentId] NOT IN (SELECT Id FROM [ListFilterColumns]))

    UNION ALL

    -- Child filters
    SELECT
        LFC.[Id],
        LFC.[ParentId],
        LC.[DisplayName],
        LC.[DBFilterColumnName],
        LFC.[Operator],
        LFC.[Value],
        FH.Level + 1,
        LFC.[Order],
        FH.HierarchyPath + '.' + RIGHT('000' + CAST(LFC.[Order] AS VARCHAR), 3)
    FROM [ListFilterColumns] LFC
    INNER JOIN [ListColumns] LC ON LFC.[ListColumnId] = LC.[Id]
    INNER JOIN FilterHierarchy FH ON LFC.[ParentId] = FH.[Id]
    WHERE LFC.[ListId] = @ListId
)
SELECT
    Id, ParentId, ColumnName, DBFilterColumnName,
    Operator, Value, Level, [Order], HierarchyPath
FROM FilterHierarchy
ORDER BY HierarchyPath
```

### Find Lists Using Specific Filter Column

```sql
SELECT
    L.[Name] AS ListName,
    COUNT(LFC.[Id]) AS FilterCount,
    STRING_AGG(LFC.[Operator], ', ') AS OperatorsUsed
FROM [ListFilterColumns] LFC
INNER JOIN [Lists] L ON LFC.[ListId] = L.[Id]
INNER JOIN [ListColumns] LC ON LFC.[ListColumnId] = LC.[Id]
WHERE LC.[ColumnName] = @ColumnName
GROUP BY L.[Name]
ORDER BY L.[Name]
```

## Business Rules and Constraints

1. **ListId Required**: Every filter must belong to a specific list
2. **ListColumnId Required**: Every filter must reference a valid filterable column
3. **Operator Required**: Filter operator must be specified and valid for column data type
4. **Value Required for Most Operators**: All operators except IsNull/IsNotNull require a value
5. **Valid Parent Reference**: ParentId must reference an existing filter in same list or be 0/NULL
6. **No Circular References**: Filters cannot create circular parent-child relationships
7. **Filterable Columns**: ListColumnId must reference a column where IsFilterableListColumn=true
8. **Appropriate Operators**: Operator must be valid for the column's data type
9. **Properly Formatted Values**: Multi-value operators (Between, In) must have properly formatted Value field
10. **Hierarchical Integrity**: Child filters should not be orphaned (parent deleted without children)

## Usage Patterns

### Simple Single-Condition Filter

Most basic filtering scenario:
```
Filter: ActivityType Equals "Study Circle"
```

Implementation:
- One ListFilterColumns record
- ParentId = 0 (root level)
- Operator = "Equals"
- Value = "2" (ActivityType enum value)
- Generates WHERE: `ActivityType = 2`

### Multiple AND Conditions

All conditions must be met:
```
Filter: ActivityType = Study Circle
    AND StartDate > 2024-01-01
    AND IsCompleted = false
```

Implementation:
- Three ListFilterColumns records
- All have ParentId = 0 (root level)
- All combined with AND operator
- Generates WHERE: `ActivityType = 2 AND StartDate > '2024-01-01' AND IsCompleted = 0`

### Multiple OR Conditions

Any condition can be met:
```
Filter: Cluster = "Sacramento"
    OR Cluster = "San Francisco"
    OR Cluster = "Davis"
```

Implementation:
- Three ListFilterColumns records
- All have ParentId = 0
- All combined with OR operator
- Generates WHERE: `Cluster = 'Sacramento' OR Cluster = 'San Francisco' OR Cluster = 'Davis'`

Better Implementation (using IN operator):
- One ListFilterColumns record
- Operator = "In"
- Value = "Sacramento|San Francisco|Davis"
- Generates WHERE: `Cluster IN ('Sacramento', 'San Francisco', 'Davis')`

### Complex Nested Logic

Sophisticated filtering with precedence:
```
Filter: (Cluster = "Sacramento" OR Cluster = "San Francisco")
    AND ActivityType = "Study Circle"
    AND StartDate > "2024-01-01"
```

Implementation:
- Create FilterGroup (Id = 100, ParentId = 0) for cluster conditions
- FilterA (Id = 101, ParentId = 100): Cluster = "Sacramento", OR
- FilterB (Id = 102, ParentId = 100): Cluster = "San Francisco", OR
- FilterC (Id = 103, ParentId = 0): ActivityType = "Study Circle", AND
- FilterD (Id = 104, ParentId = 0): StartDate > "2024-01-01", AND

Generates WHERE:
`(Cluster = 'Sacramento' OR Cluster = 'San Francisco') AND ActivityType = 2 AND StartDate > '2024-01-01'`

### Date Range Filter

Common temporal filtering:
```
Filter: StartDate between 2024-01-01 and 2024-12-31
```

Implementation:
- One ListFilterColumns record
- Operator = "Between"
- Value = "2024-01-01|2024-12-31"
- Generates WHERE: `StartDate BETWEEN '2024-01-01' AND '2024-12-31'`

### NULL Value Filtering

Finding records with missing data:
```
Filter: Email IS NULL (find individuals without email)
```

Implementation:
- One ListFilterColumns record
- Operator = "IsNull"
- Value = "" (empty or not used)
- Generates WHERE: `Email IS NULL`

## Filter Value Formats

### String Values

Stored as-is in Value field:
- "Sacramento"
- "Study Circle"
- "John Smith"

Considerations:
- Case sensitivity depends on database collation
- Unicode characters supported via nvarchar
- Special characters might need escaping for LIKE operators
- Wildcard characters (%, _) in LIKE searches

### Numeric Values

Stored as string, converted during query generation:
- "42" → INTEGER: 42
- "3.14159" → DECIMAL: 3.14159
- "0" → BIT: false/0
- "1" → BIT: true/1

Validation:
- Must be parseable to target numeric type
- Range checks for integer types
- Precision considerations for decimals

### Date and DateTime Values

Stored in ISO format or locale-specific format:
- "2024-01-15" (ISO date)
- "2024-01-15 14:30:00" (ISO datetime)
- "01/15/2024" (US format, if configured)

Parsing:
- System attempts parsing based on configured formats
- ISO 8601 format recommended for unambiguous dates
- Timezone considerations for datetime values
- Handling of date-only vs. datetime columns

### Boolean Values

Stored as string representation:
- "true" or "1" for TRUE
- "false" or "0" for FALSE

Query generation converts to bit values:
- Generates: `IsCompleted = 1` or `IsCompleted = 0`

### Multiple Values (BETWEEN, IN)

Delimited with pipe or comma:
- **Between**: "10|20" → `BETWEEN 10 AND 20`
- **Between Dates**: "2024-01-01|2024-12-31" → `BETWEEN '2024-01-01' AND '2024-12-31'`
- **In List**: "Sacramento|San Francisco|Davis" → `IN ('Sacramento', 'San Francisco', 'Davis')`
- **In Numbers**: "0|1|2" → `IN (0, 1, 2)`

Parsing:
- Split on delimiter character
- Convert each value to appropriate type
- Build IN or BETWEEN clause accordingly

## Performance Considerations

### Filter Selectivity

Optimize filter order for best performance:
- **Most Selective First**: Apply filters that eliminate the most rows early
- **Indexed Columns**: Filter on indexed columns when possible
- **Foreign Keys**: Filters on foreign keys often use indexes
- **Avoid Functions**: Don't filter on calculated/function results when possible

Example optimization:
```
Bad Order:
  1. YEAR(BirthDate) > 1990 (function prevents index use)
  2. IsCompleted = 0 (highly selective, should be first)

Good Order:
  1. IsCompleted = 0 (highly selective, uses index)
  2. BirthDate > '1990-01-01' (uses index, avoids function)
```

### Index Usage

Design filters to leverage indexes:
- Filter on indexed columns
- Use operators that can use indexes (=, <, >, BETWEEN, IN)
- Avoid leading wildcards in LIKE (`LIKE '%value'` can't use index)
- Consider composite indexes for frequently combined filters

### Query Complexity

Balance flexibility with performance:
- Limit nesting depth (2-3 levels maximum)
- Minimize number of OR conditions (consider IN instead)
- Watch for cartesian products with complex joins
- Test filters with production-scale data

### Caching and Materialization

For frequently-used complex filters:
- Cache compiled SQL WHERE clauses
- Consider materialized views for static filters
- Pre-compute filter results for expensive operations
- Use query plan caching

## Notes for Developers

When implementing filter functionality:

- **Parse hierarchical structure** - Build filter tree from Parent/Child relationships
- **Generate SQL safely** - Use parameterized queries to prevent SQL injection
- **Validate operators** - Ensure operator matches column data type
- **Convert values appropriately** - Parse string values to correct types
- **Handle special operators** - IsNull, IsNotNull don't use Value field
- **Support multi-value parsing** - Split delimited values for BETWEEN, IN
- **Build WHERE clause recursively** - Process hierarchy from leaves up
- **Add parentheses correctly** - Group child filters before combining with parents
- **Test edge cases** - NULL values, empty strings, special characters
- **Provide filter preview** - Show generated SQL or result count before saving
- **Validate circular references** - Prevent parent-child loops
- **Optimize query plans** - Monitor performance of complex filter combinations

## Integration Considerations

### Visual Filter Builder

User interface for building filters should provide:
- Column selector showing filterable columns
- Operator dropdown appropriate for selected column type
- Value input control matching column type (date picker, numeric input, text box)
- AND/OR toggle for combining conditions
- Grouping controls for creating nested logic
- Visual hierarchy display (indentation, tree view)
- Remove filter button
- Preview of generated filter logic
- Result count estimate

### SQL WHERE Clause Generation

Process for converting filter records to SQL:

1. **Retrieve all filters** for list: `WHERE ListId = @ListId`
2. **Build filter tree** from ParentId relationships
3. **Process leaf nodes** first (filters with no children)
4. **Convert each filter** to SQL fragment using Operator and Value
5. **Group siblings** under same parent with their logical operators
6. **Add parentheses** around groups
7. **Combine groups** according to parent-level logic
8. **Recursively build** upward through hierarchy
9. **Generate final WHERE clause** from root-level filters
10. **Parameterize values** for SQL injection prevention

### Filter Templates and Reuse

Enable filter pattern reuse:
- Save filter configurations as templates
- Apply saved filters to new lists
- Share filters across users
- Quick filters for common conditions (This Quarter, My Cluster, Active Only)

## Best Practices

1. **Start Simple** - Begin with simple filters, add complexity as needed
2. **Most Selective First** - Order filters by selectivity for performance
3. **Use IN for OR Lists** - Instead of multiple OR conditions, use IN operator
4. **Index Awareness** - Filter on indexed columns when possible
5. **Avoid Wildcards** - Leading wildcards (`LIKE '%value'`) can't use indexes
6. **Test with Data** - Verify filters with production-scale datasets
7. **Document Complex Logic** - Add descriptions for sophisticated filter hierarchies
8. **Limit Nesting** - Keep hierarchy depth reasonable (2-3 levels max)
9. **Validate Values** - Ensure filter values are appropriate for data type
10. **Consider Users** - Build filters that users understand and can modify

## Advanced Features

### Dynamic Value Substitution

Support for parameter-based filtering:
- {{CurrentUser}} - Filter by current logged-in user
- {{CurrentQuarter}} - Dynamic date range for current quarter
- {{MyCluster}} - User's assigned cluster
- {{Today}} - Current date

### Saved Filter Sets

Enable reusable filter combinations:
- Save filter configuration as named set
- Apply to multiple lists
- Share across users
- Version control for filter evolution

### Filter Statistics

Provide feedback on filter effectiveness:
- Row count before/after filter
- Filter selectivity percentage
- Performance impact metrics
- Suggestions for optimization

## Security and Privacy Considerations

Filters can expose or protect sensitive data:

- **Automatic Geographic Scoping** - Apply user's authorized geographic scope automatically
- **Role-Based Filtering** - Enforce filters based on user role (coordinators see only their cluster)
- **PII Protection** - Restrict filtering on sensitive columns
- **Audit Filter Usage** - Track who applies which filters
- **Prevent Data Mining** - Limit overly broad filters that could expose entire datasets
- **Injection Prevention** - Always parameterize filter values, never concatenate into SQL

When creating or modifying filters:
- Ensure geographic scope filters are applied and cannot be removed by users
- Validate that filter combinations don't expose unauthorized data
- Test filters with various user permission levels
- Audit complex or unusual filter patterns
- Document security-critical filters
- Prevent users from removing mandatory security filters
