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
npm run import         # Process consortium data from CrimRXiv (30-45 min, uses robust-incremental-scraper.js)
npm run import-legacy  # Use enhanced-consortium-scraper.js (faster alternative)
npm run import-html    # Download HTML articles (saves ~120MB vs PDFs)
npm run import-pdfs    # Download PDF attachments (large, ~126MB)
npm run status         # Check scraping progress (reads data/scraping-progress.json)
npm run reset          # Clear data and reimport (rm -rf data/final/* && import)
```

**Deployment:**
```bash
npm run sync     # Sync with ArDrive
npm run deploy   # Deploy to Arweave
npm run full     # Complete pipeline (import + build + sync + deploy)
```

## Architecture Overview

**Static Site Generator for Arweave Permaweb:**
- Generates 916+ static HTML pages from a 56MB consortium dataset
- 835 publications from 30 consortium members (17 research + 13 supporting)
- Output directory: `dist/main/` (~20-30MB for Arweave deployment)
- Uses ES6 modules (`type: "module"` in package.json)
- Self-contained with inline CSS (no external dependencies for Arweave compatibility)

**Core Pipeline (4 Stages):**

1. **Scrape** (`scripts/robust-incremental-scraper.js`)
   - Scrapes CrimRXiv.com with incremental resume capability
   - 30 consortium members defined with regex patterns for affiliation detection
   - Progress saved to `data/scraping-progress.json` (resume-friendly, saves every 5 items)
   - Scraper handles: member discovery, article metadata, author affiliations
   - Optional: Downloads HTML articles (~5MB) or PDFs (~126MB)

2. **Consolidate** (automatic during scrape)
   - Merges all scraped data into `data/final/consortium-dataset.json` (56MB)
   - Structure: `{ members: [], publications: [], summary: {} }`
   - Members array: 30 institutions with IDs, names, slugs
   - Publications array: 835 articles with full metadata, abstracts, author lists

3. **Build** (`scripts/build-enhanced-complete.js`)
   - Generates static HTML pages from dataset
   - Homepage: 25 most recent publications with article cards
   - Article pages: Uses `scripts/improved-article-template.js` (academic format with references)
   - Member pages: 30 institution pages with publication counts and lists
   - Assets: Copies images, PDFs, favicon to `dist/main/assets/`

4. **Deploy** (Arweave upload scripts)
   - Upload `dist/main/` to Arweave (~$0.82 one-time cost for permanent storage)
   - Uses ArDrive integration via `src/lib/arfs-client.js`
   - Result: Permanent, decentralized academic archive

**Key Libraries:**
- `src/lib/utils.js` - Logger (team-friendly output), FileHelper, ProgressTracker, withRetry
- `src/lib/consortium-scraper.js` - Core scraping logic with member pattern matching
- `src/lib/export-parser.js` - Parse CrimRXiv export format
- `src/lib/arfs-client.js` - ArDrive integration for Arweave uploads

**Important Dependencies:**
- `ardrive-core-js` - ArDrive file system integration (Arweave uploads)
- `cheerio` - HTML parsing for web scraping
- `axios` - HTTP requests with retry logic
- `lunr` - Search index generation (if enabled)
- `handlebars` - Template engine (for future features)
- `chalk` - Terminal colors for logger output

## Development Workflow

**First Time Setup:**
```bash
npm install
npm run import       # Scrape data (30-45 min), OR restore from backup: cp -r data_backup/final/* data/final/
npm run build        # Generate static site (~15 sec)
npm run dev          # Test at http://localhost:3000
```

**Incremental Development:**
- Scraper crashed? Just run `npm run import` again - it resumes from `data/scraping-progress.json`
- Modify templates? Re-run `npm run build` to regenerate pages
- Testing locally? `npm run dev` simulates ArNS routing (includes undername paths like `_subdomain.localhost:3000`)

**Understanding the Dev Server (`scripts/serve.js`):**
- Serves from `dist/main/` directory
- Simulates ArNS undernames for future multi-app deployment
- Shows helpful startup checklist for verification
- Requires build to exist (run `npm run build` first)

## Key Architecture Patterns

**Arweave Compatibility Requirements:**
- All CSS must be inline (no external stylesheets)
- Use relative paths for all links (no absolute URLs like `/articles/...`)
- No external dependencies (fonts, CDNs, external scripts)
- Self-contained HTML files that work without a server
- Maintain CrimRXiv visual design consistency

**Member Detection System:**
- 30 consortium members defined in `robust-incremental-scraper.js` (lines 19-51)
- Each member has: `id`, `name`, `slug`
- Affiliation patterns in `consortiumPatterns` array (lines 66-87)
- Uses regex matching on author affiliations to assign publications to members
- Example pattern: `['University of Manchester', 'Manchester.*Criminology']`

**Incremental Scraping (Resume-Friendly):**
- Progress tracking in `data/scraping-progress.json`
- Saves after every 5 publications (`config.saveProgressEvery`)
- Can resume from crash without losing progress
- Tracks: `{ phase, currentMemberIndex, processedPublications, lastSaved }`

**Data Flow:**
```
CrimRXiv.com → robust-incremental-scraper.js → data/scraping-progress.json
                                              ↓
                                data/final/consortium-dataset.json
                                              ↓
                            build-enhanced-complete.js
                                              ↓
                                       dist/main/ (916+ HTML files)
                                              ↓
                                         Arweave
