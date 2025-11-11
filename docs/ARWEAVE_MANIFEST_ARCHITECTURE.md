# Arweave Manifest Architecture

## Overview

This document describes the simplified archival architecture for CrimRxiv articles using Arweave manifests and native ProseMirror rendering.

## Architecture Goals

- **Eliminate conversion steps**: Store ProseMirror JSON directly, no Markdown or HTML conversion
- **Perfect fidelity**: Render ProseMirror content in browser using native ProseMirror view
- **Simple manifest structure**: Just metadata.json + attachments, no HTML files
- **Single source of truth**: All article data in one JSON file

## Pipeline Stages

### Stage 1: Basic Metadata Scraping
**Script**: `scripts/scrape-to-sqlite.js`
**Command**: `npm run scrape`

Fetches basic metadata for all articles:
- Article ID, slug, title
- Authors, keywords, collections
- Publication dates
- DOI, license
- Preview/description text

**Database Updates**:
- Populates `articles` table with basic metadata
- Sets `scraped_at` timestamp

### Stage 2: Full Content Scraping
**Script**: `scripts/scrape-full-content.js`
**Command**: `npm run scrape:full`

Fetches complete article content for each article:
- Full ProseMirror JSON document from PubPub API
- Downloads all attachments (PDFs, CSVs, etc.)
- Extracts plain text for word count
- Fetches references and citations

**Database Updates**:
- `content_prosemirror`: Full ProseMirror JSON
- `content_markdown`: NULL (deprecated)
- `content_text_full`: Plain text for word count
- `word_count`: Word count integer
- `attachments_json`: Array of attachment metadata
- `references_json`, `citations_json`: DOI relationships
- `full_content_scraped_at`: Timestamp

**File System**:
- Saves attachments to `data/attachments/{slug}/`

### Stage 3: Manifest Generation
**Script**: `scripts/generate-manifests.js`
**Command**: `npm run generate:manifests`

Creates manifest directories for each article:

```
data/manifests/{slug}/
  ├─ metadata.json       (complete article data + ProseMirror content)
  └─ attachments/
      ├─ article.pdf
      └─ supplement.csv
```

**metadata.json Structure**:
```json
{
  "article_id": "...",
  "slug": "...",
  "version": {
    "number": 1,
    "timestamp": "...",
    "is_latest": true
  },
  "title": "...",
  "abstract": "...",
  "doi": "...",
  "license": "...",
  "dates": {
    "created": "...",
    "updated": "...",
    "published": "..."
  },
  "authors": [
    {
      "name": "...",
      "orcid": "...",
      "affiliation": "...",
      "is_corresponding": false
    }
  ],
  "keywords": ["..."],
  "collections": ["..."],
  "statistics": {
    "word_count": 0,
    "attachment_count": 0,
    "reference_count": 0,
    "citation_count": 0
  },
  "attachments": [
    {
      "type": "article",
      "filename": "article.pdf",
      "path": "attachments/article.pdf",
      "original_url": "..."
    }
  ],
  "references": [...],
  "citations": [...],
  "urls": {
    "original": "...",
    "pdf": "..."
  },
  "content": {
    "type": "doc",
    "content": [
      // ProseMirror document nodes
    ]
  },
  "schema_version": "1.0",
  "created_with": "CrimRxiv Archival Pipeline v1.0"
}
```

**Database Updates**:
- `manifest_path`: Path to manifest directory
- `manifest_generated_at`: Timestamp

### Stage 4: Arweave Upload
**Script**: `scripts/upload-manifests.js`
**Command**: `npm run upload:manifests`

Uploads each manifest to Arweave:

1. **Upload individual files**:
   - `metadata.json` with tags: `Content-Type: application/json`
   - Each attachment with appropriate content type

2. **Create Arweave manifest**:
   ```json
   {
     "manifest": "arweave/paths",
     "version": "0.2.0",
     "index": {
       "path": "metadata.json"
     },
     "paths": {
       "metadata.json": { "id": "TX_ID_1" },
       "attachments/article.pdf": { "id": "TX_ID_2" }
     }
   }
   ```

3. **Upload manifest JSON**:
   - Gets single manifest TX ID
   - All files accessible via: `https://arweave.net/{MANIFEST_TX_ID}/{path}`

**Database Updates**:
- `manifest_tx_id`: Arweave manifest transaction ID
- `manifest_uploaded_at`: Timestamp

