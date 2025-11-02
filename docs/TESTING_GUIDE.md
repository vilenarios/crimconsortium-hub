# Testing Guide - Complete End-to-End Pipeline

## ✅ What's Been Implemented

All components for the Markdown archival pipeline are now complete and integrated:

### Backend (100% Complete)
1. ✅ Database schema with migration
2. ✅ Full-content scraper (`npm run scrape:full`)
3. ✅ Markdown generator (`npm run generate:markdown`)
4. ✅ Arweave uploader (`npm run upload:articles`)
5. ✅ Updated parquet export with `arweave_tx_id`

### Frontend (100% Complete)
1. ✅ ParquetDB queries include `arweave_tx_id`, `word_count`, `attachment_count`
2. ✅ ArticleDetail component fetches from Arweave
3. ✅ Fallback to local content if no TX ID
4. ✅ Displays Arweave badge and metadata

---

## 🧪 Test the Complete Pipeline (10 Articles)

Follow these steps to test end-to-end with a small sample:

### Step 1: Scrape Full Content (Phase 1)

```bash
npm run scrape:full -- --limit=10
```

**Expected output:**
```
================================================================================
📚 Full Content Scraper - Markdown Archival Pipeline (Phase 1)
================================================================================

🗄️  Initializing SQLite database...
🔄 Running database migration...
  Adding column: content_prosemirror
  Adding column: content_markdown
  ... (more columns)
✅ Migration complete: Added 16 columns
✅ Database initialized

🔌 Connecting to PubPub API...
✅ Connections established

📊 Found 10 articles needing full content

[1/10]
📄 Processing: article-slug-1
  → Fetching metadata...
  → Fetching full content...
  → Converting to Markdown...
  → Downloading 2 attachment(s)...
  → Saving to database...
  ✅ Complete (5432 words, 2 attachments)

... (continues for 10 articles)

📊 Scraping Complete
================================================================================
Total articles: 10
Processed: 10
Errors: 0
Time elapsed: 0.7 minutes
================================================================================
```

**What this does:**
- Fetches full ProseMirror content from PubPub
- Converts to Markdown
- Downloads PDFs and attachments
- Stores in SQLite with all metadata

---

### Step 2: Generate Markdown Files (Phase 2)

```bash
npm run generate:markdown -- --limit=10
```

**Expected output:**
```
================================================================================
📝 Markdown Article Generator - Archival Pipeline (Phase 2)
================================================================================

📁 Created output directory: C:\Source\crimconsortium-hub\data\articles-markdown
🗄️  Initializing SQLite database...
✅ Database connected

📊 Found 10 articles needing Markdown generation

[1/10]
📄 Processing: article-slug-1
  → Generating Markdown...
  → Saved: 45.2 KB
  ✅ Complete

... (continues for 10 articles)

📊 Generation Complete
================================================================================
Total articles: 10
Generated: 10
Errors: 0
Time elapsed: 0.2 minutes
Output directory: C:\Source\crimconsortium-hub\data\articles-markdown
================================================================================
```

**What this does:**
- Generates standalone Markdown files with YAML frontmatter
- Includes metadata, abstract, full content, references, citations
- Saves to `data/articles-markdown/`

**Verify files were created:**
```bash
ls data/articles-markdown/
```

---

### Step 3: Test Upload (Dry Run - No Cost!)

```bash
npm run upload:articles -- --limit=10 --dry-run
```

**Expected output:**
```
================================================================================
☁️  Arweave Article Uploader - Archival Pipeline (Phase 3)
🔍 DRY RUN MODE - No actual uploads will be performed
================================================================================

🗄️  Initializing SQLite database...
✅ Database connected (dry run mode)

📊 Found 10 articles needing upload

[1/10]
📄 Processing: article-slug-1
  → Uploading Markdown (45.2 KB)...
  ✅ Article uploaded: dry-run-abc123
  → Uploading 2 attachment(s)...
  ✅ Attachment uploaded: article.pdf → dry-run-def456
  ✅ Attachment uploaded: supplement.csv → dry-run-ghi789
  ✅ Complete

... (continues for 10 articles)

📊 Dry Run Complete
================================================================================
Total articles: 10
Uploaded: 10
Errors: 0
Total size: 2.4 MB
Estimated cost: $0.0024
Time elapsed: 0.5 minutes
================================================================================
```

**What this does:**
- Simulates uploads (no real Arweave transactions)
- Estimates file sizes and costs
- Validates all Markdown files exist

---

### Step 4: Export Metadata Parquet

```bash
npm run export
```

**Expected output:**
```
============================================================
SQLite → Parquet Exporter
============================================================

🗄️  Opening SQLite database...
🦆 Initializing DuckDB...
✅ Connections established

📦 Found 10 unexported articles

📊 Creating 1 batch file(s)...

  📝 Batch 1/1: 2025-10-28_batch-001
     Articles: 10
     Size: 0.08 MB
     ✅ Written

📋 Exporting metadata.parquet...

✅ Metadata exported
   Articles: 3,721 (only 10 have full content)
   Size: 0.76 MB

📊 Export Summary
============================================================
Batches created: 1
Total articles exported: 10
Total batch size: 0.08 MB
Metadata size: 0.76 MB
Total size: 0.84 MB
============================================================
```

