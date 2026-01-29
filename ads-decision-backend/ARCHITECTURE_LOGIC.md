# Product-Platform Architecture Logic

## Overview

The system supports the concept that **the same product can have different IDs on different platforms**.

## Three-Tier Structure

### 1. Products (MongoDB - CommonCore)
- Each product has a **unique SKU** (e.g., "POR 1812")
- Stored in MongoDB with MongoDB ObjectId
- **One product** = **One SKU** = **One MongoDB ObjectId**

### 2. Platforms (PostgreSQL)
- Each platform has a **unique name** (e.g., "Amazon", "Flipkart", "Myntra")
- Stored in PostgreSQL with `platform_id`
- **One platform** = **One platform_id**

### 3. Product-Platforms (PostgreSQL - Junction Table)
- Links a product to a platform
- Stores **platform-specific SKU/ID** in `platform_sku` field
- **Same product** can be linked to **multiple platforms**
- **Each platform** can have a **different platform_sku** for the same product

## Example

```
Product: "POR 1812" (MongoDB ObjectId: 507f1f77bcf86cd799439011)
├── On Amazon:     platform_sku = "B08XYZ123" (ASIN)
├── On Flipkart:   platform_sku = "FLIP123456" (Flipkart ID)
└── On Myntra:     platform_sku = "MYN789012" (Myntra ID)
```

## Database Schema

```sql
-- Products (in MongoDB - CommonCore)
Product {
  _id: ObjectId("507f1f77bcf86cd799439011"),
  sku: "POR 1812",
  productName: "Product Name",
  ...
}

-- Platforms (in PostgreSQL)
platforms {
  platform_id: 1,
  name: "Amazon"
}

-- Product-Platforms (in PostgreSQL)
product_platforms {
  product_platform_id: 1,
  product_id: "507f1f77bcf86cd799439011",  -- MongoDB ObjectId
  platform_id: 1,                          -- PostgreSQL platform_id
  platform_sku: "B08XYZ123"                 -- Amazon ASIN
}
```

## How It Works

1. **Product exists once** in MongoDB (CommonCore)
2. **Platform exists once** in PostgreSQL
3. **Product-Platform relationship** created for each platform the product is sold on
4. **Each relationship** can have a different `platform_sku`:
   - Amazon: ASIN
   - Flipkart: Flipkart Product ID
   - Myntra: Myntra Product ID

## Code Implementation

### Creating Product-Platform Relationship

```javascript
// In mappers.js - mapProductPlatformRow()
{
  product_id: "507f1f77bcf86cd799439011",  // MongoDB ObjectId
  platform_id: 1,                           // PostgreSQL platform_id
  platform_sku: "B08XYZ123"                  // Platform-specific ID (ASIN, etc.)
}
```

### Querying Facts

All fact tables reference `product_platform_id`, which uniquely identifies:
- Which product (via product_id → MongoDB)
- Which platform (via platform_id → PostgreSQL)
- The platform-specific SKU (via platform_sku)

## Benefits

✅ **Single source of truth** for products (CommonCore)
✅ **Platform-specific IDs** stored separately
✅ **Same product** can have **different IDs** on different platforms
✅ **Normalized structure** - no data duplication
✅ **Easy to query** - join product_platforms to get both product and platform info

## Validation

The code ensures:
- Product must exist in MongoDB before creating relationship
- Platform must exist in PostgreSQL before creating relationship
- UNIQUE constraint on (product_id, platform_id) prevents duplicates
- Each platform can have different platform_sku for same product

