# Testing Workflow

This document explains how to test the CrimRxiv Archive in three different modes: **Full Local**, **Hybrid**, and **Full Production**.

## Overview

The architecture supports three distinct testing scenarios:

| Mode | App | Parquet Data | Articles | Use Case |
|------|-----|--------------|----------|----------|
| **Full Local** | localhost:3005 | localhost | localhost | Development, offline testing |
| **Hybrid** | localhost:4174 | Arweave | Arweave | Pre-deployment testing |
| **Production** | Arweave | Arweave | Arweave | Live deployment |

## Mode 1: Full Local Testing

**Everything runs locally** - app, parquet database, and article content.

### Setup

1. Ensure data is available locally:
```bash
# Check that local files exist
ls -lh public/data/metadata.parquet
ls -d data/articles/*/
```

2. Start dev server:
```bash
npm run dev
```

3. Access at: **http://localhost:3005**

### What's Loaded

- **App**: Vite dev server (hot reload enabled)
- **Parquet**: `/data/metadata.parquet` (from `public/data/`)
- **Articles**: `/data/articles/{slug}/content.json` (local files)
- **DuckDB WASM**: `/duckdb/*.wasm` (from `public/duckdb/`)

### Testing Mode Detection

The system automatically detects full local mode based on:
- Hostname is `localhost` or `127.0.0.1`
- Port is `3005` (default dev port)
- No `?mode=hybrid` URL parameter

### Console Output

Look for:
```
📦 ManifestLoader initialized in local mode
📂 Loading article locally: 53cvbihh
✅ Loaded local content.json for 53cvbihh
🌐 Arweave Config Initialized:
  testingMode: "local"
  useRemoteData: false
```

### Benefits

- ✅ Fast development cycle (HMR)
- ✅ Works offline
- ✅ No Arweave gas costs
- ✅ Test with latest local changes

### Limitations

- ⚠️ Requires complete local dataset
- ⚠️ Doesn't test Arweave manifest loading
- ⚠️ Doesn't test gateway compatibility

---

## Mode 2: Hybrid Testing

**App runs locally, but data loads from Arweave** - tests remote data loading without deploying the app.

### Setup

1. Ensure parquet and articles are uploaded to Arweave:
```bash
# Upload parquet file to Arweave (if updated)
npm run upload:parquet

# Verify parquet is accessible
curl -I https://data_crimrxiv.arweave.net
```

2. Start preview server:
```bash
npm run preview
```

3. Access at: **http://localhost:4174** (automatically uses hybrid mode)

**OR** force hybrid mode on dev server:

```bash
npm run dev
# Then visit: http://localhost:3005/?mode=hybrid
```

### What's Loaded

- **App**: Vite preview server (production build, served locally)
- **Parquet**: `https://data_crimrxiv.arweave.net` (from Arweave)
- **Articles**: Arweave manifests via TX IDs (from Arweave)
- **DuckDB WASM**: `/duckdb/*.wasm` (from `dist/duckdb/`)

### Testing Mode Detection

The system detects hybrid mode based on:
- Hostname is `localhost`
- Port is `4174` (preview port) **OR** URL has `?mode=hybrid` parameter
- `useRemoteData` flag is true

### Console Output

Look for:
```
📦 ManifestLoader initialized in hybrid mode
📋 Loading manifest from: https://arweave.net/raw/DoHWq7VYT...
🌐 Arweave Config Initialized:
  testingMode: "hybrid"
  useRemoteData: true
```

### Benefits

- ✅ Tests Arweave data loading without full deployment
- ✅ Tests gateway URLs and manifest resolution
- ✅ Verifies parquet file accessibility
- ✅ Fast iteration (no app deployment)
- ✅ Tests cross-origin requests (CORS)

### Limitations

- ⚠️ Requires uploaded parquet + articles on Arweave
- ⚠️ Doesn't test final deployed app behavior
- ⚠️ Arweave lookups may be slow

### Common Issues

**Problem**: Articles don't load in hybrid mode
**Solution**: Check that manifest TX IDs are uploaded to Arweave:
```bash
# Test manifest is accessible
curl https://arweave.net/raw/DoHWq7VYTdHeVsdbS3bFOTmxiNnzBXrcEELWo15ZN-M
```

---

## Mode 3: Full Production

**Everything on Arweave** - the live deployment with app, data, and articles all on the permaweb.

### Setup

1. Build and deploy everything:
```bash
# Simple deployment (recommended)
npm run deploy

# OR Manual deployment
npm run build:prod
npm run sync
```

2. Access at your ArNS URL:
```
https://crimrxiv.arweave.net
https://crimrxiv.ar.io
https://crimrxiv.permagate.io
```

### What's Loaded

