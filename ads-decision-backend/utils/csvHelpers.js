const csv = require('csv-parser');
const fs = require('fs');

/**
 * Extract unique SKUs from CSV file
 */
async function extractSkus(csvPath) {
  const skus = new Set();

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(csvPath)) {
      return reject(new Error(`CSV not found: ${csvPath}`));
    }

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const sku = row['SKU'];

        if (sku) {
          skus.add(String(sku).trim());
        }
      })
      .on('end', () => {
        console.log(`📊 Extracted ${skus.size} unique SKUs from CSV`);
        resolve(Array.from(skus));
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

async function extractPlatformSkus(csvPath) {
  return new Promise((resolve, reject) => {
    const skus = new Set();

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const sku = row['Platform SKU'] || row['ASIN'];
        if (sku) skus.add(String(sku).trim());
      })
      .on('end', () => {
        const arr = Array.from(skus);
        console.log(`📊 Extracted ${arr.length} platform SKUs`);
        resolve(arr);
      })
      .on('error', reject);
  });
}

module.exports = { extractPlatformSkus };

module.exports = {
  extractSkus,
  extractPlatformSkus
};
