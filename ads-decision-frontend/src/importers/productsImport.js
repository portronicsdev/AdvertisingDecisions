const productsImport = {
  tableType: 'products',
  title: 'Products',

  needsSeller: false,
  needsDateRange: false,
  needsPlatform: false,
  needsSnapshotDate: false,
  needsAdType: false,

  uploadUrl: '/api/upload/products',

  template: {
    headers: ['SKU', 'Product Name', 'Category', 'Launch Date', 'Active'],
    sample: [
      ['POR 1812', 'Product Name 1', 'Audio', '2024-01-01', 'true'],
      ['POR 1813', 'Product Name 2', 'Audio', '2024-01-15', 'true'],
    ],
    filename: 'Products_Template.xlsx',
    description: 'Product master data. SKU must be unique.'
  },

  columnMap: {
    sku: ['SKU'],
    productName: ['Product Name'],
    category: ['Category'],
    launchDate: ['Launch Date'],
    active: ['Active']
  },

  requiredColumns: ['sku'],

  validateRow(item, rowNumber) {
    const errors = [];
    if (!item.sku) errors.push(`Row ${rowNumber}: SKU is required`);
    return errors;
  }
};

export default productsImport;