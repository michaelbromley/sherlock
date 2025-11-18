# IndividualEmails Table

## Overview
The `IndividualEmails` table stores email addresses for individuals tracked in the SRP database. This is a one-to-many relationship table, allowing each individual to have multiple email addresses (personal, work, alternative, etc.). The table supports flagging a primary email address for communication purposes and tracks when email addresses are added or modified.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id (bigint, NOT NULL, PRIMARY KEY, auto-increment)

The primary key serving as the unique identifier for each email record in the system. This auto-incrementing field ensures that every email address entry has a distinct reference point, even if the same email address is used by multiple individuals (though this should be rare). The Id is crucial for:
- Maintaining referential integrity across the database
- Tracking specific email records for audit purposes
- Supporting email-specific operations like primary designation changes
- Enabling efficient updates and deletions of specific email entries

Unlike the Email field itself, which represents the actual contact information, the Id provides the system-level identity that remains constant throughout the email record's lifecycle.

### Email (nvarchar(255), NULL)

The actual email address stored in standard internet format (user@domain.extension). This mandatory field uses Unicode character support (nvarchar) to accommodate international domain names and email addresses containing non-ASCII characters. The field supports:
- Standard ASCII email addresses (john.doe@example.com)
- International email addresses with Unicode characters
- Email addresses from various domains and providers
- Both personal and organizational email formats

**Storage and Format Considerations:**
- Maximum 255 characters accommodates even lengthy email addresses
- Email is stored exactly as entered, preserving user's formatting
- Comparisons should be case-insensitive (email@example.com = EMAIL@EXAMPLE.COM)
- Leading/trailing whitespace should be trimmed before storage
- Validation regex should be applied before insertion

**Business Significance:**
Email addresses serve as the primary digital communication channel for:
- Activity notifications and reminders
- Educational materials distribution
- Community announcements and updates
- Coordinatorcontact and follow-up
- Institute course information
- Conference and event registrations

The email field represents not just a technical contact method but a vital connection point for maintaining relationships and enabling participation in community-building activities.

### Order (smallint, NULL)

A numeric field that establishes the priority sequence for multiple email addresses belonging to the same individual. This ordering system enables a flexible hierarchy of contact preferences, where lower numbers indicate higher priority (e.g., Order=1 is the primary email, Order=2 is secondary, Order=3 is tertiary).

**Priority Hierarchy:**
The Order field implements a more nuanced approach than simple primary/secondary designation:
- **Order = 1**: Primary email address used for all official correspondence, automated notifications, and default communications
- **Order = 2**: Secondary backup email, used when primary fails or for specific purposes
- **Order = 3+**: Additional email addresses for specialized uses or historical reference

**Business Logic and Usage:**
This sequential ordering provides important functionality:
- Communication systems attempt contact in order sequence, trying Order=1 first, then Order=2 if the first fails
- User interfaces display emails sorted by Order, making priority immediately visible
- Multiple individuals in a system can be reached systematically without hard-coding "primary" flags
- The nullable nature allows for unordered email collections where priority hasn't been established
- When NULL, the email may be considered equal priority with others, or ordering may not be relevant

**Operational Considerations:**
The Order field requires thoughtful management:
- Each individual should have at most ONE email with Order=1 (primary position)
- When promoting an email to Order=1, existing Order=1 should be demoted to Order=2
- Deleting an Order=1 email should trigger promotion of Order=2 to primary position
- UI should provide easy mechanisms for reordering email priorities
- Gap tolerance in numbering (1, 2, 5 instead of 1, 2, 3) allows for future insertions
- Changes to Order values should be audit-logged for accountability

**Implementation Notes:**
This approach offers advantages over boolean IsPrimary flags:
- Natural support for more than two levels of priority without schema changes
- Explicit sequence when multiple fallback options exist
- Clearer semantics when displaying ordered lists of contact methods
- Compatibility with queue/retry logic in communication systems

The Order field represents a mature approach to contact management that accommodates real-world complexity while maintaining clear priority structures essential for reliable community coordination.

### IndividualId (bigint, NULL)

The mandatory foreign key that links this email address to a specific individual in the Individuals table. This relationship field establishes the fundamental connection between contact information and people, enabling:
- Association of multiple email addresses with one individual
- Lookup of all emails for a given person
- Validation that emails belong to known, active individuals
- Geographic and demographic context through the individual's profile
- Participation tracking via the individual's activity involvement

