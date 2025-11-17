# LoadDataFiles Table

## Overview
The `LoadDataFiles` table tracks data import operations in the SRP database. It maintains a log of files imported into the system, including file metadata, import status, success/failure information, and timing details. This table is essential for auditing data imports, troubleshooting import issues, and maintaining data lineage.

## Table Structure

| Column Name | Data Type | Nullable | Description |
|------------|-----------|----------|-------------|
| **Id** | bigint | NO | Primary key, unique identifier for each import operation |
| **FileName** | nvarchar(255) | NO | Original name of the imported file |
| **FileType** | varchar(50) | NO | Type/format of file (CSV, Excel, XML, etc.) |
| **FileSize** | bigint | YES | Size of file in bytes |
| **ImportStartTimestamp** | datetime | NO | When import operation began |
| **ImportEndTimestamp** | datetime | YES | When import operation completed |
| **ImportStatus** | varchar(50) | NO | Status: Success, Failed, Partial, InProgress |
| **RecordsProcessed** | int | YES | Total number of records attempted |
| **RecordsSucceeded** | int | YES | Number of records successfully imported |
| **RecordsFailed** | int | YES | Number of records that failed to import |
| **ErrorMessage** | nvarchar(max) | YES | Error details if import failed |
| **ImportedBy** | uniqueidentifier | NO | User ID who initiated the import |
| **Comments** | nvarchar(max) | YES | Additional notes about the import |
| **GUID** | uniqueidentifier | NO | Globally unique identifier for this import operation |
| **CreatedTimestamp** | datetime | NO | When the log record was created |

## Purpose and Function

### Import Logging
- **Audit Trail**: Complete history of all data imports
- **Troubleshooting**: Diagnose import failures
- **Data Lineage**: Track source of imported data
- **Quality Control**: Monitor import success rates
- **Performance**: Track import duration

### Import Types
Common import scenarios:
- **Bulk Data Load**: Initial database population
- **Regular Updates**: Periodic data synchronization
- **Migration**: Legacy system data import
- **External Systems**: Institute database imports
- **Manual Uploads**: User-initiated data imports

## Import Status Values

### Success
- All records processed successfully
- No errors encountered
- RecordsProcessed = RecordsSucceeded
- ImportEndTimestamp populated

### Failed
- Import operation failed completely
- No records successfully imported
- ErrorMessage contains details
- RecordsFailed = RecordsProcessed

### Partial
- Some records succeeded, some failed
- RecordsSucceeded + RecordsFailed = RecordsProcessed
- ErrorMessage may contain summary
- Requires review and correction

### InProgress
- Import currently running
- ImportEndTimestamp is NULL
- Interim status before completion
- May indicate stuck imports if old

## File Types

Common file types imported:
- **CSV**: Comma-separated values
- **Excel**: .xlsx or .xls files
- **XML**: Structured XML data
- **JSON**: JavaScript Object Notation
- **TXT**: Tab-delimited or other text formats
- **Custom**: Application-specific formats

## Common Query Patterns

### Recent Imports
```sql
SELECT
    [FileName],
    [FileType],
    [ImportStartTimestamp],
    [ImportStatus],
    [RecordsProcessed],
    [RecordsSucceeded],
    [RecordsFailed]
FROM [LoadDataFiles]
WHERE [ImportStartTimestamp] >= DATEADD(DAY, -30, GETDATE())
ORDER BY [ImportStartTimestamp] DESC
```

### Failed Imports
```sql
SELECT
    [FileName],
    [ImportStartTimestamp],
    [ErrorMessage],
    [RecordsProcessed],
    [RecordsFailed]
FROM [LoadDataFiles]
WHERE [ImportStatus] = 'Failed'
ORDER BY [ImportStartTimestamp] DESC
```

### Import Success Rate
```sql
SELECT
    [FileType],
    COUNT(*) AS TotalImports,
    SUM(CASE WHEN [ImportStatus] = 'Success' THEN 1 ELSE 0 END) AS Successful,
    SUM(CASE WHEN [ImportStatus] = 'Failed' THEN 1 ELSE 0 END) AS Failed,
    SUM(CASE WHEN [ImportStatus] = 'Partial' THEN 1 ELSE 0 END) AS Partial
FROM [LoadDataFiles]
GROUP BY [FileType]
```

