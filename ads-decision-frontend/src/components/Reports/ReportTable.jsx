import React from 'react';

export default function ReportTable({
  rows = [],
  sellerColumns = [],
  loading = false
}) {
  if (loading) {
    return <div className="loading">Loading report…</div>;
  }

  if (!rows || rows.length === 0) {
    return <div className="empty">No data found</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th>ASIN</th>

            {sellerColumns.map(s => (
              <th key={`sales-${s}`}>Sales – {s}</th>
            ))}
            <th>Sales – Total</th>

            {sellerColumns.map(s => (
              <th key={`inv-${s}`}>Inventory – {s}</th>
            ))}
            <th>Inventory – Total</th>

            <th>Rating</th>
            <th>ROAS</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, idx) => {
            const rowKey =
              r.product_platform_id ||
              `${r.sku || 'sku'}-${r.platform_sku || idx}`;

            return (
              <tr key={rowKey}>
                <td>{r.sku || '—'}</td>
                <td>{r.product_name || '—'}</td>
                <td>{r.platform_sku || '—'}</td>

                {sellerColumns.map(s => (
                  <td key={`sales-${rowKey}-${s}`}>
                    {r.sales_by_seller?.[s] ?? 0}
                  </td>
                ))}
                <td>{r.sales_total ?? 0}</td>

                {sellerColumns.map(s => (
                  <td key={`inv-${rowKey}-${s}`}>
                    {r.inventory_by_seller?.[s] ?? 0}
                  </td>
                ))}
                <td>{r.inventory_total ?? 0}</td>

                <td>{r.rating ?? '—'}</td>
                <td>
                  {typeof r.roas === 'number'
                    ? r.roas.toFixed(2)
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
