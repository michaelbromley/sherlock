# Privacy and Security Classification Matrix
## SRP Database - Data Protection and Compliance Guide

**Document Version:** 1.0
**Last Updated:** 2025-11-18
**Purpose:** Comprehensive privacy classification for all 28 tables in the SRP database

---

## Executive Summary

This document provides a comprehensive privacy and security classification for all tables and fields in the SRP (Statistical Reporting Program) database. The classification system ensures proper handling of personal information, compliance with data protection principles, and secure implementation of queries and reports.

### Privacy Sensitivity Levels

| Level | Description | Examples | Restrictions |
|-------|-------------|----------|--------------|
| **CRITICAL** | Direct personal identifiers | Names, email addresses, phone numbers, birthdates | Never in public reports; requires explicit consent; encrypted in transit |
| **HIGH** | Indirect identifiers or sensitive associations | Activity participation, religious affiliation, roles | Aggregated only; anonymized in reports; access-controlled |
| **MODERATE** | Demographic or small geographic data | Age ranges, gender statistics, small localities | May appear in reports if sufficiently aggregated |
| **LOW** | Aggregate statistics, large geographic units | Cluster/region statistics, activity counts | Generally safe for public reporting |
| **MINIMAL** | System metadata, curriculum definitions | Configuration, audit timestamps, study items | No privacy concerns |

---

## Section 1: CRITICAL Privacy Tables

These tables contain direct personal identifiers and require the highest level of protection.

### 1.1 Individuals Table
**Classification:** CRITICAL
**Primary Concern:** Complete personal profiles of all participants

#### Field-Level Classification

| Field Name | Sensitivity | Rationale | Protection Measures |
|------------|-------------|-----------|---------------------|
| Id | HIGH | Unique identifier that links to all personal data | Never expose in public interfaces; use anonymized IDs in reports |
| **FirstName** | **CRITICAL** | Direct personal identifier | Never in public reports; requires consent for storage |
| **FamilyName** | **CRITICAL** | Direct personal identifier | Never in public reports; requires consent for storage |
| Gender | MODERATE | Demographic data | Aggregate only (e.g., "65% female") |
| **EstimatedYearOfBirthDate** | **HIGH** | Can identify individuals in small communities | Convert to age ranges (e.g., "25-34") |
| IsSelectedEstimatedYearOfBirthDate | LOW | Metadata about data quality | No restrictions |
| **DisplayBirthDate** | **HIGH** | Precise or approximate birth date | Convert to age or age range |
| **BirthDate** | **CRITICAL** | Exact birthdate | Never expose; use only for age calculations |
| **IsRegisteredBahai** | **HIGH** | Religious affiliation (sensitive personal data) | Aggregate only; never link to names in reports |
| LocalityId | MODERATE | Geographic location | Safe if locality population > 1000 |
| SubdivisionId | MODERATE | Neighborhood-level location | May identify individuals in small areas |
| IsArchived | LOW | Status flag | No restrictions |
| Comments | HIGH | May contain personal observations | Review before any export; redact personal details |
| CreatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| CreatedBy | LOW | User ID, not subject ID | No restrictions |
| LastUpdatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| LastUpdatedBy | LOW | User ID, not subject ID | No restrictions |
| ImportedTimestamp | MINIMAL | Data provenance | No restrictions |
| ImportedFrom | MINIMAL | Data provenance | No restrictions |
| ImportedFileType | MINIMAL | Data provenance | No restrictions |
| GUID | HIGH | Global unique identifier | Never expose externally |
| LegacyId | MODERATE | Historical identifier | No external exposure |
| InstituteId | HIGH | External system identifier | No external exposure |

#### Anonymization Patterns

```sql
-- ❌ NEVER DO THIS: Exposing personal identifiers
SELECT [FirstName], [FamilyName], [BirthDate]
FROM [Individuals]
WHERE [LocalityId] = 123;

-- ✅ CORRECT: Aggregated demographics without personal identifiers
SELECT
    CASE
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] < 15 THEN 'Under 15'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 15 AND 30 THEN '15-30'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 31 AND 60 THEN '31-60'
        ELSE 'Over 60'
    END AS [AgeRange],
    CASE [Gender] WHEN 1 THEN 'Male' WHEN 2 THEN 'Female' ELSE 'Unspecified' END AS [Gender],
    COUNT(*) AS [Count]
FROM [Individuals]
WHERE [IsArchived] = 0
GROUP BY
    CASE
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] < 15 THEN 'Under 15'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 15 AND 30 THEN '15-30'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 31 AND 60 THEN '31-60'
        ELSE 'Over 60'
    END,
    [Gender];
```