**Referential Integrity:**
This field enforces that:
- Every email must belong to exactly one individual
- Emails cannot exist without a valid parent individual record
- Deleting an individual typically cascades to delete their email addresses
- Archiving an individual doesn't necessarily delete their emails

**Usage Patterns:**
The IndividualId enables critical queries:
- Finding all contact methods for an individual
- Identifying individuals by their email address
- Building comprehensive communication lists
- Linking email activity to participation patterns
- Understanding contact information coverage across localities

### CreatedTimestamp (datetime, NULL)

Records the exact moment when this email address was added to the database. This audit field captures when the contact information became available in the system, which may differ from when the individual began participating in activities. The timestamp serves several purposes:
- Tracking temporal patterns in data collection
- Understanding when contact information becomes available
- Supporting data quality investigations
- Enabling chronological sorting of email addresses
- Identifying recently added contact methods

**Use Cases:**
- Determining which emails are newer (for duplicate resolution)
- Analyzing data entry timing patterns
- Supporting synchronization with external systems
- Providing context for data quality issues
- Tracking growth in contactable individuals

This field helps answer questions like "When did we obtain email contact for this person?" and "How recently was this contact information added?"

### CreatedBy (uniqueidentifier, NULL)

The GUID identifier of the user account that created this email record. This audit field maintains accountability for data entry and helps track who is collecting and entering contact information. The field enables:
- Identifying which coordinators are gathering contact information
- Understanding data entry patterns and sources
- Training needs identification for data quality issues
- Authorization verification for data access
- User activity tracking and analysis

**Scenarios Captured:**
- Coordinator entering email during individual registration
- Administrator importing emails from external data source
- Individual self-registering through online portal
- Data migration scripts creating historical records
- API integrations from third-party systems

The CreatedBy field is particularly valuable for data quality investigations, helping administrators trace back to the source of any questionable or incorrect information.

### LastUpdatedTimestamp (datetime, NULL)

Captures the most recent moment when any aspect of this email record was modified. This field automatically updates whenever changes occur, providing essential information for:
- Tracking data freshness and currency
- Identifying recently modified contact information
- Supporting incremental synchronization processes
- Understanding contact information volatility
- Monitoring data maintenance activities

**Triggers for Updates:**
- Email address correction or change
- Primary designation toggle
- Data quality improvements
- Integration updates from external systems
- Administrative corrections or cleanup

**Analytical Value:**
- Identifying stale contact information
- Understanding update frequency patterns
- Supporting data governance requirements
- Enabling change detection for synchronization
- Tracking data maintenance effort

This timestamp is crucial for systems that need to identify changes since last synchronization or for understanding how actively contact information is being maintained.

### LastUpdatedBy (uniqueidentifier, NULL)

Records the GUID of the user who most recently modified this email record. Together with LastUpdatedTimestamp, this completes the audit trail for email address maintenance. This field tracks:
- Who is maintaining and updating contact information
- Patterns in data maintenance across different users
- Authorization for contact information changes
- Quality control and accountability
- User activity in data stewardship

**Common Scenarios:**
- Coordinator updating email after individual reports change
- Administrator correcting data quality issues
- Automated processes updating from external sources
- Individual self-service updates through portals
- Bulk update operations during data cleanup

**Governance Value:**
The combination of created and updated user tracking enables:
- Full lifecycle visibility for each email record
- Accountability for all changes to contact information
- Identifying training needs for specific users
- Supporting compliance with data protection regulations
- Investigating the source of data quality issues

These audit fields are essential for maintaining data integrity and supporting organizational accountability for personal information management.

## Key Relationships

1. **Individuals** (IndividualId → Individuals.Id)
   - Each email belongs to exactly one individual
   - Individuals can have multiple emails
   - One-to-many relationship from Individuals to IndividualEmails

## Primary Email Designation

### IsPrimary Flag
- **TRUE**: This is the primary/preferred email address
  - Used for official communications
  - Displayed in default views and reports
  - Only ONE email per individual should be primary
  - Used for automated notifications and correspondence

- **FALSE**: Alternative or secondary email
  - Additional contact method
  - Backup communication channel
  - May be for specific purposes (work vs. personal)

