# CrimRXiv Parquet Architecture - Final Design

**Date:** 2025-10-26
**Status:** Approved by DB Architect
**Target:** ~30MB per Parquet file, immutable append-only

---

## Core Principle (from PATTERN_GUIDE.md)

**SQLite is the source of truth. Parquet files are read-only exports, never updated directly.**

```
Workflow:
SQLite (source of truth) → Export → Parquet (immutable snapshot) → Arweave/Query
After changes → Re-export new batch → New Parquet files (old files unchanged)
```

---

## Architecture Overview

### Data Flow

```
PubPub API
    ↓
[SQLite Database]  ← Single source of truth, tracks all versions
    ↓
[Parquet Exporter] ← Exports new/updated articles only
    ↓
[Parquet Files]    ← Immutable, partitioned by export date
    ↓
[Arweave]          ← Permanent storage
```

### Storage Structure

```
data/
├── sqlite/
│   └── crimrxiv.db                           # Source of truth (local only)
│
└── parquet/
    ├── metadata.parquet                      # Regenerated on each export (~5MB)
    │
    └── articles/
        ├── 2025-10-26_batch-001.parquet     # Initial scrape (~30MB, ~1000 articles)
        ├── 2025-10-26_batch-002.parquet     # (~30MB, ~1000 articles)
        ├── 2025-10-26_batch-003.parquet     # (~30MB, ~1000 articles)
        ├── ...                               # Continue until all 7,000 articles
        ├── 2025-11-15_batch-001.parquet     # Delta scrape (~30MB, new + updated)
        └── 2025-12-01_batch-001.parquet     # Delta scrape (~30MB)
```

**Deployed to Arweave:**
```
All parquet files deployed
Old files NEVER replaced
Only add new batch files
metadata.parquet updated (points to latest versions)
```

---

## SQLite Schema Design

### Articles Table (with Version Tracking)

```sql
CREATE TABLE articles (
  -- Primary key
  id TEXT PRIMARY KEY,                    -- Unique ID for this version

  -- Article identity
  article_id TEXT NOT NULL,               -- PubPub article ID (same across versions)
  slug TEXT NOT NULL,                     -- URL slug

  -- Version tracking
  version_number INTEGER DEFAULT 1,       -- Version number (1, 2, 3...)
  version_timestamp TEXT NOT NULL,        -- When this version was created
  is_latest_version BOOLEAN DEFAULT 1,    -- Is this the current version?

  -- Metadata
  title TEXT NOT NULL,
  description TEXT,
  abstract TEXT,
  doi TEXT,
  license TEXT,

  -- Dates
  created_at TEXT NOT NULL,               -- Article first published
  updated_at TEXT NOT NULL,               -- Article last modified
  published_at TEXT,                      -- Custom publish date

  -- Content
  content_text TEXT,
  content_json TEXT,                      -- ProseMirror JSON

  -- Authors (JSON array)
  authors_json TEXT,
  author_count INTEGER DEFAULT 0,

  -- Collections (JSON array)
  collections_json TEXT,
  collection_count INTEGER DEFAULT 0,

  -- Keywords
  keywords_json TEXT,                     -- JSON array

  -- URLs
  url TEXT,
  pdf_url TEXT,

  -- Export tracking
  exported BOOLEAN DEFAULT 0,              -- Has been exported to Parquet?
  export_batch TEXT,                       -- Which batch file contains this?
  export_date TEXT,                        -- When exported?

  -- Arweave tracking
  arweave_tx_id TEXT,                      -- Transaction ID after upload

  -- Timestamps
  scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_checked TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_articles_article_id ON articles(article_id);
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_version ON articles(article_id, version_number);
CREATE INDEX idx_articles_latest ON articles(is_latest_version);
CREATE INDEX idx_articles_exported ON articles(exported);
CREATE INDEX idx_articles_export_batch ON articles(export_batch);
CREATE INDEX idx_articles_scraped ON articles(scraped_at);
```

### Export Batches Table

```sql
CREATE TABLE export_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_name TEXT UNIQUE NOT NULL,        -- e.g., "2025-10-26_batch-001"
  export_date TEXT NOT NULL,
  article_count INTEGER DEFAULT 0,
  file_path TEXT,                         -- Path to Parquet file
  file_size_bytes INTEGER,
  file_size_mb REAL,
  arweave_tx_id TEXT,                     -- Transaction ID after upload
  uploaded_at TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Version Handling Strategy

### Scenario 1: New Article

```
PubPub: New article "foo" published
SQLite: INSERT with version_number=1, is_latest_version=1
Export: Include in next batch (e.g., 2025-11-15_batch-001.parquet)
```

### Scenario 2: Article Updated (New Version)

```
PubPub: Article "foo" updated (new version)

