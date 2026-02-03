const supabase = require('../config/database');

const ALL_SELLER_NAME = 'All Sellers';

const normalizeKey = (value) => {
    if (!value) return '';
    return String(value).trim().replace(/\s+/g, ' ');
};

const formatOrValue = (value) => `"${String(value).replace(/"/g, '\\"')}"`;

const applySkuFilters = (query, { sku, platformSku }) => {
    const clauses = [];
    if (platformSku) clauses.push(`platform_sku.eq.${formatOrValue(platformSku)}`);
    if (sku) clauses.push(`sku.eq.${formatOrValue(sku)}`);
    if (clauses.length === 0) return query;
    return query.or(clauses.join(','));
};

/**
 * Decision Engine
 * Evaluates whether ads should be run for a product-platform combination
 * 
 * Rules:
 * 1. Inventory Gate: Seller stock coverage ≥ 7 days OR company inventory > 0
 * 2. Ratings Gate: Rating ≥ 4.0
 * 3. Performance Gate: ROAS > 8
 */

/**
 * Calculates seller stock coverage in days
 */
async function calculateSellerStockCoverage({ productPlatformId, platformId, sku, platformSku, sellerId, useAllSellers = false }) {
    const normalizedSku = normalizeKey(sku);
    const normalizedPlatformSku = normalizeKey(platformSku);
    // Get average daily sales from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let salesQuery = supabase
        .from('sales_facts')
        .select('units_sold, period_start_date')
        .eq('platform_id', platformId)
        .gte('period_start_date', thirtyDaysAgo.toISOString().split('T')[0]);
    
    if (!useAllSellers && sellerId) {
        salesQuery = salesQuery.eq('seller_id', sellerId);
    }
    
    salesQuery = applySkuFilters(salesQuery, {
        sku: normalizedSku,
        platformSku: normalizedPlatformSku
    });
    
    const { data: salesData, error: salesError } = await salesQuery;
    
    if (salesError) {
        console.error('Error fetching sales data:', salesError);
        return 999; // Assume infinite coverage on error
    }
    
    const totalUnits = (salesData || []).reduce((sum, row) => sum + (parseInt(row.units_sold) || 0), 0);
    const uniqueDates = new Set((salesData || []).map(row => row.period_start_date));
    const daysCount = uniqueDates.size || 1;
    const avgDailySales = totalUnits / daysCount;
    
    if (avgDailySales === 0) {
        // No sales data, assume infinite coverage
        return 999;
    }
    
    // Get latest inventory
    let inventoryQuery = supabase
        .from('inventory_facts')
        .select('inventory_units')
        .eq('platform_id', platformId);
    
    if (!useAllSellers && sellerId) {
        inventoryQuery = inventoryQuery.eq('seller_id', sellerId);
    }
    
    inventoryQuery = applySkuFilters(inventoryQuery, {
        sku: normalizedSku,
        platformSku: normalizedPlatformSku
    });
    
    const { data: inventoryData, error: inventoryError } = await inventoryQuery
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();
    
    const currentInventory = inventoryData 
        ? parseInt(inventoryData.inventory_units) || 0 
        : 0;
    
    return currentInventory / avgDailySales;
}

/**
 * Gets company inventory for a product
 */
async function getCompanyInventory(productId) {
    // Get max snapshot_date for this product
    const { data: maxDateData } = await supabase
        .from('company_inventory_facts')
        .select('snapshot_date')
        .eq('product_id', productId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();
    
    if (!maxDateData) return 0;
    
    // Get sum of inventory for that date
    const { data: inventoryData } = await supabase
        .from('company_inventory_facts')
        .select('inventory_units')
        .eq('product_id', productId)
        .eq('snapshot_date', maxDateData.snapshot_date);
    
    const totalInventory = (inventoryData || []).reduce((sum, row) => sum + (parseInt(row.inventory_units) || 0), 0);
    return totalInventory;
}

/**
 * Gets latest rating for a product-platform
 */
async function getLatestRating(productPlatformId) {
    const { data, error } = await supabase
        .from('ratings_facts')
        .select('rating')
        .eq('product_platform_id', productPlatformId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();
    
    return data ? parseFloat(data.rating) || 0 : 0;
}

/**
 * Calculates ROAS (Return on Ad Spend) for a product-platform
 * ROAS = Revenue from Ads / Ad Spend
 */
async function calculateROAS(productPlatformId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data, error } = await supabase
        .from('ad_performance_facts')
        .select('spend, revenue')
        .eq('product_platform_id', productPlatformId)
        .gte('period_start_date', thirtyDaysAgo.toISOString().split('T')[0]);
    
    if (error) {
        console.error('Error fetching ad performance data:', error);
        return 999; // Assume good ROAS on error
    }
    
    const totalSpend = (data || []).reduce((sum, row) => sum + (parseFloat(row.spend) || 0), 0);
    const totalRevenue = (data || []).reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0);
    
    if (totalSpend === 0) {
        // No ad spend data, assume good ROAS
        return 999;
    }
    
    return totalRevenue / totalSpend;
}

