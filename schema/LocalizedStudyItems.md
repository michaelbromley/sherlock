# LocalizedStudyItems Table

## Overview
The `LocalizedStudyItems` table provides multi-language support for study items in the SRP database. While the StudyItems table defines the structure and relationships of curriculum elements, this table stores the actual names, titles, and descriptions in multiple languages. Each study item can have translations in 11+ languages, enabling the system to serve international Bahai communities with diverse language needs.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each localized entry

### Language

Language code (e.g., 'en-US', 'fr-FR', 'es-ES')

### Name

Full name of the study item in this language

### ShortName

Abbreviated name for space-constrained displays

### CondensedName

Very short name for compact views

### Title

Formal title of the study item

### StudyItemId

Foreign key to StudyItems table

### CreatedTimestamp

When the record was created

### CreatedBy

User ID who created the record

### LastUpdatedTimestamp

When the record was last modified

### LastUpdatedBy

User ID who last modified the record

### ImportedTimestamp

When data was imported from external system

### ImportedFrom

Source system identifier for imported data

### ImportedFileType

File format of imported data

## Key Relationships

1. **StudyItems** (StudyItemId → StudyItems.Id)
   - Each localized item belongs to exactly one study item
   - One study item can have multiple localizations (one per language)
   - One-to-many relationship from StudyItems to LocalizedStudyItems

## Supported Languages

The system supports 11+ languages with standard locale codes:

| Language | Code | Example |
|----------|------|---------|
| **English (US)** | en-US | "Reflections on the Life of the Spirit" |
| **French** | fr-FR | "Réflexions sur la vie de l'esprit" |
| **Spanish** | es-ES | "Reflexiones sobre la vida del espíritu" |
| **Portuguese** | pt-PT/pt-BR | "Reflexões sobre a Vida do Espírito" |
| **Russian** | ru-RU | "Размышления о духовной жизни" |
| **Chinese** | zh-CN | "关于精神生活的思考" |
| **Arabic** | ar-SA | "تأملات في الحياة الروحية" |
| **Turkish** | tr-TR | "Ruhsal Yaşam Üzerine Düşünceler" |
| **Finnish** | fi-FI | "Pohdintoja hengellisestä elämästä" |
| **Italian** | it-IT | "Riflessioni sulla vita dello spirito" |
| **Burmese** | my-MM | Myanmar script text |

Additional languages can be added as translations become available.

## Name Field Variations

### Name (Full Name)
- **Purpose**: Complete, official name of the study item
- **Usage**: Primary display in forms, reports, dropdowns
- **Example**: "Book 1: Reflections on the Life of the Spirit"
- **Length**: Up to 255 characters
- **Required**: YES

### ShortName
- **Purpose**: Abbreviated version for medium-sized displays
- **Usage**: Tables, summaries, intermediate views
- **Example**: "Book 1: Reflections"
- **Length**: Up to 255 characters
- **Required**: NO (optional)

### CondensedName
- **Purpose**: Very short version for compact displays
- **Usage**: Mobile views, charts, tight layouts
- **Example**: "Book 1"
- **Length**: Up to 255 characters
- **Required**: NO (optional)

### Title
- **Purpose**: Formal title without book number/prefix
- **Usage**: Formal documents, certificates, academic contexts
- **Example**: "Reflections on the Life of the Spirit"
- **Length**: Up to 255 characters
- **Required**: NO (optional)

## Example Data

### Book 1 in Multiple Languages

| Language | Name | ShortName | CondensedName | Title |
|----------|------|-----------|---------------|-------|
| en-US | Book 1: Reflections on the Life of the Spirit | Book 1: Reflections | Book 1 | Reflections on the Life of the Spirit |
| es-ES | Libro 1: Reflexiones sobre la vida del espíritu | Libro 1: Reflexiones | Libro 1 | Reflexiones sobre la vida del espíritu |
| fr-FR | Livre 1: Réflexions sur la vie de l'esprit | Livre 1: Réflexions | Livre 1 | Réflexions sur la vie de l'esprit |

### Children's Class Grades

| Language | Name | ShortName | CondensedName |
|----------|------|-----------|---------------|
| en-US | Grade 1 | Grade 1 | G1 |
| es-ES | Grado 1 | Grado 1 | G1 |
| fr-FR | Année 1 | Année 1 | A1 |
| pt-PT | Grau 1 | Grau 1 | G1 |

