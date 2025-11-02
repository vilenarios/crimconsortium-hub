/**
 * Consortium Component
 *
 * Displays CrimRXiv Consortium members and information
 */

export class Consortium {
  constructor(db, router) {
    this.db = db;
    this.router = router;

    // Consortium members from crimrxiv.com/consortium
    this.members = [
      { name: 'University of Manchester, Department of Criminology', slug: 'university-of-manchester-criminology', patterns: ['University of Manchester'] },
      { name: 'University of Manchester, Office for Open Research', slug: 'university-of-manchester-open-research', patterns: ['University of Manchester'] },
      { name: 'Knowledge Futures', slug: 'knowledge-futures', patterns: ['Knowledge Futures'] },
      { name: 'Academy of Criminal Justice Sciences', slug: 'academy-criminal-justice-sciences', patterns: ['Academy of Criminal Justice Sciences', 'ACJS'] },
      { name: 'Criminology: An Interdisciplinary Journal', slug: 'criminology-journal', patterns: ['Criminology: An Interdisciplinary Journal'] },
      { name: 'Georgia State University, Evidence-Based Cybersecurity Research Group', slug: 'georgia-state-university', patterns: ['Georgia State University'] },
      { name: 'Ghent University, Department of Criminology', slug: 'ghent-university', patterns: ['Ghent University', 'Universiteit Gent'] },
      { name: 'Hawai\'i Crime Lab', slug: 'hawaii-crime-lab', patterns: ['Hawaii Crime Lab', 'Hawai\'i Crime Lab'] },
      { name: 'John Jay College of Criminal Justice, Research & Evaluation Center', slug: 'john-jay-college', patterns: ['John Jay College'] },
      { name: 'Journal of Historical Criminology', slug: 'journal-historical-criminology', patterns: ['Journal of Historical Criminology', 'ASC Historical Criminology'] },
      { name: 'Max Planck Institute for the Study of Crime, Security & Law', slug: 'max-planck-institute', patterns: ['Max Planck Institute'] },
      { name: 'Northeastern University, School of Criminology & Criminal Justice', slug: 'northeastern-university', patterns: ['Northeastern University'] },
      { name: 'Oral History of Criminology Project', slug: 'oral-history-criminology', patterns: ['Oral History of Criminology'] },
      { name: 'Philadelphia District Attorney\'s Office, DATA Lab', slug: 'philadelphia-da-office', patterns: ['Philadelphia District Attorney', 'Philadelphia DA'] },
      { name: 'Simon Fraser University, School of Criminology', slug: 'simon-fraser-university', patterns: ['Simon Fraser University'] },
      { name: 'Sociedad Española de Investigación Criminológica', slug: 'sociedad-espanola', patterns: ['Sociedad Española de Investigación Criminológica', 'SEIC'] },
      { name: 'Society of Evidence Based Policing', slug: 'society-evidence-based-policing', patterns: ['Society of Evidence Based Policing', 'SEBP'] },
      { name: 'South Asian Society of Criminology and Victimology', slug: 'south-asian-society', patterns: ['South Asian Society of Criminology'] },
      { name: 'Temple University, Department of Criminal Justice', slug: 'temple-university', patterns: ['Temple University'] },
      { name: 'UC Irvine, Department of Criminology, Law and Society', slug: 'uc-irvine', patterns: ['UC Irvine', 'University of California, Irvine'] },
      { name: 'UCL, Bentham Project', slug: 'ucl-bentham', patterns: ['UCL', 'University College London'] },
      { name: 'Université de Montréal, École de Criminologie', slug: 'universite-montreal', patterns: ['Université de Montréal', 'University of Montreal'] },
      { name: 'University of Cambridge, Institute of Criminology, Prisons Research Centre', slug: 'university-of-cambridge', patterns: ['University of Cambridge', 'Cambridge'] },
      { name: 'University of Georgia, Department of Sociology', slug: 'university-of-georgia', patterns: ['University of Georgia'] },
      { name: 'University of Leeds, Centre for Criminal Justice Studies', slug: 'university-of-leeds', patterns: ['University of Leeds'] },
      { name: 'University of Liverpool, Department of Sociology, Social Policy and Criminology', slug: 'university-of-liverpool', patterns: ['University of Liverpool'] },
      { name: 'University of Missouri—St. Louis, Department of Criminology & Criminal Justice', slug: 'university-of-missouri-st-louis', patterns: ['University of Missouri', 'Missouri.*St. Louis', 'UMSL'] },
      { name: 'University of Nebraska Omaha, School of Criminology & Criminal Justice', slug: 'university-of-nebraska-omaha', patterns: ['University of Nebraska Omaha', 'UNO'] },
      { name: 'University of South Carolina, Department of Criminology and Criminal Justice', slug: 'university-of-south-carolina', patterns: ['University of South Carolina', 'USC'] },
      { name: 'University of Texas at Dallas, Criminology & Criminal Justice', slug: 'university-of-texas-dallas', patterns: ['University of Texas at Dallas', 'UT Dallas'] },
      { name: 'University of Waikato, Te Puna Haumaru New Zealand Institute for Security & Crime Science', slug: 'university-of-waikato', patterns: ['University of Waikato'] },
    ];
  }

