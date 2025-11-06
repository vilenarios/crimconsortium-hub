# Deployment Checklist

## ✅ Completed Steps

1. **Articles Uploaded** - All ~3,758 article folders uploaded to Arweave with manifest TX IDs
2. **Parquet Uploaded** - metadata.parquet uploaded to Arweave
3. **DuckDB-WASM Uploaded** - WASM files uploaded to Arweave
4. **SQLite Updated** - All articles have `manifest_tx_id` in database

## ⚠️ Critical: ArNS Configuration Required

### 1. Configure DuckDB-WASM ArNS Name

**YOU MUST DO THIS MANUALLY:**

1. Go to https://arns.app
2. Find your `duck-db-wasm` ArNS name
3. Set the undername `@` (root) to point to the WASM manifest TX ID
   - TX ID: (the one from `npm run upload:wasm` output)
   - TTL: 3600 seconds (1 hour) for now

**Why?** The app is now configured to load WASM from `https://duck-db-wasm.ar.io`

### 2. Verify Data ArNS Name

**Should be auto-configured** (check to be sure):

1. Go to https://arns.app
2. Find your root ArNS name (e.g., `crimrxiv-demo`)
3. Verify the `data` undername points to your latest parquet TX ID
   - Should have been set by `npm run upload:parquet`

### 3. Configure Root ArNS Name (for app deployment)

**After building the app:**

1. Run `npm run build`
2. Upload the `dist/` folder to Arweave (gets a manifest TX ID)
3. Go to https://arns.app
4. Set root `@` record to point to your app manifest TX ID

## 📋 Deployment URLs

Once configured, your app will use:

- **App**: `https://crimrxiv-demo.arweave.net`
- **Data**: `https://data_crimrxiv-demo.arweave.net` (parquet file)
- **WASM**: `https://duck-db-wasm.ar.io` (DuckDB-WASM files)
- **Articles**: `https://crimrxiv-demo.arweave.net/{manifest_tx_id}/...`

## 🔍 Testing Before Build

**Local Testing:**
```bash
npm run dev
```

This uses localhost paths for development:
- Parquet: `http://localhost:3005/data/metadata.parquet`
- WASM: `./duckdb/*.wasm` (bundled files)
- Articles: API calls to crimrxiv.com

**Production Build:**
```bash
npm run build
npm run preview
```

This simulates production using external ArNS resources.

## ⚠️ Important Notes

1. **DuckDB-WASM ArNS** - You MUST configure `duck-db-wasm` ArNS manually before building
2. **Data parquet** - Should be auto-configured by upload script
3. **Article manifests** - All stored in SQLite with `manifest_tx_id` field
4. **CORS** - Arweave gateways handle CORS automatically

## 🚀 Build & Deploy Command

Once ArNS is configured:

```bash
# Build the app
npm run build

# Deploy to Arweave (if you have deploy script)
npm run deploy

# Or manually upload dist/ folder and configure ArNS
```

## 🐛 Debugging

If the app doesn't load in production:

1. **Check browser console** for errors
2. **Verify ArNS records**:
   - `duck-db-wasm.ar.io` → WASM manifest TX ID
   - `data_crimrxiv-demo.arweave.net` → Parquet TX ID
   - `crimrxiv-demo.arweave.net` → App manifest TX ID
3. **Test URLs directly** in browser
4. **Check CORS** - Should work automatically on Arweave gateways