---

### 1.2 IndividualEmails Table
**Classification:** CRITICAL
**Primary Concern:** Direct contact information enabling communication

#### Field-Level Classification

| Field Name | Sensitivity | Rationale | Protection Measures |
|------------|-------------|-----------|---------------------|
| Id | MODERATE | Junction table identifier | No restrictions |
| **IndividualId** | **CRITICAL** | Links to personal identity | Never expose; use only for authorized lookups |
| **Email** | **CRITICAL** | Direct personal contact information | Encrypt in storage and transit; never in public reports; requires explicit consent |
| IsPrimary | LOW | Preference flag | No restrictions when separated from email |
| CreatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| CreatedBy | LOW | User ID | No restrictions |
| LastUpdatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| LastUpdatedBy | LOW | User ID | No restrictions |

#### Anonymization Patterns

```sql
-- ❌ NEVER DO THIS: Exposing email addresses
SELECT I.[FirstName], I.[FamilyName], E.[Email]
FROM [Individuals] I
JOIN [IndividualEmails] E ON I.[Id] = E.[IndividualId];

-- ✅ CORRECT: Checking email existence without exposing addresses
SELECT
    COUNT(DISTINCT CASE WHEN E.[Email] IS NOT NULL THEN I.[Id] END) AS [IndividualsWithEmail],
    COUNT(DISTINCT I.[Id]) AS [TotalIndividuals],
    CAST(COUNT(DISTINCT CASE WHEN E.[Email] IS NOT NULL THEN I.[Id] END) * 100.0 /
         COUNT(DISTINCT I.[Id]) AS DECIMAL(5,2)) AS [PercentageWithEmail]
FROM [Individuals] I
LEFT JOIN [IndividualEmails] E ON I.[Id] = E.[IndividualId]
WHERE I.[IsArchived] = 0;
```

---

### 1.3 IndividualPhones Table
**Classification:** CRITICAL
**Primary Concern:** Direct contact information enabling communication

#### Field-Level Classification

| Field Name | Sensitivity | Rationale | Protection Measures |
|------------|-------------|-----------|---------------------|
| Id | MODERATE | Junction table identifier | No restrictions |
| **IndividualId** | **CRITICAL** | Links to personal identity | Never expose; use only for authorized lookups |
| **PhoneNumber** | **CRITICAL** | Direct personal contact information | Encrypt in storage and transit; never in public reports; requires explicit consent |
| PhoneType | LOW | Category (mobile/home/work) | Safe when separated from phone number |
| IsPrimary | LOW | Preference flag | No restrictions when separated from phone |
| CreatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| CreatedBy | LOW | User ID | No restrictions |
| LastUpdatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| LastUpdatedBy | LOW | User ID | No restrictions |

#### Anonymization Patterns

```sql
-- ❌ NEVER DO THIS: Exposing phone numbers
SELECT I.[FirstName], IP.[PhoneNumber], IP.[PhoneType]
FROM [Individuals] I
JOIN [IndividualPhones] IP ON I.[Id] = IP.[IndividualId];

-- ✅ CORRECT: Phone availability statistics without exposing numbers
SELECT
    CASE IP.[PhoneType]
        WHEN 0 THEN 'Mobile'
        WHEN 1 THEN 'Home'
        WHEN 2 THEN 'Work'
        ELSE 'Other'
    END AS [PhoneType],
    COUNT(*) AS [Count]
FROM [IndividualPhones] IP
INNER JOIN [Individuals] I ON IP.[IndividualId] = I.[Id]
WHERE I.[IsArchived] = 0
GROUP BY IP.[PhoneType];
```

---

### 1.4 ClusterAuxiliaryBoardMembers Table
**Classification:** CRITICAL
**Primary Concern:** Names and assignments of institutional officials

#### Field-Level Classification

