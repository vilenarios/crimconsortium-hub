# Parquet Architecture Options for CrimRXiv Static Site

**Date:** 2025-10-26
**Status:** Awaiting DB Architect Review
**Context:** Static site deployed to Arweave with ~7,000 publications, expecting growth to 10,000+

---

## Executive Summary

We need to decide on a Parquet storage architecture that balances:
- **Initial page load performance** (homepage should not download full dataset)
- **Article page performance** (on-demand loading)
- **File management complexity** (deployment, caching, versioning)
- **Query performance** (DuckDB-WASM in browser)
- **Arweave cost optimization** (content addressing, bandwidth)

Two viable approaches have been identified, each with different trade-offs.

---

## Option 1: Partitioned Parquet Architecture

### Structure

```
data/
├── metadata.parquet                    # ~3-8 MB
└── articles/
    ├── 4n2y7u8a.parquet               # ~5-20 KB
    ├── 1yynad7d.parquet               # ~5-20 KB
    ├── p3tpbg5u.parquet               # ~5-20 KB
    └── ... (~7,000 individual files)
```

### Schema Design

**`metadata.parquet`** (Single file, all articles):
```
Columns:
- id: string
- slug: string
- title: string
- authors_json: string (serialized array)
- abstract_preview: string (first 500 chars)
- keywords: list<string>
- doi: string (nullable)
- created_at: timestamp
- published_at: timestamp
- author_count: int32
- collection_names: list<string>
```

**`articles/{slug}.parquet`** (One per article):
```
Columns:
- id: string
- slug: string
- title: string
- abstract: string (full)
- content_text: string (full article text)
- content_json: string (ProseMirror JSON)
- authors_json: string (full author details with ORCID, affiliations)
- collections_json: string
- metadata_json: string (additional fields)
- pdf_url: string
- license: string
```

### Loading Flow

**Homepage Load:**
```javascript
// Single request: metadata.parquet (~5 MB)
const db = await DuckDB.create();
await db.registerFileURL('metadata.parquet', arweaveUrl);

const recent = await db.query(`
  SELECT slug, title, authors_json, abstract_preview, created_at
  FROM 'metadata.parquet'
  ORDER BY created_at DESC
  LIMIT 25
`);
```

**Article Page Load:**
```javascript
// Single request: articles/{slug}.parquet (~10 KB)
const articleUrl = `${arweaveBase}/articles/${slug}.parquet`;
await db.registerFileURL('article.parquet', articleUrl);

const article = await db.query(`
  SELECT * FROM 'article.parquet'
`);
```

### Pros

✅ **Web Performance Best Practice**
- Homepage: 5 MB initial load, then cached indefinitely
- Article pages: Only 10 KB per article
- Users only download content they actually view
- Optimal for page speed metrics (Core Web Vitals)

✅ **Browser Caching Efficiency**
- Each article URL is unique and cacheable
- Viewed articles stay in cache
- Metadata updates don't invalidate article cache

✅ **Pure Parquet Format**
- All data in Parquet as required
- Standard tooling works (DuckDB, Arrow, pandas)
- No custom range-request parsing needed

✅ **Arweave Content Addressing**
- Each file gets unique transaction ID
- Immutable content with cryptographic verification
- Partial site updates possible (update changed articles only)

✅ **Scalability**
- 10,000 articles? No problem
- 100,000 articles? Still works fine
- Linear scaling: O(1) load per article view

✅ **Partial Publishing**
- Update one article = republish one ~10KB file
- Don't need to regenerate/reupload entire dataset
- Cost-efficient for incremental updates

✅ **Operational Simplicity**
- Clear mental model: one file = one article
- Easy to debug (inspect individual files)
- Simple to rebuild (regenerate changed articles only)

### Cons

❌ **File Count**
- 7,001 files to deploy (1 metadata + 7,000 articles)
- Arweave manifest will be large (~1-2 MB for manifest alone)
- More complex deployment pipeline

❌ **Potential Gateway Issues**
- Some CDNs charge per file request
- Manifest parsing overhead
- Directory listing not possible on Arweave

❌ **Storage Overhead**
- Parquet file headers repeated 7,000 times
- Some metadata duplication across files
- Footer overhead per file (~1-2 KB × 7,000 = ~7-14 MB)

