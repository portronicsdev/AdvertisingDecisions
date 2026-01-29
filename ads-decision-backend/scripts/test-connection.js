const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
    console.log('🔍 Testing database connection...\n');
    
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not found in .env file');
        process.exit(1);
    }
    
    // Mask password in connection string for display
    const maskedUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
    console.log(`Connection String: ${maskedUrl}\n`);
    
    // Parse connection string to show details
    try {
        const url = new URL(process.env.DATABASE_URL);
        console.log('Parsed Connection Details:');
        console.log(`  Protocol: ${url.protocol}`);
        console.log(`  Hostname: ${url.hostname}`);
        console.log(`  Port: ${url.port || '5432 (default)'}`);
        console.log(`  Database: ${url.pathname.substring(1)}`);
        console.log(`  Username: ${url.username}`);
        console.log(`  SSL Mode: ${url.searchParams.get('sslmode') || 'not specified'}\n`);
    } catch (e) {
        console.log('⚠️  Could not parse connection string format\n');
    }
    
    // Test DNS resolution
    const dns = require('dns');
    const hostname = new URL(process.env.DATABASE_URL).hostname;
    console.log(`Testing DNS resolution for: ${hostname}`);
    
    try {
        const addresses = await new Promise((resolve, reject) => {
            dns.resolve4(hostname, (err, addresses) => {
                if (err) reject(err);
                else resolve(addresses);
            });
        });
        console.log(`✅ DNS resolved successfully: ${addresses.join(', ')}\n`);
    } catch (dnsError) {
        console.error(`❌ DNS resolution failed: ${dnsError.message}`);
        console.error('\nPossible issues:');
        console.error('1. Check your internet connection');
        console.error('2. Verify the hostname is correct in Supabase dashboard');
        console.error('3. Check if your firewall/proxy is blocking the connection');
        console.error('4. Verify the Supabase project is not paused\n');
    }
    
    // Test database connection
    let connectionString = process.env.DATABASE_URL;
    
    // Add SSL mode if not present
    if (!connectionString.includes('sslmode=') && !connectionString.includes('ssl=')) {
        const separator = connectionString.includes('?') ? '&' : '?';
        connectionString = `${connectionString}${separator}sslmode=require`;
    }
    
    const pool = new Pool({
        connectionString: connectionString,
        connectionTimeoutMillis: 10000,
        ssl: {
            rejectUnauthorized: false // For testing, allow self-signed certificates
        }
    });
    
    try {
        console.log('Testing database connection...');
        const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Database connection successful!');
        console.log(`  PostgreSQL Version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
        console.log(`  Current Time: ${result.rows[0].current_time}`);
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error(`❌ Database connection failed: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        console.error(`   Errno: ${error.errno}`);
        
        if (error.code === 'ENOTFOUND') {
            console.error('\n💡 DNS Resolution Issue:');
            console.error('   - Check your internet connection');
            console.error('   - Verify the hostname in your Supabase dashboard');
            console.error('   - Try accessing Supabase dashboard to ensure project is active');
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
            console.error('\n💡 Connection Issue:');
            console.error('   - Check if port 5432 is accessible');
            console.error('   - Verify firewall settings');
            console.error('   - Check if Supabase project allows connections from your IP');
        } else if (error.message.includes('SSL')) {
            console.error('\n💡 SSL Issue:');
            console.error('   - Supabase requires SSL connections');
            console.error('   - Connection string should include ?sslmode=require');
        }
        
        await pool.end();
        process.exit(1);
    }
}

testConnection();

