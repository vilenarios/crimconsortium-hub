# Arweave Deployment Issues & Fixes

## Critical Issues Found ❌

### Issue #1: WASM Files Use Absolute Paths (CRITICAL)

**Location:** `src/lib/parquet-db.js:63-68`

**Problem:**
```javascript
const MANUAL_BUNDLES = {
  mvp: {
    mainModule: '/duckdb/duckdb-mvp.wasm',      // ❌ Absolute path
    mainWorker: '/duckdb/duckdb-browser-mvp.worker.js',
  },
  eh: {
    mainModule: '/duckdb/duckdb-eh.wasm',       // ❌ Absolute path
    mainWorker: '/duckdb/duckdb-browser-eh.worker.js',
  },
};
```

**Why it fails on Arweave:**
- App deployed at: `https://arweave.net/TX_ID/`
- Absolute path `/duckdb/...` resolves to: `https://arweave.net/duckdb/...` ❌
- Should resolve to: `https://arweave.net/TX_ID/duckdb/...` ✅

**Impact:** 🔴 **APP WILL NOT LOAD ON ARWEAVE**
- DuckDB-WASM initialization will fail
- All database queries will fail
- App will be completely broken

**Fix Required:**
```javascript
// src/lib/parquet-db.js
const MANUAL_BUNDLES = {
  mvp: {
    mainModule: './duckdb/duckdb-mvp.wasm',           // ✅ Relative path
    mainWorker: './duckdb/duckdb-browser-mvp.worker.js',
  },
  eh: {
    mainModule: './duckdb/duckdb-eh.wasm',            // ✅ Relative path
    mainWorker: './duckdb/duckdb-browser-eh.worker.js',
  },
};
```

**Testing:**
```bash
# After fix, test with:
npm run build
npm run preview  # Should work
# Test in browser console: verify no 404 errors for WASM files
```

---

### Issue #2: Parquet URL Requires ArNS Undername Setup (MAJOR)

**Location:** `src/lib/parquet-db.js:45-50`

**Problem:**
```javascript
// Production uses ArNS undername
return {
  metadata: getDataParquetUrl('metadata.parquet'),  // Returns: https://data_crimrxiv.arweave.net/metadata.parquet
  batchBase: getUndernameUrl('data', '/articles/')
};
```

**Why it fails:**
- Code expects ArNS undername `data_crimrxiv.arweave.net` to exist
- This requires separate ArNS domain configuration ($10-50/year)
- Parquet file must be uploaded separately to that subdomain

**Impact:** 🔴 **APP WILL NOT LOAD DATA ON ARWEAVE**
- Parquet file won't be found
- No articles will display
- Search won't work

**Options:**

**Option A: Use ArNS Undernames (Recommended for Production)**
1. Upload parquet file separately to Arweave → get `PARQUET_TX_ID`
2. Configure ArNS undername: `data_crimrxiv.arweave.net` → points to `PARQUET_TX_ID`
3. Keep code as-is

**Cost:** $10-50/year for ArNS undername

**Option B: Include Parquet in Main App Bundle (Simple)**
```javascript
// src/lib/parquet-db.js - Modify getParquetUrls()
getParquetUrls() {
  const appInfo = getAppInfo();

  if (appInfo.isLocalhost) {
    const baseUrl = `${appInfo.protocol}://${appInfo.hostname}:${window.location.port || '3005'}`;
    return {
      metadata: `${baseUrl}/data/metadata.parquet`,
      batchBase: `${baseUrl}/data/articles/`
    };
  }

  // ✅ Production: Use relative path (parquet in same bundle)
  return {
    metadata: './data/metadata.parquet',
    batchBase: './data/articles/'
  };
}
```

**Pros:**
- No additional ArNS costs
- Simpler deployment (single upload)
- Works immediately

**Cons:**
- Larger bundle (~8MB total: 3MB app + 5MB parquet)
- Must redeploy entire app to update data
- Higher Arweave storage cost ($0.08 vs $0.05)

**Option C: Use Transaction ID Directly**
```javascript
// Set parquet txid in environment or config
const PARQUET_TX_ID = 'ABC123...XYZ'; // From separate upload

return {
  metadata: `https://${gateway}/${PARQUET_TX_ID}`,
  batchBase: `https://${gateway}/${PARQUET_TX_ID}/articles/`
};
```

**Pros:**
- No ArNS cost
- Separate data uploads
- Can update data without redeploying app

**Cons:**
- Hardcoded txid needs code change for data updates
- Less flexible than ArNS

---

### Issue #3: Asset Paths in index.html (MINOR)

**Location:** `index.html`

**Current:**
```html
<link rel="icon" type="image/x-icon" href="/favicon.ico">    <!-- ❌ Absolute -->
<img src="/crimxriv-logo.png" alt="CrimRxiv" class="site-logo">  <!-- ❌ Absolute -->
<script type="module" src="/src/main.js"></script>            <!-- Vite handles this ✅ -->
```

**Problem:**
- `/favicon.ico` and `/crimxriv-logo.png` use absolute paths
- Will try to load from `https://arweave.net/favicon.ico` instead of `https://arweave.net/TX_ID/favicon.ico`

**Impact:** 🟡 **COSMETIC ISSUES**
- Favicon won't appear
- Logo won't appear
- App still works, just looks incomplete

**Fix:**
```html
<link rel="icon" type="image/x-icon" href="./favicon.ico">    <!-- ✅ Relative -->
<img src="./crimxriv-logo.png" alt="CrimRxiv" class="site-logo">  <!-- ✅ Relative -->
```

**Note:** Vite handles `src="/src/main.js"` correctly due to `base: './'` config.

---

## Non-Issues (Already Correct) ✅

### ✅ Base Path Configuration
```javascript
// vite.config.js
base: './',  // ✅ Correct for Arweave
```

