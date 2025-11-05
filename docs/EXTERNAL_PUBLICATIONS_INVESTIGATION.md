# External Publications Investigation

## Problem Statement
CrimRXiv articles often link to external sources (ResearchGate, ArXiv, etc.) indicating where the article was originally published or is also available. Example from https://www.crimrxiv.com/pub/w6df4ln2/release/1:
- Shows "Available on ResearchGate" with link to author's ResearchGate profile
- This metadata is critical for article provenance and cross-referencing

## Investigation Results

### ✅ Data IS Available in PubPub API

**Field Name**: `outboundEdges` (array)
**Relation Type**: `version` (version-of relationship)

**Structure** (from actual API response):
```json
{
  "outboundEdges": [
    {
      "id": "b18abf6c-5dcc-46a5-a0ac-41bb13542610",
      "pubId": "27b9d6c0-6563-4a7a-8084-41333ebee833",
      "externalPublicationId": "6e57388e-804a-4b92-b073-e73a900843fb",
      "targetPubId": null,
      "relationType": "version",
      "rank": "h",
      "pubIsParent": false,
      "approvedByTarget": false,
      "createdAt": "2025-11-04T14:50:36.356Z",
      "updatedAt": "2025-11-04T14:50:36.356Z"
    }
  ]
}
```

### Current Status

**❌ NOT Captured**: Our scraper does NOT currently fetch outbound edges
**❌ NOT Stored**: Our database does NOT have fields for external publications
**❌ NOT Displayed**: Our article pages do NOT show external publication links

**API Include Required**: `include: ['outboundEdges']`
**Articles with Data**: ~40% of recent articles have outbound edges (19 out of 50 tested)

### Next Steps Required

1. **Update Scraper** (`scripts/scrape-to-sqlite.js`)
   - Add `'inboundEdges'` and `'outboundEdges'` to the `include` array (line 263)
   - Fetch external publication details using `externalPublicationId`
   - Store external publication data

2. **Update Database Schema** (`src/lib/database.js`)
   - Add field: `external_publications_json TEXT` (JSON array of external publication objects)
   - Migration to add column to existing database

3. **Fetch External Publication Details**
   - Need to determine PubPub SDK endpoint for fetching external publication by ID
   - External publication likely contains: title, url, description, publication date
   - Test with: `externalPublicationId: "6e57388e-804a-4b92-b073-e73a900843fb"`

4. **Update Export Script** (`scripts/export-to-parquet.js`)
   - Include `external_publications_json` in Parquet export
   - May need to flatten or summarize for browser queries

5. **Update Article Detail Component** (`src/components/article-detail.js`)
   - Display external publications in article metadata section
   - Show as "Also available on" or "Version of" with appropriate links
   - UI design: Badge/chip style similar to DOI display

6. **Testing**
   - Test with article `w6df4ln2` (known to have ResearchGate link)
   - Verify scraping captures external publication details
   - Verify display shows correct URLs and descriptions

## Example Implementation

### Database Schema Addition
```sql
ALTER TABLE articles ADD COLUMN external_publications_json TEXT;
```

### Scraper Update (Pseudocode)
```javascript
// In fetchAndProcess method
include: ['collectionPubs', 'attributions', 'community', 'draft', 'inboundEdges', 'outboundEdges']

// In processArticle method
const externalPubs = [];
if (pub.outboundEdges && pub.outboundEdges.length > 0) {
  for (const edge of pub.outboundEdges) {
    if (edge.externalPublicationId) {
      // Fetch external publication details
      const extPub = await sdk.externalPublication.get({
        params: { externalPublicationId: edge.externalPublicationId }
      });
      externalPubs.push({
        title: extPub.title,
        url: extPub.url,
        description: extPub.description,
        relationType: edge.relationType,
        createdAt: edge.createdAt
      });
    }
  }
}

article.external_publications_json = JSON.stringify(externalPubs);
```

### UI Display Example
```html
<!-- In article detail page -->
<div class="external-publications">
  <h3>Also Available On</h3>
  <div class="external-pub-list">
    <a href="https://www.researchgate.net/..." class="external-pub-badge">
      <span class="platform">ResearchGate</span>
      <span class="icon">→</span>
    </a>
  </div>
</div>
```

## Additional Notes

- **inboundEdges**: Also available, shows when other articles reference this one as a version
- **relationType values**: "version", possibly others (needs investigation)
- **SDK Documentation**: Need to find PubPub SDK docs for externalPublication endpoints
- **Rate Limiting**: May need delays when fetching external publication details

## Priority
**HIGH** - This is critical metadata for academic integrity and cross-referencing
