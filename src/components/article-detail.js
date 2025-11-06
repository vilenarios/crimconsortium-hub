/**
 * ArticleDetail Component
 *
 * Displays full article with:
 * - Metadata
 * - Full abstract
 * - Authors with affiliations
 * - Keywords and collections
 * - ProseMirror content rendered directly from Arweave manifest
 * - PDF link (if available)
 *
 * Implements lazy loading of article batch.
 */

import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import { getManifestUrl, getAttachmentUrl } from '../config/arweave.js';

export class ArticleDetail {
  constructor(db, router, manifestLoader) {
    this.db = db;
    this.router = router;
    this.manifestLoader = manifestLoader;
  }

  /**
   * Render common header with logo and branding
   * NOTE: Header is now in index.html (always visible), so this returns empty
   */
  renderHeader() {
    return '';
  }

  /**
   * Render common navigation bar
   * NOTE: Navigation is now in index.html (always visible), so this returns empty
   */
  renderNavigation() {
    return '';
  }

  /**
   * Render common footer
   * NOTE: Footer is now in index.html (always visible), so this returns empty
   */
  renderFooter() {
    return '';
  }

  /**
   * Render article detail page
   */
  async render(slug) {
    try {
      // Show loading state
      this.showLoading();

      // First get metadata from parquet
      const metadata = await this.db.getArticleMetadata(slug);

      if (!metadata) {
        // Set page title for not found
        document.title = `Article Not Found - CrimRXiv Archive`;
        return this.renderNotFound(slug);
      }

      // Set page title with article title
      document.title = `${metadata.title} - CrimRXiv Archive`;

      // Track if we failed to load the manifest
      let manifestLoadFailed = false;
      let manifestError = null;

      // If article has Arweave manifest, fetch content using manifestLoader
      if (metadata.manifest_tx_id) {
        console.log(`📦 Loading article from manifest: ${metadata.manifest_tx_id}`);

        try {
          // Use manifestLoader to get full article (ProseMirror + attachments)
          const fullArticle = await this.manifestLoader.getFullArticle(metadata);
          const html = this.renderManifestArticle(fullArticle);

          // Render ProseMirror content after DOM is ready (if available)
          if (fullArticle.content_prosemirror) {
            setTimeout(() => this.renderProseMirrorContent(fullArticle.slug, fullArticle.content_prosemirror), 0);
          }

          return html;
        } catch (error) {
          console.error(`⚠️ Failed to load manifest content:`, error);
          manifestLoadFailed = true;
          manifestError = error;
          // Fall through to metadata-only rendering with warning
        }
      }

      // Fallback: use metadata only (from parquet file)
      const article = await this.db.getArticleFull(slug);

      // Add warning flag if manifest loading failed
      if (manifestLoadFailed) {
        article._manifestLoadFailed = true;
        article._manifestError = manifestError;
        article.manifest_tx_id = metadata.manifest_tx_id;
      }

      // Debug logging
      console.log('📊 Article data received:', {
        slug: article.slug,
        has_prosemirror: !!article.content_prosemirror,
        prosemirror_length: article.content_prosemirror ? article.content_prosemirror.length : 0,
        has_license: !!article.license,
        license: article.license,
        has_attachments: !!article.attachments_json,
        attachments: article.attachments_json ? JSON.parse(article.attachments_json).length : 0
      });

      const html = this.renderContent(article);

      // Render ProseMirror content after DOM is ready (if available)
      if (article.content_prosemirror) {
        setTimeout(() => this.renderProseMirrorContent(article.slug, article.content_prosemirror), 0);
      }

      return html;
    } catch (error) {
      console.error(`❌ Article detail render error for ${slug}:`, error);
      return this.renderError(error.message, slug);
    }
  }

  /**
   * Fetch article content from Arweave
   */
  async fetchFromArweave(txId) {
    try {
      const url = getManifestUrl(txId);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const content = await response.text();
      return content;
    } catch (error) {
      console.error(`⚠️  Failed to fetch from Arweave:`, error);
      return null;
    }
  }

  /**
   * Show loading spinner
   */
  showLoading() {
    return `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading article...</p>
      </div>
    `;
  }

