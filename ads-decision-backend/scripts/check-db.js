const supabase = require('../config/database');

async function checkDatabase() {
    try {
        console.log('🔍 Checking database connection...');
        console.log('Configuration:');
        
        if (process.env.DATABASE_URL) {
            // Mask password in connection string for display
            const maskedUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
            console.log(`  Using connection string: ${maskedUrl}`);
        } else {
            console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
            console.log(`  Port: ${process.env.DB_PORT || 5432}`);
            console.log(`  Database: ${process.env.DB_NAME || 'ads_decision_maker'}`);
            console.log(`  User: ${process.env.DB_USER || 'postgres'}`);
        }
        console.log('');
        
        // Test connection
        const { data, error } = await supabase.from('products').select('product_id').limit(1);
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist
            throw error;
        }
        
        console.log('✅ Supabase connection successful!');
        console.log(`  Current Time: ${new Date().toISOString()}`);
        
        // Check if tables exist by trying to query them
        const tables = ['products', 'platforms', 'product_platforms', 'decisions', 'sales_facts', 'inventory_facts', 'company_inventory_facts', 'ad_performance_facts', 'ratings_facts'];
        const existingTables = [];
        
        for (const table of tables) {
            const { error: tableError } = await supabase.from(table).select('*').limit(1);
            if (!tableError || tableError.code !== 'PGRST116') {
                existingTables.push(table);
            }
        }
        
        if (existingTables.length > 0) {
            console.log(`\n📊 Found ${existingTables.length} tables:`);
            existingTables.forEach(table => {
                console.log(`  - ${table}`);
            });
        } else {
            console.log('\n⚠️  No tables found. Initialize schema through Supabase dashboard or migrations.');
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Database connection failed!');
        console.error(`\nError: ${error.message}`);
        console.error('\nTroubleshooting:');
        console.error('1. Is PostgreSQL running?');
        console.error('2. Check your .env file has correct credentials');
        console.error('3. Verify database exists: CREATE DATABASE ads_decision_maker;');
        console.error('4. Check PostgreSQL is listening on port 5432');
        process.exit(1);
    }
}

checkDatabase();