SQLite:
  1. UPDATE old row: SET is_latest_version=0
  2. INSERT new row: version_number=2, is_latest_version=1, exported=0

Export:
  - New version included in next batch (e.g., 2025-11-15_batch-001.parquet)
  - Old version stays in old batch (2025-10-26_batch-001.parquet)
  - Both versions permanently archived on Arweave

metadata.parquet:
  - Points to batch file containing latest version
  - Has flag: has_multiple_versions=true
```

### Scenario 3: Query Latest Version

```sql
-- Get all latest versions
SELECT * FROM articles
WHERE is_latest_version = 1
ORDER BY published_at DESC;

-- Get version history for article
SELECT version_number, version_timestamp, title, export_batch
FROM articles
WHERE article_id = 'abc123'
ORDER BY version_number DESC;
```

---

## Parquet Export Strategy

### metadata.parquet (Always Regenerated)

**Generated from SQLite every export cycle:**

```sql
SELECT
  article_id,
  slug,
  title,
  description,
  abstract,  -- First 500 chars or full if short
  authors_json,
  author_count,
  keywords_json,
  collections_json,
  collection_count,
  doi,
  created_at,
  updated_at,
  published_at,
  url,

  -- Version info
  version_number,
  version_timestamp,
  has_multiple_versions,  -- Derived: COUNT(DISTINCT version_number) > 1

  -- Pointer to article data
  export_batch,           -- Which file has full data?
  arweave_tx_id           -- Transaction ID of that file

FROM articles
WHERE is_latest_version = 1  -- Only latest versions
ORDER BY published_at DESC;
```

**Schema:**
```typescript
{
  article_id: string,
  slug: string,
  title: string,
  description: string,
  abstract: string,           // Preview
  authors_json: string,       // Serialized for now
  author_count: int32,
  keywords_json: string,
  collections_json: string,
  collection_count: int32,
  doi: string (nullable),
  created_at: timestamp,
  updated_at: timestamp,
  published_at: timestamp,
  url: string,
  version_number: int32,
  version_timestamp: timestamp,
  has_multiple_versions: boolean,
  export_batch: string,       // "2025-10-26_batch-001"
  arweave_tx_id: string       // Transaction ID
}
```

### articles/DATE_batch-NNN.parquet (Immutable Batches)

**Export only new/updated articles:**

```sql
SELECT
  id,
  article_id,
  slug,
  version_number,
  version_timestamp,
  is_latest_version,
  title,
  description,
  abstract,           -- Full abstract
  content_text,       -- Full article text
  content_json,       -- ProseMirror JSON
  authors_json,
  author_count,
  collections_json,
  collection_count,
  keywords_json,
  doi,
  license,
  created_at,
  updated_at,
  published_at,
  url,
  pdf_url,
  scraped_at

FROM articles
WHERE exported = 0          -- Not yet exported
ORDER BY published_at DESC
LIMIT ?;                    -- Target ~1000 articles per batch
```

**After export:**
```sql
UPDATE articles
SET
  exported = 1,
  export_batch = '2025-10-26_batch-001',
  export_date = CURRENT_TIMESTAMP
WHERE id IN (exported_ids);
```

---

## Batching Strategy for ~30MB Files

### Calculation

- **Target:** ~30MB per file
- **Average article:** ~30KB (with full content)
- **Articles per batch:** ~30MB / 30KB = **~1000 articles**

### Batch Naming Convention

```
{export_date}_batch-{number}.parquet

Examples:
2025-10-26_batch-001.parquet  (articles 0-999)
2025-10-26_batch-002.parquet  (articles 1000-1999)
2025-10-26_batch-003.parquet  (articles 2000-2999)
```

### Initial Export (7,000 articles)

```
2025-10-26_batch-001.parquet  (~30MB, 1000 articles)
2025-10-26_batch-002.parquet  (~30MB, 1000 articles)
2025-10-26_batch-003.parquet  (~30MB, 1000 articles)
2025-10-26_batch-004.parquet  (~30MB, 1000 articles)
2025-10-26_batch-005.parquet  (~30MB, 1000 articles)
2025-10-26_batch-006.parquet  (~30MB, 1000 articles)
2025-10-26_batch-007.parquet  (~30MB, 1000 articles)

Total: ~210MB for full dataset
```

### Delta Export (Monthly Update)

```
New articles: 50
Updated articles (new versions): 20
Total to export: 70 articles

