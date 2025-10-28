# PubPub SDK Migration Plan
## From HTML Scraping to Official API Integration

**Document Version:** 1.0
**Date:** 2025-10-21
**Status:** Planning Phase

---

## Executive Summary

This document outlines the migration from HTML scraping (using Cheerio + Axios) to the official PubPub SDK for data collection from CrimRXiv. The migration will provide:

✅ **More reliable data access** - No breaking when HTML structure changes
✅ **Richer metadata** - Access to structured ProseMirror content format
✅ **Better performance** - Batch queries instead of page-by-page scraping
✅ **Official support** - Using maintained SDK with proper types
✅ **Accurate data** - Direct database access vs. parsing rendered HTML

---

## Current State Analysis

### What We Currently Scrape

**From Member Pages (`/uomcriminology`, etc.):**
- List of publication slugs
- Basic title information
- Links to publications

**From Individual Publication Pages (`/pub/{slug}`):**
- ✅ Title
- ✅ Description/Abstract
- ✅ Full content (text + HTML)
- ✅ DOI
- ✅ Authors (names only, from meta tags)
- ✅ Publication date
- ✅ Download links (PDF, Word, EPUB, etc.)
- ✅ Content sections (headings + content)
- ✅ References
- ✅ Version-of links (external URLs)
- ✅ Member associations (inferred from author affiliations)

**Current Data Structure (886 publications):**
```json
{
  "id": "slug",
  "slug": "slug",
  "title": "...",
  "description": "abstract",
  "fullContent": "text extraction",
  "fullContentHTML": "html extraction",
  "versionOfUrl": "external link",
  "doi": "doi string",
  "authors": [{"name": "...", "affiliation": "", "order": 1}],
  "createdAt": "ISO date",
  "downloads": {"pdf": "url", "word": "url"},
  "sections": [{"heading": "...", "content": "...", "level": "h2", "wordCount": 100}],
  "references": ["citation strings"],
  "memberAssociations": ["member-id"],
  "memberNames": ["Member Name"],
  "originalUrl": "https://www.crimrxiv.com/pub/...",
  "scrapedAt": "ISO date",
  "source": "robust-incremental-scraping"
}
```

### Limitations of HTML Scraping

1. **Fragile** - Breaks when PubPub changes HTML structure
2. **Incomplete** - Missing structured author affiliations, ORCID IDs
3. **Inaccurate** - Text extraction from HTML loses formatting, structure
4. **Slow** - Individual HTTP requests for each page (2-3 second delays)
5. **Content loss** - HTML extraction doesn't capture ProseMirror document structure
6. **No relationships** - Can't easily get collection memberships, pub edges, reviews

---

## PubPub SDK Capabilities

### Available SDK Methods

**Authentication:**
```typescript
const pubpub = await PubPub.createSDK({
  communityUrl: 'https://www.crimrxiv.com',
  email: 'your-email@example.com',
  password: 'your-password'
})
```

**Querying Publications:**
```typescript
// Get single pub
const pub = await pubpub.pub.get({ slugOrId: 'my-pub' })

// Get multiple pubs with filtering
const pubs = await pubpub.pub.getMany({
  limit: 100,
  offset: 0,
  filter: { /* filtering criteria */ },
  orderBy: 'updatedAt',
  orderDirection: 'desc'
})

// Advanced query
const results = await pubpub.pub.queryMany({
  query: { /* complex filters */ }
})
```

**Available Data Per Pub:**
- `id` (UUID)
- `slug`
- `title`
- `description`
- `content` (ProseMirror JSON document - **richer than HTML**)
- `doi`
- `customPublishedAt`
- `releases` (versions)
- `attributions` (authors with **full affiliations, ORCID, roles**)
- `downloads` (file attachments)
- `crossrefDepositRecordId`
- `pubEdges` (relationships to other pubs)
- `collectionPubs` (which collections/communities it belongs to)
- `discussions` (comments)
- `reviews` (peer review data)

**Collections (Consortium Members):**
```typescript
const collections = await pubpub.collection.getMany()
// Each consortium member likely has their own collection
```

**Attributions (Enhanced Author Data):**
```typescript
const attributions = await pubpub.attribution.getMany({ pubId: 'pub-uuid' })
// Returns: name, orcid, affiliation, isAuthor, roles, order
```

---

## Data Mapping: SDK → Current Structure

### Enhanced Fields We Can Now Capture