| Field Name | Sensitivity | Rationale | Protection Measures |
|------------|-------------|-----------|---------------------|
| Id | LOW | Record identifier | No restrictions |
| **IndividualId** | **HIGH** | Links to institutional official identity | Restrict access to authorized coordinators |
| ClusterId | LOW | Geographic assignment | Safe in institutional contexts |
| StartDate | MODERATE | Assignment history | May identify individuals through timing |
| EndDate | MODERATE | Assignment history | May identify individuals through timing |
| Comments | HIGH | May contain personal notes | Review before any export |
| CreatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| CreatedBy | LOW | User ID | No restrictions |
| LastUpdatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| LastUpdatedBy | LOW | User ID | No restrictions |

**Note:** While institutional assignments may be semi-public within the community, personal contact information and specific assignment histories should be protected from unauthorized access.

---

## Section 2: HIGH Privacy Tables

These tables contain indirect identifiers or sensitive associations that can reveal personal information when combined with other data.

### 2.1 Activities Table
**Classification:** HIGH
**Primary Concern:** Activity participation can identify individuals in small communities; Comments may contain names

#### Field-Level Classification

| Field Name | Sensitivity | Rationale | Protection Measures |
|------------|-------------|-----------|---------------------|
| Id | LOW | Activity identifier | Safe for reporting |
| ActivityType | LOW | Category (children's class, study circle, etc.) | No restrictions |
| DisplayStartDate | LOW | Activity timing | No restrictions |
| StartDate | LOW | Activity timing | No restrictions |
| DisplayEndDate | LOW | Activity timing | No restrictions |
| EndDate | LOW | Activity timing | No restrictions |
| **Comments** | **HIGH** | **May contain participant names, personal observations** | **Always review and redact before export** |
| IsCompleted | LOW | Status flag | No restrictions |
| HasServiceProjects | LOW | Activity characteristic | No restrictions |
| Participants | MODERATE | Count only, but small numbers in small localities may identify groups | Safe if > 5 participants or locality population > 500 |
| BahaiParticipants | MODERATE | Subset count | Same as Participants |
| LocalityId | MODERATE | Small geographic unit | May identify individuals if locality is small |
| SubdivisionId | MODERATE | Neighborhood-level | May identify individuals in specific neighborhoods |
| IsOverrideParticipantCounts | LOW | Data quality flag | No restrictions |
| CreatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| CreatedBy | LOW | User ID | No restrictions |
| LastUpdatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| LastUpdatedBy | LOW | User ID | No restrictions |
| ImportedTimestamp | MINIMAL | Data provenance | No restrictions |
| ImportedFrom | MINIMAL | Data provenance | No restrictions |
| ImportedFileType | MINIMAL | Data provenance | No restrictions |
| GUID | MODERATE | Global identifier | Internal use only |
| LegacyId | MODERATE | Historical identifier | Internal use only |
| InstituteId | MODERATE | External system identifier | Internal use only |

#### Secure Query Examples

```sql
-- ✅ CORRECT: Activity statistics without revealing small groups
SELECT
    C.[Name] AS [ClusterName],
    A.[ActivityType],
    COUNT(*) AS [ActivityCount],
    AVG(A.[Participants]) AS [AvgParticipants]
FROM [Activities] A
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
WHERE A.[IsCompleted] = 0
  AND A.[Participants] >= 5  -- Protect small groups
GROUP BY C.[Name], A.[ActivityType]
HAVING COUNT(*) >= 3;  -- Only show if cluster has 3+ activities
```

---

### 2.2 ActivityStudyItemIndividuals Table
**Classification:** HIGH
**Primary Concern:** Directly links individuals to activities, revealing participation patterns

#### Field-Level Classification

| Field Name | Sensitivity | Rationale | Protection Measures |
|------------|-------------|-----------|---------------------|
| Id | LOW | Record identifier | No restrictions |
| **IndividualId** | **CRITICAL** | Direct link to personal identity | Never expose in reports; use only for authorized internal tracking |
| ActivityId | MODERATE | Links to activity details | Safe when separated from IndividualId |
| StudyItemId | LOW | Curriculum reference | No restrictions |
| **IndividualType** | **HIGH** | **Categorizes by religious affiliation and age** | Aggregate only; never link to names |
| **IndividualRole** | **MODERATE** | Role in activity (teacher, participant, etc.) | Safe in aggregates; may identify individuals in small activities |
| IsCurrent | LOW | Status flag | No restrictions when aggregated |
| IsCompleted | LOW | Completion status | No restrictions when aggregated |
| DisplayEndDate | LOW | Timing information | No restrictions |
| EndDate | LOW | Timing information | No restrictions |
| CreatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| CreatedBy | LOW | User ID | No restrictions |
| LastUpdatedTimestamp | MINIMAL | Audit metadata | No restrictions |
| LastUpdatedBy | LOW | User ID | No restrictions |
| ImportedTimestamp | MINIMAL | Data provenance | No restrictions |
| ImportedFrom | MINIMAL | Data provenance | No restrictions |
| ImportedFileType | MINIMAL | Data provenance | No restrictions |
| GUID | MODERATE | Global identifier | Internal use only |
| LegacyId | MODERATE | Historical identifier | Internal use only |

#### Secure Query Examples

```sql
-- ❌ NEVER DO THIS: Linking individuals to specific activities
SELECT I.[FirstName], I.[FamilyName], A.[ActivityType], ASI.[IndividualRole]
FROM [ActivityStudyItemIndividuals] ASI
JOIN [Individuals] I ON ASI.[IndividualId] = I.[Id]
JOIN [Activities] A ON ASI.[ActivityId] = A.[Id];

-- ✅ CORRECT: Role distribution without personal identifiers
SELECT
    CASE ASI.[IndividualRole]
        WHEN 1 THEN 'Teacher'
        WHEN 2 THEN 'Co-Teacher'
        WHEN 3 THEN 'Tutor'
        WHEN 4 THEN 'Coordinator'
        WHEN 5 THEN 'Assistant'
        WHEN 7 THEN 'Participant'
        ELSE 'Other'
    END AS [Role],
    COUNT(*) AS [Count],
    CAST(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS DECIMAL(5,2)) AS [Percentage]
FROM [ActivityStudyItemIndividuals] ASI
WHERE ASI.[IsCurrent] = 1
GROUP BY ASI.[IndividualRole]
ORDER BY COUNT(*) DESC;
```

---

## Section 3: MODERATE Privacy Tables

These tables contain demographic or geographic data that may be sensitive when highly granular.

### 3.1 Localities Table
**Classification:** MODERATE
**Primary Concern:** Small localities may enable individual identification

| Field Name | Sensitivity | Protection Measures |
|------------|-------------|---------------------|
| Name, LatinName | MODERATE | Safe if population > 500; combine small localities in reports |
| TotalPopulation | LOW | Helps assess re-identification risk |
| ClusterId | LOW | Geographic hierarchy |
| All other fields | LOW-MINIMAL | Standard geographic metadata |

**Guideline:** Localities with population < 500 or < 5 active participants should be aggregated to cluster level in public reports.

---

### 3.2 Subdivisions Table
**Classification:** MODERATE
**Primary Concern:** Neighborhood-level data may identify individuals

| Field Name | Sensitivity | Protection Measures |
|------------|-------------|---------------------|
| Name, LatinName | MODERATE | Combine small subdivisions in reports |
| LocalityId | LOW | Geographic hierarchy |
| All other fields | MINIMAL | Standard metadata |

**Guideline:** Only use subdivision-level reporting for urban areas with substantial populations.

---

### 3.3 Cycles Table
**Classification:** MODERATE
**Primary Concern:** Statistical snapshots that may reveal small groups

| Field Name | Sensitivity | Protection Measures |
|------------|-------------|---------------------|
| Participant counts (various fields) | MODERATE | Apply minimum threshold (≥5) before reporting |
| Geographic references | LOW | Safe at cluster level and above |
| All other fields | LOW-MINIMAL | Standard reporting metadata |

**Guideline:** Suppress cycle statistics for clusters with < 5 total participants in any category.

---

## Section 4: LOW Privacy Tables

These tables contain primarily aggregate or organizational data with minimal privacy concerns.

### Geographic Hierarchy Tables
- **Clusters:** Geographic units typically serving thousands of people
- **Regions:** Major administrative divisions
- **Subregions:** Intermediate geographic groupings
- **GroupOfClusters:** Administrative groupings
- **GroupOfRegions:** Continental or national groupings
- **NationalCommunities:** Country-level entities
- **ElectoralUnits:** Administrative jurisdictions

**Classification:** LOW
**Privacy Concerns:** Minimal at this geographic scale
**Restrictions:** None for standard reporting; combine with personal data carefully

---

## Section 5: MINIMAL Privacy Tables

These tables contain no personal information and have no privacy restrictions.

### 5.1 Curriculum and Educational Materials
- **StudyItems:** Curriculum structure and materials
- **LocalizedStudyItems:** Multi-language curriculum translations
- **ActivityStudyItems:** Links activities to curriculum (activity-level, not individual)

**Classification:** MINIMAL
**Privacy Concerns:** None
**Restrictions:** None

---

### 5.2 Dynamic List Management
- **Lists:** Custom report/view definitions
- **ListColumns:** Available column catalog
- **ListDisplayColumns:** Display configuration
- **ListFilterColumns:** Filter criteria
- **ListSortColumns:** Sort configuration

**Classification:** MINIMAL
**Privacy Concerns:** None (system configuration)
**Restrictions:** Ensure dynamically generated queries follow privacy rules from this matrix

**Important:** List configurations should be reviewed to ensure they don't generate queries that violate privacy guidelines (e.g., creating a list that displays names with activity participation).

---

### 5.3 System Administration
- **ApplicationConfigurations:** System settings and preferences
- **ApplicationHistories:** Application deployment history
- **DBScriptHistories:** Database schema migrations
- **LoadDataFiles:** Data import tracking

**Classification:** MINIMAL
**Privacy Concerns:** None
**Restrictions:** None

---

## Section 6: Data Protection Principles

### 6.1 Purpose Limitation
**Principle:** Personal data should only be collected and processed for specified, explicit, and legitimate purposes.

**Application:**
- Collect only data necessary for community-building activities
- Don't repurpose data without consent (e.g., don't use email addresses for marketing if collected for activity coordination)
- Document purpose for each data collection point

