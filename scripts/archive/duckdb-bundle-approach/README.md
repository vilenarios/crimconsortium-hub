# Archived: Bundled DuckDB Approach

This folder contains the original implementation that bundled WASM and Parquet files directly in the app.

## Why Archived:
- 78MB bundle size (too large)
- WASM MIME type issues in preview server
- Unnecessary complexity for 3,753 articles
- Preview server required custom Express configuration

## Old Approach:
```
App Bundle (78MB)
├── JavaScript (~1MB)
├── DuckDB-WASM (72MB)
└── Parquet data (5MB)
```

## New Approach:
```
App Bundle (1MB)
    ↓ loads
External Parquet (5MB) via ArNS
    ↓ uses
External WASM (72MB) via TX ID
    ↓ fetches
Manifests (per-article) via TX ID
```

## Files Archived:
- `parquet-db.js` - Bundled parquet database loader
- `export-to-parquet-bundled.js` - Export script that copied parquet to public/
- `vite.config-bundled.js` - Vite config that bundled WASM files
- `app-bundled.js` - App that initialized bundled DuckDB

## Benefits of New Approach:
- ✅ 1MB bundle vs 78MB
- ✅ No WASM MIME type issues on Arweave
- ✅ Independent updates (data vs app)
- ✅ Better caching
- ✅ ArNS-native architecture

Archived: 2025-11-02
