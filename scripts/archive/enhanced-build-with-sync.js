#!/usr/bin/env node

/**
 * Enhanced Build System with Future Sync Capability
 * Builds pages dynamically and can detect new consortium members automatically
 */

import axios from 'axios';
import fs from 'fs-extra';
import { Logger, FileHelper, ProgressTracker, withRetry } from '../src/lib/utils.js';

class EnhancedBuilder {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    this.dataset = null;
    this.currentMembers = new Set();
    this.newMembersDetected = [];
    
    this.config = {
      crimrxivBase: 'https://www.crimrxiv.com',
      consortiumUrl: 'https://www.crimrxiv.com/consortium',
      requestDelay: 2000,
      maxRetries: 3
    };
  }

  async buildWithMemberSync() {
    this.logger.info('🔄 Building with member sync capability...');
    
    try {
      // Step 1: Load current dataset
      await this.loadCurrentDataset();
      
      // Step 2: Check for new consortium members (future capability)
      await this.checkForNewMembers();
      
      // Step 3: Generate all pages (existing + new members)
      await this.generateAllPages();
      
      // Step 4: Update member click functionality
      await this.generateInteractivePage();
      
      this.logger.success('Enhanced build with sync capability complete');
      
    } catch (error) {
      this.logger.error('Enhanced build failed', error.message);
      throw error;
    }
  }

  async checkForNewMembers() {
    this.logger.info('🔍 Checking for new consortium members...');
    
    try {
      // Get current consortium page
      const response = await axios.get(this.config.consortiumUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'CrimConsortium-Archive-Bot/1.0' }
      });
      
      // Extract member cards from HTML
      const html = response.data;
      const memberMatches = html.match(/href="\/[^"]+"/g) || [];
      
      const detectedSlugs = memberMatches
        .map(match => match.replace(/href="\/([^"]+)"/, '$1'))
        .filter(slug => 
          slug.endsWith('1c') || 
          slug.includes('university') || 
          slug.includes('college') ||
          slug.includes('institute')
        );
      
      // Compare with current dataset
      this.currentMembers = new Set(this.dataset.members.map(m => m.id));
      
      this.newMembersDetected = detectedSlugs.filter(slug => {
        // Convert slug to member ID format
        const memberId = this.slugToMemberId(slug);
        return !this.currentMembers.has(memberId);
      });
      
      if (this.newMembersDetected.length > 0) {
        this.logger.info(`🆕 Detected ${this.newMembersDetected.length} potential new members`);
        this.newMembersDetected.forEach(slug => {
          console.log(`   • ${slug} (new)`);
        });
      } else {
        this.logger.success('No new members detected - consortium stable');
      }
      
    } catch (error) {
      this.logger.warning('Could not check for new members', error.message);
      this.logger.info('Continuing with current member list...');
    }
  }

  slugToMemberId(slug) {
    // Convert CrimRXiv slug to our member ID format
    return slug
      .replace(/1c$/, '') // Remove consortium suffix
      .replace(/[-_]/g, '-')
      .toLowerCase();
  }

  async generateInteractivePage() {
    this.logger.info('🖱️ Generating interactive homepage...');
    
    const interactiveHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CrimConsortium - Permanent Criminology Research Hub</title>
  <meta name="description" content="Permanent archive of criminology research from ${this.dataset.members.length} leading consortium institutions">
  
  <!-- CrimRXiv styling with interaction fixes -->
  <style>
    :root {
      --primary-black: #000000;
      --primary-white: #ffffff;
      --text-gray: #666666;
      --light-gray: #f5f5f5;
      --border-gray: #ddd;
      --error-red: #d32f2f;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--primary-black);
      background: var(--primary-white);
      line-height: 1.6;
    }
    
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
    
    /* Header */
    .header {
      background: var(--primary-white);
      border-bottom: 1px solid var(--border-gray);
      padding: 1rem 0;
    }
    
    .site-title {
      font-size: 2rem;
      font-weight: bold;
      color: var(--primary-black);
      text-decoration: none;
    }
    
    .site-subtitle {
      color: var(--text-gray);
      margin-top: 0.5rem;
    }
    
    /* Navigation */
    .nav-bar {
      background: var(--light-gray);
      border-bottom: 1px solid var(--border-gray);
      padding: 0.75rem 0;
    }
    
    .nav-list {
      list-style: none;
      display: flex;
      gap: 2rem;
    }
    
    .nav-item a {
      color: var(--primary-black);
      text-decoration: none;
      font-weight: 500;
      padding: 0.5rem 0;
      border-bottom: 2px solid transparent;
    }
    
    .nav-item a:hover { border-bottom-color: var(--primary-black); }
    
    /* Member grid with proper click handling */
    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }
    
    .member-card {
      border: 1px solid var(--border-gray);
      border-radius: 4px;
      overflow: hidden;
      background: var(--primary-white);
      transition: box-shadow 0.2s;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
    }
    
    .member-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-decoration: none;
    }
    
    .member-image {
      height: 100px;
      background: var(--light-gray);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-gray);
      font-weight: bold;
      font-size: 1.2rem;
    }
    
    .member-content {
      padding: 1rem;
    }
    
    .member-name {
      font-weight: bold;
      font-size: 0.9rem;
      line-height: 1.3;
      margin-bottom: 0.5rem;
    }
    
    .member-stats {
      color: var(--text-gray);
      font-size: 0.8rem;
    }
    
    /* Search */
    .search-section {
      background: var(--light-gray);
      padding: 2rem 0;
      text-align: center;
    }
    
    .search-input {
      width: 100%;
      max-width: 500px;
      padding: 0.75rem;
      border: 1px solid var(--border-gray);
      border-radius: 4px;
      font-size: 1rem;
    }
    
    /* Articles */
    .article-card {
      border-bottom: 1px solid var(--border-gray);
      padding: 1.5rem 0;
    }
    
    .article-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--primary-black);
      text-decoration: none;
      display: block;
      margin-bottom: 0.5rem;
    }
    
    .article-title:hover { text-decoration: underline; }
    
    .article-meta {
      color: var(--text-gray);
      font-size: 0.85rem;
      margin-bottom: 0.75rem;
    }
    
    /* Error states */
    .error-message {
      background: #ffebee;
      color: var(--error-red);
      padding: 1rem;
      border-radius: 4px;
      margin: 1rem 0;
    }
    
    /* Mobile responsive */
    @media (max-width: 768px) {
      .members-grid { grid-template-columns: 1fr; }
      .nav-list { flex-direction: column; gap: 1rem; }
    }
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
        <li class="nav-item"><a href="/about">About</a></li>
      </ul>
    </div>
  </nav>
  
  <!-- Search -->
  <section class="search-section">
    <div class="container">
      <input type="search" id="search-input" class="search-input" 
             placeholder="Search ${this.dataset.publications.length} consortium publications...">
      <div id="search-results" hidden></div>
    </div>
  </section>
  
  <!-- Main content -->
  <main class="container" style="padding: 2rem 0;">
    
    <!-- Member showcase with proper links -->
    <section class="members-section">
      <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Consortium Members</h2>
      <div class="members-grid">
        ${this.dataset.members.map(member => `
          <a href="/members/${member.id}" class="member-card">
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
    
    <!-- Recent publications with proper links -->
    <section style="margin-top: 3rem;">
      <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Recent Publications</h2>
      <div>
        ${this.dataset.publications
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10)
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
                <div class="article-abstract">
                  ${(article.description || 'No abstract available.').substring(0, 200)}...
                </div>
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
    
    await fs.writeFile('./dist/main/index.html', interactiveHTML);
    this.logger.success('Interactive homepage with proper links generated');
  }
}

export default EnhancedBuilder;