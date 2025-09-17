# CrimRXiv Static Hub - Product Specification

## 🎯 Project Overview

### Mission Statement
Create a permanent, decentralized archive of criminology research from the CrimRXiv consortium on Arweave, ensuring perpetual access to academic knowledge while maintaining the user experience of the original platform.

### Core Objectives
1. **Preserve Knowledge**: Archive 1000+ criminology research papers permanently on Arweave
2. **Maintain Accessibility**: Replicate the browsing and search experience of the original CrimRXiv consortium site
3. **Ensure Permanence**: Leverage Arweave's permanent storage for both articles and the hosting platform
4. **Enable Discovery**: Provide robust search, filtering, and categorization capabilities
5. **Cost Efficiency**: Optimize storage costs while maintaining quality and accessibility

---

## 🏗️ Technical Architecture

### Core Components

#### 1. Data Collection Engine
```
CrimRXiv Source → Sitemap Parser → Article Scraper → Metadata Extractor → Local Storage
```
- **Sitemap Parser**: Extract all article URLs from sitemap.xml (~1000+ articles)
- **Article Scraper**: Extract metadata, abstracts, author info, and download links
- **PDF Downloader**: Download article PDFs with rate limiting and error handling
- **Metadata Normalizer**: Standardize data format for consistent site generation

#### 2. Static Site Generator
```
Local Data → Template Engine → Static HTML/CSS/JS → Optimized Bundle
```
- **Template System**: Generate article pages, listing pages, and search interface
- **Search Engine**: Client-side search using Lunr.js or Fuse.js
- **Responsive Design**: Mobile-first design optimized for academic reading
- **Asset Optimization**: Minimize bundle size for faster Arweave loading

#### 3. Arweave Integration Layer
```
PDFs → ArDrive → Permanent Links
Static Site → Arweave → ArNS Domain
```
- **ArDrive Storage**: Upload PDFs to ArDrive for permanent, organized storage
- **Site Deployment**: Deploy static site to Arweave with optimal bundling
- **ArNS Management**: Configure human-readable domain name

### Technology Stack
- **Backend**: Node.js with ES modules
- **Scraping**: Cheerio, Axios, xml2js
- **Frontend**: Vanilla JavaScript, modern CSS, HTML5
- **Search**: Lunr.js for client-side full-text search
- **Build**: Custom build pipeline optimized for Arweave
- **Storage**: ArDrive CLI for file management

---

## 📊 Data Management Strategy

### Article Data Structure
```json
{
  "id": "article-identifier",
  "title": "Article Title",
  "authors": ["Author 1", "Author 2"],
  "abstract": "Full abstract text",
  "keywords": ["keyword1", "keyword2"],
  "doi": "10.21428/cb6ab371.xxxxx",
  "pubDate": "2025-09-15",
  "ardriveLink": "https://ardrive.io/file/xxx",
  "originalUrl": "https://crimrxiv.com/pub/xxx",
  "fileSize": 1234567,
  "downloadCount": 0
}
```

### Storage Strategy
- **Local Development**: Articles and metadata stored locally during development
- **ArDrive Organization**: Structured folder hierarchy by year/month for easy management
- **Metadata Index**: Single JSON file containing all article metadata for fast loading
- **Backup Strategy**: Multiple ArDrive folders and local backups

### Data Validation
- **Required Fields**: Title, authors, abstract, PDF link validation
- **Data Sanitization**: Clean HTML entities, normalize text encoding
- **Duplicate Detection**: Prevent duplicate articles based on DOI/URL
- **Error Logging**: Comprehensive logging for failed downloads/processing

---

## 🌐 Site Features & User Experience

### Target User Groups & Their Needs

#### Primary Users (85% of traffic)
1. **Academic Researchers (40%)**: Deep search, citation tracking, literature reviews
2. **Graduate Students (25%)**: Topic exploration, thesis research, collection building  
3. **Criminal Justice Practitioners (15%)**: Evidence-based practice, policy research
4. **Undergraduate Students (10%)**: Course assignments, accessible content

