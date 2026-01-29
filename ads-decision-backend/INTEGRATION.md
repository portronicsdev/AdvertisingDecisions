# CommonCore Integration

This application uses **CommonCore** for product master data (MongoDB) and **PostgreSQL** for fact tables and decisions.

## Architecture

- **MongoDB (CommonCore)**: Product master data
- **PostgreSQL**: Fact tables (sales, inventory, ad performance, ratings) and decisions

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables** in `.env`:
   ```env
   # PostgreSQL (for fact tables and decisions)
   DATABASE_URL=postgresql://user:password@host:port/database
   
   # MongoDB (CommonCore - for products)
   MONGO_URI_CORE=mongodb://user:password@host:port/database
   ```

3. **Initialize PostgreSQL schema:**
   ```bash
   npm run init-db
   ```

   Note: The schema no longer includes a `products` table. Products are fetched from MongoDB.

## Data Flow

1. **Products**: Stored in MongoDB (CommonCore)
   - Products are referenced by MongoDB ObjectId in PostgreSQL
   - Product data is fetched from MongoDB when needed

2. **Product-Platform Relationships**: Stored in PostgreSQL
   - Links MongoDB product IDs to platforms
   - Upload via: `POST /api/upload/product-platforms`

3. **Fact Tables**: Stored in PostgreSQL
   - Sales, inventory, ad performance, ratings
   - All reference `product_platform_id`

## Upload Types

- `product-platforms`: Creates product-platform relationships (products must exist in CommonCore)
- `sales`: Sales facts
- `inventory`: Seller inventory facts
- `company-inventory`: Company inventory facts
- `ad-performance`: Ad performance facts
- `ratings`: Ratings facts

## CSV Format Requirements

### Product-Platforms
- `sku` or `SKU` - Must exist in CommonCore
- `platform` or `Platform` - Platform name (Amazon, Flipkart, etc.)
- `platform_sku` or `Platform SKU` or `asin` or `ASIN` - Optional platform-specific SKU

### Other Tables
- `sku` or `SKU` - Must exist in CommonCore
- `platform` or `Platform` - Platform name
- Other columns as per original schema

## Important Notes

- Products must exist in CommonCore before uploading data
- Product IDs are stored as MongoDB ObjectId strings (24 characters) in PostgreSQL
- The decision engine works with MongoDB product IDs
- Product names/details are fetched from MongoDB when displaying decisions

