const supabase = require('../config/database');
require('dotenv').config();

/**
 * Utility script to clear all data from tables
 * Deletes in correct order to handle foreign key constraints
 * 
 * Usage: node scripts/clear-data.js
 * 
 * WARNING: This will delete ALL data from the database!
 */

async function clearAllData() {
    try {
        console.log('🗑️  Clearing all data...');
        
        // Delete in order: child tables first, then parent tables
        const tables = [
            'decisions',
            'ratings_facts',
            'ad_performance_facts',
            'inventory_facts',
            'company_inventory_facts',
            'sales_facts',
            'product_platforms',
            'products',
            // Note: platforms are kept (they're reference data)
        ];
        
        for (const table of tables) {
            try {
                // Get all IDs first
                const idColumn = table === 'product_platforms' ? 'product_platform_id' : 
                                table === 'products' ? 'product_id' :
                                table === 'platforms' ? 'platform_id' : 'id';
                
                const { data: allRows, error: selectError } = await supabase
                    .from(table)
                    .select(idColumn);
                
                if (selectError) {
                    console.log(`⚠️  Table ${table} may not exist or is empty`);
                    continue;
                }
                
                const rowCount = allRows?.length || 0;
                
                if (rowCount === 0) {
                    console.log(`✅ Cleared ${table}: 0 rows (already empty)`);
                    continue;
                }
                
                // Delete in batches (Supabase has limits)
                const batchSize = 1000;
                for (let i = 0; i < allRows.length; i += batchSize) {
                    const batch = allRows.slice(i, i + batchSize);
                    const ids = batch.map(row => row[idColumn]);
                    
                    const { error: deleteError } = await supabase
                        .from(table)
                        .delete()
                        .in(idColumn, ids);
                    
                    if (deleteError) {
                        throw deleteError;
                    }
                }
                
                console.log(`✅ Cleared ${table}: ${rowCount} rows deleted`);
            } catch (error) {
                console.error(`❌ Error clearing ${table}:`, error.message);
                // Continue with other tables
            }
        }
        
        console.log('\n✅ All data cleared successfully!');
        console.log('ℹ️  Platforms table was not cleared (reference data)');
        
    } catch (error) {
        console.error('❌ Error clearing data:', error);
        throw error;
    }
}

async function clearProductPlatformsOnly() {
    try {
        console.log('🗑️  Clearing product_platforms and related data...');
        
        // Delete child tables that reference product_platforms
        const childTables = [
            'decisions',
            'ratings_facts',
            'ad_performance_facts',
            'inventory_facts',
            'sales_facts',
        ];
        
        for (const table of childTables) {
            try {
                const { data: allRows } = await supabase
                    .from(table)
                    .select('id');
                
                const rowCount = allRows?.length || 0;
                
                if (rowCount === 0) {
                    console.log(`✅ Cleared ${table}: 0 rows (already empty)`);
                    continue;
                }
                
                // Delete in batches
                const batchSize = 1000;
                for (let i = 0; i < allRows.length; i += batchSize) {
                    const batch = allRows.slice(i, i + batchSize);
                    const ids = batch.map(row => row.id);
                    
                    const { error: deleteError } = await supabase
                        .from(table)
                        .delete()
                        .in('id', ids);
                    
                    if (deleteError) {
                        throw deleteError;
                    }
                }
                
                console.log(`✅ Cleared ${table}: ${rowCount} rows deleted`);
            } catch (error) {
                console.error(`❌ Error clearing ${table}:`, error.message);
                // Continue with other tables
            }
        }
        
        // Now delete product_platforms
        const { data: allPPRows } = await supabase
            .from('product_platforms')
            .select('product_platform_id');
        
        const ppRowCount = allPPRows?.length || 0;
        
        if (ppRowCount > 0) {
            // Delete in batches
            const batchSize = 1000;
            for (let i = 0; i < allPPRows.length; i += batchSize) {
                const batch = allPPRows.slice(i, i + batchSize);
                const ids = batch.map(row => row.product_platform_id);
                
                const { error: deleteError } = await supabase
                    .from('product_platforms')
                    .delete()
                    .in('product_platform_id', ids);
                
                if (deleteError) {
                    throw deleteError;
                }
            }
        }
        
        console.log(`✅ Cleared product_platforms: ${ppRowCount} rows deleted`);
        console.log('\n✅ product_platforms cleared successfully!');
        
    } catch (error) {
        console.error('❌ Error clearing product_platforms:', error);
        throw error;
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const mode = args[0] || 'all';
    
    if (mode === 'product-platforms' || mode === 'pp') {
        clearProductPlatformsOnly()
            .then(() => {
                console.log('Done!');
                process.exit(0);
            })
            .catch((error) => {
                console.error('Failed:', error);
                process.exit(1);
            });
    } else if (mode === 'all') {
        clearAllData()
            .then(() => {
                console.log('Done!');
                process.exit(0);
            })
            .catch((error) => {
                console.error('Failed:', error);
                process.exit(1);
            });
    } else {
        console.log('Usage:');
        console.log('  node scripts/clear-data.js [all|product-platforms|pp]');
        console.log('');
        console.log('  all (default) - Clear all data including products');
        console.log('  product-platforms or pp - Clear only product_platforms and related facts');
        process.exit(1);
    }
}

module.exports = { clearAllData, clearProductPlatformsOnly };

