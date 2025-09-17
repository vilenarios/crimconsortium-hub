# Static Site Implementation Plan V2 - ArNS Undername Architecture

## 🎯 Revised Optimal Strategy: ArNS Undernames as Data Distribution

Perfect insight! Since the static site itself deploys to Arweave with `crimconsortium` as the main ArNS name, we can use **ArNS undernames** as our data distribution system with integrated sync updates.

### **Elegant ArNS Undername Structure:**
```
crimconsortium              # Main static site on Arweave
├── HTML/CSS/JS static site deployed to Arweave
├── Progressive enhancement with undername data loading
└── Service worker for offline academic research

data_crimconsortium         # Articles metadata + Arweave transaction IDs
├── All 37 publications with direct PDF links
├── Updated during sync process
└── Permanent data endpoint

search_crimconsortium       # Pre-built search system
├── Lunr.js search index for client-side search
├── Article summaries for result display  
└── Auto-complete and suggestion data

members_crimconsortium      # Member institution data
├── 15 consortium member profiles
├── Publication counts and statistics
└── Institution-specific article lists

stats_crimconsortium        # Real-time consortium statistics
├── Live publication counts
├── Member activity metrics
└── Archive health status
```

## 🚀 **Revolutionary Benefits of This Approach:**

### **Integrated Sync Process**
- **Data updates** automatically update ArNS undernames during sync
- **Version control** through ArNS undername updates
- **Atomic updates** - all data endpoints update together
- **Rollback capability** - previous ArNS versions available

### **Performance Advantages**
- **Sub-1s initial load** - minimal static HTML on Arweave
- **Parallel data loading** - multiple undernames fetch in parallel
- **Cached endpoints** - ArNS provides CDN-like performance
- **Direct PDF access** - no proxy servers, permanent links

### **Cost & Maintenance**
- **Low ArNS costs** - undernames much cheaper than separate domains
- **Automated updates** - sync process handles all undername updates
- **No server costs** - entirely static and permanent
- **Team friendly** - simple `npm run sync` updates everything

## 🏗️ Technical Implementation

### **1. Static Site Generator with Undername Integration**

