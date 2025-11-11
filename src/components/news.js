/**
 * News Component
 *
 * Displays:
 * - CrimRxiv Consortium news and announcements
 * - Crimversations (article highlights and discussions)
 */

export class News {
  constructor(db, router) {
    this.db = db;
    this.router = router;
  }

  /**
   * Render news page
   */
  async render() {
    try {
      // Fetch news articles (limit to 50 most recent)
      const newsArticles = await this.db.getNewsArticles(50);

      // Render content
      const html = this.renderContent(newsArticles);

      // Attach event listeners after render
      setTimeout(() => this.attachEventListeners(newsArticles.length), 0);

      return html;
    } catch (error) {
      console.error('❌ News render error:', error);
      return this.renderError(error.message);
    }
  }

  /**
   * Attach event listeners for interactive elements
   */
  attachEventListeners(totalArticles) {
    // Initially show first 25 articles
    let visibleCount = 25;
    const articleCards = document.querySelectorAll('.news-card');

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
   * Render news page content
   */
  renderContent(newsArticles) {
    return `
      <div class="news-page">
        <!-- Page Header -->
        <section class="page-header">
          <div class="container">
            <h1 class="page-title">News</h1>
            <p class="page-description">CrimRxiv Consortium updates, partnerships, and featured research discussions (Crimversations).</p>
          </div>
        </section>

        <!-- News List -->
        <section class="publications-section">
          <div class="container">
            <div class="section-header">
              <h2 class="section-title">Latest News</h2>
              <span class="section-count">
                <span id="visible-count">${Math.min(25, newsArticles.length)}</span> of ${newsArticles.length}
              </span>
            </div>

            ${newsArticles.length === 0 ? `
              <div class="no-results">
                <p>No news articles found.</p>
                <p class="help-text">Check back soon for updates from the CrimRxiv Consortium.</p>
              </div>
            ` : `
              <div class="news-list" id="news-list">
                ${newsArticles.map((article, index) => this.renderNewsCard(article, index)).join('')}
              </div>
              ${newsArticles.length > 25 ? `
                <div class="load-more-container">
                  <button id="load-more-btn" class="load-more-button">
                    Load More News
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
   * Render news card
   */
  renderNewsCard(article, index) {
    // Use version_timestamp (latest release date) to match CrimRxiv.com behavior
    const dateToDisplay = article.version_timestamp || article.published_at;
    const publishDate = dateToDisplay
      ? new Date(dateToDisplay).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Date unknown';

    // Determine news type from title
    let newsType = 'News';
    if (article.title.includes('Crimversations')) {
      newsType = 'Crimversations';
    } else if (article.title.includes('Consortium joined')) {
      newsType = 'New Member';
    } else if (article.title.includes('partners with')) {
      newsType = 'Partnership';
    }

    return `
      <article class="news-card" data-index="${index}">
        <div class="news-card-content">
          <div class="news-type-badge">${newsType}</div>
          <h3 class="news-title">
            <a href="#/article/${article.slug}" class="news-link">
              ${this.escapeHtml(article.title)}
            </a>
          </h3>
          <div class="news-meta">
            <span class="news-date">${publishDate}</span>
          </div>
          ${article.abstract_preview ? `
            <p class="news-preview">${this.escapeHtml(article.abstract_preview)}</p>
          ` : ''}
        </div>
      </article>
    `;
  }

  /**
   * Render error message
   */
  renderError(message) {
    return `
      <div class="error-page">
        <div class="container">
          <h1>Error Loading News</h1>
          <p class="error-message">${this.escapeHtml(message)}</p>
          <a href="#/" class="button">Return Home</a>
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
