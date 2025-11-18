# ListDisplayColumns Table

## Overview

The `ListDisplayColumns` table implements the presentation layer of the SRP database's dynamic list framework, specifying exactly which columns appear in each list and in what sequence they are displayed. This configuration table creates the many-to-many relationship between Lists and ListColumns that determines the visible structure of every custom data view in the system. While Lists defines what to query and ListColumns catalogs what fields are available, ListDisplayColumns makes the critical decision about which specific columns a user sees and how they are arranged, transforming abstract data definitions into concrete, usable interfaces.

This table embodies a fundamental principle of user-centered design: giving users control over their view of the data while maintaining simplicity and usability. By storing column selections and ordering separately from the list definition itself, the system enables users to modify their views without affecting underlying query logic or filter criteria. A coordinator viewing activities might display locality, activity type, start date, and participant count, while an administrator viewing the same underlying list might display additional audit fields and identifiers. This flexibility, managed through ListDisplayColumns, enables one logical list to serve multiple audiences with different information needs.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id (bigint, NULL)

The primary key and unique identifier for each display column configuration record, providing a stable reference point for this specific column-in-list relationship. While the combination of ListId and ListColumnId conceptually identifies which column appears in which list, the Id field provides a single-value identifier useful for reference in application code, modification operations, and audit trails. Although marked as nullable in the schema, in practice this field serves as the primary key and should always contain a unique value for operational records.

### Order (smallint, NULL)

Controls the left-to-right sequence in which this column appears in the list display, with lower values appearing leftward and higher values rightward. This field is crucial for creating intuitive, user-friendly list layouts where the most important information appears first (leftmost), followed by supporting details, with administrative or auxiliary information appearing last. For example, an Individual list might show Order 1 for name, Order 2 for locality, Order 3 for status indicators, and higher order numbers for timestamps and identifiers. The smallint type provides a range of -32,768 to 32,767, giving ample space for column sequencing. Administrators typically use gaps (10, 20, 30) rather than consecutive numbers (1, 2, 3) to allow for future column insertions without requiring renumbering of all subsequent columns.

### ListId (bigint, NULL)

A foreign key referencing the Lists table, identifying which list definition this display column belongs to. This relationship connects the column configuration to the overall list specification, enabling the system to retrieve all display columns for a given list when generating the query and formatting results. Each list can have multiple ListDisplayColumns records, collectively defining the complete set of visible fields and their arrangement. When users view or run a list, the system queries this table filtering by ListId to determine exactly which columns to include in the SELECT clause and how to arrange them in the result grid.

### ListColumnId (bigint, NULL)

A foreign key referencing the ListColumns table, identifying which specific column from the available column catalog should be displayed in this list. This relationship connects to the column's metadata - its display name, data type, database source, and all the properties that determine how it should be rendered and what operations are valid on it. The same ListColumn can be referenced by many different lists' display configurations, enabling consistent column definitions across the system while allowing each list to select its own subset of columns. When generating queries, the system uses this reference to look up the column's technical details (table name, column name, expression if calculated) needed to construct the SELECT clause.

### CreatedTimestamp (datetime, NULL)

Records the precise moment when this display column was added to the list configuration, providing an audit trail for how list definitions evolve over time. This timestamp captures when users or administrators modified the list to include this column, which is valuable for understanding how list configurations change in response to user needs, system updates, or organizational requirements. For lists created through bulk operations or system initialization, this timestamp might reflect the setup time rather than individual decision points, but it still provides valuable information about configuration history.

### CreatedBy (uniqueidentifier, NULL)

Stores the GUID of the user account that added this column to the list's display configuration, establishing accountability for configuration decisions. This field enables tracking who is customizing lists, understanding which users are power users who actively configure their views, and attributing configuration changes to specific individuals. For system-generated or predefined list columns, this might be NULL or reference a system account, distinguishing between user customizations and official system configurations.

### LastUpdatedTimestamp (datetime, NULL)

Captures the most recent moment when this display column configuration was modified - typically changes to the Order field when users rearrange columns, though it could reflect other updates. This timestamp is important for cache invalidation in multi-tier applications, as it indicates when the list's presentation structure changed. It helps administrators understand which lists are actively maintained and when the most recent modifications occurred, providing insights into list usage patterns and configuration stability.

### LastUpdatedBy (uniqueidentifier, NULL)

Records the GUID of the user who most recently modified this display column configuration, completing the audit trail for column arrangement changes. When multiple users or administrators have permission to modify list configurations, this field provides clear accountability for who made specific changes. Combined with LastUpdatedTimestamp, it creates a complete picture of when and by whom list presentations were adjusted, which is valuable for troubleshooting unexpected changes or understanding the evolution of list configurations.

## Key Relationships

### Parent List (Many-to-One)

