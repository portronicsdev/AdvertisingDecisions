# DNS/IPv6 Connection Troubleshooting

## Issue: ENOTFOUND / ENETUNREACH with Supabase

Your Supabase hostname only resolves to IPv6, but your system doesn't have IPv6 connectivity enabled.

## Solutions

### Option 1: Enable IPv6 on Windows (Recommended)

1. **Open Network Settings:**
   - Right-click network icon → "Open Network & Internet settings"
   - Click "Change adapter options"

2. **Configure IPv6:**
   - Right-click your network adapter (Wi-Fi/Ethernet)
   - Select "Properties"
   - Check "Internet Protocol Version 6 (TCP/IPv6)"
   - Click "OK"
   - Restart your computer

3. **Verify IPv6 is working:**
   ```powershell
   Test-Connection -ComputerName ipv6.google.com -Count 1
   ```

### Option 2: Use Connection Pooling Endpoint

Try using Supabase's connection pooling endpoint which might have IPv4:

**Update your `.env` file:**
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.tiwfzhgmtemfrojupdnl.supabase.co:6543/postgres?pgbouncer=true&sslmode=require
```

Note: Port `6543` is for connection pooling (might have IPv4 support).

### Option 3: Use a VPN with IPv6 Support

If your network doesn't support IPv6, use a VPN that provides IPv6 connectivity.

### Option 4: Contact Supabase Support

Ask Supabase support if they can provide an IPv4 address for your database endpoint.

### Option 5: Use Supabase's Direct Connection

Check your Supabase dashboard for alternative connection methods:
- Settings → Database → Connection string
- Look for "Direct connection" vs "Connection pooling"

## Quick Test

After enabling IPv6, test the connection:
```bash
npm run check-db
```

## Current Status

- ✅ Hostname resolves to IPv6: `2406:da1c:f42:ae0b:e808:5d8f:cde2:37cc`
- ❌ No IPv4 address available
- ❌ IPv6 connectivity not enabled on your system

