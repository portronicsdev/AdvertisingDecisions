import salesImport from './salesImport';
import inventoryImport from './inventoryImport';

import productPlatformsImport from './productPlatformsImport';
import productsImport from './productsImport';
import sellersImport from './sellersImport';
import adPerformanceImport from './adPerformanceImport';
import ratingsImport from './ratingsImport';

const importerMap = {
  sales: salesImport,
  inventory: inventoryImport,
  'product-platforms': productPlatformsImport,
  products: productsImport,
  sellers: sellersImport,
  'ad-performance': adPerformanceImport,
  ratings: ratingsImport
};

export const getImporter = (type) => importerMap[type];