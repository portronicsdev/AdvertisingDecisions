const supabase = require('../config/database');

async function buildSkuMap(skus) {
  if (!skus.length) {
    console.log('⚠️ No SKUs provided');
    return {};
  }

  console.log(`📦 Fetching ${skus.length} SKUs from products`);

  const BATCH_SIZE = 500;
  const map = {};
  let totalFound = 0;

  for (let i = 0; i < skus.length; i += BATCH_SIZE) {
    const batch = skus.slice(i, i + BATCH_SIZE);

    console.log(`🔹 Batch ${i / BATCH_SIZE + 1}: ${batch.length} SKUs`);

    const { data, error } = await supabase
      .from('products')
      .select('product_id, sku')
      .in('sku', batch);

    if (error) {
      console.error('❌ DB error:', error);
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    console.log(`   ✅ Found ${data.length} products in DB`);

    totalFound += data.length;

    data.forEach(row => {
      map[row.sku] = row.product_id;
    });
  }

  console.log(`📊 Total matched SKUs: ${totalFound}/${skus.length}`);

  // 🔥 DEBUG missing SKUs
  const missing = skus.filter(sku => !map[sku]);

  if (missing.length) {
    console.log(`⚠️ Missing SKUs: ${missing.length}`);
    console.log('Sample missing SKUs:', missing.slice(0, 10));
  }

  return map;
}

module.exports = { buildSkuMap };