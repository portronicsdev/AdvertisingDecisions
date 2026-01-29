import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import './ImportModal.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Template generators for each data type
const generateTemplate = (tableType) => {
  const templates = {
    'products': {
      headers: ['SKU', 'Product Name', 'Category', 'Launch Date', 'Active'],
      sample: [
        ['POR 1812', 'Product Name 1', 'Audio', '2024-01-01', 'true'],
        ['POR 1813', 'Product Name 2', 'Audio', '2024-01-15', 'true'],
      ],
      filename: 'Products_Template.xlsx',
      description: 'Product master data. SKU must be unique.'
    },
    'product-platforms': {
      headers: ['SKU', 'Platform', 'Platform SKU'],
      sample: [
        ['POR 1812', 'Amazon', 'B08XYZ123'],
        ['POR 1813', 'Flipkart', 'FLIP123456'],
      ],
      filename: 'Product_Platforms_Template.xlsx',
      description: 'Link products to platforms. SKU must exist in products table.'
    },
    'sales': {
      headers: ['SKU', 'Platform', 'Period Start (YYYY-MM-DD)', 'Period End (YYYY-MM-DD)', 'Units Sold'],
      sample: [
        ['POR 1812', 'Amazon', '2024-01-01', '2024-01-31', 100],
        ['POR 1813', 'Flipkart', '2024-01-01', '2024-01-31', 50],
      ],
      filename: 'Sales_Facts_Template.xlsx',
      description: 'Sales data for products on platforms. SKU must exist in products table.'
    },
    'inventory': {
      headers: ['SKU', 'Platform', 'Snapshot Date (YYYY-MM-DD)', 'Inventory Units'],
      sample: [
        ['POR 1812', 'Amazon', '2024-01-15', 200],
        ['POR 1813', 'Flipkart', '2024-01-15', 150],
      ],
      filename: 'Inventory_Facts_Template.xlsx',
      description: 'Seller inventory levels. SKU must exist in products table.'
    },
    'company-inventory': {
      headers: ['SKU', 'Snapshot Date (YYYY-MM-DD)', 'Inventory Units', 'Location (Optional)'],
      sample: [
        ['POR 1812', '2024-01-15', 500, 'Warehouse A'],
        ['POR 1813', '2024-01-15', 300, 'Warehouse B'],
      ],
      filename: 'Company_Inventory_Template.xlsx',
      description: 'Company warehouse inventory. SKU must exist in products table.'
    },
    'ad-performance': {
      headers: ['ASIN', 'Date', 'Period Start (YYYY-MM-DD)', 'Period End (YYYY-MM-DD)', 'Spend', 'Revenue', 'Ad Type'],
      sample: [
        ['B07N8RQ6W7', '2024-01-01', '', '', 5000, 40000, 'sp'],
        ['B0CVN4DNWY', '', '2024-01-01', '2024-01-31', 3000, 20000, 'sd'],
      ],
      filename: 'Ad_Performance_Template.xlsx',
      description: 'Ad spend and revenue data. Use ASIN (or Platform SKU). Date can be used for both Period Start/End.'
    },
    'ratings': {
      headers: ['SKU', 'Platform', 'Snapshot Date (YYYY-MM-DD)', 'Rating', 'Review Count'],
      sample: [
        ['POR 1812', 'Amazon', '2024-01-15', 4.5, 150],
        ['POR 1813', 'Flipkart', '2024-01-15', 4.2, 80],
      ],
      filename: 'Ratings_Facts_Template.xlsx',
      description: 'Product ratings and review counts. SKU must exist in products table.'
    },
  };

  return templates[tableType] || null;
};

