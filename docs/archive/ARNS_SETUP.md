# ArNS Setup Guide

**Last Updated:** 2025-11-04

## Overview

This guide explains how to set up ArNS (Arweave Name System) for the CrimRxiv Archive, enabling human-readable URLs for your data and application.

## Architecture

```
Root Name: crimrxiv.arweave.net
   ↓
   ├── @ (root) → App Bundle TX ID (updated when app changes)
   └── data_ → Parquet File TX ID (updated when data changes)

Result URLs:
- https://crimrxiv.arweave.net → Your app
- https://data_crimrxiv.arweave.net/metadata.parquet → Your data
```

## Step 1: Purchase ArNS Name

1. Go to https://arns.app
2. Connect your Arweave wallet
3. Search for available names (e.g., "crimrxiv")
4. Purchase the name (costs AR tokens - usually ~50-500 AR depending on name length)
5. Note down your **ANT Process ID** (shown after purchase)

## Step 2: Configure .env

Add these variables to your `.env` file:

```bash
# Root ArNS name (the name you purchased)
ARNS_ROOT_NAME=crimrxiv

# Data undername (where parquet will be accessible)
ARNS_DATA_UNDERNAME=data

# ANT Process ID (from arns.app after purchase)
ARNS_PROCESS_ID=abc123...xyz

# Your Arweave wallet (must be the owner of the ArNS name)
ARWEAVE_WALLET_PATH=/path/to/wallet.json
```

## Step 3: Upload Data Pipeline

### Step 3.1: Import Articles
```bash
npm run import
```
- Fetches all articles from CrimRxiv
- Saves to `data/articles/` with all versions
- Updates SQLite database

### Step 3.2: Export to Parquet
```bash
npm run export
```
- Exports SQLite → `data/export/metadata.parquet`
- Creates browser-optimized columnar data

### Step 3.3: Upload Article Manifests
```bash
npm run upload:articles
```
- Uploads each article folder to Arweave
- Gets manifest TX ID for each article
- Stores TX IDs back in SQLite

### Step 3.4: Re-export with TX IDs
```bash
npm run export
```
- Exports SQLite → parquet again
- Now includes `manifest_tx_id` for each article

### Step 3.5: Upload Parquet + Update ArNS
```bash
npm run upload:parquet
```
- Uploads `metadata.parquet` to Arweave
- **Automatically updates ArNS undername** `data_` → new TX ID
- Your app can now fetch from: `https://data_crimrxiv.arweave.net/metadata.parquet`

**Output:**
```
📤 Upload Parquet to Arweave + Update ArNS
============================================================

📦 File: metadata.parquet
💾 Size: 33.78 MB

🔑 Loading Arweave wallet...
🚀 Initializing Turbo SDK...
💰 Balance: 1000000 winc

📖 Reading parquet file...
📤 Uploading to Arweave via Turbo...

✅ Upload successful!

============================================================
📊 UPLOAD RESULT
============================================================
Transaction ID: abc123...xyz
Size: 33.78 MB
Direct URL: https://arweave.net/abc123...xyz
============================================================

============================================================
🌐 Updating ArNS Undername
============================================================

📝 Undername: data
📝 Root name: crimrxiv
📝 Target TX: abc123...xyz

🔧 Initializing ANT...
📤 Setting undername record...
✅ ArNS record updated!

============================================================
🌐 ARNS UPDATE RESULT
============================================================
Undername: data_crimrxiv
Target TX: abc123...xyz
Full URL: https://data_crimrxiv.arweave.net/metadata.parquet
============================================================

💡 Next steps:
  1. Wait for confirmation (~2-10 minutes)
  2. Test direct URL: https://arweave.net/abc123...xyz
  3. Test ArNS URL: https://data_crimrxiv.arweave.net/metadata.parquet
  4. Rebuild app if needed: npm run build
```

## Step 4: Build & Deploy App

### Step 4.1: Build App
```bash
npm run build
```
- Builds SPA to `dist/`
- App code references `data_crimrxiv.arweave.net` for parquet
- Includes DuckDB WASM files

