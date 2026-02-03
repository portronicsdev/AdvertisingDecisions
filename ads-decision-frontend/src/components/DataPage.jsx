import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  refreshKey = 0
}) {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [pageIndex, setPageIndex] = useState(0);
  const [lastUpload, setLastUpload] = useState(null);

  const offset = pageIndex * pageSize;
  const totalPages = Math.max(Math.ceil(count / pageSize), 1);

  useEffect(() => {
    let isActive = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await axios.get(
          `${API_BASE_URL}/api/data/${tableType}?limit=${pageSize}&offset=${offset}`
        );
        if (!isActive) return;
        setRows(response.data?.rows || []);
        setCount(response.data?.count || 0);
      } catch (err) {
        if (!isActive) return;
        const message = err.response?.data?.message || 'Failed to fetch data';
        setError(message);
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
  }, [tableType, pageSize, offset, refreshKey]);

  useEffect(() => {
    if (count === 0) return;
    const maxIndex = Math.max(Math.ceil(count / pageSize) - 1, 0);
    if (pageIndex > maxIndex) {
      setPageIndex(maxIndex);
    }
  }, [count, pageIndex, pageSize]);

  useEffect(() => {
    let isActive = true;
    const fetchUpload = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/uploads/latest?tableType=${tableType}`
        );
        if (!isActive) return;
        setLastUpload(response.data?.latest || null);
      } catch (err) {
        if (!isActive) return;
        setLastUpload(null);
      }
    };
    fetchUpload();
    return () => {
      isActive = false;
    };
  }, [tableType, refreshKey]);

  const lastUploadText = useMemo(() => {
    if (!lastUpload) return 'No uploads yet';
    const range = lastUpload.range_start && lastUpload.range_end
      ? `${lastUpload.range_start} → ${lastUpload.range_end}`
      : 'Range not set';
    const label = lastUpload.range_label ? `(${lastUpload.range_label})` : '';
    const when = formatDate(lastUpload.created_at);
    return `${range} ${label} • ${when}`;
  }, [lastUpload]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          <div className="page-subtitle">
            Total: {count} • Last upload: {lastUploadText}
          </div>
        </div>
        {showUpload && (
          <button className="btn btn-primary" onClick={() => onOpenImport(tableType)}>
            Upload {title}
          </button>
        )}
      </div>

      <div className="page-controls">
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
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading">Loading {title.toLowerCase()}...</div>
        ) : error ? (
          <div className="error">{error}</div>
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
                        {col.render ? col.render(row) : (row[col.key] ?? '-')}
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
