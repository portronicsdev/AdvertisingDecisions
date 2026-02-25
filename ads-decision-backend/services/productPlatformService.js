const supabase = require('../config/database');

let CACHE = null;

/* ================= EXISTING ================= */

/**
 * Loads product_platforms into memory (once)
 * Key: platformId::platformSku → product_platform_id
 */
async function loadProductPlatformMap() {
  if (CACHE) return CACHE;

  console.log('📦 Loading product_platforms...');

  const { data, error } = await supabase
    .from('product_platforms')
    .select('product_platform_id, platform_id, platform_sku');

  if (error) throw error;

  CACHE = new Map();

  for (const row of data) {
    if (!row.platform_sku) continue;

    const key = buildKey(row.platform_id, row.platform_sku);
    CACHE.set(key, row.product_platform_id);
  }

  console.log(`✅ Loaded ${CACHE.size} product_platform mappings`);

  return CACHE;
}

/**
 * Resolve product_platform_id
 */
async function resolveProductPlatformId({ platformId, platformSku }) {
  if (!platformSku) {
    throw new Error('platformSku is required');
  }

  const map = await loadProductPlatformMap();

  const key = buildKey(platformId, platformSku);
  const id = map.get(key);

  if (!id) {
    throw new Error(
      `product_platform not found (platformId=${platformId}, sku=${platformSku})`
    );
  }

  return id;
}

/* ================= NEW ================= */

/**
 * Build platformSku → { product_id, platform_id }
 * Used when platform is NOT known
 */
async function buildPlatformSkuMap(platformSkus) {
  if (!platformSkus.length) return {};

  console.log(`📦 Fetching ${platformSkus.length} platform SKUs`);

  const map = {};

  const chunkSize = 500;

  for (let i = 0; i < platformSkus.length; i += chunkSize) {
    const chunk = platformSkus.slice(i, i + chunkSize);

    const { data, error } = await supabase
      .from('product_platforms')
      .select('product_platform_id, platform_sku')
      .in('platform_sku', chunk);

    if (error) throw error;

    for (const row of data) {
      if (!row.platform_sku) continue;

      map[String(row.platform_sku).trim()] = row.product_platform_id;
    }
  }

  console.log(`✅ Platform SKU map size: ${Object.keys(map).length}`);

  return map;
}

/* ================= helpers ================= */

function buildKey(platformId, platformSku) {
  return `${platformId}::${String(platformSku).trim()}`;
}

function resetCache() {
  CACHE = null;
}

module.exports = {
  resolveProductPlatformId,
  loadProductPlatformMap,
  buildPlatformSkuMap,
  resetCache
};