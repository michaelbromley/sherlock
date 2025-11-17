# StudyItems Table

## Overview
The `StudyItems` table defines the curriculum elements used in Bahai educational activities. Study items represent books, courses, units, and lessons from the Ruhi Institute curriculum and other educational materials. The table supports a hierarchical structure where study items can have parent-child relationships (e.g., a book containing multiple units, a unit containing multiple lessons). Study items are associated with specific activity types and are sequenced for progressive learning.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier for each study item |
| **Order** | int | NO | Sequence number for ordering items within parent or activity type |
| **IsReleased** | bit | NO | Flag indicating if study item is available for use |
| **ActivityType** | tinyint | YES | Type of activity: 0=Children's Classes, 1=Junior Youth, 2=Study Circles, NULL=Multiple |
| **ParentStudyItemId** | bigint | YES | Foreign key to parent StudyItem (for hierarchical structure) |
| **CreatedTimestamp** | datetime | NO | When the record was created |
| **CreatedBy** | uniqueidentifier | NO | User ID who created the record |
| **LastUpdatedTimestamp** | datetime | NO | When the record was last modified |
| **LastUpdatedBy** | uniqueidentifier | NO | User ID who last modified the record |
| **ImportedTimestamp** | datetime | YES | When data was imported from external system |
| **ImportedFrom** | uniqueidentifier | YES | Source system identifier for imported data |
| **ImportedFileType** | varchar(50) | YES | File format of imported data |

## Key Relationships

1. **Self-Referential** (ParentStudyItemId → StudyItems.Id)
   - Creates hierarchical structure of study materials
   - Parent study items contain child items
   - Enables multi-level curriculum organization

2. **LocalizedStudyItems** (One-to-Many)
   - Provides names and descriptions in multiple languages
   - LocalizedStudyItems.StudyItemId references this table
   - Essential for international use and multi-language support

3. **ActivityStudyItems** (One-to-Many)
   - Links study items to specific activities
   - ActivityStudyItems.StudyItemId references this table
   - Tracks which items are being studied in which activities

4. **ActivityStudyItemIndividuals** (One-to-Many)
   - Links study items to individual participants
   - Tracks individual progress through curriculum
   - Records completion status

## Hierarchical Structure

### Parent-Child Relationships

**Example Structure:**
```
Book 1: Reflections on the Life of the Spirit (ParentStudyItemId = NULL)
  ├── Unit 1: Understanding the Bahai Writings (ParentStudyItemId = Book1.Id)
  │   ├── Section 1 (ParentStudyItemId = Unit1.Id)
  │   └── Section 2 (ParentStudyItemId = Unit1.Id)
  └── Unit 2: Prayer (ParentStudyItemId = Book1.Id)
      ├── Section 1 (ParentStudyItemId = Unit2.Id)
      └── Section 2 (ParentStudyItemId = Unit2.Id)
```

