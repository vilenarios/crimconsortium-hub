# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚡ Quick Reference

**Most Common Operations:**
```bash
npm run dev              # Start dev server (http://localhost:3005)
npm run import           # Scrape CrimRXiv to SQLite (30-45 min, needs .env)
npm run export           # SQLite → Parquet export (~30 sec)
npm run build            # Build SPA for local preview (includes all resources)
npm run build:prod       # Build SPA for Arweave (excludes external resources)
```

**IMPORTANT Migration Note:**
- ✅ **Current implementation:** SPA with DuckDB-WASM (as described in this document)
- ⚠️ **README.md is outdated:** Still describes old SSG architecture (being updated)
- 📖 **Source of truth:** This CLAUDE.md file reflects the actual codebase

**Prerequisites:**
- `.env` file required for `npm run import` (see Security Considerations section)
- `data/sqlite/crimrxiv.db` must exist before running `npm run export`
- Node.js 18+ required for build-time scripts
- Modern browser with WebAssembly support for runtime

## Commands

**Core Development:**
```bash
npm run dev           # Vite dev server at http://localhost:3005
npm run build         # Build SPA to dist/ (includes all resources for local testing)
npm run build:prod    # Build for Arweave deployment (excludes external resources)
npm run preview       # Preview production build (custom server)
npm run preview:vite  # Preview using Vite preview server
```

**Data Pipeline:**
```bash
npm run import              # Scrape CrimRXiv → SQLite (30-45 min, uses PubPub SDK)
npm run import:pdfs         # Download PDF attachments
npm run export              # SQLite → Parquet for browser queries (~30 sec)
npm run upload:parquet      # Upload Parquet file to Arweave
npm run upload:wasm         # Upload DuckDB WASM files to Arweave
npm run upload:articles     # Upload article markdown to Arweave
```

**Important:** Before running `npm run import`, ensure `.env` file exists with:
```env
PUBPUB_EMAIL=your-email@example.com
PUBPUB_PASSWORD=your-password
```
See `docs/SECURITY_CHECKLIST.md` for credential management best practices.

**Deployment:**
```bash
npm run sync                  # Sync with ArDrive
npm run generate:manifests    # Generate Arweave manifests
npm run upload:manifests      # Upload manifests to Arweave
```

**Development Utilities:**
```bash
node scripts/scraping-status.js    # Check import progress
```

## Architecture Overview

**Single Page Application (SPA) with Client-Side Database Queries**

This is a browser-based archive viewer that queries data directly in the browser using DuckDB-WASM. No backend required.

**Execution Contexts (Important!):**
- **Build-time (Node.js):** `scripts/*.js`, `src/lib/database.js` (SQLite operations)
- **Runtime (Browser):** `src/app.js`, `src/components/*.js`, `src/lib/parquet-db.js` (DuckDB-WASM)
- **Never mix:** SQLite is server-side only, DuckDB-WASM is browser-side only

### Tech Stack
- **Frontend**: Vite + Vanilla JavaScript (ES6 modules)
- **Database (Build-time)**: SQLite (source of truth)
- **Database (Runtime)**: DuckDB-WASM (runs in browser)
- **Data Format**: Apache Parquet (5MB columnar storage)
- **Routing**: Hash-based routing (`#/article/slug`)
- **Deployment Target**: Arweave Permaweb

### Key Features
- Instant page navigation (client-side routing)
- Full-text search across 3,700+ articles
- No backend server required
- Works on decentralized web (Arweave)
- Mobile-responsive design

## Data Pipeline (3 Stages)

```
Stage 1: CrimRXiv.com (PubPub API)
   ↓
Stage 2: SQLite Database (source of truth)
   scripts/scrape-to-sqlite.js → data/sqlite/crimrxiv.db
   ↓
Stage 3: Parquet Export (browser-optimized)
   scripts/export-to-parquet.js → public/data/metadata.parquet (5MB)
```

**Critical Architecture Decision**: SQLite is the **single source of truth**. Parquet files are **regenerated exports**, never updated in place. See `docs/PATTERN_GUIDE.md` for the universal pattern.

### Stage 1: Data Import (PubPub SDK)

**Script**: `scripts/scrape-to-sqlite.js`
**Source**: CrimRXiv.com (PubPub community)
**Output**: `data/sqlite/crimrxiv.db`
**Time**: 30-45 minutes for full import

