# Markdown Archival Pipeline

## 🎯 Overview

Complete pipeline for archiving CrimRXiv articles on Arweave as **individual permanent transactions**. Each article is stored as Markdown with full content, metadata, attachments, and DOI references.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│  Phase 1: Full Content Scraping                      │
│  ──────────────────────────────────────────────────  │
│  Script: npm run scrape:full                         │
│  For each of 3,721 articles:                         │
│    1. pub.get(slug) → metadata + attachments URLs    │
│    2. pub.text.get(pubId) → ProseMirror document     │
│    3. Convert ProseMirror → Markdown                 │
│    4. Download attachments from URLs                 │
│    5. Store all in SQLite                            │
│  ─────────────────────────────────────────────────── │
│  Time: 3-4 hours (~4 sec/article)                    │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Phase 2: Markdown File Generation                   │
│  ──────────────────────────────────────────────────  │
│  Script: npm run generate:markdown                   │
│  For each article:                                   │
│    1. Generate YAML frontmatter                      │
│    2. Add metadata section (authors, DOI, etc.)     │
│    3. Add abstract                                   │
│    4. Add full content (Markdown)                   │
│    5. Add attachments section                        │
│    6. Add references & citations                     │
│    7. Save to data/articles-markdown/{slug}.md       │
│  ─────────────────────────────────────────────────── │
│  Time: 10-15 minutes                                 │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Phase 3: Arweave Upload                             │
│  ──────────────────────────────────────────────────  │
│  Script: npm run upload:articles                     │
│  For each article:                                   │
│    1. Upload Markdown → get TX ID                    │
│    2. Upload attachments → get TX IDs                │
│    3. Store TX IDs in SQLite                         │
│  ─────────────────────────────────────────────────── │
│  Cost: ~$5-10 USD for all articles + attachments     │
│  Time: 2-3 hours (rate limited uploads)              │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Phase 4: Metadata Parquet Export                    │
│  ──────────────────────────────────────────────────  │
│  Script: npm run export                              │
│  1. Export metadata + TX IDs to Parquet              │
│  2. NO full content in Parquet (lightweight)         │
│  3. File size: ~2-3MB for 3,721 articles             │
│  ─────────────────────────────────────────────────── │
│  Time: 1 minute                                      │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Phase 5: App Deployment                             │
│  ──────────────────────────────────────────────────  │
│  Script: npm run build && npm run deploy             │
│  1. App loads metadata.parquet                       │
│  2. Links to articles via TX ID                      │
│  3. Fetches full content from Arweave on demand      │
│  ─────────────────────────────────────────────────── │
│  Time: 30 minutes                                    │
└──────────────────────────────────────────────────────┘
```

---

## 📦 Database Schema

### New Fields Added to `articles` Table

```sql
-- Full content fields
content_prosemirror TEXT,       -- ProseMirror JSON document
content_markdown TEXT,           -- Converted Markdown
content_text_full TEXT,          -- Plain text extraction
word_count INTEGER,              -- Derived from content

-- Attachment tracking
attachments_json TEXT,           -- JSON array of {type, url, filename, arweave_tx_id}
attachment_count INTEGER DEFAULT 0,

-- DOI references & citations
references_json TEXT,            -- Outbound edges (this article cites)
citations_json TEXT,             -- Inbound edges (articles citing this one)
reference_count INTEGER DEFAULT 0,
citation_count INTEGER DEFAULT 0,

-- Article file tracking
article_markdown_path TEXT,      -- Local path to generated Markdown
article_markdown_size INTEGER,   -- File size in bytes

-- Status tracking
full_content_scraped INTEGER DEFAULT 0,
full_content_scraped_at TEXT,
markdown_generated INTEGER DEFAULT 0,
markdown_generated_at TEXT,

-- Arweave tracking (existing)
arweave_tx_id TEXT,              -- Transaction ID for article
```

---

## 🚀 Quick Start

### 1. Prerequisites

```bash
# .env file must contain:
PUBPUB_EMAIL=your-email@example.com
PUBPUB_PASSWORD=your-password
PUBPUB_COMMUNITY_URL=https://www.crimrxiv.com