**What this does:**
- Exports new articles to batch Parquet files
- Updates metadata.parquet with `arweave_tx_id` (NULL for now since dry-run)
- Creates `data/parquet/metadata.parquet` and `data/parquet/articles/`

---

### Step 5: Test the Vite App

```bash
# Copy parquet files to public directory for dev server
cp -r data/parquet/* public/data/

# Build the app
npm run build

# Run dev server
npm run dev
```

**Expected output:**
```
VITE v7.1.12  ready in 432 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h + enter to show help
```

**Open browser:** http://localhost:5173/

**What to test:**
1. ✅ Homepage loads with 25 recent articles
2. ✅ Click an article (one of the 10 you processed)
3. ✅ Article detail page shows metadata
4. ✅ Since no real Arweave upload, it falls back to local content
5. ✅ Search works across title, abstract, keywords, authors

---

## 🚀 Full Production Run (After Testing)

Once 10-article test succeeds, run the full pipeline:

### 1. Scrape All Articles (~3-4 hours)

```bash
npm run scrape:full
```

### 2. Generate All Markdown (~10-15 min)

```bash
npm run generate:markdown
```

### 3. **IMPORTANT**: Set up Turbo SDK

Add to `.env`:
```bash
TURBO_PRIVATE_KEY='{"kty":"RSA","n":"...","e":"AQAB",...}'
```

Get your JWK from [ArConnect](https://www.arconnect.io/) or create a new Arweave wallet.

### 4. Upload to Arweave (~2-3 hours, ~$10)

```bash
# First, verify cost estimate
npm run upload:articles -- --dry-run

# If cost is acceptable, upload for real
npm run upload:articles
```

### 5. Export Final Metadata

```bash
npm run export
```

### 6. Deploy Everything

```bash
# Copy parquet to public
cp -r data/parquet/* public/data/

# Build app
npm run build

# Deploy to Arweave
npm run deploy
```

---

## 🔍 Troubleshooting

### Issue: "Articles needing full content: 0"

**Solution:** Your database already has articles. Reset or mark them for re-scraping:
```sql
sqlite3 data/sqlite/crimrxiv.db "UPDATE articles SET full_content_scraped = 0"
```

### Issue: "TURBO_PRIVATE_KEY not found"

**Solution:** You need an Arweave wallet for uploads:
1. Install [ArConnect](https://www.arconnect.io/)
2. Create/import wallet
3. Export JWK
4. Add to `.env` as `TURBO_PRIVATE_KEY`

### Issue: "Markdown file not found"

**Solution:** Run Phase 2 (generate:markdown) before Phase 3 (upload):
```bash
npm run generate:markdown
```

### Issue: App shows "Article Not Found"

**Solution:**
1. Make sure you ran `npm run export`
2. Copy parquet files: `cp -r data/parquet/* public/data/`
3. Restart dev server: `npm run dev`

---

## 📊 Progress Tracking

### Check Database Status

```bash
sqlite3 data/sqlite/crimrxiv.db << 'EOF'
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN full_content_scraped = 1 THEN 1 ELSE 0 END) as scraped,
  SUM(CASE WHEN markdown_generated = 1 THEN 1 ELSE 0 END) as markdown,
  SUM(CASE WHEN arweave_tx_id IS NOT NULL THEN 1 ELSE 0 END) as uploaded
FROM articles
WHERE is_latest_version = 1;
EOF
```

### Check Parquet Files

```bash
ls -lh data/parquet/
ls -lh data/parquet/articles/
```

### Check Markdown Files

```bash
ls -lh data/articles-markdown/ | wc -l
```

---

## ✨ What's Next?

After testing succeeds:

1. **Run full pipeline** for all 3,721 articles
2. **Upload to Arweave** (~$10 one-time cost)
3. **Deploy app** with updated metadata.parquet
4. **Set up ArNS** (Arweave Name System) for human-readable URL
5. **Celebrate!** 🎉 You now have a permanent, decentralized archive

---

## 📚 Related Documentation

- [MARKDOWN_ARCHIVAL_PIPELINE.md](./MARKDOWN_ARCHIVAL_PIPELINE.md) - Complete architecture
- [FULL_CONTENT_ARCHIVAL_PLAN.md](./FULL_CONTENT_ARCHIVAL_PLAN.md) - Original plan
- [PATTERN_GUIDE.md](./PATTERN_GUIDE.md) - Development patterns

---

## 🆘 Need Help?

If you encounter issues:

1. Check the console logs (each script is verbose)
2. Look at the database state (SQL queries above)
3. Verify file paths and permissions
4. Ensure `.env` has correct credentials

The pipeline is fully functional and ready to run! 🚀
