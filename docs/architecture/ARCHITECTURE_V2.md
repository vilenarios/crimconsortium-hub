# CrimRXiv Static Hub - Architecture V2
## Using ArDrive-Core-JS with ARFS & Turbo Integration

## Overview

A comprehensive static site generator that creates a permanent, searchable CrimRXiv archive on Arweave using ArDrive File System (ARFS) with Turbo integration for optimal performance and true file system capabilities.

## Revolutionary Architecture Benefits

### 🗂️ **ARFS (ArDrive File System)**
- **True File System**: Hierarchical folder structure on Arweave
- **Native Delta Support**: Only upload new/changed files automatically
- **Conflict Resolution**: Skip, replace, upsert, rename strategies
- **Metadata Caching**: Local cache for fast operations
- **Manifest Creation**: Automatic web hosting manifests

### ⚡ **Turbo Integration**
- **Optimized Uploads**: 10-100x faster than standard Arweave
- **Automatic Bundling**: Efficient handling of multiple files
- **Progress Tracking**: Real-time upload progress
- **Built-in Retry Logic**: Robust upload handling

## Dual Data Source Strategy

### 1. **Initial Import**: PubPub Export (3,630 articles)
```
export.json (353MB) → Parse Articles → Extract PDFs → ARFS Upload
```

### 2. **Ongoing Sync**: Live CrimRXiv Scraping
```
crimrxiv.com/consortium → RSS Feed → New Articles → ARFS Delta Upload
```

## Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PubPub Export │───▶│  Import Pipeline │───▶│  Local Storage  │
│   (3,630 items) │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐             │
│   Live Scraper  │───▶│   Delta Detect   │◀────────────┘
│   (New Articles)│    │                  │
└─────────────────┘    └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  ARFS Sync with  │
                       │ Turbo Integration│
                       └──────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │     ArDrive ARFS        │
                    │  /CrimRXiv-Archive/     │
                    │  ├── 2020/              │
                    │  ├── 2021/              │
                    │  ├── 2022/              │
                    │  ├── 2023/              │
                    │  ├── 2024/              │
                    │  └── 2025/              │
                    └─────────────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Static Site Gen  │
                       │ + Search Index   │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Arweave Deploy + │
                       │   ArNS Domain    │
                       └──────────────────┘
```

## ARFS Structure Design

### Hierarchical Organization
```
CrimRXiv-Archive/                    # Root Drive (Public)
├── articles/                        # Main articles folder
│   ├── 2020/
│   │   ├── 01-january/
│   │   ├── 02-february/
│   │   └── ...
│   ├── 2021/
│   ├── 2022/
│   ├── 2023/
│   ├── 2024/
│   └── 2025/
├── metadata/                        # Processed metadata
│   ├── articles-index.json
│   ├── search-index.json
│   └── manifests/
├── site/                           # Static site files
│   ├── index.html
│   ├── assets/
│   └── articles/
└── exports/                        # Original exports backup
    └── pubpub-export-2025-09-16.json
```

### Custom Metadata Tagging
```typescript
const articleMetadata = {
  metaDataJson: {
    'CrimRXiv-ID': article.id,
    'DOI': article.doi,
    'Publication-Date': article.createdAt,
    'Authors': article.attributions.map(a => a.name),
    'Title': article.title,
    'Abstract': article.description,
    'Keywords': article.keywords || [],
    'Collection': article.collections,
    'Export-Source': 'PubPub' | 'Scraper',
    'Last-Updated': new Date().toISOString()
  },
  metaDataGqlTags: {
    'App-Name': ['CrimRXiv-Archive'],
    'App-Version': ['2.0.0'],
    'Content-Type': ['Academic-Paper']
  },
  dataGqlTags: {
    'Article-Type': ['Research-Paper'],
    'Academic-Field': ['Criminology'],
    'License': ['CC-BY-4.0']
  }
}
```

## Implementation Scripts

### 1. Import Pipeline (`npm run import`)
```typescript
// scripts/import-export.js
import { readJWKFile, arDriveFactory } from 'ardrive-core-js';

class CrimRXivImporter {
  async parseExport() {
    // Parse 353MB export.json
    // Extract 3,630 articles with metadata
    // Download PDFs from existing URLs
    // Prepare for ARFS upload
  }
  
  async setupARFS() {
    // Create drive and folder structure
    const arDrive = arDriveFactory({ 
      wallet: myWallet,
      turboSettings: {} // Enable Turbo
    });
    
    const drive = await arDrive.createPublicDrive({
      driveName: 'CrimRXiv-Archive'
    });
  }
}
```

### 2. Live Scraper (`npm run scrape`)
```typescript
// scripts/scrape-consortium.js
class CrimRXivScraper {
  async checkForNewArticles() {
    // Parse crimrxiv.com/consortium RSS
    // Compare against local state
    // Download new articles
    // Return delta for ARFS sync
  }
  
  async detectChanges() {
    // Compare with existing ARFS metadata
    // Use conflict resolution: 'upsert'
    // Only process truly new/changed content
  }
}
```

### 3. ARFS Sync (`npm run sync`)
```typescript
// scripts/sync-ardrive.js
class ARFSSync {
  async syncWithTurbo() {
    const arDrive = arDriveFactory({ 
      wallet: myWallet,
      turboSettings: {} 
    });
    
    // Bulk upload with automatic conflict resolution
    const result = await arDrive.uploadAllEntities({
      entitiesToUpload: deltaFiles,
      conflictResolution: 'upsert', // Only upload if changed
      customMetadata: articleMetadata
    });
    
    // Turbo handles bundling and optimization
    console.log(`Uploaded ${result.created.length} new items`);
    console.log(`Cost: ${result.totalCost} AR`);
  }
  
