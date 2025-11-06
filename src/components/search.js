/**
 * Search Component
 *
 * Displays search results from metadata.parquet.
 * Searches across: title, abstract, keywords, authors
 */

export class Search {
  constructor(db, router) {
    this.db = db;
    this.router = router;
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
   * Render search results page
   */
  async render(query) {
    try {
      // Show loading state
      this.showLoading(query);

      // Perform search
      const results = await this.db.search(query, 100);

      return this.renderResults(query, results);
    } catch (error) {
      console.error(`❌ Search error for "${query}":`, error);
      return this.renderError(error.message, query);
    }
  }

  /**
   * Show loading spinner
   */
  showLoading(query) {
    return `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Searching for "${this.escapeHtml(query)}"...</p>
      </div>
    `;
  }

  /**
   * Render search results
   */
  renderResults(query, results) {
    return `
      <div class="search-results-page">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <!-- Results Section -->
        <section class="results-section">
          <div class="container">
            <div class="results-header">
              <h2 class="results-title">
                ${results.length > 0
                  ? `Found ${results.length} result${results.length !== 1 ? 's' : ''}`
                  : 'No results found'}
              </h2>
              <p class="results-query">
                ${results.length > 0 ? `for` : `matching`} <strong>"${this.escapeHtml(query)}"</strong>
              </p>
            </div>

            ${results.length > 0 ? `
              <div class="search-results-list">
                ${results.map(article => this.renderArticleCard(article, query)).join('')}
              </div>
            ` : `
              <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <h3 class="no-results-title">No Publications Found</h3>
                <p class="no-results-text">
                  We couldn't find any publications matching your search.
                </p>
                <div class="search-suggestions">
                  <h4>Try these search tips:</h4>
                  <ul>
                    <li>Use different keywords or synonyms</li>
                    <li>Check your spelling</li>
                    <li>Use broader, more general terms</li>
                    <li>Search for author names or topics</li>
                    <li>Try searching for a DOI or publication title</li>
                  </ul>
                </div>
                <button onclick="window.router.goHome()" class="back-home-button">
                  ← Browse All Publications
                </button>
              </div>
            `}
          </div>
        </section>

        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Render search bar
   */
  renderSearchBar(currentQuery = '') {
    return `
      <form class="search-form" onsubmit="return handleSearch(event)">
        <input
          type="text"
          id="search-input"
          class="search-input"
          placeholder="Search publications..."
          value="${this.escapeHtml(currentQuery)}"
          autocomplete="off"
          autofocus
        />
        <button type="submit" class="search-button">
          <span class="search-icon">🔍</span>
          Search
        </button>
      </form>
    `;
  }

  /**
   * Render article card with search highlighting
   */
  renderArticleCard(article, query) {
    const title = article.title || 'Untitled';
    const authors = article.authors?.filter(a => a.name).map(a => a.name).join(', ') || 'Unknown Authors';
    const date = article.published_at ?
      new Date(article.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'Date unknown';
    const abstract = article.abstract || article.description || article.abstract_preview || '';
    const abstractPreview = abstract.length > 300 ? abstract.substring(0, 300) + '...' : abstract;

    // Highlight search term (case-insensitive)
    const highlightText = (text) => {
      if (!text || !query) return this.escapeHtml(text);
      const escapedText = this.escapeHtml(text);
      const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
      return escapedText.replace(regex, '<mark>$1</mark>');
    };

    return `
      <article class="search-article-card">
        <div class="article-card-inner" onclick="window.router.goToArticle('${article.slug}')" style="cursor: pointer;">
          <h3 class="article-title">
            <a href="#/article/${article.slug}">${highlightText(title)}</a>
          </h3>

          <div class="article-meta">
            <span class="article-authors">${highlightText(authors)}</span>
            <span class="article-date">${date}</span>
          </div>

          ${abstractPreview ? `
            <p class="article-abstract">${highlightText(abstractPreview)}</p>
          ` : ''}

          ${article.doi ? `
            <div class="article-doi">
              <span class="doi-label">DOI:</span> ${article.doi}
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }

  /**
   * Render error state
   */
  renderError(message, query) {
    return `
      <div class="search-results-page">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <div class="error-container">
          <div class="container">
            <h2>Search Error</h2>
            <p>Failed to search for "${this.escapeHtml(query)}"</p>
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
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
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

  /**
   * Escape regex special characters
   */
  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Handle search form submission (called from global scope)
   */
  static handleSearch(event) {
    event.preventDefault();
    const query = document.getElementById('search-input').value.trim();
    if (query) {
      window.router.goToSearch(query);
    }
    return false;
  }
}

// Export search handler to global scope for inline onclick
window.handleSearch = Search.handleSearch;