## Common Query Patterns

### Get Study Item Names in Specific Language
```sql
SELECT
    SI.[Id],
    SI.[Order],
    LSI.[Name],
    LSI.[ShortName],
    LSI.[Title]
FROM [StudyItems] SI
INNER JOIN [LocalizedStudyItems] LSI
    ON SI.[Id] = LSI.[StudyItemId]
WHERE LSI.[Language] = 'en-US'
    AND SI.[ActivityType] = 2  -- Study Circles
    AND SI.[IsReleased] = 1
ORDER BY SI.[Order]
```

### Get Study Item in Multiple Languages
```sql
SELECT
    LSI.[Language],
    LSI.[Name],
    LSI.[ShortName],
    LSI.[Title]
FROM [LocalizedStudyItems] LSI
WHERE LSI.[StudyItemId] = @StudyItemId
ORDER BY LSI.[Language]
```

### Study Items with Fallback Language
```sql
SELECT
    SI.[Id],
    COALESCE(LSI_Preferred.[Name], LSI_Default.[Name]) AS [Name],
    COALESCE(LSI_Preferred.[ShortName], LSI_Default.[ShortName]) AS [ShortName]
FROM [StudyItems] SI
LEFT JOIN [LocalizedStudyItems] LSI_Preferred
    ON SI.[Id] = LSI_Preferred.[StudyItemId]
    AND LSI_Preferred.[Language] = @PreferredLanguage
INNER JOIN [LocalizedStudyItems] LSI_Default
    ON SI.[Id] = LSI_Default.[StudyItemId]
    AND LSI_Default.[Language] = 'en-US'  -- Fallback to English
WHERE SI.[IsReleased] = 1
ORDER BY SI.[Order]
```

### Find Study Item by Name (Any Language)
```sql
SELECT DISTINCT
    SI.[Id],
    SI.[Order],
    LSI_EN.[Name] AS EnglishName
FROM [LocalizedStudyItems] LSI
INNER JOIN [StudyItems] SI ON LSI.[StudyItemId] = SI.[Id]
INNER JOIN [LocalizedStudyItems] LSI_EN
    ON SI.[Id] = LSI_EN.[StudyItemId]
    AND LSI_EN.[Language] = 'en-US'
WHERE LSI.[Name] LIKE '%' + @SearchTerm + '%'
```

### Available Languages for Study Item
```sql
SELECT DISTINCT
    [Language]
FROM [LocalizedStudyItems]
WHERE [StudyItemId] = @StudyItemId
ORDER BY [Language]
```

### Translation Completeness Report

```sql
-- Identify which study items lack translations in key languages
SELECT
    si.[Id],
    si.[Name] AS EnglishName,
    si.[Sequence],
    si.[ActivityStudyItemType],
    MAX(CASE WHEN lsi.[LanguageCode] = 'es-ES' THEN 1 ELSE 0 END) AS HasSpanish,
    MAX(CASE WHEN lsi.[LanguageCode] = 'fr-FR' THEN 1 ELSE 0 END) AS HasFrench,
    MAX(CASE WHEN lsi.[LanguageCode] = 'pt-BR' THEN 1 ELSE 0 END) AS HasPortuguese,
    MAX(CASE WHEN lsi.[LanguageCode] = 'fa-IR' THEN 1 ELSE 0 END) AS HasPersian,
    MAX(CASE WHEN lsi.[LanguageCode] = 'ar-SA' THEN 1 ELSE 0 END) AS HasArabic,
    COUNT(DISTINCT lsi.[LanguageCode]) AS TotalLanguages
FROM [StudyItems] si
LEFT JOIN [LocalizedStudyItems] lsi ON si.[Id] = lsi.[StudyItemId]
WHERE si.[ParentStudyItemId] IS NULL  -- Root level items only
GROUP BY si.[Id], si.[Name], si.[Sequence], si.[ActivityStudyItemType]
ORDER BY si.[Sequence];
```

**Use Case:** Planning translation efforts and identifying gaps for priority languages
**Performance Notes:** Pivot-style query using MAX/CASE; consider materializing for large datasets

### Get Activity Materials in User's Language