### 6.2 Data Minimization
**Principle:** Collect only what is necessary.

**Application:**
- Names and birthdates are necessary for children's class safety
- Religious affiliation is necessary for administrative eligibility
- Exact street addresses may NOT be necessary if locality is sufficient
- Consider whether each optional field truly serves a purpose

### 6.3 Consent and Transparency
**Principle:** Individuals should know what data is collected and how it's used.

**Application:**
- Provide clear privacy notice when collecting individual information
- Explain how data will be used in reporting and coordination
- Obtain consent for contact information storage and use
- Allow individuals to review their data on request

### 6.4 Data Security
**Principle:** Protect personal data from unauthorized access, loss, or destruction.

**Application:**
- Encrypt email addresses and phone numbers in storage and transit
- Use role-based access control (coordinators need access; general public does not)
- Implement audit logging for sensitive data access
- Regular security reviews and updates
- Secure database connections (SSL/TLS)
- Strong password policies for database users

### 6.5 Data Retention and Deletion
**Principle:** Don't keep personal data longer than necessary.

**Application:**
- Archive individuals who haven't participated in 5+ years
- Maintain historical statistical aggregates, not individual records indefinitely
- Implement data retention policies aligned with legal requirements
- Provide mechanism for individuals to request data deletion (right to be forgotten)
- IsArchived flag serves this purpose in Individuals table

