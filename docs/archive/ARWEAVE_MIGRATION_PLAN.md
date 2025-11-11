# Arweave Migration Plan: Individual Article Transactions

## 🎯 Goal
Migrate from batched Parquet approach to individual Arweave transactions per article, with metadata.parquet containing only lightweight data + transaction IDs.

## 📊 Current State Analysis

### Database Content (3,721 articles)
✅ **Available in SQLite:**
- Title, slug, article_id
- Abstract (272-277 bytes average)
- Authors (JSON with ORCID)
- DOI references
- Collections/affiliations
- Keywords
- Published dates
- PDF URLs (for downloading)

❌ **NOT Available:**
- Full article text/body
- Full article HTML content
- Attachments (files)

### Implications
Since we don't have full article content in SQLite, we have **two options**:

**Option A: Metadata-Only Articles**
- Create lightweight HTML pages with available metadata
- Include links to original PubPub articles
- Focus on preservation of metadata + discoverability

**Option B: Full Content Scraping**
- Fetch full content from PubPub per article
- More complete archive but significantly slower
- Requires additional API calls (3,721 requests)

**RECOMMENDATION: Option A** - Faster, still valuable, can enhance later.

---

## 🏗️ New Architecture

```
┌─────────────────────────────────────────────────┐
│          SQLite (Source of Truth)                │
│  - 3,721 articles with metadata                  │
│  - arweave_tx_id field (empty initially)         │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│      Article HTML Generator                      │
│  - Creates individual HTML files                 │
│  - data/articles-html/{slug}.html                │
│  - Contains: metadata, abstract, DOI, authors    │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│      Arweave Uploader (Turbo SDK)                │
│  - Uploads each HTML file                        │
│  - Tags: DOI, Title, Slug, App-Name              │
│  - Returns: Transaction ID per article           │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│      Update SQLite with TX IDs                   │
│  - UPDATE articles SET arweave_tx_id = ?         │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│      Export metadata.parquet                     │
│  - Lightweight (only metadata + TX IDs)          │
│  - No full content                                │
│  - ~1-2MB total                                   │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│      Upload metadata.parquet to Arweave          │
│  - Single transaction                             │
│  - Update ArNS: data_crimrxiv.ar.io              │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│      Vite App Updates                            │
│  - Loads metadata.parquet                        │
│  - Links to articles:                            │
│    https://arweave.net/{tx_id}                   │
└───────────────────────────────────────────────────┘
```

---

## 📝 Article HTML Template

