# CrimConsortium Hub - Architecture

## Current Architecture (NEW - January 2025)

**Single Page Application (SPA) with Client-Side Database Queries**

### Tech Stack
- **Frontend**: Vite + Vanilla JavaScript (ES6 modules)
- **Database**: DuckDB-WASM (runs in browser)
- **Data Format**: Apache Parquet (efficient columnar storage)
- **Routing**: Hash-based routing for Arweave compatibility
- **Deployment**: Arweave Permaweb (permanent, decentralized hosting)

### Key Features
- 🚀 Instant loading - Header/nav/footer load immediately
- 📦 Client-side SQL queries on 3,700+ articles
- 🔍 Full-text search across metadata
- 📱 Mobile-responsive design
- 🌐 Works on decentralized web (Arweave)

### Data Pipeline

```
CrimRXiv.com (PubPub)
    ↓
npm run import (PubPub SDK → SQLite)
    ↓
data/sqlite/crimrxiv.db (3,749 articles)
    ↓
npm run export (SQLite → Parquet)
    ↓
public/data/metadata.parquet (5MB, served to browser)
    ↓
DuckDB-WASM queries in browser
    ↓
Dynamic UI rendering
```

### Directory Structure

```
crimconsortium-hub/
├── index.html              # HTML shell (header/nav/footer always visible)
├── vite.config.js          # Vite build configuration
├── package.json            # npm scripts
│
├── src/
│   ├── main.js            # Vite entry point
│   ├── app.js             # Main app orchestrator
│   │
│   ├── components/        # UI components
│   │   ├── homepage-updated.js
│   │   ├── article-detail.js
│   │   ├── search.js
│   │   ├── consortium.js
│   │   └── member-detail.js
│   │
│   ├── lib/               # Core libraries
│   │   ├── router.js      # Hash-based routing
│   │   ├── parquet-db.js  # DuckDB-WASM wrapper
│   │   ├── gateway.js     # Arweave gateway detection
│   │   ├── database.js    # SQLite schema (build-time only)
│   │   ├── utils.js       # Shared utilities
│   │   └── consortium-scraper.js  # Member definitions
│   │
│   ├── styles/
│   │   └── main.css       # All CSS (inline in build)
│   │
│   └── assets/
│       └── images/        # Logo, favicon
│
├── scripts/               # Build-time data pipeline
│   ├── scrape-to-sqlite.js     # Import from CrimRXiv (PubPub SDK)
│   ├── export-to-parquet.js    # Export to Parquet for SPA
│   ├── download-pdfs-only.js   # Download PDF attachments
│   ├── scraping-status.js      # Check import progress
│   ├── generate-manifests.js   # Arweave manifests
│   ├── upload-manifests.js     # Upload to Arweave
│   └── sync-ardrive-fixed.js   # ArDrive sync
│
├── public/                # Static assets served by Vite
│   └── data/              # Parquet files (committed to repo)
│       └── metadata.parquet  # 5MB, all article metadata
│
├── data/                  # Generated data (gitignored)
│   ├── sqlite/            # SQLite database (source of truth)
│   │   └── crimrxiv.db    # 3,749 articles
│   └── manifests/         # Arweave upload manifests
│
└── dist/                  # Vite build output (gitignored)
    ├── index.html         # Built HTML with inline CSS
    ├── assets/            # Bundled JS/CSS
    └── data/              # Parquet files (copied from public/)
```

### Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Import data from CrimRXiv (30-45 minutes)
npm run import

# 3. Export to Parquet (required for SPA)
npm run export

# 4. Run dev server (http://localhost:5173)
npm run dev

# 5. Build for production
npm run build

