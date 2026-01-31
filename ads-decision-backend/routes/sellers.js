const express = require('express');
const supabase = require('../config/database');

const router = express.Router();

/**
 * GET /api/sellers
 * List sellers (optionally filtered by platform_id)
 */
router.get('/', async (req, res) => {
    try {
        const { platform_id: platformId, platform } = req.query;
        
        let query = supabase
            .from('sellers')
            .select(`
                seller_id,
                name,
                platform_id,
                active,
                platforms:platforms!inner(
                    platform_id,
                    name
                )
            `)
            .order('name', { ascending: true });
        
        if (platformId) {
            query = query.eq('platform_id', parseInt(platformId, 10));
        }
        
        if (platform) {
            query = query.eq('platforms.name', platform);
        }
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        const sellers = (data || []).map(s => ({
            seller_id: s.seller_id,
            name: s.name,
            platform_id: s.platform_id,
            platform_name: s.platforms?.name,
            active: s.active
        }));
        
        res.json({ success: true, count: sellers.length, sellers });
    } catch (error) {
        console.error('Error fetching sellers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sellers',
            message: error.message
        });
    }
});

module.exports = router;
