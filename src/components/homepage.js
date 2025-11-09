/**
 * Homepage Component
 *
 * Displays:
 * - Hero section with stats
 * - Consortium description
 * - 25 most recent publications
 *
 * NOTE: Header/Nav/Footer are now in index.html (always visible)
 */

export class Homepage {
  constructor(db, router) {
    this.db = db;
    this.router = router;
  }

  /**
   * Render homepage
   */
  async render() {
    try {
      // Return static content immediately, then load data
      const staticHtml = this.renderStaticContent();

      // Load data asynchronously and update the page
      this.loadDynamicContent();

      return staticHtml;
    } catch (error) {
      console.error('❌ Homepage render error:', error);
      return this.renderError(error.message);
    }
  }

  /**
   * Load dynamic content (stats and articles) and update the page
   */
  async loadDynamicContent() {
    try {
      // Fetch more articles initially (100) for load more functionality
      const [articles, stats] = await Promise.all([
        this.db.getRecentArticles(100),
        this.db.getStats()
      ]);

      // Update stats section
      const statsContainer = document.getElementById('stats-container');
      if (statsContainer) {
        statsContainer.innerHTML = this.renderStats(stats);
      }

      // Update publications section
      const publicationsContainer = document.getElementById('publications-container');
      if (publicationsContainer) {
        publicationsContainer.innerHTML = this.renderPublications(articles);
      }

      // Attach event listeners after render
      setTimeout(() => this.attachEventListeners(articles.length), 0);
    } catch (error) {
      console.error('❌ Homepage dynamic content error:', error);
      const statsContainer = document.getElementById('stats-container');
      const publicationsContainer = document.getElementById('publications-container');
      if (statsContainer) statsContainer.innerHTML = '<p>Error loading stats</p>';
      if (publicationsContainer) publicationsContainer.innerHTML = '<p>Error loading publications</p>';
    }
  }

  /**
   * Attach event listeners for interactive elements
   */
  attachEventListeners(totalArticles) {
    // Initially hide articles beyond the first 25
    let visibleCount = 25;
    const articleCards = document.querySelectorAll('.article-card');

    articleCards.forEach((card, index) => {
      if (index >= visibleCount) {
        card.style.display = 'none';
      }
    });

    // Attach load more button handler
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.onclick = () => {
        const newVisibleCount = Math.min(visibleCount + 25, totalArticles);

        for (let i = visibleCount; i < newVisibleCount; i++) {
          if (articleCards[i]) {
            articleCards[i].style.display = 'block';
          }
        }

        visibleCount = newVisibleCount;
        document.getElementById('visible-count').textContent = visibleCount;

        // Hide button if all loaded
        if (visibleCount >= totalArticles) {
          loadMoreBtn.style.display = 'none';
        }
      };
    }
  }

  /**
   * Render dynamic content placeholders (static content is in index.html)
   */
  renderStaticContent() {
    return `
      <!-- Stats Section - Placeholder (loads below) -->
      <div id="stats-container">
        <section class="stats-section">
          <div class="container">
            <div class="loading-message">Loading statistics...</div>
          </div>
        </section>
      </div>

      <!-- Publications Section - Placeholder (loads below) -->
      <div id="publications-container">
        <section class="publications-section">
          <div class="container">
            <div class="loading-message">Loading recent publications...</div>
          </div>
        </section>
      </div>
    `;
  }

  /**
   * Render stats section
   */
  renderStats(stats) {
    return `
      <section class="stats-section">
        <div class="container">
          <div class="stats-row">
            <div class="stat-item">
              <div class="stat-number">${stats.total_articles?.toLocaleString() || '0'}</div>
              <div class="stat-label">Publications</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${new Date().getFullYear() - 2020}</div>
              <div class="stat-label">Years Active</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Render publications section
   */
  renderPublications(articles) {
    return `
      <section class="publications-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title">Recent Publications</h2>
            <span class="section-count"><span id="visible-count">25</span> of ${articles.length}</span>
          </div>
          <div class="articles-list" id="articles-list">
            ${articles.map((article, index) => this.renderArticleCard(article, index)).join('')}
          </div>
          ${articles.length > 25 ? `
            <div class="load-more-container">
              <button id="load-more-btn" class="load-more-button">
                Load More Publications
              </button>
            </div>
          ` : ''}
        </div>
      </section>
    `;
  }

  /**
   * Render article card
   */
  renderArticleCard(article, index) {
    const publishDate = article.published_at
      ? new Date(article.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Date unknown';

    const validAuthors = article.authors?.filter(a => a.name) || [];
    const authors = validAuthors.length > 0
      ? validAuthors.map(a => a.name).join(', ')
      : 'Unknown authors';

    return `
      <article class="article-card" data-index="${index}">
        <div class="article-card-content">
          <h3 class="article-title">
            <a href="#/article/${article.slug}" class="article-link">
              ${this.escapeHtml(article.title)}
            </a>
          </h3>
          <div class="article-meta">
            <div class="article-authors">${this.escapeHtml(authors)}</div>
            <div class="article-date">Published: ${publishDate}</div>
          </div>
          ${article.abstract_preview ? `
            <p class="article-abstract">${this.escapeHtml(article.abstract_preview)}</p>
          ` : ''}
        </div>
      </article>
    `;
  }

  /**
   * Render error state
   */
  renderError(message) {
    return `
      <div class="error-container">
        <h2>Error Loading Homepage</h2>
        <p>${this.escapeHtml(message)}</p>
        <button onclick="location.reload()">Reload Page</button>
      </div>
    `;
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