  /**
   * Render consortium page
   */
  async render() {
    return `
      <div class="consortium-page">
        ${this.renderHeader()}
        ${this.renderNavigation()}

        <!-- Hero Section -->
        <section class="hero-section">
          <div class="container">
            <div class="hero-content">
              <h1 class="hero-title">CrimRXiv Consortium</h1>
              <p class="hero-description">
                Leaders, providers, and supporters of open criminology.
              </p>
            </div>
          </div>
        </section>

        <!-- Description Section -->
        <section class="consortium-description">
          <div class="container">
            <div class="description-content">
              <p class="description-text">
                <strong>CrimRxiv is open access. It'll always be free to authors and readers. This is a communal effort.</strong>
                Our membership program, CrimRxiv Consortium, is a utilitarian way to collaboratively advance our missions and the greater good.
              </p>

              <div class="consortium-actions">
                <p class="action-text">
                  <strong>For free, <a href="https://app.joinit.com/o/crimconsortium/" target="_blank" class="action-link">join us here</a>.</strong>
                  To discuss institutional membership, email
                  <a href="mailto:consortium@crimrxiv.com" class="action-link">consortium@crimrxiv.com</a>.
                </p>
              </div>

              <div class="consortium-social">
                <p class="social-text">
                  <strong>Follow us on</strong>
                  <a href="https://twitter.com/crimconsortium" target="_blank" class="social-link">X</a>,
                  <a href="https://www.linkedin.com/company/crimrxiv-consortium" target="_blank" class="social-link">LinkedIn</a>, and
                  <a href="https://bsky.app/profile/crimrxiv.com" target="_blank" class="social-link">BlueSky</a>.
                </p>
                <p class="social-text">
                  <strong>Hear our podcasts on</strong>
                  <a href="https://odysee.com/@crimconsortium:1" target="_blank" class="social-link">Odysee</a>.
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Members Section -->
        <section class="members-section">
          <div class="container">
            <div class="section-header">
              <h2 class="section-title">Consortium Members</h2>
              <span class="section-count">${this.members.length}+ institutions</span>
            </div>

            <div class="members-list">
              ${this.members.map(member => this.renderMember(member)).join('')}
            </div>

            <div class="members-note">
              <p>
                <strong>Note:</strong> This archive is currently displaying a subset of consortium members.
                Visit <a href="https://www.crimrxiv.com/consortium" target="_blank">crimrxiv.com/consortium</a>
                for the complete and up-to-date list of all consortium members.
              </p>
            </div>
          </div>
        </section>

        ${this.renderFooter()}
      </div>
    `;
  }

  /**
   * Render individual member
   */
  renderMember(member) {
    return `
      <a href="#/member/${member.slug}" class="member-item">
        <div class="member-content">
          <h3 class="member-name">${this.escapeHtml(member.name)}</h3>
          <p class="member-view-link">View publications →</p>
        </div>
      </a>
    `;
  }

  /**
   * Get member by slug
   */
  getMemberBySlug(slug) {
    return this.members.find(m => m.slug === slug);
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
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
