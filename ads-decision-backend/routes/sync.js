const express = require('express');
const supabase = require('../config/database');

const router = express.Router();

/* ---------------- helpers ---------------- */

const normalizeSkuForStorage = (sku) => {
  if (!sku) return null;
  return sku.toUpperCase().replace(/\s+/g, ' ').trim();
};

const normalizeSkuForMatch = (sku) => {
  if (!sku) return null;
  return sku.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
};

/* ---------------- fetch all existing SKUs ---------------- */

const fetchAllExistingSkus = async () => {
  let allRows = [];
  let from = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('sku_normalized')
      .range(from, from + limit - 1);

    if (error) throw error;

    if (!data || data.length === 0) break;

    allRows.push(...data);

    if (data.length < limit) break;

    from += limit;
  }

  return allRows;
};

/* ---------------- sync products ---------------- */

router.post('/products', async (req, res) => {
  try {
    console.log('🔄 Starting product sync...');

    const API_URL = process.env.PRODUCTS_API_URL;
    const API_KEY = process.env.PRODUCTS_API_KEY;

    if (!API_URL || !API_KEY) {
      throw new Error('Missing PRODUCTS_API_URL or PRODUCTS_API_KEY');
    }

    /* -------- 1. Fetch -------- */

    const response = await fetch(API_URL, {
      headers: { 'x-api-key': API_KEY }
    });

    if (!response.ok) {
      throw new Error(`External API failed: ${response.status}`);
    }

    const result = await response.json();
    const externalProducts = result.data || result || [];

    console.log(`📦 Fetched ${externalProducts.length} products`);

    if (!externalProducts.length) {
      return res.json({ success: true, inserted: 0, updated: 0, duplicates: [] });
    }

    /* -------- 2. Normalize + detect duplicates -------- */

    const map = new Map();
    const duplicatesMap = new Map();

    externalProducts.forEach(p => {
      const matchSku = normalizeSkuForMatch(p.sku);
      const storageSku = normalizeSkuForStorage(p.sku);

      if (!matchSku || !storageSku) return;

      const entry = {
        original_sku: p.sku,
        product_name: p.productName
      };

      if (map.has(matchSku)) {
        // duplicate detected

        if (!duplicatesMap.has(matchSku)) {
          // add first occurrence also
          duplicatesMap.set(matchSku, [
            {
              original_sku: map.get(matchSku).sku,
              product_name: map.get(matchSku).product_name
            }
          ]);
        }

        duplicatesMap.get(matchSku).push(entry);
      } else {
        map.set(matchSku, {
          sku: storageSku,
          sku_normalized: matchSku,
          product_name: p.productName,
          category: p.categoryName,
          active: true
        });
      }
    });

    const products = Array.from(map.values());

    const duplicates = Array.from(duplicatesMap.entries()).map(([matchSku, entries]) => ({
      matchSku,
      entries
    }));

    console.log(`🧹 Unique products: ${products.length}`);
    console.log(`⚠️ Duplicates found: ${duplicates.length}`);

    /* -------- 3. Fetch existing -------- */

    const existingRows = await fetchAllExistingSkus();

    const existingSet = new Set(existingRows.map(r => r.sku_normalized));

    let inserted = 0;
    let updated = 0;

    products.forEach(p => {
      if (existingSet.has(p.sku_normalized)) updated++;
      else inserted++;
    });

    /* -------- 4. UPSERT -------- */

    const now = new Date();

    const rows = products.map(p => ({
      sku: p.sku,
      sku_normalized: p.sku_normalized,
      product_name: p.product_name,
      category: p.category,
      active: true,
      updated_at: now
    }));

    const { error } = await supabase
      .from('products')
      .upsert(rows, {
        onConflict: 'sku_normalized'
      });

    if (error) throw error;

    console.log(`✅ Sync complete: inserted=${inserted}, updated=${updated}`);

    /* -------- 5. Response -------- */

    res.json({
      success: true,
      inserted,
      updated,
      total: rows.length,
      duplicates // 🔥 important
    });

  } catch (err) {
    console.error('❌ Sync failed:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;


/*const express = require('express');
const supabase = require('../config/database');

const router = express.Router();

//* ---------------- helpers ---------------

// readable SKU
const normalizeSkuForStorage = (sku) => {
  if (!sku) return null;
  return sku.toUpperCase().replace(/\s+/g, ' ').trim();
};

// matching SKU
const normalizeSkuForMatch = (sku) => {
  if (!sku) return null;
  return sku.toUpperCase().replace(/\s+/g, '').trim();
};

//* ---------------- sync products ---------------

router.post('/products', async (req, res) => {
  try {
    console.log('🔄 Starting product sync...');

    const API_URL = process.env.PRODUCTS_API_URL;
    const API_KEY = process.env.PRODUCTS_API_KEY;

    if (!API_URL || !API_KEY) {
      throw new Error('Missing env variables');
    }

    //* -------- 1. Fetch -------

    const response = await fetch(API_URL, {
      headers: { 'x-api-key': API_KEY }
    });

    if (!response.ok) {
      throw new Error(`External API failed: ${response.status}`);
    }

    const result = await response.json();
    const externalProducts = result.data || result || [];

    console.log(`📦 Fetched ${externalProducts.length} products`);

    if (!externalProducts.length) {
      return res.json({ success: true, inserted: 0, updated: 0 });
    }

    //* -------- 2. Normalize + dedupe --------

    const map = new Map();

    externalProducts.forEach(p => {
      const matchSku = normalizeSkuForMatch(p.sku);
      const storageSku = normalizeSkuForStorage(p.sku);

      if (!matchSku) return;

      map.set(matchSku, {
        sku: storageSku,
        sku_normalized: matchSku,
        product_name: p.productName,
        category: p.categoryName,
        active: true
      });
    });

    const products = Array.from(map.values());

    console.log(`🧹 Unique products: ${products.length}`);

    //* -------- 3. Count existing -------

    const { data: existing } = await supabase
      .from('products')
      .select('sku_normalized');

    const existingSet = new Set(existing.map(r => r.sku_normalized));

    let inserted = 0;
    let updated = 0;

    products.forEach(p => {
      if (existingSet.has(p.sku_normalized)) updated++;
      else inserted++;
    });

    //* -------- 4. UPSERT --------
    const now = new Date();

    const rows = products.map(p => ({
      ...p,
      updated_at: now
    }));

    const { error } = await supabase
      .from('products')
      .upsert(rows, {
        onConflict: 'sku_normalized'
      });

    if (error) throw error;

    console.log(`✅ inserted=${inserted}, updated=${updated}`);

    res.json({
      success: true,
      inserted,
      updated,
      total: rows.length
    });

  } catch (err) {
    console.error('❌ Sync failed:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
*/