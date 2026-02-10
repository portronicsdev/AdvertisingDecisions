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

  /* ---------- SAFE SEARCH (split by table) ---------- */

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;

    // search on product_platforms
    baseQuery = baseQuery.or(`platform_sku.ilike.${like}`);

    // search on products table
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

  /* ---------- sales aggregation ---------- */

  const { data: salesRows } = await supabase
    .from('sales_facts')
    .select(
      `
      product_platform_id,
      units_sold,
      sellers!inner(name)
    `
    )
    .in('product_platform_id', ppIds)
    .lte('period_start_date', rangeEnd)
    .gte('period_end_date', rangeStart);

  /* ---------- inventory (latest snapshot) ---------- */

  const { data: inventoryRows } = await supabase.rpc(
    'latest_inventory_by_pp',
    {
      pp_ids: ppIds,
      max_date: rangeEnd
    }
  );

  /* ---------- ratings (latest snapshot) ---------- */

  const { data: ratingsRows } = await supabase.rpc(
    'latest_ratings_by_pp',
    {
      pp_ids: ppIds,
      max_date: rangeEnd
    }
  );

  /* ---------- ROAS ---------- */

  const { data: roasRows } = await supabase
    .from('ad_performance_facts')
    .select('product_platform_id, spend, revenue')
    .in('product_platform_id', ppIds)
    .lte('period_start_date', rangeEnd)
    .gte('period_end_date', rangeStart);

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
      r.inventory_units || 0;
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

    // ✅ EXACTLY what frontend expects
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

console.log(
  'REPORT ROW SAMPLE:',
  JSON.stringify(rows[0], null, 2)
);


  return {
    range: { start: rangeStart, end: rangeEnd },
    rows,
    count,
    limit,
    offset
  };
}

module.exports = {
  getProductSummaryReport
};
