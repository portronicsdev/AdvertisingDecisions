/*const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const uploadRoutes = require('./routes/upload');
const decisionRoutes = require('./routes/decisions');
const sellerRoutes = require('./routes/sellers');
const dataRoutes = require('./routes/data');
const uploadLogRoutes = require('./routes/uploads');
const syncRoutes = require('./routes/sync');

const { runDecisionJob } = require('./jobs/decisionJob');

const app = express();
const PORT = process.env.PORT || 3001;

// 🔥 GLOBAL LOGGER (HERE)
app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        console.log(
            `[HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode}`
        );
    });

    next();
});


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/decisions', decisionRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/uploads', uploadLogRoutes);
app.use('/api/reports', require('./routes/reports'));
app.use('/api/sync', syncRoutes);


// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📤 Upload endpoint: http://localhost:${PORT}/api/upload/:tableType`);
    console.log(`✅ Decisions endpoint: http://localhost:${PORT}/api/decisions`);
});

module.exports = app;

*/

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const { runDecisionJob } = require('./jobs/decisionJob');

const app = express();
const PORT = process.env.PORT || 3001;

/* ---------------- GLOBAL LOGGER ---------------- */

app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;

        console.log(
            `[HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration} ms)`
        );
    });

    next();
});

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------------- ROUTES ---------------- */

/* Upload Routes */
app.use('/api/upload/sales', require('./routes/upload/sales'));
app.use('/api/upload/inventory', require('./routes/upload/inventory'));
app.use('/api/upload/ratings', require('./routes/upload/ratings'));
app.use('/api/upload/ad-performance', require('./routes/upload/adPerformance'));
app.use('/api/upload/product-platforms', require('./routes/upload/productPlatforms'));

/* Other Routes */
app.use('/api/decisions', require('./routes/decisions'));
app.use('/api/sellers', require('./routes/sellers'));
app.use('/api/data', require('./routes/data'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/sync', require('./routes/sync'));

/* ---------------- HEALTH ---------------- */

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);

    console.log(`📊 Health: http://localhost:${PORT}/health`);

    console.log(`📤 Upload endpoints:`);
    console.log(`   POST /api/upload/sales`);
    console.log(`   POST /api/upload/inventory`);
    console.log(`   POST /api/upload/ratings`);
    console.log(`   POST /api/upload/ad-performance`);
    console.log(`   POST /api/upload/product-platforms`);

    console.log(`📊 Data: /api/data`);
    console.log(`📈 Reports: /api/reports`);
    console.log(`🔄 Sync: /api/sync`);
});

module.exports = app;
