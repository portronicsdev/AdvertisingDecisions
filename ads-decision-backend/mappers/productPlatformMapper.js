/**
 * Maps a CSV row to product_platforms table row
 * Skips rows with missing SKU or missing product
 */
let i = 9;
function mapProductPlatformRow(row, ctx, meta) {
  const rawSku = row['SKU'];
  const platformSku = row['Platform SKU'] || row['ASIN'];

  // Normalize values
  const sku = rawSku ? String(rawSku).trim() : null;

  if(i < 15)
  console.log('sku:', sku, 'platformSku:', platformSku);

    i++;    

  // Skip if SKU missing
  if (!sku) {
   
         console.log(`⚠️ Skipping row - SKU missing:`, row);
    return null;
  }

  // Lookup product_id from preloaded map
  if(i < 15)
  {
    console.log('skuMap type:', typeof meta.skuMap);
    console.log('has get:', typeof meta.skuMap.get);
      console.log('before metamap');

  }
const productId = meta.skuMap[sku];
   if(i < 15)
  console.log('after metamap');


  // If product not found → track and skip
  if (!productId) {
    console.log(`⚠️ Skipping row - SKU not found: ${sku}`);

    meta.missingSkus.add(sku);
    return null;
  }

  return {
    product_id: productId,
    platform_id: ctx.platformId,
    platform_sku: platformSku ? String(platformSku).trim() : null
  };
}

module.exports = {
  mapProductPlatformRow
};
