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
        const decisions = await evaluateAllDecisions({ sellerId });
        
        // Save all decisions
        for (const decision of decisions) {
            await saveDecision(
                decision.product_platform_id,
                decision.seller_id,
                decision.decision,
                decision.reason
            );
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

