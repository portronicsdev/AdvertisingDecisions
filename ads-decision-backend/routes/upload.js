const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supabase = require('../config/database');
const { excelToCsv } = require('../utils/excelToCsv');
const { ingestCsv } = require('../services/ingestionService');
const {
    mapProductRow,
    mapProductPlatformRow,
    mapSalesFactRow,
    mapInventoryFactRow,
    mapCompanyInventoryFactRow,
    mapAdPerformanceFactRow,
    mapRatingsFactRow,
    mapSellerRow
} = require('../services/mappers');
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
 * Uploads Excel file, converts to CSV, then streams rows into the database:
 *   upload.js -> excelToCsv -> mappers -> ingestionService
 *
 * tableType options:
 * - products (product master data)
 * - product-platforms (creates product-platform relationships)
 * - sales
 * - inventory
 * - company-inventory
 * - ad-performance
 * - ratings
 * - sellers
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
        
        // Validate table type early
        if (!tableType) {
            fs.unlinkSync(excelPath);
            if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
            return res.status(400).json({ error: 'Missing table type' });
        }

        // Require seller_id for sales and inventory uploads
        let platformId = null;
        let sellerId = null;
        if (tableType === 'sales' || tableType === 'inventory') {
            const parsedSellerId = parseInt(req.body.seller_id || '0', 10);
            if (!parsedSellerId) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing seller_id',
                    message: 'seller_id is required for sales and inventory uploads'
                });
            }
            
            const { data: sellerData, error: sellerError } = await supabase
                .from('sellers')
                .select('platform_id')
                .eq('seller_id', parsedSellerId)
                .single();
            
            if (sellerError || !sellerData?.platform_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid seller_id',
                    message: 'Seller not found or missing platform'
                });
            }
            platformId = sellerData.platform_id;
            sellerId = parsedSellerId;
        }
        if (tableType === 'ratings' && req.body.platform_id) {
            const parsedPlatformId = parseInt(req.body.platform_id || '0', 10);
            if (!parsedPlatformId) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid platform_id',
                    message: 'platform_id is required for ratings uploads'
                });
            }
            platformId = parsedPlatformId;
        }
        
        const mapperMap = {
            'products': mapProductRow,
            'product-platforms': mapProductPlatformRow,
            'sales': mapSalesFactRow,
            'inventory': mapInventoryFactRow,
            'company-inventory': mapCompanyInventoryFactRow,
            'ad-performance': mapAdPerformanceFactRow,
            'ratings': mapRatingsFactRow,
            'sellers': mapSellerRow
        };
        
        const tableMap = {
            'products': 'products',
            'product-platforms': 'product_platforms',
            'sales': 'sales_facts',
            'inventory': 'inventory_facts',
            'company-inventory': 'company_inventory_facts',
            'ad-performance': 'ad_performance_facts',
            'ratings': 'ratings_facts',
            'sellers': 'sellers'
        };
        
        const mapper = mapperMap[tableType];
        const tableName = tableMap[tableType];
        
        if (!mapper || !tableName) {
            fs.unlinkSync(excelPath);
            if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
            return res.status(400).json({ error: `Invalid table type: ${tableType}` });
        }
        
        const context = {
            sellerId,
            platformId,
            adType: (req.body.ad_type || '').toLowerCase().trim() || null,
            snapshotDate: req.body.snapshot_date || null
        };
        
        const rowMapper = async (row) => {
            const mapped = await mapper(row, context);
            if (!mapped) return null;
            if ((tableType === 'sales' || tableType === 'inventory') && sellerId) {
                return { ...mapped, seller_id: sellerId };
            }
            return mapped;
        };
        
        // Ingest CSV into database
        let result;
        try {
            result = await ingestCsv(csvPath, tableName, rowMapper);
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

        if (result.success === false) {
            return res.json({
                success: false,
                message: result.message || 'Ingestion failed',
                rowCount: result.rowCount,
                batchCount: result.batchCount,
                skippedRowCount: result.skippedRowCount,
                errorRowCount: result.errorRowCount,
                errorRows: result.errorRows?.slice(0, 10) || []
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
        
        const rangeStart = req.body.range_start || null;
        const rangeEnd = req.body.range_end || null;
        const rangeLabel = req.body.range_label || null;
        if (['sales', 'inventory', 'ad-performance', 'products', 'product-platforms'].includes(tableType)) {
            const { error: logError } = await supabase
                .from('upload_logs')
                .insert({
                    table_type: tableType,
                    seller_id: sellerId || null,
                    range_start: rangeStart,
                    range_end: rangeEnd,
                    range_label: rangeLabel
                });
            if (logError) {
                console.error('Upload log insert failed:', logError);
            }
        }

        res.json({
            success: true,
            message: `Successfully ingested ${result.rowCount} rows into ${tableName}`,
            rowCount: result.rowCount,
            batchCount: result.batchCount,
            skippedRowCount: result.skippedRowCount,
            errorRowCount: result.errorRowCount,
            errorRows: result.errorRows?.slice(0, 10) || []
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

