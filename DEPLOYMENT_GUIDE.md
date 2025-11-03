# CrimRXiv Archive - Deployment Guide

This guide walks you through deploying the CrimRXiv Archive to Arweave using the **external resources architecture**.

## Architecture Overview

The deployment consists of three independent components:

```
1. App Bundle (~1MB)
   ├── HTML, CSS, JavaScript
   └── Loads external resources

2. Parquet Data (~5MB)
   ├── Uploaded to Arweave
   └── Accessed via ArNS: data_crimrxiv.arweave.net

3. WASM Files (~72MB)
   ├── Uploaded to Arweave
   └── Accessed via TX IDs
```

## Prerequisites

Before starting, ensure you have:

- [x] Node.js 18+ installed
- [x] Arweave wallet with sufficient AR (~$30-50 for uploads)
- [x] Wallet JSON file saved locally
- [x] `.env` file configured with `ARWEAVE_WALLET_PATH`
- [x] ArNS names configured (or ready to configure)
- [x] Latest data imported: `npm run import`

## Deployment Workflow

### Step 1: Export Metadata to Parquet

Export the SQLite database to Parquet format for browser queries:

```bash
npm run export
```

**Expected output:**
```
📋 Exporting metadata.parquet...
  📊 Articles: 3,753
  💾 Size: 4.82 MB
  ✅ Written: C:\Source\crimconsortium-hub\data\export\metadata.parquet
```

**What this does:**
- Reads latest articles from SQLite database
- Exports to Parquet with ZSTD compression
- Saves to `data/export/metadata.parquet`
- Ready for upload to Arweave

---

### Step 2: Upload Parquet to Arweave

Upload the parquet file using Turbo SDK:

```bash
npm run upload:parquet
```

**Expected output:**
```
✅ Upload successful!
Transaction ID: abc123xyz...
Size: 4.82 MB
URL: https://arweave.net/abc123xyz...
```

**Action required:**
1. Copy the transaction ID
2. Add to `.env`:
   ```
   PARQUET_TX_ID=abc123xyz...
   ```
3. Wait 2-10 minutes for confirmation
4. Test URL: `https://arweave.net/abc123xyz...`

---

### Step 3: Upload WASM Files (First Time Only)

Upload DuckDB-WASM files to Arweave (only needed once):

```bash
npm run upload:wasm
```

**Expected output:**
```
✅ UPLOAD COMPLETE!
Files uploaded: 4
Total size: 71.23 MB

Add these to your .env file:
WASM_MVP_TX_ID=def456...
WASM_MVP_WORKER_TX_ID=ghi789...
WASM_EH_TX_ID=jkl012...
WASM_EH_WORKER_TX_ID=mno345...
```

**Action required:**
1. Copy all TX IDs
2. Add to `.env`:
   ```
   WASM_MVP_TX_ID=def456...
   WASM_MVP_WORKER_TX_ID=ghi789...
   WASM_EH_TX_ID=jkl012...
   WASM_EH_WORKER_TX_ID=mno345...
   ```
3. Update `src/config/arweave.js` production config:
   ```javascript
   const PRODUCTION_CONFIG = {
     parquet: 'https://data_crimrxiv.arweave.net/metadata.parquet',
     wasm: {
       mvpModule: 'https://arweave.net/def456...',
       mvpWorker: 'https://arweave.net/ghi789...',
       ehModule: 'https://arweave.net/jkl012...',
       ehWorker: 'https://arweave.net/mno345...',
     },
     manifestBase: 'https://arweave.net',
     gateway: 'https://arweave.net',
   };
   ```

**Note:** WASM files rarely change, so you only need to upload them once. Future deployments can skip this step.

---

### Step 4: Configure ArNS Undername

Configure the ArNS undername to point to your parquet file:

**Option A: Using ar.io dashboard**
1. Go to https://ar.io
2. Navigate to your `crimrxiv` ArNS name
3. Add undername: `data` → `abc123xyz...` (parquet TX ID)
4. Save changes
5. Wait for propagation (~5-10 minutes)
6. Test: `https://data_crimrxiv.arweave.net/metadata.parquet`

**Option B: Using CLI**
```bash
# Install AR.IO CLI
npm install -g @ar.io/cli

# Set undername
arns set-undername crimrxiv data abc123xyz...
```

---

### Step 5: Build Production App

Build the optimized production bundle:

```bash
npm run build
```

**Expected output:**
```
vite v7.1.12 building for production...
✓ built in 3.45s
dist/index.html                   12.34 kB
dist/assets/index-abc123.js       245.67 kB
dist/assets/vendor-def456.js      89.23 kB
```

**Verify build:**
```bash
# Check bundle size
ls -lh dist/

# Test locally
npm run preview
```

---

### Step 6: Test Local Preview

Before deploying, test the production build locally:

```bash
npm run preview
```

**Open in browser:** http://localhost:4174

**Test checklist:**
- [ ] Homepage loads with articles
- [ ] Search works
- [ ] Article pages load (click on any article)
- [ ] External parquet loads (check network tab)
- [ ] External WASM loads (check console)
- [ ] No console errors
- [ ] All features functional

---

### Step 7: Deploy App to Arweave

Deploy the app bundle to Arweave:

