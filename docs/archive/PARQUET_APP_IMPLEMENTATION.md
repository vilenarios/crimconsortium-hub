# Parquet App Implementation Plan

## Architecture Overview

### Data Layer
```
Arweave Deployment:
├── crimxriv.ar.io/                      → Web app (SPA)
├── data_crimxriv.ar.io/metadata.parquet → ~5MB metadata (all articles)
├── batch-001_crimxriv.ar.io/*.parquet   → ~30MB batch files (1000 articles each)
├── batch-002_crimxriv.ar.io/*.parquet
└── ...batch-020_crimxriv.ar.io/*.parquet (20,000 total articles)
```

### Tech Stack
- **Frontend**: Vanilla JS SPA (no framework overhead for Arweave)
- **Database**: DuckDB-WASM (in-browser SQL queries on Parquet)
- **Routing**: Hash-based routing (#/article/slug)
- **State**: Simple state machine
- **Styling**: Inline CSS (Arweave compatibility)

## File Structure

```
dist/app/
├── index.html              # Main SPA shell
├── app.js                  # Core application logic
├── duckdb.js              # DuckDB-WASM wrapper
├── router.js              # Hash-based routing
├── components/
│   ├── homepage.js        # Homepage component
│   ├── article-list.js    # Article listing
│   ├── article-detail.js  # Article view
│   └── search.js          # Search component
├── assets/
│   ├── logo.png
│   └── favicon.ico
└── config.js              # ArNS undername configuration
```

## Implementation Steps

### 1. DuckDB-WASM Integration

**File: `dist/app/duckdb.js`**

```javascript
class ParquetDB {
  constructor() {
    this.db = null;
    this.conn = null;
    this.metadataLoaded = false;
  }

  async initialize() {
    // Load DuckDB-WASM from CDN
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    this.db = new duckdb.AsyncDuckDB(logger, worker);
    await this.db.instantiate(bundle.mainModule);
    this.conn = await this.db.connect();

    // Load metadata.parquet
    await this.loadMetadata();
  }

  async loadMetadata() {
    const metadataUrl = 'https://data_crimxriv.ar.io/metadata.parquet';
    await this.conn.query(`
      CREATE VIEW metadata AS
      SELECT * FROM parquet_scan('${metadataUrl}')
    `);
    this.metadataLoaded = true;
  }

  // Search articles
  async search(query, limit = 50) {
    const result = await this.conn.query(`
      SELECT
        article_id, slug, title, authors_json, abstract_preview,
        keywords_json, published_at, doi, export_batch
      FROM metadata
      WHERE
        title ILIKE '%${query}%'
        OR abstract_preview ILIKE '%${query}%'
        OR keywords_json ILIKE '%${query}%'
      ORDER BY published_at DESC
      LIMIT ${limit}
    `);
    return result.toArray().map(row => row.toJSON());
  }

  // Get recent articles
  async getRecent(limit = 25) {
    const result = await this.conn.query(`
      SELECT
        article_id, slug, title, authors_json, abstract_preview,
        published_at, doi, export_batch
      FROM metadata
      ORDER BY published_at DESC
      LIMIT ${limit}
    `);
    return result.toArray().map(row => row.toJSON());
  }

  // Get article metadata by slug
  async getArticleMetadata(slug) {
    const result = await this.conn.query(`
      SELECT * FROM metadata
      WHERE slug = '${slug}'
      LIMIT 1
    `);
    const rows = result.toArray();
    return rows.length > 0 ? rows[0].toJSON() : null;
  }

  // Load full article from batch
  async getArticleFull(slug, batchName) {
    // Construct batch URL
    const batchUrl = `https://${batchName.replace('_batch-', '_crimxriv.ar.io/')}.parquet`;

    const result = await this.conn.query(`
      SELECT * FROM parquet_scan('${batchUrl}')
      WHERE slug = '${slug}'
      LIMIT 1
    `);
    const rows = result.toArray();
    return rows.length > 0 ? rows[0].toJSON() : null;
  }

  // Get statistics
  async getStats() {
    const result = await this.conn.query(`
      SELECT
        COUNT(*) as total_articles,
        COUNT(DISTINCT export_batch) as total_batches,
        MIN(published_at) as earliest,
        MAX(published_at) as latest
      FROM metadata
    `);
    return result.toArray()[0].toJSON();
  }
}
```

### 2. Core App Logic

**File: `dist/app/app.js`**

```javascript
class CrimRxivApp {
  constructor() {
    this.db = new ParquetDB();
    this.router = new Router();
    this.state = {
      loading: true,
      currentPage: 'home',
      currentArticle: null,
      searchQuery: '',
      searchResults: []
    };
  }

