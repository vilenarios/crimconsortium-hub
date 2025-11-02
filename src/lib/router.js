/**
 * Router - Hash-based routing for Arweave compatibility
 *
 * Routes:
 * - #/ or empty -> Homepage
 * - #/article/{slug} -> Article detail
 * - #/search?q={query} -> Search results
 * - #/consortium -> Consortium members page
 * - #/member/{slug} -> Member detail page with publications
 */

export class Router {
  constructor(app) {
    this.app = app;
    this.currentRoute = null;
    this.routes = {
      home: /^#?\/?$/,
      article: /^#?\/article\/([^/]+)\/?$/,
      articles: /^#?\/articles\/([^/]+)\/?$/,
      search: /^#?\/search(\?.*)?$/,
      consortium: /^#?\/consortium\/?$/,
      member: /^#?\/member\/([^/]+)\/?$/
    };

    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  /**
   * Parse current URL hash and route to appropriate component
   */
  async handleRoute() {
    const hash = window.location.hash || '#/';

    try {
      // Homepage
      if (this.routes.home.test(hash)) {
        await this.app.showHomepage();
        this.currentRoute = 'home';
        return;
      }

      // Article detail
      const articleMatch = hash.match(this.routes.article);
      if (articleMatch) {
        const slug = articleMatch[1];
        await this.app.showArticle(slug);
        this.currentRoute = 'article';
        return;
      }

      // Articles browse (filtered list)
      const articlesMatch = hash.match(this.routes.articles);
      if (articlesMatch) {
        const filterType = articlesMatch[1]; // 'all', 'preprints', or 'postprints'
        await this.app.showArticlesBrowse(filterType);
        this.currentRoute = 'articles';
        return;
      }

      // Search
      const searchMatch = hash.match(this.routes.search);
      if (searchMatch) {
        const params = new URLSearchParams(hash.split('?')[1] || '');
        const query = params.get('q') || '';
        await this.app.showSearch(query);
        this.currentRoute = 'search';
        return;
      }

      // Consortium
      if (this.routes.consortium.test(hash)) {
        await this.app.showConsortium();
        this.currentRoute = 'consortium';
        return;
      }

      // Member detail
      const memberMatch = hash.match(this.routes.member);
      if (memberMatch) {
        const memberSlug = memberMatch[1];
        await this.app.showMember(memberSlug);
        this.currentRoute = 'member';
        return;
      }

      // Default to homepage if no match
      await this.app.showHomepage();
      this.currentRoute = 'home';
    } catch (error) {
      console.error('❌ Routing error:', error);
      this.app.showError(error.message);
    }
  }

  /**
   * Navigate to a route
   */
  navigate(path) {
    window.location.hash = path;
  }

  /**
   * Navigate to homepage
   */
  goHome() {
    this.navigate('/');
  }

  /**
   * Navigate to article
   */
  goToArticle(slug) {
    this.navigate(`/article/${slug}`);
  }

  /**
   * Navigate to search
   */
  goToSearch(query) {
    this.navigate(`/search?q=${encodeURIComponent(query)}`);
  }
}
