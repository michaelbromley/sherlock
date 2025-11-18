# ListColumns Table

## Overview

The `ListColumns` table serves as the comprehensive metadata catalog for the SRP database's dynamic list system, defining every database field and computed column that can potentially be used in user-created lists and reports. This table functions as the "column dictionary" that bridges the gap between the database's technical schema and user-friendly interfaces, translating database column names like "LocalityId" into display names like "Locality" while providing essential metadata about data types, filterability, and sortability. Each record represents a single field that users can select when building custom lists, whether that field is a simple database column, a computed expression, or a complex relationship to another table.

This metadata-driven approach is fundamental to enabling non-technical users to build sophisticated queries without understanding SQL syntax or database structure. The ListColumns table embodies the principle that proper abstraction - giving users the right conceptual tools - is more empowering than direct database access. By cataloging which columns exist, what they contain, how they can be used, and how they should be displayed, this table enables the query builder to present appropriate options, validate user selections, and generate correct SQL. For a multi-national educational tracking system serving users from coordinators to administrators, this abstraction layer ensures that powerful data analysis capabilities remain accessible regardless of technical background.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id (bigint, NOT NULL)

The primary key and unique identifier for each column definition, serving as the stable reference point for all related tables (ListDisplayColumns, ListFilterColumns, ListSortColumns) that specify which columns appear in particular lists. This auto-incrementing identifier remains constant throughout the column's lifecycle, ensuring that list definitions remain valid even as column metadata is updated or refined. The Id serves as the essential link in the many-to-many relationships between Lists and available columns.

### EntityType (varchar, NULL)

Specifies the primary database entity that this column belongs to or is most closely associated with, such as "Individual", "Activity", "Cluster", "Locality", or "Cycle". This categorization helps the system present relevant columns when users are building lists for a specific entity type - when creating an Activity list, users primarily see columns with EntityType="Activity", though related columns from joined tables may also be available. This field enables efficient filtering of the column catalog and helps validate that selected columns are appropriate for the list being created. While nullable, most operational columns should specify an EntityType to facilitate proper categorization.

### TableName (varchar, NULL)

The actual database table name where this column physically resides, such as "Activities", "Individuals", "Localities", or "Clusters". For columns that directly map to database fields, this specifies the source table for the column. For computed columns or columns that involve joins, this indicates the primary table involved in the calculation or join. This field is essential for the query builder to construct proper FROM and JOIN clauses, ensuring that the generated SQL references the correct tables and establishes appropriate relationships. Together with ColumnName, this uniquely identifies the source of the data for non-computed columns.

### ColumnName (varchar, NULL)

The technical name of the database column exactly as it appears in the database schema, such as "LocalityId", "StartDate", "FirstName", or "IsCompleted". For direct column mappings, this is the literal column name that will appear in the SELECT clause of generated SQL. For computed columns (where IsCalculated=true), this might be NULL or represent a virtual column name used internally. The ColumnName provides the technical identifier that the query builder uses to construct SQL statements, while DisplayName provides the user-friendly label that appears in interfaces.

### SortColumnName (varchar, NOT NULL)

Specifies the column name or expression that should be used when this field is included in ORDER BY clauses. For simple columns, this typically matches ColumnName, but for complex expressions, lookup fields, or calculated columns, it might specify a different column or expression that produces meaningful sort results. For example, a "Locality" display column that shows locality names might use "Localities.Name" as the SortColumnName even though the actual column being displayed involves a join. This separation allows the system to display one thing while sorting by another, ensuring intuitive sort behavior even for complex columns.

### FilterColumnName (varchar, NOT NULL)

Defines the column name or expression that should be used when this field appears in WHERE clauses for filtering. Similar to SortColumnName, this might differ from ColumnName for complex columns. For instance, a calculated "Age" column might have FilterColumnName pointing to a date calculation expression rather than a direct column. This field ensures that filters produce correct results even when the displayed column involves complex logic, joins, or calculations. By explicitly defining what to filter on, the system can generate syntactically correct and semantically meaningful filter conditions.

### Name (varchar, NULL)