### Step 4.2: Upload App
```bash
npm run sync
```
- Uploads `dist/` folder to Arweave
- Gets TX ID for app bundle
- Returns: `app_tx_id`

### Step 4.3: Update Root ArNS (Manual for now)
Using the AR.IO SDK or arns.app:

```javascript
// Set @ (root) record to point to app
ant.setRecord('@', {
  transactionId: 'app_tx_id_here',
  ttlSeconds: 3600
});
```

Or via arns.app:
1. Go to https://arns.app
2. Find your name (crimrxiv)
3. Click "Manage Records"
4. Set `@` → `app_tx_id_here`

## Workflow Summary

### Data Updates (Frequent)
```bash
npm run import              # Get new articles
npm run export              # Create parquet
npm run upload:articles     # Upload articles → TX IDs
npm run export              # Re-export with TX IDs
npm run upload:parquet      # Upload parquet + auto-update ArNS ✅
```
**Result:** Data updated, app automatically sees new data at stable URL

### App Updates (Less Frequent)
```bash
npm run build               # Rebuild app
npm run sync                # Upload app → new TX ID
# Manually update @ record via arns.app
```
**Result:** App updated, still fetches from stable data URL

### WASM Updates (Rare - once a year)
```bash
npm install @duckdb/duckdb-wasm@latest
npm run upload:wasm         # Upload new WASM files
# Update .env with new WASM TX IDs
npm run build               # Rebuild app
npm run sync                # Upload app
# Manually update @ record via arns.app
```

## Benefits

✅ **Separation of Concerns** - Update data or app independently
✅ **Automatic ArNS Update** - Parquet upload auto-updates undername
✅ **Stable URLs** - App always fetches from same ArNS URL
✅ **Cost Effective** - Don't re-upload 33MB parquet when fixing CSS
✅ **Time Efficient** - Don't rebuild app when adding articles
✅ **Version Control** - Each layer has its own TX ID history

## Troubleshooting

### "Missing ARNS_PROCESS_ID"
- Go to https://arns.app
- Find your ArNS name
- Copy the "Process ID" (ANT contract ID)
- Add to `.env`: `ARNS_PROCESS_ID=your-process-id`

### "Failed to update ArNS record"
The upload succeeded but ArNS update failed. You can update manually:

**Option 1: Use AR.IO SDK**
```javascript
import { ANT } from '@ar.io/sdk';

const ant = ANT.init({
  processId: 'your-ant-process-id',
  signer: walletJwk
});

await ant.setRecord('data', {
  transactionId: 'parquet-tx-id',
  ttlSeconds: 3600
});
```

**Option 2: Use arns.app**
1. Go to https://arns.app
2. Connect wallet
3. Find your name
4. Click "Manage Records"
5. Add/update undername `data` → `parquet-tx-id`

### "ArNS URL not working"
- Wait 2-10 minutes for propagation
- Check direct URL first: `https://arweave.net/{tx-id}`
- Verify undername is correct: `data_crimrxiv` (not `data.crimrxiv`)
- Check TTL hasn't expired (default 1 hour)

### Testing ArNS URLs

```bash
# Test direct Arweave URL (should work immediately)
curl -I https://arweave.net/{tx-id}

# Test ArNS URL (may take 2-10 minutes)
curl -I https://data_crimrxiv.arweave.net/metadata.parquet
```

## Advanced: Automating Root Record Updates

To fully automate the workflow, you could create a script that also updates the root `@` record after deploying the app. This would require modifying the sync/deploy scripts to:

1. Upload app → get TX ID
2. Update `@` record → new app TX ID
3. Done!

This is left as a future enhancement since app updates are less frequent than data updates.

## References

- **AR.IO SDK Docs:** https://github.com/ar-io/ar-io-sdk
- **ArNS App:** https://arns.app
- **Arweave Docs:** https://docs.arweave.org
- **Turbo SDK Docs:** https://github.com/ardriveapp/turbo-sdk

## Summary

✅ Purchase ArNS name at arns.app
✅ Configure .env with root name, undername, and process ID
✅ Upload parquet → automatically updates data undername
✅ Build and upload app → manually update root record
✅ Data and app layers are independent and updatable separately

Your parquet upload workflow is now fully automated! 🎉
