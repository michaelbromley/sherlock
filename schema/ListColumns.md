# ListColumns Table

## Overview
The `ListColumns` table defines all available database columns and fields that can be used in custom lists. It serves as a catalog of queryable fields from the SRP database, providing metadata about each column including its data type, source table, and display properties. This table is central to the dynamic list system, enabling users to build queries without writing SQL.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each column definition

### ColumnName

Technical name of the database column

### DisplayName

User-friendly name for display

### DataType

Data type (string, number, date, boolean, etc.)

### TableName

Source database table

### Order

Display order in column selection UI

### IsFilterable

Can this column be used in filters

### IsSortable

Can this column be used for sorting

### Description

Detailed description of the column

### CreatedTimestamp

When the column definition was created

### CreatedBy

User ID who created the definition

### LastUpdatedTimestamp

When the definition was last modified

### LastUpdatedBy

User ID who last modified the definition

## Key Relationships

1. **ListDisplayColumns** (One-to-Many)
   - Lists that display this column
   - ListDisplayColumns.ListColumnId references this table

2. **ListFilterColumns** (One-to-Many)
   - Filters using this column
   - ListFilterColumns.ListColumnId references this table

3. **ListSortColumns** (One-to-Many)
   - Sort orders using this column
   - ListSortColumns.ListColumnId references this table

## Column Metadata

### ColumnName
Technical database column name:
- Exact column name in database
- Used in SQL query generation
- Examples: "FirstName", "ClusterId", "StartDate"

### DisplayName
User-friendly label:
- Shown in UI for selection
- More readable than technical name
- Examples: "First Name", "Cluster", "Start Date"

### DataType
Supported data types:
- **string**: Text fields (names, descriptions)
- **number**: Numeric values (counts, IDs)
- **date**: Date/datetime fields
- **boolean**: True/false flags
- **lookup**: Foreign key references

### TableName
Source table in database:
- Identifies which table contains the column
- Used for JOIN logic
- Examples: "Individuals", "Activities", "Clusters"

## Filterability and Sortability

### IsFilterable
Indicates if column can be used in WHERE clauses:
- Text fields: Often filterable (search, equals, contains)
- Numeric fields: Filterable (equals, greater than, less than)
- Date fields: Filterable (date ranges)
- Blob/binary fields: Often not filterable

### IsSortable
Indicates if column can be used in ORDER BY:
- Most fields: Sortable
- Text/number/date: Natural sort orders
- Lookups: May sort by display value
- Aggregates: Context-dependent

## Common Query Patterns

### Get All Available Columns
```sql
SELECT
    [ColumnName],
    [DisplayName],
    [DataType],
    [TableName],
    [IsFilterable],
    [IsSortable]
FROM [ListColumns]
ORDER BY [TableName], [Order]
```

### Get Filterable Columns
```sql
SELECT
    [DisplayName],
    [DataType],
    [TableName]
FROM [ListColumns]
WHERE [IsFilterable] = 1
ORDER BY [TableName], [DisplayName]
```

### Get Columns for Specific Table
```sql
SELECT
    [ColumnName],
    [DisplayName],
    [DataType],
    [Description]
FROM [ListColumns]
WHERE [TableName] = 'Individuals'
ORDER BY [Order]
```

## Business Rules and Constraints

1. **Unique Column Reference**: (TableName, ColumnName) should be unique
2. **Valid Data Type**: DataType must match actual database column type
3. **Table Exists**: TableName must reference actual database table
4. **Column Exists**: ColumnName must exist in specified table
5. **Consistent Naming**: DisplayName should be user-friendly

## Usage Patterns

### Query Builder
Users select from available columns:
1. Choose table/entity
2. Select columns to display
3. Pick filter columns
4. Choose sort columns

### Filter Configuration
For filterable columns:
- String: equals, contains, starts with, ends with
- Number: equals, greater than, less than, between
- Date: equals, before, after, between
- Boolean: is true, is false

### Sort Configuration
For sortable columns:
- Ascending or descending
- Multiple column sorts
- Sort priority/order

## Notes for Developers

- ListColumns is metadata, not data
- Drives dynamic query generation
- Maps UI selections to SQL
- Requires maintenance when schema changes
- Consider access permissions per column
- Provide column descriptions for user guidance
- Group columns by table for better UX

## Data Population

### Initial Setup
When deploying system:
1. Create entry for each usable column
2. Set appropriate data types
3. Mark filterability and sortability
4. Provide user-friendly display names
5. Add helpful descriptions

### Schema Changes
When database schema changes:
1. Add new columns as available
2. Update column definitions if changed
3. Deprecate removed columns
4. Update data types if changed
5. Review filter/sort capabilities

## Special Considerations

### Computed Columns
Some columns may be computed:
- Full name from FirstName + FamilyName
- Age from BirthYear
- Current status from multiple flags
- Define computation logic elsewhere

### Lookup Fields
Foreign key columns:
- Reference other tables
- Display related entity name
- Filter by ID or name
- May require joins

### Multi-Language
For international use:
- DisplayName may need localization
- Description may need translation
- Consider language-specific column metadata
- Maintain consistency across languages

## Best Practices

1. **Complete Metadata**: Define all usable columns
2. **Clear Names**: Use intuitive display names
3. **Accurate Types**: Ensure data types match database
4. **Descriptions**: Provide helpful descriptions
5. **Maintenance**: Keep updated with schema changes
6. **Organization**: Use Order for logical grouping
7. **Permissions**: Consider column-level access control
8. **Testing**: Validate against actual database schema
