# Quick Fix for Arweave Deployment

Apply these changes to make the app work on Arweave:

## Fix #1: WASM Paths (CRITICAL)

**File:** `src/lib/parquet-db.js`

**Find (lines 61-70):**
```javascript
const MANUAL_BUNDLES = {
  mvp: {
    mainModule: '/duckdb/duckdb-mvp.wasm',
    mainWorker: '/duckdb/duckdb-browser-mvp.worker.js',
  },
  eh: {
    mainModule: '/duckdb/duckdb-eh.wasm',
    mainWorker: '/duckdb/duckdb-browser-eh.worker.js',
  },
};
```

**Replace with:**
```javascript
const MANUAL_BUNDLES = {
  mvp: {
    mainModule: './duckdb/duckdb-mvp.wasm',
    mainWorker: './duckdb/duckdb-browser-mvp.worker.js',
  },
  eh: {
    mainModule: './duckdb/duckdb-eh.wasm',
    mainWorker: './duckdb/duckdb-browser-eh.worker.js',
  },
};
```

## Fix #2: Parquet URLs (CRITICAL)

**File:** `src/lib/parquet-db.js`

**Find (lines 32-51):**
```javascript
getParquetUrls() {
  const appInfo = getAppInfo();

  if (appInfo.isLocalhost) {
    const baseUrl = `${appInfo.protocol}://${appInfo.hostname}:${window.location.port || '3005'}`;
    return {
      metadata: `${baseUrl}/data/metadata.parquet`,
      batchBase: `${baseUrl}/data/articles/`
    };
  }

  // For production on Arweave, use ArNS undername
  return {
    metadata: getDataParquetUrl('metadata.parquet'),
    batchBase: getUndernameUrl('data', '/articles/')
  };
}
```

**Replace with:**
```javascript
getParquetUrls() {
  const appInfo = getAppInfo();

  if (appInfo.isLocalhost) {
    const baseUrl = `${appInfo.protocol}://${appInfo.hostname}:${window.location.port || '3005'}`;
    return {
      metadata: `${baseUrl}/data/metadata.parquet`,
      batchBase: `${baseUrl}/data/articles/`
    };
  }

  // For production on Arweave, use relative paths (parquet in bundle)
  return {
    metadata: './data/metadata.parquet',
    batchBase: './data/articles/'
  };
}
```

## Fix #3: Asset Paths (RECOMMENDED)

**File:** `index.html`

**Line 8 - Find:**
```html
<link rel="icon" type="image/x-icon" href="/favicon.ico">
```

**Replace with:**
```html
<link rel="icon" type="image/x-icon" href="./favicon.ico">
```

**Line 242 - Find:**
```html
<img src="/crimxriv-logo.png" alt="CrimRXiv" class="site-logo" onerror="this.style.display='none'">
```

**Replace with:**
```html
<img src="./crimxriv-logo.png" alt="CrimRXiv" class="site-logo" onerror="this.style.display='none'">
```

## Test After Fixes

```bash
# 1. Build
npm run build

# 2. Preview locally
npm run preview

# 3. Open browser to http://localhost:4173
# 4. Check browser console - should see no errors
# 5. Test homepage, search, article pages
```

## Deploy to Arweave

```bash
# After testing passes:
# Upload the dist/ folder to Arweave
# You'll get a transaction ID back
# Access your app at: https://arweave.net/YOUR_TX_ID/
```

That's it! 🎉
