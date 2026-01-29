// Quick test with custom DNS
const dns = require('dns').promises;
const { Pool } = require('pg');
require('dotenv').config();

// Use Google DNS
const dnsModule = require('dns');
dnsModule.setServers(['8.8.8.8', '8.8.4.4']);
dnsModule.setDefaultResultOrder('ipv6first');

async function quickTest() {
    console.log('Testing with Google DNS servers...\n');
    
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found');
        process.exit(1);
    }
    
    const url = new URL(process.env.DATABASE_URL);
    const hostname = url.hostname;
    
    console.log(`Resolving: ${hostname}`);
    
    try {
        // Try to resolve
        const addresses = await dns.resolve6(hostname);
        console.log(`✅ Resolved to IPv6: ${addresses[0]}\n`);
        
        // Build connection string with SSL
        let connStr = process.env.DATABASE_URL;
        if (!connStr.includes('sslmode=')) {
            connStr += (connStr.includes('?') ? '&' : '?') + 'sslmode=require';
        }
        
        console.log('Connecting to database...');
        const pool = new Pool({
            connectionString: connStr,
            connectionTimeoutMillis: 15000,
            ssl: { rejectUnauthorized: false }
        });
        
        const result = await pool.query('SELECT NOW()');
        console.log('✅ SUCCESS! Database connected!');
        console.log(`   Server time: ${result.rows[0].now}`);
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        
        if (error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
            console.error('\n💡 Your system cannot resolve/connect via IPv6.');
            console.error('   Solutions:');
            console.error('   1. Check if your router/ISP supports IPv6');
            console.error('   2. Try using a VPN with IPv6 support');
            console.error('   3. Contact Supabase support for IPv4 endpoint');
            console.error('   4. Use a different network (mobile hotspot, etc.)');
        }
        
        process.exit(1);
    }
}

quickTest();

