function evaluateDecision({
  productPlatformId,
  productId,
  sellerId,
  maps
}) {
  const {
    salesMap,
    sellerInventoryMap,
    companyInventoryMap,
    ratingMap,
    roasMap
  } = maps;

  // --- Inventory Gate ---
  const avgDailySales = salesMap[productPlatformId];
  if (!avgDailySales) {
    return { decision: false, reason: 'No sales data' };
  }

  const sellerStock =
    sellerInventoryMap[productPlatformId]?.[sellerId] || 0;

  const stockCoverage = sellerStock / avgDailySales;
  const companyInventory = companyInventoryMap[productId] || 0;

  if (stockCoverage < 7 && companyInventory === 0) {
    return {
      decision: false,
      reason: `Low stock (${stockCoverage.toFixed(1)} days)`
    };
  }

  // --- Ratings Gate ---
  const rating = ratingMap[productPlatformId] || 0;
  if (rating < 4) {
    return {
      decision: false,
      reason: `Low rating (${rating})`
    };
  }

  // --- Performance Gate ---
  const roas = roasMap[productPlatformId] ?? 999;
  if (roas <= 8) {
    return {
      decision: false,
      reason: `Low ROAS (${roas.toFixed(2)})`
    };
  }

  return {
    decision: true,
    reason: 'All gates passed'
  };
}

module.exports = { evaluateDecision };