async function ensureAllSellers(platformIds) {
    if (!platformIds || platformIds.length === 0) return {};
    
    const { data: existing, error: existingError } = await supabase
        .from('sellers')
        .select('seller_id, platform_id, name')
        .in('platform_id', platformIds);
    
    if (existingError) {
        throw existingError;
    }
    
    const existingMap = new Map();
    (existing || []).forEach(s => {
        if (s.name === ALL_SELLER_NAME) {
            existingMap.set(s.platform_id, s.seller_id);
        }
    });
    
    const missing = platformIds.filter(id => !existingMap.has(id));
    if (missing.length > 0) {
        const rows = missing.map(platformId => ({
            platform_id: platformId,
            name: ALL_SELLER_NAME,
            active: true
        }));
        
        const { error: upsertError } = await supabase
            .from('sellers')
            .upsert(rows, { onConflict: 'platform_id,name' });
        
        if (upsertError) {
            throw upsertError;
        }
    }
    
    const { data: refreshed, error: refreshedError } = await supabase
        .from('sellers')
        .select('seller_id, platform_id, name')
        .in('platform_id', platformIds)
        .eq('name', ALL_SELLER_NAME);
    
    if (refreshedError) {
        throw refreshedError;
    }
    
    const allMap = {};
    (refreshed || []).forEach(s => {
        allMap[s.platform_id] = s.seller_id;
    });
    
    return allMap;
}

async function getSellerById(sellerId) {
    const { data, error } = await supabase
        .from('sellers')
        .select('seller_id, name, platform_id')
        .eq('seller_id', sellerId)
        .single();
    
    if (error || !data) {
        throw new Error(`Seller not found for seller_id: ${sellerId}`);
    }
    
    return data;
}

/**
 * Evaluates decision for a single product-platform combination
 */
async function evaluateDecision(productPlatformId, options = {}) {
    const {
        sellerId,
        useAllSellers = false,
        productId: providedProductId,
        platformId,
        sku,
        platformSku
    } = options;
    try {
        const startTime = Date.now();
        // Get product_id for company inventory check
        let productId = providedProductId;
        if (!productId) {
            const { data: productData, error: productError } = await supabase
                .from('product_platforms')
                .select('product_id')
                .eq('product_platform_id', productPlatformId)
                .single();
            
            if (productError || !productData) {
                return {
                    decision: false,
                    reason: 'Product-platform combination not found'
                };
            }
            
            productId = productData.product_id;
        }
        
        if (!productId) {
            return {
                decision: false,
                reason: 'Product-platform combination not found'
            };
        }
        const reasons = [];
        
        // 1. Inventory Gate
        const stockCoverage = await calculateSellerStockCoverage({
            productPlatformId,
            platformId,
            sku,
            platformSku,
            sellerId,
            useAllSellers
        });
        const companyInventory = await getCompanyInventory(productId);
        
        if (stockCoverage < 7) {
            if (companyInventory === 0) {
                return {
                    decision: false,
                    reason: `Inventory Gate FAILED: Seller stock coverage (${stockCoverage.toFixed(1)} days) < 7 days AND company inventory = 0`
                };
            } else {
                reasons.push(`Inventory Gate PASSED: Seller stock low (${stockCoverage.toFixed(1)} days) but company inventory available (${companyInventory} units)`);
            }
        } else {
            reasons.push(`Inventory Gate PASSED: Seller stock coverage (${stockCoverage.toFixed(1)} days) ≥ 7 days`);
        }
        
        // 2. Ratings Gate
        const rating = await getLatestRating(productPlatformId);
        if (rating < 4.0) {
            return {
                decision: false,
                reason: `Ratings Gate FAILED: Rating (${rating.toFixed(2)}) < 4.0`
            };
        }
        reasons.push(`Ratings Gate PASSED: Rating (${rating.toFixed(2)}) ≥ 4.0`);
        
        // 3. Performance Gate
        const roas = await calculateROAS(productPlatformId);
        if (roas <= 8) {
            return {
                decision: false,
                reason: `Performance Gate FAILED: ROAS (${roas.toFixed(2)}) ≤ 8`
            };
        }
        reasons.push(`Performance Gate PASSED: ROAS (${roas.toFixed(2)}) > 8`);
        
        // All gates passed
        const result = {
            decision: true,
            reason: reasons.join(' | ')
        };
        const duration = Date.now() - startTime;
        if (duration > 1000) {
            console.log(`⏱️ evaluateDecision ${productPlatformId} took ${duration}ms`);
        }
        return result;
        
    } catch (error) {
        console.error(`Error evaluating decision for product_platform_id ${productPlatformId}:`, error);
        return {
            decision: false,
            reason: `Error evaluating decision: ${error.message}`
        };
    }
}