❌ **Write Performance**
- Scraper must write 7,000+ files
- Slower during data collection phase
- Filesystem operations may be slow on some systems

❌ **Cold Start**
- First article view requires new HTTP request
- No benefit from prefetching
- Could be mitigated with service worker prefetch

### Implementation Complexity

**Scraper Changes:**
- Medium complexity
- Loop through articles, write individual Parquet files
- Aggregate metadata separately

**Frontend Changes:**
- Low complexity
- Simple DuckDB-WASM queries
- Standard HTTP fetch for article files

**Deployment Changes:**
- Medium complexity
- Need to generate Arweave manifest for 7,000+ files
- More ArDrive uploads

---

## Option 2: Dual Parquet with Row-Group Range Requests

### Structure

```
data/
├── metadata.parquet        # ~3-8 MB
└── articles.parquet        # ~30-50 MB (1 row group per article)
```

### Schema Design

**`metadata.parquet`** (All articles, lightweight):
```
Columns:
- id: string
- slug: string
- title: string
- authors_json: string
- abstract_preview: string (first 500 chars)
- keywords: list<string>
- doi: string
- created_at: timestamp
- published_at: timestamp
- author_count: int32
- collection_names: list<string>
- row_group_id: int32          # Key: row group in articles.parquet
- byte_offset_start: int64     # Key: byte range start
- byte_offset_end: int64       # Key: byte range end
```

**`articles.parquet`** (All articles, full content):
```
Parquet Configuration:
- Row Group Size: 1 article per row group
- Compression: Snappy or ZSTD
- Row Group Count: ~7,000

Columns (same as Option 1 article schema):
- id, slug, title, abstract, content_text, content_json, etc.
```

### Loading Flow

**Homepage Load:**
```javascript
// Single request: metadata.parquet (~5 MB)
const db = await DuckDB.create();
await db.registerFileURL('metadata.parquet', metadataUrl);

const recent = await db.query(`
  SELECT slug, title, authors_json, abstract_preview, created_at
  FROM 'metadata.parquet'
  ORDER BY created_at DESC
  LIMIT 25
`);
```

**Article Page Load:**
```javascript
// 1. Query metadata for byte range (in-memory, no network)
const range = await db.query(`
  SELECT byte_offset_start, byte_offset_end
  FROM 'metadata.parquet'
  WHERE slug = '4n2y7u8a'
`);

// 2. Range request to articles.parquet (~10-20 KB)
const response = await fetch(articlesUrl, {
  headers: {
    'Range': `bytes=${range.byte_offset_start}-${range.byte_offset_end}`
  }
});

// 3. Parse single row group with DuckDB-WASM
const article = await parseRowGroup(response.arrayBuffer());
```

### Pros

✅ **Minimal File Count**
- Only 2 files to deploy
- Simple Arweave manifest
- Easy deployment pipeline

✅ **Native Parquet Pattern**
- Row groups designed for this use case
- Standard Parquet optimization technique
- Well-understood by Parquet ecosystem

✅ **Efficient Storage**
- Single Parquet header/footer
- Better compression across similar data
- No per-file overhead

✅ **Arweave Compatibility**
- Arweave gateways support HTTP Range requests
- Well-tested pattern for large files

✅ **Analytics Ready**
- Can query entire dataset with DuckDB
- Download full `articles.parquet` for analysis
- Better for batch analytics workflows

✅ **Atomic Updates**
- Both files updated together
- No sync issues between metadata and articles
- Simpler versioning

✅ **Predictable Costs**
- Fixed 2-file deployment cost
- Bandwidth cost scales with article views (range requests)

### Cons

❌ **Range Request Complexity**
- Requires Parquet footer parsing first
- Must track byte offsets in metadata
- More complex client-side code

❌ **DuckDB-WASM Range Request Support**
- Need to verify DuckDB-WASM can parse single row groups from ranges
- May require custom parsing logic
- Potential compatibility issues

❌ **Cache Inefficiency**
- Each range request counts as cache miss (different Range header = different cache entry)
- Can't leverage standard HTTP caching as effectively
- May need service worker for caching

❌ **All-or-Nothing Updates**
- Change 1 article = reupload entire 50 MB `articles.parquet`
- More expensive for incremental updates
- Slower update cycles

