import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

/* ---------------- helpers ---------------- */

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

export default function DataPage({
  title,
  tableType,
  columns,
  showUpload,
  onOpenImport,
  refreshKey = 0,
  headerActions = null
}) {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);

  const [lastUpload, setLastUpload] = useState(null);
  const [search, setSearch] = useState('');

  const offset = pageIndex * pageSize;
  const totalPages = Math.max(Math.ceil(count / pageSize), 1);

  /* ---------------- fetch data ---------------- */

  useEffect(() => {
    let isActive = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const params = {
          limit: pageSize,
          offset
        };

        if (search.trim()) {
          params.search = search.trim();
        }

        const res = await api.get(`/api/data/${tableType}`, params);

        if (!isActive) return;

        setRows(res.data?.rows || []);
        setCount(res.data?.count || 0);

      } catch (err) {
        if (!isActive) return;

        const message =
          err.response?.data?.message ||
          err.message ||
          'Failed to fetch data';

        setError(message);

        // reset page if out of bounds
        if (pageIndex > 0) {
          setPageIndex(0);
        }

      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isActive = false;
    };
  }, [tableType, pageSize, offset, refreshKey, search]);

  /* ---------------- fix page overflow ---------------- */

  useEffect(() => {
    if (count === 0) return;

    const maxIndex = Math.max(Math.ceil(count / pageSize) - 1, 0);

    if (pageIndex > maxIndex) {
      setPageIndex(maxIndex);
    }
  }, [count, pageIndex, pageSize]);

  /* ---------------- fetch last upload ---------------- */

  useEffect(() => {
    let isActive = true;

    const fetchUpload = async () => {
      try {
        const res = await api.get('/api/uploads/latest', {
          tableType
        });

        if (!isActive) return;

        setLastUpload(res.data?.latest || null);

      } catch {
        if (!isActive) return;
        setLastUpload(null);
      }
    };

    fetchUpload();

    return () => {
      isActive = false;
    };
  }, [tableType, refreshKey]);

  /* ---------------- derived ---------------- */

  const lastUploadText = useMemo(() => {
    if (!lastUpload) return 'No uploads yet';

    const range = lastUpload.range_start && lastUpload.range_end
      ? `${lastUpload.range_start} → ${lastUpload.range_end}`
      : 'Range not set';

    const label = lastUpload.range_label
      ? `(${lastUpload.range_label})`
      : '';

    const when = formatDate(lastUpload.created_at);

    return `${range} ${label} • ${when}`;
  }, [lastUpload]);

  /* ---------------- render ---------------- */

  return (
    <div className="page">

      {/* HEADER */}
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          <div className="page-subtitle">
            Total: {count} • Last upload: {lastUploadText}
          </div>
        </div>

        <div className="page-actions">
          {headerActions}

          {showUpload && (
            <button
              className="btn btn-primary"
              onClick={() => onOpenImport(tableType)}
            >
              Upload {title}
            </button>
          )}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="page-controls">

        {/* SEARCH */}
        <div className="search-box">
          <input
            type="text"
            placeholder="Search SKU / ASIN"
            value={search}
            onChange={(e) => {
              setPageIndex(0);
              setSearch(e.target.value);
            }}
          />
        </div>

        {/* PAGINATION */}
        <div className="pagination">
          <button
            className="btn btn-secondary"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex(prev => Math.max(prev - 1, 0))}
          >
            Prev
          </button>

          <span className="page-info">
            Page {pageIndex + 1} of {totalPages}
          </span>

          <button
            className="btn btn-secondary"
            disabled={pageIndex + 1 >= totalPages}
            onClick={() => setPageIndex(prev => Math.min(prev + 1, totalPages - 1))}
          >
            Next
          </button>
        </div>

        {/* PAGE SIZE */}
        <div className="page-size">
          <label>Rows</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageIndex(0);
              setPageSize(parseInt(e.target.value, 10));
            }}
          >
            {[25, 50, 100].map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* TABLE */}
      <div className="table-card">

        {loading ? (
          <div className="loading">
            Loading {title.toLowerCase()}...
          </div>
        ) : error ? (
          <div className="error">
            {error}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="empty">
                    No data found
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id || row.product_platform_id || idx}>
                    {columns.map(col => (
                      <td key={col.key}>
                        {col.render
                          ? col.render(row)
                          : (row[col.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

      </div>
    </div>
  );
}