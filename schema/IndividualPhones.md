# IndividualPhones Table

## Overview
The `IndividualPhones` table stores phone numbers for individuals in the SRP database. This one-to-many relationship allows each individual to have multiple phone numbers (mobile, home, work, etc.). The table supports categorizing phone types and designating a primary phone number for contact purposes.

## Table Structure

The following sections describe in detail the meaning, purpose and uses for each of the fields in this table. Each subsection heading within this section maps to a field, and each subsection body describes that field in more detail.

### Id (bigint, NOT NULL, PRIMARY KEY, auto-increment)

The primary key serving as the unique identifier for each phone number record in the system. This auto-incrementing field ensures that every phone entry has a distinct reference point, supporting scenarios where:
- The same phone number might be recorded for multiple individuals (family sharing)
- An individual might have the same number recorded multiple times historically
- Phone-specific operations need a stable reference point for updates and deletions

The Id provides the system-level identity that remains constant throughout the phone record's lifecycle, distinct from the phone number itself which represents the actual contact information. This separation is crucial for maintaining referential integrity, tracking phone record changes over time, and supporting audit trails for phone number modifications.

### Phone (nvarchar(50), NULL)

The actual telephone number stored in a flexible format to accommodate international variations in phone number structures. This nullable field uses Unicode support (nvarchar) to handle phone numbers from any country, including those with special characters or non-ASCII digits. The field accommodates:

**International Numbers:**
- Country codes (+1, +33, +234, etc.)
- International dialing prefixes (00, 011)
- Regional area codes
- Local numbers of varying lengths

**Special Formatting:**
- Extensions (ext. 123, x456)
- Parentheses for area codes: (555) 123-4567
- Hyphens and spaces: 555-123-4567 or 555 123 4567
- Dots as separators: 555.123.4567
- Special characters for pauses or wait instructions

**Storage Considerations:**
- 50-character limit accommodates even complex international numbers with extensions
- Numbers stored as entered, preserving user's formatting preference
- No enforcement of specific format to support international diversity
- Leading/trailing whitespace should be trimmed
- Consider stripping formatting for comparison operations

**Business Significance:**
Phone numbers serve multiple critical purposes in community coordination:
- Emergency contact for individuals and families
- Activity reminders and notifications
- Follow-up communication with participants
- Coordination between facilitators and coordinators
- Community event notifications
- Pastoral care and support
- Confirmation of participation and attendance

The flexible storage approach recognizes that phone number formats vary dramatically across countries and cultures, and enforcing a single format would create barriers to accurate data collection in global contexts.

### Order (smallint, NULL)

A numeric field that establishes the priority sequence for multiple phone numbers belonging to the same individual, implementing a flexible hierarchy that guides communication attempts and contact strategies. This ordering system works identically to the Order field in IndividualEmails, where lower numbers indicate higher priority.

**Priority Hierarchy:**
The Order field creates a structured approach to managing multiple phone contacts:
- **Order = 1**: Primary phone number - first contact attempt, default for all communications
- **Order = 2**: Secondary phone - backup when primary unreachable or for specific times/purposes
- **Order = 3+**: Additional phones for specialized scenarios or alternative contact paths

**Strategic Contact Management:**
This sequential ordering enables sophisticated communication strategies:
- Automated systems attempt contact in order, trying Order=1 first, cascading to Order=2 if unavailable
- Coordinators see clear priority when deciding which number to call
- SMS/text systems know which number to target for mobile messaging
- Emergency contact protocols follow the established sequence
- User interfaces display phones sorted by priority for immediate clarity

**Operational Logic:**
The Order field requires careful maintenance to maximize effectiveness:
- Each individual should have exactly ONE phone with Order=1 (primary position)
- When promoting a phone to primary, demote the existing Order=1 to Order=2
- Deleting Order=1 should trigger automatic promotion of Order=2 to primary
- UI should enable easy drag-and-drop or click-to-promote reordering
- Gaps in numbering (1, 3, 5) allow for future insertions without renumbering
- Order changes should be audit-logged to track contact preference evolution

**Interaction with Phone Type:**
While Order indicates priority within an individual's phone numbers, phone type (Mobile/Home/Work) is stored separately in application logic or inferred from context. A common pattern combines both concepts:
- Order=1, Mobile: Primary contact, SMS-capable, immediate reach
- Order=2, Home: Evening/weekend backup, family access
- Order=3, Work: Business hours alternative, professional context

**Practical Advantages:**
This ordering approach provides significant benefits:
- Natural support for multiple fallback options without boolean complexity
- Clear semantics for retry logic in automated communication systems
- Explicit priority when multiple numbers of the same type exist
- Flexibility to accommodate diverse real-world contact patterns
- Scalable beyond simple primary/secondary dichotomy