```

## Testing & Verification

**Pre-Deployment Checklist:**
- [ ] Homepage (`dist/main/index.html`) displays 25 most recent publications
- [ ] All 30 member pages exist in `dist/main/members/` with correct counts
- [ ] 835 article pages in `dist/main/articles/` with abstracts
- [ ] PDFs copied to `dist/main/assets/pdfs/` (if using `import-pdfs`)
- [ ] Logo appears in header/footer (`dist/main/assets/images/`)
- [ ] Mobile responsive design works
- [ ] All links are relative paths (no absolute URLs)
- [ ] All CSS is inline (inspect any page's `<style>` tag)
- [ ] No console errors when viewing pages locally

**Validation Commands:**
```bash
npm run status       # Check scraping progress mid-import
npm run validate     # Verify build integrity after build
npm run dev          # Manual testing at http://localhost:3000
```

## File Organization

**Critical Files (Don't Delete):**
- `data/final/consortium-dataset.json` - 56MB master dataset (source of truth)
- `data/scraping-progress.json` - Resume state for incremental scraper
- `scripts/build-enhanced-complete.js` - Main build orchestrator
- `scripts/improved-article-template.js` - Article page template generator
- `src/lib/utils.js` - Shared utilities (Logger, FileHelper)

**Generated/Replaceable:**
- `dist/main/**` - Entire build output (regenerated by `npm run build`)
- `data/final/articles-html/**` - Downloaded HTML articles (regenerated by `npm run import-html`)
- `data/final/pdfs/**` - Downloaded PDFs (regenerated by `npm run import-pdfs`)

**Template Pattern:**
- Article pages use function-based templates (not Handlebars)
- See `generateImprovedArticlePage()` in `scripts/improved-article-template.js:6`
- Inline CSS generation for academic styling
- Processes references into individual citation entries

## Common Tasks

**Adding a New Consortium Member:**
1. Edit `scripts/robust-incremental-scraper.js:19-51` (add to `allConsortiumMembers`)
2. Edit `scripts/robust-incremental-scraper.js:66-87` (add affiliation patterns to `consortiumPatterns`)
3. Run `npm run reset` to re-scrape with new member
4. Run `npm run build` to regenerate site

**Updating Existing Data:**
```bash
npm run import       # Incremental: only fetches new publications since last run
npm run build        # Regenerate site with updated data
```

**Complete Fresh Start:**
```bash
npm run reset        # Clears data/final/* and re-runs import
```

**Debugging Scraper Issues:**
- Check `data/scraping-progress.json` for current state
- Run `npm run status` to see progress statistics
- Scraper logs show which member/publication currently processing
- If stuck, delete `data/scraping-progress.json` and re-run `npm run import`