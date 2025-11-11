# Upload Flow Analysis

## Current Upload Architecture

### Overview
The current system implements a **manifest-based upload architecture** where articles and their attachments are uploaded to Arweave as structured manifests, with transaction IDs tracked in the local SQLite database.

---

## Upload Flow (End-to-End)

### Phase 1: Data Import (Already Complete)
**Script:** `npm run import` → `scripts/scrape-to-sqlite.js`

1. Scrapes CrimRxiv publications via PubPub SDK
2. Downloads PDF attachments to `data/attachments/{slug}/`
3. Stores article metadata + attachments in SQLite database

**Database Schema:**
```sql
-- Articles table
CREATE TABLE articles (
  ...
  attachments_json TEXT,        -- JSON array of attachments
  manifest_tx_id TEXT,           -- Arweave manifest transaction ID
  arweave_tx_id TEXT,            -- Legacy single TX ID field
  manifest_path TEXT,            -- Local path to generated manifest
  manifest_generated INTEGER,    -- Boolean flag
  manifest_uploaded INTEGER,     -- Boolean flag
  ...
);
```

**Attachment Structure (in attachments_json):**
```json
[
  {
    "url": "https://crimrxiv.com/...",
    "filename": "article.pdf",
    "fileSize": 1234567,
    "type": "application/pdf",
    "localPath": "data/attachments/slug/article.pdf"
  }
]
```

---

### Phase 2: Manifest Generation
**Script:** `npm run generate:manifests` → `scripts/generate-manifests.js`

**What it does:**
1. Queries database for articles needing manifests: `WHERE full_content_scraped = 1 AND manifest_generated = 0`
2. For each article, creates directory structure:
   ```
   data/manifests/{slug}/
   ├── metadata.json       (article metadata WITHOUT content)
   ├── content.json        (ProseMirror document)
   └── attachments/
       ├── article.pdf
       └── supplement.csv
   ```
3. Updates database: `manifest_path`, `manifest_generated = 1`

**metadata.json structure:**
```json
{
  "article_id": "abc123",
  "slug": "article-slug",
  "title": "Article Title",
  "abstract": "...",
  "authors": [...],
  "attachments": [
    {
      "type": "application/pdf",
      "filename": "article.pdf",
      "path": "attachments/article.pdf",  // ← Relative path in manifest
      "original_url": "https://..."
    }
  ],
  "schema_version": "1.0"
}
```

---

### Phase 3: Manifest Upload to Arweave
**Script:** `npm run upload:manifests` → `scripts/upload-manifests.js`

**What it does:**

1. **For each article manifest:**
   - Upload `metadata.json` → receives `txid_metadata`
   - Upload `content.json` → receives `txid_content`
   - Upload each attachment file → receives `txid_attachment_N`

2. **Create Arweave manifest:**
   ```json
   {
     "manifest": "arweave/paths",
     "version": "0.2.0",
     "index": { "path": "metadata.json" },
     "paths": {
       "metadata.json": { "id": "txid_metadata" },
       "content.json": { "id": "txid_content" },
       "attachments/article.pdf": { "id": "txid_attachment_1" },
       "attachments/supplement.csv": { "id": "txid_attachment_2" }
     }
   }
   ```

3. **Upload manifest JSON** → receives `manifest_tx_id`

4. **Update database:**
   ```sql
   UPDATE articles
   SET manifest_tx_id = 'manifest_tx_id',
       manifest_uploaded = 1,
       manifest_uploaded_at = NOW()
   WHERE slug = 'article-slug';
   ```

**Important:** Individual attachment transaction IDs are stored in the manifest JSON on Arweave, NOT in the local database.

---

### Phase 4: Parquet Export
**Script:** `npm run export` → `scripts/export-to-parquet.js`

