const {
    mapProductRow,
    mapProductPlatformRow,
    mapSalesFactRow,
    mapInventoryFactRow,
    mapCompanyInventoryFactRow,
    mapAdPerformanceFactRow,
    mapRatingsFactRow,
    mapSellerRow
} = require('../mappers');

function getTableName(tableType) {
    const tableMap = {
        'products': 'products',
        'product-platforms': 'product_platforms',
        'sales': 'sales_facts',
        'inventory': 'inventory_facts',
        'company-inventory': 'company_inventory_facts',
        'ad-performance': 'ad_performance_facts',
        'ratings': 'ratings_facts',
        'sellers': 'sellers'
    };

    return tableMap[tableType];
}

// Each tableType can have its own normalization rules.
function getNormalizer(tableType) {
    const normalizeSales = async (row, context) => {
        const enriched = row;
        return mapSalesFactRow(enriched, context);
    };

    const normalizeInventory = async (row, context) => {
        const enriched = rowl
        return mapInventoryFactRow(enriched);
    };

    const normalizerMap = {
        'products': mapProductRow,
        'product-platforms': mapProductPlatformRow,
        'sales': normalizeSales,
        'inventory': normalizeInventory,
        'company-inventory': mapCompanyInventoryFactRow,
        'ad-performance': mapAdPerformanceFactRow,
        'ratings': mapRatingsFactRow,
        'sellers': mapSellerRow
    };

    return normalizerMap[tableType];
}

module.exports = { getNormalizer, getTableName };
