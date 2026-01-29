/**
 * Product validation service
 * Ensures products exist in MongoDB before operations
 */
const { Product } = require('../config/mongodb');

/**
 * Validates that a product exists in MongoDB
 * @param {string} productId - MongoDB ObjectId (as string)
 * @returns {Promise<boolean>} - True if product exists
 */
async function validateProductExists(productId) {
    try {
        const product = await Product.findById(productId);
        return !!product;
    } catch (err) {
        return false;
    }
}

/**
 * Validates that a product exists by SKU
 * @param {string} sku - Product SKU
 * @returns {Promise<Object|null>} - Product object or null
 */
async function validateProductBySku(sku) {
    try {
        const product = await Product.findOne({ sku: sku });
        return product;
    } catch (err) {
        return null;
    }
}

/**
 * Batch validate multiple product IDs
 * @param {string[]} productIds - Array of MongoDB ObjectIds
 * @returns {Promise<{valid: string[], invalid: string[]}>}
 */
async function batchValidateProducts(productIds) {
    const valid = [];
    const invalid = [];
    
    for (const productId of productIds) {
        const exists = await validateProductExists(productId);
        if (exists) {
            valid.push(productId);
        } else {
            invalid.push(productId);
        }
    }
    
    return { valid, invalid };
}

module.exports = {
    validateProductExists,
    validateProductBySku,
    batchValidateProducts
};