```sql
-- Retrieve curriculum being studied in activities with localized names
SELECT
    a.[Id] AS ActivityId,
    l.[Name] AS Locality,
    c.[Name] AS Cluster,
    COALESCE(lsi.[Name], si.[Name]) AS StudyItemName,
    COALESCE(lsi.[ShortName], si.[Name]) AS ShortName,
    si.[Sequence],
    asi.[DisplayStartDate],
    asi.[IsCompleted]
FROM [Activities] a
INNER JOIN [Localities] l ON a.[LocalityId] = l.[Id]
INNER JOIN [Clusters] c ON l.[ClusterId] = c.[Id]
INNER JOIN [ActivityStudyItems] asi ON a.[Id] = asi.[ActivityId]
INNER JOIN [StudyItems] si ON asi.[StudyItemId] = si.[Id]
LEFT JOIN [LocalizedStudyItems] lsi
    ON si.[Id] = lsi.[StudyItemId]
    AND lsi.[LanguageCode] = @UserLanguageCode
WHERE a.[IsCompleted] = 0
  AND asi.[EndDate] IS NULL
  AND c.[Id] = @ClusterId
ORDER BY l.[Name], si.[Sequence];
```

**Use Case:** Displaying activities with curriculum names in user's preferred language
**Performance Notes:** COALESCE provides fallback to default language; indexes on language code recommended

### Identify Missing Translations for Active Curriculum

```sql
-- Find currently active study items that lack translations in cluster's language
SELECT DISTINCT
    si.[Id],
    si.[Name] AS EnglishName,
    si.[Sequence],
    si.[ActivityStudyItemType],
    COUNT(DISTINCT asi.[ActivityId]) AS ActiveActivities,
    MAX(CASE WHEN lsi.[LanguageCode] = @ClusterLanguage THEN 1 ELSE 0 END) AS HasTranslation
FROM [StudyItems] si
INNER JOIN [ActivityStudyItems] asi ON si.[Id] = asi.[StudyItemId]
INNER JOIN [Activities] a ON asi.[ActivityId] = a.[Id]
INNER JOIN [Localities] l ON a.[LocalityId] = l.[Id]
INNER JOIN [Clusters] c ON l.[ClusterId] = c.[Id]
LEFT JOIN [LocalizedStudyItems] lsi
    ON si.[Id] = lsi.[StudyItemId]
    AND lsi.[LanguageCode] = @ClusterLanguage
WHERE asi.[EndDate] IS NULL
  AND asi.[IsCompleted] = 0
  AND c.[Id] = @ClusterId
GROUP BY si.[Id], si.[Name], si.[Sequence], si.[ActivityStudyItemType]
HAVING MAX(CASE WHEN lsi.[LanguageCode] = @ClusterLanguage THEN 1 ELSE 0 END) = 0
ORDER BY COUNT(DISTINCT asi.[ActivityId]) DESC;
```

**Use Case:** Prioritizing translation needs based on active usage in cluster
**Performance Notes:** Complex join with aggregation; filter on cluster early for performance

### Language Usage Statistics

```sql
-- Analyze which languages are most commonly used across all activities
SELECT
    lsi.[LanguageCode],
    COUNT(DISTINCT lsi.[StudyItemId]) AS ItemsTranslated,
    COUNT(DISTINCT asi.[ActivityId]) AS ActivitiesUsingLanguage,
    COUNT(DISTINCT a.[LocalityId]) AS LocalitiesReached
FROM [LocalizedStudyItems] lsi
INNER JOIN [ActivityStudyItems] asi ON lsi.[StudyItemId] = asi.[StudyItemId]
INNER JOIN [Activities] a ON asi.[ActivityId] = a.[Id]
WHERE lsi.[LanguageCode] != 'en-US'  -- Exclude English baseline
  AND a.[IsCompleted] = 0
GROUP BY lsi.[LanguageCode]
ORDER BY COUNT(DISTINCT asi.[ActivityId]) DESC;
```

**Use Case:** Understanding language adoption and usage patterns across communities
**Performance Notes:** Multiple distinct counts can be expensive; consider summary tables

## Business Rules and Constraints

1. **Required Language**: Every study item should have at least English (en-US) localization
2. **Unique Combination**: One localization per (StudyItemId, Language) pair
3. **Name Required**: Name field is mandatory for every localization
4. **Consistent Translations**: All languages should translate same study items
5. **Optional Fields**: ShortName, CondensedName, and Title are optional
6. **Language Codes**: Use standard ISO language codes (e.g., 'en-US', 'fr-FR')

