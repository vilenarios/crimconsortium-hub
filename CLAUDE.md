# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Core Development:**
```bash
npm run build     # Generate complete static site (916+ pages)
npm run dev       # Local server at http://localhost:3000
npm run preview   # Build and run dev server (npm run build && npm run dev)
npm run validate  # Verify build integrity
```

**Data Import:**
```bash
npm run import         # Process consortium data from CrimRXiv (30-45 min)
npm run import-legacy  # Use enhanced-consortium-scraper.js (faster)
npm run import-html    # Download HTML articles (replaces PDFs, saves ~120MB)
npm run import-pdfs    # Download PDF attachments (large, ~126MB)
npm run status         # Check scraping progress
npm run reset          # Clear data and reimport (rm -rf data/final/* && import)
```

**Deployment:**
```bash
npm run sync     # Sync with ArDrive
npm run deploy   # Deploy to Arweave
npm run full     # Complete pipeline (import + build + sync + deploy)
```

## Architecture

**Static Site Generator for Arweave:**
- Generates 916+ static HTML pages from a 56MB consortium dataset
- 835 publications from 30 consortium members (17 research + 13 supporting)
- HTML articles archived in `data/final/articles-html/` (~5-10MB vs 126MB for PDFs)
- Output directory: `dist/main/` (~20-30MB for Arweave deployment)
- Uses ES6 modules (`type: "module"` in package.json)

**Build Pipeline:**
1. **Import**: `scripts/robust-incremental-scraper.js` scrapes CrimRXiv.com
   - Member definitions with regex patterns for affiliation detection
   - Incremental progress saved to `data/scraping-progress.json`
   - Articles: Use `npm run import-html` for HTML (~5MB) or `import-pdfs` for PDFs (~126MB)
2. **Process**: Consolidates into `data/final/consortium-dataset.json` (56MB)
3. **Build**: `scripts/build-enhanced-complete.js` generates static site
   - Uses `scripts/improved-article-template.js` for article pages
   - Generates homepage with 25 recent publications
   - Creates member pages with publication counts
4. **Deploy**: Upload `dist/main/` to Arweave (~$0.82 one-time cost)

**Key Components:**
- `src/lib/utils.js` - Logger and FileHelper utilities
- `src/lib/consortium-scraper.js` - Data scraping logic
- `src/lib/export-parser.js` - Parse CrimRXiv export format
- `src/lib/arfs-client.js` - ArDrive integration

**Dependencies:**
- `ardrive-core-js` - ArDrive file system integration
- `cheerio` - HTML parsing for scraping
- `axios` - HTTP requests
- `lunr` - Search index generation
- `handlebars` - Template engine

## Development Notes

**Static Site Requirements:**
- All CSS must be inline for Arweave compatibility
- Use gateway-relative links (no absolute URLs)
- Self-contained HTML with no external dependencies
- Maintain CrimRXiv visual design consistency

**Data Structure:**
- Dataset: `data/final/consortium-dataset.json` contains:
  - `members`: Array of 30 consortium institutions
  - `publications`: Array of 835 articles with metadata
  - `summary`: Statistics and counts
- Member detection via regex patterns in scraper
- PDFs stored locally for permanent archival
- HTML articles stored in `data/final/articles-html/` when using `npm run import-html`

**Testing & Development:**
- Use `npm run dev` for local testing with ArNS simulation
- Server includes undername routing simulation (e.g., `_subdomain.localhost:3000`)
- Check progress with `npm run status` during imports
- Validate build integrity with `npm run validate`

**Verification Checklist:**
- Homepage displays 25 most recent publications
- All 30 member pages accessible with correct counts
- 835 article pages with abstracts and metadata
- 37 PDFs downloadable from local archive
- Logo appears in header/footer
- Mobile responsive design works
- Internal links use relative paths (no absolute URLs)
- All CSS is inline (no external stylesheets)