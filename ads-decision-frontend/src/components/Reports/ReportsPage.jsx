import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ReportFilters from './ReportFilters';
import ReportTable from './ReportTable';
import Pagination from './Pagination';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ReportsPage() {
  const [rows, setRows] = useState([]);
  const [sellerColumns, setSellerColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    range:  'current_month',
    start: '',
    end: '',
    search: ''
  });

  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
    total: 0
  });

  /* ---------------- fetch report ---------------- */

  const fetchReport = async (override = {}) => {
  setLoading(true);
  setError(null);

  try {
    const params = {
      range: filters.range,
      start: filters.start,
      end: filters.end,
      search: filters.search,
      limit: pagination.limit,
      offset: override.offset ?? pagination.offset
    };

    const { data } = await axios.get(
      `${API_BASE_URL}/api/reports/product-summary`,
      { params }
    );

    /* ---------- FULL NO DATA ---------- */

    if (data.message) {
      setRows([]);
      setSellerColumns([]);
      setPagination(p => ({
        ...p,
        total: 0,
        offset: params.offset
      }));
      setError(data.message);
      return;
    }

    /* ---------- NORMAL DATA ---------- */

    setRows(data.rows || []);
    setSellerColumns(data.sellerColumns || []);
    setPagination(p => ({
      ...p,
      total: data.count || 0,
      offset: params.offset
    }));

    /* ---------- PARTIAL WARNING ---------- */

    if (data.warning) {
      setError(data.warning);
    }

  } catch (err) {
    setError(err.response?.data?.message || 'Failed to load report');
  } finally {
    setLoading(false);
  }
};


  /* ---------------- generate (save filters) ---------------- */

  const handleGenerate = () => {
      // 🛑 validation for custom
      if (filters.range === 'custom' && (!filters.start || !filters.end)) {
        setError('Please select start and end date for custom range');
        return;
      }

      setError(null);

      localStorage.setItem('reportFilters', JSON.stringify(filters));
      localStorage.setItem('reportGenerated', 'true');

      fetchReport({ offset: 0 });
    };



  /* ---------------- restore on reload ---------------- */

  useEffect(() => {
    const generated = localStorage.getItem('reportGenerated');
    const savedFilters = localStorage.getItem('reportFilters');

    if (generated === 'true' && savedFilters) {
      const parsed = JSON.parse(savedFilters);
      setFilters(parsed);
      fetchReport({ offset: 0 });
    }
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>Reports</h2>

      <ReportFilters
        filters={filters}
        onChange={(updated) => {
          setFilters(updated);
          setPagination((p) => ({ ...p, offset: 0 }));
        }}
        onGenerate={handleGenerate}
        loading={loading}
      />

      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}

      <ReportTable
        rows={rows}
        sellerColumns={sellerColumns}
        loading={loading}
      />

      <Pagination
        limit={pagination.limit}
        offset={pagination.offset}
        total={pagination.total}
        onChange={(newOffset) => fetchReport({ offset: newOffset })}
      />
    </div>
  );
}