- **App**: `https://crimrxiv.{gateway}` (from Arweave)
- **Parquet**: `https://data_crimrxiv.{gateway}` (ArNS undername)
- **Articles**: Arweave manifests via TX IDs
- **DuckDB WASM**: `https://duck-db-wasm.{gateway}` (ArNS undername)

### Testing Mode Detection

The system detects production mode based on:
- Hostname is NOT `localhost`
- Gateway domain extracted from hostname

### Console Output

Look for:
```
📦 ManifestLoader initialized in production mode
🌐 Arweave Config Initialized:
  testingMode: "production"
  gateway: "arweave.net"
```

### Benefits

- ✅ Tests real-world deployment
- ✅ Tests gateway compatibility (600+ gateways)
- ✅ Permanent, censorship-resistant
- ✅ Tests CDN/caching behavior

### Limitations

- ⚠️ Requires Arweave wallet with AR tokens
- ⚠️ Deployment takes 2-10 minutes to propagate
- ⚠️ Immutable (can't hot-fix, must redeploy)

---

## Quick Reference

### Switch Between Modes

```bash
# Mode 1: Full Local
npm run dev
# → http://localhost:3005

# Mode 2: Hybrid (Method 1 - Preview server)
npm run build && npm run preview
# → http://localhost:4174

# Mode 2: Hybrid (Method 2 - Dev server with param)
npm run dev
# → http://localhost:3005/?mode=hybrid

# Mode 3: Production
npm run deploy
# → https://crimrxiv.arweave.net
```

### Debugging

Check current mode in browser console:
```javascript
import { getEnvironmentInfo } from './src/config/arweave.js';
console.log(getEnvironmentInfo());
```

Output:
```json
{
  "environment": "development",
  "testingMode": "local",
  "useRemoteData": false,
  "hostname": "localhost",
  "port": "3005",
  "gateway": "localhost:3005"
}
```

### Environment Variables

No environment variables needed for testing modes - detection is automatic based on hostname and port.

For deployment, you need:
```env
ARWEAVE_WALLET_PATH=/path/to/wallet.json
ARNS_ROOT_NAME=crimrxiv
ARNS_DATA_UNDERNAME=data
ARNS_PROCESS_ID=your-ant-process-id
```

---

## Typical Development Workflow

1. **Local Development** (Mode 1)
   ```bash
   npm run dev
   # Make changes, test with hot reload
   ```

2. **Pre-Deployment Testing** (Mode 2)
   ```bash
   # Upload latest data
   npm run export && npm run upload:parquet

   # Test with remote data
   npm run build && npm run preview
   ```

3. **Deploy to Production** (Mode 3)
   ```bash
   npm run deploy
   # Wait 2-10 minutes for propagation
   # Test at https://crimrxiv.arweave.net
   ```

---

## Troubleshooting

### Articles don't load in local mode

**Check**: Do local article files exist?
```bash
ls data/articles/53cvbihh/content.json
```

**Fix**: Run import to fetch articles:
```bash
npm run import
```

### Articles don't load in hybrid/production

**Check**: Are manifests uploaded to Arweave?
```bash
curl https://arweave.net/raw/DoHWq7VYTdHeVsdbS3bFOTmxiNnzBXrcEELWo15ZN-M
```

**Fix**: Upload articles:
```bash
npm run upload:articles
```

### Parquet not loading in hybrid mode

**Check**: Is parquet accessible at ArNS URL?
```bash
curl -I https://data_crimrxiv.arweave.net
```

**Fix**: Re-upload parquet:
```bash
npm run upload:parquet
```

### Mode detection wrong

**Force a specific mode**:
```bash
# Force hybrid in dev
http://localhost:3005/?mode=hybrid

# Force local in preview
http://localhost:4174/?mode=local
```

---

## Architecture Notes

### URL Resolution

The `src/config/arweave.js` module handles URL resolution for all three modes:

- **Full Local**: Uses `/data/articles/{slug}/content.json`
- **Hybrid**: Uses `https://arweave.net/raw/{manifestTxId}`
- **Production**: Uses `https://{gateway}/raw/{manifestTxId}`

### Gateway Compatibility

The system automatically adapts to different gateways:
- `arweave.net` - Official gateway
- `ar.io` - ar.io gateway (special case: uses arweave.net for TX resolution)
- `permagate.io` - Community gateway
- 600+ other ar.io network gateways

### Caching

- **Full Local**: Browser cache only
- **Hybrid**: Browser + Arweave gateway cache
- **Production**: Multi-layer CDN + gateway cache

---

## Next Steps

- See `docs/DEPLOYMENT.md` for detailed deployment instructions
- See `docs/ARCHITECTURE.md` for system architecture details
- See `CLAUDE.md` for complete command reference
