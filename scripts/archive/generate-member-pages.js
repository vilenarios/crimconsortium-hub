#!/usr/bin/env node

/**
 * Generate Consortium Member Pages
 * Fetches member details from CrimRXiv.com and creates individual member pages
 * with descriptions and their articles
 */

import axios from 'axios';
import fs from 'fs-extra';
import { Logger, FileHelper, ProgressTracker, withRetry } from '../src/lib/utils.js';

class MemberPageGenerator {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    this.dataset = null;
    this.memberDetails = new Map();
    
    // Known member slugs mapping to CrimRXiv URLs
    this.memberUrlMapping = {
      'university-of-manchester': 'uomcriminology',
      'georgia-state-university': 'cybersecurity1c', 
      'ghent-university': 'ghent1c',
      'john-jay-college': 'johnjayrec1c',
      'simon-fraser-university': 'sfu1c',
      'temple-university': 'temple1c',
      'university-of-cambridge': 'prisonsresearch1c',
      'university-of-georgia': 'uga1c',
      'university-of-missouri': 'umsl1c',
      'university-of-texas-dallas': 'utd1c',
      'northeastern-university': 'northeasternccj',
      'max-planck-institute': 'mpicsl',
      'knowledge-futures': 'kf1c',
      'academy-criminal-justice': 'acjs1c',
      'universite-de-montreal': 'montreal1c',
      'ucl': 'benthamproject1c'
    };
    