# For Phase 3 (Arweave upload):
TURBO_PRIVATE_KEY='{"kty":"RSA","n":"...","e":"AQAB",...}'
```

### 2. Test with 10 Articles

```bash
# Phase 1: Scrape full content
npm run scrape:full -- --limit=10

# Phase 2: Generate Markdown files
npm run generate:markdown -- --limit=10

# Phase 3: Dry run upload (estimate costs)
npm run upload:articles -- --limit=10 --dry-run

# Phase 3: Upload to Arweave
npm run upload:articles -- --limit=10

# Phase 4: Export metadata
npm run export

# Phase 5: Build and deploy app
npm run build
npm run dev
```

### 3. Production Run (All 3,721 Articles)

```bash
# Phase 1: Scrape full content (3-4 hours)
npm run scrape:full

# Phase 2: Generate Markdown (10-15 min)
npm run generate:markdown

# Phase 3: Upload to Arweave (2-3 hours)
npm run upload:articles

# Phase 4: Export metadata
npm run export

# Phase 5: Deploy
npm run build
npm run deploy
```

---

## 📝 Script Details

### Phase 1: `scripts/scrape-full-content.js`

**Purpose:** Fetch full article content from PubPub API

**Features:**
- Uses PubPub SDK (`pub.get`, `pub.text.get`)
- Converts ProseMirror to Markdown
- Downloads attachments
- Stores everything in SQLite
- Rate limiting (200ms between requests)
- Retry logic with exponential backoff
- Progress tracking

**Usage:**
```bash
npm run scrape:full                    # Process all articles
npm run scrape:full -- --limit=10      # Test with 10 articles
```

**Database Method:**
```javascript
db.getArticlesNeedingFullContent(limit)
db.updateArticleFullContent(data)
```

---

### Phase 2: `scripts/generate-markdown-articles.js`

**Purpose:** Generate standalone Markdown files with YAML frontmatter

**Features:**
- YAML frontmatter with all metadata
- Formatted metadata section
- Abstract section
- Full article content
- Attachments list
- References & citations
- Footer with archive info

**Usage:**
```bash
npm run generate:markdown                # Process all articles
npm run generate:markdown -- --limit=10  # Test with 10 articles
```

**Output:** `data/articles-markdown/{slug}.md`

**Database Method:**
```javascript
db.getArticlesNeedingMarkdown(limit)
db.updateArticleMarkdown(slug, path, size)
```

**Example Markdown Structure:**
```markdown
---
title: "Article Title"
slug: article-slug
doi: 10.31235/osf.io/abc123
published: 2023-01-15
authors:
  - name: "Jane Doe"
    orcid: 0000-0001-2345-6789
keywords:
  - criminology
  - research
word_count: 5000
attachment_count: 2
---

# Article Title

