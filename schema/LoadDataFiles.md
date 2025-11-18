# LoadDataFiles Table

## Overview
The `LoadDataFiles` table tracks data import operations in the SRP database. It maintains a log of files imported into the system, including file metadata, import status, success/failure information, and timing details. This table is essential for auditing data imports, troubleshooting import issues, and maintaining data lineage.

## Table Structure

### Id (bigint, NOT NULL, PRIMARY KEY)

The primary key and unique identifier for each data import operation logged in the system. This auto-incrementing field ensures that every file load event has a distinct, permanent reference point, enabling precise tracking of data import history across the application's operational lifecycle.

The Id field serves as the immutable anchor for each import record, providing a stable reference that remains constant even as understanding of the import's significance evolves or as additional context is added through updates. In practice, this sequential identifier enables efficient querying of import history, supports referential integrity if other tables need to reference specific import events, and provides a natural chronological ordering when examining load operations. During troubleshooting of data quality issues or investigating the source of specific records, this Id allows administrators to precisely identify and reference the import operation that introduced data into the system. When analyzing import patterns, success rates, or performance trends, the Id field's sequential nature supports time-series analysis and enables aggregations across ranges of import events. For audit and compliance purposes, the Id provides an unambiguous reference point for documenting which import operations occurred, facilitating clear communication in incident reports, change documentation, or regulatory compliance records.

### FileName (nvarchar, NULL)

The original name of the file that was imported into the system, preserving the source identifier exactly as it was provided during the import operation. This field typically contains values like "RegionalData_2024-01-15.csv", "ActivityExport.xlsx", "SRP_3_1_Region_File_North.txt", or other descriptive filenames that identify the data source.

The FileName field serves multiple critical purposes in data lineage tracking and import management. First, it provides the essential link between database records and their source files, enabling administrators to trace data back to its origin when investigating data quality issues, verifying import correctness, or responding to questions about data provenance. Second, it helps prevent accidental duplicate imports by allowing checks for previously loaded files with the same name, though this should be combined with other checks like FileDate or content hashing for robust duplicate detection. Third, the filename often encodes meaningful information through naming conventions—dates, regions, data types, or export sources embedded in the filename provide immediate context about what data the file contains and when it was created. The nvarchar type supports Unicode characters, accommodating filenames in various languages and character sets, which is important in a global system where files might originate from regional offices using local language naming conventions. When troubleshooting import issues, the FileName immediately identifies which source file caused problems, directing administrators to the specific file for examination, reprocessing, or correction. In data governance and audit scenarios, this field documents the precise source of every data import, supporting compliance requirements for data lineage and change tracking.

### FileType (varchar, NULL)

A categorical identifier indicating the format or type of file that was imported, using standardized type identifiers like "CSV", "Excel", "XML", "JSON", "TXT", "SRP_3_1_Region_File", or custom application-specific format indicators. This field enables classification of imports by data format, supporting format-specific processing logic and analysis of import patterns across different file types.

The FileType field plays a crucial role in understanding import operations and diagnosing format-specific issues. Different file formats often require different parsing logic, validation rules, and error handling approaches—CSV files might have delimiter or encoding issues, Excel files might have formatting or formula complications, XML files might have schema validation concerns, and custom application formats might have version-specific parsing requirements. By recording the file type explicitly, the system enables analysis of which formats are most commonly used, which formats experience the highest failure rates, and where format-specific improvements or documentation might be needed. When troubleshooting import failures, knowing the FileType immediately directs administrators to format-specific parsing code, documentation, or known issues. The field also supports operational metrics like "success rate by file type" or "average import duration by format," helping identify whether specific formats consistently cause problems or require optimization. In environments where data arrives from multiple sources in different formats—such as regional files in CSV format, institutional exports in Excel, or API responses in JSON—the FileType field provides essential categorization for managing the diverse import landscape.

### FileDate (datetime, NULL)

Records the timestamp associated with the source file itself, typically representing when the file was created, generated, or represents a snapshot of data as of a specific point in time. This date may come from file metadata, embedded timestamps within the file content, or explicit date indicators in the filename or file structure.

