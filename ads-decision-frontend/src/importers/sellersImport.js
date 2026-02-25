const sellersImport = {
  tableType: 'sellers',
  title: 'Sellers',

  needsSeller: true,
  needsDateRange: false,
  needsPlatform: false,
  needsSnapshotDate: false,
  needsAdType: false,

  uploadUrl: '/api/upload/sellers',

  template: {
    headers: ['Seller Name', 'Platform', 'Active'],
    sample: [
      ['Portronics Seller A', 'Amazon', 'true'],
      ['Portronics Seller B', 'Amazon', 'true'],
    ],
    filename: 'Sellers_Template.xlsx',
    description: 'Seller master data by platform.'
  },

  columnMap: {
    sellerName: ['Seller Name'],
    platform: ['Platform'],
    active: ['Active']
  },

  requiredColumns: ['sellerName', 'platform'],

  validateRow(item, rowNumber) {
    const errors = [];
    if (!item.sellerName) errors.push(`Row ${rowNumber}: Seller Name is required`);
    if (!item.platform) errors.push(`Row ${rowNumber}: Platform is required`);
    return errors;
  }
};

export default sellersImport;