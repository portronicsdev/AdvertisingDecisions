const supabase = require('../config/database');

/**
 * Maps CSV row to products table format
 */
async function mapProductRow(row) {
    const sku = row['SKU'] || '';
    if (!sku) {
        throw new Error('SKU is required');
    }
    
    const productName = row['Product Name'] || null;
    
    // If product_name is missing, use SKU as fallback (since it's required in DB)
    const finalProductName = productName || sku;
    
    return {
        sku: sku,
        product_name: finalProductName,
        category: row['Category'] || null,
        launch_date: row['Launch Date'] || null,
        active: row['Active'] !== undefined ? (row['Active'] === 'true' || row['Active'] === true || row['Active'] === 'TRUE') : true
    };
}

/**
 * Maps CSV row to product_platforms table format
 * Products are fetched from PostgreSQL
 */
// Cache products and platforms in memory (fetched once)
let productsCache = null;
let productsCacheLoaded = false;
let platformsCache = null;
let platformsCacheLoaded = false;
let productPlatformsCache = null;
let productPlatformsCacheLoaded = false;

// Normalize SKU: trim and replace multiple spaces with single space
function normalizeSku(sku) {
    if (!sku) return '';
    return sku.trim().replace(/\s+/g, ' ');
}

// Load products cache once
async function loadProductsCache() {
    if (productsCacheLoaded) return productsCache;
    
    console.log('📦 Loading products cache...');
    const { data: products, error, count } = await supabase
        .from('products')
        .select('product_id, sku');
    
    if (error) {
        throw new Error(`Cannot access products table: ${error.message}`);
    }
    
    if (!products || products.length === 0) {
        throw new Error('Products table is empty. Please upload products first using "Import Products".');
    }
    
    // Normalize all SKUs and create lookup map
    productsCache = products.map(p => ({
        product_id: p.product_id,
        sku: p.sku,
        normalizedSku: normalizeSku(p.sku)
    }));
    
    productsCacheLoaded = true;
    console.log(`✅ Loaded ${productsCache.length} products into cache`);
    return productsCache;
}

// Find product by normalized SKU from cache
function findProductBySku(normalizedSku) {
    if (!productsCache) {
        throw new Error('Products cache not loaded. Call loadProductsCache() first.');
    }
    
    return productsCache.find(p => p.normalizedSku === normalizedSku);
}

// Load product_platforms cache once (platform_sku -> product_platform_id)
async function loadProductPlatformsCache() {
    if (productPlatformsCacheLoaded) return productPlatformsCache;

    console.log('📦 Loading product_platforms cache...');
    const { data: rows, error } = await supabase
        .from('product_platforms')
        .select('product_platform_id, platform_sku');

    if (error) {
        throw new Error(`Cannot access product_platforms table: ${error.message}`);
    }

    if (!rows || rows.length === 0) {
        throw new Error('product_platforms table is empty. Please upload product-platforms first.');
    }

    productPlatformsCache = rows.reduce((map, row) => {
        const key = (row.platform_sku || '').trim();
        if (key) {
            map[key] = row.product_platform_id;
        }
        return map;
    }, {});

    productPlatformsCacheLoaded = true;
    console.log(`✅ Loaded ${rows.length} product_platforms into cache`);
    return productPlatformsCache;
}

async function mapProductPlatformRow(row) {
    // Ensure cache is loaded
    await loadProductsCache();
    
    // Get and normalize SKU from row
    const inputSku = normalizeSku(row['SKU'] || '');
    
    if (!inputSku) {
        throw new Error(`SKU is required. Available columns: ${Object.keys(row).join(', ')}`);
    }
    
    // Find product from cache (no DB query!)
    const productData = findProductBySku(inputSku);

    if (!productData) {
        throw new Error(`Product not found for SKU: "${inputSku}". Please ensure this product exists in the products table.`);
    }
    
    return {
        product_id: productData.product_id,
        platform_id: await getPlatformId(row),
        platform_sku: normalizeSku(row['Platform SKU'] || row['ASIN'] || '') || null
    };
}

// Load platforms cache once
async function loadPlatformsCache() {
    if (platformsCacheLoaded) return platformsCache;
    
    console.log('📦 Loading platforms cache...');
    const { data: platforms, error } = await supabase
        .from('platforms')
        .select('platform_id, name');
    
    if (error) {
        throw new Error(`Cannot access platforms table: ${error.message}`);
    }
    
    if (!platforms || platforms.length === 0) {
        throw new Error('Platforms table is empty. Please initialize platforms first.');
    }
    
    // Create lookup map by name
    platformsCache = platforms.reduce((map, p) => {
        map[p.name.toLowerCase()] = p.platform_id;
        return map;
    }, {});
    
    platformsCacheLoaded = true;
    console.log(`✅ Loaded ${platforms.length} platforms into cache`);
    return platformsCache;
}