### Business Logic
- Each individual should have at most one primary email
- When setting a new primary email, previous primary should be updated to FALSE
- If individual has only one email, it should be marked as primary
- Primary email is used in most communication scenarios

## Email Format and Validation

### Standard Format
- Must follow email pattern: user@domain.extension
- Case-insensitive for lookups and comparisons
- Maximum 255 characters
- Should be validated before insertion

### Common Use Cases
- **Personal Email**: gmail.com, yahoo.com, outlook.com, etc.
- **Work Email**: Organization domain emails
- **Regional Email**: Regional Bahai institution emails
- **Alternative**: Backup or family shared emails

## Common Query Patterns

### Get Primary Email for Individual
```sql
SELECT
    I.[FirstName],
    I.[FamilyName],
    IE.[Email]
FROM [Individuals] I
INNER JOIN [IndividualEmails] IE ON I.[Id] = IE.[IndividualId]
WHERE I.[Id] = @IndividualId
    AND IE.[IsPrimary] = 1
```

### Get All Emails for Individual
```sql
SELECT
    [Email],
    [IsPrimary],
    [CreatedTimestamp]
FROM [IndividualEmails]
WHERE [IndividualId] = @IndividualId
ORDER BY [IsPrimary] DESC, [CreatedTimestamp]
```

### Find Individual by Email
```sql
SELECT
    I.[FirstName],
    I.[FamilyName],
    I.[IsBahai],
    L.[Name] AS Locality
FROM [IndividualEmails] IE
INNER JOIN [Individuals] I ON IE.[IndividualId] = I.[Id]
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
WHERE IE.[Email] = @EmailAddress
    AND I.[IsArchived] = 0
```

### Individuals with Email Addresses
```sql
SELECT
    I.[FirstName],
    I.[FamilyName],
    IE.[Email],
    IE.[IsPrimary]
FROM [Individuals] I
INNER JOIN [IndividualEmails] IE ON I.[Id] = IE.[IndividualId]
WHERE I.[IsArchived] = 0
    AND I.[LocalityId] = @LocalityId
ORDER BY I.[FamilyName], I.[FirstName], IE.[IsPrimary] DESC
```

### Individuals Without Email
```sql
SELECT
    I.[FirstName],
    I.[FamilyName],
    L.[Name] AS Locality
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
LEFT JOIN [IndividualEmails] IE ON I.[Id] = IE.[IndividualId]
WHERE I.[IsArchived] = 0
    AND IE.[Id] IS NULL
```

### Duplicate Email Detection
```sql
SELECT
    [Email],
    COUNT(DISTINCT [IndividualId]) AS IndividualCount
FROM [IndividualEmails]
GROUP BY [Email]
HAVING COUNT(DISTINCT [IndividualId]) > 1
```

## Business Rules and Constraints

1. **Required Fields**: Email and IndividualId must be provided
2. **Email Format**: Must be valid email format
3. **One Primary**: Only one primary email per individual
4. **Unique Emails**: Same email should not belong to multiple individuals (business rule, not enforced)
5. **Active Individuals**: Emails typically associated with active (non-archived) individuals
6. **Case Handling**: Email addresses stored as provided but compared case-insensitively

## Data Quality Considerations

### Email Validation
- Validate format before insertion (regex pattern)
- Check for common typos (.con instead of .com)
- Verify domain exists where possible
- Prevent obviously invalid entries

### Duplicate Management
- Email should uniquely identify individuals in most cases
- Family members may share email (children using parent email)
- Married couples might share email address
- Document shared emails in Individual Comments field

### Primary Email Management
- Ensure only one primary email per individual
- When adding new primary, update previous primary
- If deleting primary email, designate new primary
- Maintain integrity when modifying

## Usage Patterns

### Communication
- Mass email campaigns to cluster/region
- Activity notifications and reminders
- Institute course information
- Community announcements
- Conference registrations

### Identity Verification
- Login credentials for web portals
- Password reset functionality
- Account verification
- Correspondence tracking

### Contact Management
- Primary channel for reaching individuals
- Backup contact methods
- Emergency communications
- Administrative correspondence

## Performance Considerations

