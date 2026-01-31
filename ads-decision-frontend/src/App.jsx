import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ImportModal from './components/ImportModal';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [decisions, setDecisions] = useState([]);
  const [filteredDecisions, setFilteredDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTableType, setImportTableType] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [filters, setFilters] = useState({
    platform: '',
    decision: '',
    seller: ''
  });

  useEffect(() => {
    //fetchDecisions();
    fetchSellers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [decisions, filters]);

  const fetchDecisions = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.seller) params.append('seller_id', filters.seller);
      if (filters.decision !== '') params.append('decision', filters.decision);
      
      const response = await axios.get(`${API_BASE_URL}/api/decisions?${params}`);
      setDecisions(response.data.decisions || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch decisions');
      console.error('Error fetching decisions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSellers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/sellers`);
      setSellers(response.data?.sellers || []);
    } catch (err) {
      console.error('Error fetching sellers:', err);
      setSellers([]);
    }
  };

  const applyFilters = () => {
    let filtered = [...decisions];
    
    if (filters.platform) {
      filtered = filtered.filter(d => d.platform_name === filters.platform);
    }
    
    if (filters.seller) {
      filtered = filtered.filter(d => String(d.seller_id) === String(filters.seller));
    }
    
    if (filters.decision !== '') {
      filtered = filtered.filter(d => d.decision === (filters.decision === 'true'));
    }
    
    setFilteredDecisions(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRunDecisionJob = async () => {
    try {
      setLoading(true);
      setError(null);
      const payload = {};
      if (filters.seller) payload.seller_id = filters.seller;
      const response = await axios.post(`${API_BASE_URL}/api/decisions/run`, payload);
      setSuccess(`Decision job completed: ${response.data.yes} YES, ${response.data.no} NO`);
      setTimeout(() => setSuccess(null), 5000);
      await fetchDecisions();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to run decision job');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenImport = (tableType) => {
    setImportTableType(tableType);
    setImportModalOpen(true);
  };

  const handleImportSuccess = () => {
    fetchDecisions();
    fetchSellers();
    setShowUpload(false);
  };

  const getUniquePlatforms = () => {
    const platforms = [...new Set(decisions.map(d => d.platform_name))];
    return platforms.filter(Boolean).sort();
  };

  const getUniqueSellers = () => {
    return sellers.filter(Boolean);
  };

  const stats = {
    total: filteredDecisions.length,
    yes: filteredDecisions.filter(d => d.decision).length,
    no: filteredDecisions.filter(d => !d.decision).length
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Ads Decision Maker</h1>
        <p>Internal decision system for ad campaign evaluation</p>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="filters">
        <button 
          className="btn btn-secondary" 
          onClick={() => setShowUpload(!showUpload)}
          style={{ marginRight: '16px' }}
        >
          {showUpload ? 'Hide Upload' : 'Upload Data'}
        </button>
        <div className="filter-group">
          <label>Platform</label>
          <select
            name="platform"
            value={filters.platform}
            onChange={handleFilterChange}
          >
            <option value="">All Platforms</option>
            {getUniquePlatforms().map(platform => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Seller</label>
          <select
            name="seller"
            value={filters.seller}
            onChange={handleFilterChange}
          >
            <option value="">All Sellers</option>
            {getUniqueSellers().map(seller => (
              <option key={seller.seller_id} value={seller.seller_id}>
                {seller.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Decision</label>
          <select
            name="decision"
            value={filters.decision}
            onChange={handleFilterChange}
          >
            <option value="">All Decisions</option>
            <option value="true">YES</option>
            <option value="false">NO</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={handleRunDecisionJob}>
            Run Decision Job
          </button>
        </div>
      </div>

      {showUpload && (
        <div className="upload-section">
          <h2>Upload Excel Files</h2>
          <p className="upload-description">
            Upload Excel files (.xlsx, .xls) to ingest data into the database.
            The system will automatically convert Excel to CSV and stream the data.
          </p>
          
          <div className="upload-grid">
            <div className="upload-item">
              <label className="upload-label">Products</label>
              <button
                onClick={() => handleOpenImport('products')}
                className="upload-btn"
              >
                📤 Import Products
              </button>
              <small>Product master data (SKU, name)</small>
            </div>

            <div className="upload-item">
              <label className="upload-label">Product-Platforms</label>
              <button
                onClick={() => handleOpenImport('product-platforms')}
                className="upload-btn"
              >
                📤 Import Product-Platforms
              </button>
              <small>Link products to platforms</small>
            </div>

            <div className="upload-item">
              <label className="upload-label">Sales Facts</label>
              <button
                onClick={() => handleOpenImport('sales')}
                className="upload-btn"
              >
                📤 Import Sales Data
              </button>
              <small>Sales data (units sold)</small>
            </div>

            <div className="upload-item">
              <label className="upload-label">Inventory (Seller)</label>
              <button
                onClick={() => handleOpenImport('inventory')}
                className="upload-btn"
              >
                📤 Import Inventory
              </button>
              <small>Seller inventory levels</small>
            </div>

            <div className="upload-item">
              <label className="upload-label">Company Inventory</label>
              <button
                onClick={() => handleOpenImport('company-inventory')}
                className="upload-btn"
              >
                📤 Import Company Inventory
              </button>
              <small>Company warehouse inventory</small>
            </div>

            <div className="upload-item">
              <label className="upload-label">Ad Performance</label>
              <button
                onClick={() => handleOpenImport('ad-performance')}
                className="upload-btn"
              >
                📤 Import Ad Performance
              </button>
              <small>Ad spend and revenue data</small>
            </div>

            <div className="upload-item">
              <label className="upload-label">Ratings</label>
              <button
                onClick={() => handleOpenImport('ratings')}
                className="upload-btn"
              >
                📤 Import Ratings
              </button>
              <small>Product ratings and review counts</small>
            </div>

            <div className="upload-item">
              <label className="upload-label">Sellers</label>
              <button
                onClick={() => handleOpenImport('sellers')}
                className="upload-btn"
              >
                📤 Import Sellers
              </button>
              <small>Seller master list by platform</small>
            </div>
          </div>
        </div>
      )}

      <div className="decisions-table">
        <div className="table-header">
          <h2>Decisions</h2>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Total</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat">
              <span className="stat-label">YES</span>
              <span className="stat-value yes">{stats.yes}</span>
            </div>
            <div className="stat">
              <span className="stat-label">NO</span>
              <span className="stat-value no">{stats.no}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading decisions...</div>
        ) : filteredDecisions.length === 0 ? (
          <div className="loading">No decisions found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Platform</th>
                <th>Seller</th>
                <th>Category</th>
                <th>Decision</th>
                <th>Reason</th>
                <th>Evaluated At</th>
              </tr>
            </thead>
            <tbody>
              {filteredDecisions.map(decision => (
                <tr key={decision.id}>
                  <td>{decision.product_name}</td>
                  <td>{decision.sku}</td>
                  <td>{decision.platform_name}</td>
                  <td>{decision.seller_name || '-'}</td>
                  <td>{decision.category || '-'}</td>
                  <td>
                    <span className={`decision-badge ${decision.decision ? 'yes' : 'no'}`}>
                      {decision.decision ? 'YES' : 'NO'}
                    </span>
                  </td>
                  <td>
                    <div className="reason">{decision.reason}</div>
                  </td>
                  <td>
                    {new Date(decision.evaluated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Import Modal */}
      <ImportModal
        open={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setImportTableType(null);
        }}
        tableType={importTableType}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}

export default App;