#### Secondary Users (15% of traffic)
5. **Journalists & Policymakers**: Recent findings, quotable research, policy implications

### Core User Journeys

#### 1. Discovery Journey: "I need papers about [topic]"
```
Homepage Search → Smart Results → Filter/Sort → Preview → Save/Download → Cite
```
**Key Features**: Smart search with auto-complete, advanced filters, preview mode, batch operations

#### 2. Research Journey: "Literature review on [broad topic]"
```
Advanced Search → Complex Query → Filter Refinement → Collection Building → Citation Network → Export Bibliography
```
**Key Features**: Boolean search, collection management, citation analysis, research dashboard

#### 3. Reading Journey: "Deep dive into specific paper"  
```
Paper Landing → Quick Actions → Reading Mode → Annotations → Related Content → Citation Follow
```
**Key Features**: Multiple reading modes, highlighting/notes, related content discovery

#### 4. Exploration Journey: "What's new in criminology?"
```
Homepage Dashboard → Content Filters → Browse Modes → Interest Tracking → Pattern Discovery
```
**Key Features**: Personalized dashboard, trending content, multiple browse modes

#### 5. Professional Journey: "Evidence for policy proposal"
```
Policy Section → Methodology Filters → Impact Assessment → Evidence Package → Professional Sharing
```
**Key Features**: Policy-focused navigation, impact indicators, executive summaries

### Information Architecture

#### Homepage Design
- **Hero Section**: Search + recent additions counter + trending topics
- **Navigation**: Browse All | By Topic | By Institution | Recent | Collections  
- **Featured Content**: Recent publications, most downloaded, editor's picks
- **Quick Stats**: 3,630 papers, 2,500+ authors, 150+ institutions

#### Search & Discovery
- **Smart Search**: Auto-complete, typo tolerance, semantic matching
- **Advanced Filters**: Date, authors, institutions, methodology, geography
- **Multiple Views**: List view, grid view, timeline view
- **Sort Options**: Relevance, date, citations, downloads
- **Saved Searches**: Personal search history and alerts

#### Article Detail Pages
- **Rich Metadata**: Complete bibliographic info, DOI, institutions
- **Action Bar**: Download PDF, Save, Cite, Share, Rate
- **Content Tabs**: Abstract, Key Findings, Full Paper, References, Cited By
- **Sidebar**: Citation metrics, download stats, tags, related papers
- **Social Features**: Download counts, sharing, rating system

### Mobile-First Responsive Design

#### Mobile Navigation
- **Bottom Tab Bar**: Home, Search, Saved, Recent, Profile
- **Collapsible Search**: Expandable with voice input
- **Swipe Gestures**: Save, share, quick actions
- **Progressive Web App**: Offline reading, push notifications

#### Touch Interactions
- **Quick Actions**: Long-press context menus
- **Batch Selection**: Multi-select for bulk operations  
- **Smart Scrolling**: Infinite scroll with performance optimization
- **Voice Search**: Speech-to-text capability

### Accessibility & Inclusion (WCAG 2.1 AA)

#### Visual Accessibility
- **High Contrast Mode**: Dark mode, customizable themes
- **Dyslexia Support**: OpenDyslexic font, reading aids
- **Screen Reader**: Full ARIA markup, semantic HTML
- **Font Scaling**: Responsive typography, zoom support

#### Cognitive Accessibility  
- **Plain Language**: Simplified abstracts, jargon explanations
- **Visual Hierarchy**: Clear organization, consistent navigation
- **Progress Indicators**: Clear feedback for operations
- **Help System**: Contextual help, tooltips, guided tours

### Performance Optimization

#### Speed Targets
- **<3s Load Times**: Critical path optimization
- **<500ms Search**: Real-time results as user types
- **Progressive Loading**: Above-fold content priority
- **Smart Caching**: Predictive content loading

#### Offline Capabilities
- **Service Worker**: Cache critical pages and search index
- **Progressive Sync**: Queue actions for online sync
- **Offline Reading**: Downloaded papers accessible offline  
- **Background Updates**: Sync new content when available

### Content Quality & Trust