### Indexing
- IndividualId for fast individual lookup
- Email for search by email address
- IsPrimary for filtering primary emails
- Composite index on (IndividualId, IsPrimary)

### Query Optimization
- Use inner join when email is required
- Use left join when email is optional
- Filter by IsPrimary when only primary needed
- Consider caching primary emails for active users

## Privacy and Security

### Data Protection
- Email addresses are personally identifiable information (PII)
- Require appropriate access controls
- Secure transmission (HTTPS, encrypted email)
- Comply with privacy regulations (GDPR, etc.)

### Communication Consent
- Track opt-in/opt-out for communications
- Respect unsubscribe requests
- Document consent for email usage
- Maintain audit trail of communications

## Integration Considerations

### Email Systems
- Integration with email service providers
- Automated notification systems
- Mailing list management
- Bounce handling and validation

### External Systems
- Institute registration systems
- Conference registration platforms
- Online giving/contribution systems
- Community portals and websites

## Notes for Developers

- Always validate email format before insertion
- Enforce one primary email per individual in business logic
- Handle case-insensitive email comparisons
- Provide UI for managing multiple emails
- Show primary email prominently
- Allow easy primary email designation
- Consider email verification workflow
- Handle bounced emails and invalid addresses

## Audit Trail

### Timestamp Fields
- **CreatedTimestamp**: When email was added
- **CreatedBy**: Who added the email
- **LastUpdatedTimestamp**: When email was modified
- **LastUpdatedBy**: Who modified the email

### Use Cases
- Track when email addresses change
- Audit contact information updates
- Identify data quality issues
- Support compliance requirements

## Privacy and Security

**CRITICAL PRIVACY CLASSIFICATION** ⚠️

This table contains direct contact information (email addresses) that constitutes personally identifiable information (PII) requiring the highest level of privacy protection.

### Privacy Classification

**Reference:** See `reports/Privacy_and_Security_Classification_Matrix.md` for comprehensive privacy guidance across all tables.

This table is classified as **CRITICAL** for privacy, meaning:
- Contains direct personal contact information that enables communication with individuals
- Email addresses are legally protected personal data under GDPR, CCPA, and similar regulations
- Requires encryption, access controls, and explicit consent
- **NEVER** expose email addresses in public reports or unauthorized contexts
- Unauthorized disclosure could lead to spam, phishing, harassment, and privacy violations

### Field-Level Sensitivity

| Field Name | Sensitivity Level | Privacy Concerns |
|------------|------------------|------------------|
| **Email** | **CRITICAL** | Direct contact information - never expose without authorization |
| **IndividualId** | **CRITICAL** | Links to personal identity - never expose externally |
| Id | MODERATE | Junction table identifier - internal use only |
| IsPrimary | LOW | Preference flag - safe when separated from email address |
| Audit fields | LOW | System metadata - no privacy concerns |

### Prohibited Query Patterns

**❌ NEVER DO THIS - Exposing Email Addresses:**
```sql
-- This violates privacy by creating an unauthorized contact list
SELECT
    I.[FirstName],
    I.[FamilyName],
    E.[Email],
    L.[Name] AS [Locality]
FROM [IndividualEmails] E
INNER JOIN [Individuals] I ON E.[IndividualId] = I.[Id]
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
WHERE E.[IsPrimary] = 1;
```

**❌ NEVER DO THIS - Email Export Without Authorization:**
```sql
-- This creates a mass mailing list without proper authorization
SELECT [Email]
FROM [IndividualEmails]
WHERE [IsPrimary] = 1;
```

**❌ NEVER DO THIS - Linking Emails to Activity Participation:**
```sql
-- This reveals who participates in what activities with their contact info
SELECT
    I.[FirstName],
    I.[FamilyName],
    E.[Email],
    A.[ActivityType],
    L.[Name] AS [Locality]
FROM [IndividualEmails] E
INNER JOIN [Individuals] I ON E.[IndividualId] = I.[Id]
INNER JOIN [ActivityStudyItemIndividuals] ASI ON I.[Id] = ASI.[IndividualId]
INNER JOIN [Activities] A ON ASI.[ActivityId] = A.[Id]
INNER JOIN [Localities] L ON A.[LocalityId] = L.[Id];
```

### Secure Query Patterns