An alternative or internal name for the column, potentially used for programmatic reference, legacy compatibility, or internal system operations. While DisplayName serves user-facing purposes and ColumnName reflects the database schema, Name might provide an intermediate identifier used in application code, configuration files, or system-to-system communication. This field offers flexibility for maintaining multiple naming conventions simultaneously, supporting scenarios where different parts of the system need to reference columns differently.

### DisplayName (varchar, NOT NULL)

The user-friendly, human-readable label for this column as it appears in all user interfaces, column selection dialogs, filter builders, and report headers. This required field transforms technical database names into accessible language - "LocalityId" becomes "Locality", "BahaiParticipants" becomes "Bahá'í Participants", "CreatedTimestamp" becomes "Created Date". The DisplayName is what users see and select, making it crucial for usability. For multi-language systems, this might be a key to a localization table, though in the current schema it's a direct string. Clear, consistent DisplayNames are essential for enabling non-technical users to confidently build lists.

### IsCalculated (bit, NULL)

A boolean flag indicating whether this column's value is computed on-the-fly rather than directly retrieved from a database column. When true, the column represents a calculated field such as age (computed from birthdate), duration (end date minus start date), percentages (one value divided by another), or status indicators (based on multiple conditions). Calculated columns require the Expression field to define how the value is computed, and the query builder must include this expression in the SELECT clause rather than a simple column reference. This flag helps the system handle these columns appropriately, applying calculations at the right stage of query execution.

### Expression (varchar, NOT NULL)

For calculated columns (IsCalculated=true), this field contains the SQL expression or formula that defines how to compute the column's value. This might be a simple calculation like "YEAR(GETDATE()) - BirthYear" for age, a CASE statement for conditional logic, a string concatenation like "FirstName + ' ' + FamilyName" for full names, or complex expressions involving subqueries or aggregations. For non-calculated columns, this typically contains the simple column reference or might be empty. The Expression field enables the system to support arbitrary computed columns without requiring application code changes, making the column catalog extensible and flexible.

### IsAvailableListColumn (bit, NULL)

Indicates whether this column can be used in the "list" context - the standard data viewing and browsing interface where users see tabular data. When true, this column appears in column selection dialogs when building lists, and users can choose to display it in their custom views. When false, the column might be restricted to other contexts (reports, exports, etc.) or might be deprecated but maintained for backward compatibility. This flag enables fine-grained control over which columns are exposed in which contexts, allowing the system to simplify the user experience by hiding rarely-used or context-inappropriate columns from the list builder.

### IsRequiredListColumn (bit, NULL)

A flag indicating that this column must always be included in lists of this entity type and cannot be removed by users. Required columns typically include essential identifiers or key fields that are necessary for the list to be meaningful - for instance, an Individual list might require displaying the person's name, or an Activity list might require the activity type. When true, the system automatically includes this column in new lists and prevents users from removing it, ensuring that critical information is always visible. This guarantees a minimum level of usability and comprehensibility for all lists.

### IsSelectableListColumn (bit, NULL)

Controls whether users can actively choose to include or exclude this column when building or customizing lists. When false, the column might be automatically included (if IsRequiredListColumn=true) or completely hidden from user selection, but users cannot toggle its inclusion. When true, users see this column as an option in the column picker and can choose whether to display it. This flag works in combination with IsAvailableListColumn and IsRequiredListColumn to create a nuanced permission system: available but not selectable (automatic), available and selectable (user choice), or not available (hidden).

### IsOrderableListColumn (bit, NULL)

