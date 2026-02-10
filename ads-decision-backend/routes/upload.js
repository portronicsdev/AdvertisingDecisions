const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const supabase = require('../config/database');
const { excelToCsv } = require('../utils/excelToCsv');
const { ingestCsv } = require('../services/ingestionService');

const {
  mapSalesFactRow,
  mapInventoryFactRow,
  mapAdPerformanceFactRow,
  mapRatingsFactRow
} = require('../services/mappers');

const router = express.Router();

/* ---------------- multer setup ---------------- */

const uploadDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Only Excel files allowed'));
  }
});

/* ---------------- helpers ---------------- */

async function getPlatformId(platformName) {
  const { data, error } = await supabase
    .from('platforms')
    .select('platform_id')
    .eq('name', platformName)
    .single();

  if (error || !data) {
    throw new Error(`Invalid platform: ${platformName}`);
  }
  return data.platform_id;
}

/* ---------------- route ---------------- */

/**
 * POST /api/upload/:type
 * type = sales | inventory | ad-performance | ratings
 */
router.post('/:type', upload.single('file'), async (req, res) => {
  const { type } = req.params;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'File missing' });
    }

    /* ---------- context from UI ---------- */

    const platformName = req.body.platform;
    if (!platformName) {
      return res.status(400).json({
        success: false,
        error: 'platform is required'
      });
    }

    const platformId = await getPlatformId(platformName);

    const context = {
      platformId,
      sellerId: req.body.seller_id
        ? parseInt(req.body.seller_id, 10)
        : null,
      snapshotDate: req.body.snapshot_date || null,
      adType: req.body.ad_type || null
    };

    if (
      (type === 'inventory' || type === 'ratings') &&
      !context.snapshotDate
    ) {
        console.log('Params ', req.body)
      return res.status(400).json({
        success: false,
        error: 'snapshot_date is required for inventory and ratings'
      });
    }

    /* ---------- mapper & table ---------- */

    const mapperByType = {
      sales: mapSalesFactRow,
      inventory: mapInventoryFactRow,
      'ad-performance': mapAdPerformanceFactRow,
      ratings: mapRatingsFactRow
    };

    const tableByType = {
      sales: 'sales_facts',
      inventory: 'inventory_facts',
      'ad-performance': 'ad_performance_facts',
      ratings: 'ratings_facts'
    };

    const mapper = mapperByType[type];
    const tableName = tableByType[type];

    if (!mapper) {
      return res.status(400).json({
        success: false,
        error: `Invalid upload type: ${type}`
      });
    }

    /* ---------- excel → csv ---------- */

    const csvPath = await excelToCsv(req.file.path, uploadDir);

    /* ---------- ingestion ---------- */

    const result = await ingestCsv(csvPath, tableName, (row) =>
      mapper(row, context)
    );

    /* ---------- cleanup ---------- */

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

    /* ---------- success logic (IMPORTANT) ---------- */

    const inserted = result.rowCount || 0;
    const success = inserted > 0;

    return res.json({
      success,
      table: tableName,
      rowCount: inserted,
      batchCount: result.batchCount || 0,
      skippedRowCount: result.skippedRowCount || 0,
      errorRowCount: result.errorRowCount || 0,
      errorRows: result.errorRows || [],
      message: success
        ? `Imported ${inserted} rows`
        : 'No rows were inserted'
    });

  } catch (err) {
    console.error('Upload failed:', err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      error: err.message || 'Upload failed'
    });
  }
});

module.exports = router;
