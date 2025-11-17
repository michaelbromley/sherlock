# ListDisplayColumns Table

## Overview
The `ListDisplayColumns` table specifies which columns are displayed in a custom list and in what order. This table creates a many-to-many relationship between Lists and ListColumns, defining the visible columns for each list configuration. It controls the presentation layer of the dynamic list system.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier

### Order

Display order of column in list (left to right)

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
   - Defines which list this column belongs to
   - Each list can have multiple display columns

2. **ListColumns** (ListColumnId → ListColumns.Id)
   - Specifies which column to display
   - Same column can be in multiple lists

## Purpose and Function

### Column Selection
Defines visible columns for a list:
- Which database fields to show
- What order to display them
- How to arrange data presentation
- User-customizable views

### Display Order
The Order field controls:
- Left-to-right column sequence
- Column priority (leftmost = most important)
- Visual organization
- User experience

## Common Query Patterns

### Get Display Columns for List
```sql
SELECT
    LC.[DisplayName],
    LC.[DataType],
    LDC.[Order]
FROM [ListDisplayColumns] LDC
INNER JOIN [ListColumns] LC ON LDC.[ListColumnId] = LC.[Id]
WHERE LDC.[ListId] = @ListId
ORDER BY LDC.[Order]
```

### Complete List Configuration
```sql
SELECT
    L.[Name] AS ListName,
    LC.[DisplayName] AS ColumnName,
    LC.[DataType],
    LDC.[Order]
FROM [Lists] L
INNER JOIN [ListDisplayColumns] LDC ON L.[Id] = LDC.[ListId]
INNER JOIN [ListColumns] LC ON LDC.[ListColumnId] = LC.[Id]
WHERE L.[Id] = @ListId
ORDER BY LDC.[Order]
```

### Lists Using Specific Column
```sql
SELECT
    L.[Name] AS ListName,
    LDC.[Order]
FROM [ListDisplayColumns] LDC
INNER JOIN [Lists] L ON LDC.[ListId] = L.[Id]
INNER JOIN [ListColumns] LC ON LDC.[ListColumnId] = LC.[Id]
WHERE LC.[ColumnName] = @ColumnName
ORDER BY L.[Name]
```

## Business Rules and Constraints

1. **Required Fields**: ListId, ListColumnId, Order must be provided
2. **Unique Combination**: (ListId, ListColumnId) should be unique (column shown once per list)
3. **Unique Order**: Within a list, Order values should be unique
4. **Valid References**: Both ListId and ListColumnId must reference existing records
5. **At Least One Column**: Lists should have at least one display column

## Usage Patterns

### List Creation
When user creates list:
1. Select columns to display
2. Arrange column order
3. Save configuration
4. Preview results

### List Modification
When user modifies list:
1. Add new columns
2. Remove columns
3. Reorder columns
4. Update configuration

### Query Execution
When running list query:
1. Retrieve display columns
2. Build SELECT clause
3. Order results
4. Format output

## Column Ordering

### Order Values
- **1**: First (leftmost) column
- **2**: Second column
- **3**: Third column
- **n**: Nth column

### Typical Patterns
Common ordering strategies:
- **Identifiers first**: ID, Name
- **Key fields next**: Important attributes
- **Details last**: Additional information
- **Dates at end**: Timestamps

### Example
```
Order 1: Individual Name
Order 2: Locality
Order 3: IsBahai
Order 4: BirthYear
Order 5: Email
Order 6: Phone
```

## Notes for Developers

- Validate column order for uniqueness within list
- Ensure at least one display column per list
- Provide UI for drag-and-drop column reordering
- Build SELECT clause dynamically from display columns
- Handle column additions/removals gracefully
- Consider column width and layout
- Support responsive design (mobile vs. desktop)

## Performance Considerations

### Query Building
- Join only necessary tables
- Select only specified columns
- Optimize based on column types
- Cache query plans

### Display
- Limit columns for mobile views
- Consider horizontal scrolling
- Responsive column hiding
- Virtual scrolling for many columns

## Integration Considerations

### UI Components
- Column picker/selector
- Drag-and-drop ordering
- Column width adjustment
- Show/hide toggles

### Export Functionality
- Export selected columns only
- Maintain column order
- Format by data type
- Include column headers

## Best Practices

1. **Logical Order**: Arrange columns logically
2. **Key Information First**: Important columns leftmost
3. **Reasonable Count**: Don't show too many columns
4. **Responsive**: Consider mobile/desktop differences
5. **Testing**: Test with actual data
6. **User Preference**: Allow users to customize
7. **Defaults**: Provide sensible default selections
8. **Performance**: Be mindful of query performance with many columns