# 6. Preview production build
npm run preview
```

### Key npm Scripts

| Command | Description | Time |
|---------|-------------|------|
| `npm run import` | Scrape CrimRXiv → SQLite | 30-45 min |
| `npm run import:pdfs` | Download PDF attachments | ~10 min |
| `npm run export` | SQLite → Parquet | ~30 sec |
| `npm run dev` | Vite dev server (HMR) | Instant |
| `npm run build` | Build SPA for production | ~10 sec |
| `npm run preview` | Preview production build | Instant |

### Components Overview

**Homepage** (`homepage-updated.js`)
- Hero section with stats
- Search bar
- 25 most recent publications with "Load More"

**Article Detail** (`article-detail.js`)
- Full metadata (title, authors, abstract, DOI, license)
- ProseMirror content rendering
- PDF attachments
- Author affiliations

**Search** (`search.js`)
- Full-text search across title, abstract, authors, keywords
- Highlighting of search terms
- Results pagination

**Consortium** (`consortium.js`)
- List of 30+ consortium members
- Links to member detail pages

**Member Detail** (`member-detail.js`)
- Publications from specific consortium member
- Affiliation pattern matching

### Performance

- **Initial Load**: < 2 seconds (includes DuckDB-WASM initialization)
- **Page Navigation**: Instant (client-side routing)
- **Search**: < 500ms (DuckDB queries 3,700+ articles)
- **Bundle Size**: ~3MB (includes DuckDB-WASM)

### Browser Compatibility

- Chrome/Edge 90+
- Firefox 90+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

**Requirements**: WebAssembly, ES6 modules, async/await

---

## Previous Architecture (DEPRECATED - Before January 2025)

**Static Site Generator (SSG)**

### What It Was
- Generated 900+ static HTML pages from a JSON dataset
- Each article/member had a pre-built HTML file
- Used Handlebars templates
- Deployed entire site as static files to Arweave

### Why We Migrated
1. **Slow rebuilds**: 15-30 seconds to regenerate 900+ pages
2. **Large deployments**: 20-30MB of redundant HTML
3. **No dynamic features**: Search required Lunr.js index generation
4. **Hard to maintain**: Template logic spread across multiple files
5. **Poor UX**: Full page loads, no loading states, slow navigation

### What Was Deleted (2025-01-31)
- `scripts/serve.js` - Old static site dev server
- `scripts/archive/` - 50+ legacy build/scraper scripts
  - `build-enhanced-complete.js` - Static HTML generator
  - `improved-article-template.js` - Article page templates
  - `enhanced-consortium-scraper.js` - Old web scraper
  - Plus 47+ other archived scripts
- `scripts/test-*.js` - 6 test scripts
- `dist/main/` - Old static site output directory
- `data/final/` - Old data format (replaced by SQLite + Parquet)

### Data Migration
- **Old**: `data/final/consortium-dataset.json` (56MB monolithic JSON)
- **New**: `data/sqlite/crimrxiv.db` → `public/data/metadata.parquet` (5MB)

**Result**: Cleaner codebase, faster development, better UX, smaller deployments.

---

## Deployment to Arweave

### Why Arweave?
- **Permanent storage**: Pay once, stored forever
- **Decentralized**: No single point of failure
- **Censorship-resistant**: Cannot be taken down
- **Cost-effective**: ~$0.82 for entire site (one-time payment)

### Deployment Process

```bash
# 1. Build SPA
npm run build

# 2. Generate Arweave manifests (optional, for individual articles)
npm run generate:manifests

# 3. Upload manifests to Arweave (optional)
npm run upload:manifests

# 4. Sync dist/ with ArDrive
npm run sync
```

### Arweave URLs
- **Production**: `https://arweave.net/{TX_ID}`
- **ArNS**: `https://crimrxiv.ar-io.dev` (human-readable subdomain)
- **Local Dev**: `http://localhost:5173`

---

## Contributing

### Code Style
- ES6 modules (no CommonJS)
- Async/await (no callbacks)
- Comments for complex logic
- Security: Escape user input (XSS prevention)

### Testing Checklist
- [ ] All pages load without errors
- [ ] Search works and highlights results
- [ ] Article pages display full content
- [ ] Mobile responsive design works
- [ ] No console errors
- [ ] Build succeeds (`npm run build`)

### Questions?
See `CLAUDE.md` for detailed guidance on working with this codebase.
