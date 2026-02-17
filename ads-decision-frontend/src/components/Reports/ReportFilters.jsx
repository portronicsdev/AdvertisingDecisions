import React, { useState } from 'react';

export default function ReportFilters({ filters, onChange, onGenerate, loading }) {
  const [preset, setPreset] = useState('month');

  /* ---------- helper: fix timezone issue ---------- */
  const toDateInput = (d) => {
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  };

  /* ---------- apply preset ---------- */
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

    // 🛡️ safety guard (prevents crash)
    if (!start || !end) return;

    onChange((prev) => ({
      ...prev,
      start: toDateInput(start),
      end: toDateInput(end)
    }));
  };

  /* ---------- preset change ---------- */
  const handlePresetChange = (value) => {
    setPreset(value);

    const rangeMap = {
      month: 'current_month',
      lastMonth: 'last_month',
      quarter: 'current_quarter',
      custom: 'custom'
    };

    // update range
    onChange((prev) => ({
      ...prev,
      range: rangeMap[value]
    }));

    // only auto-set dates for presets
    if (value !== 'custom') {
      applyPreset(value);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      {/* ---------- preset dropdown ---------- */}
      <select
        value={preset}
        onChange={(e) => handlePresetChange(e.target.value)}
      >
        <option value="month">This Month</option>
        <option value="lastMonth">Last Month</option>
        <option value="quarter">This Quarter</option>
        <option value="custom">Custom</option>
      </select>

      {/* ---------- custom dates ---------- */}
      {preset === 'custom' && (
        <>
          <input
            type="date"
            value={filters.start || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, start: e.target.value }))
            }
          />
          <input
            type="date"
            value={filters.end || ''}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, end: e.target.value }))
            }
          />
        </>
      )}

      {/* ---------- search ---------- */}
      <input
        type="text"
        placeholder="Search SKU / Name / ASIN"
        value={filters.search || ''}
        onChange={(e) =>
          onChange((prev) => ({ ...prev, search: e.target.value }))
        }
      />

      {/* ---------- generate ---------- */}
      <button
        onClick={onGenerate}
        disabled={
          loading ||
          (preset === 'custom' && (!filters.start || !filters.end))
        }
      >
        {loading ? 'Generating…' : 'Generate'}
      </button>
    </div>
  );
}
