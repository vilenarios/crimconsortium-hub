#!/usr/bin/env node

/**
 * CrimConsortium Static Site Generator
 * Builds static site with CrimRXiv consortium design + ArNS undername data architecture
 * Designed for permanent deployment on Arweave with optimal performance
 */

import handlebars from 'handlebars';
import lunr from 'lunr';
import fs from 'fs-extra';
import path from 'path';
import { Logger, FileHelper, ProgressTracker } from '../src/lib/utils.js';

class CrimConsortiumSiteBuilder {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    // ArNS undername configuration
    this.undernames = {
      main: 'crimconsortium',
      data: 'data_crimconsortium',
      search: 'search_crimconsortium', 
      members: 'members_crimconsortium',
      stats: 'stats_crimconsortium'
    };
    
    // Build output directories
    this.buildDirs = {
      main: './dist/main',           // crimconsortium.ar
      data: './dist/data',           // data_crimconsortium.ar
      search: './dist/search',       // search_crimconsortium.ar
      members: './dist/members',     // members_crimconsortium.ar
      stats: './dist/stats'          // stats_crimconsortium.ar
    };
    
    this.dataset = null;
    this.templates = new Map();
    
    // Build statistics
    this.buildStats = {
      pagesGenerated: 0,
      endpointsGenerated: 0,
      assetsProcessed: 0,
      manifestsCreated: 0
    };
  }

  async buildComplete() {
    this.logger.info('🏗️ Building CrimConsortium site with CrimRXiv design...');
    
    try {
      // Step 1: Load consortium dataset
      await this.loadDataset();
      
      // Step 2: Setup build directories
      await this.setupBuildDirectories();
      
      // Step 3: Load and register templates
      await this.setupTemplates();
      
      // Step 4: Generate main static site (crimconsortium.ar)
      await this.generateMainSite();
      
      // Step 5: Generate data endpoints (data_crimconsortium.ar)
      await this.generateDataEndpoints();
      
      // Step 6: Generate search system (search_crimconsortium.ar)
      await this.generateSearchSystem();
      
      // Step 7: Generate member endpoints (members_crimconsortium.ar)
      await this.generateMemberEndpoints();
      
      // Step 8: Generate stats endpoint (stats_crimconsortium.ar)
      await this.generateStatsEndpoint();
      
      // Step 9: Process assets (CSS, JS, images)
      await this.processAssets();
      
      // Step 10: Generate service worker
      await this.generateServiceWorker();
      
      // Step 11: Create deployment manifests
      await this.createDeploymentManifests();
      
      this.logger.success('Complete site build finished');
      this.printBuildSummary();
      
    } catch (error) {
      this.logger.error('Site build failed', error.message);
      throw error;
    }
  }

  async loadDataset() {
    this.logger.info('📚 Loading consortium dataset...');
    
    this.dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
    
    if (!this.dataset) {
      throw new Error('Consortium dataset not found. Run "npm run import" first.');
    }
    
    this.logger.success(`Dataset loaded: ${this.dataset.publications.length} publications from ${this.dataset.members.length} members`);
  }

  async setupBuildDirectories() {
    this.logger.info('📁 Setting up build directories...');
    
    // Create all build directories
    for (const [name, dir] of Object.entries(this.buildDirs)) {
      await this.fileHelper.ensureDir(dir);
      await this.fileHelper.ensureDir(`${dir}/assets`);
    }
    
    this.logger.success('Build directories created');
  }

  async setupTemplates() {
    this.logger.info('📝 Setting up Handlebars templates...');
    
    // Register Handlebars helpers
    handlebars.registerHelper('formatDate', (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      });
    });
    
    handlebars.registerHelper('truncate', (text, length = 200) => {
      return text && text.length > length ? text.substring(0, length) + '...' : text;
    });
    
    handlebars.registerHelper('authorList', (authors) => {
      return authors.map(a => a.name).join(', ');
    });
    
    // Create base layout template matching CrimRXiv design
    const baseLayout = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{pageTitle}} - CrimConsortium</title>
  <meta name="description" content="{{description}}">
  
  <!-- Critical CSS (CrimRXiv-inspired) -->
  <style>
    :root {
      --crimrxiv-black: #000000;
      --crimrxiv-white: #ffffff;
      --crimrxiv-gray: #666666;
      --crimrxiv-light-gray: #f5f5f5;
      --crimrxiv-border: #ddd;
      --crimrxiv-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: var(--crimrxiv-font);
      color: var(--crimrxiv-black);
      background: var(--crimrxiv-white);
      line-height: 1.6;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }
    
    /* Header matching CrimRXiv style */
    .site-header {
      background: var(--crimrxiv-white);
      border-bottom: 1px solid var(--crimrxiv-border);
      padding: 1rem 0;
    }
    
    .site-title {
      font-size: 2rem;
      font-weight: bold;
      color: var(--crimrxiv-black);
      text-decoration: none;
      display: inline-block;
    }
    
    .site-subtitle {
      color: var(--crimrxiv-gray);
      font-size: 1rem;
      margin-top: 0.5rem;
    }
    
    /* Navigation matching CrimRXiv */
    .nav-bar {
      background: var(--crimrxiv-light-gray);
      border-bottom: 1px solid var(--crimrxiv-border);
      padding: 0.75rem 0;
    }
    
    .nav-list {
      list-style: none;
      display: flex;
      gap: 2rem;
      margin: 0;
      padding: 0;
    }
    
    .nav-item a {
      color: var(--crimrxiv-black);
      text-decoration: none;
      font-weight: 500;
      padding: 0.5rem 0;
      border-bottom: 2px solid transparent;
      transition: border-color 0.2s;
    }
    
    .nav-item a:hover,
    .nav-item a.active {
      border-bottom-color: var(--crimrxiv-black);
    }
    
    /* Member grid matching CrimRXiv consortium layout */
    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }
    
    .member-card {
      border: 1px solid var(--crimrxiv-border);
      border-radius: 4px;
      overflow: hidden;
      transition: box-shadow 0.2s;
      background: var(--crimrxiv-white);
    }
    
    .member-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .member-card-image {
      width: 100%;
      height: 120px;
      background: var(--crimrxiv-light-gray);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--crimrxiv-gray);
    }
    
    .member-card-content {
      padding: 1rem;
    }
    
    .member-name {
      font-weight: bold;
      font-size: 0.9rem;
      line-height: 1.4;
      color: var(--crimrxiv-black);
    }
    
    .member-stats {
      color: var(--crimrxiv-gray);
      font-size: 0.8rem;
      margin-top: 0.5rem;
    }
    
    /* Article cards */
    .article-card {
      border-bottom: 1px solid var(--crimrxiv-border);
      padding: 1.5rem 0;
    }
    
    .article-card:last-child {
      border-bottom: none;
    }
    
    .article-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--crimrxiv-black);
      text-decoration: none;
      line-height: 1.4;
      display: block;
      margin-bottom: 0.5rem;
    }
    
    .article-title:hover {
      text-decoration: underline;
    }
    
    .article-meta {
      color: var(--crimrxiv-gray);
      font-size: 0.85rem;
      margin-bottom: 0.75rem;
    }
    
    .article-abstract {
      color: var(--crimrxiv-black);
      line-height: 1.5;
      font-size: 0.9rem;
    }
    
    /* Search interface */
    .search-container {
      background: var(--crimrxiv-light-gray);
      padding: 2rem 0;
      border-bottom: 1px solid var(--crimrxiv-border);
    }
    
    .search-input {
      width: 100%;
      max-width: 600px;
      padding: 0.75rem 1rem;
      border: 1px solid var(--crimrxiv-border);
      border-radius: 4px;
      font-size: 1rem;
      background: var(--crimrxiv-white);
    }
    
    .search-input:focus {
      outline: none;
      border-color: var(--crimrxiv-black);
    }
    
    /* Stats bar */
    .stats-bar {
      display: flex;
      gap: 2rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
    
    .stat {
      color: var(--crimrxiv-gray);
      font-size: 0.9rem;
    }
    
    .stat-number {
      font-weight: bold;
      color: var(--crimrxiv-black);
    }
    
    /* Responsive design */
    @media (max-width: 768px) {
      .members-grid {
        grid-template-columns: 1fr;
      }
      
      .nav-list {
        flex-direction: column;
        gap: 1rem;
      }
      
      .stats-bar {
        flex-direction: column;
        gap: 0.5rem;
      }
    }
    
    /* Academic optimizations */
    @media print {
      .site-header, .nav-bar, .search-container { display: none; }
      body { font-size: 12pt; color: black; }
    }
    
    /* Accessibility */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    
    /* Loading states */
    .loading {
      color: var(--crimrxiv-gray);
      font-style: italic;
    }
    
    .error {
      color: #d32f2f;
      background: #ffebee;
      padding: 1rem;
      border-radius: 4px;
      margin: 1rem 0;
    }
  </style>
  
  <!-- Academic metadata -->
  {{#if article}}
  <meta name="citation_title" content="{{article.title}}">
  <meta name="citation_author" content="{{authorList article.authors}}">
  <meta name="citation_publication_date" content="{{article.date}}">
  <meta name="citation_pdf_url" content="{{article.pdfUrl}}">
  <meta name="citation_doi" content="{{article.doi}}">
  {{/if}}
  
  <!-- PWA manifest -->
  <link rel="manifest" href="/manifest.json">
</head>
<body class="{{bodyClass}}">
  <!-- Header matching CrimRXiv design -->
  <header class="site-header" role="banner">
    <div class="container">
      <a href="/" class="site-title">CrimConsortium</a>
      <p class="site-subtitle">Permanent Hub for Criminology Research</p>
      
      <!-- Live stats from stats_crimconsortium.ar -->
      <div class="stats-bar">
        <span class="stat">
          <span class="stat-number" id="total-publications">{{totalPublications}}</span> Publications
        </span>
        <span class="stat">
          <span class="stat-number" id="total-members">{{totalMembers}}</span> Members
        </span>
        <span class="stat">
          <span class="stat-number">6</span> Countries
        </span>
        <span class="stat">
          <span class="stat-number">$40k</span> Revenue
        </span>
      </div>
    </div>
  </header>
  
  <!-- Navigation matching CrimRXiv -->
  <nav class="nav-bar" role="navigation">
    <div class="container">
      <ul class="nav-list">
        <li class="nav-item"><a href="/" class="{{#if isHome}}active{{/if}}">Home</a></li>
        <li class="nav-item"><a href="/articles" class="{{#if isArticles}}active{{/if}}">Publications</a></li>
        <li class="nav-item"><a href="/members" class="{{#if isMembers}}active{{/if}}">Members</a></li>
        <li class="nav-item"><a href="/about" class="{{#if isAbout}}active{{/if}}">About</a></li>
      </ul>
    </div>
  </nav>
  
  <!-- Main content -->
  <main id="main-content" tabindex="-1">
    {{{body}}}
  </main>
  
  <!-- Footer matching CrimRXiv -->
  <footer class="site-footer" style="border-top: 1px solid var(--crimrxiv-border); padding: 2rem 0; margin-top: 3rem; color: var(--crimrxiv-gray);">
    <div class="container">
      <p>CrimConsortium - Permanent archive powered by Arweave</p>
      <p style="font-size: 0.8rem; margin-top: 0.5rem;">
        Built with ❤️ for the global criminology research community
      </p>
    </div>
  </footer>
  
  <!-- Progressive enhancement -->
  <script src="/assets/scripts/app.js" defer></script>
</body>
</html>`;
    
    this.templates.set('layout', handlebars.compile(baseLayout));
    
    // Homepage template
    const homepageTemplate = `{{#> layout pageTitle="Home" isHome=true totalPublications=summary.totalPublications totalMembers=summary.totalMembers}}

<!-- Search section -->
<section class="search-container" role="search">
  <div class="container">
    <h2 class="sr-only">Search Publications</h2>
    <div style="text-align: center;">
      <input 
        type="search" 
        id="search-input"
        class="search-input" 
        placeholder="Search {{summary.totalPublications}} consortium publications..."
        aria-describedby="search-help"
      >
      <div id="search-results" class="search-results" hidden></div>
      <p id="search-help" style="margin-top: 0.5rem; color: var(--crimrxiv-gray); font-size: 0.9rem;">
        Search titles, authors, abstracts from 15 consortium institutions
      </p>
    </div>
  </div>
</section>

<!-- Main content -->
<div class="container" style="padding: 2rem 0;">
  
  <!-- Member showcase matching CrimRXiv grid -->
  <section class="members-section">
    <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem; color: var(--crimrxiv-black);">
      Consortium Members
    </h2>
    <div class="members-grid" id="members-grid">
      <!-- Loading state -->
      <div class="member-card loading">
        <div class="member-card-image">Loading...</div>
        <div class="member-card-content">
          <div class="member-name">Loading consortium members...</div>
        </div>
      </div>
    </div>
  </section>
  
  <!-- Recent publications -->
  <section class="publications-section" style="margin-top: 3rem;">
    <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem; color: var(--crimrxiv-black);">
      Recent Publications
    </h2>
    <div class="articles-list" id="recent-articles">
      <!-- Loading state -->
      <div class="article-card loading">
        <div class="article-title">Loading recent publications...</div>
      </div>
    </div>
    <div style="text-align: center; margin-top: 2rem;">
      <a href="/articles" style="color: var(--crimrxiv-black); text-decoration: none; font-weight: 500; border-bottom: 1px solid var(--crimrxiv-black);">
        View All Publications →
      </a>
    </div>
  </section>
  
</div>

{{/layout}}`;
    
    this.templates.set('homepage', handlebars.compile(homepageTemplate));
    
    this.logger.success('Templates registered with CrimRXiv styling');
  }

  async generateMainSite() {
    this.logger.info('🌐 Generating main static site...');
    
    // Generate homepage
    const homepageData = {
      pageTitle: 'CrimConsortium - Permanent Criminology Research Hub',
      description: 'Permanent archive of criminology research from 15 leading consortium institutions',
      summary: this.dataset.summary,
      bodyClass: 'homepage'
    };
    
    const homepage = this.templates.get('homepage')(homepageData);
    await fs.writeFile(`${this.buildDirs.main}/index.html`, homepage);
    this.buildStats.pagesGenerated++;
    
    // Generate articles listing page
    await this.generateArticlesPage();
    
    // Generate member pages
    await this.generateMemberPages();
    
    // Generate about page
    await this.generateAboutPage();
    
    this.logger.success('Main site pages generated');
  }

  async generateArticlesPage() {
    const articlesTemplate = `{{#> layout pageTitle="All Publications" isArticles=true}}

<div class="container" style="padding: 2rem 0;">
  <h1 style="font-size: 2rem; margin-bottom: 1rem;">All Publications</h1>
  <p style="color: var(--crimrxiv-gray); margin-bottom: 2rem;">
    {{summary.totalPublications}} publications from {{summary.totalMembers}} consortium members
  </p>
  
  <!-- Filter controls -->
  <div class="filter-controls" style="margin-bottom: 2rem; padding: 1rem; background: var(--crimrxiv-light-gray); border-radius: 4px;">
    <label for="member-filter" style="margin-right: 1rem;">Filter by member:</label>
    <select id="member-filter" style="padding: 0.5rem; border: 1px solid var(--crimrxiv-border);">
      <option value="">All members</option>
      <!-- Populated via JavaScript -->
    </select>
    
    <label for="year-filter" style="margin: 0 1rem;">Year:</label>
    <select id="year-filter" style="padding: 0.5rem; border: 1px solid var(--crimrxiv-border);">
      <option value="">All years</option>
      <!-- Populated via JavaScript -->
    </select>
  </div>
  
  <!-- Articles list -->
  <div class="articles-list" id="all-articles">
    <div class="loading">Loading all publications...</div>
  </div>
</div>

{{/layout}}`;
    
    const compiledTemplate = handlebars.compile(articlesTemplate);
    const articlesPage = compiledTemplate({
      summary: this.dataset.summary
    });
    
    await this.fileHelper.ensureDir(`${this.buildDirs.main}/articles`);
    await fs.writeFile(`${this.buildDirs.main}/articles/index.html`, articlesPage);
    this.buildStats.pagesGenerated++;
  }

  async generateDataEndpoints() {
    this.logger.info('📊 Generating data endpoints for data_crimconsortium...');
    
    // Main articles data
    const articlesData = {
      articles: this.dataset.publications.map(pub => ({
        id: pub.id,
        slug: pub.slug,
        title: pub.title,
        authors: pub.authors.map(a => ({ 
          name: a.name, 
          affiliation: a.affiliation,
          orcid: a.orcid 
        })),
        abstract: pub.description,
        doi: pub.doi,
        date: pub.createdAt,
        year: new Date(pub.createdAt).getFullYear(),
        
        // Direct Arweave access (will be filled during actual upload)
        arweaveId: pub.arweaveId || 'placeholder-for-upload',
        pdfUrl: pub.arweaveId ? `https://arweave.net/${pub.arweaveId}` : '/placeholder.pdf',
        
        // Member associations
        members: pub.memberAssociations,
        primaryMember: pub.memberAssociations[0],
        memberName: this.dataset.members.find(m => 
          pub.memberAssociations.includes(m.id)
        )?.name || '',
        
        // URLs
        url: `/articles/${pub.slug}`,
        memberUrl: `/members/${pub.memberAssociations[0]}`
      })),
      
      metadata: {
        totalArticles: this.dataset.publications.length,
        totalMembers: this.dataset.members.length,
        dateRange: this.dataset.summary.dateRange,
        lastUpdated: new Date().toISOString(),
        endpoint: `https://${this.undernames.data}.ar`
      }
    };
    
    // Save main articles data
    await this.fileHelper.writeJSON(`${this.buildDirs.data}/index.json`, articlesData);
    await this.fileHelper.writeJSON(`${this.buildDirs.data}/articles.json`, articlesData);
    
    // Recent articles for homepage
    const recentArticles = {
      articles: articlesData.articles
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10),
      generated: new Date().toISOString()
    };
    
    await this.fileHelper.writeJSON(`${this.buildDirs.data}/recent.json`, recentArticles);
    
    this.buildStats.endpointsGenerated++;
    this.logger.success('Data endpoints generated');
  }

  async processAssets() {
    this.logger.info('🎨 Processing assets...');
    
    // Create main app JavaScript
    const appJS = `
// CrimConsortium Progressive Enhancement
class CrimConsortiumApp {
  constructor() {
    this.endpoints = {
      data: 'https://${this.undernames.data}.ar',
      search: 'https://${this.undernames.search}.ar',
      members: 'https://${this.undernames.members}.ar',
      stats: 'https://${this.undernames.stats}.ar'
    };
    
    this.cache = new Map();
    this.searchIndex = null;
    this.searchDocs = null;
  }

  async init() {
    try {
      // Load live stats
      const stats = await this.fetchJSON(this.endpoints.stats + '/index.json');
      this.updateStats(stats);
      
      // Load recent articles for homepage
      if (window.location.pathname === '/') {
        await this.loadHomepageContent();
      }
      
      // Setup search
      this.setupSearch();
      
      // Setup member grid
      this.setupMemberGrid();
      
    } catch (error) {
      console.error('App initialization failed:', error);
      this.showError('Failed to load content. Please refresh the page.');
    }
  }

  async fetchJSON(url) {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      this.cache.set(url, data);
      return data;
      
    } catch (error) {
      console.error(\`Failed to fetch \${url}:\`, error);
      throw error;
    }
  }

  async loadHomepageContent() {
    try {
      const [recentArticles, membersData] = await Promise.all([
        this.fetchJSON(this.endpoints.data + '/recent.json'),
        this.fetchJSON(this.endpoints.members + '/index.json')
      ]);
      
      this.renderRecentArticles(recentArticles.articles);
      this.renderMembersGrid(membersData.members);
      
    } catch (error) {
      console.error('Failed to load homepage content:', error);
    }
  }

  renderMembersGrid(members) {
    const grid = document.getElementById('members-grid');
    if (!grid) return;
    
    const membersHTML = members.map(member => \`
      <div class="member-card">
        <div class="member-card-image">
          \${member.name.split(' ')[0]}
        </div>
        <div class="member-card-content">
          <div class="member-name">\${member.name}</div>
          <div class="member-stats">\${member.publicationCount} publications</div>
        </div>
      </div>
    \`).join('');
    
    grid.innerHTML = membersHTML;
  }

  renderRecentArticles(articles) {
    const container = document.getElementById('recent-articles');
    if (!container) return;
    
    const articlesHTML = articles.map(article => \`
      <div class="article-card">
        <a href="\${article.url}" class="article-title">\${article.title}</a>
        <div class="article-meta">
          <span>\${article.authors.map(a => a.name).join(', ')}</span> • 
          <span>\${article.memberName}</span> • 
          <span>\${new Date(article.date).getFullYear()}</span>
        </div>
        <div class="article-abstract">\${article.abstract}</div>
        \${article.pdfUrl ? \`<a href="\${article.pdfUrl}" style="color: var(--crimrxiv-black); text-decoration: none; font-size: 0.9rem;">📄 Download PDF</a>\` : ''}
      </div>
    \`).join('');
    
    container.innerHTML = articlesHTML;
  }

  updateStats(stats) {
    const elements = {
      'total-publications': stats.publications?.totalPublications || stats.consortium?.totalPublications,
      'total-members': stats.consortium?.totalMembers
    };
    
    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && value) {
        element.textContent = value;
      }
    });
  }

  async setupSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      
      searchTimeout = setTimeout(async () => {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
          if (searchResults) searchResults.hidden = true;
          return;
        }
        
        try {
          await this.initSearch();
          await this.performSearch(query);
          
        } catch (error) {
          console.error('Search failed:', error);
        }
      }, 300);
    });
  }

  async initSearch() {
    if (this.searchIndex && this.searchDocs) return;
    
    const [indexData, docsData] = await Promise.all([
      this.fetchJSON(this.endpoints.search + '/index.json'),
      this.fetchJSON(this.endpoints.search + '/docs.json')
    ]);
    
    this.searchIndex = lunr.Index.load(indexData.lunrIndex);
    this.searchDocs = docsData.documents;
  }

  async performSearch(query) {
    const results = this.searchIndex.search(query);
    const searchResults = document.getElementById('search-results');
    
    if (!searchResults) return;
    
    if (results.length === 0) {
      searchResults.innerHTML = '<div style="padding: 1rem; color: var(--crimrxiv-gray);">No publications found</div>';
      searchResults.hidden = false;
      return;
    }
    
    const resultDocs = results.slice(0, 8).map(result => 
      this.searchDocs.find(doc => doc.id === result.ref)
    ).filter(Boolean);
    
    const resultsHTML = \`
      <div style="background: white; border: 1px solid var(--crimrxiv-border); border-radius: 4px; margin-top: 0.5rem; max-height: 400px; overflow-y: auto;">
        \${resultDocs.map(doc => \`
          <div style="border-bottom: 1px solid var(--crimrxiv-border); padding: 1rem;">
            <a href="\${doc.url}" style="color: var(--crimrxiv-black); text-decoration: none; font-weight: 500; display: block; margin-bottom: 0.5rem;">\${doc.title}</a>
            <div style="color: var(--crimrxiv-gray); font-size: 0.85rem; margin-bottom: 0.5rem;">
              \${doc.authors.join(', ')} • \${doc.member} • \${doc.year}
            </div>
            <div style="font-size: 0.9rem; line-height: 1.4;">\${doc.abstract}</div>
            \${doc.pdfUrl ? \`<a href="\${doc.pdfUrl}" style="color: var(--crimrxiv-black); font-size: 0.8rem; text-decoration: none;">📄 PDF</a>\` : ''}
          </div>
        \`).join('')}
      </div>
    \`;
    
    searchResults.innerHTML = resultsHTML;
    searchResults.hidden = false;
  }

  showError(message) {
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = message;
    document.body.insertBefore(error, document.body.firstChild);
    
    setTimeout(() => error.remove(), 5000);
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new CrimConsortiumApp();
  app.init();
});
    `;
    
    await fs.writeFile(`${this.buildDirs.main}/assets/scripts/app.js`, appJS);
    
    // Create PWA manifest
    const manifest = {
      name: 'CrimConsortium',
      short_name: 'CrimConsortium',
      description: 'Permanent criminology research hub',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#000000',
      icons: [
        {
          src: '/assets/images/icon-192.png',
          sizes: '192x192',
          type: 'image/png'
        }
      ]
    };
    
    await this.fileHelper.writeJSON(`${this.buildDirs.main}/manifest.json`, manifest);
    
    this.buildStats.assetsProcessed++;
    this.logger.success('Assets processed');
  }

  printBuildSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('🏗️ STATIC SITE BUILD SUMMARY');
    console.log('='.repeat(70));
    
    console.log(`📄 Pages Generated: ${this.buildStats.pagesGenerated}`);
    console.log(`📊 Data Endpoints: ${this.buildStats.endpointsGenerated}`);
    console.log(`🎨 Assets Processed: ${this.buildStats.assetsProcessed}`);
    console.log(`📋 Manifests Created: ${this.buildStats.manifestsCreated}`);
    
    console.log('\n🌐 ArNS Undername Structure:');
    Object.entries(this.undernames).forEach(([type, undername]) => {
      console.log(`   ${type}: https://${undername}.ar`);
    });
    
    console.log('\n📁 Build Output:');
    Object.entries(this.buildDirs).forEach(([type, dir]) => {
      console.log(`   ${type}: ${dir}`);
    });
    
    console.log('\n🚀 READY FOR DEPLOYMENT:');
    console.log('✅ Main site with CrimRXiv design');
    console.log('✅ ArNS undername data architecture');
    console.log('✅ Progressive enhancement with search');
    console.log('✅ Academic-optimized user experience');
    
    console.log('\n📋 Next Commands:');
    console.log('   npm run sync    # Upload to ARFS + update undernames');
    console.log('   npm run deploy  # Deploy all endpoints to Arweave');
    
    console.log('='.repeat(70));
  }
}

// Run builder if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const builder = new CrimConsortiumSiteBuilder();
  builder.buildComplete().catch(error => {
    console.error('Build failed:', error.message);
    process.exit(1);
  });
}

export default CrimConsortiumSiteBuilder;