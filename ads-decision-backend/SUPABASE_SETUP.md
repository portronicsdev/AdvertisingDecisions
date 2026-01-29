# Supabase Connection Setup Guide

## Getting Your Connection String

1. **Go to your Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project

2. **Navigate to Database Settings**
   - Go to **Settings** → **Database**
   - Scroll to **Connection string** section

3. **Copy the Connection String**
   - Select **URI** format
   - Copy the connection string (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`)

4. **Update your `.env` file**
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
   ```

## Common Issues

### 1. DNS Resolution Error (ENOTFOUND)
**Symptoms:** `getaddrinfo ENOTFOUND db.xxxxx.supabase.co`

**Solutions:**
- ✅ Verify the hostname is correct in Supabase dashboard
- ✅ Check if your Supabase project is **active** (not paused)
- ✅ Try the **Connection Pooling** endpoint instead (port 6543):
  ```
  postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true
  ```
- ✅ Check your internet connection
- ✅ Try accessing Supabase dashboard in browser

### 2. Project Paused
**Free tier projects pause after 1 week of inactivity**

**Solution:**
- Go to Supabase dashboard
- Click **Restore** button to reactivate your project
- Wait a few minutes for the database to come online

### 3. Connection Pooling (Recommended)
For better performance and reliability, use the connection pooling endpoint:

**Format:**
```
postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true
```

**Note:** Port `6543` is for connection pooling, `5432` is for direct connection.

### 4. SSL Requirements
Supabase requires SSL connections. The code automatically adds `?sslmode=require` if not present.

## Testing Your Connection

Run the test script:
```bash
npm run check-db
```

Or use the detailed test:
```bash
node scripts/test-connection.js
```

## Verify Connection String Format

Your connection string should look like:
```
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

**Important:**
- Replace `PASSWORD` with your actual database password
- Replace `PROJECT_REF` with your actual project reference
- The database name is usually `postgres` (default Supabase database)

## Alternative: Use Individual Variables

If connection string doesn't work, you can use individual variables:

```env
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password
```

Then remove or comment out `DATABASE_URL` in your `.env` file.

