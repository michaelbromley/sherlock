# IndividualEmails Table

## Overview
The `IndividualEmails` table stores email addresses for individuals tracked in the SRP database. This is a one-to-many relationship table, allowing each individual to have multiple email addresses (personal, work, alternative, etc.). The table supports flagging a primary email address for communication purposes and tracks when email addresses are added or modified.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each email record

### Email

Email address in standard format (user@domain.com)

### IsPrimary

Flag indicating if this is the primary email for the individual

### IndividualId

Foreign key to Individuals table

### CreatedTimestamp

When the email record was created

### CreatedBy

User ID who created the record

### LastUpdatedTimestamp

When the record was last modified

### LastUpdatedBy

User ID who last modified the record

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