/**
 * Evaluates decisions for all product-platform combinations
 */
async function evaluateAllDecisions(options = {}) {
    try {
        const { sellerId } = options;
        let sellerContext = null;
        let platformIdsFilter = null;
        console.log(`🧩 Loading product platforms${sellerId ? ` for seller ${sellerId}` : ''}...`);
        
        if (sellerId) {
            sellerContext = await getSellerById(sellerId);
            platformIdsFilter = [sellerContext.platform_id];
        }
        
        let ppQuery = supabase
            .from('product_platforms')
            .select(`
                product_platform_id,
                product_id,
                platform_id,
                platform_sku,
                products:products!inner(
                    sku
                )
            `);
        
        if (platformIdsFilter && platformIdsFilter.length > 0) {
            ppQuery = ppQuery.in('platform_id', platformIdsFilter);
        }
        
        const { data, error } = await ppQuery;
        
        if (error) {
            throw error;
        }
        
        const productPlatforms = data || [];
        console.log(`📦 Product-platforms: ${productPlatforms.length}`);
        const decisions = [];
        
        if (sellerId && sellerContext) {
            const useAllSellers = sellerContext.name === ALL_SELLER_NAME;
            const total = productPlatforms.length;
            const logEvery = 50;
            const startTime = Date.now();
            for (let i = 0; i < productPlatforms.length; i++) {
                const pp = productPlatforms[i];
                const decision = await evaluateDecision(pp.product_platform_id, {
                    sellerId,
                    useAllSellers,
                    productId: pp.product_id,
                    platformId: pp.platform_id,
                    sku: pp.products?.sku,
                    platformSku: pp.platform_sku
                });
                decisions.push({
                    product_platform_id: pp.product_platform_id,
                    seller_id: sellerId,
                    ...decision
                });
                if ((i + 1) % logEvery === 0 || i + 1 === total) {
                    const elapsedMs = Date.now() - startTime;
                    const elapsedSec = Math.round(elapsedMs / 1000);
                    console.log(`⏳ Evaluated ${i + 1}/${total} (${elapsedSec}s)`);
                }
            }
        } else {
            const platformIds = [...new Set(productPlatforms.map(row => row.platform_id))];
            await ensureAllSellers(platformIds);
            
            const { data: sellers, error: sellersError } = await supabase
                .from('sellers')
                .select('seller_id, name, platform_id')
                .in('platform_id', platformIds);
            
            if (sellersError) {
                throw sellersError;
            }
            
            const sellersByPlatform = (sellers || []).reduce((map, s) => {
                if (!map[s.platform_id]) map[s.platform_id] = [];
                map[s.platform_id].push(s);
                return map;
            }, {});
            const total = productPlatforms.length;
            const logEvery = 50;
            const startTime = Date.now();
            
            for (let i = 0; i < productPlatforms.length; i++) {
                const pp = productPlatforms[i];
                const platformSellers = sellersByPlatform[pp.platform_id] || [];
                
                for (const seller of platformSellers) {
                    const useAllSellers = seller.name === ALL_SELLER_NAME;
                    const decision = await evaluateDecision(pp.product_platform_id, {
                        sellerId: seller.seller_id,
                        useAllSellers,
                        productId: pp.product_id,
                        platformId: pp.platform_id,
                        sku: pp.products?.sku,
                        platformSku: pp.platform_sku
                    });
                    decisions.push({
                        product_platform_id: pp.product_platform_id,
                        seller_id: seller.seller_id,
                        ...decision
                    });
                }
                if ((i + 1) % logEvery === 0 || i + 1 === total) {
                    const elapsedMs = Date.now() - startTime;
                    const elapsedSec = Math.round(elapsedMs / 1000);
                    console.log(`⏳ Evaluated ${i + 1}/${total} (${elapsedSec}s)`);
                }
            }
        }
        
        return decisions;
    } catch (error) {
        console.error('Error evaluating all decisions:', error);
        throw error;
    }
}

/**
 * Saves decision to database
 */
async function saveDecision(productPlatformId, sellerId, decision, reason) {
    try {
        if (!sellerId) {
            throw new Error('seller_id is required to save decision');
        }
        
        const { error } = await supabase
            .from('decisions')
            .upsert({
                product_platform_id: productPlatformId,
                seller_id: sellerId,
                decision: decision,
                reason: reason,
                evaluated_at: new Date().toISOString()
            }, {
                onConflict: 'product_platform_id,seller_id'
            });
        
        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Error saving decision:', error);
        throw error;
    }
}

module.exports = {
    evaluateDecision,
    evaluateAllDecisions,
    saveDecision
};

