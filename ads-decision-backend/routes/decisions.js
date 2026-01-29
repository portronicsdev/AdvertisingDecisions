const express = require('express');
const supabase = require('../config/database');
const { runDecisionJob } = require('../jobs/decisionJob');

const router = express.Router();

/**
 * GET /api/decisions
 * Get all decisions with product and platform details
 */
router.get('/', async (req, res) => {
    try {
        const { platform, decision } = req.query;
        
        let query = supabase
            .from('decisions')
            .select(`
                id,
                decision,
                reason,
                evaluated_at,
                product_platforms!inner(
                    product_platform_id,
                    platform_sku,
                    products:products!inner(
                        product_id,
                        sku,
                        product_name
                    ),
                    platforms:platforms!inner(
                        platform_id,
                        name
                    )
                )
            `);
        
        if (platform) {
            query = query.eq('product_platforms.platforms.name', platform);
        }
        
        if (decision !== undefined) {
            query = query.eq('decision', decision === 'true' || decision === true);
        }
        
        query = query.order('evaluated_at', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        // Transform data to match expected format
        const decisions = (data || []).map(d => {
            const pp = d.product_platforms;
            return {
                id: d.id,
                decision: d.decision,
                reason: d.reason,
                evaluated_at: d.evaluated_at,
                product_id: pp?.products?.product_id,
                sku: pp?.products?.sku,
                product_name: pp?.products?.product_name,
                platform_id: pp?.platforms?.platform_id,
                platform_name: pp?.platforms?.name,
                platform_sku: pp?.platform_sku
            };
        });
        
        res.json({
            success: true,
            count: decisions.length,
            decisions
        });
        
    } catch (error) {
        console.error('Error fetching decisions:', error);
        res.status(500).json({
            error: 'Failed to fetch decisions',
            message: error.message
        });
    }
});

/**
 * GET /api/decisions/:productPlatformId
 * Get decision for a specific product-platform combination
 */
router.get('/:productPlatformId', async (req, res) => {
    try {
        const { productPlatformId } = req.params;
        
        const { data, error } = await supabase
            .from('decisions')
            .select(`
                id,
                decision,
                reason,
                evaluated_at,
                product_platforms!inner(
                    product_platform_id,
                    platform_sku,
                    products:products!inner(
                        product_id,
                        sku,
                        product_name
                    ),
                    platforms:platforms!inner(
                        platform_id,
                        name
                    )
                )
            `)
            .eq('product_platform_id', productPlatformId)
            .single();
        
        if (error || !data) {
            return res.status(404).json({
                error: 'Decision not found'
            });
        }
        
        // Transform data to match expected format
        const pp = data.product_platforms;
        const decision = {
            id: data.id,
            decision: data.decision,
            reason: data.reason,
            evaluated_at: data.evaluated_at,
            product_id: pp?.products?.product_id,
            sku: pp?.products?.sku,
            product_name: pp?.products?.product_name,
            platform_id: pp?.platforms?.platform_id,
            platform_name: pp?.platforms?.name,
            platform_sku: pp?.platform_sku
        };
        
        res.json({
            success: true,
            decision
        });
        
    } catch (error) {
        console.error('Error fetching decision:', error);
        res.status(500).json({
            error: 'Failed to fetch decision',
            message: error.message
        });
    }
});

/**
 * POST /api/decisions/run
 * Manually trigger decision job
 */
router.post('/run', async (req, res) => {
    try {
        const result = await runDecisionJob();
        res.json({
            success: true,
            message: 'Decision job completed',
            ...result
        });
    } catch (error) {
        console.error('Error running decision job:', error);
        res.status(500).json({
            error: 'Failed to run decision job',
            message: error.message
        });
    }
});

module.exports = router;

