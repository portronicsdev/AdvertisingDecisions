const { evaluateAllDecisions, saveDecision } = require('../services/decisionEngine');

/**
 * Decision Job
 * Runs periodically to evaluate and save decisions for all product-platform combinations
 */
async function runDecisionJob(options = {}) {
    try {
        console.log('🔄 Starting decision job...');
        const startTime = Date.now();
        const { sellerId } = options;
        console.log(`🔎 Evaluating decisions${sellerId ? ` for seller ${sellerId}` : ''}...`);
        const decisions = await evaluateAllDecisions({ sellerId });
        console.log(`🧾 Evaluated ${decisions.length} decisions. Saving...`);
        
        // Save all decisions
        const logEvery = 50;
        for (let i = 0; i < decisions.length; i++) {
            const decision = decisions[i];
            await saveDecision(
                decision.product_platform_id,
                decision.seller_id,
                decision.decision,
                decision.reason
            );
            if ((i + 1) % logEvery === 0 || i + 1 === decisions.length) {
                console.log(`💾 Saved ${i + 1}/${decisions.length}`);
            }
        }
        
        const duration = Date.now() - startTime;
        const yesCount = decisions.filter(d => d.decision).length;
        const noCount = decisions.filter(d => !d.decision).length;
        
        console.log(`✅ Decision job completed in ${duration}ms`);
        console.log(`   Total: ${decisions.length} | YES: ${yesCount} | NO: ${noCount}`);
        
        return {
            total: decisions.length,
            yes: yesCount,
            no: noCount,
            duration
        };
    } catch (error) {
        console.error('❌ Error running decision job:', error);
        throw error;
    }
}

module.exports = { runDecisionJob };