Uses `@pubpub/sdk` to fetch:
- Full article metadata (title, abstract, DOI, license)
- Complete ProseMirror content (not truncated)
- Author affiliations
- PDF attachments (URLs and metadata)

**Key Features**:
- Incremental sync (only fetches new/updated articles)
- Batch processing (100 articles at a time)
- Rate limiting (100ms delay between requests)
- Automatic retry with exponential backoff

### Stage 2: SQLite Database

**File**: `src/lib/database.js`
**Location**: `data/sqlite/crimrxiv.db`
**Purpose**: Operational state tracking and single source of truth

**Schema** (`articles` table):
- Identity: `id`, `article_id`, `slug`, `version_number`
- Metadata: `title`, `abstract`, `doi`, `license`, `authors_json`
- Content: `content_prosemirror`, `content_markdown`, `content_text_full`
- Attachments: `attachments_json` (array of files)
- Arweave tracking: `article_markdown_tx_id`, `attachments_uploaded_json`

**Important Operations**:
- `upsertArticle()` - Insert or update article (idempotent)
- `getLatestArticles()` - Get recent publications
- `searchArticles()` - Full-text search
- `getArticleBySlug()` - Get single article

### Stage 3: Parquet Export

**Script**: `scripts/export-to-parquet.js`
**Input**: `data/sqlite/crimrxiv.db`
**Output**: `public/data/metadata.parquet` (5MB, committed to repo)
**Time**: ~30 seconds

Generates a **single Parquet file** with all article metadata optimized for browser queries:
- ZSTD compression (best for web delivery)
- Sorted by `published DESC` (most recent first)
- Row group size: 100,000 (optimized for range queries)
- Includes derived fields: `year`, `month`, `author_count`

**Why Parquet?**
- Efficient columnar storage (5MB vs 56MB JSON)
- DuckDB-WASM can query without downloading entire file (HTTP range requests)
- Fast filtering, aggregation, and search
- Perfect for read-heavy workloads (analytics, search)

## Frontend Architecture (SPA)

### Entry Points
- `index.html` - HTML shell with nav/footer (always visible), loading screen
- `src/main.js` - Vite entry point, creates and initializes CrimRXivApp
- `src/app.js` - Main application orchestrator

**Initialization Sequence** (app.js:34-78):
1. Get `#app` container element
2. Initialize ParquetDB (loads DuckDB-WASM + metadata.parquet)
3. Initialize Router (sets up hash change listeners)
4. Initialize all Components (passing db and router references)
5. Expose `window.router` globally for onclick handlers
6. Initialize navigation search bar
7. Trigger initial route handling

**Critical**: Router must be initialized before components, as components need router reference for navigation.

### Routing System

**File**: `src/lib/router.js`
**Type**: Hash-based routing (Arweave-compatible)

**Routes**:
- `#/` or empty → Homepage
- `#/article/{slug}` → Article detail
- `#/search?q={query}` → Search results
- `#/consortium` → Consortium members
- `#/member/{slug}` → Member publications

**Why hash-based?** Works on static hosting (Arweave) without server-side routing.

### Database Layer (Browser)

**File**: `src/lib/parquet-db.js`
**Type**: DuckDB-WASM wrapper

**Initialization** (parquet-db.js:56-98):
1. Configure manual bundles (WASM files must be in `/public/duckdb/`)
2. Select bundle (MVP or EH) based on browser support
3. Create worker and initialize AsyncDuckDB
4. Connect and load metadata.parquet

**Critical**: DuckDB-WASM requires absolute URLs for HTTP range requests. The `getParquetUrls()` method (parquet-db.js:32-51) handles URL resolution:
- Localhost: `http://localhost:3005/data/metadata.parquet`
- Arweave: ArNS undername URLs via `gateway.js`

**Key Methods**:
- `initialize()` - Load DuckDB-WASM and Parquet file
- `getRecentArticles(limit)` - Homepage query (sorted by published_at DESC)
- `search(query)` - Full-text search using ILIKE on multiple fields
- `searchByAffiliation(patterns)` - Find articles by author affiliations
- `getArticleMetadata(slug)` - Single article lookup
- `getStats()` - Database statistics (total articles, date range, etc.)

**Gateway Detection**: `src/lib/gateway.js` provides URL helpers for Arweave compatibility:
- `getAppInfo()` - Detect localhost vs Arweave gateway
- `getDataParquetUrl(filename)` - Resolve Parquet file URLs
- `getUndernameUrl(subdomain, path)` - Generate ArNS undername URLs

