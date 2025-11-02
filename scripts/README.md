# CrimRXiv Archive Scripts

Essential scripts for the CrimRXiv Archive application.

## Data Import & Processing

### `robust-incremental-scraper.js`
**Command:** `npm run import`

Main data scraper that pulls article metadata from CrimRXiv.com using the PubPub SDK.
- Scrapes 30+ consortium member publications
- Saves to SQLite database (`data/consortium.db`)
- Incremental/resumable (saves progress every 5 articles)
- Takes ~30-45 minutes for full scrape

**When to use:** When you need fresh data from CrimRXiv.com or after consortium members are updated.

---

### `export-to-parquet.js`
**Command:** `npm run export`

Converts SQLite database to Parquet files for the web application.
- Reads from `data/consortium.db`
- Outputs to `public/data/metadata.parquet`
- Required after any data import or database changes

**When to use:** After running `npm run import` or any manual database updates.

---

### `download-pdfs-only.js`
**Command:** `npm run import:pdfs`

Downloads PDF attachments for articles.
- Downloads ~126MB of PDFs
- Saves to `data/` directory
- Optional but provides full article access

**When to use:** When you need PDF files available for download in the app.

---

### `scraping-status.js`
**Command:** `npm run status`

Checks progress of the incremental scraper.
- Reads `data/scraping-progress.json`
- Shows current phase, articles processed, and last save time

**When to use:** During long imports to monitor progress.

---

## Development

### `serve.js`
**Command:** `npm run dev`

Local development server.
- Serves the app at http://localhost:3005
- Simulates ArNS routing for production-like testing
- Serves from Vite dev server

**When to use:** For local development and testing.

---

## Arweave Deployment

### `generate-manifests.js`
**Command:** `npm run generate:manifests`

Generates Arweave manifest files for each article.
- Creates manifest.json for each publication
- Includes metadata, content, and attachments

**When to use:** Before uploading to Arweave.

---

### `upload-manifests.js`
**Command:** `npm run upload:manifests`

Uploads article manifests to Arweave.
- Uploads manifest files
- Records transaction IDs in database

**When to use:** When deploying to Arweave permaweb.

---

### `sync-ardrive-fixed.js`
**Command:** `npm run sync`

Syncs built application with ArDrive for Arweave deployment.
- Uploads `dist/` directory to ArDrive
- Manages folder structure and file updates

**When to use:** After building app (`npm run build`) and before deploying.

---

## Typical Workflows

### **Local Development**
```bash
npm run dev              # Start dev server
# Make changes to src/
# Refresh browser to see changes
```

### **Fresh Data Import**
```bash
npm run import           # Scrape latest data (~30-45 min)
npm run export           # Convert to Parquet
npm run dev              # Test locally
```

### **Add PDFs**
```bash
npm run import:pdfs      # Download PDFs (~126MB)
npm run dev              # PDFs now available in app
```

### **Deploy to Arweave**
```bash
npm run import           # Get latest data
npm run export           # Convert to Parquet
npm run build            # Build static site
npm run generate:manifests
npm run upload:manifests
npm run sync             # Upload to ArDrive
```

---

## Archived Scripts

Legacy and test scripts are in `scripts/archive/` directory. These were used in earlier development but are no longer part of the active workflow.
