// Alternative database config that resolves IP first
const { Pool } = require('pg');
const dns = require('dns').promises;
require('dotenv').config();

let pool;

async function createPool() {
    if (pool) return pool;
    
    if (process.env.DATABASE_URL) {
        const url = new URL(process.env.DATABASE_URL);
        const hostname = url.hostname;
        
        try {
            // Try to resolve IPv6 first
            const addresses = await dns.resolve6(hostname);
            const ipv6 = addresses[0];
            
            // Replace hostname with IPv6 address in brackets
            url.hostname = `[${ipv6}]`;
            
            // Add SSL if needed
            if (!url.searchParams.has('sslmode')) {
                url.searchParams.set('sslmode', 'require');
            }
            
            const connectionString = url.toString();
            
            pool = new Pool({
                connectionString: connectionString,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 30000,
                ssl: {
                    rejectUnauthorized: false
                }
            });
            
            console.log('✅ Database pool created with resolved IPv6 address');
        } catch (error) {
            console.error('Failed to resolve hostname, using original connection string');
            // Fallback to original
            let connStr = process.env.DATABASE_URL;
            if (!connStr.includes('sslmode=')) {
                connStr += (connStr.includes('?') ? '&' : '?') + 'sslmode=require';
            }
            pool = new Pool({
                connectionString: connStr,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 30000,
                ssl: {
                    rejectUnauthorized: false
                }
            });
        }
    } else {
        // Use individual variables
        pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME || 'ads_decision_maker',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
    }
    
    pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
    });
    
    return pool;
}

// Create pool immediately
const poolPromise = createPool();

module.exports = poolPromise.then(p => p);