#### Quality Indicators
- **Peer Review Status**: Clear badges for review status
- **Citation Metrics**: Usage statistics, impact indicators
- **Author Verification**: ORCID integration, institutional affiliation
- **Publication Timeline**: Submission, review, publication dates

#### Academic Standards
- **Citation Formatting**: APA, MLA, Chicago, BibTeX export
- **Metadata Richness**: Complete bibliographic information
- **Cross-References**: Links to cited papers when available
- **Permanent Preservation**: Immutable Arweave URLs with integrity verification

---

## ⚡ Arweave Integration Strategy

### Storage Architecture

#### ArDrive Organization
```
/CrimRXiv-Archive/
├── articles/
│   ├── 2025/
│   │   ├── 09/
│   │   └── 08/
│   └── 2024/
├── metadata/
│   ├── articles-index.json
│   └── search-index.json
└── assets/
    ├── images/
    └── styles/
```

#### Cost Optimization
- **PDF Compression**: Optimize PDFs before upload (maintain readability)
- **Batch Uploads**: Group uploads to minimize transaction costs
- **Deduplication**: Check for existing files before upload
- **Size Monitoring**: Track storage costs and implement alerts

#### Deployment Strategy
- **Staging Environment**: Test site on Arweave before ArNS binding
- **Progressive Deployment**: Deploy in phases (metadata first, then PDFs)
- **Version Management**: Maintain deployment history for rollbacks
- **Health Monitoring**: Automated checks for site availability

### ArNS Configuration
- **Domain Selection**: crimrxiv-archive.ar or similar memorable name
- **DNS Management**: Configure proper TTL and failover
- **SSL/Security**: Ensure secure connections through Arweave gateways
- **Analytics**: Implement privacy-friendly usage tracking

---

## 🚀 Development Phases

### Phase 1: Foundation (Week 1)
- [x] Project setup and dependency management
- [x] Article scraping and download system
- [ ] Initial data collection (first 100 articles)
- [ ] Basic static site generator
- [ ] Local development server

### Phase 2: Core Functionality (Week 2)
- [ ] Complete article collection (all 1000+ articles)
- [ ] Search functionality implementation
- [ ] Responsive design and UI/UX
- [ ] Article detail pages
- [ ] Navigation and filtering

### Phase 3: Arweave Integration (Week 3)
- [ ] ArDrive CLI integration and testing
- [ ] PDF upload to ArDrive
- [ ] Site deployment to Arweave
- [ ] ArNS domain configuration
- [ ] Performance optimization

### Phase 4: Enhancement & Launch (Week 4)
- [ ] Advanced search features
- [ ] Offline functionality
- [ ] Analytics implementation
- [ ] User testing and feedback
- [ ] Public launch and documentation

---

## 💰 Cost Considerations

### Arweave Storage Costs
- **Articles**: ~1000 PDFs × 2MB average = 2GB
- **Estimated Cost**: ~$20-40 for permanent storage
- **Site Assets**: ~50MB for HTML/CSS/JS
- **Total Storage**: <$50 for permanent hosting

### ArNS Costs
- **Domain Registration**: ~$10-50 depending on name length
- **Annual Renewal**: Varies by name length and demand

### Development Costs
- **Time Investment**: ~80 hours development time
- **Infrastructure**: Minimal (local development only)
- **Testing**: ArDrive test uploads (~$5)

### Cost Optimization Strategies
- Compress PDFs without quality loss
- Use efficient file formats for metadata
- Implement progressive loading
- Monitor and optimize bundle sizes

---

## 🔄 Maintenance & Updates

### Content Updates
- **Automated Monitoring**: Check CrimRXiv RSS feed daily for new articles
- **Update Pipeline**: Scripted process to add new articles to ArDrive
- **Version Control**: Track changes and maintain update history
- **Notification System**: Alert on successful/failed updates

### Technical Maintenance
- **Dependency Updates**: Regular security and feature updates
- **Performance Monitoring**: Track site speed and availability
- **Error Monitoring**: Log and alert on broken links or failures
- **Backup Verification**: Regular checks of ArDrive data integrity

