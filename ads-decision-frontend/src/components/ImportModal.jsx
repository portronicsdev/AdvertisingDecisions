import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { api } from '../services/api';
import { getImporter } from '../importers';
import './ImportModal.css';

export default function ImportModal({ open, onClose, tableType, onSuccess }) {
  const fileInputRef = useRef(null);

  const importer = getImporter(tableType) || {};

  /* ---------------- states ---------------- */

  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [importing, setImporting] = useState(false);

  const [sellerId, setSellerId] = useState('');
  const [platform, setPlatform] = useState('');
  const [adType, setAdType] = useState('');
  const [snapshotDate, setSnapshotDate] = useState('');

  // platform dropdown
  const [platforms, setPlatforms] = useState([]);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformError, setPlatformError] = useState('');

  // seller dropdown
  const [sellers, setSellers] = useState([]);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [sellerError, setSellerError] = useState('');

  const [errorRows, setErrorRows] = useState([]);

  /* ---------------- importer config ---------------- */

  const {
    title = '',
    needsSeller = false,
    needsPlatform = false,
    needsSnapshotDate = false,
    needsAdType = false,
    template = null,
    columnMap = {},
    requiredColumns = [],
    validateRow = null,
    validateColumns = null,
    uploadUrl = ''
  } = importer;

  /* ---------------- effects ---------------- */

  // Reset when modal opens
  useEffect(() => {
    if (!open) return;

    setFile(null);
    setParsedData(null);
    setErrors([]);
    setWarnings([]);

    setSellerId('');
    setPlatform('');
    setAdType('');
    setSnapshotDate('');

  }, [open]);

  // Reset seller when platform changes
  useEffect(() => {
    setSellerId('');
  }, [platform]);

  // Escape close
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape' && !importing) handleClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, importing]);

  // Fetch platforms
  useEffect(() => {
    if (!open || !needsPlatform) return;

    const fetchPlatforms = async () => {
      try {
        setPlatformLoading(true);
        setPlatformError('');

        const res = await api.get('/api/data/platforms', {
          params: { limit: 200, offset: 0 }
        });

        setPlatforms(res.data?.rows || []);
      } catch (err) {
        setPlatformError(
          err.response?.data?.message || 'Failed to load platforms'
        );
        setPlatforms([]);
      } finally {
        setPlatformLoading(false);
      }
    };

    fetchPlatforms();
  }, [open, needsPlatform]);

  // Fetch sellers
  useEffect(() => {
    if (!open || !needsSeller) return;

    const fetchSellers = async () => {
      try {
        setSellerLoading(true);
        setSellerError('');

        const res = await api.get('/api/sellers');

        setSellers(res.data?.sellers || []);
      } catch (err) {
        setSellerError(
          err.response?.data?.message || 'Failed to load sellers'
        );
        setSellers([]);
      } finally {
        setSellerLoading(false);
      }
    };

    fetchSellers();
  }, [open, needsSeller]);

  /* ---------------- guards ---------------- */

  if (!open || !tableType) return null;

  /* ---------------- derived ---------------- */

  const filteredSellers = sellers.filter(
    s => !platform || s.platform_name === platform
  );

  /* ---------------- helpers ---------------- */

  const downloadTemplate = () => {
    if (!template) return;

    const data = [template.headers, ...template.sample];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');

    XLSX.writeFile(wb, template.filename);
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setErrors([]);
    setWarnings([]);

    if (!selected.name.endsWith('.xlsx') && !selected.name.endsWith('.xls')) {
      setErrors(['Please select Excel file']);
      return;
    }

    setFile(selected);
    parseExcel(selected);
  };

  /* ---------------- excel parsing ---------------- */

  const parseExcel = (file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (json.length < 2) {
          setErrors(['Excel must have header + data']);
          return;
        }

        const headers = json[0].map(h => String(h).trim());

        const findIndex = (names) => {
          for (const n of names) {
            const idx = headers.findIndex(h => h === n);
            if (idx >= 0) return idx;
          }
          return -1;
        };

        const columns = {};
        Object.keys(columnMap).forEach(k => {
          columns[k] = findIndex(columnMap[k]);
        });

        console.log('requiredColumns:', requiredColumns);
        const missingCols = requiredColumns.filter(c => columns[c] === -1);

        if (validateColumns) {
          missingCols.push(...validateColumns(columns));
        }

                console.log('requiredColumns:', requiredColumns);
                console.log('columns:', columns);
                console.log('missingCols:', missingCols);
        

        if (missingCols.length) {
          setErrors([`Missing columns: ${missingCols.join(', ')}`]);
          return;
        }

        const items = [];
        const errs = [];
        const errorRowsLocal = [];

        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.every(v => !v)) continue;

          const item = {};

          Object.keys(columns).forEach(k => {
            const idx = columns[k];
            if (idx >= 0) item[k] = String(row[idx] || '').trim();
          });

          const rowErrors = validateRow?.(item, i + 1) || [];

          if (rowErrors.length) {
            errs.push(...rowErrors);

            errorRowsLocal.push({
              ...item,
              error: rowErrors.join(', ')
            });
          } else {
            items.push(item);
          }
        }

        if (!items.length) {
          setErrors(['No valid rows found']);
          return;
        }

        setParsedData({ items });
        setErrors(errs);
        setErrorRows(errorRowsLocal);
        setWarnings([]);
      } catch (err) {
        setErrors([err.message]);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadErrorFile = () => {
    if (!errorRows.length) return;

    const headers = Object.keys(errorRows[0]);

    const data = [
      headers,
      ...errorRows.map(row => headers.map(h => row[h] || ''))
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Errors');

    XLSX.writeFile(wb, `${tableType}_errors.xlsx`);
  };

  /* ---------------- import ---------------- */

  const handleImport = async () => {
    if (importing) return;

    if (!file) return;

    if (needsSeller && !sellerId) {
      setErrors(['Select seller']);
      return;
    }

    if (needsPlatform && !platform) {
      setErrors(['Select platform']);
      return;
    }

    if (needsSnapshotDate && !snapshotDate) {
      setErrors(['Select snapshot date']);
      return;
    }

    if (needsAdType && !adType) {
      setErrors(['Select ad type']);
      return;
    }

    if (!uploadUrl) {
      setErrors(['Upload not configured']);
      return;
    }

    try {
      setImporting(true);
      setErrors([]);
      setWarnings([]);

      const formData = new FormData();
      formData.append('file', file);

      if (needsSeller) formData.append('seller_id', sellerId);
      if (needsPlatform) formData.append('platform', platform);
      if (needsSnapshotDate) formData.append('snapshot_date', snapshotDate);
      if (needsAdType) formData.append('ad_type', adType);

      const res = await api.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {

        if (res.data.missingSkus?.length) {
          setWarnings([
            `Missing SKUs (${res.data.missingSkus.length})`,
            ...res.data.missingSkus.slice(0, 20)
          ]);
        }

        onSuccess?.(`Imported ${res.data.rowCount || 0} rows`);
        handleClose();

      } else {
        setErrors([res.data.error || 'Import failed']);
      }

    } catch (err) {
      setErrors([err.response?.data?.error || err.message]);
    } finally {
      setImporting(false);
    }
  };

  /* ---------------- close ---------------- */

  const handleClose = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
    setErrorRows([]);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="import-modal-overlay">
      <div className="import-modal-container">
        <div className="import-modal-content">

          <div className="import-modal-header">
            <h2 className="import-modal-title">Import {title}</h2>
            <button className="import-modal-close" onClick={handleClose}>×</button>
          </div>

          {/* Platform */}
          {needsPlatform && (
            <div className="import-modal-section">
              <label className="import-modal-label">Platform</label>

              <select
                className="import-modal-file-input"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={platformLoading}
              >
                <option value="">Select platform</option>
                {platforms.map(p => (
                  <option key={p.platform_id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>

              {platformLoading && <p className="import-modal-help-text">Loading...</p>}
              {platformError && <p className="import-modal-help-text">{platformError}</p>}
            </div>
          )}

          {/* Snapshot Date */}
          {needsSnapshotDate && (
            <div className="import-modal-section">
              <label className="import-modal-label">Snapshot Date</label>

              <input
                type="date"
                className="import-modal-file-input"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
              />

              {!snapshotDate && (
                <p className="import-modal-help-text">
                  Select snapshot date for this data
                </p>
              )}
            </div>
          )}

          {/* Seller */}
          {needsSeller && (
            <div className="import-modal-section">
              <label className="import-modal-label">Seller</label>

              <select
                className="import-modal-file-input"
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                disabled={sellerLoading || (needsPlatform && !platform)}
              >
                <option value="">Select seller</option>

                {filteredSellers.map(s => (
                  <option key={s.seller_id} value={s.seller_id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {sellerLoading && <p className="import-modal-help-text">Loading...</p>}
              {sellerError && <p className="import-modal-help-text">{sellerError}</p>}
            </div>
          )}

          {/* File */}
          <div className="import-modal-section">
            <div className="import-modal-section-header">
              <label className="import-modal-label">Excel File</label>
              <button className="import-modal-download-btn" onClick={downloadTemplate}>
                📥 Template
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="import-modal-file-input"
            />

            {file && (
              <p className="import-modal-help-text">
                Selected: {file.name}
              </p>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="import-modal-error">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>Errors:</strong>

                {errorRows.length > 0 && (
                  <button
                    className="import-modal-download-btn"
                    onClick={downloadErrorFile}
                  >
                    ⬇ Download Errors
                  </button>
                )}
              </div>

              <ul className="import-modal-error-list">
                {errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>

              {errors.length > 10 && (
                <div className="import-modal-help-text">
                  Showing first 10 of {errors.length} errors
                </div>
              )}
            </div>
          )}

          {/*Parse Data*/}
          {parsedData && (
            <div className="import-modal-section">
              <h3 className="import-modal-preview-title">
                Preview (First 10 Rows)
              </h3>

              <div className="import-modal-preview-container">
                <table className="import-modal-preview-table">
                  <thead>
                    <tr>
                      {Object.keys(parsedData.items[0]).map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {parsedData.items.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {Object.keys(parsedData.items[0]).map(col => (
                          <td key={col}>{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {parsedData.items.length > 10 && (
                  <div className="import-modal-preview-more">
                    Showing first 10 of {parsedData.items.length} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="import-modal-warning">
              <strong>Warnings:</strong>
              <ul>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="import-modal-actions">
            <button className="import-modal-btn import-modal-btn-cancel" onClick={handleClose}>
              Cancel
            </button>

            <button
              className="import-modal-btn import-modal-btn-primary"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}