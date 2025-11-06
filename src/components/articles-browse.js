/**
 * Articles Browse Component
 *
 * Displays:
 * - Filterable list of all publications
 * - Filter by collection type (Preprints, Postprints, or All)
 * - Search within results
 * - Sort options
 */

export class ArticlesBrowse {
  constructor(db, router) {
    this.db = db;
    this.router = router;
    this.filterType = 'all'; // 'all', 'preprints', 'postprints'
  }

  /**
   * Render articles browse page
   */
  async render(filterType = 'all') {
    this.filterType = filterType;

    try {
      // Fetch all articles
      const [allArticles, stats] = await Promise.all([
        this.db.getAllArticles(),
        this.db.getStats()
      ]);

      // Filter articles based on collection type
      let filteredArticles = this.filterArticles(allArticles, filterType);

      // Render content
      const html = this.renderContent(filteredArticles, stats, filterType);

      // Attach event listeners after render
      setTimeout(() => this.attachEventListeners(filteredArticles.length), 0);

      return html;
    } catch (error) {
      console.error('❌ Articles browse render error:', error);
      return this.renderError(error.message);
    }
  }

  /**
   * Filter articles by collection type
   */
  filterArticles(articles, filterType) {
    if (filterType === 'all') return articles;

    return articles.filter(article => {
      if (!article.collections || article.collections.length === 0) return false;

      const collections = article.collections.map(c => c.toLowerCase());

      if (filterType === 'preprints') {
        return collections.some(c => c.includes('preprint') || c.includes('working paper'));
      } else if (filterType === 'postprints') {
        return collections.some(c => c.includes('postprint') || c.includes('version of record'));
      }

      return false;
    });
  }

  /**
   * Attach event listeners for interactive elements
   */
  attachEventListeners(totalArticles) {
    // Initially show first 50 articles
    let visibleCount = 50;
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
        const newVisibleCount = Math.min(visibleCount + 50, totalArticles);

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
   * Render browse page content
   */
  renderContent(articles, stats, filterType) {
    const pageTitle = this.getPageTitle(filterType);
    const pageDescription = this.getPageDescription(filterType);

    return `
      <div class="articles-browse-page">
        <!-- Page Header -->
        <section class="page-header">
          <div class="container">
            <h1 class="page-title">${pageTitle}</h1>
            <p class="page-description">${pageDescription}</p>

            <!-- Filter Tabs -->
            <div class="filter-tabs">
              <a href="#/articles/all" class="filter-tab ${filterType === 'all' ? 'active' : ''}">
                All Articles (${stats.total_articles || 0})
              </a>
              <a href="#/articles/preprints" class="filter-tab ${filterType === 'preprints' ? 'active' : ''}">
                Preprints + Working Papers
              </a>
              <a href="#/articles/postprints" class="filter-tab ${filterType === 'postprints' ? 'active' : ''}">
                Postprints + Versions of Record
              </a>
            </div>
          </div>
        </section>

        <!-- Articles List -->
        <section class="publications-section">
          <div class="container">
            <div class="section-header">
              <h2 class="section-title">Publications</h2>
              <span class="section-count">
                <span id="visible-count">${Math.min(50, articles.length)}</span> of ${articles.length}
              </span>
            </div>

            ${articles.length === 0 ? `
              <div class="no-results">
                <p>No articles found for this filter.</p>
                <p class="help-text">Collection data may not be available yet. Try running <code>npm run import</code> to refresh article metadata.</p>
              </div>
            ` : `
              <div class="articles-list" id="articles-list">
                ${articles.map((article, index) => this.renderArticleCard(article, index)).join('')}
              </div>
              ${articles.length > 50 ? `
                <div class="load-more-container">
                  <button id="load-more-btn" class="load-more-button">
                    Load More Publications
                  </button>
                </div>
              ` : ''}
            `}
          </div>
        </section>
      </div>
    `;
  }

  /**
   * Get page title based on filter
   */
  getPageTitle(filterType) {
    switch (filterType) {
      case 'preprints':
        return 'Preprints + Working Papers';
      case 'postprints':
        return 'Postprints + Versions of Record';
      default:
        return 'All Publications';
    }
  }

  /**
   * Get page description based on filter
   */
  getPageDescription(filterType) {
    switch (filterType) {
      case 'preprints':
        return 'Research papers in progress, inviting feedback from the criminology community.';
      case 'postprints':
        return 'Final submitted versions and published open access articles.';
      default:
        return 'Browse all publications in the CrimRXiv archive.';
    }
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
          ${article.collections && article.collections.length > 0 ? `
            <div class="article-collections">
              ${article.collections.map(col => `
                <span class="collection-tag">${this.escapeHtml(col)}</span>
              `).join('')}
            </div>
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
        <div class="container">
          <h2>Error Loading Articles</h2>
          <p>${this.escapeHtml(message)}</p>
          <button onclick="location.reload()">Reload Page</button>
        </div>
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