**✅ CORRECT - Email Availability Statistics (No Actual Addresses):**
```sql
-- Safe: Reports percentage with email without exposing addresses
SELECT
    C.[Name] AS [ClusterName],
    COUNT(DISTINCT I.[Id]) AS [TotalIndividuals],
    COUNT(DISTINCT E.[IndividualId]) AS [WithEmail],
    CAST(COUNT(DISTINCT E.[IndividualId]) * 100.0 /
         NULLIF(COUNT(DISTINCT I.[Id]), 0) AS DECIMAL(5,2)) AS [PercentWithEmail]
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
LEFT JOIN [IndividualEmails] E ON I.[Id] = E.[IndividualId]
WHERE I.[IsArchived] = 0
GROUP BY C.[Name]
HAVING COUNT(DISTINCT I.[Id]) >= 10  -- Minimum threshold
ORDER BY C.[Name];
```

**✅ CORRECT - Primary Email Designation Statistics:**
```sql
-- Safe: Analyzes primary email patterns without exposing addresses
SELECT
    CASE WHEN [IsPrimary] = 1 THEN 'Primary' ELSE 'Secondary' END AS [EmailType],
    COUNT(*) AS [Count],
    CAST(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS DECIMAL(5,2)) AS [Percentage]
FROM [IndividualEmails]
GROUP BY [IsPrimary];
```

### Data Protection Requirements

**Explicit Consent Required:**
- **NEVER** collect email addresses without explicit consent from the individual
- Provide clear privacy notice explaining how email will be used (coordination, announcements, communication)
- Allow individuals to review, correct, or delete their email addresses on request
- Obtain separate consent for different uses (e.g., activity coordination vs. newsletters)
- Document consent mechanism (checkbox, signed form, verbal with date/witness)

**Security Measures:**
- **Encryption:** Implement column-level encryption for the Email field at rest
- **Secure Transit:** Always use SSL/TLS for database connections and email transmission
- **Access Control:** Limit access to email addresses based on legitimate need:
  - **Cluster coordinators:** Emails for individuals in their cluster only
  - **Teachers:** Emails for their students and parents only
  - **Communication staff:** Emails for authorized communications only
  - **Database administrators:** Full access with comprehensive audit logging
- **Audit Logging:** Log all queries that retrieve email addresses (not just SELECT * queries)
- **Email Masking:** In user interfaces, mask email addresses (e.g., j***@example.com) unless user has authorization to see full address

**Usage Restrictions:**
- **Authorized Purposes Only:** Use emails ONLY for purposes consented to (activity coordination, announcements, safety communications)
- **No Third-Party Sharing:** Never share email addresses with third parties without explicit consent
- **No Commercial Use:** Never use for commercial marketing or advertising
- **Opt-Out Mechanism:** Provide easy unsubscribe/opt-out for email communications
- **Spam Prevention:** Implement rate limiting and abuse detection for email sending

**Data Retention:**
- Retain email addresses only as long as the individual remains active in community activities
- When individual is archived (IsArchived = 1 in Individuals table), consider deleting or anonymizing email
- Comply with data retention policies and legal requirements (GDPR, CCPA)
- Allow individuals to request email deletion ("right to be forgotten")

### Compliance Considerations

**GDPR (European Union):**
- Email addresses are personal data requiring lawful basis (consent or legitimate interest)
- **Right to access:** Individuals can request confirmation of their email on file
- **Right to rectification:** Individuals can update incorrect email addresses
- **Right to erasure:** Individuals can request email deletion
- **Data portability:** Provide email in machine-readable format on request
- **Breach notification:** Notify authorities within 72 hours if email addresses are exposed
- **Purpose limitation:** Use emails only for stated purposes; don't repurpose without new consent