  /**
   * Render article from Arweave Markdown
   */
  renderArweaveContent(metadata, markdownContent) {
    // Parse markdown frontmatter and content
    const { frontmatter, content } = this.parseMarkdown(markdownContent);

    return `
      <div class="article-detail arweave-article">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <!-- Breadcrumb Navigation -->
        <nav class="breadcrumb">
          <div class="container">
            <a href="#/" class="breadcrumb-link">Home</a>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-current">${this.escapeHtml(metadata.title)}</span>
          </div>
        </nav>

        <!-- Arweave Badge -->
        <div class="container">
          <div class="arweave-badge">
            📡 Permanent Archive on Arweave
            <a href="${getManifestUrl(metadata.arweave_tx_id)}" target="_blank" class="tx-link">
              View TX: ${metadata.arweave_tx_id.substring(0, 12)}...
            </a>
          </div>
        </div>

        <!-- Article Header -->
        <header class="article-header-section">
          <div class="container">
            ${metadata._manifestLoadFailed ? `
              <div class="warning-banner" style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="display: flex; align-items: start; gap: 12px;">
                  <span style="font-size: 24px;">⚠️</span>
                  <div>
                    <strong style="color: #856404; font-size: 16px;">Unable to Load Full Article Content</strong>
                    <p style="color: #856404; margin: 8px 0 0 0; line-height: 1.5;">
                      The full article content could not be loaded from Arweave. This may be due to network issues or the content is still propagating across the network.
                      Displaying available metadata only.
                    </p>
                    ${metadata.manifest_tx_id ? `
                      <p style="margin: 8px 0 0 0;">
                        <a href="https://viewblock.io/arweave/tx/${metadata.manifest_tx_id}" target="_blank" style="color: #0066cc; text-decoration: underline;">
                          View transaction on Arweave blockchain
                        </a>
                      </p>
                    ` : ''}
                  </div>
                </div>
              </div>
            ` : ''}

            <h1 class="article-title">${this.escapeHtml(metadata.title)}</h1>

            <!-- Metadata Bar -->
            <div class="article-metadata">
              <div class="meta-item">
                <span class="meta-label">Published:</span>
                <span class="meta-value">${this.formatDate(metadata.published_at)}</span>
              </div>
              ${metadata.doi ? `
                <div class="meta-item">
                  <span class="meta-label">DOI:</span>
                  <a href="https://doi.org/${metadata.doi}" target="_blank" class="meta-value meta-link">
                    ${metadata.doi}
                  </a>
                </div>
              ` : ''}
              ${metadata.manifest_tx_id ? `
                <div class="meta-item">
                  <span class="meta-label">Arweave TX:</span>
                  <a href="https://viewblock.io/arweave/tx/${metadata.manifest_tx_id}" target="_blank" class="meta-value meta-link" title="View on Arweave blockchain">
                    ${metadata.manifest_tx_id.substring(0, 8)}...${metadata.manifest_tx_id.substring(metadata.manifest_tx_id.length - 4)}
                  </a>
                </div>
              ` : ''}
              ${metadata.word_count ? `
                <div class="meta-item">
                  <span class="meta-label">Words:</span>
                  <span class="meta-value">${metadata.word_count.toLocaleString()}</span>
                </div>
              ` : ''}
              ${metadata.attachment_count > 0 ? `
                <div class="meta-item">
                  <span class="meta-label">Attachments:</span>
                  <span class="meta-value">${metadata.attachment_count}</span>
                </div>
              ` : ''}
            </div>

            <!-- External Publications -->
            ${this.renderExternalPublications(metadata.external_publications_json)}

            <!-- Authors -->
            ${metadata.authors && metadata.authors.length > 0 ? `
              <div class="article-authors-section">
                <h2 class="section-title">Authors</h2>
                <div class="authors-list">
                  ${this.renderAuthors(metadata.authors)}
                </div>
              </div>
            ` : ''}
          </div>
        </header>

        <!-- Article Body (Markdown Content) -->
        <main class="article-body">
          <div class="container">
            <div class="markdown-content">
              <pre class="markdown-display">${this.escapeHtml(content)}</pre>
            </div>
          </div>
        </main>

        <!-- Back Button -->
        <div class="container">
          <button onclick="window.router.goHome()" class="back-button">
            ← Back to Homepage
          </button>
        </div>

        ${this.renderLicenseSection()}
        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Fetch metadata.json from Arweave manifest
   */
  async fetchManifestMetadata(manifestTxId) {
    try {
      const metadataUrl = getManifestUrl(manifestTxId, 'metadata.json');
      console.log(`  → Fetching: ${metadataUrl}`);

      const response = await fetch(metadataUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const metadata = await response.json();
      return metadata;
    } catch (error) {
      console.error(`⚠️  Failed to fetch manifest metadata:`, error);
      return null;
    }
  }

  /**
   * Fetch content.json from Arweave manifest
   */
  async fetchManifestContent(manifestTxId) {
    try {
      const contentUrl = getManifestUrl(manifestTxId, 'content.json');
      console.log(`  → Fetching: ${contentUrl}`);

      const response = await fetch(contentUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const content = await response.json();
      return content;
    } catch (error) {
      console.error(`⚠️  Failed to fetch manifest content:`, error);
      return null;
    }
  }

  /**
   * Render article from Arweave manifest with ProseMirror content
   */
  renderManifestContent(metadata, manifestMetadata, manifestContent = null) {
    const manifestUrl = getManifestUrl(metadata.manifest_tx_id);

    // Extract data from manifest metadata
    const authors = manifestMetadata.authors || [];
    const keywords = manifestMetadata.keywords || [];
    const collections = manifestMetadata.collections || [];
    const attachments = manifestMetadata.attachments || [];
    const abstract = manifestMetadata.abstract || metadata.abstract;
    const statistics = manifestMetadata.statistics || {};

    // Get first author's affiliation if available
    const firstAuthorAffiliation = authors.length > 0 && authors[0].affiliation
      ? authors[0].affiliation
      : null;

    return `
      <div class="article-detail manifest-article">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <!-- Article Content Container -->
        <div class="article-container">
          <div class="container">

            <!-- Institutional Badge -->
            ${firstAuthorAffiliation ? `
              <div class="institutional-badge">
                ${this.escapeHtml(firstAuthorAffiliation)}
              </div>
            ` : ''}

            <!-- Publication Type & Date -->
            <div class="publication-meta">
              <span class="publication-type">Postprints + Versions of Record</span>
              <span class="publication-date">${this.formatDate(manifestMetadata.dates?.published || metadata.published_at)}</span>
            </div>

            <!-- Article Title -->
            <h1 class="article-main-title">${this.escapeHtml(metadata.title)}</h1>

            <!-- Authors -->
            <div class="article-authors-list">
              ${authors.map(author => `
                <span class="author-name">${this.escapeHtml(author.name)}</span>${author.is_corresponding ? '<sup>✉</sup>' : ''}
              `).join(', ')}
            </div>

            <!-- DOI & License -->
            <div class="article-identifiers">
              ${manifestMetadata.doi || metadata.doi ? `
                <div class="doi-badge">
                  <span class="doi-label">DOI:</span>
                  <a href="https://doi.org/${manifestMetadata.doi || metadata.doi}" target="_blank" class="doi-link">
                    ${manifestMetadata.doi || metadata.doi}
                  </a>
                </div>
              ` : ''}
              ${metadata.license ? `
                <div class="license-badge">
                  <span class="license-text">${this.escapeHtml(metadata.license)}</span>
                </div>
              ` : ''}
            </div>

            <!-- Download Section -->
            <div class="download-section">
              <h3 class="download-title">Download</h3>
              <div class="download-buttons">
                ${manifestMetadata.urls?.pdf || attachments.find(a => a.type === 'application/pdf') ? `
                  <a href="${manifestMetadata.urls?.pdf || getManifestUrl(metadata.manifest_tx_id, attachments.find(a => a.type === 'application/pdf')?.path)}" target="_blank" class="download-btn">PDF</a>
                ` : ''}
                <a href="${getManifestUrl(metadata.manifest_tx_id, 'metadata.json')}" target="_blank" class="download-btn">Metadata JSON</a>
                <a href="${getManifestUrl(metadata.manifest_tx_id, 'content.json')}" target="_blank" class="download-btn">Content JSON</a>
              </div>
              <div class="release-info">
                <span class="release-text">Archived on Arweave</span>
                <span class="tx-id-small">TX: ${metadata.manifest_tx_id.substring(0, 12)}...</span>
              </div>
            </div>

            <!-- Abstract -->
            ${abstract ? `
              <section class="article-abstract">
                <h2 class="content-section-title">Abstract</h2>
                <div class="abstract-content">
                  ${this.escapeHtml(abstract)}
                </div>
              </section>
            ` : ''}

            <!-- ProseMirror Content -->
            ${manifestContent ? `
              <section class="article-content-section">
                <div id="prosemirror-content-${metadata.slug}" class="prosemirror-rendered"></div>
              </section>
            ` : ''}

            <!-- Author Details (with affiliations) -->
            ${authors.length > 0 && authors.some(a => a.affiliation) ? `
              <section class="author-details-section">
                <h2 class="content-section-title">Author Information</h2>
                <div class="author-details-list">
                  ${authors.map(author => `
                    ${author.affiliation ? `
                      <div class="author-detail-item">
                        <div class="author-detail-name">${this.escapeHtml(author.name)}${author.is_corresponding ? ' <sup>✉</sup>' : ''}</div>
                        <div class="author-detail-affiliation">${this.escapeHtml(author.affiliation)}</div>
                        ${author.orcid ? `
                          <div class="author-detail-orcid">
                            <a href="https://orcid.org/${author.orcid}" target="_blank">ORCID: ${author.orcid}</a>
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}
                  `).join('')}
                </div>
              </section>
            ` : ''}

            <!-- Keywords -->
            ${keywords.length > 0 ? `
              <section class="keywords-section">
                <h3 class="subsection-title">Keywords</h3>
                <div class="keyword-tags">
                  ${keywords.map(kw => `
                    <span class="keyword-badge">${this.escapeHtml(kw)}</span>
                  `).join(' ')}
                </div>
              </section>
            ` : ''}

            <!-- Collections -->
            ${collections.length > 0 ? `
              <section class="collections-section">
                <h3 class="subsection-title">Collections</h3>
                <div class="collection-tags">
                  ${collections.map(col => `
                    <span class="collection-badge">${this.escapeHtml(col)}</span>
                  `).join(' ')}
                </div>
              </section>
            ` : ''}

          </div>
        </div>

        ${this.renderLicenseSection()}
        ${this.renderFooter()}

        <style>
          .manifest-badge {
            background: #f0f8ff;
            border-left: 4px solid #1976d2;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 4px;
          }

          .manifest-badge .manifest-links {
            display: flex;
            gap: 1rem;
            margin-top: 0.5rem;
            flex-wrap: wrap;
          }

          .manifest-badge .tx-link {
            font-size: 0.9rem;
            color: #1976d2;
            text-decoration: none;
          }

          .manifest-badge .tx-link:hover {
            text-decoration: underline;
          }

          .prosemirror-content {
            background: white;
            padding: 2rem;
            border: 1px solid #ddd;
            border-radius: 8px;
            line-height: 1.6;
            font-family: Georgia, 'Times New Roman', serif;
          }

          .prosemirror-content h1,
          .prosemirror-content h2,
          .prosemirror-content h3 {
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            font-weight: 600;
          }

          .prosemirror-content p {
            margin-bottom: 1rem;
          }

          .prosemirror-content ul,
          .prosemirror-content ol {
            margin-bottom: 1rem;
            padding-left: 2rem;
          }

          .prosemirror-content blockquote {
            border-left: 3px solid #ddd;
            padding-left: 1rem;
            margin-left: 0;
            color: #666;
          }

          .prosemirror-content code {
            background: #f5f5f5;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }

          .prosemirror-content pre {
            background: #f5f5f5;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
          }

          .attachments-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .attachment-item {
            padding: 0.75rem;
            background: #f9f9f9;
            border-radius: 4px;
          }

          .attachment-link {
            color: #1976d2;
            text-decoration: none;
            font-weight: 500;
          }

          .attachment-link:hover {
            text-decoration: underline;
          }

          /* License Section - Compact Footer Bar */
          .article-license-section {
            background: #f8f9fa;
            border-top: 1px solid #dee2e6;
            padding: 1.25rem 0;
            margin-top: 3rem;
          }

          .license-bar {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
          }

          .license-left {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .license-icon {
            width: 88px;
            height: 31px;
            flex-shrink: 0;
          }

          .license-text {
            font-size: 0.9rem;
            color: #495057;
            font-weight: 500;
            white-space: nowrap;
          }

          .license-learn-more {
            color: #1976d2;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            white-space: nowrap;
            transition: color 0.2s;
            flex-shrink: 0;
          }

          .license-learn-more:hover {
            color: #1565c0;
            text-decoration: underline;
          }

          /* Mobile responsive */
          @media (max-width: 767px) {
            .article-license-section {
              padding: 1rem 0;
              margin-top: 2rem;
            }

            .license-bar {
              padding: 0 1rem;
              flex-direction: column;
              align-items: flex-start;
              gap: 0.75rem;
            }

            .license-text {
              white-space: normal;
              font-size: 0.85rem;
            }

            .license-learn-more {
              font-size: 0.85rem;
              align-self: flex-end;
            }
          }
        </style>

        <script type="module">
          // Render ProseMirror content as structured HTML
          (async () => {
            const contentData = ${JSON.stringify(manifestContent)};
            if (!contentData) {
              console.log('ℹ️  No ProseMirror content available for this article');
              return;
            }

            try {
              const containerEl = document.getElementById('prosemirror-content-${metadata.slug}');
              if (!containerEl) {
                console.warn('⚠️  ProseMirror container element not found');
                return;
              }

              // Convert ProseMirror JSON to structured HTML
              const html = convertProseMirrorToHTML(contentData);
              containerEl.innerHTML = html;

              console.log('✅ ProseMirror content rendered from content.json');
            } catch (error) {
              console.error('❌ Failed to render ProseMirror:', error);
              const containerEl = document.getElementById('prosemirror-content-${metadata.slug}');
              if (containerEl) {
                containerEl.innerHTML = '<p class="error">Failed to render article content</p>';
              }
            }
          })();

          /**
           * Convert ProseMirror JSON document to structured HTML
           */
          function convertProseMirrorToHTML(doc) {
            if (!doc || !doc.content) return '';

            let html = '';

            // Process each top-level node
            for (const node of doc.content) {
              html += renderNode(node);
            }

            return html;
          }

          /**
           * Render a single ProseMirror node to HTML
           */
          function renderNode(node, context = {}) {
            if (!node) return '';

            const type = node.type;
            const attrs = node.attrs || {};
            const content = node.content || [];

            switch (type) {
              case 'heading':
                const level = attrs.level || 1;
                const headingContent = renderChildren(content);
                return \`<h\${level}>\${headingContent}</h\${level}>\`;

              case 'paragraph':
                const paraContent = renderChildren(content);
                return \`<p>\${paraContent}</p>\`;

              case 'blockquote':
                const quoteContent = renderChildren(content);
                return \`<blockquote>\${quoteContent}</blockquote>\`;

              case 'code_block':
                const codeContent = node.content ? node.content.map(n => n.text || '').join('') : '';
                return \`<pre><code>\${escapeHtml(codeContent)}</code></pre>\`;

              case 'ordered_list':
                const olContent = renderChildren(content);
                return \`<ol>\${olContent}</ol>\`;

              case 'bullet_list':
                const ulContent = renderChildren(content);
                return \`<ul>\${ulContent}</ul>\`;

              case 'list_item':
                const liContent = renderChildren(content);
                return \`<li>\${liContent}</li>\`;

              case 'horizontal_rule':
                return '<hr />';

              case 'hard_break':
                return '<br />';

              case 'text':
                let text = node.text || '';
                text = escapeHtml(text);

                // Apply marks (bold, italic, etc.)
                if (node.marks && node.marks.length > 0) {
                  for (const mark of node.marks) {
                    switch (mark.type) {
                      case 'strong':
                        text = \`<strong>\${text}</strong>\`;
                        break;
                      case 'em':
                        text = \`<em>\${text}</em>\`;
                        break;
                      case 'code':
                        text = \`<code>\${text}</code>\`;
                        break;
                      case 'link':
                        const href = mark.attrs?.href || '#';
                        text = \`<a href="\${escapeHtml(href)}" target="_blank" rel="noopener">\${text}</a>\`;
                        break;
                      case 'subscript':
                        text = \`<sub>\${text}</sub>\`;
                        break;
                      case 'superscript':
                        text = \`<sup>\${text}</sup>\`;
                        break;
                    }
                  }
                }
                return text;

              case 'image':
                const src = attrs.src || '';
                const alt = attrs.alt || '';
                const title = attrs.title || '';
                return \`<figure>
                  <img src="\${escapeHtml(src)}" alt="\${escapeHtml(alt)}" title="\${escapeHtml(title)}" />
                  \${title ? \`<figcaption>\${escapeHtml(title)}</figcaption>\` : ''}
                </figure>\`;

              case 'table':
                const tableContent = renderChildren(content);
                return \`<table>\${tableContent}</table>\`;

              case 'table_row':
                const rowContent = renderChildren(content);
                return \`<tr>\${rowContent}</tr>\`;

              case 'table_header':
                const thContent = renderChildren(content);
                return \`<th>\${thContent}</th>\`;

              case 'table_cell':
                const tdContent = renderChildren(content);
                return \`<td>\${tdContent}</td>\`;

              default:
                // Unknown node type - try to render children
                return renderChildren(content);
            }
          }

          /**
           * Render children nodes
           */
          function renderChildren(children) {
            if (!children || children.length === 0) return '';
            return children.map(child => renderNode(child)).join('');
          }

          /**
           * Escape HTML entities
           */
          function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }
        </script>
      </div>
    `;
  }

  /**
   * Render article loaded from manifest (new external architecture)
   * @param {object} article - Full article with metadata, content_markdown, and attachments from manifestLoader
   */
  renderManifestArticle(article) {
    // Get first author's affiliation if available
    const firstAuthorAffiliation = article.authors && article.authors.length > 0 && article.authors[0].affiliation
      ? article.authors[0].affiliation
      : null;

    return `
      <div class="article-detail manifest-article">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <!-- Article Content Container -->
        <div class="article-container">
          <div class="container">

            <!-- Institutional Badge -->
            ${firstAuthorAffiliation ? `
              <div class="institutional-badge">
                ${this.escapeHtml(firstAuthorAffiliation)}
              </div>
            ` : ''}

            <!-- Publication Type & Date -->
            <div class="publication-meta">
              <span class="publication-type">Postprints + Versions of Record</span>
              <span class="publication-date">${this.formatDate(article.published_at)}</span>
            </div>

            <!-- Article Title -->
            <h1 class="article-main-title">${this.escapeHtml(article.title)}</h1>

            <!-- Authors -->
            ${article.authors && article.authors.length > 0 ? `
              <div class="article-authors-list">
                ${article.authors.filter(author => author.name).map(author => `
                  <span class="author-name">${this.escapeHtml(author.name)}</span>${author.is_corresponding ? '<sup>✉</sup>' : ''}
                `).join(', ')}
              </div>
            ` : ''}

            <!-- DOI & License -->
            <div class="article-identifiers">
              ${article.doi ? `
                <div class="doi-badge">
                  <span class="doi-label">DOI:</span>
                  <a href="https://doi.org/${article.doi}" target="_blank" class="doi-link">
                    ${article.doi}
                  </a>
                </div>
              ` : ''}
              ${article.manifest_tx_id ? `
                <div class="doi-badge">
                  <span class="doi-label">Arweave TX:</span>
                  <a href="https://viewblock.io/arweave/tx/${article.manifest_tx_id}" target="_blank" class="doi-link" title="View on Arweave blockchain">
                    ${article.manifest_tx_id.substring(0, 8)}...${article.manifest_tx_id.substring(article.manifest_tx_id.length - 4)}
                  </a>
                </div>
              ` : ''}
              ${article.license ? `
                <div class="license-badge">
                  ${this.renderLicenseBadge(article.license)}
                </div>
              ` : ''}
            </div>

            <!-- External Publications -->
            ${this.renderExternalPublications(article.external_publications_json)}

            <!-- Download Section -->
            ${article.attachments && article.attachments.find(a => a.type === 'pdf') ? `
              <div class="download-section">
                <h3 class="download-title">Download</h3>
                <div class="download-buttons">
                  <a href="${article.attachments.find(a => a.type === 'pdf').url}" target="_blank" class="download-btn">PDF</a>
                </div>
              </div>
            ` : ''}

            <!-- Abstract -->
            ${article.abstract ? `
              <section class="article-abstract">
                <h2 class="content-section-title">Abstract</h2>
                <div class="abstract-content">
                  ${this.escapeHtml(article.abstract)}
                </div>
              </section>
            ` : ''}

            <!-- Full Article Content (ProseMirror includes all sections with headings) -->
            ${article.content_prosemirror ? `
              <div id="prosemirror-content-${article.slug}" class="prosemirror-rendered">
                <p class="loading-text">Loading article content...</p>
              </div>
            ` : ''}

            <!-- Author Details (with affiliations) -->
            ${article.authors && article.authors.length > 0 && article.authors.some(a => a.affiliation) ? `
              <section class="author-details-section">
                <h2 class="content-section-title">Author Information</h2>
                <div class="author-details-list">
                  ${article.authors.filter(author => author.name).map(author => `
                    ${author.affiliation ? `
                      <div class="author-detail-item">
                        <div class="author-detail-name">${this.escapeHtml(author.name)}${author.is_corresponding ? ' <sup>✉</sup>' : ''}</div>
                        <div class="author-detail-affiliation">${this.escapeHtml(author.affiliation)}</div>
                        ${author.orcid ? `
                          <div class="author-detail-orcid">
                            <a href="https://orcid.org/${author.orcid}" target="_blank" class="orcid-link">ORCID: ${author.orcid}</a>
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}
                  `).join('')}
                </div>
              </section>
            ` : ''}

            <!-- Keywords -->
            ${article.keywords && article.keywords.length > 0 ? `
              <section class="keywords-section">
                <h3 class="subsection-title">Keywords</h3>
                <div class="keyword-tags">
                  ${article.keywords.map(kw => `
                    <span class="keyword-badge">${this.escapeHtml(kw)}</span>
                  `).join(' ')}
                </div>
              </section>
            ` : ''}

            <!-- Collections -->
            ${article.collections && article.collections.length > 0 ? `
              <section class="collections-section">
                <h3 class="subsection-title">Collections</h3>
                <div class="collection-tags">
                  ${article.collections.map(col => `
                    <span class="collection-badge">${this.escapeHtml(col)}</span>
                  `).join(' ')}
                </div>
              </section>
            ` : ''}

            <!-- Attachments -->
            ${article.attachments && article.attachments.length > 0 ? `
              <section class="attachments-section">
                <h3 class="subsection-title">Attachments</h3>
                <div class="attachments-list">
                  ${article.attachments.map(attachment => `
                    <div class="attachment-item">
                      <a href="${attachment.url}" target="_blank" class="attachment-link">
                        ${attachment.type === 'pdf' ? '📄' : '📎'} ${this.escapeHtml(attachment.filename)}
                      </a>
                      ${attachment.extension ? `<span class="attachment-type">(${attachment.extension})</span>` : ''}
                    </div>
                  `).join('')}
                </div>
              </section>
            ` : ''}

          </div>
        </div>

        ${this.renderLicenseSection()}
        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Parse Markdown with frontmatter
   */
  parseMarkdown(markdown) {
    // Simple frontmatter parser
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = markdown.match(frontmatterRegex);

    if (match) {
      return {
        frontmatter: match[1],
        content: match[2]
      };
    }

    return {
      frontmatter: '',
      content: markdown
    };
  }

  /**
   * Render article content
   */
  renderContent(article) {
    // Get first author's affiliation if available
    const firstAuthorAffiliation = article.authors && article.authors.length > 0 && article.authors[0].affiliation
      ? article.authors[0].affiliation
      : null;

    return `
      <div class="article-detail">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <!-- Article Content Container -->
        <div class="article-container">
          <div class="container">

            <!-- Institutional Badge -->
            ${firstAuthorAffiliation ? `
              <div class="institutional-badge">
                ${this.escapeHtml(firstAuthorAffiliation)}
              </div>
            ` : ''}

            <!-- Publication Type & Date -->
            <div class="publication-meta">
              <span class="publication-type">Postprints + Versions of Record</span>
              <span class="publication-date">${this.formatDate(article.published_at)}</span>
            </div>

            <!-- Article Title -->
            <h1 class="article-main-title">${this.escapeHtml(article.title)}</h1>

            <!-- Authors -->
            ${article.authors && article.authors.length > 0 ? `
              <div class="article-authors-list">
                ${article.authors.filter(author => author.name).map(author => `
                  <span class="author-name">${this.escapeHtml(author.name)}</span>${author.is_corresponding ? '<sup>✉</sup>' : ''}
                `).join(', ')}
              </div>
            ` : ''}

            <!-- DOI & License -->
            <div class="article-identifiers">
              ${article.doi ? `
                <div class="doi-badge">
                  <span class="doi-label">DOI:</span>
                  <a href="https://doi.org/${article.doi}" target="_blank" class="doi-link">
                    ${article.doi}
                  </a>
                </div>
              ` : ''}
              ${article.license ? `
                <div class="license-badge">
                  ${this.renderLicenseBadge(article.license)}
                </div>
              ` : ''}
            </div>

            <!-- External Publications -->
            ${this.renderExternalPublications(article.external_publications_json)}

            <!-- Download Section -->
            ${article.pdf_url ? `
              <div class="download-section">
                <h3 class="download-title">Download</h3>
                <div class="download-buttons">
                  <a href="${article.pdf_url}" target="_blank" class="download-btn">PDF</a>
                </div>
              </div>
            ` : ''}

            <!-- Abstract (only if no ProseMirror content, since ProseMirror includes it) -->
            ${!article.content_prosemirror && article.abstract ? `
              <section class="article-abstract">
                <h2 class="content-section-title">Abstract</h2>
                <div class="abstract-content">
                  ${this.escapeHtml(article.abstract)}
                </div>
              </section>
            ` : ''}

            <!-- Full Article Content (ProseMirror includes all sections with headings) -->
            ${article.content_prosemirror ? `
              <div id="prosemirror-content-${article.slug}" class="prosemirror-rendered">
                <p class="loading-text">Loading article content...</p>
              </div>
            ` : (article.content_text && article.content_text !== article.description) ? `
              <section class="article-content-section">
                <h2 class="content-section-title">Full Text</h2>
                <div class="article-text-content">
                  ${this.formatContent(article.content_text)}
                </div>
              </section>
            ` : ''}

            <!-- Author Details (with affiliations) -->
            ${article.authors && article.authors.length > 0 && article.authors.some(a => a.affiliation) ? `
              <section class="author-details-section">
                <h2 class="content-section-title">Author Information</h2>
                <div class="author-details-list">
                  ${article.authors.filter(author => author.name).map(author => `
                    ${author.affiliation ? `
                      <div class="author-detail-item">
                        <div class="author-detail-name">${this.escapeHtml(author.name)}${author.is_corresponding ? ' <sup>✉</sup>' : ''}</div>
                        <div class="author-detail-affiliation">${this.escapeHtml(author.affiliation)}</div>
                        ${author.orcid ? `
                          <div class="author-detail-orcid">
                            <a href="https://orcid.org/${author.orcid}" target="_blank" class="orcid-link">ORCID: ${author.orcid}</a>
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}
                  `).join('')}
                </div>
              </section>
            ` : ''}

            <!-- Keywords -->
            ${article.keywords && article.keywords.length > 0 ? `
              <section class="keywords-section">
                <h3 class="subsection-title">Keywords</h3>
                <div class="keyword-tags">
                  ${article.keywords.map(kw => `
                    <span class="keyword-badge">${this.escapeHtml(kw)}</span>
                  `).join(' ')}
                </div>
              </section>
            ` : ''}

            <!-- Collections -->
            ${article.collections && article.collections.length > 0 ? `
              <section class="collections-section">
                <h3 class="subsection-title">Collections</h3>
                <div class="collection-tags">
                  ${article.collections.map(col => `
                    <span class="collection-badge">${this.escapeHtml(col)}</span>
                  `).join(' ')}
                </div>
              </section>
            ` : ''}

            <!-- Attachments -->
            ${article.attachments_json ? `
              <section class="attachments-section">
                <h3 class="subsection-title">Attachments</h3>
                <div class="attachments-list">
                  ${JSON.parse(article.attachments_json).map(attachment => `
                    <div class="attachment-item">
                      <a href="${attachment.url}" target="_blank" class="attachment-link">
                        📎 ${this.escapeHtml(attachment.filename || attachment.title || 'Download')}
                      </a>
                      ${attachment.type ? `<span class="attachment-type">(${attachment.type})</span>` : ''}
                    </div>
                  `).join('')}
                </div>
              </section>
            ` : ''}

          </div>
        </div>

        ${this.renderLicenseSection()}
        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Render authors list
   */
  renderAuthors(authors) {
    if (!authors || authors.length === 0) {
      return '<p class="no-authors">No author information available</p>';
    }

    return authors.map(author => `
      <div class="author-card">
        <div class="author-name">
          ${this.escapeHtml(author.name)}
          ${author.is_corresponding ? '<span class="corresponding-badge">✉️</span>' : ''}
        </div>
        ${author.affiliation ? `
          <div class="author-affiliation">${this.escapeHtml(author.affiliation)}</div>
        ` : ''}
        ${author.orcid ? `
          <div class="author-orcid">
            <a href="https://orcid.org/${author.orcid}" target="_blank">
              ORCID: ${author.orcid}
            </a>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  /**
   * Format content text (preserve paragraphs)
   */
  formatContent(text) {
    if (!text) return '';

    // Split by double newlines for paragraphs
    const paragraphs = text.split(/\n\n+/);

    return paragraphs
      .map(para => `<p>${this.escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  /**
   * Render CC BY-NC-ND 4.0 license section
   */
  renderLicenseSection() {
    return `
      <section class="article-license-section">
        <div class="license-bar">
          <div class="license-left">
            <img src="/cc-by-nc-nd.svg" alt="CC BY-NC-ND 4.0" class="license-icon" />
            <span class="license-text">Licensed under CC BY-NC-ND 4.0</span>
          </div>
          <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer" class="license-learn-more">
            Learn More →
          </a>
        </div>
      </section>
    `;
  }

  /**
   * Render not found state
   */
  renderNotFound(slug) {
    // Note: Page title is already set in render() method before this is called
    return `
      <div class="article-detail">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <div class="error-container">
          <div class="container">
            <h2>Article Not Found</h2>
            <p>The article "<strong>${this.escapeHtml(slug)}</strong>" could not be found in the archive.</p>
            <button onclick="window.router.goHome()" class="back-button">
              ← Back to Homepage
            </button>
          </div>
        </div>

        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError(message, slug) {
    // Set page title for error state
    document.title = `Error - CrimRXiv Archive`;

    return `
      <div class="article-detail">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <div class="error-container">
          <div class="container">
            <h2>Error Loading Article</h2>
            <p>Failed to load article "${this.escapeHtml(slug)}"</p>
            <p class="error-message">${this.escapeHtml(message)}</p>
            <div class="error-actions">
              <button onclick="location.reload()" class="retry-button">Retry</button>
              <button onclick="window.router.goHome()" class="back-button">← Back to Homepage</button>
            </div>
          </div>
        </div>

        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Render ProseMirror content after DOM is ready
   */
  renderProseMirrorContent(slug, prosemirrorJson) {
    try {
      console.log(`🔧 Starting ProseMirror rendering for ${slug}`);

      // Parse JSON string from database
      const contentData = JSON.parse(prosemirrorJson);
      console.log('📄 Content data loaded:', contentData ? 'SUCCESS' : 'FAILED');
      console.log('📄 Content has', contentData?.content?.length || 0, 'top-level nodes');

      const containerEl = document.getElementById(`prosemirror-content-${slug}`);
      console.log('📦 Container element:', containerEl ? 'FOUND' : 'NOT FOUND');

      if (!containerEl) {
        console.error('❌ Cannot render: container element not found');
        return;
      }

      if (!contentData) {
        console.error('❌ Cannot render: no content data');
        return;
      }

      // Convert ProseMirror JSON to HTML
      const html = this.convertProseMirrorToHtmlSimple(contentData);
      console.log('🎨 Generated HTML length:', html.length, 'characters');
      console.log('🎨 HTML preview:', html.substring(0, 200));

      containerEl.innerHTML = html;
      console.log('✅ ProseMirror content rendered from database');
    } catch (error) {
      console.error('❌ Failed to render ProseMirror from database:', error);
      console.error('Error details:', error.stack);

      const containerEl = document.getElementById(`prosemirror-content-${slug}`);
      if (containerEl) {
        containerEl.innerHTML = '<p class="error">Failed to render article content</p>';
      }
    }
  }

  /**
   * Simple ProseMirror to HTML converter
   */
  convertProseMirrorToHtmlSimple(doc) {
    if (!doc || !doc.content) return '';

    const renderNode = (node) => {
      if (!node) return '';

      const type = node.type;
      const attrs = node.attrs || {};
      const content = node.content || [];

      const renderChildren = (children) => {
        if (!children || children.length === 0) return '';
        return children.map(child => renderNode(child)).join('');
      };

      switch (type) {
        case 'heading':
          const level = attrs.level || 1;
          return `<h${level}>${renderChildren(content)}</h${level}>`;

        case 'paragraph':
          return `<p>${renderChildren(content)}</p>`;

        case 'blockquote':
          return `<blockquote>${renderChildren(content)}</blockquote>`;

        case 'code_block':
          const code = content.map(n => n.text || '').join('');
          return `<pre><code>${this.escapeHtml(code)}</code></pre>`;

        case 'ordered_list':
          return `<ol>${renderChildren(content)}</ol>`;

        case 'bullet_list':
          return `<ul>${renderChildren(content)}</ul>`;

        case 'list_item':
          return `<li>${renderChildren(content)}</li>`;

        case 'horizontal_rule':
          return '<hr />';

        case 'hard_break':
          return '<br />';

        case 'text':
          let text = this.escapeHtml(node.text || '');
          if (node.marks && node.marks.length > 0) {
            for (const mark of node.marks) {
              switch (mark.type) {
                case 'strong':
                  text = `<strong>${text}</strong>`;
                  break;
                case 'em':
                  text = `<em>${text}</em>`;
                  break;
                case 'code':
                  text = `<code>${text}</code>`;
                  break;
                case 'link':
                  const href = mark.attrs?.href || '#';
                  text = `<a href="${this.escapeHtml(href)}" target="_blank">${text}</a>`;
                  break;
                case 'subscript':
                  text = `<sub>${text}</sub>`;
                  break;
                case 'superscript':
                  text = `<sup>${text}</sup>`;
                  break;
              }
            }
          }
          return text;

        case 'image':
          const src = attrs.src || '';
          const alt = attrs.alt || '';
          const title = attrs.title || '';
          return `<figure><img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(alt)}" />${title ? `<figcaption>${this.escapeHtml(title)}</figcaption>` : ''}</figure>`;

        case 'table':
          return `<table>${renderChildren(content)}</table>`;

        case 'table_row':
          return `<tr>${renderChildren(content)}</tr>`;

        case 'table_header':
          return `<th>${renderChildren(content)}</th>`;

        case 'table_cell':
          return `<td>${renderChildren(content)}</td>`;

        default:
          return renderChildren(content);
      }
    };

    let html = '';
    for (const node of doc.content) {
      html += renderNode(node);
    }
    return html;
  }

  /**
   * Render Creative Commons license badge
   */
  renderLicenseBadge(licenseSlug) {
    if (!licenseSlug) return '';

    // Parse license slug to determine CC license type
    // Common formats: "cc-by-4.0", "cc-by-nc-4.0", "cc-by-nc-nd-4.0", "cc-by-sa-4.0"
    const licenseLower = licenseSlug.toLowerCase();

    let licenseUrl = '';
    let licenseName = '';

    if (licenseLower.includes('cc-by-nc-nd')) {
      licenseUrl = 'https://creativecommons.org/licenses/by-nc-nd/4.0/';
      licenseName = 'CC BY-NC-ND 4.0';
    } else if (licenseLower.includes('cc-by-nc-sa')) {
      licenseUrl = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';
      licenseName = 'CC BY-NC-SA 4.0';
    } else if (licenseLower.includes('cc-by-nc')) {
      licenseUrl = 'https://creativecommons.org/licenses/by-nc/4.0/';
      licenseName = 'CC BY-NC 4.0';
    } else if (licenseLower.includes('cc-by-sa')) {
      licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/';
      licenseName = 'CC BY-SA 4.0';
    } else if (licenseLower.includes('cc-by-nd')) {
      licenseUrl = 'https://creativecommons.org/licenses/by-nd/4.0/';
      licenseName = 'CC BY-ND 4.0';
    } else if (licenseLower.includes('cc-by')) {
      licenseUrl = 'https://creativecommons.org/licenses/by/4.0/';
      licenseName = 'CC BY 4.0';
    } else if (licenseLower.includes('cc0')) {
      licenseUrl = 'https://creativecommons.org/publicdomain/zero/1.0/';
      licenseName = 'CC0 1.0';
    } else {
      // Fallback for unknown license
      return `<span class="license-text">${this.escapeHtml(licenseSlug)}</span>`;
    }

    return `
      <a href="${licenseUrl}" target="_blank" class="license-link" title="${licenseName}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle; margin-right: 4px;">
          <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="2"/>
          <path d="M12 7v2M12 15v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <circle cx="12" cy="10.5" r="0.5" fill="currentColor"/>
          <circle cx="12" cy="17.5" r="0.5" fill="currentColor"/>
        </svg>
        ${licenseName}
      </a>
    `;
  }

  /**
   * Render external publications (version-of relationships)
   */
  renderExternalPublications(externalPublicationsJson) {
    if (!externalPublicationsJson) return '';

    try {
      const externalPubs = JSON.parse(externalPublicationsJson);

      if (!externalPubs || externalPubs.length === 0) {
        return '';
      }

      // Map relation types to friendly labels
      const relationLabels = {
        'version': 'Also Available On',
        'supplement': 'Supplementary Material',
        'related': 'Related Publication'
      };

      // Extract platform name from URL if available (future enhancement)
      const getPlatformName = (url) => {
        if (!url) return 'External Platform';
        if (url.includes('researchgate')) return 'ResearchGate';
        if (url.includes('arxiv')) return 'arXiv';
        if (url.includes('osf.io')) return 'OSF';
        if (url.includes('figshare')) return 'Figshare';
        return 'External Platform';
      };

      return `
        <div class="external-publications-section">
          <h3 class="external-pubs-title">${relationLabels[externalPubs[0].relationType] || 'External Publications'}</h3>
          <div class="external-pubs-list">
            ${externalPubs.map(pub => {
              // For now, we only have edge metadata. When we fetch full details, we'll show title and URL
              if (pub.url) {
                // Full details available
                const platform = getPlatformName(pub.url);
                return `
                  <a href="${pub.url}" target="_blank" class="external-pub-badge">
                    <span class="external-pub-platform">${this.escapeHtml(platform)}</span>
                    <span class="external-pub-arrow">→</span>
                  </a>
                `;
              } else {
                // Only edge metadata available (placeholder)
                return `
                  <div class="external-pub-badge external-pub-placeholder" title="External publication reference (details pending)">
                    <span class="external-pub-platform">External Version</span>
                    <span class="external-pub-info">(ID: ${pub.externalPublicationId?.substring(0, 8)}...)</span>
                  </div>
                `;
              }
            }).join('')}
          </div>
        </div>
        <style>
          .external-publications-section {
            margin: 1.5rem 0;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #1976d2;
          }

          .external-pubs-title {
            font-size: 1rem;
            font-weight: 600;
            margin: 0 0 0.75rem 0;
            color: #333;
          }

          .external-pubs-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
          }

          .external-pub-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            text-decoration: none;
            color: #1976d2;
            font-weight: 500;
            transition: all 0.2s ease;
          }

          .external-pub-badge:hover {
            background: #e3f2fd;
            border-color: #1976d2;
            transform: translateX(2px);
          }

          .external-pub-badge.external-pub-placeholder {
            cursor: default;
            color: #6c757d;
            opacity: 0.7;
          }

          .external-pub-badge.external-pub-placeholder:hover {
            background: white;
            border-color: #dee2e6;
            transform: none;
          }

          .external-pub-platform {
            font-size: 0.95rem;
          }

          .external-pub-info {
            font-size: 0.85rem;
            color: #6c757d;
          }

          .external-pub-arrow {
            font-size: 1.2rem;
            font-weight: bold;
          }

          @media (max-width: 767px) {
            .external-publications-section {
              margin: 1rem 0;
              padding: 0.75rem;
            }

            .external-pub-badge {
              padding: 0.4rem 0.75rem;
              font-size: 0.9rem;
            }
          }
        </style>
      `;
    } catch (error) {
      console.error('Failed to parse external publications:', error);
      return '';
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
