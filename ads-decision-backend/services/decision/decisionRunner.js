const supabase = require('../config/database');
const { preloadDecisionData } = require('./decisionDataLoader');
const { evaluateDecision } = require('./decisionEngine');

async function runDecisions({ sellerId }) {

  const { data: productPlatforms } = await supabase
    .from('product_platforms')
    .select('product_platform_id, product_id');

  const maps = await preloadDecisionData({});

  const decisionRows = [];

  for (const pp of productPlatforms) {
    const result = evaluateDecision({
      productPlatformId: pp.product_platform_id,
      productId: pp.product_id,
      sellerId,
      maps
    });

    decisionRows.push({
      product_platform_id: pp.product_platform_id,
      seller_id: sellerId,
      decision: result.decision,
      reason: result.reason,
      evaluated_at: new Date().toISOString()
    });
  }

  await supabase
    .from('decisions')
    .upsert(decisionRows, {
      onConflict: 'product_platform_id,seller_id'
    });

  return decisionRows.length;
}

module.exports = { runDecisions };
