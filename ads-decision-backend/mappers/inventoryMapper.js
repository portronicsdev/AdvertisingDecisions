const intVal = v => (v ? parseInt(v, 10) : 0);

/**
 * Map inventory row
 * Uses platformMap instead of DB lookup (FAST)
 */
async function mapInventoryFactRow(row, ctx, meta) {
  
  const rawSku = row.ASIN || row['Platform SKU'];
  console.log('Raw SKU:', rawSku);
  const platformSku = rawSku ? String(rawSku).trim() : null;
  if (!platformSku) 
  {
    console.warn('⚠️ Missing SKU in row:', row);
    return null;
  }

  /* ---------- resolve product_platform_id ---------- */
  const productPlatformId = meta.platformMap[platformSku];
  if (!productPlatformId) {
    //console.warn(`⚠️ Missing platform SKU: ${platformSku}`);
    meta.missingPlatformSkus.add(platformSku);
    return null;
  }


  /* ---------- snapshot date ---------- */

  if (!ctx.snapshotDate) {
    console.error('❌ snapshot_date is required in context');
    throw new Error('snapshot_date is required');
  }

  return {
    product_platform_id: productPlatformId,
    seller_id: ctx.sellerId,
    snapshot_date: ctx.snapshotDate,
    inventory_units: intVal(row['Inventory Units'])
  };
}

module.exports = {
  mapInventoryFactRow
};