-- Ads Decision Maker Database Schema
-- Raw facts only, no calculated KPIs stored

-- Products table
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    sku VARCHAR(255) UNIQUE NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    category VARCHAR(255),
    launch_date DATE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platforms table
CREATE TABLE IF NOT EXISTS platforms (
    platform_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sellers table (per platform)
CREATE TABLE IF NOT EXISTS sellers (
    seller_id SERIAL PRIMARY KEY,
    platform_id INTEGER NOT NULL REFERENCES platforms(platform_id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_id, name)
);

-- Junction table for product-platform relationships
-- Links products to platforms, stores platform-specific SKU (ASIN, etc.)
CREATE TABLE IF NOT EXISTS product_platforms (
    product_platform_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    platform_id INTEGER NOT NULL REFERENCES platforms(platform_id) ON DELETE CASCADE,
    platform_sku VARCHAR(255), -- ASIN, Flipkart ID, Myntra ID, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, platform_id)
);

-- Platform-specific fact tables (raw data only)

CREATE TABLE IF NOT EXISTS sales_facts (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(seller_id) ON DELETE CASCADE,
    platform_id INTEGER NOT NULL REFERENCES platforms(platform_id) ON DELETE CASCADE,
    sku VARCHAR(255),
    platform_sku VARCHAR(255),
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    units_sold INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_facts (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL REFERENCES sellers(seller_id) ON DELETE CASCADE,
    platform_id INTEGER NOT NULL REFERENCES platforms(platform_id) ON DELETE CASCADE,
    sku VARCHAR(255),
    platform_sku VARCHAR(255),
    snapshot_date DATE NOT NULL,
    inventory_units INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_inventory_facts (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    inventory_units INTEGER DEFAULT 0,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_performance_facts (
    id SERIAL PRIMARY KEY,
    product_platform_id INTEGER NOT NULL REFERENCES product_platforms(product_platform_id) ON DELETE CASCADE,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    spend DECIMAL(12, 2) DEFAULT 0,
    revenue DECIMAL(12, 2) DEFAULT 0,
    ad_type VARCHAR(10) NOT NULL CHECK (ad_type IN ('sp', 'sd')), -- 'sp' = Sponsored Products, 'sd' = Sponsored Display
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ratings_facts (
    id SERIAL PRIMARY KEY,
    product_platform_id INTEGER NOT NULL REFERENCES product_platforms(product_platform_id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    rating DECIMAL(3, 2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Decisions table (OUTPUT)
CREATE TABLE IF NOT EXISTS decisions (
    id SERIAL PRIMARY KEY,
    product_platform_id INTEGER NOT NULL REFERENCES product_platforms(product_platform_id) ON DELETE CASCADE,
    seller_id INTEGER NOT NULL REFERENCES sellers(seller_id) ON DELETE CASCADE,
    decision BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_platform_id, seller_id)
);

-- Upload logs (tracks last uploaded ranges)
CREATE TABLE IF NOT EXISTS upload_logs (
    upload_id SERIAL PRIMARY KEY,
    table_type VARCHAR(100) NOT NULL,
    seller_id INTEGER REFERENCES sellers(seller_id) ON DELETE SET NULL,
    range_start DATE,
    range_end DATE,
    range_label VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_product_platforms_product ON product_platforms(product_id);
CREATE INDEX IF NOT EXISTS idx_product_platforms_platform ON product_platforms(platform_id);
CREATE INDEX IF NOT EXISTS idx_sales_facts_platform ON sales_facts(platform_id);
CREATE INDEX IF NOT EXISTS idx_sales_facts_sku ON sales_facts(sku);
CREATE INDEX IF NOT EXISTS idx_sales_facts_platform_sku ON sales_facts(platform_sku);
CREATE INDEX IF NOT EXISTS idx_sales_facts_seller ON sales_facts(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_facts_period ON sales_facts(period_start_date, period_end_date);
CREATE INDEX IF NOT EXISTS idx_inventory_facts_platform ON inventory_facts(platform_id);
CREATE INDEX IF NOT EXISTS idx_inventory_facts_sku ON inventory_facts(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_facts_platform_sku ON inventory_facts(platform_sku);
CREATE INDEX IF NOT EXISTS idx_inventory_facts_seller ON inventory_facts(seller_id);
CREATE INDEX IF NOT EXISTS idx_inventory_facts_date ON inventory_facts(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_company_inventory_product ON company_inventory_facts(product_id);
CREATE INDEX IF NOT EXISTS idx_company_inventory_date ON company_inventory_facts(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_ad_performance_product_platform ON ad_performance_facts(product_platform_id);
CREATE INDEX IF NOT EXISTS idx_ad_performance_period ON ad_performance_facts(period_start_date, period_end_date);
CREATE INDEX IF NOT EXISTS idx_ratings_product_platform ON ratings_facts(product_platform_id);
CREATE INDEX IF NOT EXISTS idx_ratings_date ON ratings_facts(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_decisions_product_platform ON decisions(product_platform_id);
CREATE INDEX IF NOT EXISTS idx_decisions_seller ON decisions(seller_id);
CREATE INDEX IF NOT EXISTS idx_decisions_evaluated_at ON decisions(evaluated_at);
CREATE INDEX IF NOT EXISTS idx_upload_logs_table_type ON upload_logs(table_type);
CREATE INDEX IF NOT EXISTS idx_upload_logs_seller ON upload_logs(seller_id);
CREATE INDEX IF NOT EXISTS idx_upload_logs_created_at ON upload_logs(created_at);