async function getPlatformId(row) {
    const platform = (row['Platform'] || '').trim();
    
    if (!platform) {
        throw new Error(`Platform is required. Available columns: ${Object.keys(row).join(', ')}`);
    }
    
    // Ensure cache is loaded
    await loadPlatformsCache();
    
    // Find platform from cache (no DB query!)
    const platformId = platformsCache[platform.toLowerCase()];
    
    if (!platformId) {
        throw new Error(`Platform not found: "${platform}". Available platforms: Check platforms table.`);
    }
    
    return platformId;
}

/**
 * Maps CSV row to sales_facts table format
 */
async function mapSalesFactRow(row) {
    const productPlatformId = await getProductPlatformId(row);
    if (!productPlatformId) return null;
    
    return {
        product_platform_id: productPlatformId,
        period_start_date: row['Period Start (YYYY-MM-DD)'] || null,
        period_end_date: row['Period End (YYYY-MM-DD)'] || null,
        units_sold: parseInt(row['Units Sold'] || 0),
        revenue: 0
    };
}

/**
 * Maps CSV row to inventory_facts table format
 */
async function mapInventoryFactRow(row) {
    const productPlatformId = await getProductPlatformId(row);
    if (!productPlatformId) return null;
    
    return {
        product_platform_id: productPlatformId,
        snapshot_date: row['Snapshot Date'] || null,
        inventory_units: parseInt(row['Inventory Units'] || 0)
    };
}

/**
 * Maps CSV row to company_inventory_facts table format
 * Products are fetched from PostgreSQL
 */
async function mapCompanyInventoryFactRow(row) {
    const inputSku = normalizeSku(row['SKU'] || '');
    if (!inputSku) return null;
    
    // Ensure cache is loaded
    await loadProductsCache();
    
    // Find product from cache (no DB query!)
    const productData = findProductBySku(inputSku);
    
    if (!productData) {
        return null; // Product not found
    }
    
    const productId = productData.product_id;
    
    return {
        product_id: productId, // PostgreSQL product_id (INTEGER)
        snapshot_date: row['Snapshot Date'] || null,
        inventory_units: parseInt(row['Inventory Units'] || 0),
        location: row['Location'] || null
    };
}

/**
 * Maps CSV row to ad_performance_facts table format
 */
async function mapAdPerformanceFactRow(row) {
    const productPlatformId = await getProductPlatformIdByPlatformSku(row);
    if (!productPlatformId) return null;
    
    const dateValue = row['Date'] || null;

    // Get ad_type (sp or sd)
    const adType = (row['Ad Type'] || '').toLowerCase().trim();
    
    if (!adType || (adType !== 'sp' && adType !== 'sd')) {
        throw new Error(`ad_type is required and must be 'sp' (Sponsored Products) or 'sd' (Sponsored Display). Got: "${adType}"`);
    }
    
    return {
        product_platform_id: productPlatformId,
        period_start_date: dateValue || row['Period Start'] || null,
        period_end_date: dateValue || row['Period End'] || null,
        spend: parseFloat(row['Spend'] || 0),
        revenue: parseFloat(row['Revenue'] || 0),
        ad_type: adType
    };
}

/**
 * Maps CSV row to ratings_facts table format
 */
async function mapRatingsFactRow(row) {
    const productPlatformId = await getProductPlatformId(row);
    if (!productPlatformId) return null;
    
    return {
        product_platform_id: productPlatformId,
        snapshot_date: row['Snapshot Date'] || null,
        rating: parseFloat(row['Rating'] || 0),
        review_count: parseInt(row['Review Count'] || 0)
    };
}

/**
 * Helper function to get product_platform_id from row
 * Products are fetched from PostgreSQL
 */
async function getProductPlatformId(row) {
    const inputSku = normalizeSku(row['SKU'] || '');
    const platform = (row['Platform'] || '').trim();
    
    if (!inputSku || !platform) return null;
    
    // Ensure cache is loaded
    await loadProductsCache();
    
    // Find product from cache (no DB query!)
    const productData = findProductBySku(inputSku);
    
    if (!productData) return null;
    
    // Get platform_id
    const { data: platformData } = await supabase
        .from('platforms')
        .select('platform_id')
        .eq('name', platform)
        .single();
    
    if (!platformData) return null;
    
    // Get product_platform_id
    const { data: ppData } = await supabase
        .from('product_platforms')
        .select('product_platform_id')
        .eq('product_id', productData.product_id)
        .eq('platform_id', platformData.platform_id)
        .single();
    
    return ppData ? ppData.product_platform_id : null;
}

/**
 * Helper function to get product_platform_id using platform SKU/ASIN
 * Uses platform + platform_sku to resolve product_platform_id
 */
async function getProductPlatformIdByPlatformSku(row) {
    const platformSku = (row['Platform SKU'] || row['ASIN'] || '').trim();

    if (!platformSku) return null;

    await loadProductPlatformsCache();
    return productPlatformsCache[platformSku] || null;
}

module.exports = {
    mapProductRow,
    mapProductPlatformRow,
    mapSalesFactRow,
    mapInventoryFactRow,
    mapCompanyInventoryFactRow,
    mapAdPerformanceFactRow,
    mapRatingsFactRow
};
