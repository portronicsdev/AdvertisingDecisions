const express = require('express');
const supabase = require('../config/database');

const router = express.Router();

router.get('/latest', async (req, res) => {
    try {
        const { tableType, seller_id: sellerId } = req.query;
        if (!tableType) {
            return res.status(400).json({ success: false, message: 'tableType is required' });
        }

        let query = supabase
            .from('upload_logs')
            .select('upload_id, table_type, seller_id, range_start, range_end, range_label, created_at')
            .eq('table_type', tableType)
            .order('created_at', { ascending: false })
            .limit(1);

        if (sellerId) {
            query = query.eq('seller_id', parseInt(sellerId, 10));
        }

        const { data, error } = await query;
        if (error) {
            throw error;
        }

        const latest = (data || [])[0] || null;
        res.json({ success: true, latest });
    } catch (error) {
        console.error('Error fetching latest upload:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to fetch upload info' });
    }
});

module.exports = router;