### Community Management
- **User Feedback**: Collection and response system
- **Feature Requests**: Prioritization and implementation pipeline
- **Bug Reports**: Tracking and resolution process
- **Documentation**: Keep user guides and API docs current

---

## 📈 Success Metrics

### Technical Metrics
- **Site Performance**: <3s load time, >95% uptime
- **Search Quality**: <500ms search response time
- **Data Integrity**: 100% article availability
- **Mobile Experience**: >90% mobile usability score

### User Experience Metrics
- **Discoverability**: Search success rate >85%
- **Engagement**: Average session duration >3 minutes
- **Accessibility**: WCAG 2.1 AA compliance
- **User Satisfaction**: Feedback score >4/5

### Preservation Metrics
- **Completeness**: >99% of original articles preserved
- **Permanence**: 100% availability over time
- **Accessibility**: Global access without restrictions
- **Sustainability**: Self-sustaining with minimal maintenance

---

## ⚠️ Risk Mitigation

### Technical Risks
- **Data Loss**: Multiple backups, version control, redundant storage
- **Performance Issues**: Progressive enhancement, CDN usage, optimization
- **Breaking Changes**: Thorough testing, staged deployments
- **Security Vulnerabilities**: Regular audits, dependency updates

### Legal/Ethical Risks
- **Copyright Compliance**: Verify open access licenses
- **Terms of Service**: Ensure compliance with CrimRXiv ToS
- **Attribution**: Proper citation and credit to original platform
- **Privacy**: No tracking, minimal data collection

### Financial Risks
- **Cost Overruns**: Budget monitoring, cost alerts
- **ArNS Changes**: Plan for pricing model changes
- **Storage Costs**: Implement compression and optimization

### Operational Risks
- **Maintenance Burden**: Automated processes, clear documentation
- **Bus Factor**: Multiple team members, documented procedures
- **Platform Changes**: Monitor Arweave ecosystem developments

---

## 🤔 Open Questions for Discussion

1. **Scope**: Should we start with all 1000+ articles or begin with recent ones (last 2 years)?

2. **Design Philosophy**: 
   - Mirror the exact CrimRXiv design for familiarity?
   - Create a new, optimized design for better UX?
   - Hybrid approach with improved features?

3. **Update Frequency**: 
   - Daily monitoring for new articles?
   - Weekly batch updates?
   - Manual updates when requested?

4. **Advanced Features Priority**:
   - Citation management integration?
   - Social features (comments, ratings)?
   - Integration with academic databases?

5. **Analytics & Privacy**:
   - Privacy-first analytics (no tracking)?
   - Basic usage statistics for authors?
   - No analytics at all?

6. **Monetization/Sustainability**:
   - Community donations for updates?
   - Sponsored by academic institutions?
   - Purely volunteer-driven?

7. **Technical Approach**:
   - Single large deployment or incremental uploads?
   - Client-side search vs. pre-generated search indices?
   - Service worker for offline access priority?

---

## 🔄 UX-Technical Architecture Integration

### Technical Requirements for User Flows

#### Search Performance (Sub-500ms)
- **Pre-built Search Index**: Lunr.js index generated during build
- **Client-side Search**: No server round-trips for basic search
- **Progressive Enhancement**: Server-side fallback for complex queries
- **Smart Indexing**: Title, abstract, authors, keywords, full-text

#### Content Discovery & Navigation  
- **Static Generation**: Pre-rendered pages for all content types
- **Metadata APIs**: ARFS-backed content discovery
- **Dynamic Filtering**: Client-side filter application
- **Permalink Structure**: SEO-friendly URLs with ArNS domain

#### Mobile Performance
- **Service Worker**: Cache-first strategy for core content
- **Progressive Loading**: Critical CSS, lazy images, code splitting
- **Touch Optimization**: 44px minimum touch targets
- **Responsive Images**: Multiple formats and sizes

#### Accessibility Implementation
- **Semantic HTML**: Proper heading hierarchy, landmarks
- **ARIA Labels**: Screen reader support for dynamic content
- **Focus Management**: Keyboard navigation patterns
- **Color Contrast**: 4.5:1 ratio minimum for all text

