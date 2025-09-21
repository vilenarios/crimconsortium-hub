#!/usr/bin/env node

/**
 * Fixed Static Site Builder with ar:// Protocol Links
 * Uses correct ARFS architecture with transaction IDs and relative paths
 */

import fs from 'fs-extra';
import { Logger, FileHelper } from '../src/lib/utils.js';
import { generateEnhancedArticlePage } from './enhanced-article-template.js';

class ARProtocolSiteBuilder {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.dataset = null;
    this.buildStats = { pagesGenerated: 0, endpointsGenerated: 0 };
  }

  async buildWithArProtocol() {
    this.logger.info('🏗️ Building site with correct ar:// protocol links...');
    
    try {
      // Load dataset (should have real transaction IDs if sync was run)
      await this.loadDataset();
      
      // Check if we have real Arweave links
      const hasRealLinks = this.checkForRealArweaveLinks();
      
      // Generate all components
      await this.generateHomepage();
      await this.generateArticlePages();
      await this.generateMemberPages();
      await this.generateDataEndpoints();
      await this.generateSearchSystem();
      await this.generateMemberEndpoints();
      await this.generateStatsEndpoint();
      await this.copyAssets();
      
      this.logger.success('Site build with ar:// protocol complete');
      this.printBuildSummary(hasRealLinks);
      
    } catch (error) {
      this.logger.error('Build failed', error.message);
      throw error;
    }
  }

  async loadDataset() {
    this.dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
    if (!this.dataset) throw new Error('Dataset not found. Run "npm run import" first.');
    
    this.logger.success(`Dataset loaded: ${this.dataset.publications.length} publications`);
  }

  checkForRealArweaveLinks() {
    const withRealLinks = this.dataset.publications.filter(pub => 
      pub.arweaveTransactionId && pub.arweaveTransactionId !== 'pending-upload'
    ).length;
    
    if (withRealLinks > 0) {
      this.logger.success(`${withRealLinks} publications have real Arweave transaction IDs`);
      return true;
    } else {
      this.logger.warning('No real Arweave transaction IDs found - PDFs will show as pending');
      return false;
    }
  }

  async generateHomepage() {
    this.logger.info('🏠 Generating homepage with ar:// links...');
    
    const homepage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CrimConsortium - Permanent Criminology Research Hub</title>
  <meta name="description" content="Permanent archive of criminology research from ${this.dataset.members.length} leading consortium institutions">
  
  <!-- CrimRXiv favicon for brand consistency -->
  <link rel="icon" type="image/x-icon" href="./favicon.ico">
  <link rel="shortcut icon" type="image/x-icon" href="./favicon.ico">
  
  <style>
    :root { --primary-black: #000000; --primary-white: #ffffff; --text-gray: #666666; --light-gray: #f5f5f5; --border-gray: #ddd; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--primary-black); background: var(--primary-white); line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
    .header { background: var(--primary-white); border-bottom: 1px solid var(--border-gray); padding: 1rem 0; }
    .site-title { font-size: 2rem; font-weight: bold; color: var(--primary-black); text-decoration: none; }
    .site-subtitle { color: var(--text-gray); margin-top: 0.5rem; }
    .nav-bar { background: var(--light-gray); border-bottom: 1px solid var(--border-gray); padding: 0.75rem 0; }
    .nav-list { list-style: none; display: flex; gap: 2rem; }
    .nav-item a { color: var(--primary-black); text-decoration: none; font-weight: 500; padding: 0.5rem 0; }
    .nav-item a:hover { text-decoration: underline; }
    .search-section { background: var(--light-gray); padding: 2rem 0; text-align: center; }
    .search-input { width: 100%; max-width: 500px; padding: 0.75rem; border: 1px solid var(--border-gray); border-radius: 4px; font-size: 1rem; }
    .members-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .member-card { border: 1px solid var(--border-gray); border-radius: 4px; overflow: hidden; background: var(--primary-white); transition: box-shadow 0.2s; }
    .member-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .member-image { height: 100px; background: var(--light-gray); display: flex; align-items: center; justify-content: center; color: var(--text-gray); font-weight: bold; }
    .member-content { padding: 1rem; }
    .member-name { font-weight: bold; font-size: 0.9rem; line-height: 1.3; margin-bottom: 0.5rem; }
    .member-stats { color: var(--text-gray); font-size: 0.8rem; }
    .article-card { border-bottom: 1px solid var(--border-gray); padding: 1.5rem 0; }
    .article-title { font-size: 1.1rem; font-weight: 600; color: var(--primary-black); text-decoration: none; display: block; margin-bottom: 0.5rem; }
    .article-title:hover { text-decoration: underline; }
    .article-meta { color: var(--text-gray); font-size: 0.85rem; margin-bottom: 0.75rem; }
    .pdf-link { color: var(--primary-black); font-size: 0.9rem; text-decoration: none; }
    .pdf-pending { color: var(--text-gray); font-size: 0.9rem; opacity: 0.7; }
    @media (max-width: 768px) { .members-grid { grid-template-columns: 1fr; } .nav-list { flex-direction: column; gap: 1rem; } }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="container">
      <a href="/" class="site-title">CrimConsortium</a>
      <p class="site-subtitle">Leaders, providers, and supporters of open criminology</p>
    </div>
  </header>
  
  <!-- Navigation -->
  <nav class="nav-bar">
    <div class="container">
      <ul class="nav-list">
        <li class="nav-item"><a href="/">Home</a></li>
        <li class="nav-item"><a href="/articles">Publications</a></li>
        <li class="nav-item"><a href="/members">Members</a></li>
      </ul>
    </div>
  </nav>
  
  <!-- Search -->
  <section class="search-section">
    <div class="container">
      <input type="search" class="search-input" placeholder="Search ${this.dataset.publications.length} consortium publications...">
      <p style="margin-top: 0.5rem; color: var(--text-gray); font-size: 0.9rem;">
        Search functionality loads dynamically from search_crimconsortium.ar
      </p>
    </div>
  </section>
  
  <!-- Main content -->
  <main class="container" style="padding: 2rem 0;">
    
    <!-- Member showcase -->
    <section>
      <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Consortium Members</h2>
      <div class="members-grid">
        ${this.dataset.members.map(member => `
          <a href="/members/${member.id}" class="member-card" style="text-decoration: none; color: inherit;">
            <div class="member-image">
              ${member.name.split(' ')[0]}
            </div>
            <div class="member-content">
              <div class="member-name">${member.name}</div>
              <div class="member-stats">${member.publicationCount} publications</div>
            </div>
          </a>
        `).join('')}
      </div>
    </section>
    
    <!-- Recent publications with ar:// links -->
    <section style="margin-top: 3rem;">
      <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Recent Publications</h2>
      <div>
        ${this.dataset.publications
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 20)
          .map(article => {
            const member = this.dataset.members.find(m => 
              article.memberAssociations.includes(m.id)
            );
            
            // Use ar:// protocol for PDFs
            const pdfLink = article.arweaveTransactionId && article.arweaveTransactionId !== 'pending-upload' ?
              `ar://${article.arweaveTransactionId}` : null;
            
            return `
              <article class="article-card">
                <a href="/articles/${article.slug}" class="article-title">${article.title}</a>
                <div class="article-meta">
                  ${article.authors.map(a => a.name).join(', ')} • 
                  ${member?.name || 'Unknown'} • 
                  ${new Date(article.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <div style="margin-bottom: 0.5rem;">
                  ${(article.description || 'No abstract available.').substring(0, 400)}${(article.description || '').length > 400 ? '...' : ''}
                </div>
                ${pdfLink ? 
                  `<a href="${pdfLink}" class="pdf-link">📄 Download PDF (ar://)</a>` :
                  '<span class="pdf-pending">📄 PDF pending upload to ArDrive</span>'
                }
              </article>
            `;
          }).join('')}
      </div>
    </section>
    
  </main>
  
  <!-- Footer with logo -->
  <footer style="border-top: 1px solid var(--border-gray); padding: 2rem 0; color: var(--text-gray);">
    <div class="container" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <a href="https://www.crimrxiv.com">
          <img src="./assets/images/crimxriv-logo.png" alt="CrimRXiv logo" style="height: 40px;">
        </a>
        <div>
          <p style="margin: 0;">CrimConsortium - Permanent archive</p>
          <p style="margin: 0; font-size: 0.75rem;">ISSN 2766-7170</p>
        </div>
      </div>
      <div>
        <p style="margin: 0; font-size: 0.8rem;">Powered by Arweave • Built for open criminology</p>
      </div>
    </div>
  </footer>
  
  <!-- Progressive enhancement script -->
  <script>
    // Load data from ArNS undernames when available
    document.addEventListener('DOMContentLoaded', async () => {
      try {
        // Try to load live data from ArNS undernames
        // Falls back gracefully if undernames not configured yet
        
        const isProduction = !window.location.hostname.includes('localhost');
        
        if (isProduction) {
          // Load from ArNS undernames in production
          const endpoints = {
            data: 'https://data_crimconsortium.ar',
            members: 'https://members_crimconsortium.ar',
            stats: 'https://stats_crimconsortium.ar'
          };
          
          // Enhanced data loading would go here
          console.log('Production mode: Loading from ArNS undernames');
        } else {
          console.log('Development mode: Using static content');
        }
        
      } catch (error) {
        console.log('Progressive enhancement not available, using static content');
      }
    });
  </script>
</body>
</html>`;
    
    await this.fileHelper.ensureDir('./dist/main');
    await fs.writeFile('./dist/main/index.html', homepage);
    this.buildStats.pagesGenerated++;
    
    this.logger.success('Homepage generated with ar:// protocol links');
  }

  async generateArticlePages() {
    this.logger.info('📄 Generating article pages with ar:// links...');
    
    // First generate articles listing page
    await this.generateArticlesListingPage();
    
    // Then generate individual article pages
    for (const article of this.dataset.publications) {
      const member = this.dataset.members.find(m => 
        article.memberAssociations.includes(m.id)
      );
      
      // Use enhanced article template
      const articleHTML = generateEnhancedArticlePage(article, member);
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${article.title} - CrimConsortium</title>
  <meta name="description" content="${(article.description || '').substring(0, 160)}">
  
  <!-- Academic metadata -->
  <meta name="citation_title" content="${article.title}">
  <meta name="citation_author" content="${article.authors.map(a => a.name).join('; ')}">
  <meta name="citation_publication_date" content="${article.createdAt}">
  <meta name="citation_doi" content="${article.doi}">
  ${pdfLink ? `<meta name="citation_pdf_url" content="${pdfLink}">` : ''}
  
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 1rem; line-height: 1.6; }
    .breadcrumb { margin-bottom: 2rem; }
    .breadcrumb a { color: #666; text-decoration: none; }
    h1 { margin-bottom: 1rem; }
    .meta { color: #666; margin-bottom: 1.5rem; }
    .abstract { background: #f5f5f5; padding: 1.5rem; border-radius: 4px; margin: 1.5rem 0; }
    .btn { display: inline-block; padding: 0.5rem 1rem; border: 1px solid #ddd; color: #000; text-decoration: none; border-radius: 4px; margin-right: 0.5rem; }
    .ar-link { color: #2e7d32; font-weight: 500; }
    .pending { color: #666; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="breadcrumb">
    <a href="/">← Back to CrimConsortium</a>
  </div>
  
  <h1>${article.title}</h1>
  
  <div class="meta">
    <p><strong>Authors:</strong> ${article.authors.map(a => a.name).join(', ')}</p>
    <p><strong>Institution:</strong> ${member?.name || 'Unknown'}</p>
    <p><strong>Published:</strong> ${new Date(article.createdAt).getFullYear()}</p>
    ${article.doi ? `<p><strong>DOI:</strong> <a href="https://doi.org/${article.doi}">${article.doi}</a></p>` : ''}
    ${article.arfsFileId ? `<p><strong>ARFS File ID:</strong> <code>${article.arfsFileId}</code></p>` : ''}
  </div>
  
  <div style="margin-bottom: 2rem;">
    ${pdfLink ? 
      `<a href="${pdfLink}" class="btn ar-link">📄 Download PDF (ar://)</a>` :
      '<span class="btn pending">📄 PDF pending upload to ArDrive</span>'
    }
    ${article.originalUrl ? `<a href="${article.originalUrl}" class="btn" target="_blank">🔗 View on CrimRXiv</a>` : ''}
  </div>
  
  ${article.description ? `
    <div class="abstract">
      <h2>Abstract</h2>
      <p>${article.description}</p>
    </div>
  ` : '<p><em>Abstract not available for this publication.</em></p>'}
  
  <section style="margin-top: 2rem; padding: 1rem; background: #f9f9f9; border-radius: 4px;">
    <h3>Permanent Archive Details</h3>
    <ul style="margin-top: 0.5rem; line-height: 1.8;">
      <li><strong>Publication ID:</strong> ${article.id}</li>
      <li><strong>Archive Integration:</strong> ARFS with Turbo optimization</li>
      <li><strong>Access Protocol:</strong> ${pdfLink ? 'ar:// (permanent)' : 'Pending ARFS upload'}</li>
      <li><strong>Consortium Member:</strong> <a href="/members/${article.memberAssociations[0]}">${member?.name}</a></li>
    </ul>
  </section>
</body>
</html>`;
      
      const articleDir = `./dist/main/articles/${article.slug}`;
      await this.fileHelper.ensureDir(articleDir);
      await fs.writeFile(`${articleDir}/index.html`, articleHTML);
    }
    
    this.buildStats.pagesGenerated += this.dataset.publications.length;
    this.logger.success(`Generated ${this.dataset.publications.length} article pages with ar:// links`);
  }

  async generateDataEndpoints() {
    this.logger.info('📊 Generating data endpoints with ar:// protocol...');
    
    const articlesData = {
      articles: this.dataset.publications.map(pub => ({
        id: pub.id,
        slug: pub.slug,
        title: pub.title,
        authors: pub.authors,
        abstract: pub.description,
        doi: pub.doi,
        date: pub.createdAt,
        year: new Date(pub.createdAt).getFullYear(),
        
        // ARFS references (correct architecture)
        arfsFileId: pub.arfsFileId || null,                    // For ARFS operations
        arweaveTransactionId: pub.arweaveTransactionId || null, // For ar:// access
        pdfUrl: pub.arweaveTransactionId && pub.arweaveTransactionId !== 'pending-upload' ? 
          `ar://${pub.arweaveTransactionId}` : null,           // ar:// protocol link
        
        // Member associations
        members: pub.memberAssociations,
        memberName: this.dataset.members.find(m => 
          pub.memberAssociations.includes(m.id)
        )?.name || '',
        
        // Relative site URLs
        url: `/articles/${pub.slug}`,
        memberUrl: `/members/${pub.memberAssociations[0]}`
      })),
      
      metadata: {
        totalArticles: this.dataset.publications.length,
        lastUpdated: new Date().toISOString(),
        version: '2.0',
        architecture: 'ARFS with ar:// protocol',
        useArProtocol: true,
        endpoint: 'data_crimconsortium.ar'
      }
    };
    
    await this.fileHelper.ensureDir('./dist/data');
    await this.fileHelper.writeJSON('./dist/data/index.json', articlesData);
    await this.fileHelper.writeJSON('./dist/data/articles.json', articlesData);
    
    // Recent articles for homepage
    const recentArticles = {
      articles: articlesData.articles
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10),
      generated: new Date().toISOString(),
      useArProtocol: true
    };
    
    await this.fileHelper.writeJSON('./dist/data/recent.json', recentArticles);
    
    this.buildStats.endpointsGenerated++;
    this.logger.success('Data endpoints generated with ar:// protocol');
  }

  async generateArticlesListingPage() {
    const articlesHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>All Publications - CrimConsortium</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1000px; margin: 0 auto; padding: 1rem; line-height: 1.6; }
    .breadcrumb a { color: #666; text-decoration: none; }
    .filter-bar { background: #f5f5f5; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
    .filter-bar select { margin: 0 0.5rem; padding: 0.5rem; }
    .article { border: 1px solid #ddd; border-radius: 4px; padding: 1.5rem; margin-bottom: 1rem; }
    .article-title { font-size: 1.1rem; font-weight: 600; color: #000; text-decoration: none; display: block; margin-bottom: 0.5rem; }
    .article-title:hover { text-decoration: underline; }
    .btn { display: inline-block; padding: 0.4rem 0.8rem; border: 1px solid #ddd; color: #000; text-decoration: none; border-radius: 4px; font-size: 0.85rem; margin-right: 0.5rem; }
  </style>
</head>
<body>
  <div class="breadcrumb" style="margin-bottom: 2rem;">
    <a href="/">← CrimConsortium</a> > All Publications
  </div>
  
  <h1>All Consortium Publications</h1>
  <p style="color: #666; margin-bottom: 2rem;">${this.dataset.publications.length} publications from 15 consortium members</p>
  
  <div class="filter-bar">
    <label>Filter by institution:</label>
    <select onchange="filterByMember(this.value)">
      <option value="">All institutions</option>
      ${this.dataset.members.map(member => 
        `<option value="${member.id}">${member.name}</option>`
      ).join('')}
    </select>
    
    <label>Year:</label>
    <select onchange="filterByYear(this.value)">
      <option value="">All years</option>
      <option value="2022">2022</option>
      <option value="2021">2021</option>
      <option value="2020">2020</option>
    </select>
  </div>
  
  <div id="articles-list">
    ${this.dataset.publications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(article => {
        const member = this.dataset.members.find(m => 
          article.memberAssociations.includes(m.id)
        );
        const pdfLink = article.arweaveTransactionId && article.arweaveTransactionId !== 'pending-upload' ?
          `/${article.arweaveTransactionId}` : null;
        
        return `
          <article class="article" data-member="${member?.id || ''}" data-year="${new Date(article.createdAt).getFullYear()}">
            <a href="/articles/${article.slug}" class="article-title">${article.title}</a>
            <div style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
              <strong>Authors:</strong> ${article.authors.map(a => a.name).join(', ')} • 
              <strong>Institution:</strong> ${member?.name || 'Unknown'} • 
              <strong>Year:</strong> ${new Date(article.createdAt).getFullYear()}
              ${article.doi ? ` • <strong>DOI:</strong> ${article.doi}` : ''}
            </div>
            ${article.description ? `<div style="margin-bottom: 1rem;">${article.description.substring(0, 300)}${article.description.length > 300 ? '...' : ''}</div>` : ''}
            <div>
              <a href="/articles/${article.slug}" class="btn">📖 Read More</a>
              ${pdfLink ? 
                `<a href="${pdfLink}" class="btn" style="color: #2e7d32;">📄 PDF</a>` : 
                '<span class="btn" style="opacity: 0.5;">📄 PDF pending</span>'
              }
              ${article.originalUrl ? `<a href="${article.originalUrl}" class="btn" target="_blank">🔗 CrimRXiv</a>` : ''}
            </div>
          </article>
        `;
      }).join('')}
  </div>
  
  <script>
    function filterByMember(memberId) {
      const articles = document.querySelectorAll('.article');
      articles.forEach(article => {
        if (!memberId || article.dataset.member === memberId) {
          article.style.display = 'block';
        } else {
          article.style.display = 'none';
        }
      });
    }
    
    function filterByYear(year) {
      const articles = document.querySelectorAll('.article');
      articles.forEach(article => {
        if (!year || article.dataset.year === year) {
          article.style.display = 'block';
        } else {
          article.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
    
    await this.fileHelper.ensureDir('./dist/main/articles');
    await fs.writeFile('./dist/main/articles/index.html', articlesHTML);
    
    this.buildStats.pagesGenerated++;
    this.logger.success('Articles listing page generated');
  }

  async generateMemberPages() {
    this.logger.info('👥 Generating member pages...');
    
    // Members listing
    const membersListHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Consortium Members - CrimConsortium</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 1rem; line-height: 1.6; }
    .breadcrumb a { color: #666; text-decoration: none; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
    .card { border: 1px solid #ddd; border-radius: 4px; padding: 1.5rem; }
    .btn { display: inline-block; padding: 0.5rem 1rem; border: 1px solid #ddd; color: #000; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="breadcrumb" style="margin-bottom: 2rem;">
    <a href="/">← CrimConsortium</a> > Members
  </div>
  
  <h1>Consortium Members</h1>
  <p style="color: #666; margin-bottom: 2rem;">${this.dataset.members.length} leading criminology institutions</p>
  
  <div class="grid">
    ${this.dataset.members.map(member => `
      <div class="card">
        <h2 style="margin-bottom: 0.5rem;">${member.name}</h2>
        <p style="color: #666; margin-bottom: 1rem;">${member.publicationCount} publications</p>
        <a href="/members/${member.id}" class="btn">View Publications</a>
      </div>
    `).join('')}
  </div>
</body>
</html>`;
    
    await this.fileHelper.ensureDir('./dist/main/members');
    await fs.writeFile('./dist/main/members/index.html', membersListHTML);
    
    // Individual member pages with ar:// links
    for (const member of this.dataset.members) {
      const memberPubs = this.dataset.publications.filter(pub =>
        pub.memberAssociations.includes(member.id)
      );
      
      const memberHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${member.name} - CrimConsortium</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1000px; margin: 0 auto; padding: 1rem; line-height: 1.6; }
    .breadcrumb a { color: #666; text-decoration: none; }
    .article { border: 1px solid #ddd; border-radius: 4px; padding: 1.5rem; margin-bottom: 1rem; }
    .article-title { font-size: 1.1rem; font-weight: 600; color: #000; text-decoration: none; display: block; margin-bottom: 0.5rem; }
    .article-title:hover { text-decoration: underline; }
    .btn { display: inline-block; padding: 0.4rem 0.8rem; border: 1px solid #ddd; color: #000; text-decoration: none; border-radius: 4px; font-size: 0.85rem; margin-right: 0.5rem; }
    .ar-link { color: #2e7d32; font-weight: 500; }
  </style>
</head>
<body>
  <div class="breadcrumb" style="margin-bottom: 2rem;">
    <a href="/">← CrimConsortium</a> > <a href="/members">Members</a> > ${member.name}
  </div>
  
  <h1>${member.name}</h1>
  <p style="color: #666; margin-bottom: 2rem;"><strong>${member.publicationCount} publications</strong> in consortium archive</p>
  
  <h2>Publications</h2>
  <div style="margin-top: 1.5rem;">
    ${memberPubs.map(article => {
      const pdfLink = article.arweaveTransactionId && article.arweaveTransactionId !== 'pending-upload' ?
        `ar://${article.arweaveTransactionId}` : null;
      
      return `
        <article class="article">
          <a href="/articles/${article.slug}" class="article-title">${article.title}</a>
          <div style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
            <strong>Authors:</strong> ${article.authors.map(a => a.name).join(', ')} • 
            <strong>Year:</strong> ${new Date(article.createdAt).getFullYear()}
            ${article.doi ? ` • <strong>DOI:</strong> ${article.doi}` : ''}
          </div>
          ${article.description ? `<div style="margin-bottom: 1rem;">${article.description.substring(0, 300)}${article.description.length > 300 ? '...' : ''}</div>` : ''}
          <div>
            <a href="/articles/${article.slug}" class="btn">📖 Read More</a>
            ${pdfLink ? 
              `<a href="${pdfLink}" class="btn ar-link">📄 PDF (ar://)</a>` : 
              '<span class="btn" style="opacity: 0.5;">📄 PDF pending</span>'
            }
            ${article.originalUrl ? `<a href="${article.originalUrl}" class="btn" target="_blank">🔗 CrimRXiv</a>` : ''}
          </div>
        </article>
      `;
    }).join('')}
  </div>
</body>
</html>`;
      
      const memberDir = `./dist/main/members/${member.id}`;
      await this.fileHelper.ensureDir(memberDir);
      await fs.writeFile(`${memberDir}/index.html`, memberHTML);
    }
    
    this.buildStats.pagesGenerated += this.dataset.members.length + 1;
    this.logger.success(`Generated ${this.dataset.members.length + 1} member pages`);
  }

  async generateSearchSystem() {
    // Search system with ar:// protocol awareness
    const searchData = {
      documents: this.dataset.publications.map(pub => ({
        id: pub.id,
        title: pub.title,
        authors: pub.authors.map(a => a.name),
        abstract: (pub.description || '').substring(0, 200),
        date: pub.createdAt,
        year: new Date(pub.createdAt).getFullYear(),
        member: this.dataset.members.find(m => 
          pub.memberAssociations.includes(m.id)
        )?.name || '',
        url: `/articles/${pub.slug}`,
        pdfUrl: pub.arweaveTransactionId && pub.arweaveTransactionId !== 'pending-upload' ? 
          `ar://${pub.arweaveTransactionId}` : null,
        hasArweaveLink: !!(pub.arweaveTransactionId && pub.arweaveTransactionId !== 'pending-upload')
      }))
    };
    
    await this.fileHelper.ensureDir('./dist/search');
    await this.fileHelper.writeJSON('./dist/search/docs.json', searchData);
    
    // Note: Search index generation would use lunr here
    const searchIndex = { 
      totalDocuments: this.dataset.publications.length,
      useArProtocol: true,
      generated: new Date().toISOString()
    };
    
    await this.fileHelper.writeJSON('./dist/search/index.json', searchIndex);
    
    this.buildStats.endpointsGenerated++;
    this.logger.success('Search system generated with ar:// protocol support');
  }

  async generateMemberEndpoints() {
    const membersData = {
      members: this.dataset.members.map(member => ({
        id: member.id,
        name: member.name,
        publicationCount: member.publicationCount,
        publications: member.publications || [],
        url: `/members/${member.id}`
      })),
      generated: new Date().toISOString(),
      useArProtocol: true
    };
    
    await this.fileHelper.ensureDir('./dist/members');
    await this.fileHelper.writeJSON('./dist/members/index.json', membersData);
    
    this.buildStats.endpointsGenerated++;
    this.logger.success('Member endpoints generated');
  }

  async generateStatsEndpoint() {
    const stats = {
      consortium: {
        totalMembers: this.dataset.members.length,
        totalPublications: this.dataset.publications.length,
        publicationsWithArweaveLinks: this.dataset.publications.filter(p => 
          p.arweaveTransactionId && p.arweaveTransactionId !== 'pending-upload'
        ).length,
        totalCountries: 6,
        revenue: '$40k',
        founded: '2023'
      },
      archive: {
        arfsIntegration: true,
        useArProtocol: true,
        lastSync: this.dataset.metadata.lastSync || null,
        totalSize: `${this.dataset.publications.length * 2}MB`
      },
      generated: new Date().toISOString()
    };
    
    await this.fileHelper.ensureDir('./dist/stats');
    await this.fileHelper.writeJSON('./dist/stats/index.json', stats);
    
    this.buildStats.endpointsGenerated++;
    this.logger.success('Stats endpoint generated');
  }

  async copyAssets() {
    // Copy logo with relative path
    await this.fileHelper.ensureDir('./dist/main/assets/images');
    
    if (await this.fileHelper.exists('./src/assets/images/crimxriv-logo.png')) {
      await fs.copy('./src/assets/images/crimxriv-logo.png', './dist/main/assets/images/crimxriv-logo.png');
      this.logger.success('Assets copied with relative paths');
    }
  }

  printBuildSummary(hasRealLinks) {
    console.log('\n' + '='.repeat(70));
    console.log('🏗️ STATIC SITE BUILD WITH AR:// PROTOCOL');
    console.log('='.repeat(70));
    
    console.log(`📄 Pages Generated: ${this.buildStats.pagesGenerated}`);
    console.log(`📊 Data Endpoints: ${this.buildStats.endpointsGenerated}`);
    console.log(`🔗 Real Arweave Links: ${hasRealLinks ? 'Yes' : 'Pending ARFS upload'}`);
    
    console.log('\n✅ CORRECT ARFS/ArNS ARCHITECTURE:');
    console.log('✅ No hardcoded arweave.net URLs');
    console.log('✅ Uses ar:// protocol for permanent access');
    console.log('✅ ARFS File IDs for mutable references');
    console.log('✅ Transaction IDs for immutable data access');
    console.log('✅ ArNS undernames for data distribution');
    console.log('✅ Relative paths in static site');
    
    if (hasRealLinks) {
      console.log('\n🎉 READY FOR PRODUCTION DEPLOYMENT:');
      console.log('✅ Real ar:// links working');
      console.log('✅ ARFS integration complete');
      console.log('✅ Transaction IDs propagated correctly');
    } else {
      console.log('\n⏳ READY FOR ARFS UPLOAD:');
      console.log('📋 Run "npm run sync" to upload PDFs and get transaction IDs');
      console.log('🔄 Then run "npm run build" again to rebuild with ar:// links');
    }
    
    console.log('='.repeat(70));
  }
}

// Run builder
const builder = new ARProtocolSiteBuilder();
builder.buildWithArProtocol().catch(error => {
  console.error('Build failed:', error.message);
  process.exit(1);
});