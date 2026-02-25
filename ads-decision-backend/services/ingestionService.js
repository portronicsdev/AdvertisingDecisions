const csv = require('csv-parser');
const fs = require('fs');
const supabase = require('../config/database');

/**
 * Generic CSV ingestion engine
 */
async function ingestCsv(csvPath, tableName, rowMapper, options = {}) {
  const {
    batchSize = 1000,
    upsert = false,
    onConflict = null
  } = options;

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(csvPath)) {
      return reject(new Error(`CSV file not found: ${csvPath}`));
    }

    const rows = [];
    let rowCount = 0;
    let rawRowCount = 0;
    let skippedRowCount = 0;
    let errorRowCount = 0;
    let batchCount = 0;

    const skippedRows = [];
    const errorRows = [];

    let processing = false;
    const queue = [];
    let resolved = false;

    const startTime = Date.now();

    const insertBatch = async () => {
      if (!rows.length) return;

      console.log('row:', rows[0]);
      console.log(`🚀 Inserting batch ${batchCount + 1} (${rows.length} rows)`);

      const query = supabase.from(tableName);

      const { error } = upsert
        ? await query.upsert(rows, { onConflict })
        : await query.insert(rows);

      if (error) {
        console.error(`❌ Batch insert failed`, error);
        throw error;
      }

      batchCount++;
      rows.length = 0;
    };

    const finalize = async () => {
      if (resolved) return;
      resolved = true;

      try {
        await insertBatch();
      } catch (err) {
        return reject(err);
      }

      const duration = Math.floor((Date.now() - startTime) / 1000);

      console.log(`✅ Done. Rows: ${rowCount}, Time: ${duration}s`);

      resolve({
        success: rowCount > 0,
        rowCount,
        batchCount,
        rawRowCount,
        skippedRowCount,
        errorRowCount,
        skippedRows,
        errorRows
      });
    };

    const processNext = async () => {
      if (processing || !queue.length) return;

      processing = true;

      const { row, rowNum } = queue.shift();

      try {
        const mapped = await rowMapper(row);

        if (!mapped) {
          skippedRowCount++;
          if (skippedRows.length < 50) {
            //console.log('⚠️ Skipped row (mapper returned null):', row);
            skippedRows.push({ rowNum, row });
          }
        } else {
          rows.push(mapped);
          rowCount++;

          if (rows.length >= batchSize) {
            await insertBatch();
          }
        }

      } catch (err) {
        errorRowCount++;
        if (errorRows.length < 50) {
          errorRows.push({ rowNum, error: err.message, row });
        }
      } finally {
        processing = false;
        processNext();
      }
    };

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        rawRowCount++;
        queue.push({ row, rowNum: rawRowCount });
        processNext();
      })
      .on('end', async () => {
        while (queue.length || processing) {
          await new Promise(r => setTimeout(r, 50));
        }
        await finalize();
      })
      .on('error', reject);
  });
}

module.exports = { ingestCsv };
