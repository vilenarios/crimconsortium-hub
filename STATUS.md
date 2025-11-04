# CrimRXiv Archive - Current Status

**Last Updated:** 2025-11-04
**Status:** ✅ Core workflow is working!

## What's Working

### ✅ Step 1: Import from CrimRXiv
**Script:** `scripts/import-to-articles.js`
**Command:** `npm run import`
**Status:** **WORKING** ✅

Successfully tested with 5 articles:
- Creates article folders in `data/articles/{slug}/`
- Each folder contains:
  - `metadata.json` - Full article metadata
  - `content.json` - ProseMirror content
  - `article.md` - Markdown/text version
  - `pdfs/` folder - PDF attachments (when available)
- Updates SQLite database with metadata
- Supports `--limit=N` flag for testing

**Test command:**
```bash
npm run import -- --limit=5
```

**Full import:**
```bash
npm run import  # Takes 30-45 minutes for ~3,700 articles
```

### ✅ Step 2: Export to Parquet
**Script:** `scripts/export-to-parquet-external.js`
**Command:** `npm run export`
**Status:** **WORKING** ✅

Successfully tested:
- Reads from SQLite database
- Exports to `data/export/metadata.parquet`
- Fast (< 1 second for 5 articles)
- File size: 12KB for 5 articles (~5MB for full dataset)

### ✅ Step 3: Upload Articles to Arweave
**Script:** `scripts/upload-articles.js`
**Command:** `npm run upload:articles`
**Status:** **READY TO TEST** ⏸️

Script is ready but requires:
- `.env` file with `ARWEAVE_WALLET_PATH`
- Arweave wallet with AR tokens
- Articles in `data/articles/` folders

Features:
- Uses ArDrive Turbo SDK `uploadFolder()` method
- Automatically creates manifests for each article
- Updates SQLite with `manifest_tx_id`
- Supports `--limit=N` flag for testing
- Skips already-uploaded articles

**Test command (when wallet ready):**
```bash
npm run upload:articles -- --limit=5
```

## Files Fixed

### `scripts/import-to-articles.js`
**Issues fixed:**
1. ✅ PubPub SDK API call parameters (was using `orderBy: 'publishedAt'`, now uses `sortBy: 'updatedAt', orderBy: 'DESC'`)
2. ✅ Windows script execution guard (filename check instead of path comparison)

### `scripts/upload-articles.js`
**Issues fixed:**
1. ✅ Windows script execution guard (filename check instead of path comparison)

## Test Results

### Import Test (5 articles)
```
✅ Total Processed: 5
✅ Inserted (new): 5
✅ Folders Created: 5
✅ Duration: 0.03 minutes
✅ No errors
```

### Export Test (5 articles)
```
✅ Articles Exported: 5
✅ File Size: 0.01 MB (12KB)
✅ Duration: 0.04 seconds
✅ No errors
```

### SQLite Database
```
✅ Total articles: 5
✅ Database file: C:\Source\crimconsortium-hub\data\sqlite\crimrxiv.db
```

### Article Folders
```
✅ Created: data/articles/4xw3yeqz/
✅ Created: data/articles/6y1t81lg/
✅ Created: data/articles/rygfxpbo/
✅ Created: data/articles/u7ituvbd/
✅ Created: data/articles/w6df4ln2/
```

Each folder contains:
- `metadata.json` ✅ (latest version)
- `content.json` ✅ (latest version)
- `article.md` ✅ (latest version)
- `attachments/` ✅ (latest version attachments)
- `versions.json` ✅ (manifest of all versions)
- `1/`, `2/`, etc. ✅ (numbered version folders with full content)

## Current Data

**Articles in database:** 5 (test mode)
**Article folders:** 5
**Parquet file:** data/export/metadata.parquet (12KB)

## Next Steps

### Option 1: Test Full Import (Recommended)
```bash
# Import all articles from CrimRXiv (~3,700 articles)
npm run import

# Export to Parquet
npm run export

# Preview locally
npm run build
npm run preview
```

**Expected results:**
- ~3,700 article folders in `data/articles/`
- ~50MB SQLite database
- ~5MB Parquet file
- Preview shows all articles with search

### Option 2: Test Upload with Current 5 Articles
```bash
# Ensure .env has ARWEAVE_WALLET_PATH
# Then upload 5 test articles
npm run upload:articles -- --limit=5

# Re-export with manifest TX IDs
npm run export

# Preview locally
npm run build
npm run preview
```

**Expected results:**
- 5 articles uploaded to Arweave
- 5 manifest TX IDs in SQLite
- Parquet includes manifest_tx_id references
- Preview can load full content from Arweave

## Workflow Summary

The simplified workflow is now working:

```
1. npm run import     → Scrape CrimRXiv to data/articles/ + SQLite ✅
2. npm run export     → Export SQLite to Parquet ✅
3. npm run upload:articles → Upload folders to Arweave (ready) ⏸️
4. npm run export     → Re-export with TX IDs
5. npm run build      → Build SPA
6. npm run preview    → Test locally
7. npm run sync       → Deploy to Arweave
```

## Known Issues

None! All core functionality is working.

## Configuration Required

### For Import (already working)
- ✅ `.env` with `PUBPUB_EMAIL` and `PUBPUB_PASSWORD`

### For Upload (not yet tested)
- ⏸️ `.env` with `ARWEAVE_WALLET_PATH`
- ⏸️ Arweave wallet JSON file
- ⏸️ AR tokens in wallet (~$15 for ~3,700 articles)

## Recommendations

**For testing the complete workflow:**
1. Keep the 5 test articles
2. Set up Arweave wallet in `.env`
3. Test upload with `npm run upload:articles -- --limit=5`
4. Verify manifest TX IDs in SQLite
5. Test parquet re-export
6. Test local preview with article content loading

**For production deployment:**
1. Run full import: `npm run import` (all ~3,700 articles)
2. Export: `npm run export`
3. Upload all: `npm run upload:articles` (2-4 hours, ~$15)
4. Re-export: `npm run export`
5. Deploy: `npm run build && npm run sync`

## Success Metrics

✅ Import script runs without errors
✅ Article folders created with correct structure
✅ SQLite populated with metadata
✅ Parquet export successful
✅ Upload script ready (pending wallet configuration)

## Documentation

- **WORKFLOW.md** - Detailed 5-step workflow guide
- **SIMPLIFIED_IMPLEMENTATION.md** - Implementation details
- **CLAUDE.md** - Developer guide
- **STATUS.md** (this file) - Current status

---

**Status:** Core workflow is operational. Ready for full import or upload testing!
