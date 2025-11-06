# CrimRXiv Archive

A browser-based archive of 3,700+ CrimRXiv publications. Single Page Application with client-side SQL queries (DuckDB-WASM), deployed on Arweave for permanent preservation.

## Prerequisites

- **Node.js 18+**
- **PubPub credentials** (for data import)
- **Arweave wallet** (optional, for deployment)

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

# Optional for deployment
ARWEAVE_WALLET_PATH=./path/to/wallet.json
ARNS_PROCESS_ID=your-arns-process-id
```

### 3. Import Data

```bash
# Import from CrimRXiv (30-45 minutes, one-time)
npm run import

# Export to Parquet for browser queries (~30 seconds)
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
npm run build            # Build for production
npm run preview          # Preview production build (localhost:4174)
```

### Data Pipeline

```bash
npm run import           # Import CrimRXiv → SQLite (30-45 min)
npm run export           # Export SQLite → Parquet (~30 sec)
```

### Deployment

```bash
npm run deploy           # Build + upload to Arweave + update ArNS
npm run build:prod       # Build without bundled resources (for Arweave)
```

### Utilities

```bash
npm run upload:parquet   # Upload Parquet file to Arweave
npm run upload:wasm      # Upload DuckDB WASM to Arweave
npm run upload:articles  # Upload article markdown to Arweave
```

## Data Pipeline

The project uses a 3-stage pipeline:

```
CrimRXiv.com (PubPub API)
    ↓
SQLite Database (data/sqlite/crimrxiv.db)  ← Source of truth
    ↓
Parquet File (public/data/metadata.parquet) ← Read-only export
    ↓
Browser (DuckDB-WASM)
```

**Important:** SQLite is the single source of truth. Parquet files are regenerated exports, never updated directly.

## Deployment to Arweave

### Simple Deployment (One Command)

```bash
npm run deploy
```

This will:
1. Build the production app
2. Upload to Arweave via Turbo SDK
3. Update your ArNS name to point to new deployment

**Prerequisites:**
- `.env` with `ARWEAVE_WALLET_PATH`
- Optional: `ARNS_PROCESS_ID` for automatic ArNS updates

### Manual Deployment

```bash
# 1. Build production bundle
npm run build:prod

# 2. Upload dist/ to Arweave
# Use your preferred Arweave upload tool

# 3. Update ArNS to point to new transaction ID
```

## Updating Content

```bash
# Fetch latest publications from CrimRXiv
npm run import

# Regenerate Parquet file
npm run export

# Build and deploy
npm run deploy
```

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

For more help, see [CLAUDE.md](CLAUDE.md) troubleshooting section.
