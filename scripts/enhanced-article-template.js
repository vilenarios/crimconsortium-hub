/**
 * Enhanced Article Page Template
 * Creates rich article pages matching CrimRXiv structure with full content
 */

function generateEnhancedArticlePage(article, member) {
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
      margin-right: 0.5rem;
    }
    
    .breadcrumb a:hover {
      text-decoration: underline;
    }
    
    .article-header {
      padding: 2rem 0;
      border-bottom: 1px solid var(--border-gray);
    }
    
    .article-title {
      font-size: 2rem;
      font-weight: bold;
      line-height: 1.3;
      margin-bottom: 1.5rem;
    }
    
    .article-meta {
      color: var(--text-gray);
      margin-bottom: 2rem;
      line-height: 1.8;
    }
    
    .article-meta strong {
      color: var(--primary-black);
    }
    
    .article-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 1.5rem;
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
    
    .downloads-section {
      background: var(--light-gray);
      padding: 1.5rem;
      border-radius: 8px;
      margin: 2rem 0;
    }
    
    .downloads-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 0.5rem;
      margin-top: 1rem;
    }
    
    .download-btn {
      padding: 0.5rem 1rem;
      background: white;
      border: 1px solid var(--border-gray);
      border-radius: 4px;
      text-decoration: none;
      color: var(--primary-black);
      text-align: center;
      font-size: 0.85rem;
      transition: background-color 0.2s;
    }
    
    .download-btn:hover {
      background: #e9ecef;
    }
    
    .download-btn.primary {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
    }
    
    .article-content {
      padding: 2rem 0;
    }
    
    .content-section {
      margin: 2rem 0;
    }
    
    .content-section h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: var(--primary-black);
      border-bottom: 2px solid var(--border-gray);
      padding-bottom: 0.5rem;
    }
    
    .content-section h3 {
      font-size: 1.2rem;
      margin: 1.5rem 0 1rem 0;
      color: var(--primary-black);
    }
    
    .abstract {
      background: var(--light-gray);
      padding: 1.5rem;
      border-radius: 8px;
      border-left: 4px solid var(--accent-blue);
    }
    
    .full-content {
      line-height: 1.8;
      margin: 1.5rem 0;
    }
    
    .references {
      background: #f9f9f9;
      padding: 1.5rem;
      border-radius: 8px;
      margin-top: 2rem;
    }
    
    .reference-item {
      margin-bottom: 1rem;
      padding-left: 1rem;
      border-left: 2px solid var(--border-gray);
      font-size: 0.9rem;
      line-height: 1.6;
    }
    
    .citation-box {
      background: #f8f9fa;
      border: 1px solid var(--border-gray);
      border-radius: 6px;
      padding: 1rem;
      margin: 1rem 0;
      font-family: monospace;
      font-size: 0.85rem;
    }
    
    @media (max-width: 768px) {
      .article-actions {
        flex-direction: column;
      }
      
      .downloads-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
  </style>
</head>
<body>
  <!-- Breadcrumb -->
  <div class="breadcrumb">
    <div class="container">
      <a href="/">← CrimConsortium</a>
      <span style="color: var(--text-gray);">></span>
      <a href="/articles">Publications</a>
      <span style="color: var(--text-gray);">></span>
      <span>${article.title.substring(0, 50)}${article.title.length > 50 ? '...' : ''}</span>
    </div>
  </div>
  
  <!-- Article Header -->
  <header class="article-header">
    <div class="container">
      <h1 class="article-title">${article.title}</h1>
      
      <div class="article-meta">
        <p><strong>Authors:</strong> ${article.authors.map(a => a.name).join(', ')}</p>
        ${member ? `<p><strong>Institution:</strong> ${member.name}</p>` : ''}
        <p><strong>Published:</strong> ${new Date(article.createdAt).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
        ${article.doi ? `<p><strong>DOI:</strong> <a href="https://doi.org/${article.doi}" target="_blank">${article.doi}</a></p>` : ''}
        <p><strong>Archive ID:</strong> <code>${article.id}</code></p>
      </div>
      
      <div class="article-actions">
        <button onclick="showCitation()" class="btn btn-primary">📋 Cite Article</button>
        <button onclick="shareArticle()" class="btn">🔗 Share</button>
        <a href="${article.originalUrl}" class="btn" target="_blank">🌐 View on CrimRXiv</a>
      </div>
    </div>
  </header>
  
  <!-- Downloads Section -->
  ${Object.keys(article.downloads || {}).length > 0 ? `
  <section class="downloads-section">
    <div class="container">
      <h3>📥 Download Options</h3>
      <div class="downloads-grid">
        ${Object.entries(article.downloads || {}).map(([format, url]) => `
          <a href="${url}" class="download-btn ${format === 'pdf' ? 'primary' : ''}" target="_blank">
            📄 ${format.toUpperCase()}
          </a>
        `).join('')}
      </div>
      ${!article.downloads?.pdf ? `
        <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-gray);">
          PDF will be available after ArDrive upload
        </p>
      ` : ''}
    </div>
  </section>
  ` : ''}
  
  <!-- Article Content -->
  <main class="article-content">
    <div class="container">
      
      <!-- Abstract -->
      ${article.description ? `
      <section class="content-section">
        <div class="abstract">
          <h2>Abstract</h2>
          <p>${article.description}</p>
        </div>
      </section>
      ` : ''}
      
      <!-- Full Content -->
      ${article.fullContent && article.fullContent.length > 100 ? `
      <section class="content-section">
        <h2>Article Content</h2>
        <div class="full-content">
          ${article.fullContent.split('\n').map(paragraph => 
            paragraph.trim() ? `<p>${paragraph.trim()}</p>` : ''
          ).join('')}
        </div>
        
        <div style="margin-top: 2rem; padding: 1rem; background: #f0f8ff; border-radius: 6px;">
          <p style="font-size: 0.9rem; color: var(--text-gray);">
            📖 <strong>Full Article:</strong> Complete content available on 
            <a href="${article.originalUrl}" target="_blank" style="color: var(--accent-blue);">CrimRXiv original page</a>
          </p>
        </div>
      </section>
      ` : `
      <section class="content-section">
        <div style="background: #f0f8ff; padding: 1.5rem; border-radius: 8px; text-align: center;">
          <h3>📖 Full Article Content</h3>
          <p style="margin: 1rem 0; color: var(--text-gray);">
            Complete article content with sections, references, and formatting available on CrimRXiv.
          </p>
          <a href="${article.originalUrl}" class="btn btn-primary" target="_blank">
            📖 Read Full Article on CrimRXiv
          </a>
        </div>
      </section>
      `}
      
      <!-- Content Sections -->
      ${article.sections && article.sections.length > 0 ? `
      <section class="content-section">
        <h2>Article Sections</h2>
        ${article.sections.map(section => `
          <div style="margin: 2rem 0; border-bottom: 1px solid var(--border-gray); padding-bottom: 1.5rem;">
            <${section.level} style="color: var(--primary-black); margin-bottom: 1rem; font-size: ${section.level === 'h1' ? '1.5rem' : section.level === 'h2' ? '1.3rem' : '1.1rem'};">
              ${section.heading}
            </${section.level}>
            <div style="color: var(--primary-black); line-height: 1.8; text-align: justify;">
              ${section.content}
            </div>
          </div>
        `).join('')}
        
        <div style="margin-top: 2rem; padding: 1rem; background: #f0f8ff; border-radius: 6px; text-align: center;">
          <p style="font-size: 0.9rem; color: var(--text-gray); margin-bottom: 1rem;">
            📖 <strong>Complete Article:</strong> Full academic text with references and formatting
          </p>
          <a href="${article.originalUrl}" target="_blank" style="background: var(--accent-blue); color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 6px; font-weight: 500;">
            📖 Read Complete Article on CrimRXiv
          </a>
        </div>
      </section>
      ` : ''}
      
      <!-- References -->
      ${article.references && article.references.length > 0 ? `
      <section class="content-section">
        <div class="references">
          <h2>References</h2>
          ${article.references.slice(0, 10).map(ref => `
            <div class="reference-item">${ref}</div>
          `).join('')}
          ${article.references.length > 10 ? `
            <div style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-gray);">
              <em>Complete references (${article.references.length} total) available on 
              <a href="${article.originalUrl}" target="_blank">CrimRXiv original page</a></em>
            </div>
          ` : ''}
        </div>
      </section>
      ` : ''}
      
      <!-- Article Details -->
      <section class="content-section">
        <h2>Publication Details</h2>
        <div style="background: var(--light-gray); padding: 1.5rem; border-radius: 8px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div>
              <strong>Publication ID:</strong><br>
              <code>${article.id}</code>
            </div>
            <div>
              <strong>Member Institution:</strong><br>
              ${member ? `<a href="/members/${member.id}">${member.name}</a>` : 'Multiple institutions'}
            </div>
            <div>
              <strong>Publication Year:</strong><br>
              ${new Date(article.createdAt).getFullYear()}
            </div>
            <div>
              <strong>Archive Status:</strong><br>
              Permanently preserved
            </div>
          </div>
          
          ${article.memberAssociations && article.memberAssociations.length > 1 ? `
          <div style="margin-top: 1rem;">
            <strong>Associated Members:</strong><br>
            ${article.memberNames.join(', ')}
          </div>
          ` : ''}
          
          <div style="margin-top: 1rem;">
            <strong>Download Formats Available:</strong><br>
            ${Object.keys(article.downloads || {}).length > 0 ? 
              Object.keys(article.downloads).map(format => format.toUpperCase()).join(', ') :
              'PDF (after ArDrive upload)'
            }
          </div>
        </div>
      </section>
      
    </div>
  </main>
  
  <!-- Citation Modal -->
  <div id="citation-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 2rem; border-radius: 8px; max-width: 600px; width: 90%;">
      <h3 style="margin-bottom: 1rem;">📋 Cite This Article</h3>
      
      <div style="margin-bottom: 1.5rem;">
        <label style="font-weight: 500; display: block; margin-bottom: 0.5rem;">APA Style:</label>
        <div class="citation-box" onclick="copyToClipboard(this.textContent)">
${article.authors.map(a => a.name).join(', ')} (${new Date(article.createdAt).getFullYear()}). ${article.title}. <em>CrimConsortium Archive</em>. Retrieved from ${article.originalUrl}
        </div>
      </div>
      
      <div style="margin-bottom: 1.5rem;">
        <label style="font-weight: 500; display: block; margin-bottom: 0.5rem;">MLA Style:</label>
        <div class="citation-box" onclick="copyToClipboard(this.textContent)">
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
      document.getElementById('citation-modal').style.display = 'block';
    }
    
    function closeCitation() {
      document.getElementById('citation-modal').style.display = 'none';
    }
    
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
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
        navigator.clipboard.writeText(window.location.href);
        alert('Article URL copied to clipboard!');
      }
    }
  </script>
</body>
</html>`;
}

export { generateEnhancedArticlePage };