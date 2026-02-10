import React from 'react';

export default function Pagination({ limit, offset, total, onChange }) {
  if (total <= limit) return null;

  const start = offset + 1;
  const end = Math.min(offset + limit, total);

  return (
    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span>
        Showing {start}–{end} of {total}
      </span>

      <button
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        Prev
      </button>

      <button
        disabled={offset + limit >= total}
        onClick={() => onChange(offset + limit)}
      >
        Next
      </button>
    </div>
  );
}