## Data Quality Considerations

### Translation Completeness
- Maintain translations for all active languages
- Add new languages systematically
- Update translations when content changes
- Track untranslated items

### Name Consistency
- Standard naming patterns within language
- Consistent numbering (Book 1, Book 2, etc.)
- Proper capitalization and punctuation
- Cultural appropriateness in translations

### Name Length Management
- Full Name: May be long, plan for display truncation
- ShortName: Balance brevity with clarity
- CondensedName: Extremely short, use abbreviations
- Title: Formal, may be longer than Name

## Usage Patterns

### User Interface
- Display names based on user's language preference
- Fallback to English if preferred language unavailable
- Use ShortName in tables and lists
- Use CondensedName in mobile views
- Use Title in formal documents

### Reporting
- Multi-language reports using appropriate localization
- Consistent terminology within language
- Export data with language-specific names
- Translation notes in comments

### Search and Filtering
- Search across all languages
- Allow filtering by language
- Display results in user's preferred language
- Cross-reference between languages

## Performance Considerations

### Indexing
- StudyItemId for joining to StudyItems
- Language for filtering by language
- Composite index on (StudyItemId, Language) for uniqueness
- Name for search queries

### Caching
- Localized names change infrequently
- Cache by language for user sessions
- Invalidate cache when translations update
- Pre-load common languages

### Query Optimization
- Always specify language in queries
- Use COALESCE for fallback logic
- Consider materialized views for common language combinations
- Limit languages loaded per request

## Integration Considerations

### Translation Management
- Coordinate with translation teams
- Version control for translations
- Quality assurance process
- Professional translation for official materials

### External Systems
- Export/import translations
- Synchronize with institute databases
- Support translation memory tools
- Integration with localization platforms

## Notes for Developers

- ALWAYS join with this table when displaying study item names
- Specify language in WHERE clause for consistent results
- Implement fallback to English (en-US) when preferred language unavailable
- Use appropriate name field (Name/ShortName/CondensedName) based on UI context
- Handle NULL values for optional fields (ShortName, CondensedName, Title)
- Support user language preference in application settings
- Provide language selector in multi-language deployments

## Language-Specific Considerations

### Right-to-Left Languages
- Arabic, Persian: Display direction RTL
- Special layout considerations
- Text alignment adjustments
- Mirror UI elements appropriately

### Character Sets
- Unicode support essential (nvarchar)
- Chinese, Arabic, Russian, Burmese characters
- Proper font support
- Collation for sorting

### Cultural Adaptation
- Numbering systems (1, 2, 3 vs. ١, ٢, ٣)
- Date formats
- Name ordering conventions
- Formal vs. informal address

## Audit Trail

### Timestamp Fields
- **CreatedTimestamp**: When translation added
- **CreatedBy**: Who added the translation
- **LastUpdatedTimestamp**: When translation modified
- **LastUpdatedBy**: Who modified the translation

### Use Cases
- Track translation updates
- Audit translation quality
- Monitor translation completeness
- Support version control

## Special Considerations

### Book 3 Grades
Different naming conventions across languages:
- English: "Grade 1", "Grade 2", "Grade 3"
- Spanish: "Grado 1", "Grado 2", "Grado 3"
- French: "Année 1", "Année 2", "Année 3"
- Portuguese: "Grau 1", "Grau 2", "Grau 3"

### Junior Youth Texts
Unique titles across languages:
- May have different cultural resonance
- Adapted for local youth context
- Maintain educational objectives
- Professional translation required

### New Translations
When adding new language:
1. Add all study items for that language
2. Maintain consistent ordering with English
3. Use professional translators
4. Review for cultural appropriateness
5. Test display in UI
6. Validate character encoding

## Best Practices

1. **Complete Coverage**: Translate all study items for each language
2. **Quality Translations**: Use professional translators for accuracy
3. **Consistency**: Maintain consistent terminology within language
4. **Testing**: Verify display in all target languages
5. **Fallback**: Always provide English as fallback language
6. **Updates**: Keep translations synchronized with curriculum changes
7. **Documentation**: Document special translation choices
8. **User Preference**: Respect user language preference settings
9. **Context**: Provide appropriate name length for UI context
10. **Unicode**: Ensure proper Unicode support throughout system
