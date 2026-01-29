# Quick Start Guide

## Prerequisites
- Node.js (v16+) installed
- PostgreSQL (v12+) installed and running

## Step 1: Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE ads_decision_maker;
```

2. Navigate to backend:
```bash
cd ads-decision-backend
```

3. Copy environment file:
```bash
# Windows PowerShell
Copy-Item env.example .env

# Or manually create .env with your database credentials
```

4. Update `.env` with your PostgreSQL credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ads_decision_maker
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3001
```

5. Initialize database schema:
```bash
npm install
node db/init.js
```

## Step 2: Start Backend

```bash
cd ads-decision-backend
npm install
npm run dev
```

Backend will run on `http://localhost:3001`

## Step 3: Start Frontend

Open a new terminal:

```bash
cd ads-decision-frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:3000`

## Step 4: Upload Data

Upload Excel files via API:

```bash
# Upload products
curl -X POST http://localhost:3001/api/upload/products -F "file=@products.xlsx"

# Upload sales data
curl -X POST http://localhost:3001/api/upload/sales -F "file=@sales.xlsx"

# Upload inventory
curl -X POST http://localhost:3001/api/upload/inventory -F "file=@inventory.xlsx"

# Upload company inventory
curl -X POST http://localhost:3001/api/upload/company-inventory -F "file=@company_inventory.xlsx"

# Upload ad performance
curl -X POST http://localhost:3001/api/upload/ad-performance -F "file=@ad_performance.xlsx"

# Upload ratings
curl -X POST http://localhost:3001/api/upload/ratings -F "file=@ratings.xlsx"
```

## Step 5: View Decisions

1. Open browser: `http://localhost:3000`
2. Decisions are automatically evaluated after data upload
3. Use filters to view specific platforms or decisions

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check `.env` file has correct credentials
- Ensure database `ads_decision_maker` exists

### Port Already in Use
- Change `PORT` in backend `.env` file
- Update `VITE_API_URL` in frontend `.env` file

### File Upload Fails
- Check file size (max 50MB)
- Verify file is Excel format (.xlsx or .xls)
- Check server logs for detailed error

