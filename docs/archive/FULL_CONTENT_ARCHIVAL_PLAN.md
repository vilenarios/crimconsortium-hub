# Full Content Archival Plan: Complete PubPub → Arweave Pipeline

## 🎯 Goal
Create a complete, permanent archive of all CrimRxiv articles on Arweave with:
- ✅ Full article content (not just abstracts)
- ✅ All metadata (authors, DOI, collections, keywords)
- ✅ All attachments/downloads (PDFs, supplementary files)
- ✅ DOI references and citations
- ✅ Consortium member information
- ✅ Individual Arweave transactions per article
- ✅ Lightweight metadata.parquet for discovery

---

## 📚 PubPub SDK Capabilities Analysis

### ✅ What the SDK Can Do

**1. Get Article Metadata** (`pub.get` or `pub.getMany`)
```javascript
const { body: pub } = await sdk.pub.get({
  params: { slugOrId: 'article-slug' },
  query: {
    include: ['attributions', 'collections', 'releases'],
  }
});

// Returns:
{
  id, slug, title, description, doi,
  htmlTitle, htmlDescription,
  customPublishedAt,
  attributions: [{ name, orcid, affiliation, ... }],
  downloads: [{ type: 'formatted', url: 'https://...pdf', createdAt }],
  collectionPubs: [...],
  outboundEdges: [...], // DOI references
  inboundEdges: [...],  // Citations
  // ... more metadata
}
```

**2. Get Full Article Content** (`pub.text.get`)
```javascript
const { body: doc } = await sdk.pub.text.get({
  params: { pubId: 'pub-id' }
});

// Returns ProseMirror document:
{
  type: 'doc',
  content: [
    { type: 'heading', attrs: {...}, content: [...] },
    { type: 'paragraph', content: [...] },
    { type: 'image', attrs: { src: '...' } },
    // ... full article structure
  ],
  attrs: {}
}
```

**3. Get Attachments**
From `pub.get()` → `downloads` array:
```javascript
downloads: [
  {
    createdAt: '2023-01-15T10:30:00.000Z',
    type: 'formatted', // typically PDF
    url: 'https://assets.pubpub.org/...'
  }
]
```

### 🔍 What We Get

| Data Type | Source | Available? |
|-----------|--------|-----------|
| **Metadata** | `pub.get()` | ✅ Full |
| **Full Content** | `pub.text.get()` | ✅ ProseMirror JSON |
| **Attachments** | `pub.get().downloads` | ✅ URLs |
| **DOI References** | `pub.get().outboundEdges` | ✅ Full |
| **Citations** | `pub.get().inboundEdges` | ✅ Full |
| **Authors/ORCID** | `pub.get().attributions` | ✅ Full |
| **Collections** | `pub.get().collectionPubs` | ✅ Full |

---

## 🏗️ Complete Architecture

```
┌──────────────────────────────────────────────────────┐
│  Phase 1: Full Content Scraping (NEW!)               │
│  ─────────────────────────────────────────────────   │
│  For each of 3,721 articles:                         │
│    1. pub.get(slug) → metadata + attachments URLs    │
│    2. pub.text.get(pubId) → ProseMirror document     │
│    3. Download attachments from URLs                 │
│    4. Store all in SQLite                            │
│                                                       │
│  Estimated time: 3-4 hours (3,721 × ~4 sec/article)  │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Phase 2: HTML Generation                            │
│  ─────────────────────────────────────────────────   │
│  For each article:                                   │
│    1. Convert ProseMirror → HTML                     │
│    2. Add metadata header                            │
│    3. Add Schema.org JSON-LD                         │
│    4. Embed attachments info                         │
│    5. Save to data/articles-html/{slug}.html         │
│                                                       │
│  Estimated time: 10-15 minutes                       │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Phase 3: Arweave Upload                             │
│  ─────────────────────────────────────────────────   │
│  For each article:                                   │
│    1. Upload HTML → get TX ID                        │
│    2. Upload attachments → get TX IDs                │
│    3. Store TX IDs in SQLite                         │
│                                                       │
│  Cost: ~$5-10 USD for 3,721 articles + attachments   │
│  Estimated time: 2-3 hours (rate limited uploads)    │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Phase 4: Metadata Parquet                           │
│  ─────────────────────────────────────────────────   │
│  1. Export metadata + TX IDs to Parquet              │
│  2. NO full content in Parquet (too large)           │
│  3. Lightweight: ~2-3MB for 3,721 articles           │
│                                                       │
│  Estimated time: 1 minute                            │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│  Phase 5: App Updates & Deployment                   │
│  ─────────────────────────────────────────────────   │
│  1. App loads metadata.parquet                       │
│  2. Links to articles via TX ID                      │
│  3. Fetches full HTML from Arweave on demand         │
│                                                       │
│  Estimated time: 30 minutes                          │
└──────────────────────────────────────────────────────┘
```