**What it does:**
1. Reads all latest articles from SQLite
2. Exports to `public/data/metadata.parquet` with:
   ```
   - article_id
   - slug
   - title
   - abstract
   - authors_json
   - attachments_json        ← Does NOT include Arweave txids
   - manifest_tx_id          ← DOES include manifest txid
   - arweave_tx_id
   - content_prosemirror
   - ... (all metadata fields)
   ```

**Critical:** The parquet file includes `manifest_tx_id` so articles can reference their Arweave manifest.

---

### Phase 5: App Deployment
**Script:** `npm run build` then upload `dist/` to Arweave

1. Build SPA with Vite → `dist/` folder
2. Upload `dist/` folder contents to Arweave
3. Note the app transaction ID
4. Configure ArNS domain to point to app txid

---

## Requirement Verification

### ✅ Requirement 1: Upload all article data and attachments as manifests
**Status:** IMPLEMENTED

- Articles are uploaded as structured manifests
- Each manifest includes metadata, content, and all attachments
- Manifest structure follows Arweave paths spec v0.2.0

### ✅ Requirement 2: Store resulting txid in local database
**Status:** IMPLEMENTED

- Manifest transaction ID is stored in `articles.manifest_tx_id`
- Database is updated after successful upload (line 172 of upload-manifests.js)

### ⚠️ Requirement 3: Articles should reference their own transaction ID
**Status:** PARTIALLY IMPLEMENTED

**What works:**
- Articles have `manifest_tx_id` field in database ✅
- This field is exported to parquet file ✅
- The SPA can access `manifest_tx_id` from parquet queries ✅

**What's missing:**
- Individual attachment transaction IDs are NOT stored in database
- `attachments_json` field does not include `arweave_tx_id` for each attachment
- Attachments can only be accessed via the manifest path, not directly by txid

**Impact:**
- To access an attachment, the app must:
  1. Read article's `manifest_tx_id` from parquet
  2. Construct URL: `https://arweave.net/{manifest_tx_id}/attachments/file.pdf`
  3. This works because the manifest maps paths to txids on Arweave

- You CANNOT directly access an attachment by its individual txid from the app
- Individual txids are only stored in the manifest JSON on Arweave

### ✅ Requirement 4: Parquet can be uploaded after articles
**Status:** WORKS AS DESIGNED

- Parquet export reads `manifest_tx_id` from database
- Articles must be uploaded BEFORE running `npm run export`
- The parquet file will include the manifest txids
- This is the correct order: Articles → Database Update → Parquet Export → App Upload

---

## Current Upload Order (Correct)

```
1. npm run import          # Scrape data from CrimRxiv → SQLite
2. npm run generate:manifests    # Create manifest directories
3. npm run upload:manifests      # Upload to Arweave, store manifest_tx_id in DB
4. npm run export         # SQLite → Parquet (includes manifest_tx_id)
5. npm run build          # Build SPA
6. Upload dist/ to Arweave       # Deploy app
7. Configure ArNS         # Point domain to app
```

---

## Gap Analysis

### Gap 1: Individual Attachment Transaction IDs Not in Database ⚠️

**Current State:**
- Attachment txids only exist in the manifest JSON on Arweave
- Database's `attachments_json` structure:
  ```json
  {
    "filename": "article.pdf",
    "type": "application/pdf",
    "localPath": "data/attachments/slug/article.pdf"
    // ❌ No arweave_tx_id field
  }
  ```

**Recommended Fix:**
Add `arweave_tx_id` field to attachment objects and update database after upload:

```javascript
// In upload-manifests.js after uploading files:
async uploadManifest(article) {
  // ... existing code ...

  // Build attachment txid map
  const attachmentTxIds = {};
  for (const file of files) {
    if (file.manifestPath.startsWith('attachments/')) {
      attachmentTxIds[file.filename] = file.txId;
    }
  }

  // Update database with attachment txids
  this.db.updateArticleAttachmentTxIds(article.slug, attachmentTxIds);
}
```

