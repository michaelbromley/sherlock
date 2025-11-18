# SRP Database Glossary

## Overview

This glossary explains Bahá'í-specific terms, database concepts, and technical terminology used throughout the SRP (Statistical Reporting Program) database and its documentation.

**Last Updated:** November 18, 2024
**Audience:** Developers, database administrators, statisticians, and coordinators

---

## Table of Contents

- [Geographic and Administrative Terms](#geographic-and-administrative-terms)
- [Educational Activity Terms](#educational-activity-terms)
- [Institutional Terms](#institutional-terms)
- [Curriculum and Study Terms](#curriculum-and-study-terms)
- [Participant and Role Terms](#participant-and-role-terms)
- [Database Technical Terms](#database-technical-terms)
- [Privacy and Compliance Terms](#privacy-and-compliance-terms)

---

## Geographic and Administrative Terms

### National Community
**Database:** `NationalCommunities` table

**Definition:** The top-level geographic and administrative unit in the Bahá'í organizational structure, typically corresponding to a country or territory.

**Examples:**
- United States
- Canada
- United Kingdom
- Australia

**Database Representation:**
- `NationalCommunities.Name` - Name of country/territory
- `NationalCommunities.Code` - ISO country code
- Parent of: Regions, GroupOfRegions, ElectoralUnits

**Usage:** Used for country-level reporting and national-level statistics.

---

### Region
**Database:** `Regions` table

**Definition:** A major administrative division within a national community, often corresponding to a state, province, or large geographic area.

**Examples:**
- California (USA)
- Ontario (Canada)
- England (UK)

**Database Representation:**
- `Regions.Name` - Name of region
- `Regions.NationalCommunityId` - Parent national community
- `Regions.GroupOfRegionId` - Optional parent grouping
- Parent of: Clusters, Subregions, ElectoralUnits

**Usage:** Regional-level coordination, reporting, and resource allocation.

---

### Group of Regions
**Database:** `GroupOfRegions` table

**Definition:** An optional high-level grouping of multiple regions within a large national community for administrative coordination purposes.

**Examples:**
- West Coast (grouping California, Oregon, Washington)
- Eastern Provinces (grouping multiple Canadian provinces)

**Database Representation:**
- `GroupOfRegions.Name` - Name of grouping
- `GroupOfRegions.NationalCommunityId` - Parent national community
- Parent of: Regions

**Usage:** Used in large countries to manage multiple regions efficiently.

---

### Cluster
**Database:** `Clusters` table

**Definition:** The **primary operational unit** in the Bahá'í community development framework. A cluster is a geographic area (typically a city, town, or group of villages) where systematic educational and community-building activities are carried out.

**Key Characteristics:**
- Has a defined geographic boundary
- Assigned a **stage of development** (Milestone)
- Has appointed coordinators and support structures
- Unit of reporting and planning

**Database Representation:**
- `Clusters.Name` - Name of cluster
- `Clusters.RegionId` - Parent region
- `Clusters.StageOfDevelopment` - Milestone level (see below)
- `Clusters.ApproxPopulation` - Population estimate
- `Clusters.TotalChildrensClasses`, `TotalJuniorYouthGroups`, `TotalStudyCircles` - Activity counts
- Parent of: Localities, GroupOfClusters, Cycles

**Usage:** Core unit for all activity reporting, capacity building, and growth analysis.

---

### Stage of Development / Milestone
**Database:** `Clusters.StageOfDevelopment` field

**Definition:** A classification system indicating the level of community development and capacity within a cluster.

**Milestone Levels:**

#### Milestone 1
**Characteristics:**
- Initial activities established
- Basic core activities (children's classes, junior youth groups, study circles) beginning
- Foundation-building phase
- Limited coordinator capacity

**Indicators:**
- At least one of each core activity type established
- Beginning participant engagement
- Learning about educational process

#### Milestone 2
**Characteristics:**
- Systematic programs in place
- Consistent core activity implementation
- Growing coordinator capacity
- Emerging culture of learning

**Indicators:**
- Multiple activities of each type
- Consistent activity cycles
- Increasing participant numbers
- Regular reflection gatherings

#### Milestone 3
**Characteristics:**
- Intensive programs of growth
- High activity levels across localities
- Strong human resources
- Culture of learning well-established
- Significant community participation

**Indicators:**
- High activity density (activities per capita)
- Large numbers of participants
- Many trained tutors, teachers, animators
- Regular intensive growth campaigns

**Database Representation:**
- Stored as varchar: "Milestone 1", "Milestone 2", "Milestone 3", or other classifications
- Used for cluster comparison and capacity assessment

**Usage:** Essential for understanding cluster capacity, resource allocation, and growth planning.

---

### Locality
**Database:** `Localities` table

**Definition:** A specific geographic location within a cluster, typically a village, town, neighborhood, or clearly-defined community area where activities take place.

**Examples:**
- "Downtown" (neighborhood)
- "Riverside" (village)
- "North District" (area of city)

**Database Representation:**
- `Localities.Name` - Name of locality
- `Localities.ClusterId` - Parent cluster
- `Localities.ApproxPopulation` - Population estimate
- Parent of: Individuals, Activities, Subdivisions

**Usage:** Activity location, participant assignment, local community identification.

---

### Subdivision
**Database:** `Subdivisions` table

**Definition:** An **optional** neighborhood-level division within a locality, used in large urban areas for finer geographic granularity.

**Examples:**
- "Block 3" (within a locality)
- "East Side" (neighborhood within town)

**Database Representation:**
- `Subdivisions.Name` - Name of subdivision
- `Subdivisions.LocalityId` - Parent locality
- Parent of: Individuals, Activities (optional)

**Usage:** Used sparingly, only when localities are too large for effective coordination.

---

### Electoral Unit
**Database:** `ElectoralUnits` table

**Definition:** A Bahá'í administrative jurisdiction used for elections to Local and National Spiritual Assemblies. May differ from operational geographic boundaries.

**Key Points:**
- Used for electoral purposes only
- Boundaries may not match cluster boundaries
- Separate from operational structure

**Database Representation:**
- `ElectoralUnits.Name` - Name of electoral unit
- `ElectoralUnits.NationalCommunityId` - National community
- `ElectoralUnits.RegionId` - Optional region association

**Usage:** Electoral process administration, not used for activity reporting.

---

## Educational Activity Terms

### Core Activities
**Database:** `Activities` table with `ActivityType` field

**Definition:** The three foundational educational activities of the Bahá'í community development framework.

**Three Core Activity Types:**

#### Type 0: Children's Classes
**Ages:** 5-11 years old
**Purpose:** Spiritual and moral education for children
**Facilitator:** Children's class teacher
**Curriculum:** Age-appropriate lessons on virtues, prayers, stories

**Database Representation:**
- `Activities.ActivityType = 0`
- `Clusters.TotalChildrensClasses` - Count in cluster

**Participant Roles:**
- Role 1: Teacher (primary instructor)
- Role 7: Student (child participant)

#### Type 1: Junior Youth Groups
**Ages:** 12-15 years old
**Purpose:** Spiritual empowerment program for early adolescents
**Facilitator:** Junior youth group animator
**Curriculum:** Ruhi Institute Book 5 (Releasing the Powers of Junior Youth) and junior youth texts

**Database Representation:**
- `Activities.ActivityType = 1`
- `Clusters.TotalJuniorYouthGroups` - Count in cluster

**Participant Roles:**
- Role 1: Animator (primary facilitator)
- Role 5: Assistant animator
- Role 7: Junior youth participant

#### Type 2: Study Circles
**Ages:** 15+ years (youth and adults)
**Purpose:** Capacity building through systematic study of Ruhi Institute sequence
**Facilitator:** Tutor
**Curriculum:** Ruhi Institute books (sequence of 7+ books)

**Database Representation:**
- `Activities.ActivityType = 2`
- `Clusters.TotalStudyCircles` - Count in cluster

**Participant Roles:**
- Role 1: Tutor (primary facilitator)
- Role 3: Co-tutor
- Role 7: Participant

**Usage:** Activity type determines curriculum, participant age range, and facilitator requirements.

---

### Study Circle
**Database:** `Activities` table (ActivityType = 2)

**Definition:** A small group of youth and adults (typically 5-12 participants) studying the Ruhi Institute curriculum together under the guidance of a tutor.

**Key Characteristics:**
- Systematic study of sequential educational materials
- Builds capacity for service to community
- Participatory learning environment
- Regular meetings (often weekly)

**Database Representation:**
- `Activities.ActivityType = 2`
- `Activities.StartDate`, `EndDate` - Study circle duration
- `ActivityStudyItems` - Links to specific Ruhi books/units studied
- `ActivityStudyItemIndividuals` - Participants and their roles

**Progression:**
- Participants complete books in sequence
- Each book builds on previous
- Completion of Book 7 qualifies as tutor

**Usage:** Fundamental mechanism for capacity building in Bahá'í communities.

---

### Activity
**Database:** `Activities` table

**Definition:** A general term for any organized educational gathering, including children's classes, junior youth groups, study circles, or other educational events.

**Common Fields:**
- `Activities.ActivityType` - Type classification (0/1/2)
- `Activities.StartDate`, `EndDate` - Activity duration
- `Activities.LocalityId` - Where activity takes place
- `Activities.IsCompleted` - Whether activity has ended
- `Activities.Participants` - Total participant count

**Activity Lifecycle:**
1. **Created** - Activity record created
2. **Active** - IsCompleted = 0, meetings occurring
3. **Completed** - IsCompleted = 1, activity ended
4. **Archived** - IsArchived = 1, no longer in active reporting

**Usage:** Central table for tracking all educational activities.

---

### Participant
**Database:** `ActivityStudyItemIndividuals` table

**Definition:** An individual engaged in an educational activity, linked through the participation tracking system.

**Participation Status:**
- `IsCurrent = 1` - Currently active in activity
- `IsCurrent = 0` - No longer participating (dropped out or completed)

**Database Representation:**
- `ActivityStudyItemIndividuals.IndividualId` - Person participating
- `ActivityStudyItemIndividuals.ActivityId` - Activity they're in
- `ActivityStudyItemIndividuals.Role` - Their role (see Roles below)
- `ActivityStudyItemIndividuals.IsCurrent` - Active status

**Usage:** Tracks WHO participates in WHAT activities with WHICH role.

---

## Institutional Terms

### Auxiliary Board Member
**Database:** `ClusterAuxiliaryBoardMembers` table

**Definition:** An appointed Bahá'í institutional official who serves under Continental Counselors to promote teaching and community development within assigned clusters.

**Two Branches:**
- **Protection Branch:** Safeguarding Bahá'í community integrity
- **Propagation Branch:** Promoting teaching and growth

**Responsibilities:**
- Provide guidance and encouragement to cluster communities
- Coordinate teaching and growth activities
- Support Local Spiritual Assemblies
- Channel between clusters and higher institutions
- Promote systematic educational process

**Database Representation:**
- `ClusterAuxiliaryBoardMembers.BoardMemberName` - Name of official (CRITICAL PII)
- `ClusterAuxiliaryBoardMembers.ClusterId` - Assigned cluster
- One cluster may have multiple board members
- One board member may serve multiple clusters

**Privacy:** CRITICAL - Names and assignments require protection

**Usage:** Institutional support tracking, coordination contacts.

---

### Coordinator
**Database:** Various fields in `Clusters` and other tables

**Definition:** An individual with specific responsibility for coordinating educational activities within a cluster or locality.

**Types of Coordinators:**
- **Cluster coordinator** - Overall cluster coordination
- **Children's classes coordinator** - Coordinates Type 0 activities
- **Junior youth coordinator** - Coordinates Type 1 activities
- **Study circle coordinator** - Coordinates Type 2 activities

**Database Representation:**
- `Clusters.NameOfCoordinator` - Primary cluster coordinator
- Typically 1-3 coordinators per cluster depending on capacity

**Responsibilities:**
- Plan and facilitate activities
- Support tutors, teachers, animators
- Organize reflection gatherings
- Maintain statistics and reports

**Usage:** Capacity indicator, contact for cluster operations.

---

### Tutor
**Database:** Individuals with specific role in study circles

**Definition:** A person who facilitates a study circle, guiding participants through the Ruhi Institute curriculum.

**Qualification:**
- Typically completed Ruhi Institute Book 7 ("Walking Together on a Path of Service")
- Has capacity to guide collaborative study

**Role in Activities:**
- `ActivityStudyItemIndividuals.Role = 1` (primary tutor)
- `ActivityStudyItemIndividuals.Role = 3` (co-tutor/assistant)

**Database Tracking:**
- `Clusters.TotalTutors` - Number of active tutors in cluster
- Through ActivityStudyItemIndividuals with Role = 1 or 3 in ActivityType = 2

**Usage:** Critical human resource for study circle multiplication.

---

### Animator
**Database:** Individuals with specific role in junior youth groups

**Definition:** A person who animates (facilitates) a junior youth group, guiding junior youth through spiritual empowerment program.

**Qualification:**
- Typically completed Ruhi Institute Book 5 ("Releasing the Powers of Junior Youth")
- Has capacity to work with 12-15 year olds

**Role in Activities:**
- `ActivityStudyItemIndividuals.Role = 1` (primary animator)
- `ActivityStudyItemIndividuals.Role = 5` (assistant animator)

**Database Tracking:**
- `Clusters.TotalAnimators` - Number of active animators in cluster
- Through ActivityStudyItemIndividuals with Role = 1 or 5 in ActivityType = 1

**Usage:** Critical human resource for junior youth group multiplication.

---

### Teacher (Children's Class)
**Database:** Individuals with specific role in children's classes

**Definition:** A person who teaches children's classes, educating children ages 5-11 in spiritual and moral lessons.

**Qualification:**
- Typically completed Ruhi Institute Book 3 ("Teaching Children's Classes, Grade 1")
- May have completed additional grades (Books 3.1, 3.2, etc.)

**Role in Activities:**
- `ActivityStudyItemIndividuals.Role = 1` (primary teacher)
- `ActivityStudyItemIndividuals.Role = 5` (assistant teacher)

**Database Tracking:**
- `Clusters.TotalChildrensClassTeachers` - Number of active teachers in cluster
- Through ActivityStudyItemIndividuals with Role = 1 or 5 in ActivityType = 0

**Usage:** Critical human resource for children's class multiplication.

---

## Curriculum and Study Terms

### Ruhi Institute
**Database:** Referenced in `StudyItems` table

**Definition:** The primary educational institution of the Bahá'í world community, producing a systematic sequence of educational materials for capacity building.

**Curriculum Structure:**
- Sequential books (Book 1, 2, 3, etc.)
- Each book divided into units
- Materials available in 80+ languages

**Main Sequence (as of 2024):**
- Book 1: Reflections on the Life of the Spirit
- Book 2: Arising to Serve
- Book 3: Teaching Children's Classes, Grade 1
- Book 4: The Twin Manifestations
- Book 5: Releasing the Powers of Junior Youth
- Book 6: Teaching the Cause
- Book 7: Walking Together on a Path of Service
- Book 8: The Covenant
- Book 9: Gaining an Historical Perspective
- Book 10: Building Vibrant Communities
- (Additional books continue the sequence)

**Database Representation:**
- `StudyItems` table contains curriculum hierarchy
- `LocalizedStudyItems` contains translations

**Usage:** Foundation of all systematic educational activities.

---

### Study Item
**Database:** `StudyItems` table

**Definition:** An element within the educational curriculum, which may be a book, grade, unit, or lesson.

**Hierarchy:**
- **Root level:** Books (e.g., "Ruhi Institute Book 1")
- **Second level:** Units or Grades (e.g., "Unit 1: Understanding the Bahá'í Writings")
- **Third level:** Sections or Lessons (if applicable)

**Database Representation:**
- `StudyItems.Name` - Name of study item
- `StudyItems.ParentStudyItemId` - Parent in hierarchy (self-referential)
- `StudyItems.Sequence` - Order within parent
- `StudyItems.StudyItemType` - Classification (Book, Grade, Unit, etc.)

**Self-Referential Structure:**
```
Book 1 (ParentStudyItemId = NULL)
  ├── Unit 1 (ParentStudyItemId = Book 1 Id)
  ├── Unit 2 (ParentStudyItemId = Book 1 Id)
  └── Unit 3 (ParentStudyItemId = Book 1 Id)
```

**Usage:** Links activities to specific curriculum materials being studied.

---

### Localized Study Item
**Database:** `LocalizedStudyItems` table

**Definition:** A translation of a study item into a specific language, enabling multi-language curriculum support.

**Languages Supported (examples):**
- en-US (English - United States)
- es-ES (Spanish - Spain)
- fr-FR (French - France)
- pt-BR (Portuguese - Brazil)
- ar-SA (Arabic - Saudi Arabia)
- zh-CN (Chinese - China)
- (80+ languages total)

**Database Representation:**
- `LocalizedStudyItems.StudyItemId` - Parent study item
- `LocalizedStudyItems.Language` - ISO language code
- `LocalizedStudyItems.Name` - Translated name
- `LocalizedStudyItems.Description` - Translated description

**Usage:** Display study item names in appropriate language for participants.

---

## Participant and Role Terms

### Individual
**Database:** `Individuals` table

**Definition:** A person recorded in the SRP database, including participants in activities, coordinators, and community members.

**Personal Information (CRITICAL PII):**
- `FirstName`, `MiddleName`, `FamilyName` - Name fields
- `EstimatedYearOfBirthDate` - Age calculation
- `Gender` - Demographic field
- `IsBeliever`, `IndividualType` - Religious affiliation (GDPR sensitive)

**Geographic Assignment:**
- `LocalityId` - Primary locality
- `SubdivisionId` - Optional subdivision

**Status Fields:**
- `IsArchived` - Whether record is active
- `IsPermanentlyDeceased` - Deceased status

**Privacy:** CRITICAL - Names, birthdates, and religious affiliation require maximum protection

**Usage:** Central repository for all people in community database.

---

### Role (in Activities)
**Database:** `ActivityStudyItemIndividuals.Role` field

**Definition:** The capacity in which an individual participates in an activity.

**Role Values:**

| Role Code | Role Name | Description | Typical Activity Type |
|-----------|-----------|-------------|----------------------|
| 1 | Primary Facilitator/Teacher | Main person leading activity | All types |
| 3 | Co-facilitator/Co-tutor | Secondary facilitator assisting primary | Study circles |
| 5 | Assistant | Helper supporting primary facilitator | Children's classes, Junior youth |
| 7 | Regular Participant | Standard participant/student | All types |

**Role Significance:**
- **Role 1** indicates leadership/facilitation capacity
- **Role 7** is most common (regular participants)
- Roles 3 and 5 indicate capacity-building trajectory

**Database Representation:**
- `ActivityStudyItemIndividuals.Role` (int field)
- Used to count tutors, teachers, animators in cluster statistics

**Usage:** Identifies human resources and capacity within clusters.

---

### IsCurrent
**Database:** `ActivityStudyItemIndividuals.IsCurrent` field

**Definition:** Indicates whether an individual is currently actively participating in an activity.

**Values:**
- `IsCurrent = 1` - Currently participating
- `IsCurrent = 0` - No longer participating (dropped, completed, or inactive)

**Usage:**
- Count current participants: `WHERE IsCurrent = 1`
- Historical participation tracking
- Activity attendance management

**Business Logic:**
- When activity completes, IsCurrent may be set to 0
- When participant drops out, IsCurrent set to 0
- Only IsCurrent = 1 should count in active participant statistics

---

## Database Technical Terms

### Primary Key
**Database:** `Id` field in all tables

**Definition:** A unique identifier for each record in a table, used to reference specific records.

**Characteristics:**
- Data type: bigint (64-bit integer)
- Auto-increment (typically)
- Never NULL
- Guaranteed unique within table

**Usage:**
- `Individuals.Id` - Unique identifier for each person
- `Activities.Id` - Unique identifier for each activity
- Used as target for foreign keys

---

### Foreign Key
**Database:** Fields ending in "Id" that reference other tables

**Definition:** A field that creates a relationship to another table by storing the primary key of the related record.

**Examples:**
- `Activities.LocalityId` → References `Localities.Id`
- `Individuals.LocalityId` → References `Localities.Id`
- `Clusters.RegionId` → References `Regions.Id`

**Naming Convention:**
- Field name typically: `[TableName]Id` (e.g., `LocalityId`, `ClusterId`)
- References: `[TableName].Id` (e.g., `Localities.Id`, `Clusters.Id`)

**Referential Integrity:**
- Foreign key must match existing primary key in referenced table
- Prevents orphaned records
- Enforces data consistency

**Usage:** See `reports/Foreign_Key_Cross_Reference_Matrix.md` for complete mapping.

---

### IsArchived
**Database:** `IsArchived` field in many tables

**Definition:** A boolean flag indicating whether a record is archived (no longer active in current reporting).

**Values:**
- `IsArchived = 0` - Active record (default)
- `IsArchived = 1` - Archived record (historical, not in current statistics)

**Tables with IsArchived:**
- `Individuals` - Archived when moved away or deceased
- `Activities` - Archived when no longer relevant for reporting
- `ActivityStudyItemIndividuals` - Archived participation records

**Best Practice:**
- **Always filter:** `WHERE IsArchived = 0` in queries for current data
- Include archived records only for historical analysis

**Usage:** Separates active records from historical data without deletion.

---

### Cycle
**Database:** `Cycles` table

**Definition:** A defined statistical reporting period (typically 3 months) used for tracking cluster progress and activity metrics over time.

**Key Fields:**
- `Cycles.CycleNumber` - Sequential cycle identifier (e.g., 1, 2, 3...)
- `Cycles.StartDate`, `EndDate` - Period boundaries
- `Cycles.ClusterId` - Cluster being reported
- Pre-aggregated statistics: `TotalChildrensClasses`, `TotalJuniorYouthGroups`, etc.

**Reporting Metrics:**
- Activity counts by type
- Participant counts
- Human resources (tutors, animators, teachers)
- Reflection gathering attendance
- Home visits

**Usage:**
- Historical trend analysis
- Cycle-over-cycle growth comparison
- Cluster capacity assessment over time

---

### Junction Table
**Database:** Tables linking many-to-many relationships

**Definition:** A table that connects two other tables in a many-to-many relationship, storing additional attributes about the relationship.

**Primary Example: ActivityStudyItemIndividuals**
- Links: `Individuals` ←→ `Activities` (many-to-many)
- Additional attributes: `Role`, `IsCurrent`, participation dates
- Enables: "Which individuals participate in which activities in what roles"

**Other Junction Tables:**
- `ActivityStudyItems` - Links `Activities` ←→ `StudyItems`
- `ListDisplayColumns` - Links `Lists` ←→ `ListColumns`

**Structure:**
- Contains foreign keys to both linked tables
- May have additional fields describing the relationship
- Primary key often composite or separate Id field

**Usage:** Essential for tracking complex many-to-many relationships.

---

## Privacy and Compliance Terms

### Personally Identifiable Information (PII)
**Database:** CRITICAL fields in `Individuals`, `IndividualEmails`, `IndividualPhones`, `ClusterAuxiliaryBoardMembers`

**Definition:** Information that can be used to identify a specific individual, requiring strict privacy protection.

**CRITICAL PII in SRP Database:**
- `Individuals.FirstName`, `FamilyName` - Names
- `IndividualEmails.Email` - Email addresses
- `IndividualPhones.PhoneNumber` - Phone numbers
- `Individuals.EstimatedYearOfBirthDate` - Age/birthdate
- `ClusterAuxiliaryBoardMembers.BoardMemberName` - Institutional official names

**Protection Requirements:**
- Encrypt at rest
- Restrict access to authorized users only
- Never expose in public reports
- Require minimum aggregation thresholds

**See:** `reports/Privacy_and_Security_Classification_Matrix.md` for complete classification.

---

### Privacy Threshold
**Database:** Query pattern requirement

**Definition:** A minimum count requirement before reporting aggregated individual-level statistics, preventing re-identification of individuals or small groups.

**Standard Thresholds:**
- **≥10 individuals:** Recommended minimum for individual-level aggregation
- **≥5 activities/participants:** Acceptable for activity-level aggregation
- **Population < 500:** Aggregate to cluster level instead of locality level

**SQL Implementation:**
```sql
HAVING COUNT(*) >= 10  -- Privacy threshold
```

**Purpose:**
- Prevents identification of individuals through small groups
- Protects privacy in small localities
- Compliance with GDPR, CCPA requirements

**Usage:** Apply HAVING clause to all queries involving individual counts.

---

### GDPR (General Data Protection Regulation)
**Compliance Requirement:** European Union data protection law

**Relevant to SRP Database:**
- **Consent required:** For collecting and processing personal data
- **Right to erasure:** Individuals can request data deletion
- **Data minimization:** Only collect necessary data
- **Sensitive data protection:** Religious affiliation (`IndividualType`, `IsBeliever`) requires extra protection
- **Cross-border transfer:** Restrictions on data transfer outside EU

**SRP Database Fields Affected:**
- All CRITICAL PII fields
- `IndividualType`, `IsBeliever` (religious affiliation - GDPR "special category")
- Contact information (emails, phones)

**See:** Privacy Matrix for GDPR compliance guidance.

---

### COPPA (Children's Online Privacy Protection Act)
**Compliance Requirement:** US law protecting children under 13 (16 in some jurisdictions)

**Relevant to SRP Database:**
- **Parental consent required:** Before collecting data from children
- **Age verification:** Must verify if individual is under 13/16
- **Data minimization:** Collect minimum necessary from children
- **Security:** Extra protection for children's data

**SRP Database Considerations:**
- Children's Classes (ActivityType = 0) participants often under 13
- `EstimatedYearOfBirthDate` used to calculate age
- **Never expose** which specific children attend which activities

**Age Calculation:**
```sql
YEAR(GETDATE()) - I.[EstimatedYearOfBirthDate] < 13  -- Child under 13
```

**See:** Privacy Matrix for COPPA compliance patterns.

---

### TCPA (Telephone Consumer Protection Act)
**Compliance Requirement:** US law regulating phone and SMS communications

**Relevant to SRP Database:**
- **Prior express written consent** required for automated calls/SMS
- **Opt-out mechanism** must be provided
- **Do Not Call registry** compliance

**SRP Database Fields:**
- `IndividualPhones.PhoneNumber` - Requires consent before use
- `IndividualPhones.IsPrimary` - Identifies preferred contact number

**Protection:**
- Never expose phone numbers without authorization
- Document consent before using for bulk communications
- Respect opt-out requests

**See:** `schema/IndividualPhones.md` for TCPA compliance guidance.

---

### CAN-SPAM Act
**Compliance Requirement:** US law regulating commercial email

**Relevant to SRP Database:**
- **Opt-out mechanism** required in all emails
- **Accurate header information** (From, To, routing)
- **Honest subject lines**
- **Physical address** required in footer

**SRP Database Fields:**
- `IndividualEmails.Email` - Requires consent for bulk emails
- `IndividualEmails.IsPrimary` - Identifies preferred email

**Protection:**
- Never expose email addresses without authorization
- Document consent before bulk emails
- Maintain opt-out list
- Use SPF/DKIM/DMARC for authentication

**See:** `schema/IndividualEmails.md` for CAN-SPAM compliance guidance.

---

## Abbreviations and Acronyms

| Abbreviation | Full Term | Context |
|--------------|-----------|---------|
| SRP | Statistical Reporting Program | Database name |
| PII | Personally Identifiable Information | Privacy term |
| GDPR | General Data Protection Regulation | EU privacy law |
| CCPA | California Consumer Privacy Act | California privacy law |
| COPPA | Children's Online Privacy Protection Act | US children's privacy law |
| TCPA | Telephone Consumer Protection Act | US phone communications law |
| CAN-SPAM | Controlling the Assault of Non-Solicited Pornography And Marketing | US email law |
| FK | Foreign Key | Database relationship |
| PK | Primary Key | Database unique identifier |
| CTE | Common Table Expression | SQL feature |
| LSA | Local Spiritual Assembly | Bahá'í administrative body (not in database) |
| NSA | National Spiritual Assembly | Bahá'í administrative body (not in database) |

---

## Related Documentation

For deeper understanding of specific concepts:

### Database Structure
- **Foreign keys:** `reports/Foreign_Key_Cross_Reference_Matrix.md`
- **Table details:** `schema/[TableName].md` (28 files)
- **Overall schema:** `reports/SRP_Database_Schema_Analysis.md`

### Privacy and Security
- **Privacy classification:** `reports/Privacy_and_Security_Classification_Matrix.md`
- **Secure queries:** `reports/Query_Pattern_Library.md` (Pattern 6.x series)
- **Field-level sensitivity:** Individual schema files (privacy sections)

### Query Development
- **Query patterns:** `reports/Query_Pattern_Library.md`
- **Best practices:** `CLAUDE.md` (Best Practices section)
- **Quick-start guides:** `schema/README.md` (Persona-specific guides)

### Tool Integration
- **Database explorer:** `db-tool/README.md`
- **Tool usage:** `db-tool/CLAUDE.md`
- **Integration points:** `schema/README.md` (Integration section)

---

## Notes for Users

### For Developers
- **Always read** `schema/[TableName].md` before working with any table
- **Check privacy classification** before querying PII fields
- **Use query patterns** from Query_Pattern_Library.md as starting points
- **Follow SQL Server syntax** with square brackets `[TableName]`

### For Database Administrators
- **Index all foreign keys** as documented in Foreign_Key_Cross_Reference_Matrix.md
- **Implement row-level security** for CRITICAL PII tables
- **Encrypt PII fields** at rest (names, emails, phones)
- **Audit access** to CRITICAL tables

### For Statisticians/Researchers
- **Apply privacy thresholds** (≥10 for individuals, ≥5 for activities)
- **Aggregate small populations** to cluster level
- **Never identify individuals** in reports or publications
- **Use fictitious data** in documentation examples

### For Coordinators
- **Authorized access only** to PII fields
- **Respect privacy boundaries** - don't share contact info
- **Report at cluster level** when possible
- **Understand milestone classifications** for capacity assessment

---

## Glossary Maintenance

This glossary should be updated when:
- New tables are added to the database
- New terminology is introduced
- Privacy regulations change
- Bahá'í administrative structures evolve
- Technical concepts are added

**Last Reviewed:** November 18, 2024
**Maintained By:** Database documentation team
**Review Frequency:** Annually or as needed

---

**END OF GLOSSARY**

*For table-specific terminology, see individual schema files in `schema/` directory.*
*For privacy-specific terms, see `reports/Privacy_and_Security_Classification_Matrix.md`.*