2025-11-15_batch-001.parquet  (~2MB, 70 articles)
```

---

## Browser Loading Strategy

### Homepage Load

```javascript
// 1. Load metadata.parquet (~5MB)
await db.registerFileURL('metadata.parquet', metadataUrl);

// 2. Query for homepage
const recent = await db.query(`
  SELECT slug, title, authors_json, abstract, published_at, export_batch
  FROM 'metadata.parquet'
  ORDER BY published_at DESC
  LIMIT 25
`);

// Display results
// No need to load article batches yet
```

### Article Page Load

```javascript
// 1. Get article metadata (already loaded)
const metadata = await db.query(`
  SELECT export_batch, arweave_tx_id
  FROM 'metadata.parquet'
  WHERE slug = '${slug}'
`);

// 2. Load specific batch file
const batchUrl = `${arweaveBase}/articles/${metadata.export_batch}.parquet`;
await db.registerFileURL('article_batch.parquet', batchUrl);

// 3. Query for full article
const article = await db.query(`
  SELECT *
  FROM 'article_batch.parquet'
  WHERE slug = '${slug}'
`);

// Display full article
```

**Cache Strategy:**
- metadata.parquet: Cached indefinitely (updated via ArNS)
- Batch files: Cached indefinitely (immutable)
- Browser only downloads batches when needed

---

## Scraper Implementation

### Phase 1: Scrape to SQLite

```javascript
class CrimRXivScraper {
  async scrapeAll() {
    // 1. Fetch from PubPub API
    const publications = await this.getAllPublications();

    // 2. Store in SQLite
    for (const pub of publications) {
      await this.upsertArticle(pub);
    }
  }

