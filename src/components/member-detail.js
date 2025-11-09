/**
 * MemberDetail Component
 *
 * Displays publications for a specific consortium member
 */

export class MemberDetail {
  constructor(db, router, consortium) {
    this.db = db;
    this.router = router;
    this.consortium = consortium;
  }

  /**
   * Render member detail page
   */
  async render(memberSlug) {
    try {
      // Get member info
      const member = this.consortium.getMemberBySlug(memberSlug);

      if (!member) {
        return this.renderNotFound(memberSlug);
      }

      // Check for special member pages (with iframe content)
      if (memberSlug === 'hawaii-crime-lab') {
        return this.renderHawaiiCrimeLab(member);
      }
      if (memberSlug === 'south-asian-society') {
        return this.renderSouthAsianSociety(member);
      }

      // Search for articles by affiliation patterns
      const articles = await this.db.searchByAffiliation(member.patterns);

      return this.renderContent(member, articles);
    } catch (error) {
      console.error(`❌ Member detail error for ${memberSlug}:`, error);
      return this.renderError(error.message, memberSlug);
    }
  }

  /**
   * Render member content with articles
   */
  renderContent(member, articles) {
    return `
      <div class="member-detail-page">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <!-- Member Hero Section -->
        <section class="hero-section">
          <div class="container">
            <div class="hero-content">
              <nav class="breadcrumb-inline">
                <a href="#/consortium" class="breadcrumb-link">Consortium</a>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-current">${this.escapeHtml(member.name)}</span>
              </nav>
              <h1 class="hero-title">${this.escapeHtml(member.name)}</h1>
              <p class="hero-description">
                Consortium member publications in the CrimRxiv Archive
              </p>
              <div class="member-stats">
                <div class="stat-item">
                  <div class="stat-number">${articles.length}</div>
                  <div class="stat-label">Publications</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Publications Section -->
        <section class="publications-section">
          <div class="container">
            ${articles.length > 0 ? `
              <div class="section-header">
                <h2 class="section-title">Publications</h2>
                <span class="section-count">${articles.length} publication${articles.length !== 1 ? 's' : ''}</span>
              </div>
              <div class="articles-list">
                ${articles.map(article => this.renderArticleCard(article)).join('')}
              </div>
            ` : `
              <div class="no-publications">
                <h3>No Publications Found</h3>
                <p>We couldn't find any publications associated with ${this.escapeHtml(member.name)} in our archive yet.</p>
                <button onclick="window.router.navigate('/consortium')" class="back-button">
                  ← Back to Consortium
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
   * Render article card
   */
  renderArticleCard(article) {
    const title = article.title || 'Untitled';
    const authors = article.authors?.filter(a => a.name).map(a => a.name).join(', ') || 'Unknown Authors';
    const date = article.published_at ?
      new Date(article.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'Date unknown';
    const abstractPreview = article.abstract_preview || '';

    return `
      <article class="article-card">
        <h3 class="article-title">
          <a href="#/article/${article.slug}">${this.escapeHtml(title)}</a>
        </h3>
        <div class="article-meta">
          <div class="article-authors">${this.escapeHtml(authors)}</div>
          <div class="article-date">Published: ${date}</div>
        </div>
        ${abstractPreview ? `
          <p class="article-abstract">${this.escapeHtml(abstractPreview)}</p>
        ` : ''}
      </article>
    `;
  }

  /**
   * Render common header
   * NOTE: Header is now in index.html (always visible), so this returns empty
   */
  renderHeader() {
    return '';
  }

  /**
   * Render navigation
   * NOTE: Navigation is now in index.html (always visible), so this returns empty
   */
  renderNavigation() {
    return '';
  }

  /**
   * Render footer
   * NOTE: Footer is now in index.html (always visible), so this returns empty
   */
  renderFooter() {
    return '';
  }

  /**
   * Render Hawai'i Crime Lab special page
   */
  renderHawaiiCrimeLab(member) {
    return `
      <div class="member-detail-page">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <!-- Member Hero Section -->
        <section class="hero-section">
          <div class="container">
            <div class="hero-content">
              <nav class="breadcrumb-inline">
                <a href="#/consortium" class="breadcrumb-link">Consortium</a>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-current">${this.escapeHtml(member.name)}</span>
              </nav>
              <h1 class="hero-title">${this.escapeHtml(member.name)}</h1>
            </div>
          </div>
        </section>

        <!-- About Section -->
        <section class="publications-section">
          <div class="container">
            <div class="member-about">
              <p>
                Hawai'i Crime Lab is a recently established initiative that employs social science to enhance understanding of crime and punishment in The Aloha State. Launched in spring 2025, the lab aims to provide objective, non-partisan analyses to citizens and policymakers. The lab engages in translational criminology, empowering citizens with criminological knowledge, and provides experiential learning for students. It focuses on three main areas: crime rates on O'ahu, criminal sentencing, and penal reform. The lab welcomes community input and inquiries, particularly from journalists and state decision-makers. It aims to answer factual questions based on careful data analysis, distinguishing between questions of fact and policy. While the lab can offer insights on crime deterrence policies, it refrains from taking positions on policy adoption, instead focusing on providing data-driven information to inform decision-making processes.
              </p>
              <div class="member-iframe-container">
                <iframe
                  src="https://hawaiicrimelab.com/"
                  width="100%"
                  height="600"
                  frameborder="0"
                  title="Hawai'i Crime Lab Website"
                ></iframe>
              </div>
            </div>
          </div>
        </section>

        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Render South Asian Society special page
   */
  renderSouthAsianSociety(member) {
    return `
      <div class="member-detail-page">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <!-- Member Hero Section -->
        <section class="hero-section">
          <div class="container">
            <div class="hero-content">
              <nav class="breadcrumb-inline">
                <a href="#/consortium" class="breadcrumb-link">Consortium</a>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-current">${this.escapeHtml(member.name)}</span>
              </nav>
              <h1 class="hero-title">${this.escapeHtml(member.name)}</h1>
            </div>
          </div>
        </section>

        <!-- About Section -->
        <section class="publications-section">
          <div class="container">
            <div class="member-about">
              <p>
                The South Asian Society of Criminology and Victimology (SASCV) advances criminology and victimology in South Asia by developing context-specific solutions to crime prevention and victim support. Through interdisciplinary efforts, SASCV fosters collaboration among scholars, practitioners, and policymakers. It facilitates the exchange of ideas, research findings, and best practices via conferences, workshops, and publications. The result is a network of experts committed to enhancing community safety and well-being across South Asia. Additionally, SASCV advocates for policy changes that reflect the region's needs and realities, striving for a more just and equitable world. The organization encourages diverse stakeholder participation, including academics, law enforcement officials, legal professionals, and non-governmental organizations. Follow them on Twitter <a href="https://twitter.com/sacrimevictims" target="_blank" rel="noopener noreferrer">@sacrimevictims</a>. Below is an iFrame with their website, and you can learn about becoming a member <a href="https://www.sascv.org/index.html" target="_blank" rel="noopener noreferrer">here</a>.
              </p>
              <div class="member-iframe-container">
                <iframe
                  src="https://www.sascv.org/index.html"
                  width="100%"
                  height="600"
                  frameborder="0"
                  title="South Asian Society of Criminology and Victimology Website"
                ></iframe>
              </div>
            </div>
          </div>
        </section>

        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Render not found state
   */
  renderNotFound(memberSlug) {
    return `
      <div class="member-detail-page">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <div class="error-container">
          <div class="container">
            <h2>Member Not Found</h2>
            <p>The consortium member "${this.escapeHtml(memberSlug)}" could not be found.</p>
            <button onclick="window.router.navigate('/consortium')" class="back-button">
              ← Back to Consortium
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
  renderError(message, memberSlug) {
    return `
      <div class="member-detail-page">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <div class="error-container">
          <div class="container">
            <h2>Error Loading Member</h2>
            <p>Failed to load member "${this.escapeHtml(memberSlug)}"</p>
            <p class="error-message">${this.escapeHtml(message)}</p>
            <div class="error-actions">
              <button onclick="location.reload()" class="retry-button">Retry</button>
              <button onclick="window.router.navigate('/consortium')" class="back-button">← Back to Consortium</button>
            </div>
          </div>
        </div>

        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