**NULL Handling:**
The nullable nature accommodates several scenarios:
- Legacy data where ordering wasn't tracked historically
- Single phone numbers where priority is implicit (only one option)
- Temporary states during data entry before priority is assigned
- Equal-priority sets where distinction isn't meaningful

The Order field represents a mature, flexible approach to phone contact management that supports the complex realities of modern communication while maintaining the clear hierarchies essential for effective community coordination and automated systems.


### IndividualId (bigint, NULL)

The mandatory foreign key linking each phone number to a specific individual in the Individuals table. This relationship field establishes the fundamental connection between contact methods and people, enabling:

**Core Functionality:**
- Association of multiple phone numbers with one individual
- Lookup of all contact numbers for a given person
- Validation that phone records belong to known, active individuals
- Geographic and demographic context through the individual's profile
- Participation tracking via the individual's activity involvement

**Referential Integrity:**
The IndividualId enforces that:
- Every phone number must belong to exactly one individual
- Phone records cannot exist without a valid parent individual record
- Deleting an individual typically cascades to delete their phone numbers
- Archiving an individual doesn't necessarily delete their phones
- Changes to individual records don't orphan phone numbers

**Usage Patterns:**
The IndividualId enables critical operations:
- Finding all contact methods for an individual (mobile, home, work)
- Identifying individuals by their phone number (reverse lookup)
- Building comprehensive communication lists by locality or cluster
- Linking phone contact activity to participation patterns
- Understanding phone coverage across geographic areas
- Supporting SMS campaigns to specific populations

**Data Integrity Considerations:**
- IndividualId must reference valid, non-null Individuals.Id
- Foreign key constraint prevents orphaned phone records
- Cascade delete behavior should be carefully configured
- Archive vs. delete decisions affect phone number retention
- Historical phone data preservation may require special handling

This field is the critical link that places phone contact information within the broader context of community participation, enabling coordinators to understand not just how to reach people, but also who they are reaching and how those individuals are engaged in community-building activities.

### CreatedTimestamp (datetime, NULL)

Records the precise moment when this phone number was added to the database. This audit field captures when the contact information became available in the system, serving multiple important purposes:

**Temporal Tracking:**
- Documents when phone contact information was first obtained
- May differ significantly from when the individual began participating
- Enables analysis of contact data collection patterns
- Supports understanding of data quality over time
- Tracks growth in contactable individuals

**Data Quality Applications:**
- Identifying recently added phone numbers for validation
- Determining recency for duplicate resolution decisions
- Analyzing data entry timing and patterns
- Supporting synchronization with external systems
- Providing context for data quality investigations

**Analytical Value:**
- Understanding when contact coverage improved
- Tracking coordinator effectiveness in gathering contact info
- Identifying periods of high data collection activity
- Supporting retrospective analysis of communication capabilities
- Enabling trend analysis of contactability over time

**Use Cases:**
The CreatedTimestamp helps answer questions like:
- "When did we first obtain phone contact for this person?"
- "Which phone number is newer when resolving duplicates?"
- "How long have we been able to reach this individual by phone?"
- "What percentage of recent participants have phone numbers?"
- "When was the last time contact information was added in this locality?"

This field provides essential temporal context that helps coordinators and administrators understand the evolution of their contact databases and identify opportunities for improving contact information collection.

### CreatedBy (uniqueidentifier, NULL)

The GUID identifier of the user account that created this phone record. This audit field maintains accountability for data entry and helps track which users are collecting and entering contact information.

**Accountability Functions:**
- Identifies which coordinators gathered phone numbers
- Documents data entry sources and methods
- Supports training needs identification for data quality
- Enables authorization verification for data access
- Tracks user activity and productivity patterns

**Common Scenarios:**
- **Coordinator entry**: Local coordinator recording phone during individual registration
- **Administrator import**: Data admin importing phones from external source
- **Self-registration**: Individual providing own phone through online portal
- **Migration**: Data migration scripts creating historical records
- **API integration**: Third-party systems adding phone data programmatically

**Quality Control Applications:**
- Tracing back questionable or incorrect phone numbers to their source
- Identifying users who may need additional training on data entry
- Understanding which users are most actively collecting contact info
- Recognizing patterns in data entry errors by user
- Supporting audits of data collection practices

**Privacy and Governance:**
The CreatedBy field supports:
- Compliance with data protection regulations requiring activity logs
- Accountability for handling personally identifiable information
- Investigation capabilities for data breaches or misuse
- Documentation of who has accessed and entered phone numbers
- Support for access control and authorization models

This field is particularly valuable for maintaining data integrity and supporting organizational accountability in handling sensitive contact information.

### LastUpdatedTimestamp (datetime, NULL)

