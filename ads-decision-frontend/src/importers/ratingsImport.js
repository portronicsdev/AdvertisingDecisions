const ratingsImport = {
  tableType: 'ratings',
  title: 'Ratings',

  needsSeller: false,
  needsDateRange: false,
  needsPlatform: false,
  needsSnapshotDate: true,
  needsAdType: false,

  uploadUrl: '/api/upload/ratings',

  template: {
    headers: ['SKU', 'ASIN', 'Platform', 'Snapshot Date', 'Rating', 'Review Count'],
    sample: [
      ['POR 1812', 'B08XYZ123', 'Amazon', '2024-01-15', 4.5, 150],
      ['POR 1813', '', 'Flipkart', '2024-01-15', 4.2, 80],
    ],
    filename: 'Ratings_Template.xlsx',
    description: 'Product ratings and review counts.'
  },

  columnMap: {
    sku: ['SKU'],
    platformSku: ['Platform SKU', 'ASIN'],
    rating: ['Ratings'],
    reviewCount: ['Review Count']
  },

  requiredColumns: [],

  validateRow(item, rowNumber) {
    const errors = [];

    if (!item.platformSku) {
      errors.push(`Row ${rowNumber}: ASIN/Platform SKU required`);
    }

    return errors;
  }
};

export default ratingsImport;