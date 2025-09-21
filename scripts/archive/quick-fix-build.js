#!/usr/bin/env node

/**
 * Quick Fix Build - Generate Working Pages
 * Simple fix to create working member and article pages
 */

import fs from 'fs-extra';
import { Logger, FileHelper } from '../src/lib/utils.js';

class QuickFixBuilder {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.dataset = null;
  }

  async quickBuild() {
    this.logger.info('🔧 Quick fix: generating working pages...');
    
    try {
      // Load dataset
      this.dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
      
      // Generate article pages
      await this.generateArticlePages();
      
      // Generate member pages
      await this.generateMemberPages();
      
      // Fix homepage with proper links
      await this.generateWorkingHomepage();
      
      this.logger.success('Quick fix complete - all links should work now');
      
    } catch (error) {
      this.logger.error('Quick fix failed', error.message);
      throw error;
    }
  }

  async generateArticlePages() {
    this.logger.info('📄 Generating article pages...');
    
    for (const article of this.dataset.publications) {
      const member = this.dataset.members.find(m => 
        article.memberAssociations.includes(m.id)
      );
      
      const articleHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${article.title} - CrimConsortium</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 1rem; line-height: 1.6; }
    .breadcrumb { margin-bottom: 2rem; }
    .breadcrumb a { color: #666; text-decoration: none; }
    h1 { margin-bottom: 1rem; }
    .meta { color: #666; margin-bottom: 1.5rem; }
    .abstract { background: #f5f5f5; padding: 1.5rem; border-radius: 4px; margin: 1.5rem 0; }
    .btn { display: inline-block; padding: 0.5rem 1rem; border: 1px solid #ddd; color: #000; text-decoration: none; border-radius: 4px; margin-right: 0.5rem; }
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
  </div>
  
  <div style="margin-bottom: 2rem;">
    ${article.arweaveId && article.arweaveId !== 'pending-upload' ? 
      `<a href="https://arweave.net/${article.arweaveId}" class="btn" target="_blank">📄 Download PDF</a>` :
      '<span class="btn" style="opacity: 0.5;">📄 PDF pending upload</span>'
    }
    ${article.originalUrl ? `<a href="${article.originalUrl}" class="btn" target="_blank">🔗 View on CrimRXiv</a>` : ''}
  </div>
  
  ${article.description ? `
    <div class="abstract">
      <h2>Abstract</h2>
      <p>${article.description}</p>
    </div>
  ` : '<p><em>Abstract not available for this publication.</em></p>'}
  
</body>
</html>`;
      
      const articleDir = `./dist/main/articles/${article.slug}`;
      await this.fileHelper.ensureDir(articleDir);
      await fs.writeFile(`${articleDir}/index.html`, articleHTML);
    }
    
    this.logger.success(`Generated ${this.dataset.publications.length} article pages`);
  }

  async generateMemberPages() {
    this.logger.info('👥 Generating member pages...');
    
    // Members listing page
    const membersListHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Consortium Members - CrimConsortium</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 1rem; line-height: 1.6; }
    .breadcrumb { margin-bottom: 2rem; }
    .breadcrumb a { color: #666; text-decoration: none; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .card { border: 1px solid #ddd; border-radius: 4px; padding: 1.5rem; }
    .btn { display: inline-block; padding: 0.5rem 1rem; border: 1px solid #ddd; color: #000; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="breadcrumb">
    <a href="/">← CrimConsortium</a> > Members
  </div>
  
  <h1>Consortium Members</h1>
  <p style="color: #666; margin-bottom: 2rem;">${this.dataset.members.length} leading institutions</p>
  
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
    
    // Individual member pages
    for (const member of this.dataset.members) {
      const memberPublications = this.dataset.publications.filter(pub =>
        pub.memberAssociations.includes(member.id)
      );
      
      const memberHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${member.name} - CrimConsortium</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1000px; margin: 0 auto; padding: 1rem; line-height: 1.6; }
    .breadcrumb { margin-bottom: 2rem; }
    .breadcrumb a { color: #666; text-decoration: none; }
    .article { border: 1px solid #ddd; border-radius: 4px; padding: 1.5rem; margin-bottom: 1rem; }
    .article-title { font-size: 1.1rem; font-weight: 600; color: #000; text-decoration: none; display: block; margin-bottom: 0.5rem; }
    .article-title:hover { text-decoration: underline; }
    .btn { display: inline-block; padding: 0.4rem 0.8rem; border: 1px solid #ddd; color: #000; text-decoration: none; border-radius: 4px; font-size: 0.85rem; margin-right: 0.5rem; }
  </style>
</head>
<body>
  <div class="breadcrumb">
    <a href="/">← CrimConsortium</a> > <a href="/members">Members</a> > ${member.name}
  </div>
  
  <h1>${member.name}</h1>
  <p style="color: #666; margin-bottom: 2rem;"><strong>${member.publicationCount} publications</strong> in consortium archive</p>
  
  <h2>Publications</h2>
  <div style="margin-top: 1.5rem;">
    ${memberPublications.map(article => `
      <article class="article">
        <a href="/articles/${article.slug}" class="article-title">${article.title}</a>
        <div style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
          <strong>Authors:</strong> ${article.authors.map(a => a.name).join(', ')} • 
          <strong>Year:</strong> ${new Date(article.createdAt).getFullYear()}
        </div>
        ${article.description ? `<div style="margin-bottom: 1rem;">${article.description.substring(0, 300)}${article.description.length > 300 ? '...' : ''}</div>` : ''}
        <div>
          <a href="/articles/${article.slug}" class="btn">📖 Read More</a>
          ${article.arweaveId && article.arweaveId !== 'pending-upload' ? 
            `<a href="https://arweave.net/${article.arweaveId}" class="btn" target="_blank">📄 PDF</a>` : 
            '<span class="btn" style="opacity: 0.5;">📄 PDF pending</span>'
          }
        </div>
      </article>
    `).join('')}
  </div>
</body>
</html>`;
      
      const memberDir = `./dist/main/members/${member.id}`;
      await this.fileHelper.ensureDir(memberDir);
      await fs.writeFile(`${memberDir}/index.html`, memberHTML);
    }
    
    this.logger.success(`Generated ${this.dataset.members.length} member pages`);
  }

  async generateWorkingHomepage() {
    this.logger.info('🏠 Generating working homepage...');
    
    const homepage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CrimConsortium - Permanent Criminology Research Hub</title>
  
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
      <p style="margin-top: 0.5rem; color: var(--text-gray); font-size: 0.9rem;">Search functionality coming soon</p>
    </div>
  </section>
  
  <!-- Main content -->
  <main class="container" style="padding: 2rem 0;">
    
    <!-- Member showcase with working links -->
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
    
    <!-- Recent publications with working links -->
    <section style="margin-top: 3rem;">
      <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Recent Publications</h2>
      <div>
        ${this.dataset.publications
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 8)
          .map(article => {
            const member = this.dataset.members.find(m => 
              article.memberAssociations.includes(m.id)
            );
            return `
              <article class="article-card">
                <a href="/articles/${article.slug}" class="article-title">${article.title}</a>
                <div class="article-meta">
                  ${article.authors.map(a => a.name).join(', ')} • 
                  ${member?.name || 'Unknown'} • 
                  ${new Date(article.createdAt).getFullYear()}
                </div>
                <div>
                  ${(article.description || 'No abstract available.').substring(0, 200)}...
                </div>
              </article>
            `;
          }).join('')}
      </div>
      <div style="text-align: center; margin-top: 2rem;">
        <a href="/members" style="color: var(--primary-black); text-decoration: none; font-weight: 500; border-bottom: 1px solid var(--primary-black);">
          View All Members →
        </a>
      </div>
    </section>
    
  </main>
  
  <!-- Footer with logo -->
  <footer style="border-top: 1px solid var(--border-gray); padding: 2rem 0; color: var(--text-gray);">
    <div class="container" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <a href="https://www.crimrxiv.com">
          <img src="/assets/images/crimxriv-logo.png" alt="CrimRXiv logo" style="height: 40px;">
        </a>
        <div>
          <p style="margin: 0;">CrimConsortium - Permanent archive</p>
          <p style="margin: 0; font-size: 0.75rem;">ISSN 2766-7170</p>
        </div>
      </div>
      <div>
        <p style="margin: 0; font-size: 0.8rem;">Powered by Arweave</p>
      </div>
    </div>
  </footer>
</body>
</html>`;
    
    await fs.writeFile('./dist/main/index.html', homepage);
    this.logger.success('Working homepage with proper links generated');
  }
}

// Run quick fix
const builder = new QuickFixBuilder();
builder.quickBuild().catch(error => {
  console.error('Quick fix failed:', error);
  process.exit(1);
});