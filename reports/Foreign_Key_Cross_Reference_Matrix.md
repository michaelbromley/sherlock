# Foreign Key Cross-Reference Matrix
## SRP Database Table Relationships

**Document Purpose:** Complete mapping of all foreign key relationships between the 28 tables in the SRP database.

**Last Updated:** November 18, 2024

---

## Quick Navigation

- [Geographic Hierarchy Relationships](#geographic-hierarchy-relationships)
- [Activity Management Relationships](#activity-management-relationships)
- [People & Contact Relationships](#people--contact-relationships)
- [Curriculum Relationships](#curriculum-relationships)
- [Reporting Relationships](#reporting-relationships)
- [Dynamic List Relationships](#dynamic-list-relationships)
- [Complete Table Reference Matrix](#complete-table-reference-matrix)

---

## Geographic Hierarchy Relationships

### NationalCommunities
**Referenced by (child tables):**
- Regions.NationalCommunityId → NationalCommunities.Id
- GroupOfRegions.NationalCommunityId → NationalCommunities.Id
- ElectoralUnits.NationalCommunityId → NationalCommunities.Id

**References (parent tables):** None (root of hierarchy)

### GroupOfRegions
**Referenced by:**
- Regions.GroupOfRegionId → GroupOfRegions.Id

**References:**
- GroupOfRegions.NationalCommunityId → NationalCommunities.Id

### Regions
**Referenced by:**
- Clusters.RegionId → Regions.Id
- Subregions.RegionId → Regions.Id
- ElectoralUnits.RegionId → ElectoralUnits.Id

**References:**
- Regions.NationalCommunityId → NationalCommunities.Id
- Regions.GroupOfRegionId → GroupOfRegions.Id (optional)

### Subregions
**Referenced by:**
- Clusters.SubregionId → Subregions.Id

**References:**
- Subregions.RegionId → Regions.Id

### Clusters
**Referenced by:**
- Localities.ClusterId → Clusters.Id
- GroupOfClusters.ClusterId → GroupOfClusters.Id
- ClusterAuxiliaryBoardMembers.ClusterId → Clusters.Id
- Cycles.ClusterId → Clusters.Id

**References:**
- Clusters.RegionId → Regions.Id
- Clusters.SubregionId → Subregions.Id (optional)
- Clusters.GroupOfClusterId → GroupOfClusters.Id (optional)

### Localities
**Referenced by:**
- Individuals.LocalityId → Localities.Id
- Activities.LocalityId → Localities.Id
- Subdivisions.LocalityId → Localities.Id

**References:**
- Localities.ClusterId → Clusters.Id

### Subdivisions
**Referenced by:**
- Individuals.SubdivisionId → Subdivisions.Id
- Activities.SubdivisionId → Subdivisions.Id

**References:**
- Subdivisions.LocalityId → Localities.Id

### ElectoralUnits
**Referenced by:** None

**References:**
- ElectoralUnits.NationalCommunityId → NationalCommunities.Id
- ElectoralUnits.RegionId → Regions.Id (optional)

---

## Activity Management Relationships

### Activities
**Referenced by:**
- ActivityStudyItems.ActivityId → Activities.Id
- ActivityStudyItemIndividuals.ActivityId → Activities.Id

**References:**
- Activities.LocalityId → Localities.Id
- Activities.SubdivisionId → Subdivisions.Id (optional)

### ActivityStudyItems
**Referenced by:**
- ActivityStudyItemIndividuals.ActivityStudyItemId → ActivityStudyItems.Id

**References:**
- ActivityStudyItems.ActivityId → Activities.Id
- ActivityStudyItems.StudyItemId → StudyItems.Id

### ActivityStudyItemIndividuals
**Referenced by:** None (leaf table)

**References:**
- ActivityStudyItemIndividuals.IndividualId → Individuals.Id
- ActivityStudyItemIndividuals.ActivityId → Activities.Id
- ActivityStudyItemIndividuals.StudyItemId → StudyItems.Id
- ActivityStudyItemIndividuals.ActivityStudyItemId → ActivityStudyItems.Id (optional)

---

## People & Contact Relationships

### Individuals
**Referenced by:**
- IndividualEmails.IndividualId → Individuals.Id
- IndividualPhones.IndividualId → Individuals.Id
- ActivityStudyItemIndividuals.IndividualId → Individuals.Id
- ClusterAuxiliaryBoardMembers.IndividualId → Individuals.Id

**References:**
- Individuals.LocalityId → Localities.Id
- Individuals.SubdivisionId → Subdivisions.Id (optional)

### IndividualEmails
**Referenced by:** None (leaf table)

**References:**
- IndividualEmails.IndividualId → Individuals.Id

### IndividualPhones
**Referenced by:** None (leaf table)

**References:**
- IndividualPhones.IndividualId → Individuals.Id

---

## Curriculum Relationships

### StudyItems
**Referenced by:**
- StudyItems.ParentStudyItemId → StudyItems.Id (self-referential)
- LocalizedStudyItems.StudyItemId → StudyItems.Id
- ActivityStudyItems.StudyItemId → StudyItems.Id
- ActivityStudyItemIndividuals.StudyItemId → StudyItems.Id

**References:**
- StudyItems.ParentStudyItemId → StudyItems.Id (self-referential for hierarchy)

### LocalizedStudyItems
**Referenced by:** None (leaf table)

**References:**
- LocalizedStudyItems.StudyItemId → StudyItems.Id

---

## Reporting Relationships

### Cycles
**Referenced by:** None (leaf table)

**References:**
- Cycles.ClusterId → Clusters.Id

### ClusterAuxiliaryBoardMembers
**Referenced by:** None (leaf table)

**References:**
- ClusterAuxiliaryBoardMembers.IndividualId → Individuals.Id
- ClusterAuxiliaryBoardMembers.ClusterId → Clusters.Id

---

## Dynamic List Relationships

### Lists
**Referenced by:**
- ListDisplayColumns.ListId → Lists.Id
- ListFilterColumns.ListId → Lists.Id
- ListSortColumns.ListId → Lists.Id

**References:** None

### ListColumns
**Referenced by:**
- ListDisplayColumns.ListColumnId → ListColumns.Id
- ListFilterColumns.ListColumnId → ListColumns.Id
- ListSortColumns.ListColumnId → ListColumns.Id

**References:** None

### ListDisplayColumns
**Referenced by:** None (leaf table)

**References:**
- ListDisplayColumns.ListId → Lists.Id
- ListDisplayColumns.ListColumnId → ListColumns.Id

### ListFilterColumns
**Referenced by:** None (leaf table, but has self-reference)

**References:**
- ListFilterColumns.ListId → Lists.Id
- ListFilterColumns.ListColumnId → ListColumns.Id
- ListFilterColumns.ParentFilterColumnId → ListFilterColumns.Id (self-referential for nested filters)

### ListSortColumns
**Referenced by:** None (leaf table)

**References:**
- ListSortColumns.ListId → Lists.Id
- ListSortColumns.ListColumnId → ListColumns.Id

---

## System Administration Tables

### ApplicationConfigurations
**Referenced by:** None
**References:** None
*Independent table - stores system-wide settings*

### ApplicationHistories
**Referenced by:** None
**References:** None
*Independent table - tracks application deployments*

### DBScriptHistories
**Referenced by:** None
**References:** None
*Independent table - tracks database schema migrations*

### LoadDataFiles
**Referenced by:** None
**References:** None
*Independent table - tracks data import operations*

### GroupOfClusters
**Referenced by:**
- Clusters.GroupOfClusterId → GroupOfClusters.Id

**References:** None

---

## Complete Table Reference Matrix

| From Table | From Field | To Table | To Field | Relationship Type | Optional |
|------------|------------|----------|----------|-------------------|----------|
| **GEOGRAPHIC HIERARCHY** |
| Regions | NationalCommunityId | NationalCommunities | Id | Many-to-One | No |
| Regions | GroupOfRegionId | GroupOfRegions | Id | Many-to-One | Yes |
| GroupOfRegions | NationalCommunityId | NationalCommunities | Id | Many-to-One | No |
| Subregions | RegionId | Regions | Id | Many-to-One | No |
| Clusters | RegionId | Regions | Id | Many-to-One | No |
| Clusters | SubregionId | Subregions | Id | Many-to-One | Yes |
| Clusters | GroupOfClusterId | GroupOfClusters | Id | Many-to-One | Yes |
| Localities | ClusterId | Clusters | Id | Many-to-One | No |
| Subdivisions | LocalityId | Localities | Id | Many-to-One | No |
| ElectoralUnits | NationalCommunityId | NationalCommunities | Id | Many-to-One | No |
| ElectoralUnits | RegionId | Regions | Id | Many-to-One | Yes |
| **PEOPLE & CONTACTS** |
| Individuals | LocalityId | Localities | Id | Many-to-One | No |
| Individuals | SubdivisionId | Subdivisions | Id | Many-to-One | Yes |
| IndividualEmails | IndividualId | Individuals | Id | Many-to-One | No |
| IndividualPhones | IndividualId | Individuals | Id | Many-to-One | No |
| **ACTIVITIES** |
| Activities | LocalityId | Localities | Id | Many-to-One | No |
| Activities | SubdivisionId | Subdivisions | Id | Many-to-One | Yes |
| ActivityStudyItems | ActivityId | Activities | Id | Many-to-One | No |
| ActivityStudyItems | StudyItemId | StudyItems | Id | Many-to-One | No |
| ActivityStudyItemIndividuals | IndividualId | Individuals | Id | Many-to-One | No |
| ActivityStudyItemIndividuals | ActivityId | Activities | Id | Many-to-One | No |
| ActivityStudyItemIndividuals | StudyItemId | StudyItems | Id | Many-to-One | Yes |
| ActivityStudyItemIndividuals | ActivityStudyItemId | ActivityStudyItems | Id | Many-to-One | Yes |
| **CURRICULUM** |
| StudyItems | ParentStudyItemId | StudyItems | Id | Self-Reference | Yes |
| LocalizedStudyItems | StudyItemId | StudyItems | Id | Many-to-One | No |
| **REPORTING** |
| Cycles | ClusterId | Clusters | Id | Many-to-One | No |
| ClusterAuxiliaryBoardMembers | IndividualId | Individuals | Id | Many-to-One | No |
| ClusterAuxiliaryBoardMembers | ClusterId | Clusters | Id | Many-to-One | No |
| **DYNAMIC LISTS** |
| ListDisplayColumns | ListId | Lists | Id | Many-to-One | No |
| ListDisplayColumns | ListColumnId | ListColumns | Id | Many-to-One | No |
| ListFilterColumns | ListId | Lists | Id | Many-to-One | No |
| ListFilterColumns | ListColumnId | ListColumns | Id | Many-to-One | No |
| ListFilterColumns | ParentFilterColumnId | ListFilterColumns | Id | Self-Reference | Yes |
| ListSortColumns | ListId | Lists | Id | Many-to-One | No |
| ListSortColumns | ListColumnId | ListColumns | Id | Many-to-One | No |

---

## Relationship Patterns

### Hub Tables (Referenced by many others)
1. **Individuals** (4 child tables) - Central people repository
2. **Localities** (3 child tables) - Geographic location anchor
3. **Clusters** (4 child tables) - Operational unit hub
4. **Activities** (2 child tables) - Activity tracking center
5. **StudyItems** (4 child tables including self) - Curriculum hierarchy
6. **Regions** (3 child tables) - Administrative division hub
7. **Lists** (3 child tables) - Dynamic list system hub
8. **ListColumns** (3 child tables) - Column catalog hub

### Leaf Tables (Reference others, not referenced)
- IndividualEmails, IndividualPhones
- ActivityStudyItemIndividuals
- LocalizedStudyItems
- Cycles
- ClusterAuxiliaryBoardMembers
- ListDisplayColumns, ListSortColumns
- ApplicationConfigurations, ApplicationHistories, DBScriptHistories, LoadDataFiles

### Self-Referential Tables
- **StudyItems** (ParentStudyItemId → StudyItems.Id) - Curriculum hierarchy
- **ListFilterColumns** (ParentFilterColumnId → ListFilterColumns.Id) - Nested filters

### Complex Junction Tables
- **ActivityStudyItemIndividuals**: Links 3-4 tables (Individuals, Activities, StudyItems, optionally ActivityStudyItems)
- **ActivityStudyItems**: Links Activities to StudyItems

---

## Foreign Key Cascade Rules

**Recommended cascade rules** (not all may be implemented):

### DELETE CASCADE
- IndividualEmails, IndividualPhones when Individual is deleted
- ActivityStudyItems when Activity is deleted
- ActivityStudyItemIndividuals when Activity or Individual is archived

### DELETE RESTRICT
- Clusters cannot be deleted if Localities exist
- Localities cannot be deleted if Individuals or Activities exist
- Individuals cannot be deleted if ActivityStudyItemIndividuals records exist
- Activities cannot be deleted if ActivityStudyItems exist

### ON UPDATE CASCADE
- All foreign key Id updates should cascade (though IDs typically don't change)

---

## Indexing Requirements

**All foreign key fields MUST be indexed** for performance:

```sql
-- Geographic hierarchy
CREATE INDEX IX_Regions_NationalCommunityId ON [Regions]([NationalCommunityId]);
CREATE INDEX IX_Clusters_RegionId ON [Clusters]([RegionId]);
CREATE INDEX IX_Localities_ClusterId ON [Localities]([ClusterId]);

-- People
CREATE INDEX IX_Individuals_LocalityId ON [Individuals]([LocalityId]);
CREATE INDEX IX_IndividualEmails_IndividualId ON [IndividualEmails]([IndividualId]);
CREATE INDEX IX_IndividualPhones_IndividualId ON [IndividualPhones]([IndividualId]);

-- Activities
CREATE INDEX IX_Activities_LocalityId ON [Activities]([LocalityId]);
CREATE INDEX IX_ActivityStudyItems_ActivityId ON [ActivityStudyItems]([ActivityId]);
CREATE INDEX IX_ActivityStudyItemIndividuals_IndividualId ON [ActivityStudyItemIndividuals]([IndividualId]);
CREATE INDEX IX_ActivityStudyItemIndividuals_ActivityId ON [ActivityStudyItemIndividuals]([ActivityId]);

-- Curriculum
CREATE INDEX IX_StudyItems_ParentStudyItemId ON [StudyItems]([ParentStudyItemId]);
CREATE INDEX IX_LocalizedStudyItems_StudyItemId ON [LocalizedStudyItems]([StudyItemId]);

-- Reporting
CREATE INDEX IX_Cycles_ClusterId ON [Cycles]([ClusterId]);
CREATE INDEX IX_ClusterAuxiliaryBoardMembers_ClusterId ON [ClusterAuxiliaryBoardMembers]([ClusterId]);

-- Dynamic Lists
CREATE INDEX IX_ListDisplayColumns_ListId ON [ListDisplayColumns]([ListId]);
CREATE INDEX IX_ListFilterColumns_ListId ON [ListFilterColumns]([ListId]);
CREATE INDEX IX_ListSortColumns_ListId ON [ListSortColumns]([ListId]);
```

---

## Query Joining Patterns

### Geographic Rollup (Common Pattern)
```sql
-- Roll up from Locality → Cluster → Region → National Community
SELECT
    NC.[Name] AS [Country],
    R.[Name] AS [Region],
    C.[Name] AS [Cluster],
    L.[Name] AS [Locality],
    COUNT(I.[Id]) AS [IndividualCount]
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
INNER JOIN [Regions] R ON C.[RegionId] = R.[Id]
INNER JOIN [NationalCommunities] NC ON R.[NationalCommunityId] = NC.[Id]
WHERE I.[IsArchived] = 0
GROUP BY NC.[Name], R.[Name], C.[Name], L.[Name];
```

### Activity Participation (Complex Join)
```sql
-- Link Individuals to Activities through ActivityStudyItemIndividuals
SELECT
    C.[Name] AS [Cluster],
    A.[ActivityType],
    COUNT(DISTINCT ASI.[IndividualId]) AS [Participants]
FROM [Activities] A
INNER JOIN [ActivityStudyItemIndividuals] ASI ON A.[Id] = ASI.[ActivityId]
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE A.[IsCompleted] = 0
  AND ASI.[IsCurrent] = 1
GROUP BY C.[Id], C.[Name], A.[ActivityType]
HAVING COUNT(DISTINCT ASI.[IndividualId]) >= 10;  -- Privacy threshold
```

### Curriculum Hierarchy (Self-Join)
```sql
-- Traverse StudyItems parent-child hierarchy
SELECT
    Parent.[Name] AS [BookName],
    Child.[Name] AS [UnitName],
    GrandChild.[Name] AS [LessonName]
FROM [StudyItems] Parent
LEFT JOIN [StudyItems] Child ON Parent.[Id] = Child.[ParentStudyItemId]
LEFT JOIN [StudyItems] GrandChild ON Child.[Id] = GrandChild.[ParentStudyItemId]
WHERE Parent.[ParentStudyItemId] IS NULL  -- Root level
ORDER BY Parent.[Sequence], Child.[Sequence], GrandChild.[Sequence];
```

---

## Referential Integrity Validation

**Check for orphaned records** (records with foreign keys pointing to non-existent parents):

```sql
-- Find Individuals with invalid LocalityId
SELECT COUNT(*)
FROM [Individuals] I
LEFT JOIN [Localities] L ON I.[LocalityId] = L.[Id]
WHERE L.[Id] IS NULL;

-- Find Activities with invalid LocalityId
SELECT COUNT(*)
FROM [Activities] A
LEFT JOIN [Localities] L ON A.[LocalityId] = L.[Id]
WHERE L.[Id] IS NULL;

-- Find ActivityStudyItemIndividuals with invalid IndividualId
SELECT COUNT(*)
FROM [ActivityStudyItemIndividuals] ASI
LEFT JOIN [Individuals] I ON ASI.[IndividualId] = I.[Id]
WHERE I.[Id] IS NULL;
```

---

## Notes for Developers

1. **Always verify foreign key constraints** before inserting records
2. **Use transactions** when inserting/updating multiple related tables
3. **Index all foreign keys** for query performance
4. **Understand cascade rules** before deleting records
5. **Validate orphaned records** periodically
6. **Handle NULL optional relationships** appropriately in queries
7. **Follow the geographic hierarchy** for proper data aggregation
8. **Respect privacy constraints** when joining to Individuals table

---

**END OF DOCUMENT**

*For table-specific relationships, see individual table documentation in `schema/` directory.*