### 6.6 Access Control
**Principle:** Limit access to personal data based on legitimate need.

**Application:**

| Role | Access Level | Justification |
|------|--------------|---------------|
| Public Reports | Aggregated statistics only | No need for personal identifiers |
| Regional Coordinators | Activity summaries, aggregate demographics | Coordination and planning |
| Cluster Coordinators | Names, contact info for their cluster only | Direct coordination needs |
| Children's Class Teachers | Names, ages of their students only | Educational and safety needs |
| Database Administrators | Full access with audit logging | System maintenance |

---

## Section 7: Compliance Considerations

### 7.1 GDPR (European Union)
If the system processes data of EU residents, GDPR applies:

**Key Requirements:**
- **Lawful basis:** Consent or legitimate interest
- **Right to access:** Individuals can request their data
- **Right to rectification:** Individuals can correct inaccurate data
- **Right to erasure:** "Right to be forgotten" (IsArchived implementation)
- **Right to data portability:** Provide data in machine-readable format
- **Privacy by design:** Build privacy into system architecture
- **Data Protection Officer:** May be required for large-scale processing

**SRP Implementation:**
- IsArchived flag supports right to erasure
- Audit fields (CreatedBy, LastUpdatedBy) support accountability
- Field-level encryption for contact information
- Export functionality for data portability