The ListId foreign key creates a many-to-one relationship to the Lists table:
- Each ListDisplayColumns record belongs to exactly one list
- Each list can have multiple display column records
- Together, all ListDisplayColumns records for a given ListId define the complete column layout for that list
- Deleting a list typically cascades to delete all its display column configurations

This relationship enables the system to retrieve all configured display columns for any list by querying WHERE ListId = @ListId.

### Column Metadata (Many-to-One)

The ListColumnId foreign key creates a many-to-one relationship to the ListColumns table:
- Each display column record references exactly one column from the catalog
- Each column in the catalog can be used by multiple lists
- The referenced ListColumn provides all metadata (display name, data type, source table, expression, etc.)
- Changes to column metadata in ListColumns automatically apply to all lists using that column

This relationship enables centralized column management while allowing distributed, per-list column selection.

### List-Column Association (Many-to-Many)

Together, the ListId and ListColumnId fields create a many-to-many relationship between Lists and ListColumns:
- A list can display many columns
- A column can appear in many lists
- The Order field adds sequencing information to this relationship
- The same column might appear at different positions in different lists

This architecture separates "what columns exist" from "which columns this list shows" from "in what order."

## Column Selection and Presentation

### Selection Process

When users build or modify lists, they interact with the column selection interface:

1. **Available Columns** - System presents all ListColumns where IsAvailableListColumn=true for the list's EntityType
2. **Required Columns** - Columns with IsRequiredListColumn=true are automatically included and cannot be removed
3. **Optional Columns** - Users select from remaining IsSelectableListColumn=true columns
4. **Configuration Storage** - Each selection creates a ListDisplayColumns record
5. **Order Assignment** - System assigns or user specifies Order values for sequencing

### Display Rendering

When lists are executed and results displayed:

1. **Retrieve Display Columns** - Query ListDisplayColumns WHERE ListId = @ListId ORDER BY Order
2. **Fetch Metadata** - Join to ListColumns to get DisplayName, ColumnType, Expression
3. **Build SELECT Clause** - Use column metadata to construct SQL SELECT
4. **Format Headers** - Use DisplayName for column headers
5. **Render Cells** - Use ColumnType to determine formatting (dates, numbers, booleans)
6. **Apply Ordering** - Present columns left-to-right according to Order field

### Column Layout Patterns

Common column ordering strategies:

**Identifier-First Layout:**
```
Order 1: ID or primary identifier
Order 2: Name or description
Order 3-n: Details and attributes
Order n+1: Timestamps and audit fields
```

**Information-Priority Layout:**
```
Order 1: Most critical information (e.g., Name)
Order 2: Primary context (e.g., Locality, Region)
Order 3-4: Key metrics or status
Order 5+: Supporting details
Order Last: Administrative metadata
```

**Workflow-Optimized Layout:**
```
Order 1: Decision field (e.g., completion status)
Order 2: Action target (e.g., activity name)
Order 3: Context (e.g., location, date)
Order 4+: Additional information needed for action
```

## Common Query Patterns

### Get Display Columns for List

```sql
SELECT
    LC.[DisplayName],
    LC.[ColumnName],
    LC.[ColumnType],
    LC.[Expression],
    LDC.[Order]
FROM [ListDisplayColumns] LDC
INNER JOIN [ListColumns] LC ON LDC.[ListColumnId] = LC.[Id]
WHERE LDC.[ListId] = @ListId
ORDER BY LDC.[Order]
```

### Complete List Configuration with Display Columns

```sql
SELECT
    L.[Name] AS ListName,
    L.[EntityType],
    LC.[DisplayName] AS ColumnName,
    LC.[ColumnType],
    LDC.[Order] AS DisplayOrder,
    LC.[IsCalculated],
    LC.[Expression]
FROM [Lists] L
INNER JOIN [ListDisplayColumns] LDC ON L.[Id] = LDC.[ListId]
INNER JOIN [ListColumns] LC ON LDC.[ListColumnId] = LC.[Id]
WHERE L.[Id] = @ListId
ORDER BY LDC.[Order]
```

### Find Lists Displaying Specific Column

```sql
SELECT
    L.[Name] AS ListName,
    L.[EntityType],
    LDC.[Order],
    LDC.[CreatedTimestamp],
    LDC.[CreatedBy]
FROM [ListDisplayColumns] LDC
INNER JOIN [Lists] L ON LDC.[ListId] = L.[Id]
INNER JOIN [ListColumns] LC ON LDC.[ListColumnId] = LC.[Id]
WHERE LC.[ColumnName] = @ColumnName
    OR LC.[DisplayName] = @DisplayName
ORDER BY L.[Name], LDC.[Order]
```

### Detect Duplicate Columns in List

```sql
SELECT
    ListColumnId,
    COUNT(*) AS Occurrences
FROM [ListDisplayColumns]
WHERE ListId = @ListId
GROUP BY ListColumnId
HAVING COUNT(*) > 1
```

