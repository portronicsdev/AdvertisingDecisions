const { Pool } = require('pg');
require('dotenv').config();

// Test connection pooling endpoint (port 6543) which might have IPv4
const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
}

// Replace port 5432 with 6543 and add pgbouncer parameter
const poolingUrl = originalUrl.replace(':5432/', ':6543/') + (originalUrl.includes('?') ? '&' : '?') + 'pgbouncer=true&sslmode=require';

console.log('Testing connection pooling endpoint (port 6543)...');
console.log('This endpoint might have IPv4 support.\n');

const pool = new Pool({
    connectionString: poolingUrl,
    connectionTimeoutMillis: 10000,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.query('SELECT NOW() as current_time')
    .then(result => {
        console.log('✅ Connection pooling endpoint works!');
        console.log(`   Current Time: ${result.rows[0].current_time}`);
        console.log('\n💡 Update your .env file to use:');
        console.log(`DATABASE_URL=${poolingUrl}`);
        pool.end();
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Connection pooling endpoint also failed');
        console.error(`   Error: ${err.message}`);
        console.error(`   Code: ${err.code}`);
        pool.end();
        process.exit(1);
    });

