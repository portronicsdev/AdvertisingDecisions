const adPerformanceImport = {
  tableType: 'ad-performance',
  title: 'Ad Performance',

  needsSeller: false,
  needsDateRange: true,
  needsPlatform: false,
  needsSnapshotDate: false,
  needsAdType: true,

  uploadUrl: '/api/upload/ad-performance',

  template: {
    headers: [
      'ASIN', 'Date', 'Week', 'Month', 'Year',
      'Period Start (YYYY-MM-DD)', 'Period End (YYYY-MM-DD)',
      'Spend', 'Revenue', 'Ad Type'
    ],
    sample: [
      ['B07N8RQ6W7', '2024-01-01', '', '', '', '', '', 5000, 40000, 'sp'],
      ['B0CVN4DNWY', '', '2', '01', '2024', '', '', 3000, 20000, 'sd'],
    ],
    filename: 'Ad_Performance_Template.xlsx',
    description: 'Ad spend and revenue data.'
  },

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

    if (!item.platformSku) {
      errors.push(`Row ${rowNumber}: Platform SKU/ASIN is required`);
    }

    const hasDate = !!item.date;
    const hasPeriod = !!item.periodStart && !!item.periodEnd;
    const hasWeek = !!item.week && !!item.month && !!item.year;

    if (!hasDate && !hasPeriod && !hasWeek) {
      errors.push(`Row ${rowNumber}: Date, Period, or Week/Month/Year required`);
    }

    return errors;
  }
};

export default adPerformanceImport;