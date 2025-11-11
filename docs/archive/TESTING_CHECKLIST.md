# CrimRxiv Archive - Testing Checklist

This document provides comprehensive testing checklists for local development and production deployment.

---

## Pre-Deployment Testing (Local)

### 1. Data Export Testing

**Command:** `npm run export`

- [ ] Export completes without errors
- [ ] Output shows correct article count (~3,753)
- [ ] File created: `data/export/metadata.parquet`
- [ ] File size is reasonable (~4-5 MB)
- [ ] No warnings about missing data
- [ ] Statistics match database count

**Expected output:**
```
✅ EXPORT COMPLETE!
Articles Exported: 3753
File Size: 4.82 MB
```

---

### 2. Local Development Server

**Command:** `npm run dev`

#### Homepage Testing
- [ ] Server starts on http://localhost:3005
- [ ] Homepage loads without errors
- [ ] Logo and branding visible
- [ ] Navigation bar renders correctly
- [ ] Search bar functional
- [ ] Recent articles section shows 25 articles
- [ ] Article cards show: title, authors, date, abstract preview
- [ ] "Load More" button works
- [ ] Footer renders correctly

#### Article Page Testing
- [ ] Click on any article from homepage
- [ ] Article page loads with full metadata
- [ ] Title, authors, DOI display correctly
- [ ] Abstract renders (if available)
- [ ] Keywords and collections show (if available)
- [ ] PDF download link works (if available)
- [ ] Breadcrumb navigation works
- [ ] "Back to Homepage" button works

#### Search Testing
- [ ] Enter search query in nav search bar
- [ ] Search results page loads
- [ ] Results show matching articles
- [ ] Search highlights work (if implemented)
- [ ] No results message shows for invalid queries
- [ ] Search is case-insensitive
- [ ] Pagination works (if implemented)

#### Consortium Testing
- [ ] Navigate to /consortium
- [ ] Member list loads
- [ ] All consortium members visible
- [ ] Member detail pages load
- [ ] Member publications filter correctly

---

### 3. Production Build Testing

**Command:** `npm run build`

#### Build Process
- [ ] Build completes without errors
- [ ] No TypeScript/linting errors
- [ ] Bundle size is reasonable (~1-2 MB)
- [ ] Assets are optimized
- [ ] Source maps generated (if configured)

**Expected output:**
```
vite v7.1.12 building for production...
✓ built in 3.45s
dist/index.html                   12.34 kB
dist/assets/index-abc123.js       245.67 kB
```

#### Build Verification
- [ ] `dist/` folder created
- [ ] `dist/index.html` exists
- [ ] Assets in `dist/assets/`
- [ ] No unnecessary files in dist
- [ ] Favicon copied correctly

---

### 4. Local Preview Server

**Command:** `npm run preview`

**Open:** http://localhost:4174

#### WASM Loading (Dev Config)
- [ ] Server starts without errors
- [ ] WASM files load from `/duckdb/`
- [ ] Console shows: "Loading DuckDB-WASM..."
- [ ] Console shows: "DuckDB-WASM initialized"
- [ ] Console shows: "Metadata loaded from external URL"
- [ ] No MIME type errors
- [ ] No CORS errors

#### Parquet Loading (Dev Config)
- [ ] Parquet loads from `/data/metadata.parquet`
- [ ] Console shows: "Loading metadata from external URL"
- [ ] Console shows: "Metadata loaded from external URL"
- [ ] Article count matches export

#### Full Functionality
- [ ] All homepage tests pass (same as dev server)
- [ ] All article page tests pass
- [ ] All search tests pass
- [ ] All consortium tests pass
- [ ] No console errors
- [ ] No network errors (check Network tab)

---

## Post-Deployment Testing (Production)

### 5. External Resources Testing

#### Parquet File
**URL:** `https://data_crimrxiv.arweave.net/metadata.parquet`

- [ ] URL resolves (no 404)
- [ ] File downloads successfully
- [ ] File size matches exported file
- [ ] File is valid Parquet format
- [ ] CORS headers present
- [ ] Content-Type is correct

**Test command:**
```bash
curl -I https://data_crimrxiv.arweave.net/metadata.parquet
```

#### WASM Files
**URLs:**
- `https://arweave.net/YOUR_MVP_TX_ID`
- `https://arweave.net/YOUR_MVP_WORKER_TX_ID`
- `https://arweave.net/YOUR_EH_TX_ID`
- `https://arweave.net/YOUR_EH_WORKER_TX_ID`

