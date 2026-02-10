const express = require('express');
const { getProductSummaryReport } = require('../services/reportService');

const router = express.Router();

/**
 * GET /api/reports/product-summary
 *
 * Query params:
 * - range = last_month | current_month | last_quarter | custom
 * - start, end (required if range=custom)
 * - search
 * - limit
 * - offset
 */
router.get('/product-summary', async (req, res) => {
  try {
    const {
      range = 'last_month',
      start,
      end,
      search = '',
      limit = '50',
      offset = '0'
    } = req.query;

    const result = await getProductSummaryReport({
      range,
      start,
      end,
      search,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    res.json({
      success: true,
      ...result
    });

  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate report'
    });
  }
});

module.exports = router;
