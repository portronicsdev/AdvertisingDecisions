const inventoryImport = {
  tableType: 'inventory',
  needsSeller: true,
  template: {
    headers: ['SKU', 'Platform', 'Platform SKU', 'Snapshot Date (YYYY-MM-DD)', 'Inventory Units'],
    sample: [
      ['POR 1812', 'Amazon', 'B08XYZ123', '2024-01-15', 200],
      ['POR 1813', 'Flipkart', '', "1Jan'26", 150],
    ],
    filename: 'Inventory_Facts_Template.xlsx',
    description: 'Seller inventory. Provide SKU or Platform SKU. Snapshot Date or Date Report (1Jan\'26). Seller is selected in the UI.'
  },
  columnMap: {
    sku: ['SKU'],
    platform: ['Platform'],
    platformSku: ['Platform SKU', 'ASIN'],
    snapshotDate: ['Snapshot Date (YYYY-MM-DD)'],
    dateReport: ['Date Report', 'Date'],
    inventoryUnits: ['Inventory Units']
  },
  requiredColumns: ['inventoryUnits'],
  validateColumns(columns) {
    const missing = [];
    const hasSku = columns.sku !== -1;
    const hasPlatformSku = columns.platformSku !== -1;
    if (!hasSku && !hasPlatformSku) {
      missing.push('SKU or Platform SKU');
    }
    const hasSnapshot = columns.snapshotDate !== -1;
    const hasDateReport = columns.dateReport !== -1;
    if (!hasSnapshot && !hasDateReport) {
      missing.push('Snapshot Date or Date Report');
    }
    return missing;
  },
  validateRow(item, rowNumber) {
    const errors = [];
    if (!item.sku && !item.platformSku) {
      errors.push(`Row ${rowNumber}: SKU or Platform SKU is required`);
    }
    const hasSnapshot = !!item.snapshotDate;
    const hasDateReport = !!item.dateReport;
    if (!hasSnapshot && !hasDateReport) {
      errors.push(`Row ${rowNumber}: Snapshot Date or Date Report is required`);
    }
    return errors;
  }
};

export default inventoryImport;