### 7.2 CCPA (California, USA)
If the system processes data of California residents:

**Key Requirements:**
- **Right to know:** What personal information is collected
- **Right to delete:** Request deletion of personal information
- **Right to opt-out:** Opt out of sale of personal information
- **Non-discrimination:** Cannot discriminate for exercising rights

**SRP Implementation:**
- System does not "sell" data (no commercial purpose)
- Archival mechanism supports deletion rights
- Transparency about data collection

### 7.3 Other Jurisdictions
Data protection laws vary globally. Consult local legal counsel when deploying in new jurisdictions.

**General Best Practice:** Follow the most stringent applicable law (typically GDPR) as a baseline.

---

## Section 8: Secure Query Development Guidelines

### 8.1 Query Design Principles

**Rule 1: Never SELECT personal identifiers for public reporting**
```sql
-- ❌ WRONG
SELECT [FirstName], [FamilyName], [Email] FROM ...

-- ✅ CORRECT
SELECT COUNT(*) AS [Total] FROM ...
```

**Rule 2: Always aggregate to safe levels**
```sql
-- ❌ WRONG: Individual-level data
SELECT [IndividualId], [ActivityId], [IndividualRole] FROM ...

-- ✅ CORRECT: Aggregated counts
SELECT [IndividualRole], COUNT(*) FROM ... GROUP BY [IndividualRole]
```

**Rule 3: Apply minimum thresholds to prevent small group identification**
```sql
-- ✅ CORRECT: Suppress small groups
SELECT [ClusterName], [ActivityCount]
FROM (
    SELECT C.[Name] AS [ClusterName], COUNT(*) AS [ActivityCount]
    FROM [Activities] A
    JOIN [Localities] L ON A.[LocalityId] = L.[Id]
    JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
    GROUP BY C.[Name]
) AS Counts
WHERE [ActivityCount] >= 5;  -- Minimum threshold
```

**Rule 4: Anonymize or pseudonymize when individual-level analysis is required**
```sql
-- ✅ CORRECT: Use ROW_NUMBER for anonymization
SELECT
    ROW_NUMBER() OVER (ORDER BY [BirthDate]) AS [AnonymousId],
    YEAR(GETDATE()) - [EstimatedYearOfBirthDate] AS [Age],
    [Gender]
FROM [Individuals]
WHERE [IsArchived] = 0;
-- Note: Still avoid exposing this externally without further aggregation
```

**Rule 5: Review Comments and free-text fields before ANY export**
```sql
-- ⚠️ CAUTION: Comments may contain names
SELECT [Comments] FROM [Activities];  -- Manual review required before use

-- ✅ SAFER: Use flags, not free text
SELECT [HasServiceProjects], COUNT(*) FROM [Activities] GROUP BY [HasServiceProjects];
```

### 8.2 Safe Aggregation Patterns

**Age Distribution (from Individuals)**
```sql
SELECT
    CASE
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] < 12 THEN 'Children (5-11)'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 12 AND 14 THEN 'Junior Youth (12-14)'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 15 AND 30 THEN 'Youth (15-30)'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 31 AND 60 THEN 'Adults (31-60)'
        ELSE 'Seniors (60+)'
    END AS [AgeGroup],
    COUNT(*) AS [Count]
FROM [Individuals]
WHERE [IsArchived] = 0
GROUP BY
    CASE
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] < 12 THEN 'Children (5-11)'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 12 AND 14 THEN 'Junior Youth (12-14)'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 15 AND 30 THEN 'Youth (15-30)'
        WHEN YEAR(GETDATE()) - [EstimatedYearOfBirthDate] BETWEEN 31 AND 60 THEN 'Adults (31-60)'
        ELSE 'Seniors (60+)'
    END;
```