### ARFS Integration Points

#### Content Management
```typescript
// Search index generation from ARFS
async generateSearchIndex() {
  const articles = await arDrive.listPublicFolder({ 
    folderId: articlesFolder,
    maxDepth: 10 
  });
  
  return lunr(function() {
    this.field('title', { boost: 10 });
    this.field('abstract', { boost: 5 });
    this.field('authors', { boost: 8 });
    this.field('keywords', { boost: 6 });
    articles.forEach(article => this.add(article));
  });
}
```

#### Dynamic Content Links
```typescript
// Link articles to ARFS file IDs
const articleLinks = {
  pdfDownload: `https://arweave.net/${arfsFileId}`,
  citationExport: `/api/cite/${articleId}`,
  relatedPapers: await findRelatedByTags(article.tags)
};
```

#### Performance Monitoring
```typescript
// Track user engagement for optimization
const analytics = {
  searchQueries: trackSearchTerms(),
  popularContent: trackDownloads(),
  userPaths: trackNavigationFlows(),
  performanceMetrics: trackLoadTimes()
};
```

### Development Roadmap Integration

#### Phase 1: Core UX (MVP - 4 weeks)
- ✅ Information architecture design
- [ ] Search and browse functionality  
- [ ] Article detail pages with ARFS PDF links
- [ ] Mobile-responsive layout
- [ ] Basic accessibility compliance
- [ ] Core performance optimization

#### Phase 2: Enhanced Discovery (6 weeks)
- [ ] Advanced search with filters
- [ ] Collection management (localStorage)
- [ ] Citation export functionality
- [ ] Related content algorithms
- [ ] Performance fine-tuning (<3s loads)

#### Phase 3: Professional Features (4 weeks)  
- [ ] Policy-focused navigation
- [ ] Professional sharing tools
- [ ] Advanced citation analysis
- [ ] Offline reading capabilities
- [ ] Analytics and optimization

#### Phase 4: Social & Collaboration (Future)
- [ ] User accounts and profiles
- [ ] Collaborative collections
- [ ] Annotation and note sharing
- [ ] Discussion system
- [ ] Advanced recommendation engine

### Quality Assurance

#### User Testing Plan
1. **Academic Researchers**: Literature review workflow testing
2. **Students**: Assignment research task completion
3. **Practitioners**: Policy evidence gathering scenarios
4. **Accessibility**: Screen reader and keyboard-only testing
5. **Performance**: Mobile device testing on slow connections

#### Success Metrics
- **Search Success Rate**: >85% of searches find relevant results
- **Task Completion**: >90% complete core user journeys
- **Performance**: <3s load time, <500ms search response
- **Accessibility**: 100% WCAG 2.1 AA compliance
- **Mobile Experience**: >4.0 mobile usability score

#### Content Quality Metrics
- **Metadata Completeness**: 100% articles have required fields
- **Link Integrity**: 100% PDF downloads functional
- **Search Coverage**: 100% content discoverable via search
- **Citation Accuracy**: 100% proper citation formatting

---

## 📋 Implementation Priorities

### Immediate (Next 2 weeks)
1. **Complete UX wireframes and visual design**
2. **Set up development environment with ARFS integration**
3. **Build core import pipeline for export.json processing**
4. **Create basic static site generator foundation**

### Short-term (2-6 weeks)  
1. **Implement search functionality with Lunr.js**
2. **Build responsive article listing and detail pages**
3. **Integrate ARFS content delivery**
4. **Add mobile optimization and PWA features**

### Medium-term (6-12 weeks)
1. **Deploy to Arweave with ArNS domain**
2. **Implement live consortium scraping**
3. **Add advanced search and filtering**
4. **Performance optimization and analytics**

### Long-term (3+ months)
1. **User feedback integration**
2. **Advanced features (collections, annotations)**  
3. **Social and collaborative features**
4. **AI-powered recommendations**

---

*This specification provides a comprehensive roadmap for creating a world-class permanent academic archive that serves the global criminology research community while maintaining the highest standards of accessibility, performance, and user experience.*