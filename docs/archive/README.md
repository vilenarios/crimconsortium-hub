# Archive - Historical Planning Documents

This folder contains planning documents, migration plans, and decision-making docs from the development phase of the CrimRxiv Archive project. These documents are kept for historical reference but are no longer actively used.

## Why These Are Archived

The CrimRxiv Archive project went through several architectural iterations before reaching the current implementation (SPA with DuckDB-WASM and Parquet). These documents capture:

- **Planning phases** - Initial plans before implementation
- **Migration plans** - Documents guiding transitions between approaches
- **Architecture decisions** - Options considered before final decisions
- **Investigation docs** - Research and exploration of different solutions
- **Outdated operational docs** - Guides that reference old architectures

## Current Documentation

For current, actively maintained documentation, see:

- `../ARCHITECTURE.md` - Current technical architecture
- `../PATTERN_GUIDE.md` - Universal data pipeline pattern
- `../PARQUET_SCHEMA.md` - Parquet file schema
- `../DEPLOYMENT.md` - Deployment guide
- `../TESTING_GUIDE.md` - Testing procedures
- `../SECURITY_CHECKLIST.md` - Security best practices
- `../ARWEAVE_MANIFEST_ARCHITECTURE.md` - Manifest structure
- Root `CLAUDE.md` - Complete developer guide
- Root `README.md` - Project overview

## Archived Documents

### Root Documentation (17 docs)
*Moved from root directory - status reports, deployment guides, and troubleshooting docs*

**Status Reports & Milestones:**
- `STATUS.md` - "Core workflow is working!" (Nov 4, 2025)
- `FINAL_STATUS.md` - "Ready for deployment" (Nov 2, 2025)
- `DEPLOYMENT_READY.md` - "All fixes applied, ready" (Nov 2, 2025)
- `IMPLEMENTATION_COMPLETE.md` - "Ready for testing"
- `SIMPLIFIED_IMPLEMENTATION.md` - "Implementation complete!"

**Deployment Guides (Duplicates):**
- `DEPLOYMENT_GUIDE.md` - Deployment walkthrough (superseded by docs/DEPLOYMENT.md)
- `DEPLOYMENT_CHECKLIST.md` - Deployment checklist
- `TESTING_CHECKLIST.md` - Testing checklist (similar to docs/TESTING_GUIDE.md)
- `ARNS_SETUP.md` - ArNS setup guide (Nov 4, 2025)

**Troubleshooting/Fixes (Resolved):**
- `ARWEAVE_DEPLOYMENT_ISSUES.md` - Critical issues (now fixed)
- `QUICK_FIX.md` - Quick fixes for deployment
- `dynamic-gateway-config.md` - Gateway config solution (implemented)
- `VERSION_SUPPORT.md` - Version support implementation (Nov 4, 2025)
- `ARNS_IMPLEMENTATION.md` - ArNS auto-update implementation (Nov 4, 2025)

**Analysis/Planning:**
- `UPLOAD_FLOW_ANALYSIS.md` - Upload flow analysis
- `WORKFLOW.md` - Simplified workflow documentation
- `ARCHITECTURE.md` - Earlier/shorter architecture doc (257 lines vs current 562)

### Migration & Planning (5 docs)
*From docs/ directory - planning phase documents*
- `PUBPUB_SDK_MIGRATION_PLAN.md` - Plan for moving from HTML scraping to SDK
- `ARWEAVE_MIGRATION_PLAN.md` - Plan for Arweave individual transactions
- `SDK_SCRAPER_PLAN.md` - SDK scraper planning
- `FULL_CONTENT_ARCHIVAL_PLAN.md` - Full content archival planning
- `MARKDOWN_ARCHIVAL_PIPELINE.md` - Markdown pipeline planning

### Architecture Decisions (3 docs)
- `PARQUET_ARCHITECTURE_OPTIONS.md` - Comparison of Parquet approaches
- `CRIMRXIV_PARQUET_ARCHITECTURE.md` - Initial Parquet architecture
- `PARQUET_APP_IMPLEMENTATION.md` - Implementation planning

### Investigation & Design (4 docs)
- `EXTERNAL_PUBLICATIONS_INVESTIGATION.md` - External pubs investigation
- `EXTERNAL_PUBLICATIONS_SOLUTION.md` - External pubs solution
- `EXTERNAL_PUBLICATIONS_UI_MOCKUP.md` - UI mockups
- `ARTICLE_PAGE_DESIGN_ANALYSIS.md` - Design analysis

### Outdated Operational (3 docs)
- `PRODUCT_SPEC.md` - Original spec (mentions 835 pubs & SSG, now 3,700+ & SPA)
- `ADMIN_GUIDE.md` - Old admin guide (SSG-era)
- `PUBPUB_SDK_QUICKSTART.md` - SDK quickstart (integration complete)

### Vendor Documentation (1 doc)
- `ARDRIVE-CORE-JS-README.md` - Copy of ArDrive vendor readme

---

**Note:** These documents remain valuable for understanding the project's evolution and decision-making process, but they should not be used as current guidance for development or deployment.