**Activity Participation Rates (without identifying individuals)**
```sql
SELECT
    C.[Name] AS [ClusterName],
    COUNT(DISTINCT A.[Id]) AS [ActiveActivities],
    COALESCE(SUM(A.[Participants]), 0) AS [TotalParticipants],
    COALESCE(SUM(A.[BahaiParticipants]), 0) AS [TotalBahaiParticipants]
FROM [Clusters] C
LEFT JOIN [Localities] L ON C.[Id] = L.[ClusterId]
LEFT JOIN [Activities] A ON L.[Id] = A.[LocalityId] AND A.[IsCompleted] = 0
GROUP BY C.[Id], C.[Name]
HAVING COUNT(DISTINCT A.[Id]) > 0;  -- Only show clusters with activities
```

**Role Distribution (aggregated, no names)**
```sql
SELECT
    CASE ASI.[IndividualRole]
        WHEN 1 THEN 'Teacher/Primary Instructor'
        WHEN 2 THEN 'Co-Teacher'
        WHEN 3 THEN 'Tutor/Facilitator'
        WHEN 4 THEN 'Coordinator'
        WHEN 5 THEN 'Assistant/Helper'
        WHEN 7 THEN 'Participant/Student'
        ELSE 'Other'
    END AS [RoleType],
    COUNT(DISTINCT ASI.[IndividualId]) AS [UniqueIndividuals],
    COUNT(*) AS [TotalRoleInstances]
FROM [ActivityStudyItemIndividuals] ASI
WHERE ASI.[IsCurrent] = 1
GROUP BY ASI.[IndividualRole]
ORDER BY COUNT(DISTINCT ASI.[IndividualId]) DESC;
```

### 8.3 Dangerous Query Anti-Patterns

**❌ NEVER JOIN Individuals + Activities + IndividualRoles with names**
```sql
-- This exposes who participated in what activities
SELECT I.[FirstName], I.[FamilyName], A.[ActivityType], L.[Name]
FROM [Individuals] I
JOIN [ActivityStudyItemIndividuals] ASI ON I.[Id] = ASI.[IndividualId]
JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
JOIN [Localities] L ON A.[LocalityId] = L.[Id];
```

**❌ NEVER expose email/phone with any other identifying information**
```sql
-- This creates a contact list with personal details
SELECT I.[FirstName], I.[FamilyName], E.[Email], L.[Name] AS [Locality]
FROM [Individuals] I
JOIN [IndividualEmails] E ON I.[Id] = E.[IndividualId]
JOIN [Localities] L ON I.[LocalityId] = L.[Id];
```

**❌ NEVER show activity details for small localities**
```sql
-- This could identify specific children's classes in small villages
SELECT L.[Name], A.[ActivityType], A.[Participants]
FROM [Activities] A
JOIN [Localities] L ON A.[LocalityId] = L.[Id]
WHERE A.[Participants] < 5;  -- Dangerous for small groups
```

---

## Section 9: Privacy by Design Recommendations

### 9.1 Database Level

**Encryption:**
- Enable Transparent Data Encryption (TDE) for SQL Server database files
- Encrypt IndividualEmails.Email and IndividualPhones.PhoneNumber columns using column-level encryption
- Use SSL/TLS for all database connections

**Access Control:**
- Implement row-level security (RLS) for Individuals table based on user cluster assignment
- Create read-only database roles for reporting users
- Separate schemas for PII tables (e.g., `PII.Individuals`, `Public.Clusters`)

**Audit Logging:**
- Enable SQL Server audit for all SELECT queries on CRITICAL tables
- Log all data exports and report generations
- Review logs quarterly for unusual access patterns

### 9.2 Application Level

**User Interface:**
- Never display full email addresses or phone numbers (mask: j***@example.com, (555) ***-1234)
- Implement "need-to-know" access: teachers see only their students
- Require explicit justification for any individual-level data access

**Reporting Engine:**
- Automatically apply minimum thresholds (≥5 participants) to all generated reports
- Block queries that SELECT from CRITICAL fields without aggregation
- Provide pre-built "safe" report templates

**Data Export:**
- Require administrator approval for any export containing names or contact information
- Watermark exported files with user ID and timestamp
- Log all exports with full query text

### 9.3 Training and Governance