  async upsertArticle(pub) {
    // Check if article exists
    const existing = await db.get(
      'SELECT * FROM articles WHERE article_id = ? ORDER BY version_number DESC LIMIT 1',
      [pub.id]
    );

    // Determine if this is a new version
    const isNewVersion = existing &&
      (existing.updated_at !== pub.updatedAt ||
       existing.content_json !== JSON.stringify(pub.content));

    if (isNewVersion) {
      // Mark old version as not latest
      await db.run(
        'UPDATE articles SET is_latest_version = 0 WHERE article_id = ?',
        [pub.id]
      );

      // Insert new version
      await db.run(`
        INSERT INTO articles (
          id, article_id, slug, version_number, version_timestamp,
          is_latest_version, title, description, ...
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ...)
      `, [
        generateVersionId(pub.id),
        pub.id,
        pub.slug,
        existing.version_number + 1,
        pub.updatedAt,
        1,  // is_latest_version
        pub.title,
        pub.description,
        // ... rest of fields
      ]);
    } else {
      // First version or no changes
      await db.run(`
        INSERT OR REPLACE INTO articles (...)
        VALUES (...)
      `);
    }
  }
}
```

### Phase 2: Export to Parquet

```javascript
class ParquetExporter {
  async exportNewBatches() {
    // 1. Get unexported articles
    const unexported = await db.all(`
      SELECT COUNT(*) as count FROM articles WHERE exported = 0
    `);

    if (unexported.count === 0) {
      console.log('No new articles to export');
      return [];
    }

    // 2. Calculate number of batches needed
    const articlesPerBatch = 1000;
    const batchCount = Math.ceil(unexported.count / articlesPerBatch);
    const exportDate = new Date().toISOString().split('T')[0];

    const batches = [];

    // 3. Export each batch
    for (let i = 0; i < batchCount; i++) {
      const batchName = `${exportDate}_batch-${String(i + 1).padStart(3, '0')}`;
      const articles = await db.all(`
        SELECT * FROM articles
        WHERE exported = 0
        ORDER BY published_at DESC
        LIMIT ?
      `, [articlesPerBatch]);

      // 4. Write to Parquet using DuckDB
      const outputPath = `data/parquet/articles/${batchName}.parquet`;
      await this.writeParquetBatch(articles, outputPath);

      // 5. Update database
      await db.run(`
        UPDATE articles
        SET exported = 1, export_batch = ?, export_date = ?
        WHERE id IN (${articles.map(a => `'${a.id}'`).join(',')})
      `, [batchName, new Date().toISOString()]);

      // 6. Record batch
      const stats = await fs.stat(outputPath);
      await db.run(`
        INSERT INTO export_batches (
          batch_name, export_date, article_count, file_path,
          file_size_bytes, file_size_mb
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        batchName,
        new Date().toISOString(),
        articles.length,
        outputPath,
        stats.size,
        (stats.size / 1024 / 1024).toFixed(2)
      ]);

      batches.push({ batchName, articleCount: articles.length, sizeMB: (stats.size / 1024 / 1024).toFixed(2) });
    }

    // 7. Always regenerate metadata.parquet
    await this.exportMetadata();

    return batches;
  }

  async exportMetadata() {
    const latestArticles = await db.all(`
      SELECT
        article_id,
        slug,
        title,
        description,
        SUBSTR(description, 1, 500) as abstract,
        authors_json,
        author_count,
        keywords_json,
        collections_json,
        collection_count,
        doi,
        created_at,
        updated_at,
        published_at,
        url,
        version_number,
        version_timestamp,
        CASE
          WHEN (SELECT COUNT(DISTINCT version_number) FROM articles a2 WHERE a2.article_id = articles.article_id) > 1
          THEN 1 ELSE 0
        END as has_multiple_versions,
        export_batch,
        arweave_tx_id
      FROM articles
      WHERE is_latest_version = 1
      ORDER BY published_at DESC
    `);

    await this.writeParquetFile(latestArticles, 'data/parquet/metadata.parquet');
  }
}
```

---

## Deployment Workflow

### Initial Deployment

```bash
# 1. Scrape all publications
npm run scrape

# 2. Export to Parquet batches
npm run export

# 3. Upload to Arweave (batches stay immutable)
npm run deploy

# 4. Update ArNS to point to new metadata.parquet
# (Automatic with deploy script)
```

### Incremental Update (Monthly)

```bash
# 1. Scrape (incremental - only new/changed)
npm run scrape --incremental

# 2. Export new batch
npm run export  # Only creates new batches for unexported articles

# 3. Upload new batch files only
npm run deploy  # Only uploads new files

# 4. Upload updated metadata.parquet
# (Points to all batches including new ones)
```

**Result:**
- Old batch files unchanged (still on Arweave)
- New batch file added (new transaction)
- metadata.parquet updated (new transaction)
- ArNS points to new metadata
- Frontend seamlessly uses new metadata + new batches

---

## Query Patterns

### Get All Latest Articles

```sql
SELECT * FROM 'metadata.parquet'
ORDER BY published_at DESC;
```

### Search by Keyword

```sql
SELECT * FROM 'metadata.parquet'
WHERE keywords_json LIKE '%criminology%'
ORDER BY published_at DESC;
```

### Filter by Date Range

```sql
SELECT * FROM 'metadata.parquet'
WHERE published_at BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY published_at DESC;
```

### Get Article Version History

```sql
-- Need to query all relevant batch files
-- metadata.parquet only has latest version
-- Must query specific batches to get old versions
```

---

## Advantages of This Approach

✅ **Immutable Files**
- Old batches never change
- Can trust Arweave content addressing
- No need to re-upload existing data

✅ **Incremental Growth**
- Add new batches monthly
- Don't disturb old batches
- Linear cost scaling

✅ **Version Tracking**
- All versions preserved forever
- Can query version history
- Researchers can cite specific versions

✅ **Optimal File Sizes**
- ~30MB per batch (architect's recommendation)
- Good for browser caching
- Good for range requests

✅ **SQLite as Source of Truth**
- Full query power during development
- Easy to regenerate Parquet
- Can fix issues without reprocessing

✅ **Browser Performance**
- Load small metadata first
- Load batches on demand
- Cache batches indefinitely

---

## File Size Estimates

| Item | Size | Notes |
|------|------|-------|
| metadata.parquet | ~5MB | 7,000 articles × ~700 bytes |
| Each batch file | ~30MB | ~1000 articles × 30KB |
| Initial deployment | ~210MB | 7 batch files |
| Monthly update | ~2-5MB | 70-150 new/updated articles |
| SQLite database | ~150MB | Includes all versions, local only |

**Arweave Cost (Initial):**
- ~210MB × $0.01/MB = ~$2.10 one-time
- Metadata updates: ~$0.05 each (monthly)

---

## Implementation Priority

1. ✅ **Design SQLite schema** (above)
2. **Update scraper** to use SQLite with version tracking
3. **Build Parquet exporter** with batch logic
4. **Test with 100 articles** (verify batch sizing)
5. **Full scrape** (7,000 articles)
6. **Export initial batches** (~7 files)
7. **Deploy to Arweave**
8. **Test browser loading** (metadata + batch)
9. **Run incremental scrape** (next month)
10. **Verify immutability** (old batches unchanged)

---

## Next Steps

Ready to implement:
1. Create SQLite schema
2. Update scraper to write to SQLite
3. Build Parquet exporter with batching
4. Test end-to-end with small dataset

Should I proceed with implementation?
