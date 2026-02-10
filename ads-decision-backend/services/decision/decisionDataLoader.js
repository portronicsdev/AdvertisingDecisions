const supabase = require('../config/database');

async function preloadDecisionData({ platformIds }) {

  // --- SALES (30 days) ---
  const { data: sales } = await supabase.rpc('sales_30d_agg');
  const salesMap = {};
  sales?.forEach(r => {
    const avg = r.total_units / (r.days || 1);
    salesMap[r.product_platform_id] = avg;
  });

  // --- SELLER INVENTORY (latest) ---
  const { data: sellerInv } = await supabase
    .from('inventory_facts')
    .select('product_platform_id, seller_id, inventory_units')
    .order('snapshot_date', { ascending: false });

  const sellerInventoryMap = {};
  sellerInv?.forEach(r => {
    sellerInventoryMap[r.product_platform_id] ??= {};
    if (!(r.seller_id in sellerInventoryMap[r.product_platform_id])) {
      sellerInventoryMap[r.product_platform_id][r.seller_id] = r.inventory_units;
    }
  });

  // --- COMPANY INVENTORY ---
  const { data: companyInv } = await supabase.rpc('company_inventory_latest');
  const companyInventoryMap = {};
  companyInv?.forEach(r => {
    companyInventoryMap[r.product_id] = r.total_inventory;
  });

  // --- RATINGS ---
  const { data: ratings } = await supabase
    .from('ratings_facts')
    .select('product_platform_id, rating')
    .order('snapshot_date', { ascending: false });

  const ratingMap = {};
  ratings?.forEach(r => {
    if (!(r.product_platform_id in ratingMap)) {
      ratingMap[r.product_platform_id] = r.rating;
    }
  });

  // --- ADS (30 days) ---
  const { data: ads } = await supabase.rpc('ads_30d_agg');
  const roasMap = {};
  ads?.forEach(r => {
    roasMap[r.product_platform_id] =
      r.total_spend === 0 ? 999 : r.total_revenue / r.total_spend;
  });

  return {
    salesMap,
    sellerInventoryMap,
    companyInventoryMap,
    ratingMap,
    roasMap
  };
}

module.exports = { preloadDecisionData };