### Minimal Template (Recommended)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} - CrimRxiv Archive</title>

  <!-- SEO & Discovery -->
  <meta name="description" content="{abstract_preview}">
  <meta name="author" content="{author_names}">
  <meta name="citation_title" content="{title}">
  <meta name="citation_doi" content="{doi}">
  <meta name="citation_publication_date" content="{published_date}">

  <!-- Schema.org JSON-LD for discoverability -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    "headline": "{title}",
    "abstract": "{abstract}",
    "author": [{authors_schema_org}],
    "datePublished": "{published_at}",
    "identifier": "{doi}",
    "url": "https://www.crimrxiv.com/pub/{slug}",
    "isPartOf": {
      "@type": "Periodical",
      "name": "CrimRxiv"
    }
  }
  </script>

  <style>
    /* Inline CSS for Arweave compatibility */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.6;
      color: #1a1a1a;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 20px;
      line-height: 1.3;
    }
    .metadata {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .authors {
      margin: 15px 0;
    }
    .author {
      display: inline-block;
      margin-right: 10px;
    }
    .abstract {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
    }
    .links {
      margin-top: 30px;
      padding: 20px;
      background: #fff4e6;
      border-radius: 8px;
    }
    .keywords {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 20px 0;
    }
    .keyword {
      background: #e0e0e0;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <article>
    <header>
      <h1>{title}</h1>

      <div class="metadata">
        <div class="authors">
          <!-- For each author -->
          <span class="author">
            {author_name}
            {#if orcid}
              <a href="https://orcid.org/{orcid}">(ORCID)</a>
            {/if}
          </span>
        </div>

        <div>
          <strong>Published:</strong> {published_date} |
          <strong>DOI:</strong> <a href="https://doi.org/{doi}">{doi}</a>
        </div>

        {#if collections}
        <div><strong>Collections:</strong> {collection_names}</div>
        {/if}
      </div>
    </header>

    {#if keywords}
    <div class="keywords">
      <!-- For each keyword -->
      <span class="keyword">{keyword}</span>
    </div>
    {/if}

    <div class="abstract">
      <h2>Abstract</h2>
      <p>{abstract}</p>
    </div>

    <div class="links">
      <h3>📄 Access Full Article</h3>
      <ul>
        <li><a href="https://www.crimrxiv.com/pub/{slug}">View on CrimRxiv</a></li>
        {#if pdf_url}
        <li><a href="{pdf_url}">Download PDF</a></li>
        {/if}
        <li><a href="https://doi.org/{doi}">Permanent Link (DOI)</a></li>
      </ul>
    </div>

    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 13px;">
      <p>
        📦 Archived on Arweave via <a href="https://www.crimrxiv.com">CrimRxiv</a> |
        This metadata is permanently stored and freely accessible.
      </p>
    </footer>
  </article>
</body>
</html>
```

---

## 🛠️ Implementation Scripts

### 1. Article HTML Generator

**File:** `scripts/generate-article-html.js`

**Purpose:** Convert SQLite articles → individual HTML files

**Key Features:**
- Reads from SQLite `articles` table
- Generates HTML using Handlebars template
- Saves to `data/articles-html/{slug}.html`
- Validates HTML size and structure

### 2. Arweave Article Uploader

**File:** `scripts/upload-articles-to-arweave.js`

**Purpose:** Upload HTML files → Arweave, store TX IDs

**Features:**
- Uses Turbo SDK for uploads
- Batched uploads (10 at a time to manage rate limits)
- Tags each transaction:
  ```javascript
  tags: [
    { name: 'Content-Type', value: 'text/html' },
    { name: 'App-Name', value: 'CrimRxiv-Archive' },
    { name: 'Title', value: article.title },
    { name: 'DOI', value: article.doi },
    { name: 'Slug', value: article.slug },
    { name: 'Published', value: article.published_at },
    { name: 'Article-Type', value: 'criminology-preprint' }
  ]
  ```
- Progress tracking
- Cost estimation before upload
- Retry logic for failed uploads
- Updates SQLite with TX IDs

### 3. Updated Parquet Exporter

**File:** `scripts/export-metadata-parquet.js`

**Purpose:** Export lightweight metadata.parquet with TX IDs

**Schema Changes:**
```sql
-- REMOVE these fields from export:
-- content_text, content_json

-- ADD these fields:
-- arweave_tx_id (critical!)

-- KEEP these fields:
article_id, slug, title, abstract (preview only),
authors_json, keywords_json, collections_json,
doi, published_at, url, pdf_url, arweave_tx_id
```

---

## 💰 Cost Estimation

### Upload Costs (Arweave)
- **3,721 articles** × 10KB average = **37.21 MB**
- Cost: ~0.37 AR ≈ **$3-5 USD** (one-time)
- **metadata.parquet**: 1-2 MB ≈ **$0.10 USD**
- **Total**: **$3-6 USD one-time cost**

### Benefits
- ✅ Each article is independently permanent
- ✅ Individual DOI-based discovery
- ✅ Can update metadata.parquet without re-uploading articles
- ✅ ArNS subdomain routing per article possible
- ✅ GraphQL searchable by tags

---

## 🔄 Complete Workflow

```bash
# 1. Generate HTML articles from SQLite
npm run generate:articles

# 2. Estimate upload costs (dry run)
npm run upload:articles --dry-run

# 3. Upload articles to Arweave (get TX IDs)
npm run upload:articles

# 4. Export metadata.parquet with TX IDs
npm run export

# 5. Upload metadata.parquet
npm run upload:metadata

# 6. Build and deploy Vite app
npm run build
npm run deploy
```

---

## 🎨 App Updates Required

### 1. Update ParquetDB Schema
```javascript
// src/lib/parquet-db.js
async getRecentArticles(limit = 25) {
  const result = await this.conn.query(`
    SELECT
      article_id,
      slug,
      title,
      authors_json,
      abstract_preview,
      keywords_json,
      published_at,
      doi,
      author_count,
      arweave_tx_id  -- ← NEW FIELD
    FROM metadata
    WHERE published_at IS NOT NULL
    ORDER BY published_at DESC
    LIMIT ${limit}
  `);
  // ...
}
```

### 2. Update Article Detail Component
```javascript
// src/components/article-detail.js
async render(slug) {
  const article = await this.db.getArticleMetadata(slug);

  if (article.arweave_tx_id) {
    // Option A: Redirect to Arweave
    window.location.href = `https://arweave.net/${article.arweave_tx_id}`;

    // OR Option B: Fetch and display
    const response = await fetch(`https://arweave.net/${article.arweave_tx_id}`);
    const html = await response.text();
    return html;

    // OR Option C: Embed in iframe
    return `<iframe src="https://arweave.net/${article.arweave_tx_id}" ...></iframe>`;
  }

  // Fallback if no TX ID
  return this.renderMetadataOnly(article);
}
```

---

## ✅ Migration Checklist

- [ ] 1. Create article HTML generator script
- [ ] 2. Test HTML generation with 10 articles
- [ ] 3. Create Arweave uploader script with Turbo SDK
- [ ] 4. Test upload with 5 articles (dry run first)
- [ ] 5. Upload all 3,721 articles (monitor progress)
- [ ] 6. Verify TX IDs stored in SQLite
- [ ] 7. Update Parquet exporter schema
- [ ] 8. Export new metadata.parquet
- [ ] 9. Upload metadata.parquet to Arweave
- [ ] 10. Update Vite app components
- [ ] 11. Test app locally with new metadata
- [ ] 12. Build production bundle
- [ ] 13. Deploy app to Arweave
- [ ] 14. Update ArNS records
- [ ] 15. Verify end-to-end workflow

---

## 🚀 Next Steps

1. **Review and approve this plan**
2. **Start with article HTML generator** (lowest risk)
3. **Test with sample batch** (10 articles)
4. **Scale to full upload** (3,721 articles)
5. **Update app and deploy**

---

## 📚 References

- Arweave Turbo SDK: https://docs.ardrive.io/docs/turbo
- ArNS Documentation: https://docs.ar.io/arns
- Schema.org ScholarlyArticle: https://schema.org/ScholarlyArticle
- PATTERN_GUIDE.md: `docs/PATTERN_GUIDE.md`
