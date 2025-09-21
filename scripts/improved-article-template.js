/**
 * Improved Article Page Template
 * Clean academic format with proper references and no redundant content
 */

function generateImprovedArticlePage(article, member) {
  // Process references into individual entries with links
  const processedReferences = processReferences(article.references || []);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} - CrimConsortium</title>
  <meta name="description" content="${(article.description || '').substring(0, 160)}">
  
  <!-- CrimRXiv favicon -->
  <link rel="icon" type="image/x-icon" href="../../favicon.ico">
  
  <!-- Academic metadata -->
  <meta name="citation_title" content="${article.title}">
  <meta name="citation_author" content="${article.authors.map(a => a.name).join('; ')}">
  <meta name="citation_publication_date" content="${article.createdAt}">
  ${article.doi ? `<meta name="citation_doi" content="${article.doi}">` : ''}
  
  <style>
    :root {
      --primary-black: #000000;
      --primary-white: #ffffff;
      --text-gray: #666666;
      --light-gray: #f5f5f5;
      --border-gray: #ddd;
      --accent-blue: #007cba;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--primary-black);
      background: var(--primary-white);
      line-height: 1.7;
      font-size: 16px;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    
    /* Header Styles */
    .header {
      background: var(--primary-white);
      border-bottom: 2px solid var(--primary-black);
      padding: 0.75rem 0;
    }
    .site-brand {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .site-title {
      font-size: 1.75rem;
      font-weight: 900;
      color: var(--primary-black);
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .tagline {
      color: var(--text-gray);
      font-size: 0.85rem;
      margin-top: 0.25rem;
      font-weight: 400;
    }

    /* Navigation */
    .nav-bar {
      background: var(--primary-black);
      padding: 0;
    }
    .nav-list {
      list-style: none;
      display: flex;
      gap: 0;
      margin: 0;
    }
    .nav-item a {
      color: var(--primary-white);
      text-decoration: none;
      font-weight: 500;
      padding: 1rem 1.5rem;
      display: block;
      transition: background 0.2s;
      font-size: 0.95rem;
    }
    .nav-item a:hover {
      background: rgba(255,255,255,0.1);
    }
    
    /* Dark Hero Section like CrimRXiv */
    .article-header {
      background: linear-gradient(135deg, #2b2b2b 0%, #3a3a3a 50%, #2b2b2b 100%);
      position: relative;
      padding: 4rem 0;
      margin: 0;
      overflow: hidden;
    }
    
    .article-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 70% 30%, rgba(255,255,255,0.1) 0%, transparent 50%);
      pointer-events: none;
    }
    
    .article-title {
      font-size: 3rem;
      font-weight: 700;
      line-height: 1.1;
      margin-bottom: 2rem;
      color: #ffffff;
      position: relative;
      z-index: 2;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .hero-description {
      font-size: 1.2rem;
      line-height: 1.5;
      color: rgba(255,255,255,0.9);
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 2;
    }
    
    .hero-authors {
      font-size: 1.1rem;
      font-style: italic;
      color: rgba(255,255,255,0.8);
      margin-bottom: 2rem;
      position: relative;
      z-index: 2;
    }
    
    .article-meta {
      color: rgba(255,255,255,0.7);
      margin-bottom: 2rem;
      line-height: 1.6;
      position: relative;
      z-index: 2;
    }
    
    .article-meta p {
      margin-bottom: 0.5rem;
    }
    
    .article-meta strong {
      color: rgba(255,255,255,0.9);
      font-weight: 600;
    }
    
    .article-meta a {
      color: #64b5f6 !important;
    }
    
    /* Floating Action Buttons (CrimRXiv Style) */
    .floating-actions {
      position: absolute;
      top: 2rem;
      right: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      z-index: 3;
    }
    
    .floating-btn {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      text-align: center;
      transition: all 0.3s ease;
      min-width: 120px;
      cursor: pointer;
    }
    
    .floating-btn:hover {
      background: rgba(255,255,255,0.25);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    /* Publication Status Badge */
    .publication-status {
      position: absolute;
      bottom: 2rem;
      left: 2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(10px);
      padding: 0.75rem 1rem;
      border-radius: 25px;
      color: rgba(255,255,255,0.9);
      font-size: 0.9rem;
      z-index: 3;
    }
    
    .status-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
    }
    
    .article-actions {
      display: none; /* Hide old actions, replaced by floating buttons */
    }
    
    .btn {
      padding: 0.75rem 1.5rem;
      border: 1px solid var(--border-gray);
      background: var(--primary-white);
      color: var(--primary-black);
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s;
      cursor: pointer;
    }
    
    .btn:hover {
      background: var(--light-gray);
      border-color: var(--accent-blue);
    }
    
    .btn-primary {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
    }
    
    .btn-primary:hover {
      background: #005a8a;
    }
    
    /* Downloads Section */
    .downloads-section {
      background: var(--light-gray);
      padding: 2rem;
      border-radius: 8px;
      margin: 2rem 0;
    }
    
    .downloads-section h3 {
      margin-bottom: 1rem;
      color: var(--primary-black);
    }
    
    .downloads-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }
    
    .download-btn {
      padding: 0.75rem 1rem;
      background: white;
      border: 1px solid var(--border-gray);
      border-radius: 6px;
      text-decoration: none;
      color: var(--primary-black);
      text-align: center;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .download-btn:hover {
      background: #e9ecef;
      border-color: var(--accent-blue);
    }
    
    .download-btn.primary {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
    }
    
    /* Content Sections */
    .content-section {
      margin: 3rem 0;
    }
    
    .content-section h2 {
      font-size: 1.6rem;
      margin-bottom: 1.5rem;
      color: var(--primary-black);
      border-bottom: 2px solid var(--accent-blue);
      padding-bottom: 0.5rem;
      font-weight: 600;
    }
    
    /* Abstract Special Styling */
    .abstract {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      padding: 2rem;
      border-radius: 8px;
      border-left: 4px solid var(--accent-blue);
      margin: 2rem 0;
    }
    
    .abstract h2 {
      border: none;
      margin-bottom: 1rem;
    }
    
    /* Main Content Sections */
    .main-content {
      margin: 2rem 0;
    }
    
    .section {
      margin: 2.5rem 0;
      padding: 0 0 2rem 0;
      border-bottom: 1px solid #eee;
    }
    
    .section:last-child {
      border-bottom: none;
    }
    
    .section h3 {
      font-size: 1.3rem;
      color: var(--primary-black);
      margin-bottom: 1rem;
      font-weight: 600;
    }
    
    .section-content {
      color: var(--primary-black);
      line-height: 1.8;
      text-align: justify;
      font-size: 1rem;
    }
    
    .section-content p {
      margin-bottom: 1rem;
    }
    
    /* References Section */
    .references {
      background: #f9f9f9;
      padding: 2rem;
      border-radius: 8px;
      margin: 3rem 0;
    }
    
    .references h2 {
      border-bottom: 2px solid var(--accent-blue);
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
    }
    
    .references-list {
      list-style: none;
      padding: 0;
    }
    
    .reference-item {
      margin-bottom: 1.5rem;
      padding-left: 1.5rem;
      border-left: 3px solid var(--border-gray);
      font-size: 0.95rem;
      line-height: 1.6;
      position: relative;
    }
    
    .reference-item::before {
      content: counter(reference-counter);
      counter-increment: reference-counter;
      position: absolute;
      left: -1.5rem;
      top: 0;
      background: var(--accent-blue);
      color: white;
      width: 1.2rem;
      height: 1.2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: bold;
    }
    
    .references-list {
      counter-reset: reference-counter;
    }
    
    .reference-item a {
      color: var(--accent-blue);
      text-decoration: none;
      font-weight: 500;
    }
    
    .reference-item a:hover {
      text-decoration: underline;
    }
    
    /* Citation Tools */
    .citation-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.6);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .citation-content {
      background: white;
      padding: 2rem;
      border-radius: 12px;
      max-width: 600px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .citation-box {
      background: #f8f9fa;
      border: 1px solid var(--border-gray);
      border-radius: 6px;
      padding: 1rem;
      margin: 1rem 0;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.85rem;
      line-height: 1.5;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .citation-box:hover {
      background: #e9ecef;
    }
    
    /* Publication Details */
    .publication-details {
      background: var(--light-gray);
      padding: 2rem;
      border-radius: 8px;
      margin: 3rem 0;
    }
    
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }
    
    .detail-item {
      padding: 1rem;
      background: white;
      border-radius: 6px;
    }
    
    .detail-label {
      font-weight: 600;
      color: var(--text-gray);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }
    
    .detail-value {
      color: var(--primary-black);
      font-weight: 500;
    }
    
    /* Mobile Responsive */
    @media (max-width: 768px) {
      .container {
        padding: 0 1rem;
      }
      
      .article-title {
        font-size: 2rem;
      }
      
      .hero-description {
        font-size: 1rem;
      }
      
      .hero-authors {
        font-size: 1rem;
      }
      
      .floating-actions {
        position: static;
        flex-direction: row;
        justify-content: center;
        margin-top: 2rem;
        gap: 0.5rem;
      }
      
      .floating-btn {
        min-width: auto;
        font-size: 0.75rem;
        padding: 0.5rem 0.75rem;
      }
      
      .publication-status {
        position: static;
        margin-top: 1rem;
        justify-content: center;
      }
      
      .article-header {
        padding: 2rem 0;
      }
      
      .details-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="container">
      <div class="site-brand">
        <a href="https://www.crimrxiv.com" style="display: flex; align-items: center;">
          <img src="../../assets/images/crimxriv-logo.png" alt="CrimRXiv" style="height: 35px;" onerror="this.style.display='none'">
        </a>
        <div>
          <a href="/" class="site-title">CrimConsortium</a>
          <p class="tagline">Leaders, providers, and supporters of open criminology</p>
        </div>
      </div>
    </div>
  </header>

  <nav class="nav-bar">
    <div class="container">
      <ul class="nav-list">
        <li class="nav-item"><a href="/">Home</a></li>
        <li class="nav-item"><a href="/articles">Publications</a></li>
        <li class="nav-item"><a href="/members">All Members</a></li>
      </ul>
    </div>
  </nav>
  
  <!-- Dark Hero Section (CrimRXiv Style) -->
  <header class="article-header">
    <div class="container">
      <h1 class="article-title">${article.title}</h1>
      
      <!-- Hero Description (Truncated like CrimRXiv) -->
      ${article.description ? `
      <div class="hero-description">
        ${(article.description || '').substring(0, 300)}${(article.description || '').length > 300 ? '...' : ''}
      </div>
      ` : ''}
      
      <div class="hero-authors">
        by ${article.authors.map(a => a.name).join(' and ')}
      </div>
      
      <div class="article-meta">
        ${member ? `<p><strong>Institution:</strong> ${member.name}</p>` : ''}
        <p><strong>Published:</strong> ${new Date(article.createdAt).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
        ${article.doi ? `<p><strong>DOI:</strong> <a href="https://doi.org/${article.doi}" target="_blank">${article.doi}</a></p>` : ''}
      </div>
    </div>
    
    <!-- Floating Action Buttons -->
    <div class="floating-actions">
      <button onclick="showCitation()" class="floating-btn">
        📑 CITE
      </button>
      <button onclick="shareArticle()" class="floating-btn">
        🔗 SOCIAL
      </button>
      <a href="${article.originalUrl}" class="floating-btn" target="_blank">
        📥 DOWNLOAD
      </a>
      <a href="#content" class="floating-btn">
        📋 CONTENTS
      </a>
    </div>
    
    <!-- Publication Status Badge -->
    <div class="publication-status">
      <div class="status-icon">🕒</div>
      <span>last released ${(() => {
        const publishDate = new Date(article.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - publishDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return '1 day ago';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 14) return '1 week ago';
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
      })()}</span>
    </div>
    
    <!-- Hidden original actions for accessibility -->
    <div class="article-actions">
      <button onclick="showCitation()" class="btn btn-primary">📋 Cite Article</button>
      <button onclick="shareArticle()" class="btn">🔗 Share</button>
      <a href="${article.originalUrl}" class="btn" target="_blank">🌐 View on CrimRXiv</a>
    </div>
  </header>
  
  
  <!-- Article Content -->
  <main class="container" id="content">
    
    
    <!-- Abstract (Special Treatment) -->
    ${(() => {
      const fullContent = article.fullContent || '';
      
      // Safe text-based abstract extraction
      const abstractMatch = fullContent.match(/Abstract([^]*?)(?:Part \d+|Keywords:|License|Comments)/);
      let abstractContent = abstractMatch ? abstractMatch[1].trim() : article.description;
      
      // Fallback to sections
      if (!abstractContent || abstractContent.length < 50) {
        const abstractSection = article.sections ? article.sections.find(section => 
          section.heading.toLowerCase().includes('abstract') && 
          section.content && section.content.trim().length > 100
        ) : null;
        abstractContent = abstractSection ? abstractSection.content : article.description;
      }
      
      if (!abstractContent || abstractContent.trim().length < 20) return '';
      
      return `
    <section class="abstract">
      <h2>Abstract</h2>
      <div style="font-size: 1.05rem; line-height: 1.7;">
        ${formatTextWithParagraphs(abstractContent)}
      </div>
    </section>`;
    })()}
    
    <!-- Version of Record (if available) -->
    ${(() => {
      const fullContent = article.fullContent || '';
      const hasVersionOf = fullContent.includes('This Pub is a Version of');
      
      if (hasVersionOf) {
        // Parse the exact text structure we scraped
        // Pattern: "This Pub is a Version of[TITLE]Hide Description[WEBSITE]Description[DESCRIPTION]"
        const versionOfMatch = fullContent.match(/This Pub is a Version of([^]*?)Hide Description([^]*?)Description([^]*?)(?:License|Comments|$)/);
        
        if (versionOfMatch) {
          const versionTitle = versionOfMatch[1].trim();
          const website = versionOfMatch[2].trim();
          const description = versionOfMatch[3].trim().substring(0, 200); // First 200 chars
          
          // Use enhanced versionOfUrl if available, otherwise create from website
          const versionUrl = article.versionOfUrl || 
                             (website.startsWith('http') ? website : `https://${website}`);
          
          return `
    <section style="background: var(--light-gray); padding: 2rem; border-radius: 8px; margin: 2rem 0; border-left: 4px solid var(--primary-black);">
      <h3 style="margin-bottom: 1rem; color: var(--primary-black); font-size: 1.1rem;">📄 This Pub is a Version of</h3>
      <div style="margin-bottom: 1rem;">
        <h4 style="margin: 0; font-size: 1rem;">
          <a href="${versionUrl}" target="_blank" style="color: var(--primary-black); text-decoration: none; font-weight: 600; border-bottom: 2px solid var(--primary-black);">
            ${versionTitle}
          </a>
        </h4>
      </div>
      <div style="color: var(--text-gray); font-size: 0.9rem; margin-bottom: 1rem;">
        <strong>Published at:</strong> <em>${website}</em>
      </div>
      <div style="background: var(--primary-white); padding: 1rem; border-radius: 4px; border: 1px solid var(--border-gray);">
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-gray); line-height: 1.5;">
          ${description}${description.length >= 200 ? '...' : ''}
        </p>
      </div>
    </section>`;
        }
      }
      return '';
    })()}
    
    <!-- Keywords Section (if available) -->
    ${(() => {
      const fullContent = article.fullContent || '';
      const keywordsMatch = fullContent.match(/Keywords:\s*([^\\n\\r]+?)(?:License|Comments|$)/);
      
      if (keywordsMatch) {
        const keywords = keywordsMatch[1].trim().replace(/﻿/g, ''); // Remove any invisible characters
        return `
    <section style="background: var(--light-gray); padding: 1.5rem; border-radius: 8px; margin: 2rem 0; border-left: 4px solid var(--text-gray);">
      <h3 style="margin-bottom: 1rem; color: var(--primary-black); font-size: 1.1rem;">🏷️ Keywords</h3>
      <div style="font-size: 0.95rem; color: var(--text-gray); font-weight: 500;">
        ${keywords}
      </div>
    </section>`;
      }
      return '';
    })()}
    
    <!-- Video/Media Content (if available) -->
    ${(() => {
      const fullContent = article.fullContent || '';
      const fullContentHTML = article.fullContentHTML || '';
      
      // First try to extract YouTube URLs from HTML (if available)
      let videoItems = [];
      
      if (fullContentHTML) {
        const iframeMatches = fullContentHTML.match(/<iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\/([^?"]+)[^"]*"[^>]*><\/iframe>/g);
        if (iframeMatches) {
          iframeMatches.forEach((iframe, index) => {
            const videoIdMatch = iframe.match(/embed\/([^?&"]+)/);
            const titleMatch = iframe.match(/alt="[^"]*>([^<]+)</);
            
            if (videoIdMatch) {
              const videoId = videoIdMatch[1];
              const title = titleMatch ? titleMatch[1] : `Video ${index + 1}`;
              videoItems.push({
                title: title,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                type: 'youtube'
              });
            }
          });
        }
      }
      
      // Fallback: text-based detection without direct links
      if (videoItems.length === 0) {
        const videoMatches = fullContent.match(/Part \d+ of \d+[^\\n\\r]*?\(\d{4}\)/g);
        const studentPanelMatch = fullContent.match(/Student Panel[^\\n\\r]*?\(\d{4}\)/g);
        const allVideoContent = [...(videoMatches || []), ...(studentPanelMatch || [])];
        
        videoItems = [...new Set(allVideoContent)].map(video => ({
          title: video.trim(),
          url: article.originalUrl, // Link to CrimRXiv page as fallback
          type: 'reference'
        }));
      }
      
      if (videoItems.length > 0) {
        return `
    <section style="background: var(--light-gray); padding: 2rem; border-radius: 8px; margin: 2rem 0; border-left: 4px solid var(--text-gray);">
      <h3 style="margin-bottom: 1rem; color: var(--primary-black); font-size: 1.1rem;">🎥 Video/Audio Content</h3>
      <div style="display: grid; gap: 1rem;">
        ${videoItems.map(video => `
          <a href="${video.url}" target="_blank" style="text-decoration: none; color: inherit;">
            <div style="padding: 1rem; background: var(--primary-white); border-radius: 4px; border: 1px solid var(--border-gray); display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: all 0.2s; hover: box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
              <div style="background: var(--primary-black); color: var(--primary-white); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
                ${video.type === 'youtube' ? '▶️' : '🎬'}
              </div>
              <div>
                <div style="font-weight: 600; margin-bottom: 0.25rem; color: var(--primary-black);">${video.title}</div>
                <div style="font-size: 0.85rem; color: var(--text-gray);">
                  ${video.type === 'youtube' ? 'Click to watch on YouTube' : 'Click to view on CrimRXiv'}
                </div>
              </div>
            </div>
          </a>
        `).join('')}
      </div>
    </section>`;
      }
      
      return '';
    })()}
    
    <!-- Main Content Sections (No Redundant Full Content Dump) -->
    ${(() => {
      
      // For full articles, show content sections
      if (article.sections && article.sections.length > 0) {
        const validSections = article.sections.filter(section => {
          const heading = section.heading.toLowerCase();
          const content = section.content || '';
          
          // Skip abstract (already shown), references (handle separately)
          if (heading.includes('abstract') || heading.includes('references')) {
            return false;
          }
          
          // Skip sections that repeat the article title
          if (section.heading === article.title) {
            return false;
          }
          
          // Skip sections with minimal content
          if (!content || content.trim().length < 100) {
            return false;
          }
          
          // Skip sections that just repeat author/publication info
          const authorNames = article.authors.map(a => a.name.toLowerCase());
          const hasOnlyAuthorInfo = authorNames.some(name => 
            content.toLowerCase().includes(name) && 
            content.toLowerCase().includes('published') &&
            content.length < 500
          );
          
          if (hasOnlyAuthorInfo) {
            return false;
          }
          
          return true;
        });
        
        if (validSections.length > 0) {
          return `
    <section class="main-content">
      ${validSections.map(section => `
          <div class="section">
            <h3>${section.heading}</h3>
            <div class="section-content">
              ${formatTextWithParagraphs(section.content)}
            </div>
          </div>
        `).join('')}
    </section>`;
        }
      }
      
      // Default: Link to CrimRXiv for full content
      return `
    <section class="content-section">
      <div style="background: #f0f8ff; padding: 2rem; border-radius: 8px; text-align: center;">
        <h3>📖 Complete Article Content</h3>
        <p style="margin: 1rem 0; color: var(--text-gray); line-height: 1.6;">
          Full academic content with detailed sections, methodology, results, and discussion available on CrimRXiv.
        </p>
        <a href="${article.originalUrl}" class="btn btn-primary" target="_blank">
          📖 Read Complete Article on CrimRXiv
        </a>
      </div>
    </section>`;
    })()}
    
    <!-- References (Extract from sections or use references field) -->
    ${(() => {
      // Try to find references from sections first
      const referencesSection = article.sections ? article.sections.find(section => 
        section.heading.toLowerCase().includes('references') || 
        section.heading.toLowerCase().includes('bibliography')
      ) : null;
      
      // If we have a references section with content, use it
      if (referencesSection && referencesSection.content && referencesSection.content.trim().length > 50) {
        const processedRefs = processReferences([referencesSection.content]);
        if (processedRefs.length > 0) {
          return `
    <section class="references">
      <h2>References</h2>
      <ol class="references-list">
        ${processedRefs.map(ref => `
          <li class="reference-item">
            ${ref}
          </li>
        `).join('')}
      </ol>
    </section>`;
        }
      }
      
      // Fall back to references field if available
      if (processedReferences.length > 0) {
        return `
    <section class="references">
      <h2>References</h2>
      <ol class="references-list">
        ${processedReferences.map(ref => `
          <li class="reference-item">
            ${ref}
          </li>
        `).join('')}
      </ol>
    </section>`;
      }
      
      // If no references found, show nothing (like CrimRXiv)
      return '';
    })()}

    <!-- Download Section (if local PDF available) -->
    ${article.localPdf ? `
    <section class="downloads-section">
      <h3>📥 Download Attachment</h3>
      <div class="downloads-grid">
        <a href="${article.localPdf}" target="_blank" class="download-btn" style="text-decoration: none;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10,17L8,13H10L12,17H10M14,17L12,13H14L16,17H14Z"/>
            </svg>
            <span>Download PDF</span>
          </div>
        </a>
        <a href="${article.originalUrl}" target="_blank" class="download-btn" style="text-decoration: none;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.59,13.41C11,13.8 11,14.44 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C7.22,12.88 7.22,9.71 9.17,7.76V7.76L12.71,4.22C14.66,2.27 17.83,2.27 19.78,4.22C21.73,6.17 21.73,9.34 19.78,11.29L18.29,12.78C18.3,11.96 18.17,11.14 17.89,10.36L18.36,9.88C19.54,8.71 19.54,6.81 18.36,5.64C17.19,4.46 15.29,4.46 14.12,5.64L10.59,9.17C9.41,10.34 9.41,12.24 10.59,13.41M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C16.78,11.12 16.78,14.29 14.83,16.24V16.24L11.29,19.78C9.34,21.73 6.17,21.73 4.22,19.78C2.27,17.83 2.27,14.66 4.22,12.71L5.71,11.22C5.7,12.04 5.83,12.86 6.11,13.65L5.64,14.12C4.46,15.29 4.46,17.19 5.64,18.36C6.81,19.54 8.71,19.54 9.88,18.36L13.41,14.83C14.59,13.66 14.59,11.76 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z"/>
            </svg>
            <span>View on CrimRxiv</span>
          </div>
        </a>
      </div>
      <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-gray);">
        This PDF attachment is permanently archived.
      </p>
    </section>
    ` : ''}

  </main>

  <!-- Citation Modal -->
  <div id="citation-modal" class="citation-modal" style="display: none;">
    <div class="citation-content">
      <h3 style="margin-bottom: 1.5rem; color: var(--primary-black);">📋 Cite This Article</h3>
      
      <div style="margin-bottom: 2rem;">
        <h4 style="margin-bottom: 0.5rem; color: var(--primary-black);">APA Style</h4>
        <div class="citation-box" onclick="copyToClipboard(this.textContent)" title="Click to copy">
${article.authors.map(a => a.name).join(', ')} (${new Date(article.createdAt).getFullYear()}). ${article.title}. <em>CrimConsortium Archive</em>. Retrieved from ${article.originalUrl}
        </div>
      </div>
      
      <div style="margin-bottom: 2rem;">
        <h4 style="margin-bottom: 0.5rem; color: var(--primary-black);">MLA Style</h4>
        <div class="citation-box" onclick="copyToClipboard(this.textContent)" title="Click to copy">
${article.authors[0]?.name || 'Unknown'}${article.authors.length > 1 ? ', et al.' : ''}. "${article.title}." <em>CrimConsortium Archive</em>, ${new Date(article.createdAt).getFullYear()}, ${article.originalUrl}.
        </div>
      </div>
      
      <div style="text-align: right;">
        <button onclick="closeCitation()" class="btn">Close</button>
      </div>
    </div>
  </div>
  
  <script>
    function showCitation() {
      document.getElementById('citation-modal').style.display = 'flex';
    }
    
    function closeCitation() {
      document.getElementById('citation-modal').style.display = 'none';
    }
    
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text.trim()).then(() => {
        alert('Citation copied to clipboard!');
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text.trim();
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Citation copied to clipboard!');
      });
    }
    
    function shareArticle() {
      if (navigator.share) {
        navigator.share({
          title: '${article.title}',
          text: 'Research from ${member?.name || 'CrimConsortium'}',
          url: window.location.href
        });
      } else {
        copyToClipboard(window.location.href);
        alert('Article URL copied to clipboard!');
      }
    }
  </script>
  
  <!-- Footer with ar.io branding -->
  <footer style="background: var(--primary-black); color: var(--primary-white); padding: 2rem 0; margin-top: 4rem;">
    <div class="container">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.2);">
        <div style="display: flex; align-items: center; gap: 1.5rem;">
          <a href="https://www.crimrxiv.com">
            <img src="../../assets/images/crimxriv-logo.png" alt="CrimRXiv" style="height: 40px; filter: brightness(0) invert(1);" onerror="this.style.display='none'">
          </a>
          <div>
            <p style="margin: 0; font-weight: 600;">CrimConsortium Archive</p>
            <p style="margin: 0; font-size: 0.85rem; opacity: 0.8;">ISSN 2766-7170</p>
          </div>
        </div>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <a href="https://twitter.com/CrimRxiv" target="_blank" title="Twitter/X" style="color: var(--primary-white); opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a href="https://sciences.social/@CrimRxiv" target="_blank" title="Mastodon" style="color: var(--primary-white); opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.193 7.879c0-5.206-3.411-6.732-3.411-6.732C18.062.357 15.108.025 12.041 0h-.076c-3.068.025-6.02.357-7.74 1.147 0 0-3.411 1.526-3.411 6.732 0 1.192-.023 2.618.015 4.129.124 5.092.934 10.109 5.641 11.355 2.17.574 4.034.695 5.535.612 2.722-.15 4.25-.972 4.25-.972l-.09-1.975s-1.945.613-4.129.539c-2.165-.074-4.449-.233-4.799-2.891a5.499 5.499 0 0 1-.048-.745s2.125.52 4.817.643c1.646.075 3.19-.097 4.758-.283 3.007-.359 5.625-2.212 5.954-3.905.517-2.665.475-6.507.475-6.507zm-4.024 6.709h-2.497V8.469c0-1.29-.543-1.944-1.628-1.944-1.2 0-1.802.776-1.802 2.312v3.349h-2.483v-3.349c0-1.536-.602-2.312-1.802-2.312-1.085 0-1.628.655-1.628 1.944v6.119H4.832V8.284c0-1.289.328-2.313.987-3.07.68-.758 1.569-1.146 2.674-1.146 1.278 0 2.246.491 2.886 1.474L12 6.585l.622-1.043c.64-.983 1.608-1.474 2.886-1.474 1.104 0 1.994.388 2.674 1.146.658.757.986 1.781.986 3.07v6.304z"/>
            </svg>
          </a>
          <a href="https://www.linkedin.com/company/crimrxiv" target="_blank" title="LinkedIn" style="color: var(--primary-white); opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a href="https://bsky.app/profile/crimrxiv.bsky.social" target="_blank" title="Bluesky" style="color: var(--primary-white); opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"/>
            </svg>
          </a>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 2rem; margin-top: 1.5rem;">
        <div style="display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
          <a href="/" style="color: var(--primary-white); text-decoration: none;">Home</a>
          <a href="/articles" style="color: var(--primary-white); text-decoration: none;">Publications</a>
          <a href="/members" style="color: var(--primary-white); text-decoration: none;">Members</a>
          <a href="mailto:crimrxiv@manchester.ac.uk" style="color: var(--primary-white); text-decoration: none;">Help</a>
          <a href="https://www.crimrxiv.com/rss.xml" target="_blank" style="color: var(--primary-white); text-decoration: none;">RSS</a>
          <a href="https://www.crimrxiv.com/legal" target="_blank" style="color: var(--primary-white); text-decoration: none;">Legal</a>
        </div>
        <div style="font-size: 0.85rem; opacity: 0.7;">
          Powered by <a href="https://ar.io" target="_blank" style="color: var(--primary-white); opacity: 0.8;">ar.io</a>
        </div>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

/**
 * Process references into individual entries with working hyperlinks
 */
function processReferences(references) {
  if (!references || references.length === 0) return [];
  
  let allReferences = [];
  
  // If references is an array of strings, process each
  if (Array.isArray(references)) {
    references.forEach(refString => {
      const individualRefs = splitIntoIndividualReferences(refString);
      allReferences.push(...individualRefs);
    });
  } else if (typeof references === 'string') {
    // If it's one big string, split it
    allReferences = splitIntoIndividualReferences(references);
  }
  
  // Process each reference to add hyperlinks
  return allReferences
    .filter(ref => ref && ref.trim().length > 20) // Filter out empty/short entries
    .map(ref => addHyperlinksToReference(ref.trim()))
    .slice(0, 50); // Limit to first 50 references for performance
}

/**
 * Split a reference string into individual reference entries
 */
function splitIntoIndividualReferences(refString) {
  if (!refString) return [];
  
  // More conservative splitting - only split on strong reference boundaries
  // Look for patterns that clearly indicate a new reference starts
  const splitPatterns = [
    // Strong pattern: Period + space + Author (Last, First) + year in parentheses
    /\.\s+([A-Z][a-z]+,\s+[A-Z]\.?[^.]*?\([12]\d{3}\))/g,
    // DOI URL patterns (clear reference boundary)
    /\.\s+(https?:\/\/doi\.org\/[^\s]+)\s+([A-Z][a-z]+,)/g,
    // Very conservative: Only split on obvious new author patterns after periods
    /\.\s+([A-Z][a-z]+,\s+[A-Z]\.?\s+[A-Z]\.?\s*&\s+[A-Z][a-z]+)/g
  ];
  
  let references = [refString];
  let bestSplit = [refString];
  
  // Try each pattern and keep the most reasonable split
  for (const pattern of splitPatterns) {
    references.forEach(ref => {
      // Only split if we can clearly identify author-year patterns
      const matches = ref.match(pattern);
      if (matches && matches.length >= 2) {
        const splits = ref.split(pattern);
        if (splits.length > 1 && splits.every(s => s.trim().length > 30)) {
          // This looks like a good split - each part is substantial
          let reconstructed = [];
          for (let i = 0; i < splits.length - 1; i++) {
            if (splits[i].trim()) {
              reconstructed.push(splits[i].trim());
            }
          }
          if (splits[splits.length - 1].trim()) {
            reconstructed.push(splits[splits.length - 1].trim());
          }
          
          if (reconstructed.length > bestSplit.length) {
            bestSplit = reconstructed;
          }
        }
      }
    });
  }
  
  // If no good split found, try simpler line break splits
  if (bestSplit.length === 1 && refString.includes('\n')) {
    const lineSplits = refString.split(/\n+/).filter(line => line.trim().length > 50);
    if (lineSplits.length > 1) {
      bestSplit = lineSplits;
    }
  }
  
  return bestSplit.filter(ref => ref && ref.trim().length > 30);
}

/**
 * Add hyperlinks to DOIs and URLs in references
 */
function addHyperlinksToReference(reference) {
  // Clean up any existing malformed links first
  reference = reference.replace(
    /([^<]*?)(<\/a>)/g,
    '$1'
  );
  
  // Remove any existing broken link tags
  reference = reference.replace(
    /<a href="([^"]*?)" target="_blank">/g,
    ''
  );
  
  // Add clean links to DOI URLs
  reference = reference.replace(
    /\b(https?:\/\/doi\.org\/[^\s<]+)/g,
    '<a href="$1" target="_blank">$1</a>'
  );
  
  // Add links to other clean URLs (not inside existing links)
  reference = reference.replace(
    /\b(https?:\/\/[^\s<]+)(?![^<]*<\/a>)/g,
    '<a href="$1" target="_blank">$1</a>'
  );
  
  // Add links to DOI patterns without full URL
  reference = reference.replace(
    /\b(doi:|DOI:)\s*(10\.\d+\/[^\s<]+)/gi,
    '<a href="https://doi.org/$2" target="_blank">$1$2</a>'
  );
  
  return reference;
}

/**
 * Format text content with proper paragraphs
 */
function formatTextWithParagraphs(text) {
  if (!text) return '';
  
  return text
    .split('\n\n')
    .filter(paragraph => paragraph.trim().length > 0)
    .map(paragraph => `<p>${paragraph.trim()}</p>`)
    .join('');
}


export { generateImprovedArticlePage };