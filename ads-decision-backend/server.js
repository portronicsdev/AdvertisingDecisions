const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const uploadRoutes = require('./routes/upload');
const decisionRoutes = require('./routes/decisions');
const { runDecisionJob } = require('./jobs/decisionJob');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/decisions', decisionRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Schedule decision job to run every hour
/*cron.schedule('0 * * * *', async () => {
    console.log('⏰ Scheduled decision job triggered');
    try {
        await runDecisionJob();
    } catch (error) {
        console.error('Scheduled decision job failed:', error);
    }
});*/

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📤 Upload endpoint: http://localhost:${PORT}/api/upload/:tableType`);
    console.log(`✅ Decisions endpoint: http://localhost:${PORT}/api/decisions`);
});

module.exports = app;

