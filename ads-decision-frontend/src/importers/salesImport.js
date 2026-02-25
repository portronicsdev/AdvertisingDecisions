const salesImport = {
  tableType: 'sales',
  title: 'Sales',
  needsSeller: true,
  needsDateRange: true,
  needsPlatform: false,
  needsSnapshotDate: false,
  needsAdType: false,
  uploadUrl: '/api/upload/sales',

  template: {
    headers: ['SKU', 'Platform', 'Platform SKU', 'Period Start (YYYY-MM-DD)', 'Period End (YYYY-MM-DD)', 'Units Sold'],
    sample: [
      ['POR 1812', 'Amazon', 'B08XYZ123', '2024-01-01', '2024-01-31', 100],
      ['POR 1813', 'Flipkart', '', "1Jan'26", '', 50],
    ],
    filename: 'Sales_Facts_Template.xlsx',
    description: 'Sales data. Provide SKU or Platform SKU. Use Period Start/End or a Date Report like 1Jan\'26. Seller is selected in the UI.'
  },
  columnMap: {
    sku: ['SKU'],
    platform: ['Platform'],
    platformSku: ['Platform SKU', 'ASIN'],
    periodStart: ['Period Start (YYYY-MM-DD)'],
    periodEnd: ['Period End (YYYY-MM-DD)'],
    dateReport: ['Date Report', 'Date'],
    unitsSold: ['Units Sold']
  },
  requiredColumns: ['unitsSold'],
  validateColumns(columns) {
    const missing = [];
    const hasSku = columns.sku !== -1;
    const hasPlatformSku = columns.platformSku !== -1;
    if (!hasSku && !hasPlatformSku) {
      missing.push('SKU or Platform SKU');
    }
    const hasPeriodStart = columns.periodStart !== -1;
    const hasPeriodEnd = columns.periodEnd !== -1;
    const hasDateReport = columns.dateReport !== -1;
    if (!(hasPeriodStart && hasPeriodEnd) && !hasDateReport) {
      missing.push('Period Start/End or Date Report');
    }
    return missing;
  },
  validateRow(item, rowNumber) {
    const errors = [];
    if (!item.sku && !item.platformSku) {
      errors.push(`Row ${rowNumber}: SKU or Platform SKU is required`);
    }
    const hasPeriod = !!item.periodStart && !!item.periodEnd;
    const hasDateReport = !!item.dateReport;
    if (!hasPeriod && !hasDateReport) {
      errors.push(`Row ${rowNumber}: Period Start/End or Date Report is required`);
    }
    return errors;
  }
};

export default salesImport;
