const { resolveProductPlatformId } = require('../services/productPlatformService');

const floatVal = v => (v ? parseFloat(v) : 0);

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

async function mapAdPerformanceFactRow(row, ctx) {
  const platformSku = row.ASIN;

  if (!platformSku) return null;

  const product_platform_id = await resolveProductPlatformId({
    platformId: ctx.platformId,
    platformSku
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

module.exports = {
  mapAdPerformanceFactRow
};