### Components

**File**: `src/components/*.js`
**Pattern**: Each component has a `render()` method that returns HTML

**Homepage** (`homepage.js`):
- Hero section with stats
- Search bar
- 25 most recent publications with "Load More"

**Article Detail** (`article-detail.js`):
- Full metadata display
- ProseMirror content rendering
- PDF attachments
- Author affiliations

**Search** (`search.js`):
- Full-text search across title, abstract, authors, keywords
- Highlighting of search terms
- Results pagination

**Consortium** (`consortium.js`):
- List of 30+ consortium members
- Links to member detail pages

**Member Detail** (`member-detail.js`):
- Publications from specific consortium member
- Affiliation pattern matching

### Styling

**File**: `src/styles/main.css`
**Build**: Inlined into `index.html` during Vite build
**Why inline?** Self-contained HTML for Arweave compatibility (no external dependencies)

## Development Workflow

**First Time Setup:**
```bash
npm install

# Option 1: Import fresh data (30-45 min)
npm run import

# Option 2: Use existing SQLite backup (if available)
# cp backup/crimrxiv.db data/sqlite/

# Export to Parquet (required for SPA)
npm run export

# Start dev server
npm run dev  # Opens at http://localhost:3005
```

**Incremental Development:**
- Data updated? Re-run `npm run import` (incremental, fast) then `npm run export`
- UI changes? Just save files, Vite HMR reloads automatically
- Component changes? No rebuild needed, Vite handles it
- Add new pages? Update `src/lib/router.js` and create component

**Testing Locally:**
- Dev server: `npm run dev` (with hot reload)
- Local production test: `npm run build && npm run preview` (includes bundled resources)
- Arweave deployment test: `npm run build:prod` (excludes external resources, requires ArNS setup)
- Check console for DuckDB-WASM initialization logs
- Test all routes work (homepage, article, search, consortium)
- Verify external resource loading in production builds

## Key Architecture Patterns

### Data Pattern: SQLite → Parquet

**CRITICAL**: SQLite is source of truth, Parquet is read-only export.

**Workflow**:
```
1. Scrape data → SQLite (npm run import)
2. Modify/update → SQLite (direct database operations)
3. Export → Parquet (npm run export)
4. Never update Parquet directly
```

**Why this pattern?**
- SQLite handles writes, updates, complex queries
- Parquet optimized for browser reads, analytics
- Clear separation: operational vs analytics
- Re-export is fast (~30 sec) and reproducible

See `docs/PATTERN_GUIDE.md` for the universal data pipeline pattern.

### Arweave Compatibility Requirements

**Critical for Permaweb deployment**:
- All CSS must be inline (Vite handles this)
- Use relative paths or hash routing (no absolute server paths)
- External resources (DuckDB WASM, Parquet data) loaded via ArNS undernames
- Self-contained HTML that works without server
- Handle gateway URLs correctly (see `src/lib/gateway.js`)

**External Resource Architecture**:
- **Production builds** (`npm run build:prod`): Excludes DuckDB WASM and data files (loaded from ArNS)
- **Development builds** (`npm run build`): Includes all resources for local testing
- **EXCLUDE_EXTERNAL=true**: Environment variable triggers external resource exclusion
- **ArNS Undernames**: Data loaded from `data_{rootName}.arweave.net`, WASM from `duck-db-wasm_{rootName}.arweave.net`

**Gateway Detection** (`src/lib/gateway.js`):
- Localhost: Use full URLs (`http://localhost:3005/data/...`)
- Arweave: Use ArNS undername URLs for external resources
- DuckDB-WASM requires absolute URLs for HTTP range requests
- Parquet files loaded from external ArNS gateway (parquet-db.js:32-54)

### Incremental Data Sync

**Script**: `scripts/scrape-to-sqlite.js`
**Progress Tracking**: Uses PubPub SDK's pagination

**How it works**:
1. Fetch all pubs from CrimRXiv community (batch of 100)
2. For each pub, check if already in database
3. If exists and unchanged, skip
4. If new or updated, fetch full content and upsert
5. Save progress after each batch

**Resume capability**: Can stop/restart without losing progress (state tracked in SQLite)

## File Organization