- [ ] MVP module loads (check network tab)
- [ ] MVP worker loads
- [ ] EH module loads
- [ ] EH worker loads
- [ ] MIME types correct: `application/wasm`, `application/javascript`
- [ ] CORS headers present
- [ ] Files match local versions

**Test commands:**
```bash
curl -I https://arweave.net/YOUR_MVP_TX_ID
curl -I https://arweave.net/YOUR_MVP_WORKER_TX_ID
```

---

### 6. Production Site Testing

**URL:** `https://crimrxiv.arweave.net`

#### Initial Load
- [ ] Site loads within 3 seconds
- [ ] No loading errors
- [ ] Loading screen displays briefly
- [ ] Homepage renders correctly
- [ ] Console logs show initialization sequence:
  ```
  🚀 Initializing CrimRxiv Archive...
  📦 Initializing database...
  📦 Loading DuckDB-WASM from external resources...
  ✅ DuckDB-WASM initialized
  📋 Loading metadata from external URL
  ✅ Metadata loaded from external URL
  ✅ CrimRxiv Archive initialized
  ```

#### Browser Console Checks
- [ ] No red errors in console
- [ ] No 404 errors in Network tab
- [ ] External parquet loaded (check Network tab)
- [ ] External WASM loaded (check Network tab)
- [ ] DuckDB initialized successfully
- [ ] Metadata count correct

#### Homepage Testing
- [ ] Homepage loads with articles
- [ ] Articles sorted by date (newest first)
- [ ] Article cards render correctly
- [ ] Images load (if any)
- [ ] "Load More" button works
- [ ] Search bar functional
- [ ] Navigation links work

#### Article Page Testing
- [ ] Article pages load from manifests
- [ ] Full content displays (markdown)
- [ ] Attachments section shows PDFs
- [ ] PDF download links work
- [ ] Author information displays
- [ ] Keywords and collections show
- [ ] Manifest TX ID visible
- [ ] "View Manifest" link works

#### Search Testing
- [ ] Search bar works
- [ ] Results show matching articles
- [ ] Search across title, authors, keywords
- [ ] Case-insensitive search
- [ ] No errors for edge cases

#### Consortium Testing
- [ ] Consortium page loads
- [ ] Member list displays
- [ ] Member detail pages work
- [ ] Publications filter by affiliation

---

### 7. Cross-Browser Testing

Test on multiple browsers:

#### Chrome/Edge (Chromium)
- [ ] Site loads correctly
- [ ] WASM initializes
- [ ] All features work
- [ ] No console errors
- [ ] Performance acceptable

#### Firefox
- [ ] Site loads correctly
- [ ] WASM initializes
- [ ] All features work
- [ ] No console errors
- [ ] Performance acceptable

#### Safari (if available)
- [ ] Site loads correctly
- [ ] WASM initializes
- [ ] All features work
- [ ] No console errors
- [ ] Performance acceptable

---

### 8. Mobile Responsiveness

Test on mobile devices or browser dev tools:

#### Mobile Layout
- [ ] Responsive design adapts to small screens
- [ ] Navigation is mobile-friendly
- [ ] Search bar accessible
- [ ] Article cards stack vertically
- [ ] Text is readable (not too small)
- [ ] Buttons are tappable (not too small)
- [ ] No horizontal scrolling

#### Mobile Performance
- [ ] Site loads on mobile network
- [ ] WASM loads successfully
- [ ] Navigation smooth
- [ ] No layout shifts
- [ ] Images optimized

---

### 9. Performance Testing

#### Load Times
- [ ] Homepage loads in < 3 seconds
- [ ] Article pages load in < 2 seconds
- [ ] Search results in < 1 second
- [ ] No significant lag or freezing

#### Network Usage
- [ ] Initial load < 80 MB (includes WASM)
- [ ] Subsequent navigation < 1 MB
- [ ] Parquet loaded only once (check cache)
- [ ] WASM cached correctly

#### Memory Usage
- [ ] Memory usage stable (check Task Manager)
- [ ] No memory leaks on navigation
- [ ] DuckDB cleans up properly

---

### 10. ArNS Configuration Testing

#### Main Domain
**URL:** `https://crimrxiv.arweave.net`

- [ ] Resolves to latest app TX ID
- [ ] No redirect errors
- [ ] HTTPS works
- [ ] SSL certificate valid (if applicable)