```javascript
// In src/lib/database.js:
updateArticleAttachmentTxIds(slug, txIdMap) {
  const article = this.db.prepare('SELECT attachments_json FROM articles WHERE slug = ?').get(slug);
  const attachments = JSON.parse(article.attachments_json || '[]');

  // Add arweave_tx_id to each attachment
  attachments.forEach(att => {
    if (txIdMap[att.filename]) {
      att.arweave_tx_id = txIdMap[att.filename];
    }
  });

  this.db.prepare('UPDATE articles SET attachments_json = ? WHERE slug = ?')
    .run(JSON.stringify(attachments), slug);
}
```

**Benefits:**
- Direct txid access for each attachment
- No need to parse manifest JSON to find attachment txids
- More flexible URL construction in the app

### Gap 2: No Validation of Upload Success ⚠️

**Current State:**
- Upload script trusts all uploads succeed
- No verification that txids are accessible on Arweave
- No retry mechanism for failed uploads

**Recommended Fix:**
Add post-upload validation:
```javascript
async validateUpload(manifestTxId) {
  const url = `https://arweave.net/${manifestTxId}`;
  const response = await axios.get(url, { timeout: 10000 });
  return response.status === 200;
}
```

### Gap 3: No Database Backup Before Upload ℹ️

**Current State:**
- Database is modified during upload
- No automatic backup created

**Recommended Fix:**
Add backup step to upload script:
```javascript
async initialize() {
  // Create backup before upload
  const backupPath = `data/sqlite/crimrxiv.db.backup-${Date.now()}`;
  await fs.copyFile(this.db.dbPath, backupPath);
  console.log(`📦 Database backed up to: ${backupPath}`);
}
```

---

## Recommendations

### Option A: Store Individual Attachment TxIDs (Recommended)

**Pros:**
- Direct access to each attachment by txid
- More flexible for future features
- Complete txid tracking in database

**Cons:**
- Requires code changes to upload script
- Need to re-upload articles to populate txids

**Implementation:**
1. Modify `upload-manifests.js` to track attachment txids
2. Add `updateArticleAttachmentTxIds()` method to database.js
3. Update parquet export to include attachment txids
4. Re-run `npm run upload:manifests` to populate txids

### Option B: Use Manifest Paths (Current Implementation)

**Pros:**
- No code changes needed
- Works right now
- Standard Arweave manifest pattern

**Cons:**
- Cannot directly link to attachment txids
- Must construct manifest paths
- Less flexible for future features

**Usage in App:**
```javascript
// Access attachment via manifest
const manifestTxId = article.manifest_tx_id;
const filename = attachment.filename;
const url = `https://arweave.net/${manifestTxId}/attachments/${filename}`;
```

---

## Conclusion

### Will Current Flow Meet Requirements? **YES, with caveats**

✅ **Articles uploaded as manifests** - Fully implemented
✅ **Transaction IDs stored in database** - Manifest txid is stored
⚠️ **Articles reference their txid** - Manifest txid works, individual attachments need manifest path
✅ **Parquet uploaded after articles** - Order is correct

### Critical Path to Production:

1. **Immediate (Works Now):**
   ```bash
   npm run import
   npm run generate:manifests
   npm run upload:manifests    # Stores manifest_tx_id
   npm run export              # Includes manifest_tx_id in parquet
   npm run build
   # Upload dist/ to Arweave
   ```

2. **Recommended (For Better Architecture):**
   - Implement Gap Fix #1 (attachment txids in database)
   - Add upload validation
   - Add database backup before uploads
   - Re-export parquet after database updates

### Next Steps:

1. Test current flow with a small batch (use `--limit=10`)
2. Verify manifest_tx_id appears in parquet file
3. Test accessing attachments via manifest paths in browser
4. Decide if individual attachment txids are needed (Option A vs B)
5. Implement chosen option and proceed with full upload

---

**Date:** 2025-11-02
**Status:** Architecture validated, ready for test uploads
**Recommended:** Implement Gap Fix #1 before production upload
