import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import ImportModal from './components/ImportModal';
import DataPage from './components/DataPage';
import './index.css';

function App() {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTableType, setImportTableType] = useState(null);
  const [activeTab, setActiveTab] = useState('platforms');
  const [navPinned, setNavPinned] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tabCounts, setTabCounts] = useState({});

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const menuItems = useMemo(() => ([
    { key: 'platforms', label: 'Platforms', tableType: 'platforms' },
    { key: 'product-platforms', label: 'Products in Platforms', tableType: 'product-platforms' },
    { key: 'sellers', label: 'Sellers', tableType: 'sellers' },
    { key: 'sales', label: 'Sales', tableType: 'sales' },
    { key: 'inventory', label: 'Inventory', tableType: 'inventory' },
    { key: 'ad-performance', label: 'Performance', tableType: 'ad-performance' },
    { key: 'ratings', label: 'Ratings', tableType: 'ratings' }
  ]), []);

  useEffect(() => {
    const saved = localStorage.getItem('navPinned');
    if (saved !== null) {
      setNavPinned(saved === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('navPinned', String(navPinned));
  }, [navPinned]);

  useEffect(() => {
    let isActive = true;
    const fetchCounts = async () => {
      try {
        const responses = await Promise.all(
          menuItems.map(item =>
            axios.get(`${API_BASE_URL}/api/data/${item.tableType}?limit=1&offset=0`)
          )
        );
        if (!isActive) return;
        const nextCounts = {};
        responses.forEach((res, idx) => {
          nextCounts[menuItems[idx].key] = res.data?.count || 0;
        });
        setTabCounts(nextCounts);
      } catch (err) {
        if (!isActive) return;
        setTabCounts({});
      }
    };
    fetchCounts();
    return () => {
      isActive = false;
    };
  }, [menuItems, refreshKey]);

  const handleOpenImport = (tableType) => {
    setImportTableType(tableType);
    setImportModalOpen(true);
  };

  const handleImportSuccess = () => {
    setSuccess('Upload completed');
    setTimeout(() => setSuccess(null), 3000);
    setRefreshKey(prev => prev + 1);
  };

  const columnsByTab = {
    platforms: [
      { key: 'name', label: 'Platform' },
      { key: 'created_at', label: 'Created', render: (row) => new Date(row.created_at).toLocaleDateString() }
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
                    <span className="nav-count">
                      {tabCounts[item.key] ?? 0}
                    </span>
                  </span>
                )}
            </button>
          ))}
        </nav>
        <button
          className="pin-toggle"
          onClick={() => setNavPinned(prev => !prev)}
        >
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
                <span className="tab-count">
                  {tabCounts[item.key] ?? 0}
                </span>
              </button>
            ))}
          </div>
          <div className="topbar-status">
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
          </div>
        </div>

        <DataPage
          title={activeConfig.label}
          tableType={activeConfig.tableType}
          columns={activeColumns}
          showUpload={true}
          onOpenImport={handleOpenImport}
          refreshKey={refreshKey}
        />
      </main>

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