Captures the most recent moment when any aspect of this phone record was modified. This field automatically updates with every change, providing essential information for change tracking and data management.

**Change Detection:**
- Identifies recently modified phone numbers
- Supports incremental synchronization between systems
- Enables change tracking for audit purposes
- Documents data maintenance activities
- Tracks phone number volatility and update frequency

**Triggers for Updates:**
- Phone number correction or modification
- Primary designation changes (IsPrimary toggle)
- Phone type reclassification (Mobile ↔ Home ↔ Work)
- Data quality improvements and standardization
- Integration updates from external systems
- Administrative corrections during data cleanup

**Analytical Applications:**
- Identifying stale contact information needing verification
- Understanding update frequency patterns by locality or cluster
- Supporting data governance and audit requirements
- Enabling freshness metrics for contact databases
- Tracking data maintenance effort and effectiveness

**Synchronization Support:**
This timestamp is crucial for:
- Identifying changes since last synchronization with external systems
- Supporting bi-directional sync protocols
- Enabling incremental backup and replication
- Detecting conflicts in multi-user editing scenarios
- Optimizing data transfer by syncing only changed records

**Data Quality Monitoring:**
- Phone numbers not updated in extended periods may need verification
- Recent updates might indicate active data quality initiatives
- High update frequency could signal data instability issues
- Update patterns can reveal systematic data problems
- Timestamp distribution helps assess overall data freshness

This field enables administrators to understand how actively phone contact information is being maintained and to identify records that may need attention or verification.

### LastUpdatedBy (uniqueidentifier, NULL)

Records the GUID of the user who most recently modified this phone record. Together with LastUpdatedTimestamp, this completes the comprehensive audit trail for phone number maintenance.

**Maintenance Tracking:**
- Documents who is updating and maintaining phone numbers
- Identifies patterns in data maintenance across users
- Supports quality control for phone number changes
- Tracks authorization for contact information modifications
- Monitors user activity in data stewardship

**Common Update Scenarios:**
- **Coordinator correction**: Local coordinator updating phone after individual reports change
- **Data quality admin**: Administrator standardizing phone number formats
- **Automated process**: System updating phones from external authoritative sources
- **Self-service**: Individual updating own phone through web portal
- **Bulk operation**: Mass update during data cleanup or migration

**Governance and Compliance:**
The combined audit trail (Created + Updated fields) enables:
- Complete lifecycle visibility for each phone record
- Accountability for all modifications to contact information
- Training needs identification for specific users or roles
- Compliance with data protection regulations requiring change logs
- Investigation capabilities for data integrity issues

**Quality Management:**
- Identifying users whose changes frequently require correction
- Recognizing patterns in how different users handle phone data
- Supporting targeted training based on user-specific issues
- Tracking effectiveness of data quality initiatives by user
- Understanding which users maintain the highest data quality

**Privacy and Security:**
These audit fields are essential for:
- Maintaining accountability for personally identifiable information
- Supporting investigations of unauthorized access or changes
- Documenting handling of sensitive contact information
- Complying with regulations requiring access logs
- Demonstrating responsible data stewardship practices

The combination of all audit fields (Created/Updated Timestamp/By) provides comprehensive traceability for every phone record, supporting both operational excellence and regulatory compliance in managing contact information.

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

## Privacy and Security

**CRITICAL PRIVACY CLASSIFICATION**

This table contains direct contact information (phone numbers) that constitutes personally identifiable information (PII) requiring the highest level of privacy protection.

### Privacy Classification

**Reference:** See `reports/Privacy_and_Security_Classification_Matrix.md` for comprehensive privacy guidance.

This table is classified as **CRITICAL** for privacy:
- Contains direct personal contact information enabling voice/SMS communication
- Phone numbers are legally protected personal data under GDPR, CCPA, and similar regulations
- Requires encryption, access controls, and explicit consent
- **NEVER** expose phone numbers in public reports or unauthorized contexts
- Unauthorized disclosure could lead to spam calls, phishing (vishing/smishing), harassment, and SIM-swapping attacks

### Field-Level Sensitivity

| Field Name | Sensitivity Level | Privacy Concerns |
|------------|------------------|------------------|
| **PhoneNumber** | **CRITICAL** | Direct contact information - never expose without authorization |
| **IndividualId** | **CRITICAL** | Links to personal identity - never expose externally |
| Id | MODERATE | Junction table identifier - internal use only |
| PhoneType | LOW | Category (mobile/home/work) - safe when separated from phone number |
| IsPrimary | LOW | Preference flag - safe when separated from phone number |
| Audit fields | LOW | System metadata - no privacy concerns |

### Prohibited Query Patterns

