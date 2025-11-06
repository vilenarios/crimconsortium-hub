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
      // Fetch more articles initially (100) for load more functionality
      const [articles, stats] = await Promise.all([
        this.db.getRecentArticles(100),
        this.db.getStats()
      ]);

      // Render content
      const html = this.renderContent(articles, stats);

      // Attach event listeners after render
      setTimeout(() => this.attachEventListeners(articles.length), 0);

      return html;
    } catch (error) {
      console.error('❌ Homepage render error:', error);
      return this.renderError(error.message);
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
   * Render homepage content (without header/nav/footer - those are in index.html)
   */
  renderContent(articles, stats) {
    return `
      <div class="homepage">
        <!-- Hero Section -->
        <section class="hero-section">
          <div class="container">
            <div class="hero-content">
              <h1 class="hero-title">CrimRXiv Archive</h1>
              <p class="hero-description">
                A permanent, decentralized archive for criminology research from leading academic institutions worldwide.
              </p>

              <!-- Search Bar -->
              <div class="search-container">
                <form class="search-form" onsubmit="event.preventDefault(); window.router.goToSearch(this.querySelector('input').value);">
                  <input
                    type="text"
                    class="search-input"
                    placeholder="Search publications by title, author, or keyword..."
                    name="q"
                  >
                  <button type="submit" class="search-button">Search</button>
                </form>
              </div>

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
          </div>
        </section>

        <!-- Consortium Description -->
        <section class="consortium-description">
          <div class="container">
            <div class="description-content">
              <p class="description-text">
                <strong>CrimRXiv is a permanent open-access archive.</strong> It will always be free for authors and readers.
                This is a collaborative effort by the criminology research community. Our membership program brings together
                leading institutions to advance open science and preserve research permanently on the decentralized web.
                Follow us on <a href="https://linktr.ee/crimconsortium" target="_blank" class="social-link">social media</a>.
              </p>
            </div>
          </div>
        </section>

        <!-- Recent Publications -->
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
      </div>
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
            <span class="article-authors">${this.escapeHtml(authors)}</span>
            <span class="article-date">${publishDate}</span>
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