**CCPA (California, USA):**
- **Right to know:** Disclose what email addresses are collected and how they're used
- **Right to delete:** Honor requests to delete email addresses
- **Right to opt-out:** Allow opting out of email communications (not "sale" as this system doesn't sell data)
- **Non-discrimination:** Cannot deny services for exercising privacy rights

**CAN-SPAM Act (USA - for email communications):**
- Include physical address in all mass emails
- Provide clear opt-out mechanism in every email
- Honor opt-out requests within 10 business days
- Don't use deceptive subject lines or "from" addresses
- Identify messages as advertisements when applicable

### Email Security Best Practices

**Validation:**
- Validate email format using proper regex or library (not just checking for @)
- Verify domain exists (MX record lookup) before accepting
- Send confirmation email with verification link to confirm address is valid and controlled by individual
- Reject disposable/temporary email addresses for primary contact

**Phishing Prevention:**
- Educate users about phishing risks and how to verify legitimate emails
- Use SPF, DKIM, and DMARC records to prevent email spoofing
- Never request sensitive information (passwords, credit cards) via email
- Include recognizable branding and contact information in legitimate emails

**Email Hygiene:**
- Regularly validate email addresses (bounce detection, engagement tracking)
- Remove invalid, bouncing, or undeliverable addresses promptly
- Update email addresses when individuals report changes
- Merge duplicate email addresses (same email for multiple individuals may indicate data quality issue)

### Privacy Checklist for Email Operations

Before any operation involving email addresses, verify:

- [ ] Explicit consent obtained from individual for this specific use
- [ ] User has authorization to access email addresses for this purpose
- [ ] Email addresses will be encrypted in transit (SSL/TLS)
- [ ] Email addresses will NOT be exposed in logs, error messages, or public interfaces
- [ ] Bulk email sending includes opt-out mechanism and complies with CAN-SPAM
- [ ] Query results will NOT be exported to unauthorized systems or users
- [ ] Access will be logged for audit purposes
- [ ] Operation complies with GDPR, CCPA, and other applicable data protection laws
- [ ] Privacy notice has been provided explaining how emails will be used
- [ ] Individuals have been informed of their rights (access, rectification, deletion)

### Incident Response

If email addresses are accidentally exposed or breached:
1. **Immediately** revoke compromised credentials and lock affected accounts
2. **Notify** the Data Protection Officer or designated privacy coordinator within 1 hour
3. **Assess** scope: how many email addresses, what other data, who had access
4. **Contain** the breach: delete unauthorized copies, revoke access, disable compromised systems
5. **Document** incident with full timeline, affected records, and actions taken
6. **Notify** affected individuals if required by law (GDPR: 72 hours; CCPA: reasonable time)
7. **Report** to authorities if legally required (data protection authorities under GDPR)
8. **Remediate** the vulnerability and implement controls to prevent recurrence
9. **Review** access controls, encryption, and security measures across the system

**Potential Harms from Email Exposure:**
- Spam and unwanted marketing
- Phishing and social engineering attacks
- Identity theft if combined with other personal data
- Harassment or unwanted contact
- Reputational harm to organization and individuals

### Examples with Fictitious Data Only

**Important:** All documentation, examples, and testing should use ONLY fictitious email addresses:

**Safe Email Domains:**
- `.invalid` - Reserved for non-existent domains (preferred)
- `.example` - Reserved for examples
- `.test` - Reserved for testing
- `.localhost` - Local testing only

**Example Fictitious Emails:**
- jane.example@email.invalid
- john.sample@email.invalid
- maria.test@email.invalid
- ahmad.demo@email.invalid

**NEVER** use real email addresses in:
- Documentation or training materials
- Test databases or development environments
- Example queries or code samples
- Screenshots or demonstrations
- Log files or error messages

Using real email addresses in examples could:
- Accidentally send emails to real people
- Expose personal information in public documentation
- Violate privacy policies and regulations
- Create security vulnerabilities

## Special Considerations

### Family Email Addresses
- Children often use parent email
- Families may share one email account
- Handle gracefully in UI and reports
- Document sharing in comments if needed

### Email Changes
- People change email addresses over time
- Keep historical emails or update existing record?
- Consider adding timestamp for when email became invalid
- Update primary designation when email changes

### Bulk Updates
- Importing email addresses from spreadsheets
- Validation of bulk data
- Handling duplicates and conflicts
- Primary email designation in bulk operations

## Best Practices

1. **Validation**: Always validate email format and domain
2. **Primary Management**: Ensure one and only one primary email
3. **Privacy**: Protect email addresses, require authentication
4. **Uniqueness**: Typically one email = one individual
5. **Cleanup**: Regularly validate and clean email list
6. **Communication**: Use primary email for official communications
7. **Backup**: Maintain alternative emails when available
8. **Verification**: Consider email verification workflow for new addresses
