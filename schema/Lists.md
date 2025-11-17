# Lists Table

## Overview
The `Lists` table is part of the SRP database's dynamic list management system. It defines custom data views that users can create, configure, and save for querying and displaying data from the database. Lists provide a flexible framework for creating customized reports, filtered views, and specialized data displays without requiring new development or database changes.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each list

### Name

Name of the list

### Description

Detailed description of the list's purpose

### Order

Display order for lists in UI

### CreatedTimestamp

When the list was created

### CreatedBy

User ID who created the list

### LastUpdatedTimestamp

When the list was last modified

### LastUpdatedBy

User ID who last modified the list

## Key Relationships

1. **ListDisplayColumns** (One-to-Many)
   - Defines which columns to show in the list
   - ListDisplayColumns.ListId references this table

2. **ListFilterColumns** (One-to-Many)
   - Defines filter criteria for the list
   - ListFilterColumns.ListId references this table

3. **ListSortColumns** (One-to-Many)
   - Defines sort order for list results
   - ListSortColumns.ListId references this table

## List Management System Architecture

### Four-Table Framework
```
Lists (Definition)
  ├── ListDisplayColumns (What to show)
  ├── ListFilterColumns (What to filter)
  └── ListSortColumns (How to sort)
      └── All reference ListColumns (Available fields)
```

### Components
1. **Lists**: Top-level list definition
2. **ListColumns**: Available database columns/fields
3. **ListDisplayColumns**: Selected columns to display
4. **ListFilterColumns**: Filter conditions
5. **ListSortColumns**: Sort order specification

## Common Use Cases

### Predefined Lists
System administrators create standard lists:
- Active study circles by cluster
- Individuals completing Book 1
- Junior youth participants by region
- Electoral unit membership
- Cluster coordinators

### User-Defined Lists
Users create custom lists for their needs:
- Specific cluster reports
- Custom activity filters
- Specialized participant lists
- Administrative queries

## Common Query Patterns

### Get All Lists
```sql
SELECT
    [Id],
    [Name],
    [Description],
    [Order]
FROM [Lists]
ORDER BY [Order], [Name]
```

### Get List with Display Columns
```sql
SELECT
    L.[Name] AS ListName,
    LC.[ColumnName],
    LDC.[Order] AS DisplayOrder
FROM [Lists] L
INNER JOIN [ListDisplayColumns] LDC ON L.[Id] = LDC.[ListId]
INNER JOIN [ListColumns] LC ON LDC.[ListColumnId] = LC.[Id]
WHERE L.[Id] = @ListId
ORDER BY LDC.[Order]
```

### Lists by User
```sql
SELECT
    [Name],
    [Description],
    [CreatedTimestamp],
    [LastUpdatedTimestamp]
FROM [Lists]
WHERE [CreatedBy] = @UserId
ORDER BY [LastUpdatedTimestamp] DESC
```

## Business Rules and Constraints

1. **Name Required**: Every list must have a name
2. **Unique Names**: List names should be unique for clarity
3. **Order for Display**: Order field controls UI presentation
4. **Complete Definition**: Lists should have display columns defined
5. **Valid Components**: All referenced columns must exist in ListColumns

## Usage Patterns

### Report Generation
- Select predefined list
- Apply current filters
- Execute query
- Display results
- Export if needed

### Ad-Hoc Queries
- Create new list
- Select display columns
- Define filters
- Set sort order
- Save for future use

### Data Exploration
- Browse available lists
- Modify existing lists
- Test different filters
- Refine results
- Share with others

## Notes for Developers

- Lists are templates/definitions, not data
- Actual query execution happens at runtime
- Combine with ListDisplayColumns, ListFilterColumns, ListSortColumns
- Validate all column references
- Provide user-friendly list builder UI
- Cache list definitions for performance
- Handle list sharing and permissions

## Integration Considerations

### Query Builder
- Visual query builder interface
- Column selection
- Filter builder
- Sort configuration
- Preview results

### Export Functionality
- Export to CSV
- Export to Excel
- Export to PDF
- Scheduled exports
- Email delivery

## Best Practices

1. **Descriptive Names**: Use clear, descriptive list names
2. **Documentation**: Provide detailed descriptions
3. **Organization**: Use Order field for logical grouping
4. **Validation**: Ensure all components are valid
5. **Performance**: Consider query performance implications
6. **Sharing**: Enable sharing of useful lists
7. **Versioning**: Consider versioning for list definitions
8. **Testing**: Test lists with various data scenarios