**Critical Files (Don't Delete)**:
- `data/sqlite/crimrxiv.db` - SQLite database (source of truth)
- `public/data/metadata.parquet` - Exported data for browser (5MB, committed to repo)
- `public/duckdb/*.wasm` - DuckDB-WASM bundles (required for runtime)
- `public/duckdb/*.worker.js` - DuckDB-WASM workers (required for runtime)
- `src/app.js` - Main application orchestrator
- `src/lib/router.js` - Client-side routing
- `src/lib/parquet-db.js` - DuckDB-WASM wrapper
- `src/lib/gateway.js` - URL resolution for localhost vs Arweave
- `src/lib/database.js` - SQLite schema and operations (build-time only)
- `vite.config.js` - Build configuration
- `index.html` - HTML shell with nav, footer, loading screen

**Generated/Replaceable**:
- `dist/**` - Build output (regenerated by `npm run build`)
- `data/sqlite/crimrxiv.db-shm`, `data/sqlite/crimrxiv.db-wal` - SQLite temp files
- `data/manifests/**` - Arweave manifest files

**Key Directories**:
- `src/components/` - UI components (each exports a class with `render()`)
- `src/lib/` - Core libraries (router, database, utilities)
- `src/styles/` - CSS (inlined during build)
- `scripts/` - Build-time data pipeline scripts
- `public/` - Static assets served by Vite (Parquet files, images)
- `docs/` - Architecture documentation

## Common Tasks

**Adding a New Page**:
1. Create component in `src/components/new-page.js` with `render()` method
2. Add route pattern in `src/lib/router.js` (e.g., `newPage: /^#?\/new-page\/?$/`)
3. Add route handler in `Router.handleRoute()`
4. Add show method in `src/app.js` (e.g., `showNewPage()`)
5. Test by navigating to `#/new-page`

**Updating Article Data**:
```bash
npm run import       # Fetch latest from CrimRXiv (incremental)
npm run export       # Re-export to Parquet
npm run dev          # Test changes locally
```

**Adding New Database Fields**:
1. Update schema in `src/lib/database.js` (`createSchema()` method)
2. Add migration in `migrate()` method (use `ALTER TABLE`)
3. Update `upsertArticle()` to handle new fields
4. Re-run `npm run import` to populate data
5. Update Parquet export in `scripts/export-to-parquet.js`
6. Run `npm run export` to regenerate Parquet

**Modifying UI Components**:
1. Edit component file in `src/components/`
2. Vite HMR automatically reloads
3. Test in browser
4. No build step needed during development

**Debugging Queries**:
```javascript
// In browser console:
const db = window.app.db;
const result = await db.query('SELECT * FROM metadata LIMIT 10');
console.table(result.toArray());
```

## Deployment to Arweave

**Why Arweave?**
- Permanent storage (pay once, stored forever)
- Decentralized (censorship-resistant)
- Cost-effective (~$0.82 for entire site one-time)

**Deployment Process**:
```bash
# 1. Upload external resources (one-time or when updated)
npm run upload:parquet      # Upload metadata.parquet to Arweave
npm run upload:wasm         # Upload DuckDB WASM bundles to Arweave
# Note ArNS undername for each upload (e.g., data_crimrxiv-demo, duck-db-wasm_crimrxiv-demo)

# 2. Build SPA (excludes external resources)
npm run build:prod          # Creates dist/ folder without bundled WASM/data

# 3. Optional: Generate and upload article manifests
npm run generate:manifests
npm run upload:manifests

# 4. Sync dist/ with ArDrive
npm run sync
```

**Deployment Checklist**:
- [ ] External resources uploaded to Arweave (parquet, WASM bundles)
- [ ] ArNS undernames configured for external resources
- [ ] `npm run build:prod` succeeds without errors
- [ ] `dist/index.html` exists and has inline CSS
- [ ] `dist/duckdb/` and `dist/data/` should NOT exist (external resources excluded)
- [ ] Test `npm run build && npm run preview` locally first (with bundled resources)
- [ ] Update gateway detection logic if ArNS names changed
- [ ] Check browser console - no errors
- [ ] Test search functionality
- [ ] Test article page with content rendering
- [ ] Verify external resources load correctly from ArNS undernames

**ArNS (Arweave Name System)**:
- Provides human-readable URLs (e.g., `https://crimrxiv.ar-io.dev`)
- Updatable DNS pointing to transaction IDs
- See `docs/PATTERN_GUIDE.md` Stage 5 for ArNS integration details

## Performance Notes

**Initial Load**: < 2 seconds (includes DuckDB-WASM initialization)
**Page Navigation**: Instant (client-side routing)
**Search**: < 500ms (DuckDB queries 3,700+ articles)
**Bundle Size**: ~3MB (includes DuckDB-WASM)

**Optimization Strategies**:
- Parquet sorted by `published DESC` (most common query pattern)
- ZSTD compression for smaller file size
- Row groups of 100K for efficient range queries
- DuckDB-WASM uses HTTP range requests (doesn't download entire file)

## Security Considerations

**Credential Management**:
- **Never commit** `.env` files (properly ignored in `.gitignore`)
- **Never commit** wallet files (store outside repository)
- Required credentials for import: `PUBPUB_EMAIL`, `PUBPUB_PASSWORD`
- Optional for deployment: `ARWEAVE_WALLET_PATH`
- See `docs/SECURITY_CHECKLIST.md` for complete security guidance

**XSS Prevention**:
- Escape user input before rendering HTML (use `app.escapeHtml()`)
- Use `textContent` for untrusted strings, not `innerHTML`
- Sanitize search queries before displaying (parquet-db.js escapes quotes)

**SQL Injection**:
- Use parameterized queries in SQLite operations (database.js)
- Never concatenate user input into SQL strings
- DuckDB-WASM queries: search terms are escaped (replace `'` with `''`)
- Note: Current search uses ILIKE with escaped strings (parquet-db.js:214)

**Content Security Policy**:
- Inline scripts/styles required for Arweave deployment
- No external resources loaded (CDNs, fonts, etc.)
- All assets bundled and self-contained
- WASM files served from `/public/duckdb/`

## Troubleshooting

**DuckDB-WASM fails to load**:
- Check browser supports WebAssembly (all modern browsers do)
- Ensure WASM files exist in `public/duckdb/` directory:
  - `duckdb-mvp.wasm`, `duckdb-eh.wasm`
  - `duckdb-browser-mvp.worker.js`, `duckdb-browser-eh.worker.js`
- Check browser console for specific error messages
- Verify manual bundle configuration in parquet-db.js:61-70
- Common issue: WASM files not copied during build (check vite.config.js)

**Parquet file not found**:
- Run `npm run export` to generate from SQLite
- Verify file exists: `public/data/metadata.parquet` (~5MB)
- Check Vite config includes Parquet in `assetsInclude` (vite.config.js:40)
- Verify URL resolution in parquet-db.js:32-51 works for your environment
- For Arweave: check gateway detection in gateway.js

**Search returns no results**:
- Check metadata loaded: Open browser console, run `await window.app.db.query('SELECT COUNT(*) FROM metadata')`
- Verify search query syntax (case-insensitive ILIKE matching)
- Check browser console for SQL errors
- Ensure metadata.parquet has data (should be ~5MB with 3,700+ articles)

**Import script fails**:
- Verify `.env` file exists with `PUBPUB_EMAIL` and `PUBPUB_PASSWORD`
- Check PubPub community URL is correct (must include `www.` - see scripts/scrape-to-sqlite.js)
- Verify SQLite database directory exists: `data/sqlite/`
- Check network connection to www.crimrxiv.com
- Review error logs for specific API failures (PubPub SDK errors)
- Common issue: Invalid credentials or rate limiting

**Component not rendering**:
- Check initialization order in app.js:34-78 (Router before Components)
- Verify `window.router` is exposed globally (app.js:65)
- Check component has `render()` method that returns HTML string
- Verify component is registered in app.components (app.js:20-27)
- Check route pattern in router.js:16-23 matches hash format

## Documentation

**Essential Guides**:
- **docs/PATTERN_GUIDE.md** - Universal data pipeline pattern (SQLite → Parquet → Arweave)
- **docs/ARCHITECTURE.md** - Detailed technical architecture
- **docs/PARQUET_SCHEMA.md** - Parquet file schema details
- **README.md** - Project overview and quick start

**Migration Notes**:
- This project migrated from Static Site Generator (SSG) to SPA in January 2025
- Old architecture (archived) generated 900+ static HTML pages from consortium-dataset.json
- New architecture: Client-side SPA with DuckDB-WASM querying Parquet files
- Benefits: faster rebuilds (30s vs 5+ min), smaller deployments (5MB vs 80MB), dynamic features (search, filtering)
- **Note**: README.md still references old SSG approach - current implementation is pure SPA
- See `docs/ARCHITECTURE.md` for detailed migration information
