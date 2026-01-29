/**
 * Script to find orphaned product references in PostgreSQL
 * (products that don't exist in MongoDB anymore)
 */
const pool = require('../config/database');
const { Product } = require('../config/mongodb');

async function validateOrphanedReferences() {
    try {
        console.log('🔍 Checking for orphaned product references...\n');
        
        // Get all unique product_ids from PostgreSQL
        const pgResult = await pool.query(`
            SELECT DISTINCT product_id 
            FROM product_platforms
            UNION
            SELECT DISTINCT product_id 
            FROM company_inventory_facts
        `);
        
        const pgProductIds = pgResult.rows.map(row => row.product_id);
        console.log(`Found ${pgProductIds.length} unique product IDs in PostgreSQL\n`);
        
        // Check each product in MongoDB
        const orphaned = [];
        const valid = [];
        
        for (const productId of pgProductIds) {
            try {
                const product = await Product.findById(productId);
                if (!product) {
                    orphaned.push(productId);
                    console.log(`❌ Orphaned: ${productId}`);
                } else {
                    valid.push({ id: productId, sku: product.sku });
                }
            } catch (err) {
                // Invalid ObjectId format
                orphaned.push(productId);
                console.log(`❌ Invalid ObjectId: ${productId}`);
            }
        }
        
        console.log(`\n✅ Valid references: ${valid.length}`);
        console.log(`❌ Orphaned references: ${orphaned.length}`);
        
        if (orphaned.length > 0) {
            console.log('\n⚠️  Orphaned product IDs:');
            orphaned.forEach(id => console.log(`   - ${id}`));
            console.log('\n💡 Recommendation: Clean up orphaned references or restore products in CommonCore');
        } else {
            console.log('\n✅ No orphaned references found!');
        }
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        await pool.end();
        process.exit(1);
    }
}

validateOrphanedReferences();