### Hierarchy Levels
- **Level 1** (Parent = NULL): Main books/courses
  - Book 1, Book 2, Book 3, etc.
  - Grade 1, Grade 2, Grade 3 (children's classes)
  - Specific junior youth texts

- **Level 2**: Units or major sections within books
  - Book 3 Grade 1, Book 3 Grade 2
  - Book 9 Unit 1, Book 9 Unit 2
  - Major topical divisions

- **Level 3+**: Lessons, sections, or detailed components
  - Individual lessons within units
  - Specific topics or sessions
  - Fine-grained curriculum elements

## Activity Type Association

### ActivityType Values
- **0 = Children's Classes**
  - Curriculum for ages 5-11
  - Grade-based progression (Grade 1, Grade 2, Grade 3)
  - Character and spiritual education

- **1 = Junior Youth Groups**
  - Materials for ages 12-15
  - Empowerment texts and workbooks
  - Moral and intellectual development
  - Examples: "Breezes of Confirmation", "Spirit of Faith"

- **2 = Study Circles**
  - Adult education materials
  - Ruhi Institute main sequence (Books 1-10+)
  - Systematic progression through curriculum
  - Most common type in database

- **NULL = Multiple/General**
  - Study items usable across activity types
  - General educational resources
  - Supporting materials

## Ordering and Sequencing

### Order Field
- **Purpose**: Defines sequence of study items
- **Within Parent**: Child items ordered within parent
- **Within Activity Type**: Top-level items ordered for progression
- **Sequential Learning**: Lower order numbers studied first

### Common Sequences
**Study Circles** (Adult):
1. Book 1: Reflections on the Life of the Spirit
2. Book 2: Arising to Serve
3. Book 3: Teaching Children's Classes (Grades 1-3)
4. Book 4: The Twin Manifestations
5. Book 5: Releasing the Powers of Junior Youth
6. Book 6: Teaching the Cause
7. Book 7: Walking Together on a Path of Service
8. Book 8: The Covenant of Baha'u'llah
9. Book 9: Gaining an Historical Perspective
10. Book 10: Building Vibrant Communities

**Children's Classes**:
1. Grade 1 (Ages 5-6)
2. Grade 2 (Ages 7-8)
3. Grade 3 (Ages 9-11)

## Release Status

### IsReleased Flag
- **TRUE**: Study item is available for use
  - Published and distributed
  - Approved for implementation
  - Can be assigned to activities
  - Visible in curriculum selection

- **FALSE**: Study item not yet available
  - Under development
  - Pending approval
  - Not yet translated
  - Pilot/testing phase

## Common Query Patterns

### Get Top-Level Study Items for Activity Type
```sql
SELECT
    SI.[Id],
    SI.[Order],
    LSI.[Name]
FROM [StudyItems] SI
INNER JOIN [LocalizedStudyItems] LSI
    ON SI.[Id] = LSI.[StudyItemId]
WHERE SI.[ActivityType] = 2  -- Study Circles
    AND SI.[ParentStudyItemId] IS NULL
    AND SI.[IsReleased] = 1
    AND LSI.[Language] = 'en-US'
ORDER BY SI.[Order]
```

### Get Study Item Hierarchy
```sql
WITH StudyItemHierarchy AS (
    -- Root level items
    SELECT
        SI.[Id],
        SI.[ParentStudyItemId],
        SI.[Order],
        LSI.[Name],
        0 AS Level
    FROM [StudyItems] SI
    INNER JOIN [LocalizedStudyItems] LSI
        ON SI.[Id] = LSI.[StudyItemId]
    WHERE SI.[ParentStudyItemId] IS NULL
        AND LSI.[Language] = 'en-US'

    UNION ALL

    -- Child items
    SELECT
        SI.[Id],
        SI.[ParentStudyItemId],
        SI.[Order],
        LSI.[Name],
        SIH.Level + 1
    FROM [StudyItems] SI
    INNER JOIN [LocalizedStudyItems] LSI
        ON SI.[Id] = LSI.[StudyItemId]
    INNER JOIN StudyItemHierarchy SIH
        ON SI.[ParentStudyItemId] = SIH.[Id]
    WHERE LSI.[Language] = 'en-US'
)
SELECT * FROM StudyItemHierarchy
ORDER BY Level, [Order]
```

### Study Items Completed by Individual
```sql
SELECT
    LSI.[Name] AS StudyItem,
    ASII.[IsCompleted],
    ASII.[EndDate]
FROM [ActivityStudyItemIndividuals] ASII
INNER JOIN [StudyItems] SI ON ASII.[StudyItemId] = SI.[Id]
INNER JOIN [LocalizedStudyItems] LSI
    ON SI.[Id] = LSI.[StudyItemId]
WHERE ASII.[IndividualId] = @IndividualId
    AND LSI.[Language] = 'en-US'
ORDER BY SI.[Order]
```

### Most Studied Items in Cluster
```sql
SELECT
    LSI.[Name] AS StudyItem,
    COUNT(DISTINCT ASII.[IndividualId]) AS ParticipantCount,
    COUNT(DISTINCT ASI.[ActivityId]) AS ActivityCount
FROM [StudyItems] SI
INNER JOIN [LocalizedStudyItems] LSI
    ON SI.[Id] = LSI.[StudyItemId]
INNER JOIN [ActivityStudyItems] ASI ON SI.[Id] = ASI.[StudyItemId]
INNER JOIN [ActivityStudyItemIndividuals] ASII ON SI.[Id] = ASII.[StudyItemId]
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
WHERE L.[ClusterId] = @ClusterId
    AND LSI.[Language] = 'en-US'
GROUP BY SI.[Id], LSI.[Name], SI.[Order]
ORDER BY ParticipantCount DESC
```

## Business Rules and Constraints

1. **Order Required**: Every study item must have an order number
2. **IsReleased Default**: Typically TRUE for active curriculum items
3. **Activity Type Association**: Should match intended use
4. **Parent Validity**: ParentStudyItemId must reference valid study item when not NULL
5. **Circular References**: Prevent circular parent-child relationships
6. **Localization Required**: Every study item should have at least one LocalizedStudyItem entry

## Multi-Language Support

Study items themselves are language-neutral; all text content is in LocalizedStudyItems:
- **StudyItems**: Structure, relationships, sequencing
- **LocalizedStudyItems**: Names, descriptions, translated content

This separation enables:
- Single curriculum structure
- Multiple language support
- Consistent ordering across languages
- Easy addition of new languages

## Usage in Reporting

Study items are central to many reports:
- **Completion Statistics**: How many completed each book
- **Progression Analysis**: Movement through sequence
- **Popular Materials**: Most-studied items
- **Activity Curriculum**: What's being studied where
- **Individual Progress**: Personal learning journey

## Performance Considerations

### Indexing
- ParentStudyItemId for hierarchical queries
- ActivityType for filtering by activity
- Order for sequencing
- IsReleased for filtering available items

### Caching
- Study item hierarchies change infrequently
- Cache curriculum structure
- Refresh when new items added
- Localized names can be cached per language

## Notes for Developers

- Always join with LocalizedStudyItems for display names
- Respect language preference when selecting localized items
- Use recursive CTEs for hierarchical queries
- Order by Order field for proper sequence
- Filter IsReleased = 1 for active curriculum
- Handle NULL ParentStudyItemId (top-level items)
- Consider activity type when filtering items

## Special Considerations

### Curriculum Evolution
- New study items added periodically
- Curriculum expands and evolves
- Books revised and updated
- New translations released
- Order may be adjusted

### Book 3 and Book 9 Special Cases
- **Book 3**: Has three grades (Book 3 Grade 1, 2, 3)
- **Book 9**: Has two units (Book 9 Unit 1, 2)
- Implemented as parent-child relationships
- All share same top-level book but different components

### Multi-Activity Items
Some study items may be used in multiple activity types:
- ActivityType NULL indicates flexibility
- May have localized items for different contexts
- Check specific usage patterns

## Integration Considerations

### External Institute Systems
- InstituteId in import fields
- Synchronization with regional institute databases
- Course completion tracking
- Tutor assignment systems

### Import and Migration
- ImportedFrom tracks source systems
- ImportedFileType indicates data format
- ImportedTimestamp records when imported
- Supports multiple institute database sources

## Best Practices

1. **Hierarchy**: Use parent-child relationships for structured curriculum
2. **Ordering**: Maintain correct sequence numbers
3. **Release Status**: Only release when fully approved and available
4. **Activity Type**: Assign appropriate activity type
5. **Localization**: Ensure all languages have localized items
6. **Consistency**: Maintain consistent structure across languages
7. **Documentation**: Use Comments in LocalizedStudyItems for details
8. **Testing**: Verify hierarchy integrity when adding items
