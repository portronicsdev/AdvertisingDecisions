
/* ---------- helpers ---------- */

const intVal = v => (v ? parseInt(v, 10) : 0);
const floatVal = v => (v ? parseFloat(v) : 0);

function parseDDMonYY(value) {
  if (!value) return null;

  const m = String(value).trim().match(/^(\d{1,2})([A-Za-z]{3})'?(\d{2})$/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const mon = m[2].toLowerCase();
  const year = 2000 + parseInt(m[3], 10);

  const monthMap = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  if (!(mon in monthMap)) return null;

  return new Date(year, monthMap[mon], day)
    .toISOString()
    .slice(0, 10);
}

function weekToRange(week, month, year) {
  const w = parseInt(String(week).replace('W', ''), 10);
  const m = new Date(`${month} 1, ${year}`).getMonth();

  const start = new Date(year, m, (w - 1) * 7 + 1);
  const end = new Date(year, m, Math.min(start.getDate() + 6, 31));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}



/**
 * FINAL version — uses product_platform_id
 */
function mapSalesFactRow(row, ctx, meta) {
 // console.log('Mapping row:', row);
  const rawSku = row['Platform SKU'] || row['ASIN'];

  if (!rawSku)
  { console.warn('⚠️ Missing SKU in row:', row);
     return null;}
     
  //console.log('Raw SKU:', rawSku);
  const platformSku = String(rawSku).trim();
  /* ---------- resolve mapping ---------- */

  const productPlatformId = meta.platformMap[platformSku];
  if (!productPlatformId) {
    //console.warn(`⚠️ Missing platform SKU: ${platformSku}`);
    meta.missingPlatformSkus.add(platformSku);
    return null;
  }

  /* ---------- date handling ---------- */

  let start, end;

  // DAILY
  if (row.Date) {
    const parsed = parseDDMonYY(row.Date);

    if (!parsed) {
      meta.errorRows.push({
        row,
        error: `Invalid Date: ${row.Date}`
      });
      return null;
    }

    start = end = parsed;
  }

  // WEEKLY
  else if (row.Week && row.Month && row.Year) {
    try {
      ({ start, end } = weekToRange(row.Week, row.Month, row.Year));
    } catch {
      meta.errorRows.push({ row, error: 'Invalid week format' });
      return null;
    }
  }

  // MONTHLY
  else if (row.Month && row.Year) {
    try {
      start = new Date(`${row.Month} 1, ${row.Year}`)
        .toISOString()
        .slice(0, 10);

      end = new Date(start.slice(0, 7) + '-31')
        .toISOString()
        .slice(0, 10);
    } catch {
      meta.errorRows.push({ row, error: 'Invalid month/year' });
      return null;
    }
  }

  else {
    meta.errorRows.push({ row, error: 'Missing date info' });
    console.warn('⚠️ Missing date info:', row);
    return null;
  }

  /* ---------- return ---------- */
  let j = {
    product_platform_id: productPlatformId,   // ✅ CORRECT
    seller_id: ctx.sellerId || null,
    period_start_date: start,
    period_end_date: end,
    units_sold: intVal(row['Units Sold']),
    revenue: floatVal(row['Shipped Revenue'])
  };
  return {
    product_platform_id: productPlatformId,   // ✅ CORRECT
    seller_id: ctx.sellerId || null,
    period_start_date: start,
    period_end_date: end,
    units_sold: intVal(row['Units Sold']),
    revenue: floatVal(row['Shipped Revenue'])
  };
}

module.exports = {
  mapSalesFactRow
};