  async createManifests() {
    // Create web hosting manifests
    await arDrive.uploadPublicManifest({
      folderId: siteFolder,
      destManifestName: 'index.html'
    });
  }
}
```

### 4. Static Site Generator (`npm run build`)
```typescript
// scripts/build-site.js
class StaticSiteGenerator {
  async buildFromARFS() {
    // Query ARFS for all articles
    const articles = await arDrive.listPublicFolder({
      folderId: articlesFolder,
      maxDepth: 10
    });
    
    // Generate static HTML pages
    // Create search index with Lunr.js
    // Link to ARFS file IDs for downloads
  }
}
```

## Delta Detection Logic

### Initial State Tracking
```json
// data/arfs-state.json
{
  "drive": {
    "id": "drive-123",
    "rootFolderId": "folder-456"
  },
  "lastSync": "2025-09-16T14:30:00Z",
  "articles": {
    "dc975be1-e02d-454e-8a82-0732f8a3dad8": {
      "arfsFileId": "file-789",
      "arfsFolderId": "folder-2025-09",
      "lastModified": "2020-07-06T23:16:33.820Z",
      "fileHash": "sha256:abc123...",
      "source": "export",
      "uploaded": true
    }
  },
  "folders": {
    "2025": "folder-2025",
    "2025/09": "folder-2025-09"
  },
  "totalArticles": 3630,
  "totalUploaded": 3630,
  "failedUploads": []
}
```

### Smart Delta Processing
```typescript
async detectDeltas(newArticles, existingState) {
  const deltas = {
    new: [],      // Never seen before
    modified: [], // Changed content or metadata  
    unchanged: [] // Skip these
  };
  
  for (const article of newArticles) {
    const existing = existingState.articles[article.id];
    
    if (!existing) {
      deltas.new.push(article);
    } else if (
      article.updatedAt !== existing.lastModified ||
      await this.hashFile(article.filePath) !== existing.fileHash
    ) {
      deltas.modified.push(article);
    } else {
      deltas.unchanged.push(article);
    }
  }
  
  return deltas;
}
```

## Automatic Conflict Resolution

### ARFS Upsert Strategy
```typescript
// Only upload if content actually changed
await arDrive.uploadAllEntities({
  entitiesToUpload: articles,
  conflictResolution: 'upsert', // Smart update only
  progressCallback: (progress) => {
    console.log(`Upload progress: ${progress.percentage}%`);
  }
});
```

### Folder Organization
```typescript
// Automatic year/month folder creation
async getOrCreateFolder(year, month) {
  const yearFolder = await this.ensureFolder(rootFolder, year);
  const monthFolder = await this.ensureFolder(yearFolder, `${month.padStart(2, '0')}-${monthName}`);
  return monthFolder;
}
```

## Cost Optimization

### Turbo Benefits
- **10-100x faster uploads** than standard Arweave
- **Automatic bundling** reduces transaction costs
- **Built-in optimization** for small files

### ARFS Benefits  
- **Delta uploads only** - never re-upload unchanged content
- **Conflict resolution** prevents duplicate uploads
- **Metadata caching** reduces API calls

### Expected Costs
- **Initial Upload**: ~7.3GB = $15-30 (one-time)
- **Monthly Updates**: ~50-100 new articles = $1-5/month
- **Site Deployment**: ~50MB = $0.10-0.50/month

## Monitoring & Maintenance

### Progress Tracking
```bash
# Enable detailed progress logging
export ARDRIVE_PROGRESS_LOG=1
export ARDRIVE_CACHE_LOG=1

npm run sync
```

### Health Checks
```typescript
// Verify ARFS integrity
async verifyUpload(fileId) {
  const file = await arDrive.getPublicFile({ fileId });
  const data = await arDrive.downloadPublicFile({ fileId });
  return data.length === file.size;
}
```

### Automated Monitoring
```bash
# Cron job for daily updates
0 2 * * * cd /path/to/crimrxiv-static-hub && npm run scrape && npm run sync
```

## Development Workflow

### Setup
```bash
npm install
npm run import      # Process export.json (one-time)
npm run sync        # Upload to ARFS with Turbo
npm run build       # Generate static site
npm run deploy      # Deploy to Arweave + ArNS
```

### Ongoing Updates
```bash
npm run scrape      # Check crimrxiv.com for new articles
npm run sync        # Delta upload to ARFS
npm run build       # Regenerate site
npm run deploy      # Update Arweave deployment
```

### Full Pipeline
```bash
npm run full        # Complete pipeline: import → sync → build → deploy
```

## Next Implementation Steps

### Phase 1: ARFS Foundation
- [x] Update architecture for ArDrive-Core-JS
- [ ] Implement import pipeline for export.json
- [ ] Set up ARFS drive and folder structure
- [ ] Test Turbo upload with small subset

### Phase 2: Delta System
- [ ] Build scraper for live consortium updates
- [ ] Implement delta detection logic
- [ ] Test conflict resolution strategies
- [ ] Verify upload state tracking

### Phase 3: Site Generation
- [ ] Build static site generator with ARFS integration
- [ ] Implement search with Lunr.js
- [ ] Create responsive academic design
- [ ] Test manifest creation for hosting

### Phase 4: Production Deployment
- [ ] Full ARFS upload of 3,630 articles
- [ ] Deploy static site to Arweave
- [ ] Configure ArNS domain
- [ ] Set up automated monitoring

This architecture provides:
- ✅ **True file system** with hierarchical organization
- ✅ **Automatic delta uploads** - never duplicate content
- ✅ **Turbo optimization** for fast, cost-effective uploads  
- ✅ **Dual data sources** - export + live scraping
- ✅ **Robust conflict resolution** and error handling
- ✅ **Scalable for ongoing updates** with minimal cost

Ready to proceed with implementation?