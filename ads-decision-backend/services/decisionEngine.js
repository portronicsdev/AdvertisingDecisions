const supabase = require('../config/database');

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
async function calculateSellerStockCoverage(productPlatformId) {
    // Get average daily sales from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: salesData, error: salesError } = await supabase
        .from('sales_facts')
        .select('units_sold, period_start_date')
        .eq('product_platform_id', productPlatformId)
        .gte('period_start_date', thirtyDaysAgo.toISOString().split('T')[0]);
    
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
    const { data: inventoryData, error: inventoryError } = await supabase
        .from('inventory_facts')
        .select('inventory_units')
        .eq('product_platform_id', productPlatformId)
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

/**
 * Evaluates decision for a single product-platform combination
 */
async function evaluateDecision(productPlatformId) {
    try {
        // Get product_id for company inventory check
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
        
        const productId = productData.product_id;
        const reasons = [];
        
        // 1. Inventory Gate
        const stockCoverage = await calculateSellerStockCoverage(productPlatformId);
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
        return {
            decision: true,
            reason: reasons.join(' | ')
        };
        
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
async function evaluateAllDecisions() {
    try {
        const { data, error } = await supabase
            .from('product_platforms')
            .select('product_platform_id');
        
        if (error) {
            throw error;
        }
        
        const productPlatformIds = [...new Set((data || []).map(row => row.product_platform_id))];
        const decisions = [];
        
        for (const productPlatformId of productPlatformIds) {
            const decision = await evaluateDecision(productPlatformId);
            decisions.push({
                product_platform_id: productPlatformId,
                ...decision
            });
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
async function saveDecision(productPlatformId, decision, reason) {
    try {
        const { error } = await supabase
            .from('decisions')
            .upsert({
                product_platform_id: productPlatformId,
                decision: decision,
                reason: reason,
                evaluated_at: new Date().toISOString()
            }, {
                onConflict: 'product_platform_id'
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

