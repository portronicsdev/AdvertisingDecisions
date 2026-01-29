# Ads Decision Maker

An internal decision system that tells the company whether it should run ads for a specific product on a specific platform, based on inventory, quality, and ad performance.

## Overview

This application replaces Excel + WhatsApp + gut feel with a normalized decision engine that turns messy marketplace data into clear YES/NO ad decisions.

### Key Features

- ✅ Excel file upload and ingestion
- ✅ Normalized data storage (raw facts only)
- ✅ Decision engine with three gates:
  - **Inventory Gate**: Seller stock coverage ≥ 7 days OR company inventory > 0
  - **Ratings Gate**: Rating ≥ 4.0
  - **Performance Gate**: ROAS > 8
- ✅ Automated decision evaluation (hourly cron job)
- ✅ Simple table-first UI for viewing decisions

## Architecture

### Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: React + Vite
- **File Processing**: Multer + XLSX + CSV Parser
- **Job Scheduling**: node-cron

### Data Flow

```
Excel Upload
   ↓
Temporary File Storage
   ↓
Convert Excel → CSV
   ↓
Stream CSV → PostgreSQL (raw tables)
   ↓
Decision Engine (rules)
   ↓
Decisions Table
   ↓
Frontend (YES / NO + reason)
```

## Setup

### Prerequisites

- Node.js (v16+)
- PostgreSQL (v12+)

### Backend Setup

1. Navigate to backend directory:
```bash
cd ads-decision-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Update `.env` with your database credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ads_decision_maker
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3001
```

5. Initialize database:
```bash
node db/init.js
```

6. Start the server:
```bash
npm run dev
```

The backend will be running on `http://localhost:3001`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd ads-decision-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (optional, defaults to localhost:3001):
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

The frontend will be running on `http://localhost:3000`

## Usage

### Uploading Data

Upload Excel files via the API endpoint:

```bash
POST /api/upload/:tableType
Content-Type: multipart/form-data
```

**Table Types:**
- `products` - Product master data
- `sales` - Sales facts
- `inventory` - Seller inventory facts
- `company-inventory` - Company inventory facts
- `ad-performance` - Ad performance facts
- `ratings` - Ratings facts

**Example:**
```bash
curl -X POST http://localhost:3001/api/upload/products \
  -F "file=@products.xlsx"
```

### Viewing Decisions

1. Open the frontend at `http://localhost:3000`
2. Decisions are automatically evaluated after data ingestion
3. Filter by platform or decision (YES/NO)
4. Click "Run Decision Job" to manually trigger evaluation

### API Endpoints

#### Decisions
- `GET /api/decisions` - Get all decisions (supports `?platform=Amazon&decision=true` filters)
- `GET /api/decisions/:productPlatformId` - Get specific decision
- `POST /api/decisions/run` - Manually trigger decision job

#### Upload
- `POST /api/upload/:tableType` - Upload Excel file for specific table type

#### Health
- `GET /health` - Health check endpoint

## Database Schema

### Core Tables

- `products` - Product master data
- `platforms` - Platform master data
- `product_platforms` - Product-platform relationships

### Fact Tables (Raw Data Only)

- `sales_facts` - Sales data
- `inventory_facts` - Seller inventory
- `company_inventory_facts` - Company inventory
- `ad_performance_facts` - Ad performance metrics
- `ratings_facts` - Product ratings

### Output Table

- `decisions` - Decision results (YES/NO + reason)

## Decision Logic

The decision engine evaluates three gates:

1. **Inventory Gate**
   - Calculates seller stock coverage (inventory / avg daily sales)
   - If coverage < 7 days, checks company inventory
   - FAILS if seller stock < 7 days AND company inventory = 0

2. **Ratings Gate**
   - Gets latest rating for product-platform
   - FAILS if rating < 4.0

3. **Performance Gate**
   - Calculates ROAS (Revenue / Spend) from last 30 days
   - FAILS if ROAS ≤ 8

**All gates must pass for a YES decision.**

## CSV File Format

Excel files should have columns matching the database schema. The system supports flexible column naming:

### Products
- `sku` or `SKU`
- `product_name` or `Product Name`
- `category` or `Category`
- `launch_date` or `Launch Date`
- `active` (true/false)

### Sales Facts
- `sku` or `SKU`
- `platform` or `Platform`
- `period_start_date` or `Period Start`
- `period_end_date` or `Period End`
- `units_sold` or `Units Sold`
- `revenue` or `Revenue`

### Inventory Facts
- `sku` or `SKU`
- `platform` or `Platform`
- `snapshot_date` or `Snapshot Date` or `Date`
- `inventory_units` or `Inventory Units`

### Ad Performance Facts
- `sku` or `SKU`
- `platform` or `Platform`
- `period_start_date` or `Period Start`
- `period_end_date` or `Period End`
- `spend` or `Spend`
- `revenue` or `Revenue`

### Ratings Facts
- `sku` or `SKU`
- `platform` or `Platform`
- `snapshot_date` or `Snapshot Date` or `Date`
- `rating` or `Rating`
- `review_count` or `Review Count`

## Deployment

### Render.com (Recommended for MVP)

1. **Backend**:
   - Connect GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Add environment variables from `.env.example`
   - Use managed PostgreSQL addon

2. **Frontend**:
   - Connect GitHub repository
   - Set build command: `npm install && npm run build`
   - Set publish directory: `dist`
   - Add environment variable: `VITE_API_URL` (your backend URL)

3. **Database**:
   - Use Render managed PostgreSQL
   - Run `db/init.js` script after database creation

## Future Enhancements

Once MVP works, you can add:
- Budget sizing
- TACoS calculations
- Ad type comparison
- Inventory forecasting
- Alerts
- Role-based dashboards

## License

ISC