---

## 📝 Updated SQLite Schema

Add these fields to the `articles` table:

```sql
-- Full content fields
content_prosemirror TEXT,           -- ProseMirror JSON document
content_html TEXT,                  -- Converted HTML (for archival)
content_text_full TEXT,             -- Plain text extraction
word_count INTEGER,                 -- Derived from content

-- Attachment tracking
attachments_json TEXT,              -- JSON array of {type, url, filename, arweave_tx_id}
attachment_count INTEGER DEFAULT 0,

-- DOI references & citations
references_json TEXT,               -- Outbound edges (references this article cites)
citations_json TEXT,                -- Inbound edges (articles citing this one)
reference_count INTEGER DEFAULT 0,
citation_count INTEGER DEFAULT 0,

-- Article file tracking
article_html_path TEXT,             -- Local path to generated HTML
article_html_size INTEGER,          -- File size in bytes
article_arweave_tx_id TEXT,         -- Transaction ID for article HTML

-- Status tracking
full_content_scraped BOOLEAN DEFAULT 0,
full_content_scraped_at TEXT,
html_generated BOOLEAN DEFAULT 0,
html_generated_at TEXT,
```

---

## 🔧 Implementation: Phase 1 - Full Content Scraper

**File:** `scripts/scrape-full-content.js`

### Key Features:
1. **Fetch metadata** (`pub.get`)
2. **Fetch full content** (`pub.text.get`)
3. **Download attachments** (from `downloads` URLs)
4. **Store in SQLite** with all data
5. **Rate limiting** (100ms delay between requests)
6. **Progress tracking** (resume capability)
7. **Error handling** (retry logic)

### Pseudo-code:
```javascript
class FullContentScraper {
  async scrapeArticle(article) {
    // 1. Fetch full metadata
    const { body: pub } = await this.sdk.pub.get({
      params: { slugOrId: article.slug },
      query: {
        include: ['attributions', 'collectionPubs', 'outboundEdges', 'inboundEdges'],
      }
    });

    // 2. Fetch full content (ProseMirror)
    const { body: doc } = await this.sdk.pub.text.get({
      params: { pubId: pub.id }
    });

    // 3. Download attachments
    const attachments = [];
    for (const download of pub.downloads || []) {
      const file = await this.downloadAttachment(download.url);
      attachments.push({
        type: download.type,
        url: download.url,
        filename: file.filename,
        localPath: file.path,
        size: file.size,
        arweave_tx_id: null // Will be filled during upload
      });
    }

    // 4. Store everything in SQLite
    await this.db.updateArticleFullContent({
      slug: article.slug,
      content_prosemirror: JSON.stringify(doc),
      content_text_full: this.extractTextFromProseMirror(doc),
      word_count: this.countWords(doc),
      attachments_json: JSON.stringify(attachments),
      attachment_count: attachments.length,
      references_json: JSON.stringify(pub.outboundEdges || []),
      citations_json: JSON.stringify(pub.inboundEdges || []),
      reference_count: (pub.outboundEdges || []).length,
      citation_count: (pub.inboundEdges || []).length,
      full_content_scraped: true,
      full_content_scraped_at: new Date().toISOString()
    });

    // Rate limiting
    await this.sleep(100);
  }

  extractTextFromProseMirror(doc) {
    // Recursive function to extract all text nodes
    let text = '';
    const traverse = (node) => {
      if (node.text) {
        text += node.text + ' ';
      }
      if (node.content) {
        node.content.forEach(traverse);
      }
    };
    traverse(doc);
    return text.trim();
  }

  async downloadAttachment(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const filename = this.extractFilename(url);
    const path = `data/attachments/${filename}`;
    await fs.writeFile(path, Buffer.from(buffer));
    return {
      filename,
      path,
      size: buffer.byteLength
    };
  }
}
```