**Authors:** Jane Doe ([ORCID](https://orcid.org/0000-0001-2345-6789))

**Published:** 2023-01-15

**DOI:** [10.31235/osf.io/abc123](https://doi.org/10.31235/osf.io/abc123)

---

## Abstract

Article abstract goes here...

---

## Article Content

Full article content in Markdown...

## Attachments

- **article.pdf** (1.2 MB)
- **supplement.csv** (50 KB)

## References

1. Reference 1...
2. Reference 2...

---

_This article is archived on Arweave for permanent preservation._
```

---

### Phase 3: `scripts/upload-articles-to-arweave.js`

**Purpose:** Upload Markdown files and attachments to Arweave

**Features:**
- Uses Turbo SDK for uploads
- Tags each transaction with metadata
- Uploads article + all attachments
- Stores TX IDs in database
- Cost estimation (dry-run mode)
- Rate limiting (1 second between uploads)
- Progress tracking

**Usage:**
```bash
npm run upload:articles                    # Upload all pending
npm run upload:articles -- --limit=10      # Test with 10
npm run upload:articles -- --dry-run       # Estimate costs
```

**Tags Applied:**
```javascript
// Article tags
{ name: 'Content-Type', value: 'text/markdown' }
{ name: 'App-Name', value: 'CrimRXiv-Archive' }
{ name: 'Title', value: 'Article Title' }
{ name: 'DOI', value: '10.31235/osf.io/abc123' }
{ name: 'Slug', value: 'article-slug' }
{ name: 'Type', value: 'article' }

// Attachment tags
{ name: 'Content-Type', value: 'application/pdf' }
{ name: 'App-Name', value: 'CrimRXiv-Archive' }
{ name: 'Article-Slug', value: 'article-slug' }
{ name: 'Type', value: 'attachment' }
{ name: 'Filename', value: 'article.pdf' }
```

**Database Method:**
```javascript
db.getArticlesNeedingUpload(limit)
db.updateArticleArweave(slug, txId)
```

**View Uploaded Articles:**
```
https://arweave.net/{transaction-id}
```

---

## 📊 Cost Estimation

### Article Upload Costs

- **Articles (Markdown)**: 3,721 × 50KB avg = 186MB ≈ **$2 USD**
- **Attachments (PDFs, etc.)**: ~1,500 files × 500KB avg = 750MB ≈ **$8 USD**
- **Total**: **~$10 USD one-time cost**

### Storage Guarantees

- **Arweave**: Permanent storage (200+ years minimum)
- **Individual TX IDs**: Each article is independently accessible
- **GraphQL**: Searchable by tags via Arweave GraphQL

---

## 🔄 Workflow Benefits

### ✅ Complete Archive
- Full article content (not just abstracts)
- All attachments and downloads
- DOI references and citations
- Complete author metadata with ORCID

### ✅ Individual Permanence
- Each article = unique Arweave transaction
- Can update metadata.parquet without re-uploading articles
- Articles remain accessible even if app changes

### ✅ Discoverable
- Rich Arweave tags for GraphQL search
- DOI-based discovery
- Schema.org metadata (future enhancement)

### ✅ Lightweight App
- metadata.parquet only 2-3MB
- Fast DuckDB queries in browser
- Full content loaded on demand from Arweave

---

## 🛠️ Troubleshooting

### Issue: "TURBO_PRIVATE_KEY not found"

**Solution:** Add your Arweave JWK to `.env`:
```bash
TURBO_PRIVATE_KEY='{"kty":"RSA","n":"...","e":"AQAB",...}'
```

Get a wallet from [ArConnect](https://www.arconnect.io/) and export the JWK.

### Issue: "Article not found" during scraping

**Cause:** Article may be deleted or have restricted access

**Solution:** Script automatically skips these articles

### Issue: Rate limiting errors

**Cause:** Too many requests to PubPub API

**Solution:** Script has built-in rate limiting (200ms delay) and retry logic

### Issue: Out of Turbo credits

**Cause:** Insufficient balance in Arweave wallet

**Solution:**
1. Check balance: Visit [Turbo Dashboard](https://turbo.ar.io)
2. Fund wallet with AR tokens
3. Retry upload

---

## 📈 Progress Tracking

### Check Status

```bash
# View scraping progress
npm run status

# Check database stats
node -e "import('./src/lib/database.js').then(m => { const db = new m.CrimRXivDatabase(); db.initialize(); console.log(db.getStats()); db.close(); })"
```

### Database Queries

```sql
-- Articles needing full content
SELECT COUNT(*) FROM articles
WHERE is_latest_version = 1
  AND full_content_scraped = 0;

-- Articles needing Markdown
SELECT COUNT(*) FROM articles
WHERE is_latest_version = 1
  AND full_content_scraped = 1
  AND markdown_generated = 0;

-- Articles needing upload
SELECT COUNT(*) FROM articles
WHERE is_latest_version = 1
  AND markdown_generated = 1
  AND arweave_tx_id IS NULL;

-- Total words archived
SELECT SUM(word_count) as total_words FROM articles
WHERE is_latest_version = 1
  AND full_content_scraped = 1;
```

---

## 🔍 Next Steps

1. **Test with 10 articles** to verify workflow
2. **Review costs** via dry-run mode
3. **Run full pipeline** for all 3,721 articles
4. **Update app** to use `arweave_tx_id` field
5. **Export metadata.parquet** with TX IDs
6. **Deploy to Arweave**

---

## 📚 References

- [PubPub SDK API Documentation](../PUBPUB-SDK-API.md)
- [Arweave Turbo SDK](https://docs.ardrive.io/docs/turbo)
- [Full Content Archival Plan](./FULL_CONTENT_ARCHIVAL_PLAN.md)
- [Arweave Migration Plan](./ARWEAVE_MIGRATION_PLAN.md)
- [Pattern Guide](./PATTERN_GUIDE.md)