const downloadTemplate = (tableType) => {
  const template = generateTemplate(tableType);
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

  const template = tableType ? generateTemplate(tableType) : null;

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

        // Find column indices based on table type
        const columnMap = {
          'products': {
            sku: ['SKU'],
            productName: ['Product Name'],
            category: ['Category'],
            launchDate: ['Launch Date'],
            active: ['Active']
          },
          'product-platforms': {
            sku: ['SKU'],
            platform: ['Platform'],
            platformSku: ['Platform SKU', 'ASIN']
          },
          'sales': {
            sku: ['SKU'],
            platform: ['Platform'],
            periodStart: ['Period Start (YYYY-MM-DD)'],
            periodEnd: ['Period End (YYYY-MM-DD)'],
            unitsSold: ['Units Sold']
          },
          'inventory': {
            sku: ['SKU'],
            platform: ['Platform'],
            snapshotDate: ['Snapshot Date (YYYY-MM-DD)'],
            inventoryUnits: ['Inventory Units']
          },
          'company-inventory': {
            sku: ['SKU'],
            snapshotDate: ['Snapshot Date (YYYY-MM-DD)'],
            inventoryUnits: ['Inventory Units'],
            location: ['Location (Optional)']
          },
          'ad-performance': {
            platformSku: ['Platform SKU', 'ASIN'],
            date: ['Date'],
            periodStart: ['Period Start (YYYY-MM-DD)'],
            periodEnd: ['Period End (YYYY-MM-DD)'],
            spend: ['Spend'],
            revenue: ['Revenue'],
            adType: ['Ad Type']
          },
          'ratings': {
            sku: ['SKU'],
            platform: ['Platform'],
            snapshotDate: ['Snapshot Date (YYYY-MM-DD)'],
            rating: ['Rating'],
            reviewCount: ['Review Count']
          }
        };

        const findColumnIndex = (columnNames) => {
          for (const name of columnNames) {
            const index = headers.findIndex(h => h === name);
            if (index >= 0) return index;
          }
          return -1;
        };

        const columns = {};
        Object.keys(columnMap[tableType] || {}).forEach(key => {
          columns[key] = findColumnIndex(columnMap[tableType][key]);
        });

        // Validate required columns
        const requiredColumns = {
          'products': ['sku'],
          'product-platforms': ['sku', 'platform'],
          'sales': ['sku', 'platform', 'periodStart', 'periodEnd', 'unitsSold'],
          'inventory': ['sku', 'platform', 'snapshotDate'],
          'company-inventory': ['sku', 'snapshotDate'],
          'ad-performance': ['platformSku', 'adType'],
          'ratings': ['sku', 'platform', 'snapshotDate']
        };

        const missingColumns = [];
        (requiredColumns[tableType] || []).forEach(col => {
          if (columns[col] === -1) {
            missingColumns.push(col);
          }
        });

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
          if (!row || row.every(cell => !cell)) continue; // Skip empty rows

          const item = {};
          let hasError = false;

          // Extract data based on column indices
          Object.keys(columns).forEach(key => {
            const index = columns[key];
            if (index >= 0 && index < row.length) {
              item[key] = String(row[index] || '').trim();
            }
          });

          // Validate required fields
          if (tableType !== 'ad-performance' && !item.sku) {
            itemErrors.push(`Row ${i + 1}: SKU is required`);
            hasError = true;
          }

          if (tableType === 'ad-performance' && !item.platformSku) {
            itemErrors.push(`Row ${i + 1}: Platform SKU/ASIN is required`);
            hasError = true;
          }

          if (tableType === 'ad-performance') {
            const hasDate = !!item.date;
            const hasPeriod = !!item.periodStart && !!item.periodEnd;
            if (!hasDate && !hasPeriod) {
              itemErrors.push(`Row ${i + 1}: Date or Period Start/End is required`);
              hasError = true;
            }
          }

          const platformRequiredTables = [
            'product-platforms',
            'sales',
            'inventory',
            'ratings'
          ];

          if (platformRequiredTables.includes(tableType) && !item.platform) {
            itemErrors.push(`Row ${i + 1}: Platform is required`);
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

    setImporting(true);
    setErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);

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
              disabled={!parsedData || importing}
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

