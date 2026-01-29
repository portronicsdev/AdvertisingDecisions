# Hybrid Database Architecture (MongoDB + PostgreSQL)

## Overview

This application uses a **hybrid database architecture**:
- **MongoDB (CommonCore)**: Product master data
- **PostgreSQL**: Fact tables, relationships, and decisions

## Why This Works

### ✅ Advantages

1. **Single Source of Truth**: Products come from CommonCore (shared across applications)
2. **Optimized Storage**: 
   - MongoDB: Flexible schema for product attributes
   - PostgreSQL: Relational integrity for facts and decisions
3. **Performance**: PostgreSQL excels at time-series and analytical queries
4. **Consistency**: Products are validated before use

### ⚠️ Trade-offs

1. **No Cross-Database Transactions**: Can't atomically create product + relationship
   - **Mitigation**: Products must exist before creating relationships
   
2. **No Foreign Key Constraints**: PostgreSQL can't enforce MongoDB references
   - **Mitigation**: Application-level validation in mappers
   
3. **Orphaned References**: If product deleted from MongoDB, PostgreSQL references become invalid
   - **Mitigation**: Products are master data (rarely deleted)
   - **Tool**: Run `npm run validate-products` to find orphans
   
4. **Performance**: Extra MongoDB lookup when displaying decisions
   - **Mitigation**: Caching can be added if needed
   - **Impact**: Minimal (decisions are read-heavy, not write-heavy)

## Data Flow

```
1. Product exists in MongoDB (CommonCore)
   ↓
2. Upload creates product-platform relationship in PostgreSQL
   (validates product exists first)
   ↓
3. Facts reference product_platform_id (PostgreSQL)
   ↓
4. Decisions reference product_platform_id (PostgreSQL)
   ↓
5. Display: Fetch product details from MongoDB when needed
```

## Safeguards

### 1. Validation on Upload
- Products are validated before creating relationships
- Errors thrown if product doesn't exist in CommonCore

### 2. Validation on Fact Creation
- Products are validated before creating facts
- Invalid products are skipped (logged)

### 3. Graceful Degradation
- If product not found when displaying, shows null values
- Doesn't break the application

### 4. Monitoring Tool
```bash
npm run validate-products
```
Checks for orphaned references and reports issues.

## Best Practices

1. **Always validate products exist** before creating relationships
2. **Don't delete products** from CommonCore without cleaning up PostgreSQL first
3. **Run validation script** periodically to find orphaned references
4. **Monitor MongoDB connection** - if it fails, product lookups will fail

## When to Consider Alternatives

Consider moving products to PostgreSQL if:
- You need strict referential integrity (foreign keys)
- You need cross-database transactions
- MongoDB becomes a bottleneck
- You need complex joins between products and facts

For this use case (decision engine with master data in CommonCore), the hybrid approach is **optimal**.

## Performance Considerations

- **Reads**: 1 extra MongoDB query per decision display (acceptable)
- **Writes**: 1 MongoDB query per product validation (acceptable)
- **Caching**: Can add Redis/Memory cache for frequently accessed products if needed

## Conclusion

The hybrid architecture is **well-suited** for this application because:
- Products are master data (rarely change)
- Facts and decisions benefit from PostgreSQL's relational model
- CommonCore integration provides consistency across applications
- Application-level validation ensures data integrity

