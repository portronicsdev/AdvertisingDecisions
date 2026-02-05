const csv = require('csv-parser');
const fs = require('fs');
const supabase = require('../config/database');

/**
 * Ingests CSV data into PostgreSQL using streaming and batch inserts
 * @param {string} csvPath - Path to CSV file
 * @param {string} tableName - Target table name
 * @param {Function} rowMapper - Function to map CSV row to database row
 * @param {number} batchSize - Number of rows to insert per batch
 */
async function ingestCsv(csvPath, tableName, rowMapper, batchSize = 1000) {
    return new Promise((resolve, reject) => {
        // Verify CSV file exists before attempting to read
        if (!fs.existsSync(csvPath)) {
            reject(new Error(`CSV file does not exist: ${csvPath}`));
            return;
        }
        
        const rows = [];
        let rowCount = 0;
        let rawRowCount = 0;
        let skippedRowCount = 0;
        const skippedRows = [];
        let errorRowCount = 0;
        const errorRows = [];
        let batchCount = 0;
        let resolved = false;
        const startTime = Date.now();

        const formatDuration = (ms) => {
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}m ${seconds}s`;
        };

        console.log(`📖 Reading CSV file: ${csvPath}`);
        
        // Queue to process rows sequentially
        const rowQueue = [];
        let processing = false;
        
        const finalize = async (success, message) => {
            if (resolved) return;
            resolved = true;
            try {
                if (rows.length > 0) {
                    await insertBatch(tableName, rows, batchCount);
                    batchCount++;
                }
            } catch (batchError) {
                console.error('Error inserting final batch:', batchError);
                success = false;
                message = batchError.message || message;
            }

            const totalElapsed = Date.now() - startTime;
            console.log(`✅ All rows processed. Total mapped: ${rowCount}. Time: ${formatDuration(totalElapsed)}`);
            console.log(`📊 Ingestion summary:`);
            console.log(`   Raw rows read: ${rawRowCount}`);
            console.log(`   Successfully mapped: ${rowCount}`);
            console.log(`   Skipped (null): ${skippedRowCount}`);
            console.log(`   Errors: ${errorRowCount}`);
            console.log(`   Inserted: ${rowCount} (batches: ${batchCount})`);
           

            resolve({
                success,
                message,
                rowCount,
                batchCount,
                rawRowCount,
                skippedRowCount,
                errorRowCount,
                skippedRows,
                errorRows
            });
        };

        const processNextRow = async () => {
            if (processing || rowQueue.length === 0) return;
            
            processing = true;
            const { row, rowNum } = rowQueue.shift();
            
            try {
                const mappedRow = await rowMapper(row);
               
                if (mappedRow) {
                    rows.push(mappedRow);
                    rowCount++;
                    if (rowCount % 100 === 0) {
                        const elapsed = Date.now() - startTime;
                        //console.log(`⏱️  Mapped ${rowCount} rows in ${formatDuration(elapsed)}`);
                    }

                    // Insert batch when full
                    if (rows.length >= batchSize) {
                        await insertBatch(tableName, rows, batchCount);
                        rows.length = 0;
                        batchCount++;
                    }
                } else {
                    skippedRowCount++;
                    if (skippedRowCount <= 3) {
                        console.log(`⚠️  Row ${rowNum} was skipped (mapper returned null)`);
                    }
                    if (skippedRows.length < 50) {
                        skippedRows.push({ rowNum, reason: 'mapper returned null', row });
                    }
                }
            } catch (error) {
                errorRowCount++;
                console.error(`❌ Error mapping row ${rowNum}:`, error.message);
                if (errorRows.length < 50) {
                    errorRows.push({
                        rowNum,
                        error: error.message,
                        row
                    });
                }
                
                // Continue processing; keep only a small sample of errors
            } finally {
                processing = false;
                // Process next row in queue
                processNextRow();
            }
        };
        
        const stream = fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                rawRowCount++;
                
                // Log first row for debugging (header info)
                if (rawRowCount === 1) {
                    console.log(`📋 CSV Header keys:`, Object.keys(row));
                    console.log(`📋 First data row sample:`, JSON.stringify(row));
                }
                
                // Add to queue and process
                rowQueue.push({ row, rowNum: rawRowCount });
                processNextRow();
            })
            .on('end', async () => {
                console.log(`📦 CSV file read completed. Waiting for ${rowQueue.length} rows in queue to process...`);
                // Wait for all rows in queue to be processed
                let waitCount = 0;
                while (rowQueue.length > 0 || processing) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    waitCount++;
                    if (waitCount % 10 === 0) {
                        const elapsed = Date.now() - startTime;
                        console.log(`⏳ Still processing... Queue: ${rowQueue.length}, Processing: ${processing}, Mapped: ${rowCount}, Elapsed: ${formatDuration(elapsed)}`);
                    }
                }
                const errorMsg = rowCount === 0
                    ? (rawRowCount === 0
                        ? 'No rows found in the file (file may be empty or have only headers)'
                        : `No valid rows found. ${rawRowCount} rows read, but all were skipped or had errors.`)
                    : null;
                await finalize(!errorMsg, errorMsg || 'Ingestion completed');
            })
            .on('error', (error) => {
                console.error('Stream error:', error);
                finalize(false, error.message || 'Stream error');
            });
    });
}

/**
 * Inserts a batch of rows into the database using Supabase
 */
async function insertBatch(tableName, rows, batchNumber) {
    if (rows.length === 0) return;
    console.log(`🚀 Inserting batch ${batchNumber + 1} with ${rows.length} rows into ${tableName}...`);
    try {
        // Supabase supports batch inserts directly
        const { data, error } = await supabase
            .from(tableName)
            .insert(rows);
        
        if (error) {
            console.error(`❌ Error inserting batch ${batchNumber + 1}:`, error);
            throw error;
        }
        
        console.log(`  Batch ${batchNumber + 1}: Inserted ${rows.length} rows`);
    } catch (error) {
        console.error(`❌ Error inserting batch ${batchNumber + 1}:`, error);
        throw error;
    }
}

module.exports = { ingestCsv };