❌ **Browser Range Request Limits**
- Some browsers/proxies don't handle Range requests well
- CORS complications with Range headers
- Debugging harder (can't inspect individual articles easily)

❌ **Write Complexity**
- Must configure Parquet writer with specific row group size
- Need to track byte offsets during write
- Parquet writers may not expose row group control

❌ **Initial Article View**
- First article requires downloading Parquet footer (~KB)
- Then range request for row group
- Two round trips vs one

### Implementation Complexity

**Scraper Changes:**
- High complexity
- Must configure Parquet with 1-article-per-row-group
- Must capture byte offsets during write
- May require low-level Parquet library

**Frontend Changes:**
- High complexity
- Custom range request logic
- Parquet row group parsing
- DuckDB-WASM integration may require workarounds

**Deployment Changes:**
- Low complexity
- Only 2 files to upload
- Simple manifest

---

## Technical Comparison Matrix

| Criterion | Partitioned Parquet | Dual Parquet + Range |
|-----------|---------------------|----------------------|
| **Homepage Load** | 5 MB (metadata only) | 5 MB (metadata only) |
| **Article Load** | ~10 KB (1 file) | ~10-20 KB (range request) |
| **File Count** | 7,001 files | 2 files |
| **Deployment Size** | ~60-80 MB total | ~40-60 MB total |
| **Arweave Manifest** | ~1-2 MB (7k entries) | ~5 KB (2 entries) |
| **Browser Caching** | Excellent (per-file) | Poor (range requests) |
| **Update Cost** | Changed files only | Full 50MB re-upload |
| **Implementation** | Medium complexity | High complexity |
| **DuckDB Support** | Native | May need custom code |
| **Debugging** | Easy (file per article) | Harder (parse ranges) |
| **Parquet Compliance** | Standard | Advanced row groups |
| **Scalability** | Excellent (10k+ articles) | Good (single file limits) |

---

## Technical Unknowns / Questions for DB Architect

### For Option 1 (Partitioned):
1. Is 7,000 files in an Arweave manifest acceptable/performant?
2. What's the overhead of Parquet headers across 7,000 files?
3. Should we batch (e.g., 100 articles per file) as middle ground?

### For Option 2 (Range Requests):
4. Can DuckDB-WASM parse a single row group from an HTTP range response?
5. How do we configure Parquet writers to use 1-article-per-row-group?
6. Does the Parquet footer need to be fetched first (extra round trip)?
7. What's the byte offset overhead in metadata (int64 × 2 × 7,000 = ~112 KB)?
8. Are there row group size recommendations for this use case?
9. Do Arweave gateways reliably support Range requests under load?

### General:
10. Is there a hybrid approach worth considering?
11. Should we support offline/downloadable dataset (favor Option 2)?
12. What's the expected growth rate (1k articles/year)?
13. Do we need to support bulk exports for researchers?

---

## Additional Considerations

### Hybrid Option 3: Batched Partitions

A middle ground:
```
data/
├── metadata.parquet                    # ~5 MB
└── articles/
    ├── batch-000-099.parquet          # Articles 0-99 (~500 KB)
    ├── batch-100-199.parquet          # Articles 100-199
    └── ... (~70 files)
```

**Pros:**
- Fewer files (70 vs 7,000)
- Still cacheable per batch
- Simpler than 7,000 files

**Cons:**
- Download 100 articles to view 1 (~500 KB vs ~10 KB)
- Worse cache hit rate
- Still need to track article → batch mapping

### Recommendation Request

We'd like the DB architect's input on:
1. Which option is more maintainable long-term?
2. Are there Parquet best practices we're missing?
3. What have similar projects done (DuckDB docs, examples)?
4. Any performance pitfalls we haven't considered?

---

## Prototyping Next Steps

Once we decide:
1. Build scraper for chosen architecture
2. Test with 100 articles
3. Benchmark load times
4. Test DuckDB-WASM integration
5. Verify Arweave deployment works
6. Run full 7,000 article scrape
7. Deploy test site

---

## References

- **Parquet Format Spec:** https://parquet.apache.org/docs/file-format/
- **DuckDB-WASM:** https://duckdb.org/docs/api/wasm/overview
- **Arweave HTTP API:** https://docs.arweave.org/developers/server/http-api
- **HTTP Range Requests:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests

---

**Prepared by:** Claude
**Review Requested:** Database Architect
**Next Action:** Architect feedback, then implement chosen approach