```javascript
// scripts/build-site.js
class CrimConsortiumSiteBuilder {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    // ArNS undername configuration
    this.undernames = {
      data: 'data_crimconsortium',
      search: 'search_crimconsortium', 
      members: 'members_crimconsortium',
      stats: 'stats_crimconsortium'
    };
    
    this.dataset = null;
    this.buildArtifacts = {
      mainSite: './dist/site',           # crimconsortium
      dataEndpoint: './dist/data',       # data_crimconsortium
      searchEndpoint: './dist/search',   # search_crimconsortium
      membersEndpoint: './dist/members', # members_crimconsortium
      statsEndpoint: './dist/stats'      # stats_crimconsortium
    };
  }

  async buildComplete() {
    this.logger.info('🏗️ Building complete CrimConsortium site with ArNS undernames...');
    
    try {
      // Step 1: Load verified consortium dataset
      await this.loadDataset();
      
      // Step 2: Generate main static site
      await this.generateMainSite();
      
      // Step 3: Generate data endpoints for undernames
      await this.generateDataEndpoints();
      
      // Step 4: Generate search system
      await this.generateSearchSystem();
      
      // Step 5: Generate member endpoints
      await this.generateMemberEndpoints();
      
      // Step 6: Generate stats endpoint
      await this.generateStatsEndpoint();
      
      // Step 7: Create deployment manifests for each undername
      await this.createUndernameMani fests();
      
      this.logger.success('Complete site build with ArNS undernames ready');
      
    } catch (error) {
      this.logger.error('Site build failed', error.message);
      throw error;
    }
  }

  async generateMainSite() {
    this.logger.info('🌐 Generating main static site...');
    
    await this.fileHelper.ensureDir(this.buildArtifacts.mainSite);
    
    // Homepage with progressive enhancement
    const homepage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CrimConsortium - Permanent Criminology Research Hub</title>
  <meta name="description" content="Permanent archive of criminology research from 15 leading consortium institutions">
  
  <!-- Critical CSS inlined for fast load -->
  <style>${await this.getCriticalCSS()}</style>
  
  <!-- Preload critical data endpoints -->
  <link rel="preload" href="https://${this.undernames.stats}.ar" as="fetch" crossorigin>
  <link rel="preload" href="https://${this.undernames.data}.ar/recent.json" as="fetch" crossorigin>
  
  <!-- Academic metadata -->
  <meta name="citation_title" content="CrimConsortium Research Archive">
  <meta name="dc.title" content="CrimConsortium">
  <meta name="dc.creator" content="CrimRxiv Consortium">
  
  <!-- PWA manifest -->
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#1a365d">
</head>
<body class="academic-layout">
  <!-- Static content for immediate render -->
  <header class="site-header" role="banner">
    <div class="container">
      <h1 class="site-title">CrimConsortium</h1>
      <p class="site-subtitle">Permanent Hub for Criminology Research</p>
      
      <!-- Consortium stats (populated via JS) -->
      <div class="stats-bar">
        <span class="stat" id="total-publications">37 Publications</span>
        <span class="stat" id="total-members">15 Members</span>
        <span class="stat" id="total-countries">6 Countries</span>
      </div>
    </div>
  </header>
  
  <!-- Search interface -->
  <section class="search-section" role="search">
    <div class="container">
      <div class="search-container">
        <label for="search-input" class="sr-only">Search publications</label>
        <input 
          type="search" 
          id="search-input" 
          placeholder="Search consortium publications..."
          aria-describedby="search-help"
        >
        <div id="search-results" class="search-results" hidden></div>
        <p id="search-help" class="search-help">Search titles, authors, abstracts across 37 publications</p>
      </div>
    </div>
  </section>
  
  <!-- Member showcase -->
  <section class="members-section">
    <div class="container">
      <h2>Consortium Members</h2>
      <div class="members-grid" id="members-grid">
        <!-- Populated from members_crimconsortium.ar -->
        <div class="member-card loading">Loading members...</div>
      </div>
    </div>
  </section>
  
  <!-- Recent publications -->
  <section class="publications-section">
    <div class="container">
      <h2>Recent Publications</h2>
      <div class="articles-list" id="recent-articles">
        <!-- Populated from data_crimconsortium.ar/recent.json -->
        <div class="article-card loading">Loading recent publications...</div>
      </div>
      <a href="/articles" class="view-all-link">View All Publications →</a>
    </div>
  </section>
  
  <!-- Progressive enhancement -->
  <script src="/assets/scripts/app.js" defer></script>
  
  <!-- Service worker registration -->
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  </script>
</body>
</html>`;
    
    await this.fileHelper.writeFile(`${this.buildArtifacts.mainSite}/index.html`, homepage);
    this.logger.success('Main site homepage generated');
  }

  async generateDataEndpoints() {
    this.logger.info('📊 Generating data endpoints...');
    
    await this.fileHelper.ensureDir(this.buildArtifacts.dataEndpoint);
    
    // Main articles data with Arweave transaction IDs
    const articlesData = {
      articles: this.dataset.publications.map(pub => ({
        id: pub.id,
        slug: pub.slug,
        title: pub.title,
        authors: pub.authors.map(a => ({ name: a.name, affiliation: a.affiliation })),
        abstract: pub.description,
        doi: pub.doi,
        date: pub.createdAt,
        year: new Date(pub.createdAt).getFullYear(),
        
        // Direct Arweave access
        arweaveId: pub.arweaveId || 'pending-upload',
        pdfUrl: pub.arweaveId ? `https://arweave.net/${pub.arweaveId}` : null,
        
        // Member associations
        members: pub.memberAssociations,
        primaryMember: pub.memberAssociations[0],
        
        // Academic metadata
        license: 'CC-BY-4.0',
        type: 'research-article',
        
        // Site URLs
        url: `/articles/${pub.slug}`,
        memberUrl: `/members/${pub.memberAssociations[0]}`
      })),
      
      metadata: {
        totalArticles: this.dataset.publications.length,
        totalMembers: this.dataset.members.length,
        dateRange: this.dataset.summary.dateRange,
        lastUpdated: new Date().toISOString(),
        version: this.dataset.metadata.version,
        endpoint: `https://${this.undernames.data}.ar`
      }
    };
    
    await this.fileHelper.writeJSON(`${this.buildArtifacts.dataEndpoint}/articles.json`, articlesData);
    
    // Recent articles for homepage
    const recentArticles = {
      articles: articlesData.articles
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10),
      generated: new Date().toISOString()
    };
    
    await this.fileHelper.writeJSON(`${this.buildArtifacts.dataEndpoint}/recent.json`, recentArticles);
    
    // Create index.json as main endpoint
    await this.fileHelper.writeJSON(`${this.buildArtifacts.dataEndpoint}/index.json`, articlesData);
    
    this.logger.success('Data endpoints generated for data_crimconsortium');
  }

  async generateSearchSystem() {
    this.logger.info('🔍 Generating search system...');
    
    await this.fileHelper.ensureDir(this.buildArtifacts.searchEndpoint);
    
    // Build Lunr.js search index
    const searchIndex = lunr(function() {
      this.ref('id');
      this.field('title', { boost: 10 });
      this.field('abstract', { boost: 5 });
      this.field('authors', { boost: 8 });
      this.field('member', { boost: 3 });
      this.field('year', { boost: 2 });
      
      this.dataset.publications.forEach(article => {
        this.add({
          id: article.id,
          title: article.title,
          abstract: article.description,
          authors: article.authors.map(a => a.name).join(' '),
          member: this.dataset.members.find(m => 
            article.memberAssociations.includes(m.id)
          )?.name || '',
          year: new Date(article.createdAt).getFullYear().toString()
        });
      });
    }.bind(this));
    
    // Search index for client-side search
    const searchData = {
      lunrIndex: searchIndex,
      metadata: {
        totalDocuments: this.dataset.publications.length,
        fields: ['title', 'abstract', 'authors', 'member', 'year'],
        generated: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    await this.fileHelper.writeJSON(`${this.buildArtifacts.searchEndpoint}/index.json`, searchData);
    
    // Document data for search results
    const searchDocs = {
      documents: this.dataset.publications.map(pub => ({
        id: pub.id,
        title: pub.title,
        authors: pub.authors.map(a => a.name),
        abstract: pub.description.substring(0, 200) + '...',
        date: pub.createdAt,
        year: new Date(pub.createdAt).getFullYear(),
        member: this.dataset.members.find(m => 
          pub.memberAssociations.includes(m.id)
        )?.name || '',
        memberSlug: pub.memberAssociations[0],
        url: `/articles/${pub.slug}`,
        pdfUrl: pub.arweaveId ? `https://arweave.net/${pub.arweaveId}` : null
      }))
    };
    
    await this.fileHelper.writeJSON(`${this.buildArtifacts.searchEndpoint}/docs.json`, searchDocs);
    
    // Search suggestions for auto-complete
    const suggestions = {
      authors: [...new Set(this.dataset.publications.flatMap(p => p.authors.map(a => a.name)))],
      members: this.dataset.members.map(m => m.name),
      years: [...new Set(this.dataset.publications.map(p => new Date(p.createdAt).getFullYear()))],
      topics: this.extractTopics()
    };
    
    await this.fileHelper.writeJSON(`${this.buildArtifacts.searchEndpoint}/suggestions.json`, suggestions);
    
    this.logger.success('Search system generated for search_crimconsortium');
  }

  async generateMemberEndpoints() {
    this.logger.info('👥 Generating member endpoints...');
    
    await this.fileHelper.ensureDir(this.buildArtifacts.membersEndpoint);
    
    // Main members index
    const membersIndex = {
      members: this.dataset.members.map(member => ({
        id: member.id,
        name: member.name,
        publicationCount: member.publicationCount,
        publications: member.publications,
        keywords: member.keywords || [],
        profileUrl: `/members/${member.id}`,
        articlesUrl: `https://${this.undernames.members}.ar/${member.id}.json`
      })),
      metadata: {
        totalMembers: this.dataset.members.length,
        activeMembers: this.dataset.members.filter(m => m.publicationCount > 0).length,
        generated: new Date().toISOString()
      }
    };
    
    await this.fileHelper.writeJSON(`${this.buildArtifacts.membersEndpoint}/index.json`, membersIndex);
    
    // Individual member data files
    for (const member of this.dataset.members) {
      const memberPublications = this.dataset.publications.filter(pub =>
        pub.memberAssociations.includes(member.id)
      );
      
      const memberData = {
        member: {
          id: member.id,
          name: member.name,
          keywords: member.keywords || [],
          publicationCount: member.publicationCount
        },
        publications: memberPublications.map(pub => ({
          id: pub.id,
          title: pub.title,
          authors: pub.authors.map(a => a.name),
          date: pub.createdAt,
          doi: pub.doi,
          pdfUrl: pub.arweaveId ? `https://arweave.net/${pub.arweaveId}` : null,
          url: `/articles/${pub.slug}`
        })),
        statistics: {
          totalPublications: memberPublications.length,
          yearRange: this.getYearRange(memberPublications),
          topCoAuthors: this.getTopCoAuthors(memberPublications)
        },
        generated: new Date().toISOString()
      };
      
      await this.fileHelper.writeJSON(`${this.buildArtifacts.membersEndpoint}/${member.id}.json`, memberData);
    }
    
    this.logger.success('Member endpoints generated for members_crimconsortium');
  }

  async generateStatsEndpoint() {
    this.logger.info('📊 Generating statistics endpoint...');
    
    await this.fileHelper.ensureDir(this.buildArtifacts.statsEndpoint);
    
    const stats = {
      consortium: {
        totalMembers: this.dataset.members.length,
        activeMembers: this.dataset.members.filter(m => m.publicationCount > 0).length,
        totalPublications: this.dataset.publications.length,
        totalCountries: 6, // Known from consortium data
        revenue: '$40k', // From team document
        founded: '2023'
      },
      
      publications: {
        byYear: this.groupByYear(),
        byMember: this.groupByMember(),
        recentCount: this.dataset.publications.filter(p => 
          new Date(p.createdAt) > new Date(Date.now() - 30*24*60*60*1000)
        ).length,
        totalPDFs: this.dataset.publications.filter(p => p.filePath).length
      },
      
      archive: {
        totalSize: `${this.dataset.publications.length * 2}MB`,
        permanentStorage: true,
        lastUpdated: new Date().toISOString(),
        arweaveNetwork: 'mainnet',
        arfsVersion: '1.0'
      },
      
      generated: new Date().toISOString(),
      version: '1.0'
    };
    
    await this.fileHelper.writeJSON(`${this.buildArtifacts.statsEndpoint}/index.json`, stats);
    
    this.logger.success('Statistics endpoint generated for stats_crimconsortium');
  }
}
```

### **2. Progressive Enhancement JavaScript**

```javascript
// Main site assets/scripts/app.js
class CrimConsortiumApp {
  constructor() {
    this.endpoints = {
      data: 'https://data_crimconsortium.ar',
      search: 'https://search_crimconsortium.ar', 
      members: 'https://members_crimconsortium.ar',
      stats: 'https://stats_crimconsortium.ar'
    };
    
    this.cache = new Map();
    this.searchIndex = null;
    this.searchDocs = null;
  }

  async init() {
    try {
      this.showLoadingState();
      
      // Load critical data in parallel for homepage
      const [stats, recentArticles, membersIndex] = await Promise.all([
        this.fetchEndpoint('stats', '/index.json'),
        this.fetchEndpoint('data', '/recent.json'),
        this.fetchEndpoint('members', '/index.json')
      ]);
      
      // Update UI with live data
      this.updateStats(stats);
      this.renderRecentArticles(recentArticles);
      this.renderMembersShowcase(membersIndex);
      
      // Setup interactive features
      this.setupSearch();
      this.setupNavigation();
      
      this.hideLoadingState();
      
    } catch (error) {
      this.showError('Failed to load content. Please refresh the page.');
      console.error('App initialization failed:', error);
    }
  }

  async fetchEndpoint(type, path = '/index.json') {
    const cacheKey = `${type}${path}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const url = `${this.endpoints[type]}${path}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.cache.set(cacheKey, data);
      
      return data;
      
    } catch (error) {
      console.error(`Failed to fetch ${type}${path}:`, error);
      throw error;
    }
  }

  async setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    
    if (!searchInput || !searchResults) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      
      searchTimeout = setTimeout(async () => {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
          searchResults.hidden = true;
          return;
        }
        
        try {
          await this.initSearchIndex();
          await this.performSearch(query);
          
        } catch (error) {
          console.error('Search failed:', error);
          this.showSearchError();
        }
      }, 300);
    });
  }

  async initSearchIndex() {
    if (this.searchIndex && this.searchDocs) return;
    
    try {
      const [indexData, docsData] = await Promise.all([
        this.fetchEndpoint('search', '/index.json'),
        this.fetchEndpoint('search', '/docs.json')
      ]);
      
      this.searchIndex = lunr.Index.load(indexData.lunrIndex);
      this.searchDocs = docsData.documents;
      
    } catch (error) {
      throw new Error('Failed to initialize search system');
    }
  }

  async performSearch(query) {
    const results = this.searchIndex.search(query);
    const searchResults = document.getElementById('search-results');
    
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="no-results">No publications found</div>';
      searchResults.hidden = false;
      return;
    }
    
    // Get full document data for results
    const resultDocs = results.slice(0, 10).map(result => {
      return this.searchDocs.find(doc => doc.id === result.ref);
    }).filter(Boolean);
    
    // Render search results
    const resultsHTML = resultDocs.map(doc => `
      <div class="search-result">
        <h3><a href="${doc.url}">${doc.title}</a></h3>
        <div class="result-meta">
          <span class="authors">${doc.authors.join(', ')}</span>
          <span class="member">${doc.member}</span>
          <span class="date">${new Date(doc.date).getFullYear()}</span>
        </div>
        <p class="result-abstract">${doc.abstract}</p>
        ${doc.pdfUrl ? `<a href="${doc.pdfUrl}" class="pdf-link">📄 Download PDF</a>` : ''}
      </div>
    `).join('');
    
    searchResults.innerHTML = resultsHTML;
    searchResults.hidden = false;
  }
}
```

### **3. Integrated Sync Process with ArNS Updates**

```javascript
// Enhanced scripts/sync-ardrive.js
class EnhancedARFSSync {
  async syncWithUndernames() {
    this.logger.info('🔄 Syncing with ArNS undername updates...');
    
    try {
      // Step 1: Upload new/changed articles to ARFS
      await this.uploadArticlesToARFS();
      
      // Step 2: Regenerate data endpoints with new Arweave IDs
      await this.regenerateDataEndpoints();
      
      // Step 3: Update ArNS undernames to point to new data
      await this.updateUndernames();
      
      // Step 4: Verify all undernames working
      await this.verifyUndernames();
      
      this.logger.success('Sync with undernames complete');
      
    } catch (error) {
      this.logger.error('Sync failed', error.message);
      throw error;
    }
  }