**User Training:**
- Train all database users on privacy principles from this document
- Provide query examples (safe vs. unsafe patterns)
- Annual privacy refresher for all users with access to personal data

**Data Governance:**
- Appoint a Data Protection Officer or Privacy Coordinator
- Quarterly review of access logs for CRITICAL tables
- Annual privacy impact assessment
- Document all data sharing with external parties

**Incident Response:**
- Define privacy breach response procedures
- Immediate notification protocols if unauthorized access occurs
- Regular security audits and penetration testing

---

## Section 10: Privacy Checklist for Queries and Reports

Before executing any query or publishing any report, verify:

- [ ] **No direct personal identifiers:** Query does not SELECT FirstName, FamilyName, Email, PhoneNumber, or BirthDate
- [ ] **Aggregation applied:** All personal data is aggregated (COUNT, AVG, SUM) or grouped into categories (age ranges, roles)
- [ ] **Minimum thresholds:** Results with < 5 individuals are suppressed or combined
- [ ] **Geographic safety:** Small localities (population < 500) are aggregated to cluster level
- [ ] **Comments reviewed:** Any Comments fields in results have been manually reviewed for personal information
- [ ] **Access justified:** User has legitimate need for this level of data detail
- [ ] **Approved for audience:** Report is appropriate for intended recipients (public, coordinators, administrators)
- [ ] **Audit logged:** Query execution and results export are logged for audit purposes
- [ ] **Consent verified:** If exposing any contact information, explicit consent was obtained
- [ ] **Legal compliance:** Query complies with GDPR, CCPA, or other applicable data protection laws

---

## Section 11: Fictitious Data Examples

All query examples in documentation should use **fictitious data**. This section provides safe example data for documentation purposes.

### Fictitious Individual Records
**Use these ONLY for examples, NEVER use real data:**

| FirstName | FamilyName | Email | Phone | Locality |
|-----------|------------|-------|-------|----------|
| Jane | Doe | jane.example@email.invalid | (555) 0100 | Example City |
| John | Smith | john.sample@email.invalid | (555) 0101 | Sample Town |
| Maria | Garcia | maria.test@email.invalid | (555) 0102 | Test Village |
| Ahmad | Hassan | ahmad.demo@email.invalid | (555) 0103 | Demo District |

**Safe domains:** Use `.invalid`, `.example`, `.test`, or `.localhost` for email examples.

**Safe phone numbers:** Use the (555) 01XX range, which is reserved for fictional use in North America.

---

## Section 12: Version History and Maintenance

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-18 | Initial privacy classification matrix | Claude Code |

### Review Schedule
- **Quarterly:** Review access logs for CRITICAL tables
- **Annually:** Full privacy impact assessment and matrix update
- **As needed:** Update when new tables are added or data handling practices change

### Contact
For questions about this privacy classification or to report potential privacy concerns, contact the Data Protection Officer or designated privacy coordinator for your region.

---

## Appendix A: Quick Reference Table

| Table Name | Privacy Level | Key Concerns | Query Restrictions |
|------------|---------------|--------------|-------------------|
| Individuals | CRITICAL | Names, birthdates, religious affiliation | Never expose names; aggregate only |
| IndividualEmails | CRITICAL | Email addresses | Never expose addresses; existence checks only |
| IndividualPhones | CRITICAL | Phone numbers | Never expose numbers; statistics only |
| ClusterAuxiliaryBoardMembers | CRITICAL | Official identities | Restricted access |
| Activities | HIGH | Comments may contain names | Review Comments; aggregate small groups |
| ActivityStudyItemIndividuals | HIGH | Links individuals to activities | Never link to names in reports |
| Localities | MODERATE | Small localities identify individuals | Aggregate if population < 500 |
| Subdivisions | MODERATE | Neighborhood data | Use only in large urban areas |
| Cycles | MODERATE | Statistical snapshots | Suppress if < 5 participants |
| Clusters, Regions, etc. | LOW | Geographic aggregates | Generally safe |
| StudyItems, Lists, etc. | MINIMAL | System/curriculum data | No restrictions |

---

**END OF DOCUMENT**

*This privacy classification matrix is a living document and should be updated as privacy laws evolve, new tables are added, or data handling practices change.*