## Business Rules and Constraints

1. **ListId Required**: Every display column must belong to a specific list
2. **ListColumnId Required**: Every display column must reference a valid column from the catalog
3. **Unique Column Per List**: A column should appear only once in a given list (ListId, ListColumnId should be unique together)
4. **Unique Order Per List**: Within a list, Order values should be unique to avoid ambiguous sequencing
5. **Positive Order Values**: While negative Order values are technically possible, positive values (1, 10, 20...) are conventional
6. **Required Columns Present**: Lists should include all columns marked as IsRequiredListColumn for their EntityType
7. **Valid Column for EntityType**: Selected columns should be appropriate for the list's EntityType
8. **At Least One Column**: Lists should have at least one display column to be useful

## Usage Patterns

### Initial List Creation

When creating a new list:
1. User specifies list name and EntityType
2. System retrieves all IsRequiredListColumn=true columns for that EntityType
3. System automatically creates ListDisplayColumns records for required columns with sequential Order values
4. User selects additional optional columns from IsSelectableListColumn=true set
5. System creates ListDisplayColumns records for selected columns
6. User arranges column order using drag-and-drop or explicit order specification
7. System updates Order values to reflect user's arrangement
8. Configuration saved and list becomes available for use

### Column Reordering

When users rearrange columns in existing lists:
1. User drags column to new position in UI or uses reorder controls
2. System determines new Order value based on position
3. System updates Order values for affected columns:
   - If inserting at position 15, increment orders ≥15
   - Or assign decimal values (Order 15.5) to avoid renumbering
   - Or reassign all orders sequentially (10, 20, 30...)
4. System updates LastUpdatedTimestamp and LastUpdatedBy
5. Changes immediately reflected in list display

### Adding Columns to Existing List

When users add columns to lists they're customizing:
1. User opens column selection interface for the list
2. System shows currently selected columns (checked/highlighted)
3. User selects additional column(s) from available options
4. System creates new ListDisplayColumns record(s)
5. System assigns Order value (typically max existing order + 10)
6. User optionally repositions new column(s) in sequence
7. Changes saved and list display updated

### Removing Columns from Lists

When users remove columns:
1. User deselects column or clicks remove in column configuration
2. System checks if column is required (IsRequiredListColumn=true)
3. If required, system prevents removal with error message
4. If optional, system deletes ListDisplayColumns record
5. Optionally, system renumbers remaining columns to close gaps
6. Changes saved and list display updated

### Cloning Lists with Modified Columns

When users clone lists to create customized versions:
1. User initiates "Save As" or "Clone List" operation
2. System creates new Lists record with copied metadata
3. System copies all ListDisplayColumns records, updating ListId to new list
4. User modifies column selection or order in cloned list
5. Original and cloned lists remain independent
6. Users can maintain personal variations of standard lists

## Column Order Management Strategies

### Sequential Numbering (1, 2, 3...)

**Advantages:**
- Simple and intuitive
- No gaps or confusion
- Obvious sequence

**Disadvantages:**
- Adding column in middle requires renumbering all subsequent columns
- Frequent updates to many records
- Potential for conflicts in multi-user scenarios

### Gap-Based Numbering (10, 20, 30...)

**Advantages:**
- Can insert columns without renumbering (e.g., insert at 15 between 10 and 20)
- Fewer update operations
- More stable configuration

**Disadvantages:**
- Eventually gaps fill up, requiring occasional renumbering
- Less intuitive sequence numbers
- Must handle gap exhaustion

### Decimal Ordering (10.0, 15.5, 20.0...)

**Advantages:**
- Can always insert between any two columns
- Never requires renumbering existing columns
- Theoretically unlimited insertions

**Disadvantages:**
- Can create very complex order values (10.125)
- Harder for humans to interpret
- Might require periodic "cleanup" to simplify

### Timestamp-Based Ordering

**Advantages:**
- Automatic order based on creation time
- No manual order management

**Disadvantages:**
- Order not intuitive to users
- Difficult to reorder
- Not suitable for user-facing lists

**Recommendation:** Use gap-based numbering (10, 20, 30...) with periodic renormalization when gaps become too fragmented.

## Performance Considerations

### Query Efficiency

Display column retrieval is frequent but typically small:
- Most lists have 5-15 display columns
- Simple indexed lookups by ListId
- Consider caching display column configurations
- Join to ListColumns should use indexed foreign key

### UI Rendering

Column ordering affects user experience:
- Limit display columns to reasonable number (< 20 for desktop, < 8 for mobile)
- Warn users when too many columns selected
- Consider horizontal scrolling for many-column lists
- Implement responsive column hiding for narrow screens

### Modification Operations