Indicates whether this column can be used for sorting list results in the list context. When true, users can click column headers to sort by this field, or include it in multi-column sort configurations. Some columns might not be sortable due to their data type (large text fields, binary data), complexity (certain calculated expressions), or business logic (sorting wouldn't be meaningful). This flag helps the system provide appropriate UI elements - sortable columns get clickable headers with sort indicators, while non-sortable columns do not. The flag works in conjunction with SortColumnName to enable proper sort behavior.

### IsFilterableListColumn (bit, NULL)

Specifies whether this column can be used in filter criteria for lists. When true, users can create filter conditions on this field, selecting operators and values to narrow their results. Some columns might not be filterable due to data type constraints, performance considerations, or business logic. For example, large text fields might be excluded from filtering, or certain calculated columns might be too expensive to filter on. This flag determines whether the column appears in filter builder interfaces and whether the query generator will accept filter conditions on this column. It works with FilterColumnName to implement filtering correctly.

### IsAvailableReportColumn (bit, NULL)

Indicates whether this column is available for use in formal reports, which may have different requirements or constraints than interactive lists. Reports often include additional columns for formatting, grouping headers, or statistical annotations that wouldn't make sense in browsing lists. Conversely, some columns useful for interactive filtering might be excluded from reports. This flag enables the system to maintain separate column inventories for different usage contexts, ensuring that report builders see appropriate options while list builders see theirs.

### IsRequiredReportColumn (bit, NULL)

Specifies that this column must be included in reports of this entity type and cannot be omitted. Required report columns might include fields needed for regulatory compliance, statistical integrity, or standard report formats. For example, quarterly statistical reports might require specific demographic or activity count fields to meet organizational reporting requirements. This flag ensures that formal reports maintain consistency and completeness, preventing users from accidentally omitting critical information from official documents.

### IsSelectableReportColumn (bit, NULL)

Controls whether users can choose to include or exclude this column when building custom reports. Similar to IsSelectableListColumn but in the report context, this flag determines user control over column inclusion. Some columns might be automatically included (required), automatically excluded (not available), or subject to user choice (selectable). This granular control enables report templates that balance standardization (required fields) with flexibility (selectable fields).

### IsOrderableReportColumn (bit, NULL)

Indicates whether this column can be used for sorting in the report context. Report sorting might differ from list sorting due to different use cases - reports might support complex grouping and subtotaling that requires different sort capabilities than interactive lists. This flag controls whether the column can be included in report sort configurations, enabling the system to offer appropriate sort options for formal report generation while potentially differing from interactive list capabilities.

### IsFilterableReportColumn (bit, NULL)

Specifies whether this column can be used in filter criteria when generating reports. Report filtering might differ from list filtering - reports might support different filter operators, date range specifications, or parameter-based filtering that makes sense for batch report generation but not interactive browsing. This flag determines whether report builders can create filter conditions on this field, enabling appropriate filtering capabilities in the reporting context.

### ColumnType (varchar, NULL)

Categorizes the column by its data type or semantic meaning, using values such as "string", "number", "date", "datetime", "boolean", "lookup", or "calculated". This classification helps the system provide appropriate UI controls - string columns get text input boxes, date columns get date pickers, boolean columns get checkboxes, lookup columns get dropdown lists. The ColumnType also guides filter operator selection (string columns offer "contains" and "starts with", numeric columns offer "greater than" and "less than") and formatting decisions (how to display values in grids and reports). This field is crucial for building intelligent, type-appropriate user interfaces.

### Order (smallint, NULL)

Controls the display sequence of columns when presenting the column catalog to users, enabling administrators to organize columns logically rather than alphabetically. Important or commonly-used columns can appear first, with specialized or rarely-used columns appearing later. Within an entity type or category, lower Order values appear first. Using gaps (10, 20, 30) allows for future insertions without renumbering. This ordering significantly improves user experience by presenting the most relevant options prominently.

### CreatedTimestamp (datetime, NULL)

Records when this column definition was first added to the catalog, providing an audit trail for metadata evolution. This timestamp helps track when new columns became available, which is useful for understanding system evolution, debugging issues related to column availability, and managing synchronization across multiple environments. For columns added during initial system setup, this reflects the installation date; for columns added later, it shows when the column catalog was extended.

### LastUpdatedTimestamp (datetime, NULL)

Captures when any aspect of this column definition was last modified - changes to DisplayName, availability flags, expressions, or any other metadata. This timestamp is crucial for cache invalidation in multi-tier applications, enabling the system to detect when column metadata has changed and refresh cached column catalogs. It also provides an audit trail for metadata evolution and helps troubleshoot issues where column behavior changed unexpectedly.

### IsAvailableExportColumn (bit, NULL)

Indicates whether this column can be included when exporting list or report data to external formats like Excel, CSV, or PDF. Export operations might have different column availability than on-screen displays - some columns that make sense visually (with icons or color coding) might not export well, while others might be specifically designed for export purposes. This flag enables precise control over what can be exported, helping ensure that exported data is appropriate for its intended use and doesn't include problematic columns.

### ListColumnGroupId (bigint, NOT NULL)

A foreign key referencing a column grouping or category table that organizes columns into logical sets such as "Basic Information", "Geographic Data", "Date Fields", "Statistical Metrics", or "Audit Information". This grouping helps organize the potentially large number of available columns into manageable categories, making it easier for users to find the columns they need. In column selection interfaces, columns might be presented in collapsible groups organized by this categorization, significantly improving usability when hundreds of columns are available.

### ColumnCategory (varchar, NULL)

A text-based categorization that provides additional classification beyond the group reference, potentially using values like "Core", "Extended", "Administrative", "Statistical", "Geographic", or domain-specific categories. This provides an alternative or supplementary categorization scheme that might be used for filtering, organizing, or applying business rules. For instance, administrative users might see columns in the "Administrative" category while regular users do not, or reports might automatically include all "Core" category columns.

### DBSortColumnName (varchar, NOT NULL)

Specifies the exact database column name or expression to use in ORDER BY clauses when sorting by this column at the database level. While SortColumnName might be a user-friendly or logical name, DBSortColumnName is the literal SQL expression that appears in generated queries. For simple columns these might be identical, but for complex scenarios involving joins, calculations, or special collations, DBSortColumnName ensures the query generator has explicit, unambiguous instructions for creating syntactically correct ORDER BY clauses.

### DBFilterColumnName (varchar, NOT NULL)

Defines the exact database column name or expression to use in WHERE clauses when filtering by this column. Similar to DBSortColumnName, this provides the literal SQL expression for filter conditions. For lookup columns, this might be a foreign key column (filtering by ID) while the display shows a name. For calculated columns, this might be a complex expression. Having an explicit DBFilterColumnName ensures that generated WHERE clauses are syntactically correct and semantically meaningful regardless of column complexity.

### IsInvalidColumn (bit, NULL)

A flag marking columns that are no longer valid, have been deprecated, or should not be used in new lists or reports. Rather than deleting column definitions (which would break existing list configurations), this flag allows soft deprecation - existing lists continue to work, but the column doesn't appear in column selection dialogs for new lists. This supports graceful evolution of the column catalog as the database schema changes, features are deprecated, or better alternatives become available. Marked columns might eventually be removed once all dependent lists have been migrated.

### SortFilterCategory1 (varchar, NOT NULL)

The primary categorization for organizing columns in sort and filter interfaces, potentially using values like "Individual Information", "Activity Details", "Geographic Data", "Dates and Times", or "Statistical Metrics". This categorization specifically targets the sort and filter UI, which might organize columns differently than the display column picker. For example, filter interfaces might group all date fields together regardless of which entity they belong to, or all geographic fields together, enabling users to quickly find appropriate filter criteria.

### SortFilterCategory2 (varchar, NOT NULL)

A secondary categorization that provides finer-grained organization within the primary category. For instance, within "Individual Information" (Category1), Category2 might distinguish "Personal Details", "Contact Information", "Participation History", or "Administrative Fields". This two-level taxonomy enables sophisticated organization without overwhelming users with too many categories, helping them navigate potentially hundreds of filterable columns to find exactly what they need.

### SortFilterCategory3 (varchar, NOT NULL)

A tertiary categorization providing the most specific level of organization in sort and filter interfaces. This third level enables very precise organization when needed - for example, Category1="Geographic", Category2="Administrative Divisions", Category3="Primary" or "Secondary". Most systems might not use all three levels for all columns, but having the capability enables flexible organization for complex domains where a two-level taxonomy proves insufficient.

### StudyItemId (bigint, NOT NULL)

A foreign key reference to the StudyItems table, specifically used for columns that relate to curriculum elements or educational materials. This field enables columns that are dynamically generated based on the curriculum - for instance, creating a column for "Completed Book 1", "Completed Book 2", etc., where each book is a separate StudyItem. This allows the column catalog to adapt to curriculum changes without requiring application code modifications, making the system extensible as new educational materials are added or curriculum sequences are revised.

## Key Relationships

### Usage in List Configuration (One-to-Many)

Each ListColumn can be referenced by multiple list configurations:

1. **ListDisplayColumns** - Lists that display this column, specifying order and presentation
2. **ListFilterColumns** - Filter conditions that use this column for criteria
3. **ListSortColumns** - Sort specifications that order results by this column

These relationships enable the same column definition to be reused across many different lists while maintaining consistent metadata about the column's properties and capabilities.

### Column Grouping (Many-to-One)

The ListColumnGroupId creates a relationship to a column grouping table (not detailed in provided schema), organizing columns into logical categories for presentation. This relationship enables hierarchical organization of the column catalog, making it navigable and manageable as the number of available columns grows.

### Curriculum Connection (Many-to-One)

The StudyItemId relationship connects curriculum-related columns to specific elements in the StudyItems table. This enables dynamic column generation based on the educational sequence, allowing the system to automatically create columns for tracking completion of each book, participation in each type of activity, or progression through curriculum levels.

### Entity Tables (Implicit)

While not enforced by foreign keys, the EntityType and TableName fields create implicit relationships to the actual database tables (Activities, Individuals, Clusters, etc.). These implicit relationships guide the query builder in understanding which tables to join and how columns relate across entities.

## Column Metadata System

The ListColumns table implements a sophisticated metadata system that serves multiple purposes:

### Display and Presentation

- **DisplayName** - User-facing label in all interfaces
- **Order** - Sequence in column selection dialogs
- **ColumnType** - Determines UI control type (text box, date picker, checkbox)
- **ListColumnGroupId, ColumnCategory** - Organizational grouping

### Query Generation

- **ColumnName** - Database column for SELECT clause
- **SortColumnName, DBSortColumnName** - How to sort by this column
- **FilterColumnName, DBFilterColumnName** - How to filter on this column
- **Expression** - For calculated columns, the computation formula
- **TableName** - Source table for joins

### Context-Specific Availability

- **List Context** - IsAvailableListColumn, IsSelectableListColumn, IsOrderableListColumn, IsFilterableListColumn
- **Report Context** - IsAvailableReportColumn, IsSelectableReportColumn, IsOrderableReportColumn, IsFilterableReportColumn
- **Export Context** - IsAvailableExportColumn

### Special Behaviors

- **IsCalculated** - Computed vs. direct column
- **IsRequiredListColumn, IsRequiredReportColumn** - Mandatory inclusion
- **IsInvalidColumn** - Deprecated or obsolete
- **StudyItemId** - Curriculum-linked dynamic columns

## Column Types and Their Characteristics

### String Columns

- **ColumnType**: "string" or "text"
- **Filter Operators**: Equals, Contains, Starts With, Ends With, Is Empty
- **Sort Behavior**: Alphabetical (collation-dependent)
- **UI Control**: Text input box
- **Examples**: Name fields, descriptions, addresses

### Numeric Columns

- **ColumnType**: "number", "integer", "decimal"
- **Filter Operators**: Equals, Greater Than, Less Than, Between
- **Sort Behavior**: Numeric ascending/descending
- **UI Control**: Numeric input box
- **Examples**: Participant counts, IDs, ages, durations

### Date and DateTime Columns

- **ColumnType**: "date", "datetime"
- **Filter Operators**: Equals, Before, After, Between, In Last/Next Period
- **Sort Behavior**: Chronological
- **UI Control**: Date picker, date range selector
- **Examples**: StartDate, EndDate, CreatedTimestamp, BirthDate

### Boolean Columns

- **ColumnType**: "boolean", "bit"
- **Filter Operators**: Is True, Is False, Is Null
- **Sort Behavior**: False before True (or configurable)
- **UI Control**: Checkbox, yes/no dropdown
- **Examples**: IsCompleted, IsBahai, IsArchived, HasServiceProjects

### Lookup/Foreign Key Columns

- **ColumnType**: "lookup", "reference"
- **Filter Operators**: Equals, In List (multiple selection)
- **Sort Behavior**: By display value (not ID)
- **UI Control**: Dropdown, autocomplete, multi-select
- **Examples**: LocalityId (showing locality name), ClusterId (showing cluster name)

### Calculated Columns

- **ColumnType**: Various, based on result type
- **Filter Operators**: Depends on result type
- **Sort Behavior**: Based on calculated result
- **UI Control**: Read-only display, filtering based on result type
- **Examples**: Age (from BirthYear), Duration (EndDate - StartDate), FullName (FirstName + FamilyName)

## Common Query Patterns

### Get All Available Columns for Entity Type

```sql
SELECT
    [DisplayName],
    [ColumnType],
    [IsFilterableListColumn],
    [IsOrderableListColumn],
    [Order]
FROM [ListColumns]
WHERE [EntityType] = @EntityType
    AND [IsAvailableListColumn] = 1
    AND ([IsInvalidColumn] = 0 OR [IsInvalidColumn] IS NULL)
ORDER BY [Order], [DisplayName]
```

### Get Required Columns for Lists

```sql
SELECT
    [ColumnName],
    [DisplayName],
    [Expression]
FROM [ListColumns]
WHERE [EntityType] = @EntityType
    AND [IsRequiredListColumn] = 1
ORDER BY [Order]
```

### Get Filterable Columns Grouped by Category

```sql
SELECT
    [SortFilterCategory1],
    [SortFilterCategory2],
    [DisplayName],
    [ColumnType],
    [DBFilterColumnName]
FROM [ListColumns]
WHERE [EntityType] = @EntityType
    AND [IsFilterableListColumn] = 1
    AND ([IsInvalidColumn] = 0 OR [IsInvalidColumn] IS NULL)
ORDER BY [SortFilterCategory1], [SortFilterCategory2], [Order]
```

### Get Calculated Columns with Expressions

```sql
SELECT
    [DisplayName],
    [Expression],
    [ColumnType]
FROM [ListColumns]
WHERE [IsCalculated] = 1
    AND ([IsInvalidColumn] = 0 OR [IsInvalidColumn] IS NULL)
ORDER BY [EntityType], [DisplayName]
```

## Business Rules and Constraints

1. **DisplayName Required**: Every column must have a user-friendly display name
2. **Unique Column Identification**: (EntityType, TableName, ColumnName) should uniquely identify non-calculated columns
3. **Expression Required for Calculated**: If IsCalculated=true, Expression must be populated
4. **Consistent Naming**: SortColumnName, FilterColumnName, DBSortColumnName, DBFilterColumnName must be valid
5. **Valid Column Types**: ColumnType should use standard, recognized values
6. **Logical Flag Consistency**: IsRequired implies IsAvailable; IsSelectable requires IsAvailable
7. **Filter/Sort Columns Valid**: DBFilterColumnName and DBSortColumnName must reference actual columns or valid expressions
8. **Category Consistency**: If using categorization, maintain consistent taxonomy

## Usage Patterns

### Column Catalog Initialization

When setting up the system:
1. Analyze database schema to identify all useful columns
2. Create ListColumn entries for each database column that should be exposed
3. Set appropriate DisplayNames that are user-friendly
4. Specify ColumnTypes to enable proper UI controls
5. Mark filterability and sortability based on column characteristics
6. Assign to logical groups using ListColumnGroupId
7. Create calculated columns for common derived values
8. Set Order values for logical presentation sequence

### Column Metadata Maintenance

As the database evolves:
1. Add new columns when database schema expands
2. Mark obsolete columns as IsInvalidColumn=true rather than deleting
3. Update DisplayNames for clarity as terminology evolves
4. Adjust Order values to prioritize commonly-used columns
5. Add calculated columns for frequently-needed computations
6. Update category assignments as column organization improves

### Query Builder Integration

When building queries dynamically:
1. Query ListColumns for available columns based on EntityType
2. Present columns grouped by ListColumnGroupId or categories
3. Filter to only IsAvailableListColumn (or Report/Export as appropriate)
4. Use ColumnType to present appropriate filter operator options
5. Use DBFilterColumnName and DBSortColumnName in generated SQL
6. For calculated columns, use Expression in SELECT clause
7. Validate that selected columns are compatible with the query context

## Performance Considerations

### Metadata Caching

Column metadata changes infrequently but is referenced constantly:
- Cache column catalog in application memory
- Invalidate cache based on LastUpdatedTimestamp
- Share cache across application instances
- Refresh cache on application restart or configuration change

### Query Generation Efficiency

- Pre-compile SQL fragments for common column types
- Validate column selections before query execution
- Limit number of calculated columns in single query
- Warn users when too many JOINs would be required

### Column Catalog Size

As systems mature, column catalogs can grow large:
- Use IsInvalidColumn to hide obsolete columns
- Organize with meaningful categories and groups
- Implement search/filter in column selection UI
- Consider favorites or recently-used column lists

## Notes for Developers

When working with ListColumns:

- **Validate column metadata** - Ensure ColumnName, TableName reference actual database objects
- **Handle calculated columns specially** - Use Expression instead of ColumnName in SELECT
- **Use DB-specific names for SQL** - DBSortColumnName and DBFilterColumnName for queries
- **Respect availability flags** - Check IsAvailable, IsSelectable, IsFilterable, IsOrderable for context
- **Support proper UI controls** - Use ColumnType to determine input controls and operators
- **Implement graceful deprecation** - Use IsInvalidColumn instead of deleting
- **Maintain categorization** - Keep ListColumnGroupId and categories current
- **Test with actual data** - Verify calculated expressions with production-scale data
- **Document complex expressions** - Add comments for complicated calculated columns
- **Consider performance** - Monitor query performance for columns requiring complex joins

## Integration Considerations

### Visual Query Builder

The ListColumns table drives the UI for building queries:
- Column picker dialogs organized by group/category
- Filter builders showing appropriate operators based on ColumnType
- Sort configuration showing only orderable columns
- Context-sensitive availability (list vs. report vs. export)

### Dynamic SQL Generation

Query builders use ListColumns metadata to generate SQL:
- SELECT clause: Use ColumnName or Expression
- WHERE clause: Use DBFilterColumnName with appropriate operators
- ORDER BY clause: Use DBSortColumnName
- FROM/JOIN clause: Determined by TableName of selected columns

### Multi-Language Support

For international deployments:
- DisplayName might be a localization key rather than literal text
- Maintain translations for all DisplayNames
- Ensure SortColumnName respects locale-specific collations
- Consider culturally appropriate formatting for dates, numbers

## Best Practices

1. **Clear Display Names** - Use intuitive, jargon-free labels that users will understand
2. **Logical Organization** - Group related columns together using categories
3. **Consistent Type Usage** - Use standard ColumnType values across the catalog
4. **Meaningful Order** - Prioritize commonly-used columns with lower Order values
5. **Complete Metadata** - Fill all relevant fields; don't leave critical metadata NULL
6. **Test Calculations** - Thoroughly test Expression formulas with edge cases
7. **Document Complexity** - Maintain external documentation for complex calculated columns
8. **Graceful Evolution** - Use IsInvalidColumn for deprecation, not deletion
9. **Performance Awareness** - Mark expensive calculated columns appropriately
10. **Accessibility** - Ensure DisplayNames work well with screen readers and accessibility tools

## Advanced Features

### Dynamic Column Generation

For curriculum-based columns:
- Use StudyItemId to link columns to specific books or courses
- Generate columns automatically as new StudyItems are added
- Enable tracking of completion status for each curriculum element
- Support reporting on progression through educational sequences

### Context-Specific Behavior

Different contexts may show columns differently:
- Lists emphasize browsing and quick filtering
- Reports emphasize formatting and grouping
- Exports emphasize completeness and data portability
- Each context has its own set of availability flags

### Computed Column Sophistication

Advanced calculated columns can include:
- Subqueries for aggregate calculations
- CASE statements for conditional logic
- String manipulations for formatting
- Date arithmetic for duration calculations
- Complex joins for related entity values

## Security and Privacy Considerations

Column-level security controls what data users can access:

- **Column Visibility** - Use IsAvailable flags to hide sensitive columns from certain contexts
- **Calculated Redaction** - Create calculated columns that redact or mask sensitive data
- **Audit Columns** - Control access to CreatedBy, LastUpdatedBy based on user roles
- **PII Marking** - Consider adding flags to mark columns containing personally identifiable information
- **Export Restrictions** - Use IsAvailableExportColumn to prevent sensitive data from leaving the system
- **Filter Restrictions** - Some columns might be displayable but not filterable to prevent data mining

When defining columns that contain or reveal sensitive information:
- Consider whether column should be available at all
- Use context-specific availability to limit exposure
- Document privacy implications in external documentation
- Test that access controls work as intended
- Review export capabilities for data leakage risks
