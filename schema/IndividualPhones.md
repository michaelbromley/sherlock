# IndividualPhones Table

## Overview
The `IndividualPhones` table stores phone numbers for individuals in the SRP database. This one-to-many relationship allows each individual to have multiple phone numbers (mobile, home, work, etc.). The table supports categorizing phone types and designating a primary phone number for contact purposes.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id

Primary key, unique identifier for each phone record

### PhoneNumber

Phone number (may include country code, area code, extensions)

### PhoneType

Type of phone: 0=Mobile, 1=Home, 2=Work, 3=Other

### IsPrimary

Flag indicating if this is the primary phone for the individual

### IndividualId

Foreign key to Individuals table

### CreatedTimestamp

When the phone record was created

### CreatedBy

User ID who created the record

### LastUpdatedTimestamp

When the record was last modified

### LastUpdatedBy

User ID who last modified the record

## Key Relationships

1. **Individuals** (IndividualId → Individuals.Id)
   - Each phone belongs to exactly one individual
   - Individuals can have multiple phones
   - One-to-many relationship from Individuals to IndividualPhones

## Phone Type Classification

### PhoneType Values
- **0 = Mobile**: Cell phone or mobile number
  - Most common type for direct contact
  - Preferred for SMS messaging
  - Usually personal device
  - Best for emergency contact

- **1 = Home**: Residential landline
  - Fixed home phone number
  - May be shared by family
  - Traditional contact method
  - Less common in modern contexts

- **2 = Work**: Business or office number
  - Professional contact point
  - May have extensions
  - Business hours availability
  - Organizational phone

- **3 = Other**: Alternative phone types
  - Relative's phone
  - Neighbor's phone
  - Backup contact
  - Special circumstances

### Usage Patterns by Type
- **Mobile**: Primary contact, SMS capability, real-time reach
- **Home**: Family contact, evening/weekend calls
- **Work**: Professional communication, business hours
- **Other**: Alternative/emergency contact only

## Primary Phone Designation

### IsPrimary Flag
- **TRUE**: Primary/preferred phone number
  - Default for communications
  - Displayed in main views
  - Used for notifications and calls
  - Only ONE phone per individual should be primary

- **FALSE**: Alternative or secondary phone
  - Additional contact method
  - Backup communication
  - Specific-purpose contact (work vs. personal)

### Primary Phone Selection
Typically prioritize in this order when multiple phones exist:
1. Mobile (most direct and personal)
2. Home (reliable, family access)
3. Work (business context)
4. Other (last resort)

## Phone Number Format

### Storage Format
- VARCHAR(50) allows flexible formatting
- May include:
  - Country code: +1, +44, etc.
  - Area/city code: (555), 555-, etc.
  - Local number: 123-4567
  - Extension: ext. 123, x123
  - Special characters: +, -, (, ), spaces

### Common Formats
- **International**: +1-555-123-4567
- **National**: (555) 123-4567
- **Simple**: 5551234567
- **With Extension**: 555-123-4567 x123

### Format Considerations
- Store as entered by user for local customs
- Standardize for comparison and searching
- Strip formatting for international dialing
- Preserve display format for user interface

## Common Query Patterns

### Get Primary Phone for Individual
```sql
SELECT
    I.[FirstName],
    I.[FamilyName],
    IP.[PhoneNumber],
    IP.[PhoneType]
FROM [Individuals] I
INNER JOIN [IndividualPhones] IP ON I.[Id] = IP.[IndividualId]
WHERE I.[Id] = @IndividualId
    AND IP.[IsPrimary] = 1
```

### Get All Phones for Individual
```sql
SELECT
    [PhoneNumber],
    [PhoneType],
    CASE [PhoneType]
        WHEN 0 THEN 'Mobile'
        WHEN 1 THEN 'Home'
        WHEN 2 THEN 'Work'
        WHEN 3 THEN 'Other'
    END AS PhoneTypeDescription,
    [IsPrimary]
FROM [IndividualPhones]
WHERE [IndividualId] = @IndividualId
ORDER BY [IsPrimary] DESC, [PhoneType]
```

### Find Individual by Phone Number
```sql
SELECT
    I.[FirstName],
    I.[FamilyName],
    IP.[PhoneNumber],
    IP.[PhoneType],
    L.[Name] AS Locality
FROM [IndividualPhones] IP
INNER JOIN [Individuals] I ON IP.[IndividualId] = I.[Id]
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
WHERE IP.[PhoneNumber] LIKE '%' + @PhoneDigits + '%'
    AND I.[IsArchived] = 0
```

### Individuals with Mobile Numbers
```sql
SELECT
    I.[FirstName],
    I.[FamilyName],
    IP.[PhoneNumber]
FROM [Individuals] I
INNER JOIN [IndividualPhones] IP ON I.[Id] = IP.[IndividualId]
WHERE I.[IsArchived] = 0
    AND IP.[PhoneType] = 0  -- Mobile
    AND I.[LocalityId] = @LocalityId
ORDER BY I.[FamilyName], I.[FirstName]
```

### Individuals Without Phone
```sql
SELECT
    I.[FirstName],
    I.[FamilyName],
    L.[Name] AS Locality
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
LEFT JOIN [IndividualPhones] IP ON I.[Id] = IP.[IndividualId]
WHERE I.[IsArchived] = 0
    AND IP.[Id] IS NULL
```

