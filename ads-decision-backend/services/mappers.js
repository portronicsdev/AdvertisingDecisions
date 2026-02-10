const supabase = require('../config/database');

/* ------------------ small helpers ------------------ */

const normalize = v => (v ? String(v).trim() : null);
const intVal = v => (v ? parseInt(v, 10) : 0);
const floatVal = v => (v ? parseFloat(v) : 0);

/* ------------------ date helpers ------------------ */

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

function weekToRange(week, month, year) {
  const w = parseInt(String(week).replace('W', ''), 10);
  const m = new Date(`${month} 1, ${year}`).getMonth();
  const start = new Date(year, m, (w - 1) * 7 + 1);
  const end = new Date(year, m, Math.min(start.getDate() + 6, 31));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

/* ------------------ product_platform cache ------------------ */

let PRODUCT_PLATFORM_MAP = null;

/**
 * Loads all product_platform mappings once.
 * Key: platformId::platformSku
 * Value: product_platform_id
 */
async function loadProductPlatformMap() {
  if (PRODUCT_PLATFORM_MAP) return PRODUCT_PLATFORM_MAP;

  console.log('📦 Loading product_platforms map...');
  const { data, error } = await supabase
    .from('product_platforms')
    .select('product_platform_id, platform_id, platform_sku');

  if (error) throw error;

  PRODUCT_PLATFORM_MAP = new Map();
  for (const row of data) {
    if (!row.platform_sku) continue;
    const key = `${row.platform_id}::${row.platform_sku.trim()}`;
    PRODUCT_PLATFORM_MAP.set(key, row.product_platform_id);
  }

  console.log(`✅ Cached ${PRODUCT_PLATFORM_MAP.size} product_platform mappings`);
  return PRODUCT_PLATFORM_MAP;
}

async function resolveProductPlatformId({ platformId, platformSku }) {
  if (!platformSku) {
    throw new Error('platformSku / ASIN is required');
  }

  const map = await loadProductPlatformMap();
  const key = `${platformId}::${platformSku}`;

  const id = map.get(key);
  if (!id) {
    throw new Error(`product_platform not found for platform=${platformId}, sku=${platformSku}`);
  }
  return id;
}
function parseDDMonYY(value) {
  if (!value) return null;

  // Matches: 1Jan'26, 12Feb'25
  const m = String(value).trim().match(/^(\d{1,2})([A-Za-z]{3})'?(\d{2})$/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const mon = m[2].toLowerCase();
  const year = 2000 + parseInt(m[3], 10);

  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  if (!(mon in monthMap)) return null;

  return new Date(year, monthMap[mon], day)
    .toISOString()
    .slice(0, 10);
}

/* ------------------ mappers ------------------ */

async function mapSalesFactRow(row, ctx) {
  const product_platform_id = await resolveProductPlatformId({
    platformId: ctx.platformId,
    platformSku: normalize(row.ASIN)
  });

  let start, end;

  // 1) DAILY: Date like 1Jan'26
  if (row.Date) {
    const parsed = parseDDMonYY(row.Date);
    if (!parsed) {
      throw new Error(`Invalid Date format: ${row.Date}`);
    }
    start = end = parsed;
  }

  // 2) WEEKLY
  else if (row.Week && row.Month && row.Year) {
    ({ start, end } = weekToRange(row.Week, row.Month, row.Year));
  }

  // 3) MONTHLY
  else if (row.Month && row.Year) {
    start = new Date(`${row.Month} 1, ${row.Year}`)
      .toISOString()
      .slice(0, 10);
    end = new Date(start.slice(0, 7) + '-31')
      .toISOString()
      .slice(0, 10);
  }

  else {
    throw new Error('Sales row missing date info');
  }

  return {
    product_platform_id,
    seller_id: ctx.sellerId,
    period_start_date: start,
    period_end_date: end,
    units_sold: intVal(row['Units Sold']),
    revenue: floatVal(row['Shipped Revenue'])
  };
}


async function mapInventoryFactRow(row, ctx) {
  const product_platform_id = await resolveProductPlatformId({
    platformId: ctx.platformId,
    platformSku: normalize(row.ASIN)
  });

  return {
    product_platform_id,
    seller_id: ctx.sellerId,
    snapshot_date: ctx.snapshotDate,
    inventory_units: intVal(row['Inventory Units'])
  };
}

async function mapAdPerformanceFactRow(row, ctx) {
  const product_platform_id = await resolveProductPlatformId({
    platformId: ctx.platformId,
    platformSku: normalize(row.ASIN)
  });

  const { start, end } = weekToRange(row.Week, row.Month, row.Year);

  return {
    product_platform_id,
    period_start_date: start,
    period_end_date: end,
    spend: floatVal(row.Spend),
    revenue: floatVal(row.Revenue),
    ad_type: ctx.adType
  };
}

async function mapRatingsFactRow(row, ctx) {
  const product_platform_id = await resolveProductPlatformId({
    platformId: ctx.platformId,
    platformSku: normalize(row.ASIN)
  });

  return {
    product_platform_id,
    snapshot_date: ctx.snapshotDate,
    rating: floatVal(row.Ratings),
    review_count: intVal(row['Review Count'])
  };
}

/* ------------------ exports ------------------ */

module.exports = {
  mapSalesFactRow,
  mapInventoryFactRow,
  mapAdPerformanceFactRow,
  mapRatingsFactRow
};