The FileDate field provides critical temporal context distinct from the LoadedDate—it indicates the "as-of" date for the data content rather than when the import occurred. This distinction becomes essential when analyzing data currency and staleness: a file loaded on 2024-01-20 (LoadedDate) but with FileDate of 2024-01-10 contains data that is ten days old at the time of import, which might be acceptable for monthly reports but problematic for daily operational data. The FileDate enables queries that identify stale data imports, track the lag between data generation and database availability, and ensure that the most recent available data is being imported. In scenarios where files arrive out of sequence—perhaps due to network issues, manual processing delays, or batch scheduling—the FileDate helps establish the correct chronological order of the data regardless of import order. When multiple files cover overlapping time periods, FileDate enables proper data versioning and temporal reconciliation. For compliance and audit purposes, FileDate documents the claimed temporal scope of imported data, supporting investigations into whether data was imported in a timely manner and whether historical snapshots accurately represent their claimed time periods.

### LoadedDate (datetime, NULL)

Captures the exact date and time when the file import operation was executed and the data was loaded into the database. This timestamp marks when the data became available in the system, distinct from when the file itself was created (FileDate) or when the load record was created in this history table.

The LoadedDate field serves as the definitive timestamp for when external data entered the system, enabling precise tracking of data availability and supporting temporal analysis of import operations. This timestamp becomes crucial for understanding data freshness in the database—the interval between FileDate and LoadedDate reveals import lag, helping administrators identify delays in data processing pipelines. During incident investigations, LoadedDate helps establish causality: if data quality issues appeared at a specific time, imports with LoadedDate values around that time are prime candidates for investigation. The field supports operational metrics like import frequency, time-of-day patterns for data loads, and intervals between successive imports of the same data type. In multi-region or multi-environment deployments, comparing LoadedDate values across instances reveals synchronization status and helps identify whether all environments are receiving data updates in a timely manner. For incremental import strategies, LoadedDate enables queries like "what data has been loaded since my last sync" or "identify files imported in the last 24 hours." The nullable nature accommodates edge cases, but in practice every import operation should record when it occurred to maintain a complete temporal audit trail.

### LoadedItem (nvarchar, NULL)

A descriptive field identifying what category or type of data was loaded, such as "Individuals", "Activities", "Localities", "RegionalStatistics", or other entity types that classify the nature of the imported information. This field provides semantic context about what the file contained and which tables or data domains were affected by the import.

The LoadedItem field enables categorization and filtering of import history by data type, which is essential when managing a complex database with multiple data import pipelines. When troubleshooting issues with specific entity types—for example, if there are questions about Individual records—filtering by LoadedItem = "Individuals" immediately narrows the import history to relevant operations. This field supports analysis of import patterns by data type, revealing which categories are imported most frequently, which experience the highest failure rates, and where import processes might need optimization or additional validation. In scenarios where a single file might contain multiple entity types, LoadedItem might store a delimited list or primary entity indicator. The field also aids in impact analysis: when planning maintenance or investigating data issues, knowing which LoadedItem types were imported during a specific period helps identify which areas of the database might have been affected. For documentation and training purposes, LoadedItem provides a high-level description of import operations that is more meaningful to non-technical stakeholders than table names or technical identifiers.

### SourceApplicationGUID (uniqueidentifier, NOT NULL)

A globally unique identifier representing the source application or system instance from which the imported data originated. This GUID enables tracking of data provenance across distributed environments, identifying which specific installation or instance of the SRP application (or other systems) generated the exported data that is now being imported.

The SourceApplicationGUID field is crucial for managing data flows in distributed deployments where multiple SRP instances might exchange data through export-import cycles. For example, regional SRP installations might export data that is then imported into a central consolidated database, and this GUID identifies which regional instance provided each file. This enables sophisticated data lineage tracking—administrators can trace specific records back through import history to identify not just that data came from an import, but specifically which source system provided it. The field supports detection of import loops or circular dependencies in multi-system architectures where data might inadvertently be exported and re-imported. It enables analysis of data quality patterns by source system, helping identify if specific source instances consistently produce problematic data that requires additional validation. In migration scenarios where data from legacy systems is being imported, different source GUIDs can distinguish between different legacy sources, maintaining clear provenance even as data consolidates into a single database. The NOT NULL constraint ensures that every import is definitively attributed to a source system, preventing ambiguity about data origins and supporting robust audit trails.

### SourceApplicationVersion (varchar, NULL)

