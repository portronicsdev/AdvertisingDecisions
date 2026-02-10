import React, { useState } from 'react';

export default function ReportFilters({ filters, onChange, onGenerate, loading }) {
  const [preset, setPreset] = useState('month');

  const applyPreset = (value) => {
    const today = new Date();
    let start, end;

    if (value === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
    } else if (value === 'lastMonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (value === 'quarter') {
      const q = Math.floor(today.getMonth() / 3) * 3;
      start = new Date(today.getFullYear(), q, 1);
      end = today;
    }

    onChange({
      ...filters,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    });
  };

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <select
        value={preset}
        onChange={(e) => {
          setPreset(e.target.value);
          applyPreset(e.target.value);
        }}
      >
        <option value="month">This Month</option>
        <option value="lastMonth">Last Month</option>
        <option value="quarter">This Quarter</option>
        <option value="custom">Custom</option>
      </select>

      {preset === 'custom' && (
        <>
          <input
            type="date"
            value={filters.start}
            onChange={(e) => onChange({ ...filters, start: e.target.value })}
          />
          <input
            type="date"
            value={filters.end}
            onChange={(e) => onChange({ ...filters, end: e.target.value })}
          />
        </>
      )}

      <input
        type="text"
        placeholder="Search SKU / Name / ASIN"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
      />

      <button onClick={onGenerate} disabled={loading}>
        {loading ? 'Generating…' : 'Generate'}
      </button>
    </div>
  );
}