#### Data Undername
**URL:** `https://data_crimrxiv.arweave.net/metadata.parquet`

- [ ] Resolves to parquet TX ID
- [ ] File downloads correctly
- [ ] No CORS issues
- [ ] Caching works

---

### 11. Manifest Testing

#### Individual Article Manifests
**URL:** `https://arweave.net/MANIFEST_TX_ID`

- [ ] Manifest JSON loads
- [ ] Has correct structure:
  ```json
  {
    "manifest": "arweave/paths",
    "version": "0.2.0",
    "paths": {
      "article.md": {"id": "..."},
      "pdfs/file.pdf": {"id": "..."}
    }
  }
  ```
- [ ] All paths resolve
- [ ] PDFs load correctly
- [ ] Markdown content displays

#### Manifest Loader Testing
- [ ] manifestLoader caches correctly
- [ ] Prefetch works (if implemented)
- [ ] Error handling for missing manifests
- [ ] Fallback to metadata-only view works

---

### 12. Edge Cases & Error Handling

#### Network Failures
- [ ] Graceful error when parquet fails to load
- [ ] Retry mechanism works (if implemented)
- [ ] Error message displayed to user
- [ ] Reload button functional

#### Invalid URLs
- [ ] 404 page for non-existent articles
- [ ] Invalid slug handled gracefully
- [ ] Redirect to homepage works

#### Empty States
- [ ] Message shown when no search results
- [ ] Handling for articles with no manifest
- [ ] Fallback for missing PDFs

---

## Regression Testing

Before each deployment, verify:

### Core Functionality
- [ ] Data import works: `npm run import`
- [ ] Data export works: `npm run export`
- [ ] Build works: `npm run build`
- [ ] Preview works: `npm run preview`
- [ ] No breaking changes in UI
- [ ] No breaking changes in data structure

### Database Schema
- [ ] All required fields present
- [ ] manifest_tx_id populated for articles
- [ ] Attachments JSON valid
- [ ] Authors JSON valid
- [ ] Keywords/collections valid

---

## Automated Testing (Future)

Consider implementing:

- [ ] Unit tests for components
- [ ] Integration tests for database layer
- [ ] E2E tests with Playwright/Cypress
- [ ] Performance monitoring
- [ ] Uptime monitoring
- [ ] Error tracking (Sentry, etc.)

---

## Testing Tools

### Browser DevTools
- **Console:** Check for errors, warnings
- **Network:** Verify resource loading
- **Performance:** Check load times, memory
- **Application:** Check cache, storage

### Command Line Tools
```bash
# Test URL accessibility
curl -I https://crimrxiv.arweave.net

# Download and verify parquet
curl -O https://data_crimrxiv.arweave.net/metadata.parquet

# Check file size
ls -lh metadata.parquet

# Verify parquet format (requires duckdb CLI)
duckdb -c "SELECT COUNT(*) FROM parquet_scan('metadata.parquet')"
```

### Online Tools
- **GTmetrix:** Page speed analysis
- **WebPageTest:** Performance testing
- **Lighthouse:** Accessibility, SEO, performance audit

---

## Rollback Procedure

If deployment fails:

1. **Revert ArNS to previous TX ID:**
   - Log into ar.io dashboard
   - Change crimrxiv.arweave.net back to previous app TX ID
   - Save changes

2. **Revert data undername (if needed):**
   - Change data_crimrxiv.arweave.net back to previous parquet TX ID

3. **Investigate issues:**
   - Check console errors
   - Review deployment logs
   - Test locally with same configuration
   - Fix issues before re-deploying

4. **Re-deploy when ready:**
   - Follow deployment guide again
   - Test more thoroughly before going live

---

## Support & Debugging

Common issues and solutions:

| Issue | Solution |
|-------|----------|
| WASM won't load | Check MIME types, CORS headers, TX IDs correct |
| Parquet not found | Verify ArNS undername configured, TX ID correct |
| Articles show no content | Check manifests generated and uploaded |
| Search doesn't work | Verify DuckDB initialized, check console |
| Slow loading | Check network tab, optimize bundle size |
| Mobile issues | Test responsive design, check viewport meta tag |

For detailed troubleshooting, see `DEPLOYMENT_GUIDE.md`.

---

## Testing Sign-Off

Before marking deployment as complete:

**Tested by:** ___________
**Date:** ___________
**Environment:** Production
**Browser:** ___________
**All tests passed:** [ ] Yes [ ] No

**Notes:**
