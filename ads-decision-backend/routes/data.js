const express = require('express');
const supabase = require('../config/database');

const router = express.Router();

/* ---------------- pagination ---------------- */

const parsePagination = (req) => {
  const limit = Math.min(parseInt(req.query.limit || '25', 10), 200);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
  return { limit, offset };
};

/* ---------------- config ---------------- */

const getConfig = (tableType) => {
  const config = {
    platforms: {
      table: 'platforms',
      select: 'platform_id, name, created_at',
      order: { column: 'name', ascending: true },
      mapRow: row => row
    },

    products: {
      table: 'products',
      select: 'product_id, sku, product_name, category, launch_date, active, created_at',
      order: { column: 'product_name', ascending: true },
      mapRow: row => row
    },

    'product-platforms': {
      table: 'product_platforms',
      select: `
        product_platform_id,
        platform_sku,
        created_at,
        products:products!inner(
          sku,
          product_name
        ),
        platforms:platforms!inner(
          name
        )
      `,
      order: { column: 'created_at', ascending: false },
      mapRow: row => ({
        product_platform_id: row.product_platform_id,
        sku: row.products?.sku,
        product_name: row.products?.product_name,
        platform_name: row.platforms?.name,
        platform_sku: row.platform_sku,
        created_at: row.created_at
      })
    },

    sellers: {
      table: 'sellers',
      select: `
        seller_id,
        name,
        active,
        created_at,
        platforms:platforms!inner(
          name
        )
      `,
      order: { column: 'name', ascending: true },
      mapRow: row => ({
        seller_id: row.seller_id,
        name: row.name,
        platform_name: row.platforms?.name,
        active: row.active,
        created_at: row.created_at
      })
    },

    sales: {
      table: 'sales_facts',
      select: `
        id,
        period_start_date,
        period_end_date,
        units_sold,
        revenue,
        created_at,
        sellers:sellers!inner(
          name
        ),
        product_platforms:product_platforms!inner(
          platform_sku,
          platforms:platforms!inner(
            name
          ),
          products:products!inner(
            sku,
            product_name
          )
        )
      `,
      order: { column: 'period_start_date', ascending: false },
      mapRow: row => ({
        id: row.id,
        platform_name: row.product_platforms?.platforms?.name,
        seller_name: row.sellers?.name,
        sku: row.product_platforms?.products?.sku,
        product_name: row.product_platforms?.products?.product_name,
        platform_sku: row.product_platforms?.platform_sku,
        period_start_date: row.period_start_date,
        period_end_date: row.period_end_date,
        units_sold: row.units_sold,
        revenue: row.revenue,
        created_at: row.created_at
      })
    },

    inventory: {
      table: 'inventory_facts',
      select: `
        id,
        snapshot_date,
        inventory_units,
        created_at,
        sellers:sellers!inner(
          name
        ),
        product_platforms:product_platforms!inner(
          platform_sku,
          platforms:platforms!inner(
            name
          ),
          products:products!inner(
            sku,
            product_name
          )
        )
      `,
      order: { column: 'snapshot_date', ascending: false },
      mapRow: row => ({
        id: row.id,
        platform_name: row.product_platforms?.platforms?.name,
        seller_name: row.sellers?.name,
        sku: row.product_platforms?.products?.sku,
        product_name: row.product_platforms?.products?.product_name,
        platform_sku: row.product_platforms?.platform_sku,
        snapshot_date: row.snapshot_date,
        inventory_units: row.inventory_units,
        created_at: row.created_at
      })
    },

    'ad-performance': {
      table: 'ad_performance_facts',
      select: `
        id,
        period_start_date,
        period_end_date,
        spend,
        revenue,
        ad_type,
        created_at,
        product_platforms:product_platforms!inner(
          platform_sku,
          platforms:platforms!inner(
            name
          ),
          products:products!inner(
            sku,
            product_name
          )
        )
      `,
      order: { column: 'period_start_date', ascending: false },
      mapRow: row => ({
        id: row.id,
        platform_name: row.product_platforms?.platforms?.name,
        sku: row.product_platforms?.products?.sku,
        product_name: row.product_platforms?.products?.product_name,
        platform_sku: row.product_platforms?.platform_sku,
        period_start_date: row.period_start_date,
        period_end_date: row.period_end_date,
        spend: row.spend,
        revenue: row.revenue,
        ad_type: row.ad_type,
        created_at: row.created_at
      })
    },

    ratings: {
      table: 'ratings_facts',
      select: `
        id,
        snapshot_date,
        rating,
        review_count,
        created_at,
        product_platforms:product_platforms!inner(
          platform_sku,
          platforms:platforms!inner(
            name
          ),
          products:products!inner(
            sku,
            product_name
          )
        )
      `,
      order: { column: 'snapshot_date', ascending: false },
      mapRow: row => ({
        id: row.id,
        platform_name: row.product_platforms?.platforms?.name,
        sku: row.product_platforms?.products?.sku,
        product_name: row.product_platforms?.products?.product_name,
        platform_sku: row.product_platforms?.platform_sku,
        snapshot_date: row.snapshot_date,
        rating: row.rating,
        review_count: row.review_count,
        created_at: row.created_at
      })
    },

    decisions: {
      table: 'decisions',
      select: `
        id,
        decision,
        reason,
        evaluated_at,
        sellers:sellers!inner(
          name
        ),
        product_platforms:product_platforms!inner(
          platform_sku,
          platforms:platforms!inner(
            name
          ),
          products:products!inner(
            sku,
            product_name
          )
        )
      `,
      order: { column: 'evaluated_at', ascending: false },
      mapRow: row => ({
        id: row.id,
        platform_name: row.product_platforms?.platforms?.name,
        seller_name: row.sellers?.name,
        sku: row.product_platforms?.products?.sku,
        product_name: row.product_platforms?.products?.product_name,
        platform_sku: row.product_platforms?.platform_sku,
        decision: row.decision,
        reason: row.reason,
        evaluated_at: row.evaluated_at
      })
    }
  };

  return config[tableType] || null;
};

/* ---------------- route ---------------- */

router.get('/:tableType', async (req, res) => {
  try {
    const { tableType } = req.params;
    const { search } = req.query;

    const config = getConfig(tableType);
    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid table type' });
    }

    const { limit, offset } = parsePagination(req);

    let query = supabase
      .from(config.table)
      .select(config.select, { count: 'exact' })
      .order(config.order.column, { ascending: config.order.ascending });

    if (search) {
      const like = `*${search.trim()}*`;
      query = query.or(
        `product_platforms.platform_sku.ilike.${like},product_platforms.products.sku.ilike.${like}`
      );
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      success: true,
      rows: (data || []).map(config.mapRow),
      count: count || 0,
      limit,
      offset
    });

  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch data'
    });
  }
});

module.exports = router;
