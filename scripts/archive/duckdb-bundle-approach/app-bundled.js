/**
 * CrimRxiv Archive App
 *
 * Main application entry point. Initializes DuckDB-WASM and manages routing.
 */

import { ParquetDB } from './lib/parquet-db.js';
import { Router } from './lib/router.js';
import { Homepage } from './components/homepage.js';
import { ArticleDetail } from './components/article-detail.js';
import { ArticlesBrowse } from './components/articles-browse.js';
import { Search } from './components/search.js';
import { Consortium } from './components/consortium.js';
import { MemberDetail } from './components/member-detail.js';

export class CrimRxivApp {
  constructor() {
    this.db = null;
    this.router = null;
    this.components = {
      homepage: null,
      articleDetail: null,
      articlesBrowse: null,
      search: null,
      consortium: null,
      memberDetail: null
    };
    this.appContainer = null;
  }

  /**
   * Initialize application
   */
  async initialize() {
    try {
      console.log('🚀 Initializing CrimRxiv Archive...');

      // Get app container
      this.appContainer = document.getElementById('app');
      if (!this.appContainer) {
        throw new Error('App container not found');
      }

      // Loading screen is already in HTML, just ensure it's visible
      // No need to call showLoadingScreen()

      // Initialize database
      console.log('📦 Initializing database...');
      this.db = new ParquetDB();
      await this.db.initialize();
      console.log('✅ Database ready');

      // Initialize router first (components will get it via this)
      this.router = new Router(this);

      // Initialize components (they can now reference this.router via the app)
      this.components.homepage = new Homepage(this.db, this.router);
      this.components.articleDetail = new ArticleDetail(this.db, this.router);
      this.components.articlesBrowse = new ArticlesBrowse(this.db, this.router);
      this.components.search = new Search(this.db, this.router);
      this.components.consortium = new Consortium(this.db, this.router);
      this.components.memberDetail = new MemberDetail(this.db, this.router, this.components.consortium);

      // Expose router globally for onclick handlers
      window.router = this.router;

      // Initialize navigation search
      this.initializeNavSearch();

      console.log('✅ CrimRxiv Archive initialized');

      // Manually trigger initial route (since 'load' event already fired)
      await this.router.handleRoute();
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      this.showError('Failed to initialize application: ' + error.message);
    }
  }

  /**
   * Show homepage
   */
  async showHomepage() {
    try {
      const html = await this.components.homepage.render();
      this.updateView(html);
      this.updatePageTitle('CrimRxiv Archive');
    } catch (error) {
      console.error('❌ Homepage error:', error);
      this.showError(error.message);
    }
  }

  /**
   * Show article detail
   */
  async showArticle(slug) {
    try {
      // Show loading indicator
      this.showLoadingIndicator();

      const html = await this.components.articleDetail.render(slug);
      this.updateView(html);
      this.updatePageTitle(`${slug} - CrimRxiv Archive`);
    } catch (error) {
      console.error(`❌ Article error for ${slug}:`, error);
      this.showError(error.message);
    }
  }

  /**
   * Show articles browse page (filtered)
   */
  async showArticlesBrowse(filterType = 'all') {
    try {
      // Show loading indicator
      this.showLoadingIndicator();

      const html = await this.components.articlesBrowse.render(filterType);
      this.updateView(html);

      const titles = {
        'all': 'All Publications',
        'preprints': 'Preprints + Working Papers',
        'postprints': 'Postprints + Versions of Record'
      };
      this.updatePageTitle(`${titles[filterType] || 'Articles'} - CrimRxiv Archive`);
    } catch (error) {
      console.error(`❌ Articles browse error for ${filterType}:`, error);
      this.showError(error.message);
    }
  }

  /**
   * Show search results
   */
  async showSearch(query) {
    try {
      // Show loading indicator
      this.showLoadingIndicator();

      const html = await this.components.search.render(query);
      this.updateView(html);
      this.updatePageTitle(`Search: ${query} - CrimRxiv Archive`);
    } catch (error) {
      console.error(`❌ Search error for "${query}":`, error);
      this.showError(error.message);
    }
  }

  /**
   * Show consortium page
   */
  async showConsortium() {
    try {
      const html = await this.components.consortium.render();
      this.updateView(html);
      this.updatePageTitle('Consortium Members - CrimRxiv Archive');
    } catch (error) {
      console.error('❌ Consortium page error:', error);
      this.showError(error.message);
    }
  }

  /**
   * Show member detail page
   */
  async showMember(memberSlug) {
    try {
      // Show loading indicator
      this.showLoadingIndicator();

      const html = await this.components.memberDetail.render(memberSlug);
      this.updateView(html);
      this.updatePageTitle(`${memberSlug} Publications - CrimRxiv Archive`);
    } catch (error) {
      console.error(`❌ Member error for ${memberSlug}:`, error);
      this.showError(error.message);
    }
  }

  /**
   * Update view with new HTML
   */
  updateView(html) {
    this.appContainer.innerHTML = html;
    window.scrollTo(0, 0);
  }

  /**
   * Update page title
   */
  updatePageTitle(title) {
    document.title = title;
  }

  /**
   * Show loading screen (initial app load)
   * Note: Loading screen is now in index.html, so this is no longer needed
   * Kept for backward compatibility
   */
  showLoadingScreen() {
    // Loading screen is already in HTML
    // This method is deprecated but kept for compatibility
  }

  /**
   * Hide loading screen
   * Note: We don't hide the loading screen anymore - just replace content
   */
  hideLoadingScreen() {
    // No longer needed - content replacement handles this
  }

  /**
   * Show loading indicator (for navigation)
   */
  showLoadingIndicator() {
    // Add a subtle loading indicator at the top
    const indicator = document.createElement('div');
    indicator.className = 'loading-indicator';
    indicator.id = 'loading-indicator';
    document.body.appendChild(indicator);

    setTimeout(() => {
      const existingIndicator = document.getElementById('loading-indicator');
      if (existingIndicator) {
        existingIndicator.remove();
      }
    }, 3000); // Auto-remove after 3 seconds
  }

  /**
   * Show error message
   */
  showError(message) {
    this.appContainer.innerHTML = `
      <div class="error-screen">
        <div class="error-content">
          <h1>⚠️ Error</h1>
          <p class="error-message">${this.escapeHtml(message)}</p>
          <div class="error-actions">
            <button onclick="location.reload()" class="retry-button">
              Reload App
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Initialize navigation search bar
   */
  initializeNavSearch() {
    const searchInput = document.getElementById('nav-search-input');
    const searchButton = document.getElementById('nav-search-button');

    if (!searchInput || !searchButton) {
      console.warn('Nav search elements not found');
      return;
    }

    // Handle search button click
    searchButton.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        this.router.navigate(`/search?q=${encodeURIComponent(query)}`);
      }
    });

    // Handle Enter key in search input
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          this.router.navigate(`/search?q=${encodeURIComponent(query)}`);
        }
      }
    });

    console.log('✅ Navigation search initialized');
  }

  /**
   * Cleanup (called on page unload)
   */
  async cleanup() {
    if (this.db) {
      await this.db.close();
    }
  }
}

