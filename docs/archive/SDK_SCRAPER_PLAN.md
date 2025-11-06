# SDK-Based Scraper - Implementation Plan

## Test Results Summary

### ✅ Verified Working:
1. **pub.getMany()** - Batch metadata (100 pubs/call)
2. **pub.get({ include: ['releases'] })** - Get release info
3. **pub.text.get({ params: { pubId } })** - Get full ProseMirror content
4. **Access**: 20/20 pubs succeeded - NO admin required for published pubs
5. **Content**: 1,000-74,000 chars per pub (vs 277 char truncated descriptions)
6. **Files**: PDFs embedded as `file` nodes in ProseMirror
7. **Versions**: Multiple releases supported via `historyKey`

## Architecture

### Data Flow:
```
1. Batch API (pub.getMany) → Basic metadata for 100 pubs
2. For each pub:
   a. pub.get({ include: ['releases'] }) → Get release list
   b. pub.text.get({ pubId, historyKey }) → Full ProseMirror JSON
   c. Extract:
      - Plain text (for search/abstract)
      - File nodes (for PDFs)
      - Word count
      - Full ProseMirror (for rendering)
3. Store in SQLite
```

### API Call Volume (3,746 pubs):
- Batch metadata: ~38 calls (100/batch)
- Individual details: ~3,746 calls (1/pub)
- Content: ~3,746 calls (1/pub, assuming 1 release each)
- **Total: ~7,530 calls** (vs 3,746 HTML scrapes)

### Rate Limiting Strategy:
- 100ms delay between text.get() calls
- Exponential backoff on errors
- Progress tracking for resume capability
- Estimated time: ~15-20 minutes total

## Database Changes Needed

### Current Schema (HAS):
✅ content_prosemirror TEXT
✅ content_markdown TEXT
✅ content_text_full TEXT
✅ word_count INTEGER
✅ attachments_json TEXT
✅ attachment_count INTEGER

### Missing from upsertArticle():
❌ INSERT statements don't include content_prosemirror
❌ INSERT statements don't include content_markdown
❌ INSERT statements don't include content_text_full
❌ INSERT statements don't include word_count

**FIX NEEDED**: Add these 4 fields to both INSERT statements in upsertArticle()

## Implementation Tasks

### 1. Update src/lib/database.js
- [x] Schema already has fields
- [ ] Add fields to upsertArticle() INSERT (new version)
- [ ] Add fields to upsertArticle() INSERT (first version)
- [ ] Update "unchanged" section to update content if better

### 2. Update scripts/scrape-to-sqlite.js
- [ ] Remove axios, cheerio imports
- [ ] Remove scrapeArticleContent() method
- [ ] Add extractTextFromProseMirror() helper
- [ ] Add extractFilesFromProseMirror() helper
- [ ] Add calculateWordCount() helper
- [ ] Update processArticle() to:
  - Call pub.text.get()
  - Extract text/files/wordcount
  - Store full ProseMirror JSON
- [ ] Add 100ms delay between text.get() calls
- [ ] Update stats tracking

### 3. Clean Up Old Files
- [ ] Remove scripts/test-web-scraping.js
- [ ] Remove scripts/test-html-structure.js
- [ ] Remove scripts/test-abstract-fields.js
- [ ] Remove scripts/test-sdk-full-content.js
- [ ] Remove scripts/test-export-pub.js
- [ ] Remove scripts/test-draft-content.js
- [ ] Keep scripts/test-sdk-comprehensive.js (documents SDK approach)
- [ ] Keep scripts/test-releases.js (documents version tracking)
- [ ] Keep scripts/test-text-access.js (proves 100% access rate)

### 4. Testing
- [ ] Test with --limit 10
- [ ] Verify all fields populated correctly
- [ ] Check word counts are accurate
- [ ] Verify attachments extracted correctly
- [ ] Check resume capability works

### 5. Full Import
- [ ] Run on all 3,746 pubs
- [ ] Monitor for rate limiting
- [ ] Verify completion

## Risks & Mitigations

### Risk: Rate Limiting
- **Mitigation**: 100ms delays, exponential backoff, resume capability
- **Fallback**: Increase delays if 429 errors occur

### Risk: Some pubs fail to fetch
- **Mitigation**: Log errors, continue processing, mark as partial
- **Impact**: Minimal - tested 20/20 success rate

### Risk: Large ProseMirror JSONs
- **Mitigation**: SQLite handles large TEXT fields well
- **Impact**: Minimal - largest test was 74KB

### Risk: Multiple releases complexity
- **Mitigation**: Start with latest release only
- **Future**: Add multi-version support later

## Success Criteria

- [ ] All 3,746 pubs scraped successfully
- [ ] content_text_full populated (>277 chars)
- [ ] content_prosemirror JSON stored
- [ ] attachments_json has PDF URLs
- [ ] word_count calculated correctly
- [ ] No rate limiting errors
- [ ] Parquet export includes full abstracts

## Rollback Plan

If SDK approach fails:
1. Old web scraping code is in git history
2. Can revert commits
3. Database schema supports both approaches
