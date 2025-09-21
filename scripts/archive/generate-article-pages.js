#!/usr/bin/env node

/**
 * Generate Individual Article Pages
 * Creates static pages for each of the 37 consortium publications
 */

import fs from 'fs-extra';
import handlebars from 'handlebars';
import { Logger, FileHelper } from '../src/lib/utils.js';

class ArticlePageGenerator {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.dataset = null;
  }

  async generateAllArticlePages() {
    this.logger.info('📄 Generating individual article pages...');
    
    try {
      // Load dataset
      this.dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
      if (!this.dataset) throw new Error('Dataset not found');
      
      // Setup template
      await this.setupArticleTemplate();
      
      // Generate page for each article
      let generated = 0;
      for (const article of this.dataset.publications) {
        try {
          await this.generateArticlePage(article);
          generated++;
        } catch (error) {
          this.logger.error(`Failed to generate page for ${article.id}`, error.message);
        }
      }
      
      this.logger.success(`Generated ${generated} article pages`);
      
    } catch (error) {
      this.logger.error('Article page generation failed', error.message);
      throw error;
    }
  }

  async setupArticleTemplate() {
    // Register helpers
    handlebars.registerHelper('formatDate', (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    });
    
    handlebars.registerHelper('authorList', (authors) => {
      return authors.map(a => a.name).join(', ');
    });
  }

  async generateArticlePage(article) {
    const member = this.dataset.members.find(m => 
      article.memberAssociations.includes(m.id)
    );
    
    const articleHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} - CrimConsortium</title>
  <meta name="description" content="${(article.description || '').substring(0, 160)}">
  
  <!-- Academic metadata -->
  <meta name="citation_title" content="${article.title}">
  <meta name="citation_author" content="${article.authors.map(a => a.name).join('; ')}">
  <meta name="citation_publication_date" content="${article.createdAt}">
  <meta name="citation_doi" content="${article.doi}">
  
  <style>
    /* Same CSS as main site */
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
      max-width: 800px;
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
    }
    
    .breadcrumb a:hover {
      text-decoration: underline;
    }
    
    .article-header {
      padding: 2rem 0;
      border-bottom: 1px solid var(--border-gray);
    }
    
    .article-title {
      font-size: 1.8rem;
      font-weight: bold;
      line-height: 1.3;
      margin-bottom: 1rem;
    }
    
    .article-meta {
      color: var(--text-gray);
      margin-bottom: 1rem;
    }
    
    .article-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    
    .btn {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-gray);
      background: var(--primary-white);
      color: var(--primary-black);
      text-decoration: none;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    
    .btn:hover {
      background: var(--light-gray);
    }
    
    .article-content {
      padding: 2rem 0;
    }
    
    .abstract {
      background: var(--light-gray);
      padding: 1.5rem;
      border-radius: 4px;
      margin: 1.5rem 0;
    }
  </style>
</head>
<body>
  <!-- Breadcrumb -->
  <div class="breadcrumb">
    <div class="container">
      <a href="/">← Back to CrimConsortium</a>
    </div>
  </div>
  
  <!-- Article header -->
  <header class="article-header">
    <div class="container">
      <h1 class="article-title">${article.title}</h1>
      <div class="article-meta">
        <p><strong>Authors:</strong> ${article.authors.map(a => a.name).join(', ')}</p>
        <p><strong>Institution:</strong> ${member?.name || 'Unknown'}</p>
        <p><strong>Published:</strong> ${new Date(article.createdAt).toLocaleDateString()}</p>
        ${article.doi ? `<p><strong>DOI:</strong> <a href="https://doi.org/${article.doi}" target="_blank">${article.doi}</a></p>` : ''}
      </div>
      
      <div class="article-actions">
        ${article.arweaveId && article.arweaveId !== 'pending-upload' ? 
          `<a href="https://arweave.net/${article.arweaveId}" class="btn" target="_blank">📄 Download PDF</a>` :
          '<span class="btn" style="opacity: 0.5;">📄 PDF pending upload</span>'
        }
        <button class="btn" onclick="copycitation()">📋 Copy Citation</button>
        <button class="btn" onclick="shareArticle()">🔗 Share</button>
      </div>
    </div>
  </header>
  
  <!-- Article content -->
  <main class="article-content">
    <div class="container">
      ${article.description ? `
        <section class="abstract">
          <h2>Abstract</h2>
          <p>${article.description}</p>
        </section>
      ` : '<p><em>Abstract not available for this publication.</em></p>'}
      
      <section>
        <h2>Publication Details</h2>
        <ul>
          <li><strong>Publication ID:</strong> ${article.id}</li>
          <li><strong>Original URL:</strong> <a href="${article.originalUrl || '#'}" target="_blank">View on CrimRXiv</a></li>
          <li><strong>Member Institution:</strong> ${member?.name || 'Unknown'}</li>
          <li><strong>Publication Year:</strong> ${new Date(article.createdAt).getFullYear()}</li>
        </ul>
      </section>
    </div>
  </main>
  
  <script>
    function copyCitation() {
      const citation = \`${article.authors.map(a => a.name).join(', ')} (${new Date(article.createdAt).getFullYear()}). ${article.title}. CrimConsortium Archive.\`;
      navigator.clipboard.writeText(citation).then(() => {
        alert('Citation copied to clipboard!');
      });
    }
    
    function shareArticle() {
      if (navigator.share) {
        navigator.share({
          title: '${article.title}',
          text: 'Consortium publication from ${member?.name || 'CrimConsortium'}',
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        alert('Article URL copied to clipboard!');
      }
    }
  </script>
</body>
</html>`;
    
    // Create directory for article
    const articleDir = `./dist/main/articles/${article.slug}`;
    await this.fileHelper.ensureDir(articleDir);
    
    // Save article page
    await fs.writeFile(`${articleDir}/index.html`, articleHTML);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new ArticlePageGenerator();
  generator.generateAllArticlePages().catch(error => {
    console.error('Generation failed:', error);
    process.exit(1);
  });
}

export default ArticlePageGenerator;