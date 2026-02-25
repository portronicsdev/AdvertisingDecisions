const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { excelToCsv } = require('../../utils/excelToCsv');
const { extractPlatformSkus } = require('../../utils/csvHelpers');
const { buildPlatformSkuMap } = require('../../services/productPlatformService');
const { ingestCsv } = require('../../services/ingestionService');
const { mapSalesFactRow } = require('../../mappers/salesMapper');

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

    const sellerId = req.body.seller_id ? parseInt(req.body.seller_id, 10): null;
    const ctx = {sellerId};
    console.log('📌 Context:', ctx);

    /* ---------- convert ---------- */

    csvPath = await excelToCsv(req.file.path, uploadDir);

    /* ---------- extract platform skus ---------- */

    const platformSkus = await extractPlatformSkus(csvPath);

    console.log(`📊 Extracted ${platformSkus.length} platform SKUs`);
    console.log(`🔍 Sample:`, platformSkus.slice(0, 10));

    /* ---------- build map ---------- */

    const platformMap = await buildPlatformSkuMap(platformSkus);

    /* ---------- meta ---------- */

    const meta = {
      platformMap,
      missingPlatformSkus: new Set()
    };
    

    /* ---------- ingest ---------- */
    console.log('🚀 Starting CSV ingestion, sales');
    const result = await ingestCsv(
      csvPath,
      'sales_facts',
      (row) => mapSalesFactRow(row, ctx, meta),
      {
        upsert: true,
        onConflict: 'product_platform_id,seller_id,period_start_date,period_end_date'
      }
    );

    console.log(`✅ Ingestion complete. Rows inserted/updated: ${result.rowCount}`);

    /* ---------- cleanup ---------- */

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (csvPath && fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

    return res.json({
      success: result.rowCount > 0,
      rowCount: result.rowCount,
      missingPlatformSkus: Array.from(meta.missingPlatformSkus)
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