  async updateUndernames() {
    this.logger.info('🔗 Updating ArNS undernames...');
    
    const undernamesToUpdate = [
      { name: 'data_crimconsortium', path: './dist/data' },
      { name: 'search_crimconsortium', path: './dist/search' },
      { name: 'members_crimconsortium', path: './dist/members' },
      { name: 'stats_crimconsortium', path: './dist/stats' }
    ];
    
    for (const undername of undernamesToUpdate) {
      try {
        // Upload undername content to Arweave
        const manifestId = await this.uploadToArweave(undername.path);
        
        // Update ArNS undername to point to new manifest
        await this.updateArNSUndername(undername.name, manifestId);
        
        this.logger.success(`Updated ${undername.name} → ${manifestId}`);
        
      } catch (error) {
        this.logger.error(`Failed to update ${undername.name}`, error.message);
      }
    }
  }

  async updateArNSUndername(undernameName, manifestId) {
    // Use AR.IO SDK to update undername
    const ario = ARIO.mainnet();
    
    const result = await ario.updateUndername({
      undername: undernameName,
      manifestId: manifestId,
      ttl: 3600 // 1 hour TTL for faster updates
    });
    
    return result;
  }
}
```

## 🎨 User Experience Flow

### **Academic Researcher Journey**
```
1. Visit crimconsortium.ar
   ├── Instant load (static HTML + critical CSS)
   ├── Progressive enhancement loads recent articles
   └── Member showcase appears
   