### Import Performance
```sql
SELECT
    [FileName],
    [RecordsProcessed],
    DATEDIFF(SECOND, [ImportStartTimestamp], [ImportEndTimestamp]) AS DurationSeconds,
    CASE
        WHEN DATEDIFF(SECOND, [ImportStartTimestamp], [ImportEndTimestamp]) > 0
        THEN [RecordsProcessed] / DATEDIFF(SECOND, [ImportStartTimestamp], [ImportEndTimestamp])
        ELSE NULL
    END AS RecordsPerSecond
FROM [LoadDataFiles]
WHERE [ImportEndTimestamp] IS NOT NULL
    AND [RecordsProcessed] > 0
ORDER BY DurationSeconds DESC
```

### Stuck Imports
```sql
SELECT
    [FileName],
    [ImportStartTimestamp],
    DATEDIFF(MINUTE, [ImportStartTimestamp], GETDATE()) AS MinutesRunning
FROM [LoadDataFiles]
WHERE [ImportStatus] = 'InProgress'
    AND [ImportStartTimestamp] < DATEADD(HOUR, -2, GETDATE())
```

### Imports by User
```sql
SELECT
    [ImportedBy],
    COUNT(*) AS ImportCount,
    SUM([RecordsProcessed]) AS TotalRecords,
    MIN([ImportStartTimestamp]) AS FirstImport,
    MAX([ImportStartTimestamp]) AS LastImport
FROM [LoadDataFiles]
GROUP BY [ImportedBy]
ORDER BY ImportCount DESC
```

## Business Rules and Constraints

1. **Required Fields**: FileName, FileType, ImportStartTimestamp, ImportStatus, ImportedBy
2. **Status Values**: Must be one of: Success, Failed, Partial, InProgress
3. **Record Counts**: RecordsSucceeded + RecordsFailed should equal RecordsProcessed
4. **End Timestamp**: Should be >= StartTimestamp when populated
5. **Error Messages**: Required when ImportStatus = Failed

## Usage Patterns

### Monitoring
- Track ongoing imports
- Identify failed imports for retry
- Monitor import performance
- Alert on import failures

### Troubleshooting
- Review error messages for failed imports
- Analyze partial import issues
- Identify problematic file formats
- Debug data quality issues

### Reporting
- Import history reports
- Success rate analysis
- Performance metrics
- Data lineage documentation

### Audit
- Who imported what and when
- Source file identification
- Change tracking
- Compliance requirements

## Data Quality Considerations

### Import Validation
Before importing:
- Validate file format
- Check file integrity
- Verify data schema
- Test with sample data

### Error Handling
During import:
- Capture detailed error messages
- Log record-level failures
- Continue processing when possible
- Rollback on critical failures

### Post-Import Verification
After import:
- Verify record counts
- Check data quality
- Validate relationships
- Compare with source

## Performance Considerations

### Large File Imports
- Batch processing for large files
- Transaction management
- Memory usage monitoring
- Progress tracking

### Concurrent Imports
- Handle multiple simultaneous imports
- Resource contention
- Lock management
- Queue management

### Cleanup
- Archive old import logs
- Retain based on policy (e.g., 1 year)
- Consider purging very old records
- Maintain audit requirements

## Notes for Developers

- Update ImportStatus as import progresses
- Set ImportEndTimestamp when complete
- Populate RecordsProcessed, RecordsSucceeded, RecordsFailed accurately
- Capture meaningful error messages
- Use transactions appropriately
- Handle import cancellation
- Provide progress feedback for long imports
- Log at appropriate detail level

## Integration Considerations

### Import UI
- File upload interface
- Progress indicators
- Error display
- Retry functionality

### Automated Imports
- Scheduled import jobs
- External system integration
- API-based imports
- Monitoring and alerting

### Error Notification
- Alert administrators of failures
- Email notifications
- Dashboard indicators
- Log aggregation

## Special Considerations

### Large Files
For very large files:
- Stream processing
- Chunked uploads
- Progress checkpoints
- Resume capability

### Data Migration
During migration projects:
- Track source system
- Preserve legacy IDs
- Document transformations
- Validate completeness

### Real-Time Sync
For synchronization scenarios:
- Track last successful import
- Incremental imports
- Conflict resolution
- Bidirectional sync support

## Best Practices

1. **Validation**: Validate files before import
2. **Error Handling**: Capture detailed error information
3. **Atomicity**: Use transactions appropriately
4. **Progress**: Provide progress feedback
5. **Logging**: Log sufficient detail for troubleshooting
6. **Monitoring**: Monitor import success rates
7. **Cleanup**: Archive or purge old import logs
8. **Documentation**: Document import procedures
9. **Testing**: Test imports with sample data first
10. **Recovery**: Provide rollback or retry mechanisms
11. **Performance**: Optimize for large file handling
12. **Security**: Validate and sanitize input data
