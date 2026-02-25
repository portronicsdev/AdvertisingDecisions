const intVal = v => (v ? parseInt(v, 10) : 0);
const floatVal = v => (v ? parseFloat(v) : 0);

/**
 * Map ratings row using platformMap (FAST, no DB calls)
 */
async function mapRatingsFactRow(row, ctx, meta) {
  const rawSku = row.ASIN || row['Platform SKU'];

  const platformSku = rawSku ? String(rawSku).trim() : null;

  if (!platformSku) return null;

   /* ---------- resolve product_platform_id ---------- */
  const productPlatformId = meta.platformMap[platformSku];
  if (!productPlatformId) {
    //console.warn(`⚠️ Missing platform SKU: ${platformSku}`);
    meta.missingPlatformSkus.add(platformSku);
    return null;
  }

  /* ---------- snapshot ---------- */

  if (!ctx.snapshotDate) {
    throw new Error('snapshot_date is required');
  }

  return {
    product_platform_id: productPlatformId,
    snapshot_date: ctx.snapshotDate,
    rating: floatVal(row.Ratings),
    review_count: intVal(row['Review Count'])
  };
}

module.exports = {
  mapRatingsFactRow
};