---

## 🎨 Implementation: Phase 2 - HTML Generator

**File:** `scripts/generate-full-articles.js`

### ProseMirror → HTML Conversion

Use the `prosemirror-model` library to convert ProseMirror JSON to HTML:

```javascript
import { schema } from 'prosemirror-schema-basic';
import { DOMSerializer } from 'prosemirror-model';

class HTMLGenerator {
  convertProseMirrorToHTML(proseMirrorDoc) {
    const node = schema.nodeFromJSON(proseMirrorDoc);
    const serializer = DOMSerializer.fromSchema(schema);
    const fragment = serializer.serializeFragment(node.content);

    // Convert DOM fragment to HTML string
    const div = document.createElement('div');
    div.appendChild(fragment);
    return div.innerHTML;
  }

  async generateArticleHTML(article) {
    const contentHTML = this.convertProseMirrorToHTML(
      JSON.parse(article.content_prosemirror)
    );

    const attachments = JSON.parse(article.attachments_json || '[]');
    const references = JSON.parse(article.references_json || '[]');
    const authors = JSON.parse(article.authors_json || '[]');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${article.title}</title>
  <meta name="citation_title" content="${article.title}">
  <meta name="citation_doi" content="${article.doi}">
  ${authors.map(a => `<meta name="citation_author" content="${a.name}">`).join('\n  ')}

  <script type="application/ld+json">
  ${this.generateSchemaOrg(article, authors, references)}
  </script>

  <style>
    ${this.getInlineCSS()}
  </style>
</head>
<body>
  <article>
    <header>
      <h1>${article.title}</h1>
      <div class="metadata">
        ${this.renderAuthors(authors)}
        <div>DOI: <a href="https://doi.org/${article.doi}">${article.doi}</a></div>
        <div>Published: ${article.published_at}</div>
      </div>
    </header>

    <div class="content">
      ${contentHTML}
    </div>

    ${this.renderAttachments(attachments)}
    ${this.renderReferences(references)}
  </article>
</body>
</html>`;
  }
}
```

---

## ☁️ Implementation: Phase 3 - Arweave Uploader

**File:** `scripts/upload-to-arweave.js`

```javascript
import { TurboFactory } from '@ardrive/turbo-sdk';

