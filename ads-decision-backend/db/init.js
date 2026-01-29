const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Use individual env vars (same as config/database.js)
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,  // db.xxx.supabase.co
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  max: 20,
  family: 4,  // Force IPv4 to avoid DNS issues
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 60000
};

// Validate required DB connection vars
if (!config.user || !config.password || !config.host || !config.database) {
    console.error('❌ Missing required DB connection variables:');
    console.error('   Required: DB_USER, DB_PASSWORD, DB_HOST, DB_NAME');
    console.error('   Optional: DB_PORT (defaults to 5432)');
    process.exit(1);
}

const pool = new Pool(config);

async function initDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        await pool.query(schema);
        console.log('✅ Database schema initialized successfully');
        
        // Insert default platforms if they don't exist
        await pool.query(`
            INSERT INTO platforms (name) 
            VALUES ('Amazon'), ('Flipkart'), ('Myntra')
            ON CONFLICT (name) DO NOTHING
        `);
        console.log('✅ Default platforms inserted');
        
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };

