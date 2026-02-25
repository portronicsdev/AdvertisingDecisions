const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { excelToCsv } = require('../../utils/excelToCsv');
const { extractPlatformSkus } = require('../../utils/csvHelpers');
const { buildPlatformSkuMap } = require('../../services/productPlatformService');
const { ingestCsv } = require('../../services/ingestionService');
const { mapRatingsFactRow } = require('../../mappers/ratingsMapper');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads/temp');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/', upload.single('file'), async (req, res) => {
  let csvPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'File missing' });
    }

    if (!req.body.snapshot_date) {
      return res.status(400).json({
        success: false,
        error: 'snapshot_date is required'
      });
    }

    const ctx = {
      snapshotDate: req.body.snapshot_date
    };

    console.log('📌 Context:', ctx);

    /* ---------- convert ---------- */

    csvPath = await excelToCsv(req.file.path, uploadDir);

    /* ---------- extract platform skus ---------- */

    const platformSkus = await extractPlatformSkus(csvPath);

    console.log(`📊 Extracted ${platformSkus.length} platform SKUs`);
    console.log(`🔍 Sample:`, platformSkus.slice(0, 10));

    /* ---------- build map ---------- */

    const platformMap = await buildPlatformSkuMap(platformSkus);

    console.log(`🧠 Platform map size: ${platformMap.size}`);

    /* ---------- meta ---------- */

    const meta = {
      platformMap,
      missingPlatformSkus: new Set()
    };

    /* ---------- ingest ---------- */

    console.log('🚀 Starting CSV ingestion: ratings');

    const result = await ingestCsv(
      csvPath,
      'ratings_facts',
      (row) => mapRatingsFactRow(row, ctx, meta),
      {
        upsert: true,
        onConflict: 'product_platform_id,snapshot_date'
      }
    );

    console.log(`✅ Done. Rows: ${result.rowCount}`);

    /* ---------- cleanup ---------- */

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (csvPath && fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

    /* ---------- response ---------- */

    return res.json({
      success: result.rowCount > 0,
      table: 'ratings_facts',
      rowCount: result.rowCount,
      batchCount: result.batchCount,
      skippedRowCount: result.skippedRowCount,
      errorRowCount: result.errorRowCount,
      errorRows: result.errorRows,

      missingPlatformSkus: Array.from(meta.missingPlatformSkus),

      message:
        result.rowCount > 0
          ? `Imported ${result.rowCount} rows`
          : 'No rows inserted'
    });

  } catch (err) {
    console.error('Upload failed:', err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (csvPath && fs.existsSync(csvPath)) {
      fs.unlinkSync(csvPath);
    }

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;