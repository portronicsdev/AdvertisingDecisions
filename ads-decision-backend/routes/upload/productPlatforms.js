const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const supabase = require('../../config/database');

const { excelToCsv } = require('../../utils/excelToCsv');
const { extractSkus } = require('../../utils/csvHelpers');
const { buildSkuMap } = require('../../services/productService');
const { ingestCsv } = require('../../services/ingestionService');
const { mapProductPlatformRow } = require('../../mappers/productPlatformMapper');

const router = express.Router();

/* ---------------- multer setup ---------------- */

const uploadDir = path.join(__dirname, '../../uploads/temp');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Only Excel files allowed'));
  }
});

/* ---------------- helpers ---------------- */

async function getPlatformId(name) {
  const { data, error } = await supabase
    .from('platforms')
    .select('platform_id')
    .eq('name', name)
    .single();

  if (error || !data) {
    throw new Error(`Invalid platform: ${name}`);
  }

  return data.platform_id;
}

/* ---------------- route ---------------- */

router.post('/', upload.single('file'), async (req, res) => {
  let csvPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'File missing'
      });
    }

    const platformName = req.body.platform;

    if (!platformName) {
      return res.status(400).json({
        success: false,
        error: 'platform is required'
      });
    }

    /* ---------- get platform ---------- */

    const platformId = await getPlatformId(platformName);

    /* ---------- convert excel → csv ---------- */

    csvPath = await excelToCsv(req.file.path, uploadDir);

    /* ---------- extract SKUs ---------- */

    const skus = await extractSkus(csvPath);
    console.log(`📊 Extracted ${skus.length} unique SKUs`);
    console.log('🔍 Sample SKUs:', skus.slice(0, 10));

    /* ---------- build product map ---------- */

    const skuMap = await buildSkuMap(skus);
    console.log('🧠 SKU Map size:', Object.keys(skuMap).length);
    

    /* ---------- meta ---------- */

    const meta = {
      skuMap,
      missingSkus: new Set()
    };

    /* ---------- ingest ---------- */

    const result = await ingestCsv(
      csvPath,
      'product_platforms',
      (row) => mapProductPlatformRow(row, { platformId }, meta),
      {
        upsert: true,
        onConflict: 'product_id,platform_id'
      }
    );

    /* ---------- cleanup ---------- */

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (csvPath && fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

    /* ---------- response ---------- */

    return res.json({
      success: result.rowCount > 0,
      table: 'product_platforms',
      rowCount: result.rowCount,
      batchCount: result.batchCount,
      skippedRowCount: result.skippedRowCount,
      errorRowCount: result.errorRowCount,
      errorRows: result.errorRows,

      missingSkus: Array.from(meta.missingSkus),

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
      error: err.message || 'Upload failed'
    });
  }
});

module.exports = router;