### Contact List with Preferred Methods
```sql
SELECT
    I.[FirstName] + ' ' + I.[FamilyName] AS FullName,
    IPMobile.[PhoneNumber] AS MobilePhone,
    IPHome.[PhoneNumber] AS HomePhone,
    IE.[Email] AS Email
FROM [Individuals] I
LEFT JOIN [IndividualPhones] IPMobile
    ON I.[Id] = IPMobile.[IndividualId]
    AND IPMobile.[PhoneType] = 0
    AND IPMobile.[IsPrimary] = 1
LEFT JOIN [IndividualPhones] IPHome
    ON I.[Id] = IPHome.[IndividualId]
    AND IPHome.[PhoneType] = 1
LEFT JOIN [IndividualEmails] IE
    ON I.[Id] = IE.[IndividualId]
    AND IE.[IsPrimary] = 1
WHERE I.[IsArchived] = 0
ORDER BY I.[FamilyName], I.[FirstName]
```

## Business Rules and Constraints

1. **Required Fields**: PhoneNumber, PhoneType, and IndividualId must be provided
2. **One Primary**: Only one primary phone per individual
3. **Valid Phone Type**: PhoneType must be 0, 1, 2, or 3
4. **Format Validation**: Phone should be reasonable format (digits, some punctuation)
5. **Unique Phones**: Same phone should not belong to multiple individuals (recommended, not enforced)
6. **Active Individuals**: Phones typically associated with active individuals

## Data Quality Considerations

### Phone Validation
- Validate format appropriate to region/country
- Check for reasonable length (7-15 digits typically)
- Verify country code if international
- Prevent obviously invalid entries (all zeros, repeated patterns)

### Duplicate Management
- Family members may legitimately share phone (home phone)
- Children using parent's mobile
- Document shared phones in Individual Comments
- Use PhoneType to distinguish context

### Primary Phone Management
- Ensure only one primary phone per individual
- When adding new primary, update previous primary to FALSE
- If deleting primary phone, designate new primary
- Mobile preferred as primary when available

## Usage Patterns

### Communication Methods
- **Voice Calls**: Direct phone communication
- **SMS/Text**: Mobile numbers for messaging
- **WhatsApp/Messaging**: Mobile numbers for app-based communication
- **Emergency Contact**: Primary phone for urgent matters

### Contact Strategies
- **Mobile First**: Most reliable for real-time contact
- **Home Second**: Evening/weekend contact
- **Work Last**: Business hours only
- **Multiple Attempts**: Try different numbers if primary fails

### Verification and Updates
- Verify phone numbers periodically
- Update when numbers change
- Remove disconnected numbers
- Confirm primary designation regularly

## Performance Considerations

### Indexing
- IndividualId for fast individual lookup
- PhoneNumber for search by number
- PhoneType for filtering by type
- Composite index on (IndividualId, IsPrimary)

### Query Optimization
- Use INNER JOIN when phone is required
- Use LEFT JOIN when phone is optional
- Filter by PhoneType when specific type needed
- Consider caching primary phones for active contacts

## Privacy and Security

### Data Protection
- Phone numbers are personally identifiable information (PII)
- Require appropriate access controls
- Secure storage and transmission
- Comply with privacy regulations

### Communication Consent
- Track opt-in for SMS communications
- Respect do-not-call preferences
- Document consent for phone contact
- Maintain communication logs

## Integration Considerations

### SMS Systems
- Integration with SMS gateways
- Automated notifications via text
- Two-way messaging capabilities
- Delivery confirmation tracking

### Voice Systems
- VoIP integration
- Automated calling systems
- Voicemail notifications
- Conference call systems

### Mobile Apps
- Click-to-call functionality
- WhatsApp/Telegram integration
- Mobile number verification
- Push notifications

## Notes for Developers

- Validate phone format before insertion
- Enforce one primary phone per individual in business logic
- Normalize phone numbers for comparison (strip formatting)
- Provide UI for managing multiple phones
- Show primary phone prominently
- Allow easy primary phone designation
- Consider phone verification workflow (SMS code)
- Handle international phone formats
- Support various formatting conventions

## Audit Trail

### Timestamp Fields
- **CreatedTimestamp**: When phone was added
- **CreatedBy**: Who added the phone
- **LastUpdatedTimestamp**: When phone was modified
- **LastUpdatedBy**: Who modified the phone

### Use Cases
- Track when phone numbers change
- Audit contact information updates
- Identify data quality issues
- Support compliance requirements

## Special Considerations

### International Phone Numbers
- Country code handling (+1, +44, etc.)
- Different formatting conventions
- Variable length numbers
- International dialing prefixes

### Mobile Portability
- Phone numbers can change carriers
- Number may change when moving
- Keep historical numbers or update?
- Verify current validity periodically

### Family Shared Numbers
- Children using parent phone
- Home phone shared by family
- Handle gracefully in communications
- Document sharing if needed

### Extensions and Special Numbers
- Work phones with extensions
- Toll-free numbers
- Service numbers (SMS only)
- Virtual/VoIP numbers

## Best Practices

1. **Validation**: Validate phone format for target region
2. **Primary Management**: Ensure one and only one primary phone
3. **Type Selection**: Use appropriate phone type classification
4. **Privacy**: Protect phone numbers, require authentication
5. **Verification**: Consider SMS verification for mobile numbers
6. **Cleanup**: Regularly validate and clean phone list
7. **Formatting**: Store with formatting, normalize for search
8. **Multiple Numbers**: Encourage multiple contact methods
9. **Updates**: Make it easy to update phone numbers
10. **International**: Support international formats when needed