    this.config = {
      baseUrl: 'https://www.crimrxiv.com',
      requestDelay: 2000,
      timeout: 30000,
      maxRetries: 3,
      userAgent: 'CrimConsortium-Archive-Bot/1.0'
    };
  }

  async generateAllMemberPages() {
    this.logger.info('👥 Generating comprehensive member pages...');
    
    try {
      // Load dataset
      await this.loadDataset();
      
      // Fetch member details from CrimRXiv
      await this.fetchMemberDetails();
      
      // Generate individual member pages
      await this.generateMemberPages();
      
      // Generate members listing page
      await this.generateMembersListingPage();
      
      this.logger.success('All member pages generated');
      
    } catch (error) {
      this.logger.error('Member page generation failed', error.message);
      throw error;
    }
  }

  async loadDataset() {
    this.dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
    if (!this.dataset) throw new Error('Dataset not found');
    this.logger.success(`Dataset loaded: ${this.dataset.members.length} members`);
  }

  async fetchMemberDetails() {
    this.logger.info('🌐 Fetching member details from CrimRXiv...');
    
    const tracker = new ProgressTracker(this.dataset.members.length, 'Fetching member details');
    
    for (const member of this.dataset.members) {
      try {
        await this.delay(this.config.requestDelay);
        
        const memberSlug = this.memberUrlMapping[member.id];
        if (!memberSlug) {
          tracker.increment(`⏭️ No URL mapping for ${member.id}`);
          continue;
        }
        
        const details = await this.fetchMemberFromCrimRXiv(memberSlug, member);
        
        if (details) {
          this.memberDetails.set(member.id, details);
          tracker.success(`✅ ${member.name.substring(0, 30)}...`);
        } else {
          tracker.increment(`❌ Failed to fetch ${member.name}`);
        }
        
      } catch (error) {
        tracker.fail(error, member.id);
      }
    }
    
    tracker.complete();
    this.logger.success(`Fetched details for ${this.memberDetails.size} members`);
  }

  async fetchMemberFromCrimRXiv(memberSlug, member) {
    try {
      return await withRetry(async () => {
        const url = `${this.config.baseUrl}/${memberSlug}`;
        
        const response = await axios.get(url, {
          timeout: this.config.timeout,
          headers: { 'User-Agent': this.config.userAgent }
        });
        
        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        // Extract description from HTML
        const html = response.data;
        const description = this.extractMemberDescription(html);
        
        return {
          name: member.name,
          slug: memberSlug,
          originalUrl: url,
          description: description || `${member.name} is a leading consortium member institution contributing to open criminology research.`,
          fetchedAt: new Date().toISOString(),
          htmlLength: html.length
        };
        
      }, this.config.maxRetries, 2000);
      
    } catch (error) {
      this.logger.warning(`Failed to fetch details for ${memberSlug}`, error.message);
      
      // Return fallback data
      return {
        name: member.name,
        slug: memberSlug,
        description: `${member.name} is a consortium member institution contributing ${member.publicationCount} publications to the criminology research archive.`,
        fetchedAt: new Date().toISOString(),
        fallback: true
      };
    }
  }

  extractMemberDescription(html) {
    try {
      // Look for meta description
      const metaDescMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
      if (metaDescMatch) {
        return metaDescMatch[1];
      }
      
      // Look for first paragraph in main content
      const paragraphMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i);
      if (paragraphMatch) {
        return paragraphMatch[1].substring(0, 300) + '...';
      }
      
      // Look for any substantial text content
      const textMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>[\s\S]*?<p[^>]*>([^<]+)<\/p>/i);
      if (textMatch) {
        return textMatch[1].substring(0, 300) + '...';
      }
      
      return null;
      
    } catch (error) {
      return null;
    }
  }

  async generateMemberPages() {
    this.logger.info('📄 Generating individual member pages...');
    
    const tracker = new ProgressTracker(this.dataset.members.length, 'Generating member pages');
    
    for (const member of this.dataset.members) {
      try {
        await this.generateMemberPage(member);
        tracker.success(`📄 ${member.name.substring(0, 30)}...`);
      } catch (error) {
        tracker.fail(error, member.id);
      }
    }
    
    tracker.complete();
  }

  async generateMemberPage(member) {
    const memberDetails = this.memberDetails.get(member.id);
    const memberPublications = this.dataset.publications.filter(pub =>
      pub.memberAssociations.includes(member.id)
    );
    
    const memberHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${member.name} - CrimConsortium</title>
  <meta name="description" content="${memberDetails?.description || member.name + ' consortium member'}">
  
  <style>
    :root {
      --primary-black: #000000;
      --primary-white: #ffffff;
      --text-gray: #666666;
      --light-gray: #f5f5f5;
      --border-gray: #ddd;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--primary-black);
      background: var(--primary-white);
      line-height: 1.6;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 0 1rem;
    }
    
    .breadcrumb {
      padding: 1rem 0;
      border-bottom: 1px solid var(--border-gray);
    }
    
    .breadcrumb a {
      color: var(--text-gray);
      text-decoration: none;
      margin-right: 0.5rem;
    }
    
    .breadcrumb a:hover {
      text-decoration: underline;
    }
    
    .member-header {
      padding: 2rem 0;
      border-bottom: 1px solid var(--border-gray);
    }
    
    .member-title {
      font-size: 2rem;
      font-weight: bold;
      line-height: 1.3;
      margin-bottom: 1rem;
    }
    
    .member-stats {
      color: var(--text-gray);
      margin-bottom: 1.5rem;
    }
    
    .member-description {
      background: var(--light-gray);
      padding: 1.5rem;
      border-radius: 4px;
      line-height: 1.6;
    }
    
    .publications-section {
      padding: 2rem 0;
    }
    
    .article-card {
      border: 1px solid var(--border-gray);
      border-radius: 4px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      background: var(--primary-white);
    }
    
    .article-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--primary-black);
      text-decoration: none;
      display: block;
      margin-bottom: 0.5rem;
    }
    
    .article-title:hover {
      text-decoration: underline;
    }
    
    .article-meta {
      color: var(--text-gray);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    
    .article-abstract {
      line-height: 1.5;
      margin-bottom: 1rem;
    }
    
    .article-actions {
      display: flex;
      gap: 1rem;
    }
    
    .btn {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-gray);
      background: var(--primary-white);
      color: var(--primary-black);
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    
    .btn:hover {
      background: var(--light-gray);
    }
  </style>
</head>
<body>
  <!-- Breadcrumb -->
  <div class="breadcrumb">
    <div class="container">
      <a href="/">← CrimConsortium</a>
      <span style="color: var(--text-gray);">></span>
      <a href="/members">Members</a>
      <span style="color: var(--text-gray);">></span>
      <span>${member.name}</span>
    </div>
  </div>
  
  <!-- Member header -->
  <header class="member-header">
    <div class="container">
      <h1 class="member-title">${member.name}</h1>
      <div class="member-stats">
        <p><strong>${member.publicationCount} publications</strong> in CrimConsortium archive</p>
        ${memberDetails?.originalUrl ? `<p><a href="${memberDetails.originalUrl}" target="_blank" style="color: var(--text-gray);">View on CrimRXiv →</a></p>` : ''}
      </div>
      
      ${memberDetails?.description ? `
        <div class="member-description">
          <h2 style="margin-bottom: 1rem;">About</h2>
          <p>${memberDetails.description}</p>
        </div>
      ` : ''}
    </div>
  </header>
  
  <!-- Publications section -->
  <main class="publications-section">
    <div class="container">
      <h2 style="font-size: 1.5rem; margin-bottom: 1.5rem;">Publications from ${member.name}</h2>
      
      ${memberPublications.length > 0 ? 
        memberPublications.map(article => `
          <article class="article-card">
            <a href="/articles/${article.slug}" class="article-title">
              ${article.title}
            </a>
            <div class="article-meta">
              <span><strong>Authors:</strong> ${article.authors.map(a => a.name).join(', ')}</span> • 
              <span><strong>Published:</strong> ${new Date(article.createdAt).getFullYear()}</span>
              ${article.doi ? ` • <strong>DOI:</strong> ${article.doi}` : ''}
            </div>
            ${article.description ? `
              <div class="article-abstract">
                ${article.description.length > 300 ? 
                  article.description.substring(0, 300) + '...' : 
                  article.description
                }
              </div>
            ` : ''}
            <div class="article-actions">
              <a href="/articles/${article.slug}" class="btn">📖 Read More</a>
              ${article.arweaveId && article.arweaveId !== 'pending-upload' ? 
                `<a href="https://arweave.net/${article.arweaveId}" class="btn" target="_blank">📄 Download PDF</a>` :
                '<span class="btn" style="opacity: 0.5;">📄 PDF pending</span>'
              }
              ${article.originalUrl ? `<a href="${article.originalUrl}" class="btn" target="_blank">🔗 View Original</a>` : ''}
            </div>
          </article>
        `).join('') :
        '<p style="color: var(--text-gray); font-style: italic;">No publications found for this member.</p>'
      }
    </div>
  </main>
  
  <!-- Footer -->
  <footer style="border-top: 1px solid var(--border-gray); padding: 2rem 0; text-align: center; color: var(--text-gray);">
    <div class="container">
      <p>Part of <a href="/" style="color: var(--text-gray);">CrimConsortium</a> - Permanent criminology research archive</p>
    </div>
  </footer>
</body>
</html>`;
    
    // Create member directory and save page
    const memberDir = `./dist/main/members/${member.id}`;
    await this.fileHelper.ensureDir(memberDir);
    await fs.writeFile(`${memberDir}/index.html`, memberHTML);
  }

  async generateMembersListingPage() {
    this.logger.info('📋 Generating members listing page...');
    
    const membersListHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consortium Members - CrimConsortium</title>
  <meta name="description" content="15 leading criminology institutions in the CrimConsortium">
  
  <style>
    :root { --primary-black: #000000; --primary-white: #ffffff; --text-gray: #666666; --light-gray: #f5f5f5; --border-gray: #ddd; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--primary-black); background: var(--primary-white); line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }
    .breadcrumb { padding: 1rem 0; border-bottom: 1px solid var(--border-gray); }
    .breadcrumb a { color: var(--text-gray); text-decoration: none; }
    .page-header { padding: 2rem 0; }
    .members-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin: 2rem 0; }
    .member-card { border: 1px solid var(--border-gray); border-radius: 4px; padding: 1.5rem; background: var(--primary-white); transition: box-shadow 0.2s; }
    .member-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .member-name { font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem; }
    .member-stats { color: var(--text-gray); font-size: 0.9rem; margin-bottom: 1rem; }
    .member-description { line-height: 1.5; margin-bottom: 1rem; }
    .member-actions { display: flex; gap: 0.5rem; }
    .btn { padding: 0.4rem 0.8rem; border: 1px solid var(--border-gray); background: var(--primary-white); color: var(--primary-black); text-decoration: none; border-radius: 4px; font-size: 0.8rem; }
  </style>
</head>
<body>
  <div class="breadcrumb">
    <div class="container">
      <a href="/">← CrimConsortium</a> > Members
    </div>
  </div>
  
  <header class="page-header">
    <div class="container">
      <h1>Consortium Members</h1>
      <p style="color: var(--text-gray); margin-top: 0.5rem;">
        ${this.dataset.members.length} leading institutions contributing to open criminology research
      </p>
    </div>
  </header>
  
  <main class="container">
    <div class="members-grid">
      ${this.dataset.members.map(member => {
        const details = this.memberDetails.get(member.id);
        return `
          <div class="member-card">
            <h2 class="member-name">${member.name}</h2>
            <div class="member-stats">
              ${member.publicationCount} publications in archive
            </div>
            ${details?.description ? `
              <div class="member-description">
                ${details.description.length > 200 ? 
                  details.description.substring(0, 200) + '...' : 
                  details.description
                }
              </div>
            ` : ''}
            <div class="member-actions">
              <a href="/members/${member.id}" class="btn">📖 View Details</a>
              ${details?.originalUrl ? `<a href="${details.originalUrl}" class="btn" target="_blank">🔗 CrimRXiv</a>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  </main>
</body>
</html>`;
    
    await this.fileHelper.ensureDir('./dist/main/members');
    await fs.writeFile('./dist/main/members/index.html', membersListHTML);
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Update main build script to include member pages
export default MemberPageGenerator;