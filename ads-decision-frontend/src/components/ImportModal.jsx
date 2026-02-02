import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import './ImportModal.css';
import salesImport from './importers/salesImport';
import inventoryImport from './importers/inventoryImport';
import otherImports from './importers/otherImports';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const importerMap = {
  sales: salesImport,
  inventory: inventoryImport,
  ...otherImports
};

const getImporter = (tableType) => importerMap[tableType] || null;

const downloadTemplate = (tableType) => {
  const importer = getImporter(tableType);
  const template = importer?.template;
  if (!template) return;

  const templateData = [template.headers, ...template.sample];
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');

  // Auto-size columns
  const colWidths = template.headers.map(() => ({ wch: 20 }));
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, template.filename);
};

export default function ImportModal({ open, onClose, tableType, onSuccess }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [sellerId, setSellerId] = useState('');
  const [platform, setPlatform] = useState('');
  const [sellersLoading, setSellersLoading] = useState(false);
  const [sellerError, setSellerError] = useState('');

  const importer = tableType ? getImporter(tableType) : null;
  const template = importer?.template || null;
  const needsSeller = importer?.needsSeller || false;

  // Handle escape key to close modal
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !importing) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, importing]);

  useEffect(() => {
    if (!open) return;
    if (!needsSeller) {
      setSellers([]);
      setSellerId('');
      setSellerError('');
      return;
    }

    const fetchSellers = async () => {
      setSellersLoading(true);
      setSellerError('');
      try {
        const response = await axios.get(`${API_BASE_URL}/api/sellers`);
        const list = response.data?.sellers || [];
        console.log('Fetched sellers:', list);
        setSellers(list);
      } catch (err) {
        setSellerError(err.response?.data?.message || 'Failed to load sellers');
        setSellers([]);
      } finally {
        setSellersLoading(false);
      }
    };

    fetchSellers();
  }, [open, tableType]);

  if (!open || !tableType) return null;

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setErrors(['Please select an Excel file (.xlsx or .xls)']);
      return;
    }

    setFile(selectedFile);
    parseExcelFile(selectedFile);
  };

  const parseExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        console.log('sellerId during parse:', sellerId);

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (jsonData.length < 2) {
          setErrors(['Excel file must have at least 2 rows (header + data)']);
          setParsedData(null);
          return;
        }

        // Parse header row (first row) - strict matching
        const headers = jsonData[0].map(h => String(h || '').trim());

        const columnMap = importer?.columnMap || {};

        const findColumnIndex = (columnNames) => {
          for (const name of columnNames) {
            const index = headers.findIndex(h => h === name);
            if (index >= 0) return index;
          }
          return -1;
        };

        const columns = {};
        Object.keys(columnMap).forEach(key => {
          columns[key] = findColumnIndex(columnMap[key]);
        });

        // Validate required columns
        const requiredColumns = importer?.requiredColumns || [];

        const missingColumns = [];
        requiredColumns.forEach(col => {
          if (columns[col] === -1) {
            missingColumns.push(col);
          }
        });

        const extraMissing = importer?.validateColumns?.(columns) || [];
        missingColumns.push(...extraMissing);

        if (missingColumns.length > 0) {
          setErrors([`Missing required columns: ${missingColumns.join(', ')}`]);
          setParsedData(null);
          return;
        }

        // Parse data rows
        const items = [];
        const itemErrors = [];
        const itemWarnings = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.every(cell => !cell)) 
          {
            console.log(`Skipping empty row ${i + 1}`);
            continue; // Skip empty rows
          }

          const item = {};
          let hasError = false;

          // Extract data based on column indices
          Object.keys(columns).forEach(key => {
            const index = columns[key];
            if (index >= 0 && index < row.length) {
              item[key] = String(row[index] || '').trim();
            }
          });

          const rowErrors = importer?.validateRow?.(item, i + 1) || [];
          if (rowErrors.length > 0) {
            itemErrors.push(...rowErrors);
            hasError = true;
          }

          if (!hasError) {
            items.push({
              ...item,
              rowNumber: i + 1
            });
          }
        }

        if (items.length === 0) {
          setErrors(['No valid items found in Excel file']);
          setParsedData(null);
          return;
        }

        setParsedData({ items, headers });
        setErrors(itemErrors);
        setWarnings(itemWarnings);

      } catch (err) {
        console.error('Error parsing Excel:', err);
        setErrors([`Error parsing Excel file: ${err.message}`]);
        setParsedData(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!parsedData || !parsedData.items.length) {
      alert('No items to import');
      return;
    }

    if (needsSeller && !sellerId) {
      setErrors(['Please select a seller']);
      return;
    }

    console.log('Seller ID for import:', sellerId);

    setImporting(true);
    setErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (needsSeller) {
        formData.append('seller_id', sellerId);
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/upload/${tableType}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            // Could show progress here
          },
        }
      );

      // Check if response indicates success
      if (response.data && response.data.success !== false) {
        const rowCount = response.data.rowCount || 0;
        alert(`✅ Successfully imported ${rowCount} rows`);
        onSuccess?.();
        handleClose();
      } else {
        // Backend returned success: false or error
        const errorMessage = response.data?.message || response.data?.error || 'Import failed';
        setErrors([errorMessage]);
      }

    } catch (err) {
      console.error('Import error:', err);
      
      // Handle different error types
      let errorMessage = 'Could not import file';
      
      if (err.response) {
        // Backend responded with error status
        errorMessage = err.response.data?.message || 
                      err.response.data?.error || 
                      `Server error: ${err.response.status} ${err.response.statusText}`;
      } else if (err.request) {
        // Request was made but no response received
        errorMessage = 'No response from server. Please check if the backend is running.';
      } else {
        // Something else happened
        errorMessage = err.message || 'Could not import file';
      }
      
      setErrors([errorMessage]);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setErrors([]);
    setWarnings([]);
    setSellerId('');
    setSellerError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const getPreviewHeaders = () => {
    if (!parsedData || !parsedData.items.length) return [];
    // Get headers from first item keys
    return Object.keys(parsedData.items[0]).filter(key => key !== 'rowNumber');
  };

  const formatCellValue = (value, key) => {
    if (value === null || value === undefined || value === '') return '—';
    if (key.includes('date')) {
      return String(value);
    }
    if (key.includes('qty') || key.includes('units') || key.includes('count')) {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    if (key.includes('revenue') || key.includes('spend')) {
      const num = Number(value);
      return isNaN(num) ? value : num.toLocaleString();
    }
    if (key.includes('rating')) {
      const num = Number(value);
      return isNaN(num) ? value : num.toFixed(2);
    }
    return String(value);
  };

  return (
    <div className="import-modal-overlay">
      <div className="import-modal-container">
        <div className="import-modal-content">
          <div className="import-modal-header">
            <h2 className="import-modal-title">
              Import {tableType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h2>
            <button
              onClick={handleClose}
              className="import-modal-close"
              disabled={importing}
            >
              ×
            </button>
          </div>

          {needsSeller && (
            <div className="import-modal-section">
              <label className="import-modal-label">Select Seller</label>
              <select
                className="import-modal-file-input"
                value={sellerId}
                onChange={(e) => {setSellerId(e.target.value)}}
                disabled={importing || sellersLoading}
              >
                <option value="">Select a seller</option>
                {sellers.map(s => (
                  <option key={s.seller_id} value={s.seller_id}>
                    {s.name} {s.platform_name ? `(${s.platform_name})` : ''}
                  </option>
                ))}
              </select>
              {!sellersLoading && !sellerError && (
                <p className="import-modal-help-text">
                  Sales and inventory imports are stored under this seller.
                </p>
              )}
              {sellersLoading && (
                <p className="import-modal-help-text">Loading sellers…</p>
              )}
              {sellerError && (
                <p className="import-modal-help-text">{sellerError}</p>
              )}
            </div>
          )}

          {/* File Upload */}
          <div className="import-modal-section">
            <div className="import-modal-section-header">
              <label className="import-modal-label">Select Excel File</label>
              <button
                onClick={() => downloadTemplate(tableType)}
                className="import-modal-download-btn"
                type="button"
              >
                📥 Download Template
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="import-modal-file-input"
              disabled={importing}
            />
            {template && (
              <p className="import-modal-help-text">
                {template.description}
              </p>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="import-modal-error">
              <strong>Errors:</strong>
              <ul className="import-modal-error-list">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="import-modal-warning">
              <strong>Warnings:</strong>
              <ul className="import-modal-warning-list">
                {warnings.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview */}
          {parsedData && parsedData.items.length > 0 && (
            <div className="import-modal-section">
              <h3 className="import-modal-preview-title">
                Preview ({parsedData.items.length} rows)
              </h3>
              <div className="import-modal-preview-container">
                <table className="import-modal-preview-table">
                  <thead>
                    <tr>
                      {getPreviewHeaders().map((header, idx) => (
                        <th key={idx}>{header.replace(/([A-Z])/g, ' $1').trim()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.items.slice(0, 20).map((item, idx) => (
                      <tr key={idx}>
                        {getPreviewHeaders().map((key) => (
                          <td key={key}>{formatCellValue(item[key], key)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.items.length > 20 && (
                  <div className="import-modal-preview-more">
                    ... and {parsedData.items.length - 20} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="import-modal-actions">
            <button
              onClick={handleClose}
              className="import-modal-btn import-modal-btn-cancel"
              disabled={importing}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!parsedData || importing || (needsSeller && !sellerId)}
              className="import-modal-btn import-modal-btn-primary"
            >
              {importing ? 'Importing...' : `Import ${parsedData?.items.length || 0} Rows`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