**Option A: Automated (via ArDrive sync)**
```bash
npm run sync
```

**Option B: Manual upload**
1. Upload `dist/` folder to Arweave using ArDrive or other tool
2. Get the transaction ID
3. Configure ArNS: `crimrxiv.arweave.net` → `app_tx_id`

---

### Step 8: Configure Main ArNS Name

Point your main ArNS name to the app:

1. Go to https://ar.io
2. Navigate to your `crimrxiv` ArNS name
3. Update root: `crimrxiv.arweave.net` → `app_tx_id`
4. Save changes
5. Wait for propagation (~5-10 minutes)
6. Test: `https://crimrxiv.arweave.net`

---

## Post-Deployment Checklist

After deployment, verify everything works:

- [ ] Main site loads: `https://crimrxiv.arweave.net`
- [ ] Parquet loads: `https://data_crimrxiv.arweave.net/metadata.parquet`
- [ ] WASM files load (check browser network tab)
- [ ] Homepage displays articles
- [ ] Search functionality works
- [ ] Article pages load with content from manifests
- [ ] No console errors
- [ ] Mobile responsive
- [ ] All links functional

---

## Troubleshooting

### Parquet file not loading

**Symptoms:**
- Homepage shows no articles
- Console error: "Failed to load metadata"

**Solutions:**
1. Check ArNS undername is configured correctly
2. Verify parquet TX ID in .env matches uploaded file
3. Test direct URL: `https://arweave.net/YOUR_PARQUET_TX_ID`
4. Clear browser cache
5. Check browser network tab for 404 errors

### WASM files not loading

**Symptoms:**
- Console error: "Failed to initialize DuckDB-WASM"
- Blank homepage

**Solutions:**
1. Verify WASM TX IDs in .env are correct
2. Check src/config/arweave.js has correct production URLs
3. Test WASM URLs directly: `https://arweave.net/YOUR_WASM_TX_ID`
4. Ensure CORS headers are present (Arweave handles this automatically)
5. Try different browser (some browsers block WASM)

### Articles load but no content

**Symptoms:**
- Article pages show metadata but no content
- Console error: "Failed to load manifest"

**Solutions:**
1. Verify manifests were generated: `npm run generate:manifests`
2. Check manifests were uploaded: `npm run upload:manifests`
3. Verify manifest_tx_id exists in database
4. Test manifest URL: `https://arweave.net/MANIFEST_TX_ID`

### ArNS name not resolving

**Symptoms:**
- Main site URL doesn't work
- Gateway shows 404

**Solutions:**
1. Wait longer (propagation can take 10-30 minutes)
2. Verify ArNS configuration on ar.io dashboard
3. Try different gateway: `crimrxiv.ar-io.dev`
4. Check transaction is confirmed on Arweave
5. Test direct TX ID: `https://arweave.net/APP_TX_ID`

---

## Updating Deployed Site

To update the deployed site with new data:

### Update Data Only (Common)

If you just want to update article data:

```bash
# 1. Import latest data
npm run import

# 2. Export to parquet
npm run export

# 3. Upload new parquet
npm run upload:parquet

# 4. Update ArNS undername with new TX ID
```

**No need to rebuild or redeploy the app!** The app will automatically fetch the new parquet file.

### Update App Code (Less Common)

If you changed app code:

```bash
# 1. Build new app
npm run build

# 2. Deploy to Arweave
npm run sync  # or manual upload

# 3. Update main ArNS name with new app TX ID
```

---

## Costs

Estimated costs for deployment (as of 2025):

| Component | Size | Cost (approx) |
|-----------|------|---------------|
| Parquet | ~5 MB | ~$0.50 |
| WASM files | ~72 MB | ~$7.20 (one-time) |
| App bundle | ~1 MB | ~$0.10 |
| Article manifests (3,753) | ~100 MB | ~$10.00 (one-time) |
| **Total first deployment** | - | **~$17.80** |
| **Subsequent data updates** | - | **~$0.50** (parquet only) |

Prices vary with AR token price. Check current rates at https://ar.io/arweave-price

---

## Full Deployment Script

For automated deployment, use:

```bash
npm run deploy
```

This runs the full workflow interactively, prompting at each step.

---

## Support

If you encounter issues:

1. Check `TESTING_CHECKLIST.md` for common issues
2. Review console errors in browser dev tools
3. Test components individually:
   - Parquet: `curl https://data_crimrxiv.arweave.net/metadata.parquet`
   - WASM: `curl https://arweave.net/WASM_TX_ID`
   - App: `curl https://crimrxiv.arweave.net`
4. Check Arweave gateway status: https://arweave.net/status

---

## Security Notes

**NEVER commit:**
- `.env` file (contains wallet path)
- Arweave wallet JSON file
- Any private keys or credentials

**ALWAYS:**
- Keep wallet JSON file outside repository
- Use `.gitignore` to exclude sensitive files
- Store credentials securely
- Use environment variables for configuration

---

## Next Steps

After successful deployment:

1. Monitor site performance
2. Set up monitoring/health checks
3. Document any custom configurations
4. Plan regular data updates
5. Consider CDN/caching strategies
6. Test disaster recovery procedures

For questions, see `CLAUDE.md` for full development guide.