class ArweaveUploader {
  async uploadArticle(article) {
    const htmlPath = `data/articles-html/${article.slug}.html`;

    // 1. Upload article HTML
    const articleResult = await this.turbo.uploadFile({
      fileStreamFactory: () => fs.readFileSync(htmlPath),
      fileSizeFactory: () => fs.statSync(htmlPath).size,
      dataItemOpts: {
        tags: [
          { name: 'Content-Type', value: 'text/html' },
          { name: 'App-Name', value: 'CrimRxiv-Archive' },
          { name: 'Title', value: article.title },
          { name: 'DOI', value: article.doi },
          { name: 'Slug', value: article.slug },
          { name: 'Type', value: 'article' },
        ]
      }
    });

    // 2. Upload attachments
    const attachments = JSON.parse(article.attachments_json || '[]');
    for (const attachment of attachments) {
      const attachmentResult = await this.turbo.uploadFile({
        fileStreamFactory: () => fs.readFileSync(attachment.localPath),
        fileSizeFactory: () => attachment.size,
        dataItemOpts: {
          tags: [
            { name: 'Content-Type', value: this.getContentType(attachment.filename) },
            { name: 'App-Name', value: 'CrimRxiv-Archive' },
            { name: 'Article-Slug', value: article.slug },
            { name: 'Type', value: 'attachment' },
            { name: 'Filename', value: attachment.filename },
          ]
        }
      });

      attachment.arweave_tx_id = attachmentResult.id;
    }

    // 3. Update SQLite
    await this.db.run(`
      UPDATE articles SET
        article_arweave_tx_id = ?,
        attachments_json = ?
      WHERE slug = ?
    `, [articleResult.id, JSON.stringify(attachments), article.slug]);

    return articleResult.id;
  }
}
```

---

## 📊 Implementation: Phase 4 - Metadata Parquet

**Updated Schema** (lightweight, NO full content):

```sql
SELECT
  article_id,
  slug,
  title,
  abstract_preview,           -- First 500 chars only
  authors_json,               -- Keep for search
  author_count,
  keywords_json,
  collections_json,
  doi,
  published_at,
  word_count,                 -- NEW: article length indicator
  attachment_count,           -- NEW: has attachments?
  reference_count,            -- NEW: reference count
  citation_count,             -- NEW: citation count
  article_arweave_tx_id,      -- CRITICAL: link to full article
  attachments_json,           -- CRITICAL: includes attachment TX IDs
  updated_at
FROM articles
WHERE is_latest_version = 1
  AND full_content_scraped = 1
ORDER BY published_at DESC
```

**Size estimate:** ~2-3MB for 3,721 articles (vs ~1GB with full content)

---

## 🎯 Timeline & Effort

| Phase | Time | Complexity |
|-------|------|------------|
| 1. Full content scraping | 3-4 hours | Medium (API calls + downloads) |
| 2. HTML generation | 10-15 min | Low (template + conversion) |
| 3. Arweave upload | 2-3 hours | Medium (rate limits + cost) |
| 4. Parquet export | 1 min | Low (SQL export) |
| 5. App updates | 30 min | Low (fetch from TX ID) |
| **Total** | **6-8 hours** | **Medium** |

---

## 💰 Cost Breakdown

- **Articles HTML**: 3,721 × 50KB avg = 186MB ≈ $2 USD
- **Attachments**: Varies (many articles have PDFs)
  - Estimate: 1,500 PDFs × 500KB avg = 750MB ≈ $8 USD
- **Metadata Parquet**: 2MB ≈ $0.02 USD
- **App deployment**: 5MB ≈ $0.05 USD
- **Total**: **~$10-15 USD one-time cost**

---

## ✅ Benefits of This Approach

1. ✅ **Complete archive** - Full content + attachments
2. ✅ **Individual permanence** - Each article is independent
3. ✅ **Discoverable** - Rich Arweave tags for GraphQL search
4. ✅ **Citable** - DOI metadata preserved
5. ✅ **Updateable** - Can re-generate metadata.parquet without re-uploading articles
6. ✅ **Lightweight app** - metadata.parquet only 2-3MB
7. ✅ **Fast search** - DuckDB queries on metadata
8. ✅ **Full content on demand** - Fetch from Arweave when viewing article

---

## 🚀 Ready to Implement?

**Next steps:**
1. Review and approve this plan
2. I'll create the full-content scraper script
3. Test with 10 articles
4. Scale to all 3,721 articles
5. Generate HTML + upload to Arweave
6. Update app to use TX IDs

Let me know if you want me to proceed!
