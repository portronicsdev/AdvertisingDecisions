import React, { useEffect, useMemo, useState } from 'react';
import { api } from './services/api';

import ImportModal from './components/ImportModal';
import DataPage from './components/DataPage';
import ReportsPage from './components/Reports/ReportsPage';

import './index.css';

function App() {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTableType, setImportTableType] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'platforms';
  });
  const [navPinned, setNavPinned] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tabCounts, setTabCounts] = useState({});
  const [decisionRunning, setDecisionRunning] = useState(false);
  const [decisionSeller, setDecisionSeller] = useState('');
  const [decisionSellers, setDecisionSellers] = useState([]);
  const [syncingProducts, setSyncingProducts] = useState(false);

  /* ---------------- helpers ---------------- */

  const showSuccess = (msg, time = 5000) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), time);
  };

  const showError = (msg, time = 5000) => {
    setError(msg);
    setTimeout(() => setError(null), time);
  };

  /* ---------------- menu ---------------- */

  const menuItems = useMemo(() => ([
    { key: 'decisions', label: 'Decisions', tableType: 'decisions' },
    { key: 'platforms', label: 'Platforms', tableType: 'platforms' },
    { key: 'products', label: 'Products', tableType: 'products' },
    { key: 'product-platforms', label: 'Products in Platforms', tableType: 'product-platforms' },
    { key: 'sellers', label: 'Sellers', tableType: 'sellers' },
    { key: 'sales', label: 'Sales', tableType: 'sales' },
    { key: 'inventory', label: 'Inventory', tableType: 'inventory' },
    { key: 'ad-performance', label: 'Performance', tableType: 'ad-performance' },
    { key: 'ratings', label: 'Ratings', tableType: 'ratings' },
    { key: 'reports', label: 'Reports' },
  ]), []);

  /* ---------------- local storage ---------------- */

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const saved = localStorage.getItem('navPinned');
    if (saved !== null) {
      setNavPinned(saved === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('navPinned', String(navPinned));
  }, [navPinned]);

  /* ---------------- fetch sellers ---------------- */

  useEffect(() => {
    let isActive = true;

    const fetchSellers = async () => {
      try {
        const res = await api.get('/api/sellers');
        if (!isActive) return;
        setDecisionSellers(res.data?.sellers || []);
      } catch (err) {
        if (!isActive) return;
        setDecisionSellers([]);
      }
    };

    fetchSellers();

    return () => {
      isActive = false;
    };
  }, []);

  /* ---------------- fetch counts ---------------- */

  useEffect(() => {
    let isActive = true;

    const fetchCounts = async () => {
      try {
        const validItems = menuItems.filter(item => item.tableType);

        const responses = await Promise.all(
          validItems.map(item =>
            api.get(`/api/data/${item.tableType}`, {
              limit: 1,
              offset: 0
            })
          )
        );

        if (!isActive) return;

        const nextCounts = {};
        menuItems.forEach(item => {
          nextCounts[item.key] = 0;
        });

        validItems.forEach((item, idx) => {
          nextCounts[item.key] = responses[idx].data?.count || 0;
        });

        setTabCounts(nextCounts);

      } catch (err) {
        if (!isActive) return;
        console.error('Failed to fetch tab counts', err);
        setTabCounts({});
      }
    };

    fetchCounts();

    return () => {
      isActive = false;
    };
  }, [menuItems, refreshKey]);

  /* ---------------- handlers ---------------- */

  const handleOpenImport = (tableType) => {
    setImportTableType(tableType);
    setImportModalOpen(true);
  };

  const handleImportSuccess = () => {
    showSuccess('Upload completed', 3000);
    setRefreshKey(prev => prev + 1);
  };

  const handleRunDecisionJob = async () => {
    try {
      setDecisionRunning(true);
      setError(null);

      const payload = {};
      if (decisionSeller) payload.seller_id = decisionSeller;

      const res = await api.post('/api/decisions/run', payload);

      showSuccess(
        `Decision job completed: ${res.data.yes} YES, ${res.data.no} NO`
      );

      setRefreshKey(prev => prev + 1);

    } catch (err) {
      showError(
        err.response?.data?.message ||
        err.message ||
        'Failed to run decision job'
      );
    } finally {
      setDecisionRunning(false);
    }
  };

  const handleSyncProducts = async () => {
    try {
      setSyncingProducts(true);
      setError(null);

      const res = await api.post('/api/sync/products');

      showSuccess(
        `Products synced: ${res.data.inserted || 0} added, ${res.data.updated || 0} updated`
      );

      setRefreshKey(prev => prev + 1);

    } catch (err) {
      showError(
        err.response?.data?.message ||
        err.message ||
        'Failed to sync products'
      );
    } finally {
      setSyncingProducts(false);
    }
  };

  /* ---------------- columns ---------------- */

  const columnsByTab = {
    decisions: [
      { key: 'product_name', label: 'Product' },
      { key: 'sku', label: 'SKU' },
      { key: 'platform_name', label: 'Platform' },
      { key: 'seller_name', label: 'Seller' },
      { key: 'decision', label: 'Decision', render: (row) => (row.decision ? 'YES' : 'NO') },
      { key: 'reason', label: 'Reason' },
      { key: 'evaluated_at', label: 'Evaluated', render: (row) => new Date(row.evaluated_at).toLocaleString() }
    ],
    platforms: [
      { key: 'name', label: 'Platform' },
      { key: 'created_at', label: 'Created', render: (row) => new Date(row.created_at).toLocaleDateString() }
    ],
    products: [
      { key: 'sku', label: 'SKU' },
      { key: 'product_name', label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'launch_date', label: 'Launch' },
      { key: 'active', label: 'Active', render: (row) => (row.active ? 'Yes' : 'No') }
    ],
    'product-platforms': [
      { key: 'sku', label: 'SKU' },
      { key: 'product_name', label: 'Product' },
      { key: 'platform_name', label: 'Platform' },
      { key: 'platform_sku', label: 'Platform SKU' }
    ],
    sellers: [
      { key: 'name', label: 'Seller' },
      { key: 'platform_name', label: 'Platform' },
      { key: 'active', label: 'Active', render: (row) => (row.active ? 'Yes' : 'No') }
    ],
    sales: [
      { key: 'platform_name', label: 'Platform' },
      { key: 'seller_name', label: 'Seller' },
      { key: 'sku', label: 'SKU' },
      { key: 'platform_sku', label: 'Platform SKU' },
      { key: 'period_start_date', label: 'Start' },
      { key: 'period_end_date', label: 'End' },
      { key: 'units_sold', label: 'Units' }
    ],
    inventory: [
      { key: 'platform_name', label: 'Platform' },
      { key: 'seller_name', label: 'Seller' },
      { key: 'sku', label: 'SKU' },
      { key: 'platform_sku', label: 'Platform SKU' },
      { key: 'snapshot_date', label: 'Snapshot' },
      { key: 'inventory_units', label: 'Units' }
    ],
    'ad-performance': [
      { key: 'platform_name', label: 'Platform' },
      { key: 'sku', label: 'SKU' },
      { key: 'platform_sku', label: 'Platform SKU' },
      { key: 'period_start_date', label: 'Start' },
      { key: 'period_end_date', label: 'End' },
      { key: 'spend', label: 'Spend' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'ad_type', label: 'Ad Type' }
    ],
    ratings: [
      { key: 'platform_name', label: 'Platform' },
      { key: 'sku', label: 'SKU' },
      { key: 'platform_sku', label: 'Platform SKU' },
      { key: 'snapshot_date', label: 'Snapshot' },
      { key: 'rating', label: 'Rating' },
      { key: 'review_count', label: 'Reviews' }
    ]
  };

  const activeConfig = menuItems.find(item => item.key === activeTab) || menuItems[0];
  const activeColumns = columnsByTab[activeConfig.key] || [];

  const isDecisions = activeConfig.key === 'decisions';
  const isProducts = activeConfig.key === 'products';

  /* ---------------- UI ---------------- */

  return (
    <div className="app-shell">
      <aside className={`sidebar ${navPinned ? 'pinned' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="logo">Ads</div>
          {navPinned && <span className="logo-text">Decision</span>}
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
              title={item.label}
            >
              <span className="nav-dot" />
              {navPinned && (
                <span>
                  {item.label}
                  <span className="nav-count">{tabCounts[item.key] ?? 0}</span>
                </span>
              )}
            </button>
          ))}
        </nav>

        <button className="pin-toggle" onClick={() => setNavPinned(prev => !prev)}>
          {navPinned ? '⟨⟨' : '⟩⟩'}
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="tabs">
            {menuItems.map(item => (
              <button
                key={item.key}
                className={`tab ${activeTab === item.key ? 'active' : ''}`}
                onClick={() => setActiveTab(item.key)}
              >
                {item.label}
                <span className="tab-count">{tabCounts[item.key] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="topbar-status">
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
          </div>
        </div>

        {activeTab === 'reports' ? (
          <ReportsPage />
        ) : (
          <DataPage
            title={activeConfig.label}
            tableType={activeConfig.tableType}
            columns={activeColumns}
            showUpload={!isDecisions && !isProducts}
            onOpenImport={handleOpenImport}
            refreshKey={refreshKey}
            headerActions={
              isDecisions ? (
                <div className="decision-actions">
                  <select
                    value={decisionSeller}
                    onChange={(e) => setDecisionSeller(e.target.value)}
                    className="decision-select"
                  >
                    <option value="">All Sellers</option>
                    {decisionSellers.map(seller => (
                      <option key={seller.seller_id} value={seller.seller_id}>
                        {seller.name}
                      </option>
                    ))}
                  </select>

                  <button
                    className="btn btn-primary"
                    onClick={handleRunDecisionJob}
                    disabled={decisionRunning}
                  >
                    {decisionRunning ? 'Running...' : 'Run Decision Job'}
                  </button>
                </div>
              ) : isProducts ? (
                <div className="product-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleSyncProducts}
                    disabled={syncingProducts}
                  >
                    {syncingProducts ? 'Syncing...' : 'Get New Products'}
                  </button>
                </div>
              ) : null
            }
          />
        )}
      </main>

      {activeTab !== 'reports' && importModalOpen && (
        <ImportModal
          open={importModalOpen}
          tableType={importTableType}
          onClose={() => {
            setImportModalOpen(false);
            setImportTableType(null);
          }}
        />
      )}
    </div>
  );
}

export default App;