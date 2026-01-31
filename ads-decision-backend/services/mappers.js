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

function parseReportDate(value) {
    if (!value) return null;
    const input = String(value).trim();
    if (!input) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    const match = input.match(/^(\d{1,2})\s*([A-Za-z]{3})\s*['’]?(\d{2})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const year = 2000 + parseInt(match[3], 10);
    const monthMap = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };
    const month = monthMap[monthStr];
    if (!month || day < 1 || day > 31) return null;
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
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

async function mapProductPlatformRow(row, context) {
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
        platform_id: context.platformId,
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
    if (row.__platformId) {
        return row.__platformId;
    }
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
async function mapSalesFactRow(row, context) {
    const platformId = context.platformId
    const sku = normalizeSku(row['SKU'] || '');
    const platformSku = normalizeSku(row['Platform SKU'] || row['ASIN'] || '');
    const dateReport = parseReportDate(row['Date Report'] || row['Date'] || '');
    const periodStart = row['Period Start (YYYY-MM-DD)'] || row['Period Start'] || dateReport || null;
    const periodEnd = row['Period End (YYYY-MM-DD)'] || row['Period End'] || dateReport || null;
    console.log('Mapping Sales Fact Row:', { periodStart, periodEnd, dateReport });
    if (!sku && !platformSku) {
        throw new Error('SKU or Platform SKU is required');
    }
    if (!periodStart || !periodEnd) {
        throw new Error('Period Start/End or Date Report is required');
    }
    
    return {
        platform_id: platformId,
        sku: sku || null,
        platform_sku: platformSku || null,
        period_start_date: periodStart,
        period_end_date: periodEnd,
        units_sold: parseInt(row['Units Sold'] || 0),
        revenue: 0
    };
}

/**
 * Maps CSV row to inventory_facts table format
 */
async function mapInventoryFactRow(row, context) {
    const platformId = context.platformId;
    const sku = normalizeSku(row['SKU'] || '');
    const platformSku = normalizeSku(row['Platform SKU'] || row['ASIN'] || '');
    const dateReport = parseReportDate(row['Date Report'] || row['Date'] || '');
    const snapshotDate = row['Snapshot Date (YYYY-MM-DD)'] || row['Snapshot Date'] || dateReport || null;
    if (!sku && !platformSku) {
        throw new Error('SKU or Platform SKU is required');
    }
    if (!snapshotDate) {
        throw new Error('Snapshot Date or Date Report is required');
    }
    
    return {
        platform_id: platformId,
        sku: sku || null,
        platform_sku: platformSku || null,
        snapshot_date: snapshotDate,
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
 * Maps CSV row to sellers table format
 */
async function mapSellerRow(row,context) {
    const name = (row['Seller Name'] || '').trim();
    if (!name) {
        throw new Error('Seller Name is required');
    }
    
    const platformId = context.platformId;
    
    return {
        name: name,
        platform_id: platformId,
        active: row['Active'] !== undefined ? (row['Active'] === 'true' || row['Active'] === true || row['Active'] === 'TRUE') : true
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
    mapRatingsFactRow,
    mapSellerRow
};