### ✅ Hash-Based Routing
```javascript
// src/lib/router.js
#/article/{slug}  // ✅ Works on static hosting
```

### ✅ External Links
All external links (DOI, ORCID, CrimRxiv.com) correctly point to external sites.

### ✅ No External Dependencies
- No CDN links
- No external fonts
- All inline CSS
- Self-contained bundle

---

## Required Fixes Before Deployment

### Fix #1: WASM Paths (CRITICAL - Required)

**File:** `src/lib/parquet-db.js`

```javascript
// Line 61-70
const MANUAL_BUNDLES = {
  mvp: {
    mainModule: './duckdb/duckdb-mvp.wasm',           // Change / to ./
    mainWorker: './duckdb/duckdb-browser-mvp.worker.js',
  },
  eh: {
    mainModule: './duckdb/duckdb-eh.wasm',            // Change / to ./
    mainWorker: './duckdb/duckdb-browser-eh.worker.js',
  },
};
```

### Fix #2: Asset Paths (RECOMMENDED)

**File:** `index.html`

```html
<!-- Line 8 -->
<link rel="icon" type="image/x-icon" href="./favicon.ico">

<!-- Line 242 -->
<img src="./crimxriv-logo.png" alt="CrimRxiv" class="site-logo" onerror="this.style.display='none'">
```

### Fix #3: Parquet URL Strategy (CHOOSE ONE)

**Option A - Include in Bundle (Simplest):**

**File:** `src/lib/parquet-db.js`

```javascript
// Line 32-51
getParquetUrls() {
  const appInfo = getAppInfo();

  if (appInfo.isLocalhost) {
    const baseUrl = `${appInfo.protocol}://${appInfo.hostname}:${window.location.port || '3005'}`;
    return {
      metadata: `${baseUrl}/data/metadata.parquet`,
      batchBase: `${baseUrl}/data/articles/`
    };
  }

  // Production: relative paths (parquet in bundle)
  return {
    metadata: './data/metadata.parquet',
    batchBase: './data/articles/'
  };
}
```

**Option B - Setup ArNS (More Complex but Better Long-term):**
- Keep code as-is
- Upload parquet separately
- Configure ArNS undername `data_crimrxiv.arweave.net`

---

## Testing Checklist

### Local Testing (After Fixes):
```bash
# 1. Apply fixes
# 2. Build
npm run build

# 3. Preview
npm run preview

# 4. Test in browser:
- [ ] Open http://localhost:4173
- [ ] Check browser console for errors
- [ ] Verify no 404 errors for WASM files
- [ ] Verify parquet file loads
- [ ] Test homepage loads articles
- [ ] Test search works
- [ ] Test article detail page
- [ ] Check favicon and logo appear
```

### Arweave Testing (After Deployment):
```bash
# 1. Deploy to Arweave
# Upload dist/ folder → get TX_ID

# 2. Test via gateway
- [ ] Open https://arweave.net/TX_ID/
- [ ] Check browser console for errors
- [ ] Verify WASM files load (Network tab)
- [ ] Verify parquet loads (Network tab)
- [ ] Test all routes work
- [ ] Test on mobile browser
```

---

## Deployment Workflow (Corrected)

### Scenario A: Include Parquet in Bundle (Recommended for First Deploy)

```bash
# 1. Apply all fixes above
# 2. Ensure parquet exists
npm run export  # Creates public/data/metadata.parquet

# 3. Build app
npm run build

# 4. Verify build
ls -la dist/data/metadata.parquet  # Should exist (~5MB)
ls -la dist/duckdb/*.wasm          # Should exist (~72MB total)

# 5. Upload to Arweave
# Upload entire dist/ folder → TX_ID

# 6. Test
# Open https://arweave.net/TX_ID/

# 7. Configure ArNS (optional)
# Point crimrxiv.ar → TX_ID
```

**Bundle Size:** ~80MB
**Cost:** ~$0.80 one-time

### Scenario B: Separate Data Upload (ArNS Required)

```bash
# 1. Apply Fix #1 and #2 only (not Fix #3)
# 2. Upload parquet separately
# Upload public/data/metadata.parquet → PARQUET_TX_ID

# 3. Configure ArNS undername
# data_crimrxiv.arweave.net → PARQUET_TX_ID

# 4. Build app (without parquet)
npm run build

# 5. Upload app
# Upload dist/ → APP_TX_ID

# 6. Configure ArNS for app
# crimrxiv.ar → APP_TX_ID
```

**Bundle Size:** 3MB (app) + 5MB (data) = 8MB total
**Cost:** $0.08 (storage) + $20-100/year (ArNS domains)

---

## Summary

### Will the app work on Arweave? **NO - Not without fixes**

**Critical Blockers:**
1. ❌ WASM files won't load (absolute paths)
2. ❌ Parquet file won't load (ArNS undername expected)

**After applying fixes:** ✅ **YES - Will work perfectly**

### Recommended Fix Priority:

1. **CRITICAL (Must Fix):** WASM paths → relative
2. **CRITICAL (Must Choose):** Parquet strategy (bundle or ArNS)
3. **RECOMMENDED:** Asset paths → relative

### Recommended First Deployment:

Use **Option B (Include Parquet in Bundle)** for simplicity:
- Single upload
- No ArNS configuration needed
- Works immediately
- Can migrate to ArNS later for better data management

### Estimated Timeline:

- Applying fixes: 10 minutes
- Testing locally: 10 minutes
- Building and uploading: 15 minutes
- **Total: ~35 minutes to working Arweave deployment**

---

**Date:** 2025-11-02
**Status:** Issues identified, fixes documented, ready to implement
**Next Step:** Apply Fix #1 and Fix #2, choose parquet strategy, test locally
