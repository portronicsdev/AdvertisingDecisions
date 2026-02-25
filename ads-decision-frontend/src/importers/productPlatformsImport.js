const productPlatformsImport = {
  tableType: 'product-platforms',
  title: 'Product Platforms',

  needsSeller: false,
  needsDateRange: false,
  needsPlatform: true,
  needsSnapshotDate: false,
  needsAdType: false,

  uploadUrl: '/api/upload/product-platforms',

  template: {
    headers: ['SKU', 'Platform', 'Platform SKU'],
    sample: [
      ['POR 1812', 'Amazon', 'B08XYZ123'],
      ['POR 1813', 'Flipkart', 'FLIP123456'],
    ],
    filename: 'Product_Platforms_Template.xlsx',
    description: 'Link products to platforms. SKU must exist in products table.'
  },

  columnMap: {
    sku: ['SKU'],
    platform: ['Platform'],
    platformSku: ['Platform SKU', 'ASIN']
  },

  requiredColumns: ['sku', 'platform'],

  validateRow(item, rowNumber) {
    const errors = [];
    if (!item.sku) errors.push(`Row ${rowNumber}: SKU is required`);
    if (!item.platform) errors.push(`Row ${rowNumber}: Platform is required`);
    return errors;
  }
};

export default productPlatformsImport;