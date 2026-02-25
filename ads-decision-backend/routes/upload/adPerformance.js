const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const supabase = require('../../config/database');

const { excelToCsv } = require('../../utils/excelToCsv');
const { ingestCsv } = require('../../services/ingestionService');
const { mapAdPerformanceFactRow } = require('../../mappers/adPerformanceMapper');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads/temp');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

async function getPlatformId(name) {
  const { data } = await supabase
    .from('platforms')
    .select('platform_id')
    .eq('name', name)
    .single();

  if (!data) throw new Error('Invalid platform');
  return data.platform_id;
}

router.post('/', upload.single('file'), async (req, res) => {
  let csvPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'File missing' });
    }

    const platformId = await getPlatformId(req.body.platform);

    const context = {
      platformId,
      adType: req.body.ad_type
    };

    csvPath = await excelToCsv(req.file.path, uploadDir);

    const result = await ingestCsv(
      csvPath,
      'ad_performance_facts',
      (row) => mapAdPerformanceFactRow(row, context)
    );

    fs.unlinkSync(req.file.path);
    fs.unlinkSync(csvPath);

    return res.json({
      success: result.rowCount > 0,
      ...result
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
