# CrimRxiv Archive

A browser-based archive of 3,700+ CrimRxiv publications. Single Page Application with client-side SQL queries (DuckDB-WASM), deployed on Arweave for permanent preservation.

## Prerequisites

- **Node.js 18+**
- **PubPub credentials** (for data import)
- **Arweave wallet** (for deployment)

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file in root:

```env
# Required for data import
PUBPUB_EMAIL=your-email@example.com
PUBPUB_PASSWORD=your-password

# Required for deployment
ARWEAVE_WALLET_PATH=./path/to/wallet.json
ARNS_PROCESS_ID=your-arns-process-id
ARNS_ROOT_NAME=crimrxiv
ARNS_DATA_UNDERNAME=data
```

### 3. Import Data

```bash
# Import from CrimRxiv (incremental, fetches new/updated articles)
npm run import

# Export to Parquet for browser queries
npm run export
```

### 4. Start Development Server

```bash
npm run dev
# Opens at http://localhost:3005
```

## Available Commands

### Development

```bash
npm run dev              # Start dev server (localhost:3005)
npm run build            # Build with bundled resources (for local testing)
npm run build:prod       # Build without bundled resources (for Arweave)
npm run preview          # Build + preview production build (localhost:4174)
```

### Data Pipeline

```bash
npm run import           # Import CrimRxiv → SQLite
npm run export           # Export SQLite → Parquet
```

### Deployment

```bash
npm run upload:parquet   # Upload Parquet to Arweave + update ArNS undername
npm run upload:wasm      # Upload DuckDB WASM to Arweave (one-time)
npm run upload:articles  # Upload article markdown to Arweave
npm run deploy           # Build app + upload to Arweave + update ArNS root
```

## Data Pipeline

The project uses a 3-stage pipeline:

```
CrimRxiv.com (PubPub API)
    ↓
SQLite Database (data/sqlite/crimrxiv.db)  ← Source of truth
    ↓
Parquet File (public/data/metadata.parquet) ← Read-only export
    ↓
Browser (DuckDB-WASM)
```

**Important:** SQLite is the single source of truth. Parquet files are regenerated exports, never updated directly.

## Deployment Architecture

The deployed app loads external resources from separate ArNS names:
- **App**: `crimrxiv.arweave.net` (root ArNS name)
- **Parquet data**: `data_crimrxiv.arweave.net` (ArNS undername)
- **DuckDB WASM**: `duck-db-wasm.arweave.net` (separate ArNS name)

This separation allows updating data without redeploying the entire app.

## Updating Content (Big Update Workflow)

When you need to update the archive with new publications:

```bash
# Step 1: Import latest publications from CrimRxiv → SQLite + data/articles/
npm run import

# Step 2: Upload article content to Arweave (creates manifests, stores TX IDs in SQLite)
npm run upload:articles

# Step 3: Export SQLite (with manifest TX IDs) to Parquet
npm run export

# Step 4: Upload new Parquet to Arweave and update ArNS undername
npm run upload:parquet

# Step 5: (Optional) Redeploy app if code changed
npm run deploy
```

**Note:** If only data changed (not code), you only need steps 1-4. The app will automatically load the new parquet from the updated ArNS undername.

**Tip:** `upload:articles` only uploads articles that don't already have a `manifest_tx_id` in SQLite, so it's safe to run incrementally.

## Full Deployment (First Time or Code Changes)

```bash
# 1. Import and prepare data
npm run import           # Scrape CrimRxiv → SQLite + data/articles/
npm run upload:articles  # Upload articles to Arweave (stores manifest TX IDs)
npm run export           # Export SQLite (with TX IDs) → Parquet

# 2. Upload external resources
npm run upload:parquet   # Upload Parquet + update ArNS undername
npm run upload:wasm      # One-time: upload DuckDB WASM files (only when DuckDB version changes)

# 3. Deploy app
npm run deploy           # Build + upload app + update ArNS root
```

## Self-Contained Deployment (Alternative)

To bundle WASM and Parquet into the app (no separate ArNS undernames needed for these):

```bash
npm run import
npm run upload:articles     # Still required - article content loaded from Arweave
npm run export
BUNDLE_RESOURCES=true npm run deploy
```

**Note:** Even with BUNDLE_RESOURCES=true, article content is still fetched from Arweave using manifest TX IDs. The flag only bundles WASM and Parquet data into the app.

## Architecture

- **Frontend:** Vite + Vanilla JavaScript (ES6)
- **Database (Build):** SQLite (better-sqlite3)
- **Database (Browser):** DuckDB-WASM + Parquet
- **Routing:** Hash-based (Arweave-compatible)
- **Deployment:** Arweave Permaweb

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Complete developer guide
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - Technical architecture
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment details
- **[docs/PATTERN_GUIDE.md](docs/PATTERN_GUIDE.md)** - Data pipeline pattern

## Troubleshooting

**Import fails:**
- Verify `.env` has valid PubPub credentials
- Check network connection to www.crimrxiv.com

**Parquet file not found:**
- Run `npm run export` to generate from SQLite
- Verify `public/data/metadata.parquet` exists (~5MB)

**DuckDB-WASM fails to load:**
- Check WASM files exist in `public/duckdb/`
- Verify browser supports WebAssembly
- Check browser console for errors

**Upload fails:**
- Verify `ARWEAVE_WALLET_PATH` points to valid JWK wallet file
- Check wallet has sufficient balance (check with Turbo SDK)
- Verify all required `.env` variables are set

For more help, see [CLAUDE.md](CLAUDE.md) troubleshooting section.
