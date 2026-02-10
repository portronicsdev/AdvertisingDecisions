const otherImports = {
  products: {
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
  },
  'product-platforms': {
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
  },
  sellers: {
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
  },
  'company-inventory': {
    template: {
      headers: ['SKU', 'Snapshot Date (YYYY-MM-DD)', 'Inventory Units', 'Location (Optional)'],
      sample: [
        ['POR 1812', '2024-01-15', 500, 'Warehouse A'],
        ['POR 1813', '2024-01-15', 300, 'Warehouse B'],
      ],
      filename: 'Company_Inventory_Template.xlsx',
      description: 'Company warehouse inventory. SKU must exist in products table.'
    },
    columnMap: {
      sku: ['SKU'],
      snapshotDate: ['Snapshot Date (YYYY-MM-DD)'],
      inventoryUnits: ['Inventory Units'],
      location: ['Location (Optional)']
    },
    needsSnapshotDate: true,
    needsDateRange: false,
    requiredColumns: ['sku', 'snapshotDate'],
    validateRow(item, rowNumber) {
      const errors = [];
      if (!item.sku) errors.push(`Row ${rowNumber}: SKU is required`);
      if (!item.snapshotDate) errors.push(`Row ${rowNumber}: Snapshot Date is required`);
      return errors;
    }
  },
  'ad-performance': {
    template: {
      headers: ['ASIN', 'Date', 'Week', 'Month', 'Year', 'Period Start (YYYY-MM-DD)', 'Period End (YYYY-MM-DD)', 'Spend', 'Revenue', 'Ad Type'],
      sample: [
        ['B07N8RQ6W7', '2024-01-01', '', '', '', '', '', 5000, 40000, 'sp'],
        ['B0CVN4DNWY', '', '2', '01', '2024', '', '', 3000, 20000, 'sd'],
      ],
      filename: 'Ad_Performance_Template.xlsx',
      description: 'Ad spend and revenue data. Use ASIN (or Platform SKU). Provide Date, Period Start/End, or Week/Month/Year.'
    },
    needsDateRange: true,
    columnMap: {
      platformSku: ['Platform SKU', 'ASIN'],
      date: ['Date'],
      week: ['Week'],
      month: ['Month'],
      year: ['Year'],
      periodStart: ['Period Start (YYYY-MM-DD)'],
      periodEnd: ['Period End (YYYY-MM-DD)'],
      spend: ['Spend'],
      revenue: ['Revenue'],
      adType: ['Ad Type']
    },
    requiredColumns: ['platformSku'],
    validateRow(item, rowNumber) {
      const errors = [];
      if (!item.platformSku) errors.push(`Row ${rowNumber}: Platform SKU/ASIN is required`);
      const hasDate = !!item.date;
      const hasPeriod = !!item.periodStart && !!item.periodEnd;
      const hasWeek = !!item.week && !!item.month && !!item.year;
      if (!hasDate && !hasPeriod && !hasWeek) {
        errors.push(`Row ${rowNumber}: Date, Period Start/End, or Week/Month/Year is required`);
      }
      return errors;
    }
  },
  ratings: {
    template: {
      headers: ['SKU', 'ASIN', 'Platform', 'Snapshot Date (YYYY-MM-DD)', 'Rating', 'Review Count'],
      sample: [
        ['POR 1812', 'B08XYZ123', 'Amazon', '2024-01-15', 4.5, 150],
        ['POR 1813', '', 'Flipkart', '2024-01-15', 4.2, 80],
      ],
      filename: 'Ratings_Facts_Template.xlsx',
      description: 'Product ratings and review counts. SKU must exist in products table.'
    },
    needsPlatform: true,
    needsSnapshotDate: true,
    needsDateRange: false,
    columnMap: {
      sku: ['SKU'],
      platformSku: ['Platform SKU', 'ASIN'],
      platform: ['Platform'],
      snapshotDate: ['Snapshot Date (YYYY-MM-DD)'],
      rating: ['Ratings'],
      reviewCount: ['Review Count']
    },
    requiredColumns: [],
    validateRow(item, rowNumber) {
      const errors = [];
      if (!item.sku && !item.platformSku) {
        errors.push(`Row ${rowNumber}: SKU or ASIN is required`);
      }
      return errors;
    }
  }
};

export default otherImports;
