# Import Pipeline Flow

## Request-to-DB path

1. `routes/upload.js`
   - Validates upload, converts Excel to CSV.
   - Resolves `seller_id` to `platform_id` (sales/inventory).
   - Calls the import pipeline.

2. `services/import/pipeline.js`
   - Selects table-specific normalizer.
   - Streams CSV rows into the ingestion service.

3. `services/import/normalizers.js`
   - Dispatches to per-table normalization logic.
   - Sales/Inventory can enrich rows with `platform_id`.

4. `services/mappers.js`
   - Converts a single CSV row into a canonical DB row.
   - Handles date parsing, SKU/platform SKU, validation.

5. `services/ingestionService.js`
   - Streams rows and inserts in batches.

## Sequence diagram

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend (ImportModal)
    participant API as POST /api/upload/:tableType
    participant XLSX as excelToCsv
    participant PIPE as import/pipeline
    participant NORM as import/normalizers
    participant MAP as services/mappers
    participant ING as services/ingestionService
    participant DB as Database

    FE->>API: Upload file + seller_id (sales/inventory)
    API->>XLSX: Convert Excel to CSV
    XLSX-->>API: csvPath
    API->>PIPE: runImportPipeline(tableType, csvPath, context)
    PIPE->>NORM: getNormalizer(tableType)
    NORM-->>PIPE: normalize(row)
    PIPE->>ING: ingestCsv(csvPath, tableName, mapper)
    loop each row
        ING->>MAP: mapRow(row)
        MAP-->>ING: canonical row
        ING->>DB: batch insert
    end
    ING-->>PIPE: result
    PIPE-->>API: result
    API-->>FE: success + stats
```

## Why this structure

- Single streaming path for small + large files.
- Per-table normalization stays isolated and readable.
- Backend is the source of truth for canonical formats.