**Cost Estimation**: ~$0.01 per MB (Turbo pricing)

## Browser Rendering

### ArticleDetail Component
**File**: `src/components/article-detail.js`

When user clicks an article with `manifest_tx_id`:

1. **Fetch metadata.json** from Arweave:
   ```javascript
   const metadata = await fetch(
     `https://arweave.net/${manifestTxId}/metadata.json`
   ).then(r => r.json());
   ```

2. **Render article HTML** with:
   - Header with title, authors, metadata
   - Abstract section
   - Empty container for ProseMirror: `<div id="prosemirror-content-{slug}"></div>`
   - Keywords, collections, attachments
   - Links to original article

3. **Client-side ProseMirror rendering**:
   - Inline `<script type="module">` in HTML
   - Dynamic imports of ProseMirror libraries
   - Creates EditorView with read-only state
   - Perfect rendering fidelity

```javascript
const { EditorState } = await import('prosemirror-state');
const { EditorView } = await import('prosemirror-view');
const { schema } = await import('prosemirror-schema-basic');

const doc = schema.nodeFromJSON(contentData);
const state = EditorState.create({ doc, plugins: [] });

new EditorView(containerEl, {
  state,
  editable: () => false
});
```

## Benefits

### Simplified Pipeline
- **Before**: ProseMirror → Markdown → HTML → Upload
- **After**: ProseMirror → Upload → Render

### Perfect Fidelity
- No conversion losses
- Exact rendering as in PubPub editor
- Rich formatting preserved

### Single Source of Truth
- All article data in one JSON file
- Easy to query, index, or process
- Simple backup and versioning

### Static Site Compatible
- No server-side rendering needed
- All content accessible via Arweave CDN
- Client-side rendering with ES6 modules

## Incremental Processing

All scripts support incremental processing:

```bash
# Skip already-scraped articles
npm run scrape -- --incremental

# Skip articles with full content
npm run scrape:full -- --incremental

# Process only articles without manifests
npm run generate:manifests

# Upload only unuploaded manifests
npm run upload:manifests
```

**Database Flags**:
- `scraped_at IS NOT NULL`: Has basic metadata
- `full_content_scraped_at IS NOT NULL`: Has ProseMirror content
- `manifest_generated_at IS NOT NULL`: Manifest directory exists
- `manifest_uploaded_at IS NOT NULL`: Uploaded to Arweave

## Testing the Pipeline

### Test with Limited Articles
```bash
# Test with 5 articles
npm run scrape -- --limit=5
npm run scrape:full -- --limit=5
npm run generate:manifests -- --limit=5

# Dry run upload (no actual upload)
npm run upload:manifests -- --dry-run --limit=5
```

### Check Progress
```bash
# View database statistics
npm run status
```

### Validate Manifest Structure
```bash
# Check generated manifest
cat data/manifests/{slug}/metadata.json | jq .

# Verify attachments
ls -lh data/manifests/{slug}/attachments/
```

## Database Schema

### Articles Table Key Fields
```sql
-- Basic metadata (Stage 1)
slug TEXT PRIMARY KEY
title TEXT
authors_json TEXT
scraped_at DATETIME

-- Full content (Stage 2)
content_prosemirror TEXT  -- ProseMirror JSON
content_markdown TEXT     -- NULL (deprecated)
word_count INTEGER
attachments_json TEXT
full_content_scraped_at DATETIME

-- Manifest tracking (Stages 3-4)
manifest_path TEXT
manifest_generated_at DATETIME
manifest_tx_id TEXT
manifest_uploaded_at DATETIME
```

## Helper Methods

### Database
**File**: `src/lib/database.js`

```javascript
// Get articles needing full content
getArticlesNeedingFullContent(limit)

// Get articles needing manifests
getArticlesNeedingManifests(limit)

// Get articles needing upload
getArticlesNeedingManifestUpload(limit)

// Update tracking
updateArticleFullContent(data)
updateArticleManifestGenerated(slug, path)
updateArticleManifestUploaded(slug, txId)
```

## Future Enhancements

### Version Support
- Store multiple versions per article
- Link versions with `previous_version_slug`
- Manifest can track version history

### Enhanced Metadata
- Add funding information
- Include peer review status
- Track preprint/publication status

### Search Integration
- Index plain text content
- Full-text search via Lunr.js
- Filter by metadata fields

### Analytics
- Track access patterns
- Monitor popular articles
- Generate citation metrics