2. Search for "police accountability"
   ├── Lazy loads search index from search_crimconsortium.ar
   ├── Real-time search results (sub-300ms)
   ├── Click result → article detail page
   └── Click PDF → direct Arweave download (permanent link)
   
3. Browse member institution
   ├── Click member → loads from members_crimconsortium.ar/[member].json
   ├── See all publications from that institution
   ├── Institution statistics and profile
   └── Direct PDF access for all publications
```

### **Mobile Academic Experience**
```
1. Fast mobile load
   ├── Touch-optimized interface
   ├── Bottom navigation for thumb access
   └── Swipe gestures for quick actions
   
2. Offline reading capability
   ├── Service worker caches critical endpoints
   ├── Recently viewed articles available offline
   └── Search history maintained
```

## 📊 Deployment & Update Strategy

### **Initial Deployment**
```bash
npm run build              # Generate all sites and endpoints
npm run deploy-main        # Deploy crimconsortium.ar (main site)
npm run deploy-data        # Deploy data_crimconsortium.ar
npm run deploy-search      # Deploy search_crimconsortium.ar  
npm run deploy-members     # Deploy members_crimconsortium.ar
npm run deploy-stats       # Deploy stats_crimconsortium.ar
```

### **Ongoing Updates (Integrated with Sync)**
```bash
npm run sync               # Upload new articles + update all undernames
# This automatically:
# 1. Uploads new articles to ARFS
# 2. Regenerates data endpoints with new Arweave IDs
# 3. Updates all ArNS undernames
# 4. Verifies all endpoints working
```

### **Granular Updates (When Needed)**
```bash
npm run update-data        # Update only data_crimconsortium.ar
npm run update-search      # Update only search_crimconsortium.ar
npm run update-members     # Update only members_crimconsortium.ar
```

## 💰 Cost Structure (Optimized)

### **ArNS Undernames (Much Cheaper!)**
- `crimconsortium` - Main domain (~$10-50)
- `data_crimconsortium` - Undername (~$2-10)
- `search_crimconsortium` - Undername (~$2-10)  
- `members_crimconsortium` - Undername (~$2-10)
- `stats_crimconsortium` - Undername (~$2-10)
- **Total ArNS**: ~$18-90/year (vs $40-200 before)

### **Storage Costs**
- **Articles**: 74MB = ~$0.74
- **Site assets**: ~10MB = ~$0.10
- **Data endpoints**: ~2MB = ~$0.02
- **Total Storage**: ~$0.86 one-time

### **Total Project Cost: ~$19-91** (Excellent!)

## 🏆 **Why This Architecture is Revolutionary:**

### **For Academic Users**
- ✅ **Instant access** to permanent research
- ✅ **Fast search** across all consortium content
- ✅ **Mobile optimized** for research on-the-go
- ✅ **Offline capability** for uninterrupted reading

### **For CrimRXiv Team**
- ✅ **Simple updates** - `npm run sync` updates everything
- ✅ **Independent data** - update content without site rebuild
- ✅ **Version control** - ArNS provides rollback capability
- ✅ **Cost effective** - sustainable within consortium budget

### **For Permanence**
- ✅ **Entirely on Arweave** - no external dependencies
- ✅ **ArNS undernames** provide fast, cached access
- ✅ **Direct PDF links** - no intermediary servers
- ✅ **Fault tolerant** - multiple endpoints prevent failures

---

## 🚀 **Ready to Implement**

This ArNS undername architecture elegantly solves all the challenges:
- **Performance**: Sub-2s loads with progressive enhancement
- **Academic UX**: Optimized for research workflows  
- **Team maintenance**: Integrated sync process
- **Cost**: ~$19-91 total (very reasonable)
- **Permanence**: Entirely decentralized on Arweave

**Should I begin implementing the static site generator with this ArNS undername architecture?**