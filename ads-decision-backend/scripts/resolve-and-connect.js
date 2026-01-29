const { Pool } = require('pg');
const dns = require('dns').promises;
require('dotenv').config();

async function connectWithResolvedIP() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL not found');
        process.exit(1);
    }

    // Parse connection string
    const url = new URL(process.env.DATABASE_URL);
    const hostname = url.hostname;
    
    console.log(`Resolving hostname: ${hostname}`);
    
    try {
        // Try IPv6 first
        let ip;
        try {
            const ipv6 = await dns.resolve6(hostname);
            ip = ipv6[0];
            console.log(`✅ Resolved to IPv6: ${ip}`);
        } catch (err) {
            // Fallback to IPv4
            const ipv4 = await dns.resolve4(hostname);
            ip = ipv4[0];
            console.log(`✅ Resolved to IPv4: ${ip}`);
        }
        
        // Replace hostname with IP in connection string
        // IPv6 addresses need to be in brackets
        if (ip.includes(':')) {
            url.hostname = `[${ip}]`;
        } else {
            url.hostname = ip;
        }
        const connectionString = url.toString();
        
        // Add SSL if not present
        if (!connectionString.includes('sslmode=')) {
            const separator = connectionString.includes('?') ? '&' : '?';
            url.searchParams.set('sslmode', 'require');
        }
        
        const finalConnectionString = url.toString();
        console.log(`\nConnecting with IP: ${ip}`);
        
        const pool = new Pool({
            connectionString: finalConnectionString,
            ssl: {
                rejectUnauthorized: false
            }
        });
        
        const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Database connection successful!');
        console.log(`  PostgreSQL Version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
        console.log(`  Current Time: ${result.rows[0].current_time}`);
        
        await pool.end();
        process.exit(0);
        
    } catch (error) {
        console.error(`❌ Connection failed: ${error.message}`);
        process.exit(1);
    }
}

connectWithResolvedIP();