  async initialize() {
    // Show loading screen
    this.renderLoading();

    // Initialize DuckDB
    await this.db.initialize();

    // Setup routes
    this.setupRoutes();

    // Initialize router
    this.router.init();

    this.state.loading = false;
  }

  setupRoutes() {
    this.router.on('/', () => this.renderHomepage());
    this.router.on('/article/:slug', (params) => this.renderArticle(params.slug));
    this.router.on('/search', () => this.renderSearch());
  }

  async renderHomepage() {
    const stats = await this.db.getStats();
    const recentArticles = await this.db.getRecent(25);

    const html = Homepage.render({ stats, recentArticles });
    document.getElementById('app').innerHTML = html;

    // Attach event listeners
    this.attachSearchListener();
  }

  async renderArticle(slug) {
    this.renderLoading();

    // Get metadata first
    const metadata = await this.db.getArticleMetadata(slug);

    if (!metadata) {
      this.renderNotFound();
      return;
    }

    // Load full article from batch
    const article = await this.db.getArticleFull(slug, metadata.export_batch);

    const html = ArticleDetail.render({ article, metadata });
    document.getElementById('app').innerHTML = html;
  }

  async renderSearch() {
    const query = new URLSearchParams(window.location.hash.split('?')[1]).get('q');

    if (!query) {
      this.renderHomepage();
      return;
    }

    this.renderLoading();
    const results = await this.db.search(query);

    const html = Search.render({ query, results });
    document.getElementById('app').innerHTML = html;

    this.attachSearchListener();
  }

  attachSearchListener() {
    const searchInput = document.getElementById('search-input');
    const searchForm = document.getElementById('search-form');

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
          window.location.hash = `/search?q=${encodeURIComponent(query)}`;
        }
      });
    }
  }

  renderLoading() {
    document.getElementById('app').innerHTML = `
      <div style="text-align: center; padding: 4rem;">
        <div class="loader"></div>
        <p style="margin-top: 1rem; color: #757575;">Loading...</p>
      </div>
    `;
  }

  renderNotFound() {
    document.getElementById('app').innerHTML = `
      <div style="text-align: center; padding: 4rem;">
        <h1>404 - Not Found</h1>
        <p><a href="#/">Return to homepage</a></p>
      </div>
    `;
  }
}
```

### 3. Router

**File: `dist/app/router.js`**

```javascript
class Router {
  constructor() {
    this.routes = {};
  }

  on(path, handler) {
    this.routes[path] = handler;
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');

    // Try exact match first
    if (this.routes[path]) {
      this.routes[path]();
      return;
    }

    // Try parameterized routes
    for (const route in this.routes) {
      const params = this.matchRoute(route, path);
      if (params) {
        this.routes[route](params);
        return;
      }
    }

    // 404
    window.app.renderNotFound();
  }

