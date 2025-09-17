# CrimConsortium Static Hub - Claude Development Notes

## Project Overview

Building **ar://crimconsortium** - a permanent static hub for CrimConsortium member publications on Arweave using ArDrive File System (ARFS).

## Phase 1: Foundation Setup ✅ COMPLETE

### Final Verified Dataset
- **37 consortium publications** with PDFs ✅
- **15 active consortium members** ✅  
- **100% PDF coverage** verified ✅
- **Affiliation-based detection** working properly ✅
- **Clean data structure** established ✅

### Authoritative Data Location
```
./data/final/consortium-dataset.json    # SINGLE SOURCE OF TRUTH
./data/final/pdfs/                      # 37 organized PDFs  
./data/final/metadata/                  # 15 member metadata files
```

### Key Commands Working
```bash
npm run import              # Finalize consortium dataset ✅
npm run verify-setup        # Verify everything ready ✅  
npm run sync               # ARFS upload (ready, tested) ✅
```

## Phase 2: ARFS Integration ✅ READY

### Incremental Sync Features  
- **State tracking** prevents duplicate uploads
- **File hash comparison** detects content changes
- **Batch processing** with resume capability
- **Circuit breakers** prevent cascade failures
- **Custom metadata** with academic fields

### Custom Metadata Schema
```javascript
{
  metaDataJson: {
    'CrimConsortium-Member': 'georgia-state-university',
    'Institution-Name': 'Georgia State University', 
    'DOI': '10.21428/cb6ab371.xxxxx',
    'Authors': ['Author 1', 'Author 2'],
    'Academic-Field': 'Criminology'
  }
}
```

## Phase 3: Static Site Implementation (CURRENT)

### Performance-Optimized Data Loading Strategy

#### **ArNS Data Index Architecture** (OPTIMAL)
```
crimconsortium.ar           # Main static site (HTML/CSS/JS)
data.crimconsortium.ar      # Articles metadata JSON + Arweave links  
search.crimconsortium.ar    # Pre-built Lunr.js search index
members.crimconsortium.ar   # Member institution data
```

#### **Benefits of ArNS Data Endpoints**
- ✅ **Fast initial load** - minimal HTML/CSS/JS bundle
- ✅ **Dynamic data** - fetch from permanent ArNS endpoints
- ✅ **Client-side search** - pre-built index via ArNS
- ✅ **Direct article access** - no intermediary servers
- ✅ **Offline capability** - service worker caches data endpoints
- ✅ **Scalable** - easy to update data without redeploying site
- ✅ **Permanent** - all data permanently stored on Arweave

#### **Alternative Approaches Considered**
- **GraphQL**: Requires server (not static/permanent)
- **ardrive-core-js**: Not web compatible
- **Single manifest**: Large initial payload, slower loading
- **Member undernames**: More complex, harder to maintain

### Implementation Architecture

#### **Data Endpoints**
```javascript
// Main articles metadata with Arweave transaction IDs
data.crimconsortium.ar → {
  "articles": [
    {
      "id": "pub-123",
      "title": "Article Title",
      "authors": ["Author 1"],
      "arweaveId": "tx-hash-for-pdf",
      "member": "georgia-state-university",
      "date": "2021-05-15"
    }
  ],
  "lastUpdated": "2025-09-16T22:00:00Z"
}

// Pre-built search index for fast client-side search
search.crimconsortium.ar → {
  "lunrIndex": {...},        # Lunr.js search index
  "searchData": [...]       # Article data for search results
}

// Member institution data
members.crimconsortium.ar → {
  "members": [
    {
      "id": "georgia-state-university", 
      "name": "Georgia State University",
      "publicationCount": 23,
      "articles": ["pub-1", "pub-2", ...]
    }
  ]
}
```

#### **Static Site Loading Strategy**
```javascript
// 1. Fast initial load (static HTML/CSS/critical JS)
// 2. Progressive enhancement with data loading
// 3. Service worker for offline caching

class CrimConsortiumApp {
  async init() {
    // Load critical data for homepage
    this.articlesData = await fetch('https://data.crimconsortium.ar').then(r => r.json());
    this.membersData = await fetch('https://members.crimconsortium.ar').then(r => r.json());
    
    // Initialize search when needed
    this.searchIndex = null; // Lazy load on first search
    
    // Render homepage
    this.renderHomepage();
  }
  
  async initSearch() {
    if (!this.searchIndex) {
      const searchData = await fetch('https://search.crimconsortium.ar').then(r => r.json());
      this.searchIndex = lunr.Index.load(searchData.lunrIndex);
    }
  }
}
```

#### **Performance Optimizations**
- **Critical CSS** inlined for fast rendering
- **Lazy loading** for search index (only when needed)  
- **Progressive enhancement** - works without JS
- **Service worker** caches ArNS endpoints for offline use
- **Responsive images** and optimized assets
- **Bundle splitting** - search code only loads when needed

### Cost Structure
- **Main site**: ~$3-5 for static site deployment
- **Data endpoints**: ~$1-2 for JSON files
- **ArNS domains**: ~$40-200 for 4 domains (main + 3 data)
- **Articles**: ~$0.74 for 37 publications
- **Total**: ~$45-207 for complete setup

### Development Timeline
- **Week 1**: Static site generator with ArNS data architecture
- **Week 2**: Search implementation and member pages
- **Week 3**: Deployment and ArNS configuration
- **Week 4**: Testing and team handoff

## Environment Setup

### Current Status ✅
```bash
ARWEAVE_WALLET_PATH=/path/to/wallet.json
NODE_ENV=development
ARDRIVE_PROGRESS_LOG=1
TEAM_FRIENDLY_OUTPUT=true
```

### For ArNS Multi-Domain Setup
```bash
ARNS_MAIN_DOMAIN=crimconsortium
ARNS_DATA_DOMAIN=data.crimconsortium  
ARNS_SEARCH_DOMAIN=search.crimconsortium
ARNS_MEMBERS_DOMAIN=members.crimconsortium
```

## Next Phase Commands

### **Continue Development (Current)**
```bash
npm run build              # Generate static site with ArNS data architecture
npm run dev                # Local development server
```

### **When Ready for Upload**
```bash
npm run sync               # Upload articles to ARFS
npm run deploy             # Deploy static site + data endpoints
npm run configure-arns     # Set up multiple ArNS domains
```

**Status**: ✅ Dataset verified, ready for static site development with ArNS data architecture