**NEVER DO THIS - Exposing Phone Numbers:**
```sql
SELECT I.[FirstName], I.[FamilyName], P.[PhoneNumber], P.[PhoneType]
FROM [IndividualPhones] P
INNER JOIN [Individuals] I ON P.[IndividualId] = I.[Id]
WHERE P.[IsPrimary] = 1;
```

**NEVER DO THIS - Creating Contact Lists:**
```sql
SELECT [PhoneNumber] FROM [IndividualPhones] WHERE [PhoneType] = 0;  -- All mobile numbers
```

### Secure Query Patterns

**CORRECT - Phone Availability Statistics (No Actual Numbers):**
```sql
SELECT
    C.[Name] AS [ClusterName],
    COUNT(DISTINCT I.[Id]) AS [TotalIndividuals],
    COUNT(DISTINCT P.[IndividualId]) AS [WithPhone],
    CAST(COUNT(DISTINCT P.[IndividualId]) * 100.0 / COUNT(DISTINCT I.[Id]) AS DECIMAL(5,2)) AS [PercentWithPhone]
FROM [Individuals] I
INNER JOIN [Localities] L ON I.[LocalityId] = L.[Id]
INNER JOIN [Clusters] C ON L.[ClusterId] = C.[Id]
LEFT JOIN [IndividualPhones] P ON I.[Id] = P.[IndividualId]
WHERE I.[IsArchived] = 0
GROUP BY C.[Name]
HAVING COUNT(DISTINCT I.[Id]) >= 10;
```

**CORRECT - Phone Type Distribution:**
```sql
SELECT
    CASE [PhoneType]
        WHEN 0 THEN 'Mobile'
        WHEN 1 THEN 'Home'
        WHEN 2 THEN 'Work'
        ELSE 'Other'
    END AS [PhoneType],
    COUNT(*) AS [Count]
FROM [IndividualPhones]
GROUP BY [PhoneType];
```

### Data Protection Requirements

**Explicit Consent Required:**
- **NEVER** collect phone numbers without explicit consent
- Obtain separate consent for different uses (SMS/calls/WhatsApp/emergency contact)
- Document consent mechanism and retain records
- Allow individuals to review, correct, or delete their phone numbers

**Security Measures:**
- **Encryption:** Column-level encryption for PhoneNumber field at rest
- **Secure Transit:** SSL/TLS for all database connections
- **Access Control:** Limit access based on legitimate need (cluster coordinators, teachers for their students only)
- **Phone Masking:** In UIs, mask numbers (e.g., (555) ***-1234) unless authorized
- **Audit Logging:** Log all queries retrieving phone numbers

**Usage Restrictions:**
- **Authorized Purposes Only:** Use ONLY for consented purposes (coordination, emergency contact, SMS reminders)
- **No Third-Party Sharing:** Never share without explicit consent
- **No Commercial Use:** Never use for telemarketing or advertising
- **No Auto-Dialing Without Consent:** Comply with TCPA (USA) and similar regulations
- **SMS Opt-In Required:** Obtain explicit opt-in before sending SMS/text messages

**Compliance:**
- **GDPR:** Phone numbers are personal data requiring lawful basis, right to access/erasure/portability
- **CCPA:** Right to know, delete, and opt-out
- **TCPA (USA):** Prior express written consent required for automated calls/texts to mobile numbers
- **National Do-Not-Call Registries:** Check against DNC lists before calling

### Privacy Checklist for Phone Operations

Before any operation involving phone numbers:
- [ ] Explicit consent obtained for this specific use (calls/SMS/WhatsApp)
- [ ] User authorized to access phone numbers for this purpose
- [ ] Numbers encrypted in transit and at rest
- [ ] Numbers will NOT be exposed in logs, errors, or public interfaces
- [ ] SMS sending includes opt-out mechanism and complies with TCPA
- [ ] Access logged for audit
- [ ] Complies with GDPR, CCPA, TCPA, and local telecom regulations

### Incident Response

If phone numbers are exposed:
1. **Immediately** revoke credentials and lock accounts
2. **Notify** Data Protection Officer within 1 hour
3. **Assess** scope and potential harm (spam calls, SIM swapping risk)
4. **Notify** affected individuals if legally required
5. **Remediate** vulnerability and review security measures

**Potential Harms:**
- Spam/scam calls
- SMS phishing (smishing)
- SIM-swapping attacks (especially dangerous with 2FA via SMS)
- Harassment and stalking
- Doxxing when combined with other personal data

### Examples with Fictitious Data Only

**Safe Phone Numbers for Documentation:**
- (555) 01XX range - Reserved for fictional use in North America
- Examples: (555) 0100, (555) 0101, (555) 0102

**NEVER** use real phone numbers in documentation, tests, examples, or training materials.

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