Records the version number of the source application that generated the exported data file, such as "3.1.0", "2.5.1", or custom version identifiers that indicate which release of the source system produced the data. This version information is critical for understanding compatibility, data format expectations, and potential schema differences between source and destination systems.

The SourceApplicationVersion field addresses a common challenge in data integration: different versions of an application may export data in slightly different formats, with different field sets, encoding schemes, or structural assumptions. By recording the source version, import processes can apply version-specific parsing logic, handle backward compatibility gracefully, and validate that imported data matches expected schemas for that version. When import failures occur, this field helps diagnose whether version mismatches between source and destination might be the root cause—attempting to import data from SRP 3.1 using parsing logic designed for SRP 2.5 format might fail or produce incorrect results. The field enables analysis of which source versions are still in active use across a distributed deployment, helping coordinate upgrade planning and identify instances that need updating. For long-term data archaeology, knowing the source version helps understand historical data structures and interpret fields that might have changed meaning across versions. In heterogeneous environments where data might arrive from multiple source system versions simultaneously, this field ensures that each import is processed with appropriate version-aware logic.

### LoadedToLocation (nvarchar, NOT NULL)

Identifies the destination location, region, organizational unit, or database instance where the imported data was loaded. This field might contain values like "Central Database", "North Region", "Production", "Development", or specific identifiers that indicate which deployment instance or data partition received the imported data.

The LoadedToLocation field provides essential context about where in a potentially distributed or partitioned database landscape the import occurred. In multi-tenant or multi-region deployments, the same import process might load data to different logical or physical locations, and this field ensures clear documentation of the destination. This becomes particularly important when investigating data issues or discrepancies—understanding that data was loaded to "North Region" versus "South Region" helps narrow troubleshooting scope and ensures fixes are applied in the correct location. The field supports analysis of import patterns by location, revealing which regions or instances receive the most imports, which might experience higher failure rates, and where additional resources or process improvements might be needed. In disaster recovery scenarios, LoadedToLocation helps identify which locations' data needs to be restored from which import files. The NOT NULL constraint ensures every import operation explicitly documents its destination, preventing ambiguity in multi-location deployments and supporting clear audit trails about where data entered the system.

### ApplicationType (varchar, NULL, DEFAULT 'SRPWindowsDesktop')

Identifies the type or variant of application that performed the import operation, with a default value of 'SRPWindowsDesktop' indicating the standard Windows desktop application, though other values might include "SRPWeb", "SRPMobile", "DataMigrationTool", or custom identifiers for specialized import utilities.

The ApplicationType field distinguishes between different client applications or tools that might perform import operations, enabling analysis of which application variants are most commonly used for data imports and whether specific application types experience different success rates or patterns. This becomes valuable when multiple interfaces to the database exist—a web interface might handle different file types or sizes than a desktop application, or a specialized migration tool might have different validation rules than standard user-facing applications. The field supports troubleshooting by immediately identifying which application performed a problematic import, directing investigation to application-specific code paths, configuration, or known issues. It enables operational metrics segmented by application type, helping identify whether specific client applications need optimization, additional testing, or enhanced error handling for import operations. The default value of 'SRPWindowsDesktop' provides backward compatibility and ensures a meaningful value even for legacy records that didn't explicitly specify application type, while allowing flexibility for environments where multiple application variants handle data imports.

### DBVersion (varchar, NULL, DEFAULT '')

Records the database schema version or structure version at the time the import was performed, helping track compatibility between imported data formats and database schema expectations. This field might contain values like "3.1.0", "2024.01", or other version identifiers that correspond to database schema releases.

The DBVersion field addresses the challenge of managing data imports across schema evolution. As databases are upgraded and schemas change, the structure of imported data might need to be adapted or validated differently. By recording the database version active during each import, administrators can later understand whether import issues might have been caused by schema mismatches or version-specific compatibility problems. This field enables analysis of import success rates across different database versions, helping identify whether specific schema versions introduce import compatibility issues that need addressing. In environments where multiple database instances might be at different schema versions, DBVersion helps track which imports occurred at which versions, supporting troubleshooting and ensuring that any version-specific data corrections are applied to the right records. The default empty string value accommodates scenarios where version tracking wasn't implemented or isn't relevant, while allowing explicit version documentation when meaningful. For long-term data management, this field helps reconstruct the historical context of imports—understanding what database structure existed when data was loaded can be crucial for interpreting legacy data or planning migrations.

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
