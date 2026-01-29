const mongoose = require('mongoose');
require('dotenv').config();

// Suppress duplicate index warnings from CommonCore schemas
mongoose.set('strictQuery', true);

// Suppress only Mongoose warnings
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, ...args) {
    if (warning && warning.includes && warning.includes('Duplicate schema index')) {
        return; // Suppress duplicate index warnings
    }
    return originalEmitWarning.call(this, warning, ...args);
};

// Import CommonCore schemas (ES modules - need to access .default)
const ProductSchema = require('commoncore/Product.js').default;
const CategorySchema = require('commoncore/Category.js').default;
const SuperCategorySchema = require('commoncore/SuperCategory.js').default;

// Core DB connection (shared collections - products)
// Using createConnection with URI directly (matches CommonCore pattern)
let coreDb;
let Product, Category, SuperCategory;

if (process.env.MONGO_URI_CORE) {
    coreDb = mongoose.createConnection(process.env.MONGO_URI_CORE);
    
    // Models on CoreDB - schemas are already Mongoose schemas
    Product = coreDb.model('Product', ProductSchema);
    Category = coreDb.model('Category', CategorySchema);
    SuperCategory = coreDb.model('SuperCategory', SuperCategorySchema);
    
    // Handle connection events
    coreDb.on('connected', () => {
        console.log('✅ MongoDB Core DB connected');
    });
    
    coreDb.on('error', (err) => {
        console.error('❌ MongoDB Core DB error:', err);
    });
    
    coreDb.on('disconnected', () => {
        console.log('⚠️  MongoDB Core DB disconnected');
    });
} else {
    console.warn('⚠️  MONGO_URI_CORE not set in environment variables');
    console.warn('   MongoDB features will be disabled');
}

module.exports = {
    coreDb,
    Product,
    Category,
    SuperCategory
};

