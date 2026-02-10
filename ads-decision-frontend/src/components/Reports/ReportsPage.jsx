import React, { useState } from 'react';
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
    start: '',
    end: '',
    search: ''
  });

  const [pagination, setPagination] = useState({
    limit: 25,
    offset: 0,
    total: 0
  });

  const fetchReport = async (override = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        start: filters.start,
        end: filters.end,
        search: filters.search,
        limit: pagination.limit,
        offset: override.offset ?? pagination.offset
      };

      const { data } = await axios.get(`${API_BASE_URL}/api/reports/product-summary`, { params });

      setRows(data.rows || []);
      setSellerColumns(data.sellerColumns || []);
      setPagination(p => ({
        ...p,
        total: data.count || 0,
        offset: params.offset
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Reports</h2>

      <ReportFilters
        filters={filters}
        onChange={setFilters}
        onGenerate={() => fetchReport({ offset: 0 })}
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
