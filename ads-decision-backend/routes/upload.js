const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { excelToCsv } = require('../utils/excelToCsv');
const { ingestCsv } = require('../services/ingestionService');
const { mapProductRow, mapProductPlatformRow, mapSalesFactRow, mapInventoryFactRow, mapCompanyInventoryFactRow, mapAdPerformanceFactRow, mapRatingsFactRow } = require('../services/mappers');
const { runDecisionJob } = require('../jobs/decisionJob');

// Keep CSV files for debugging (set KEEP_CSV_FILES=true in .env to enable)
const KEEP_CSV_FILES = process.env.KEEP_CSV_FILES === 'true';

const router = express.Router();

// Configure multer for temporary file storage
const uploadDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    }
});

/**
 * POST /api/upload/:tableType
 * Uploads Excel file and ingests into specified table
 * 
 * tableType options:
 * - products (product master data)
 * - product-platforms (creates product-platform relationships)
 * - sales
 * - inventory
 * - company-inventory
 * - ad-performance
 * - ratings
 */
router.post('/:tableType', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { tableType } = req.params;
        const excelPath = req.file.path;
        
        console.log(`📤 Processing upload: ${req.file.originalname} for table: ${tableType}`);

        // Convert Excel to CSV
        const csvPath = await excelToCsv(excelPath, uploadDir);
        
        // Verify CSV file exists before proceeding
        if (!fs.existsSync(csvPath)) {
            if (fs.existsSync(excelPath)) fs.unlinkSync(excelPath);
            return res.status(500).json({
                success: false,
                error: 'CSV conversion failed',
                message: 'CSV file was not created successfully'
            });
        }
        
        console.log(`📄 CSV file ready: ${csvPath}`);
        
        // Map table type to mapper function
        const mapperMap = {
            'products': mapProductRow,
            'product-platforms': mapProductPlatformRow,
            'sales': mapSalesFactRow,
            'inventory': mapInventoryFactRow,
            'company-inventory': mapCompanyInventoryFactRow,
            'ad-performance': mapAdPerformanceFactRow,
            'ratings': mapRatingsFactRow
        };
        
        const tableMap = {
            'products': 'products',
            'product-platforms': 'product_platforms',
            'sales': 'sales_facts',
            'inventory': 'inventory_facts',
            'company-inventory': 'company_inventory_facts',
            'ad-performance': 'ad_performance_facts',
            'ratings': 'ratings_facts'
        };
        
        const mapper = mapperMap[tableType];
        const tableName = tableMap[tableType];
        
        if (!mapper || !tableName) {
            // Clean up files
            fs.unlinkSync(excelPath);
            if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
            return res.status(400).json({ error: `Invalid table type: ${tableType}` });
        }
        
        // Ingest CSV into database
        let result;
        try {
            result = await ingestCsv(csvPath, tableName, mapper);
        } catch (ingestError) {
            // Clean up files on ingestion error
            console.error('Ingestion error:', ingestError);
            console.log(`📁 CSV file path that failed: ${csvPath}`);
            console.log(`📁 CSV file exists: ${fs.existsSync(csvPath)}`);
            
            try {
                if (fs.existsSync(excelPath)) {
                    fs.unlinkSync(excelPath);
                    console.log(`🗑️  Deleted Excel file after error: ${excelPath}`);
                }
                if (KEEP_CSV_FILES) {
                    console.log(`💾 Keeping CSV file for debugging after error: ${csvPath}`);
                } else {
                    if (fs.existsSync(csvPath)) {
                        fs.unlinkSync(csvPath);
                        console.log(`🗑️  Deleted CSV file after error: ${csvPath}`);
                    }
                }
            } catch (cleanupError) {
                console.error('Warning: Failed to cleanup files after error:', cleanupError);
            }
            return res.status(500).json({
                success: false,
                error: 'Ingestion failed',
                message: ingestError.message || 'Failed to ingest data into database'
            });
        }
        
        // Validate result
        if (!result || result.rowCount === undefined) {
            // Clean up files
            if (fs.existsSync(excelPath)) fs.unlinkSync(excelPath);
            if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
            
            return res.status(500).json({
                success: false,
                error: 'Ingestion failed',
                message: 'Invalid result from ingestion service'
            });
        }
        
        // Clean up temporary files (unless KEEP_CSV_FILES is enabled)
        try {
            if (fs.existsSync(excelPath)) {
                fs.unlinkSync(excelPath);
                console.log(`🗑️  Deleted Excel file: ${excelPath}`);
            }
            if (KEEP_CSV_FILES) {
                console.log(`💾 Keeping CSV file for debugging: ${csvPath}`);
            } else {
                if (fs.existsSync(csvPath)) {
                    fs.unlinkSync(csvPath);
                    console.log(`🗑️  Deleted CSV file: ${csvPath}`);
                }
            }
        } catch (cleanupError) {
            console.error('Warning: Failed to cleanup temp files:', cleanupError);
        }
        
       /* // Run decision job after successful ingestion
        try {
            await runDecisionJob();
        } catch (error) {
            console.error('Warning: Decision job failed after ingestion:', error);
            // Don't fail the upload if decision job fails
        }*/
        
        res.json({
            success: true,
            message: `Successfully ingested ${result.rowCount} rows into ${tableName}`,
            rowCount: result.rowCount,
            batchCount: result.batchCount
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up files on error
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Warning: Failed to cleanup file:', cleanupError);
            }
        }
        
        // Determine status code based on error type
        const statusCode = error.statusCode || (error.message && error.message.includes('Invalid') ? 400 : 500);
        
        res.status(statusCode).json({
            success: false,
            error: 'Upload failed',
            message: error.message || 'An unexpected error occurred during upload'
        });
    }
});

module.exports = router;