| Current Field | SDK Source | Enhancement |
|--------------|-----------|-------------|
| `id` / `slug` | `pub.id`, `pub.slug` | ✅ Same |
| `title` | `pub.title` | ✅ Same |
| `description` | `pub.description` | ✅ Same |
| `fullContent` | Parse from `pub.content` (ProseMirror) | ✨ **Better**: Structured JSON → Text |
| `fullContentHTML` | Render `pub.content` to HTML | ✨ **Better**: Clean semantic HTML |
| `doi` | `pub.doi` | ✅ Same |
| `authors` | `pub.attributions` | ✨ **Better**: Now includes ORCID, affiliation, roles |
| `createdAt` | `pub.customPublishedAt` or `pub.createdAt` | ✅ Better accuracy |
| `downloads` | `pub.downloads` | ✅ Structured attachments |
| `sections` | Parse from `pub.content` nodes | ✨ **Better**: Precise section structure |
| `references` | Parse from `pub.content` citation nodes | ✨ **Better**: Structured citations |
| `memberAssociations` | `pub.collectionPubs[].collection` | ✨ **Better**: Direct collection membership |
| `versionOfUrl` | `pub.pubEdges` (type: 'version-of') | ✨ **Better**: Structured relationships |

### New Fields We Can Add

```typescript
{
  // ... existing fields ...

  // NEW: Enhanced author data
  "authors": [{
    "name": "John Doe",
    "orcid": "0000-0001-2345-6789",  // NEW
    "affiliation": "University of Manchester, Dept of Criminology",  // NOW POPULATED
    "roles": ["Author", "Conceptualization"],  // NEW
    "order": 1,
    "isCorresponding": false  // NEW
  }],

  // NEW: Collection memberships (consortium members)
  "collections": [{
    "id": "collection-uuid",
    "title": "University of Manchester Criminology",
    "slug": "uomcriminology"
  }],

  // NEW: Publication relationships
  "pubEdges": [{
    "type": "version-of",
    "targetPub": { "id": "...", "title": "...", "url": "..." }
  }],

  // NEW: Release/version information
  "releases": [{
    "id": "release-uuid",
    "createdAt": "2024-01-15T...",
    "noteText": "Version 2: Updated analysis"
  }],

  // NEW: DOI deposit status
  "doi DeposIT Status": "submitted" | "completed" | null,

  // NEW: Review data (if published reviews exist)
  "reviews": [{
    "id": "review-uuid",
    "score": 4.5,
    "reviewContent": "..."
  }]
}
```

---

## ProseMirror Content Structure

PubPub stores article content as **ProseMirror JSON** (not HTML). This is richer and more structured.

### Example ProseMirror Document:
```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1, "id": "introduction" },
      "content": [{ "type": "text", "text": "Introduction" }]
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "This study examines..." }]
    },
    {
      "type": "citation",
      "attrs": {
        "value": "Smith, J. (2020). Crime and Society.",
        "unstructuredValue": "..."
      }
    }
  ]
}
```

### Parsing Strategy:
```typescript
function parseProseMirrorContent(pmDoc) {
  const fullText = extractTextFromProseMirror(pmDoc);
  const sections = extractSectionsFromProseMirror(pmDoc);
  const references = extractCitationsFromProseMirror(pmDoc);
  const html = renderProseMirrorToHTML(pmDoc);  // Use ProseMirror renderer

  return { fullText, sections, references, html };
}
```

---

## Proposed Architecture

### New Scraper Class: `PubPubSDKCollector`

