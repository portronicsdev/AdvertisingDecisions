const supabase = require('../config/database');

/* ---------------- date helpers ---------------- */

function resolveDateRange({ range, start, end }) {
  const today = new Date();
  const toISO = d => d.toISOString().slice(0, 10);

  if (range === 'custom') {
    if (!start || !end) {
      throw new Error('start and end required for custom range');
    }
    return { start, end };
  }

  if (range === 'current_month') {
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: toISO(s), end: toISO(today) };
  }

  if (range === 'last_month') {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const e = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: toISO(s), end: toISO(e) };
  }

  if (range === 'last_quarter') {
    const q = Math.floor(today.getMonth() / 3);
    const s = new Date(today.getFullYear(), (q - 1) * 3, 1);
    const e = new Date(today.getFullYear(), q * 3, 0);
    return { start: toISO(s), end: toISO(e) };
  }
  if (range === 'current_quarter') {
  const q = Math.floor(today.getMonth() / 3);
  const s = new Date(today.getFullYear(), q * 3, 1);
  return { start: toISO(s), end: toISO(today) };
}


  throw new Error(`Invalid range: ${range}`);
}

/* ---------------- main service ---------------- */

async function getProductSummaryReport({
  range,
  start,
  end,
  search,
  limit,
  offset
}) {
  const { start: rangeStart, end: rangeEnd } =
    resolveDateRange({ range, start, end });


    console.log('Generating product summary report with params:', {
      range,
      rangeStart,
      rangeEnd,
    });

  /* ---------- base products ---------- */

  let baseQuery = supabase
    .from('product_platforms')
    .select(
      `
      product_platform_id,
      platform_sku,
      products!inner (
        sku,
        product_name
      )
    `,
      { count: 'exact' }
    )
    .order('product_platform_id', { ascending: true });

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;

    baseQuery = baseQuery.or(`platform_sku.ilike.${like}`);
    baseQuery = baseQuery.or(
      `sku.ilike.${like},product_name.ilike.${like}`,
      { foreignTable: 'products' }
    );
  }

  baseQuery = baseQuery.range(offset, offset + limit - 1);

  const { data: baseRows, count, error } = await baseQuery;
  if (error) throw error;

  if (!baseRows || baseRows.length === 0) {
    return {
      range: { start: rangeStart, end: rangeEnd },
      rows: [],
      count: 0,
      limit,
      offset
    };
  }

  const ppIds = baseRows.map(r => r.product_platform_id);

  /* ---------- sales (STRICT inside period) ---------- */

  const { data: salesRows } = await supabase
    .from('sales_facts')
    .select(`
      product_platform_id,
      units_sold,
      sellers!inner(name)
    `)
    .in('product_platform_id', ppIds)
    .gte('period_start_date', rangeStart)
    .lte('period_end_date', rangeEnd);

  /* ---------- inventory (STRICT inside period via RPC) ---------- */

  const { data: inventoryRows } = await supabase.rpc(
    'latest_inventory_in_period',
    {
      pp_ids: ppIds,
      start_date: rangeStart,
      end_date: rangeEnd
    }
  );

  /* ---------- ratings (STRICT inside period via RPC) ---------- */

  const { data: ratingsRows } = await supabase.rpc(
    'latest_ratings_in_period',
    {
      pp_ids: ppIds,
      start_date: rangeStart,
      end_date: rangeEnd
    }
  );

  /* ---------- ad performance (STRICT inside period) ---------- */

  const { data: roasRows } = await supabase
    .from('ad_performance_facts')
    .select('product_platform_id, spend, revenue')
    .in('product_platform_id', ppIds)
    .gte('period_start_date', rangeStart)
    .lte('period_end_date', rangeEnd);

  /* ---------- missing data detection ---------- */

  const hasSales = salesRows && salesRows.length > 0;
  const hasAds = roasRows && roasRows.length > 0;
  const hasInventory = inventoryRows && inventoryRows.length > 0;
  const hasRatings = ratingsRows && ratingsRows.length > 0;

  const missing = [];

  if (!hasSales) missing.push('Sales');
  if (!hasAds) missing.push('Ad Performance');
  if (!hasInventory) missing.push('Inventory');
  if (!hasRatings) missing.push('Ratings');

  if (!hasSales && !hasAds && !hasInventory && !hasRatings) {
    return {
      range: { start: rangeStart, end: rangeEnd },
      rows: [],
      count: 0,
      limit,
      offset,
      message: 'No data available for selected period'
    };
  }

  /* ---------- build maps ---------- */

  const salesMap = {};
  for (const r of salesRows || []) {
    const pid = r.product_platform_id;
    const seller = r.sellers?.name || 'Unknown';
    salesMap[pid] ??= {};
    salesMap[pid][seller] =
      (salesMap[pid][seller] || 0) + (r.units_sold || 0);
  }

  const inventoryMap = {};
  for (const r of inventoryRows || []) {
    inventoryMap[r.product_platform_id] ??= {};
    inventoryMap[r.product_platform_id][r.seller_name] =
      (inventoryMap[r.product_platform_id][r.seller_name] || 0) +
      (r.inventory_units || 0);
  }

  const ratingsMap = {};
  for (const r of ratingsRows || []) {
    ratingsMap[r.product_platform_id] = {
      rating: r.rating,
      review_count: r.review_count
    };
  }

  const roasMap = {};
  for (const r of roasRows || []) {
    roasMap[r.product_platform_id] ??= { spend: 0, revenue: 0 };
    roasMap[r.product_platform_id].spend += r.spend || 0;
    roasMap[r.product_platform_id].revenue += r.revenue || 0;
  }

  /* ---------- final rows ---------- */

  const rows = baseRows.map(r => {
    const pid = r.product_platform_id;

    const salesBySeller = salesMap[pid] || {};
    const inventoryBySeller = inventoryMap[pid] || {};

    const salesTotal = Object.values(salesBySeller)
      .reduce((sum, v) => sum + (v || 0), 0);

    const inventoryTotal = Object.values(inventoryBySeller)
      .reduce((sum, v) => sum + (v || 0), 0);

    return {
      product_platform_id: pid,
      sku: r.products.sku,
      product_name: r.products.product_name,
      platform_sku: r.platform_sku,

      sales_by_seller: salesBySeller,
      sales_total: salesTotal,

      inventory_by_seller: inventoryBySeller,
      inventory_total: inventoryTotal,

      rating: ratingsMap[pid]?.rating ?? null,
      review_count: ratingsMap[pid]?.review_count ?? null,

      roas: roasMap[pid]
        ? roasMap[pid].revenue / (roasMap[pid].spend || 1)
        : null
    };
  });

  /* ---------- final return ---------- */

  let warning = null;
  if (missing.length > 0) {
    warning = `No data found for: ${missing.join(', ')}`;
  }

  return {
    range: { start: rangeStart, end: rangeEnd },
    rows,
    count,
    limit,
    offset,
    warning
  };
}

module.exports = {
  getProductSummaryReport
};