Reordering can be expensive if renumbering many columns:
- Batch updates when renumbering
- Use transactions to ensure consistency
- Consider optimistic locking for concurrent modifications
- Cache invalidation after modifications

## Notes for Developers

When implementing display column functionality:

- **Enforce uniqueness** - Prevent duplicate columns in same list (unique index on ListId, ListColumnId)
- **Validate order** - Ensure unique Order values within each list
- **Handle required columns** - Automatically include and protect required columns
- **Support drag-and-drop** - Implement intuitive column reordering UI
- **Provide preview** - Show live preview of column arrangement during configuration
- **Implement column picker** - Clear UI showing available vs. selected columns
- **Cache configurations** - Cache display column sets for frequently-used lists
- **Batch operations** - Support selecting/deselecting multiple columns at once
- **Handle column removal** - Check for required status before allowing removal
- **Optimize renumbering** - Use efficient update strategy when resequencing
- **Responsive design** - Adapt column display to screen size
- **Export consideration** - Use display column configuration for export operations

## Integration Considerations

### Visual List Builder

The UI for managing display columns should provide:
- Dual-panel interface (available columns | selected columns)
- Drag-and-drop between panels to add/remove
- Drag-and-drop within selected panel to reorder
- Search/filter for finding columns in large catalogs
- Group/category view of available columns
- Visual indication of required columns (locked, highlighted)
- Column count and recommendations

### Query Generation

Display columns drive SQL SELECT clause construction:
- Retrieve display columns ordered by Order field
- For each column, get metadata from ListColumns
- Build SELECT clause using ColumnName or Expression
- Apply necessary table joins based on column sources
- Preserve order for result set presentation
- Handle calculated columns appropriately

### Export and Printing

Display column configuration affects exports:
- Use same column selection and order for exports
- Consider column width optimization for Excel/CSV
- Format headers using DisplayName
- Apply type-appropriate formatting (dates, numbers, booleans)
- Respect display order in exported files
- Consider pagination for printing many-column lists

## Best Practices

1. **Logical Ordering** - Arrange columns in order of importance and logical flow
2. **Critical Information First** - Put most important columns leftmost
3. **Reasonable Column Count** - Limit to 10-15 columns for optimal usability
4. **Required Columns Prominent** - Place required columns early in sequence
5. **Consistent Patterns** - Use similar column arrangements for similar list types
6. **User Testing** - Test column arrangements with actual users
7. **Mobile Consideration** - Design for responsive display on various screen sizes
8. **Administrative Fields Last** - Place timestamps and IDs at the end
9. **Grouping Related Columns** - Keep related columns together (e.g., all date fields)
10. **Gap-Based Ordering** - Use 10, 20, 30 numbering to allow easy insertions

## Advanced Features

### Dynamic Column Width

System might store column width preferences:
- Track user preferences for column widths
- Auto-size columns based on content
- Remember widths per user per list
- Provide resize handles in UI

### Conditional Column Display

Advanced systems might support conditional display:
- Show certain columns only when filters are applied
- Display different columns for different user roles
- Hide empty columns automatically
- Progressive disclosure (expand to see more columns)

### Column Templates

Power users might benefit from templates:
- Save column selections as reusable templates
- Apply template to new lists
- Organization-wide standard column sets
- Role-based default column selections

### Column Grouping and Spanning

Complex displays might use grouped headers:
- Logical grouping of related columns
- Hierarchical column headers
- Section dividers in column headers
- Collapsible column groups

## Mobile and Responsive Considerations

Different devices require different column strategies:

### Desktop (Full Display)
- Show all configured columns
- Horizontal scrolling if many columns
- Resizable column widths
- Full column headers

### Tablet (Moderate Display)
- Show priority columns (Order 1-8)
- Collapse less important columns to "more" menu
- Fixed column widths
- Abbreviated headers if needed

### Mobile (Minimal Display)
- Show 2-4 most critical columns
- Vertical card layout instead of table
- Tap to see full details
- Prioritize identification and action columns

**Implementation Strategy:**
- Mark columns with priority levels
- Define breakpoints for column hiding
- Use responsive CSS/component frameworks
- Test on actual devices

## Security and Privacy Considerations

Display columns can expose sensitive data:

- **Column-Level Access Control** - Check user permissions before showing columns
- **PII Columns** - Mark and handle personally identifiable information appropriately
- **Role-Based Display** - Different user roles see different column sets
- **Audit Trail Columns** - Restrict display of CreatedBy/UpdatedBy to authorized users
- **Automatic Filtering** - Hide columns containing data user shouldn't access
- **Export Controls** - Apply same or stricter controls to exported columns

When configuring display columns for lists containing sensitive information:
- Review each column for privacy implications
- Apply role-based visibility rules
- Document why certain columns are included/excluded
- Test with various user permission levels
- Consider data redaction for semi-sensitive columns
- Audit who configures display columns for sensitive lists