```typescript
import { PubPub } from '@pubpub/sdk';

class PubPubSDKCollector {
  constructor() {
    this.sdk = null;
    this.consortiumMembers = [...]; // Same 30 members
  }

  async initialize() {
    // Authenticate once
    this.sdk = await PubPub.createSDK({
      communityUrl: 'https://www.crimrxiv.com',
      email: process.env.PUBPUB_EMAIL,
      password: process.env.PUBPUB_PASSWORD
    });
  }

  async collectAllData() {
    // Step 1: Get all collections (consortium members)
    const collections = await this.getAllCollections();

    // Step 2: Get all pubs for each collection
    const publications = await this.getAllPublications();

    // Step 3: Enrich each pub with full data
    const enrichedPubs = await this.enrichPublications(publications);

    // Step 4: Build final dataset
    return this.buildDataset(collections, enrichedPubs);
  }

  async getAllCollections() {
    // Get all consortium member collections
    const allCollections = await this.sdk.collection.getMany({ limit: 100 });

    // Filter to known consortium members
    return allCollections.filter(col =>
      this.consortiumMembers.some(m => m.slug === col.slug)
    );
  }

  async getAllPublications() {
    // Batch query all pubs (much faster than scraping)
    let offset = 0;
    const limit = 100;
    const allPubs = [];

    while (true) {
      const batch = await this.sdk.pub.getMany({
        limit,
        offset,
        orderBy: 'createdAt',
        orderDirection: 'desc'
      });

      if (batch.length === 0) break;

      allPubs.push(...batch);
      offset += limit;

      console.log(`Fetched ${allPubs.length} publications...`);
    }

    return allPubs;
  }

  async enrichPublications(pubs) {
    const enriched = [];

    for (const pub of pubs) {
      try {
        // Get full pub details with related data
        const fullPub = await this.sdk.pub.get({
          slugOrId: pub.id,
          include: ['attributions', 'collectionPubs', 'pubEdges', 'downloads']
        });

        // Parse ProseMirror content
        const parsedContent = this.parseProseMirrorContent(fullPub.content);

        // Determine consortium member associations
        const collections = fullPub.collectionPubs.map(cp => cp.collection);
        const memberAssociations = collections
          .filter(c => this.consortiumMembers.some(m => m.slug === c.slug))
          .map(c => this.consortiumMembers.find(m => m.slug === c.slug));

        enriched.push({
          // Core metadata
          id: fullPub.id,
          slug: fullPub.slug,
          title: fullPub.title,
          description: fullPub.description,
          doi: fullPub.doi,
          createdAt: fullPub.customPublishedAt || fullPub.createdAt,

          // Enhanced content
          fullContent: parsedContent.fullText,
          fullContentHTML: parsedContent.html,
          sections: parsedContent.sections,
          references: parsedContent.references,

          // Enhanced authors
          authors: fullPub.attributions.map(attr => ({
            name: attr.name,
            orcid: attr.orcid,
            affiliation: attr.affiliation,
            roles: attr.roles,
            order: attr.order,
            isCorresponding: attr.isCorresponding
          })),

          // Collections (consortium members)
          collections: collections.map(c => ({
            id: c.id,
            title: c.title,
            slug: c.slug
          })),
          memberAssociations: memberAssociations.map(m => m.id),
          memberNames: memberAssociations.map(m => m.name),

          // Downloads/attachments
          downloads: this.parseDownloads(fullPub.downloads),

          // Pub edges (version-of links, etc.)
          pubEdges: fullPub.pubEdges.map(edge => ({
            type: edge.relationType,
            targetPub: edge.targetPub
          })),
          versionOfUrl: this.extractVersionOfUrl(fullPub.pubEdges),

          // Metadata
          originalUrl: `https://www.crimrxiv.com/pub/${fullPub.slug}`,
          collectedAt: new Date().toISOString(),
          source: 'pubpub-sdk'
        });

        console.log(`✅ Enriched: ${fullPub.title.substring(0, 50)}...`);

      } catch (error) {
        console.error(`❌ Failed to enrich ${pub.slug}:`, error.message);
      }
    }

    return enriched;
  }

  parseProseMirrorContent(pmDoc) {
    // Convert ProseMirror JSON to structured data
    if (!pmDoc || !pmDoc.content) {
      return { fullText: '', html: '', sections: [], references: [] };
    }

    const fullText = this.extractTextFromNodes(pmDoc.content);
    const sections = this.extractSections(pmDoc.content);
    const references = this.extractCitations(pmDoc.content);
    const html = this.renderToHTML(pmDoc);

    return { fullText, html, sections, references };
  }

  extractTextFromNodes(nodes, level = 0) {
    let text = '';

    for (const node of nodes) {
      if (node.type === 'text') {
        text += node.text;
      } else if (node.content) {
        text += this.extractTextFromNodes(node.content, level + 1);
      }

      // Add spacing between blocks
      if (['paragraph', 'heading'].includes(node.type)) {
        text += '\n\n';
      }
    }

    return text.trim();
  }

  extractSections(nodes) {
    const sections = [];
    let currentHeading = null;
    let currentContent = [];

    for (const node of nodes) {
      if (node.type === 'heading') {
        // Save previous section
        if (currentHeading) {
          sections.push({
            heading: this.extractTextFromNodes([currentHeading]),
            content: this.extractTextFromNodes(currentContent),
            level: `h${currentHeading.attrs.level}`,
            wordCount: this.extractTextFromNodes(currentContent).split(' ').length
          });
        }

        // Start new section
        currentHeading = node;
        currentContent = [];
      } else {
        currentContent.push(node);
      }
    }

    // Save last section
    if (currentHeading) {
      sections.push({
        heading: this.extractTextFromNodes([currentHeading]),
        content: this.extractTextFromNodes(currentContent),
        level: `h${currentHeading.attrs.level}`,
        wordCount: this.extractTextFromNodes(currentContent).split(' ').length
      });
    }

    return sections;
  }

  extractCitations(nodes) {
    const citations = [];

    function traverse(nodeList) {
      for (const node of nodeList) {
        if (node.type === 'citation') {
          citations.push(node.attrs.value || node.attrs.unstructuredValue);
        }
        if (node.content) {
          traverse(node.content);
        }
      }
    }

    traverse(nodes);
    return citations;
  }

  renderToHTML(pmDoc) {
    // Use ProseMirror's DOMSerializer or simple converter
    // For now, a simple implementation:
    const html = this.nodesToHTML(pmDoc.content);
    return `<div class="pub-content">${html}</div>`;
  }

  nodesToHTML(nodes) {
    let html = '';

    for (const node of nodes) {
      switch (node.type) {
        case 'heading':
          const level = node.attrs.level;
          const headingText = this.extractTextFromNodes([node]);
          html += `<h${level}>${headingText}</h${level}>`;
          break;
        case 'paragraph':
          html += `<p>${this.extractTextFromNodes([node])}</p>`;
          break;
        case 'text':
          html += node.text;
          break;
        // Add more node types as needed
      }
    }

    return html;
  }

  parseDownloads(downloads) {
    // SDK provides structured download URLs
    const result = {};

    if (downloads?.pdf) result.pdf = downloads.pdf;
    if (downloads?.docx) result.word = downloads.docx;
    if (downloads?.epub) result.epub = downloads.epub;

    return result;
  }

  extractVersionOfUrl(pubEdges) {
    const versionOf = pubEdges.find(edge => edge.relationType === 'version-of');
    return versionOf?.targetPub?.url || versionOf?.externalPublication || null;
  }

  async buildDataset(collections, publications) {
    return {
      metadata: {
        name: 'CrimConsortium SDK Dataset',
        description: `${publications.length} publications from ${collections.length} consortium members`,
        version: '8.0',
        lastUpdated: new Date().toISOString(),
        collectionMethod: 'PubPub SDK API',
        sdkVersion: '1.1.1'
      },

      summary: {
        totalMembers: collections.length,
        totalPublications: publications.length,
        publicationsWithOrcid: publications.filter(p =>
          p.authors.some(a => a.orcid)
        ).length,
        publicationsWithDOI: publications.filter(p => p.doi).length
      },

      members: collections.map(c => ({
        id: c.slug,
        name: c.title,
        slug: c.slug,
        collectionId: c.id,
        publicationCount: publications.filter(p =>
          p.memberAssociations.includes(c.slug)
        ).length
      })),

      publications: publications.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      )
    };
  }

  async cleanup() {
    if (this.sdk) {
      await this.sdk.logout();
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Setup & Authentication (Week 1)

**Tasks:**
1. Install PubPub SDK: `npm install @pubpub/sdk`
2. Create `.env` variables for PubPub credentials:
   ```bash
   PUBPUB_COMMUNITY_URL=https://www.crimrxiv.com
   PUBPUB_EMAIL=your-crimrxiv-account@email.com
   PUBPUB_PASSWORD=your-password
   ```
3. Create `scripts/pubpub-sdk-collector.js` with authentication test
4. Verify connection and list first 10 pubs

**Validation:**
- Successfully authenticate
- List publications
- Get single pub with full details

### Phase 2: Data Collection Logic (Week 2)

**Tasks:**
1. Implement `getAllCollections()` - map to 30 consortium members
2. Implement `getAllPublications()` - batch fetch all pubs
3. Add progress tracking (similar to current scraper)
4. Test with subset (first 50 pubs)

**Validation:**
- Collect all 886+ publications
- Confirm no duplicates
- Verify collection memberships

### Phase 3: ProseMirror Parsing (Week 2-3)

**Tasks:**
1. Implement `parseProseMirrorContent()`
2. Extract text, sections, citations
3. Render to clean HTML
4. Compare output quality with current HTML scraping

**Validation:**
- Text extraction matches or exceeds current quality
- Section detection works correctly
- HTML output is clean and semantic

### Phase 4: Data Enrichment (Week 3)

**Tasks:**
1. Extract enhanced author data (ORCID, affiliations, roles)
2. Parse pub edges (version-of links)
3. Extract structured downloads
4. Map collections to member associations

**Validation:**
- All current fields populated
- New fields (ORCID, roles) captured
- Version-of links extracted correctly

### Phase 5: Build System Integration (Week 4)

**Tasks:**
1. Update `build-enhanced-complete.js` to use new dataset
2. Modify article templates to display enhanced data (ORCID links, roles)
3. Test build process with SDK-collected data
4. Compare final site with HTML-scraped version

**Validation:**
- Build generates same 916+ pages
- Article pages show enhanced author info
- No broken links or missing data

### Phase 6: Parallel Testing (Week 5)

**Tasks:**
1. Run both scrapers in parallel
2. Compare datasets for accuracy
3. Identify any missing data from SDK approach
4. Document differences and improvements

**Validation:**
- SDK dataset is equal or superior in every field
- No regression in data quality
- Performance improvements documented

### Phase 7: Deployment & Cutover (Week 6)

**Tasks:**
1. Update `npm run import` to use SDK collector
2. Archive old HTML scrapers
3. Update CLAUDE.md documentation
4. Deploy SDK-based system

**Validation:**
- Successful import run
- Build process works
- Site deployed to Arweave

---

## Advantages of SDK Migration

### 1. **Reliability**
- ❌ HTML scraping breaks when PubPub updates their UI
- ✅ SDK uses stable API contracts

### 2. **Performance**
- ❌ Current: ~886 HTTP requests × 2-3 sec = ~45 minutes
- ✅ SDK: Batch queries, ~5-10 minutes total

### 3. **Data Quality**
- ❌ HTML text extraction loses formatting
- ✅ ProseMirror structured content preserves document structure

### 4. **Completeness**
- ❌ Missing: ORCID, affiliations, roles, structured citations
- ✅ SDK provides: Full author metadata, collection relationships, pub edges

### 5. **Maintainability**
- ❌ Fragile CSS selectors: `.pub-body-component`, `meta[name="citation_author"]`
- ✅ Typed SDK methods: `pub.get()`, `pub.getMany()`

### 6. **Future-Proof**
- ❌ PubPub Legacy is being deprecated (May 2025)
- ✅ SDK will be updated for new PubPub Platform

---

## Risks & Mitigation

### Risk 1: Authentication Requirements
**Issue:** Need CrimRXiv account credentials
**Mitigation:**
- Use dedicated service account
- Store credentials securely in `.env`
- Add to `.gitignore`

### Risk 2: API Rate Limits
**Issue:** SDK might have rate limits
**Mitigation:**
- Use batch queries (100 items per request)
- Add delays if needed
- Monitor for 429 responses

### Risk 3: ProseMirror Parsing Complexity
**Issue:** ProseMirror format is complex
**Mitigation:**
- Start with simple text extraction
- Iteratively improve parsing
- Use ProseMirror libraries if available

### Risk 4: Missing Historical Data
**Issue:** SDK might not expose all legacy PubPub features
**Mitigation:**
- Test with known publications first
- Keep HTML scraper as fallback for edge cases
- Document any gaps

### Risk 5: PubPub Platform Migration (May 2025)
**Issue:** Current PubPub Legacy is being deprecated
**Mitigation:**
- SDK will be updated for new platform
- Using SDK ensures smooth transition
- Monitor PubPub announcements

---

## Success Criteria

✅ **Complete data parity:** All 886+ publications collected with equal or better data quality
✅ **Enhanced metadata:** ORCID, affiliations, roles captured for authors
✅ **Performance improvement:** Collection time reduced from 45 min to < 10 min
✅ **Build compatibility:** Existing build system works with new dataset
✅ **Documentation:** Migration documented, CLAUDE.md updated
✅ **Future-ready:** SDK-based approach compatible with new PubPub Platform

---

## Next Steps

1. **Decision:** Approve migration plan
2. **Setup:** Install SDK, configure credentials
3. **Prototype:** Build minimal SDK collector for 10 pubs
4. **Review:** Validate data quality and structure
5. **Implement:** Follow phased rollout plan
6. **Deploy:** Cutover to SDK-based collection

---

## Questions for Discussion

1. **Authentication:** Do we have/can we create a CrimRXiv service account?
2. **Permissions:** Can the account access all 30 consortium member collections?
3. **Timeline:** Is 6-week phased approach acceptable?
4. **Fallback:** Should we keep HTML scraper as backup?
5. **Platform Migration:** How will PubPub Legacy → Platform transition affect us?

