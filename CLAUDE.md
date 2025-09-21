# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development:**
```bash
npm run build     # Generate complete static site (868 pages)
npm run dev       # Local server at http://localhost:3000
npm run import    # Process consortium data from CrimRXiv exports
npm run validate  # Verify build integrity
```

**Testing:**
- No automated tests configured
- Manual testing via `npm run dev` and checking localhost:3000
- Verify homepage displays 25 recent publications
- Check member pages and article pages load correctly

## Architecture

**Static Site Generator:**
- Builds 868 static HTML pages from a 56MB consortium dataset
- 835 publications from 30 consortium members
- 37 PDF attachments archived locally in `data/final/pdfs/`
- Output directory: `dist/main/`

**Main Build Script:** `scripts/build-enhanced-complete.js`
- Loads consortium dataset from `data/final/consortium-dataset.json`
- Generates homepage with 25 recent publications
- Creates article pages using `improved-article-template.js`
- Generates member profile pages with publication counts
- Copies PDFs from `data/final/pdfs/` to `dist/main/assets/pdfs/`

**Templates:**
- `scripts/improved-article-template.js` - Article page generator with CrimRXiv-style design
- Inline CSS for Arweave optimization (no external dependencies)

**Data Processing:**
- Import script: `scripts/robust-incremental-scraper.js` (processes CrimRXiv exports)
- Dataset location: `data/final/consortium-dataset.json` (56MB)
- PDF storage: `data/final/pdfs/` (37 files, 26MB total)

## Deployment

**Arweave Deployment:**
- Build complete static site: `npm run build`
- Verify locally: `npm run dev` and check localhost:3000
- Upload `dist/main/` folder to Arweave (~82MB, ~$0.82 cost)
- Optional: Configure ArNS domain (crimconsortium.ar)