  matchRoute(route, path) {
    const routeParts = route.split('/');
    const pathParts = path.split('/');

    if (routeParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        const paramName = routeParts[i].slice(1);
        params[paramName] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return params;
  }
}
```

### 4. Homepage Component

**File: `dist/app/components/homepage.js`**

```javascript
const Homepage = {
  render({ stats, recentArticles }) {
    return `
      <div class="hero-section">
        <div class="container">
          <div class="hero-content">
            <h1 class="hero-title">CrimRxiv Archive</h1>
            <p class="hero-description">
              Permanent, decentralized archive of criminology research powered by Arweave
            </p>
            <div class="stats-row">
              <div class="stat-item">
                <div class="stat-number">${stats.total_articles.toLocaleString()}</div>
                <div class="stat-label">Articles</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">${stats.total_batches}</div>
                <div class="stat-label">Batches</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="container" style="padding: 3rem 0;">
        <div class="search-section">
          <form id="search-form">
            <input
              type="text"
              id="search-input"
              placeholder="Search articles by title, abstract, or keywords..."
              class="search-input"
            />
            <button type="submit" class="search-button">Search</button>
          </form>
        </div>

        <div class="recent-section">
          <h2 class="section-title">Recent Publications</h2>
          <div class="articles-list">
            ${recentArticles.map(article => this.renderArticleCard(article)).join('')}
          </div>
        </div>
      </div>
    `;
  },

  renderArticleCard(article) {
    const authors = JSON.parse(article.authors_json || '[]');
    const authorNames = authors.slice(0, 3).map(a => a.name).join(', ');
    const moreAuthors = authors.length > 3 ? ` et al.` : '';

    return `
      <div class="article-card">
        <h3 class="article-title">
          <a href="#/article/${article.slug}">${article.title}</a>
        </h3>
        <div class="article-meta">
          <span class="article-authors">${authorNames}${moreAuthors}</span>
          <span class="article-date">${new Date(article.published_at).toLocaleDateString()}</span>
        </div>
        <p class="article-abstract">${article.abstract_preview}</p>
        ${article.doi ? `<div class="article-doi">DOI: ${article.doi}</div>` : ''}
      </div>
    `;
  }
};
```

### 5. Article Detail Component

**File: `dist/app/components/article-detail.js`**

```javascript
const ArticleDetail = {
  render({ article, metadata }) {
    const authors = JSON.parse(article.authors_json || '[]');
    const keywords = JSON.parse(article.keywords_json || '[]');

    return `
      <div class="article-page">
        <div class="container">
          <div class="article-header">
            <a href="#/" class="back-link">← Back to articles</a>
            <h1 class="article-title">${article.title}</h1>

            <div class="article-metadata">
              <div class="authors-list">
                ${authors.map(author => `
                  <div class="author">
                    <span class="author-name">${author.name}</span>
                    ${author.affiliation ? `<span class="author-affiliation">${author.affiliation}</span>` : ''}
                    ${author.orcid ? `<a href="https://orcid.org/${author.orcid}" class="orcid-link">ORCID</a>` : ''}
                  </div>
                `).join('')}
              </div>

              <div class="article-info">
                <div class="info-item">
                  <strong>Published:</strong> ${new Date(article.published_at).toLocaleDateString()}
                </div>
                ${article.doi ? `
                  <div class="info-item">
                    <strong>DOI:</strong> <a href="https://doi.org/${article.doi}">${article.doi}</a>
                  </div>
                ` : ''}
                ${article.license ? `
                  <div class="info-item">
                    <strong>License:</strong> ${article.license}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="article-content">
            <h2>Abstract</h2>
            <div class="abstract">${article.abstract || article.description}</div>

            ${keywords.length > 0 ? `
              <div class="keywords">
                <strong>Keywords:</strong> ${keywords.join(', ')}
              </div>
            ` : ''}

            ${article.pdf_url ? `
              <div class="article-actions">
                <a href="${article.pdf_url}" class="btn-primary" target="_blank">Download PDF</a>
                <a href="${article.url}" class="btn-secondary" target="_blank">View on CrimRxiv</a>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }
};
```

### 6. Search Component

**File: `dist/app/components/search.js`**

```javascript
const Search = {
  render({ query, results }) {
    return `
      <div class="container" style="padding: 3rem 0;">
        <div class="search-section">
          <form id="search-form">
            <input
              type="text"
              id="search-input"
              value="${query}"
              placeholder="Search articles by title, abstract, or keywords..."
              class="search-input"
            />
            <button type="submit" class="search-button">Search</button>
          </form>
        </div>

        <div class="search-results">
          <h2 class="section-title">
            ${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"
          </h2>

          ${results.length > 0 ? `
            <div class="articles-list">
              ${results.map(article => Homepage.renderArticleCard(article)).join('')}
            </div>
          ` : `
            <p style="color: #757575; text-align: center; padding: 2rem;">
              No results found. Try different keywords.
            </p>
          `}
        </div>
      </div>
    `;
  }
};
```

### 7. Main HTML Shell

**File: `dist/app/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CrimRxiv - Permanent Criminology Research Archive</title>
  <link rel="icon" type="image/x-icon" href="./assets/favicon.ico">

  <style>
    /* Include all CSS from current index.html */
    :root {
      --primary-black: #000000;
      --primary-white: #ffffff;
      --text-gray: #757575;
      --light-gray: #fafafa;
      --border-gray: #e0e0e0;
      --accent-orange: #ff6b35;
    }

    /* ... rest of CSS ... */

    /* Loader animation */
    .loader {
      border: 4px solid var(--border-gray);
      border-top: 4px solid var(--accent-orange);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="container">
      <div class="site-brand">
        <h1 class="site-title"><a href="#/" style="text-decoration: none; color: inherit;">CrimRxiv</a></h1>
        <p class="tagline">Permanent Archive on Arweave</p>
      </div>
    </div>
  </div>

  <div id="app">
    <div style="text-align: center; padding: 4rem;">
      <div class="loader"></div>
      <p style="margin-top: 1rem; color: #757575;">Initializing database...</p>
    </div>
  </div>

  <footer class="footer">
    <div class="container">
      <p>Powered by <a href="https://www.arweave.org/">Arweave</a> |
         Data: <a href="https://www.crimrxiv.com">CrimRxiv</a> |
         Built with <a href="https://duckdb.org/">DuckDB-WASM</a></p>
    </div>
  </footer>

  <!-- DuckDB-WASM from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-mvp.wasm.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@latest/dist/duckdb-browser-mvp.worker.js"></script>

  <!-- App components -->
  <script src="./router.js"></script>
  <script src="./duckdb.js"></script>
  <script src="./components/homepage.js"></script>
  <script src="./components/article-detail.js"></script>
  <script src="./components/search.js"></script>
  <script src="./app.js"></script>

  <script>
    // Initialize app
    window.app = new CrimRxivApp();
    window.app.initialize().catch(err => {
      document.getElementById('app').innerHTML = `
        <div style="text-align: center; padding: 4rem;">
          <h2 style="color: red;">Failed to initialize</h2>
          <p>${err.message}</p>
        </div>
      `;
    });
  </script>
</body>
</html>
```

## Build Process

### New Build Script

**File: `scripts/build-parquet-app.js`**

```javascript
#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../dist/app');

async function build() {
  console.log('🏗️  Building Parquet App...\n');

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(path.join(OUTPUT_DIR, 'components'), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_DIR, 'assets'), { recursive: true });

  // Copy assets
  console.log('📁 Copying assets...');
  await fs.copyFile(
    path.join(__dirname, '../dist/main/favicon.ico'),
    path.join(OUTPUT_DIR, 'assets/favicon.ico')
  );

  console.log('✅ Build complete!\n');
  console.log(`Output: ${OUTPUT_DIR}`);
}

build().catch(console.error);
```

## Deployment Strategy

1. **Export Parquet files** from SQLite:
   ```bash
   node scripts/export-to-parquet.js
   ```

2. **Build app**:
   ```bash
   node scripts/build-parquet-app.js
   ```

3. **Deploy Parquet files to Arweave**:
   - Upload `metadata.parquet` → `data_crimxriv.ar.io`
   - Upload each batch → `batch-NNN_crimxriv.ar.io`

4. **Deploy app**:
   - Upload `dist/app/` → `crimxriv.ar.io`

## Key Differences from Old Architecture

| Feature | Old (Static) | New (Parquet) |
|---------|--------------|---------------|
| **Data Format** | JSON (57MB total) | Parquet (~250MB total) |
| **Data Loading** | Upfront (all at once) | Lazy (on-demand) |
| **Search** | Lunr.js index | DuckDB SQL queries |
| **Articles** | Pre-rendered HTML | Client-side rendered |
| **Routing** | Static files | Hash routing |
| **Scope** | 835 consortium articles | 20,000+ all CrimRxiv |
| **Members** | 30 institutions | None (全 CrimRxiv) |
| **Initial Load** | ~5MB (metadata) | ~5MB (metadata.parquet) |
| **Article Load** | Instant (pre-rendered) | ~30KB (from batch) |

## Performance Optimizations

1. **Cache Strategy**:
   - Service worker caches metadata.parquet indefinitely
   - Viewed batch files cached in browser
   - Batches load on-demand (only when article viewed)

2. **Search Optimization**:
   - SQL `ILIKE` queries are fast on Parquet
   - DuckDB-WASM compiles queries to WASM
   - Results streamed, not loaded all at once

3. **Bundle Size**:
   - DuckDB-WASM: ~5MB (but from CDN, cached)
   - App JS: ~20KB total
   - No framework overhead

## Next Steps

1. ✅ Wait for scraper to complete
2. ⏳ Export to Parquet batches
3. 📝 Implement components (homepage, article, search)
4. 🧪 Test locally with serve.js
5. 🚀 Deploy to Arweave with separate ArNS undernames
