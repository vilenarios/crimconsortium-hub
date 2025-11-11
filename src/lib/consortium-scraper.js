/**
 * CrimConsortium Scraper with Fault Tolerance
 * Scrapes crimrxiv.com/consortium using hybrid API/HTML approach
 * Built for reliability and team handoff
 */

import axios from 'axios';
import fs from 'fs-extra';
import { Logger, FileHelper, ProgressTracker, StateManager, withRetry } from './utils.js';

export class ConsortiumScraper {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.stateManager = new StateManager();
    
    this.baseUrl = 'https://www.crimrxiv.com';
    this.apiBaseUrl = 'https://www.crimrxiv.com/api';
    this.consortiumUrl = 'https://www.crimrxiv.com/consortium';
    
    // Scraped data
    this.members = [];
    this.publications = [];
    this.lastScrapedArticles = [];
    
    // Configuration
    this.config = {
      requestDelay: 1000,        // 1 second between requests
      timeout: 30000,            // 30 second timeout
      maxRetries: 3,             // Retry failed requests
      userAgent: 'CrimConsortium-Archive-Bot/1.0 (crimrxiv@manchester.ac.uk)',
      respectRobots: true,       // Follow robots.txt
      maxConcurrent: 3           // Max concurrent requests
    };
    
    // State tracking
    this.state = {
      lastScrape: null,
      totalScraped: 0,
      errors: [],
      rateLimit: {
        requests: 0,
        window: Date.now(),
        maxPerMinute: 30
      }
    };
    
    // Fault tolerance
    this.circuitBreaker = {
      failures: 0,
      threshold: 10,
      timeout: 300000, // 5 minutes
      state: 'closed' // closed, open, half-open
    };
  }

  /**
   * Main scraping function with comprehensive error handling
   */
  async scrapeConsortium() {
    this.logger.info('🕷️ Starting CrimConsortium scraping...');
    
    try {
      await this.stateManager.init();
      await this.loadState();
      
      // Step 1: Check circuit breaker
      if (!this.checkCircuitBreaker()) {
        throw new Error('Circuit breaker is open - too many recent failures');
      }
      
      // Step 2: Check rate limiting
      await this.checkRateLimit();
      
      // Step 3: Try API approach first
      let success = false;
      try {
        await this.scrapeViaAPI();
        success = true;
        this.logger.success('API scraping successful');
      } catch (error) {
        this.logger.warning('API scraping failed, falling back to HTML', error.message);
        this.recordFailure(error);
      }
      
      // Step 4: Fallback to HTML scraping
      if (!success) {
        try {
          await this.scrapeViaHTML();
          success = true;
          this.logger.success('HTML scraping successful');
        } catch (error) {
          this.logger.error('Both API and HTML scraping failed', error.message);
          this.recordFailure(error);
          throw error;
        }
      }
      
      // Step 5: Download article content and PDFs
      if (this.publications.length > 0) {
        await this.downloadPublicationContent();
      }
      
      // Step 6: Save results
      await this.saveResults();
      await this.saveState();
      
      // Step 7: Reset circuit breaker on success
      this.resetCircuitBreaker();
      
      this.logger.success(`Scraping complete: ${this.publications.length} publications from ${this.members.length} members`);
      
      return {
        members: this.members,
        publications: this.publications,
        stats: this.state
      };
      
    } catch (error) {
      this.recordFailure(error);
      await this.saveState();
      throw error;
    }
  }

  /**
   * Attempt to scrape using PubPub API
   */
  async scrapeViaAPI() {
    this.logger.info('🔌 Attempting API-based scraping...');
    
    // Try common PubPub API endpoints
    const apiEndpoints = [
      '/api/pubs',
      '/api/collections',
      '/api/communities/cb6ab371-fc70-4ef3-b2e5-d0d0580b4d37/pubs', // CrimRxiv community ID
      '/api/search'
    ];
    
    for (const endpoint of apiEndpoints) {
      try {
        this.logger.info(`Testing API endpoint: ${endpoint}`);
        
        const response = await this.makeRequest(`${this.apiBaseUrl}${endpoint}`, {
          params: {
            limit: 10,
            offset: 0,
            communityId: 'cb6ab371-fc70-4ef3-b2e5-d0d0580b4d37'
          }
        });
        
        if (response.data && Array.isArray(response.data.pubs || response.data)) {
          this.logger.success(`API endpoint working: ${endpoint}`);
          await this.processAPIData(response.data, endpoint);
          return true;
        }
        
      } catch (error) {
        this.logger.warning(`API endpoint failed: ${endpoint}`, error.response?.status || error.message);
      }
    }
    
    throw new Error('No working API endpoints found');
  }

  /**
   * Process API response data
   */
  async processAPIData(data, endpoint) {
    this.logger.info('⚙️ Processing API data...');
    
    const pubs = data.pubs || data;
    
    if (!Array.isArray(pubs)) {
      throw new Error('API returned invalid data format');
    }
    
    // Filter for consortium-related publications
    const consortiumPubs = pubs.filter(pub => {
      // Check if publication has consortium-related collections
      return pub.collectionPubs && pub.collectionPubs.some(cp => 
        cp.collection && (
          cp.collection.slug.includes('consortium') ||
          cp.collection.title.toLowerCase().includes('consortium') ||
          cp.collection.slug.endsWith('1c') // Consortium member pattern
        )
      );
    });
    
    this.logger.info(`Found ${consortiumPubs.length} consortium publications via API`);
    
    // Process publications
    for (const pub of consortiumPubs) {
      const publication = await this.processPublication(pub);
      if (publication) {
        this.publications.push(publication);
      }
    }
  }

  /**
   * Fallback HTML scraping with fault tolerance
   */
  async scrapeViaHTML() {
    this.logger.info('🌐 Attempting HTML-based scraping...');
    
    // Step 1: Get consortium page content
    const consortiumPage = await this.makeRequest(this.consortiumUrl);
    
    // Step 2: Extract member institutions (we already have this)
    await this.extractMembersFromHTML(consortiumPage.data);
    
    // Step 3: Get recent consortium publications from main page
    const mainPage = await this.makeRequest(this.baseUrl);
    await this.extractRecentPublications(mainPage.data);
    
    // Step 4: Check member-specific pages for additional content
    await this.scrapeMemberPages();
  }

  /**
   * Extract recent consortium publications from main page
   */
  async extractRecentPublications(html) {
    this.logger.info('📰 Extracting recent consortium publications...');
    
    try {
      // Use basic string matching for recent publication patterns
      const pubMatches = html.match(/\/pub\/[a-z0-9]+/g) || [];
      const uniquePubs = [...new Set(pubMatches)];
      
      this.logger.info(`Found ${uniquePubs.length} recent publication links`);
      
      // Fetch details for each publication
      const tracker = new ProgressTracker(uniquePubs.length, 'Fetching publication details');
      
      for (const pubUrl of uniquePubs.slice(0, 50)) { // Limit to recent 50
        try {
          const pubData = await this.fetchPublicationDetails(pubUrl);
          if (pubData && this.isConsortiumPublication(pubData)) {
            this.publications.push(pubData);
            tracker.success(`📄 ${pubData.title?.substring(0, 30)}...`);
          } else {
            tracker.increment('⏭️ Non-consortium');
          }
        } catch (error) {
          tracker.fail(error, pubUrl);
        }
        
        // Rate limiting delay
        await this.delay(this.config.requestDelay);
      }
      
      tracker.complete();
      
    } catch (error) {
      this.logger.error('Failed to extract recent publications', error.message);
      throw error;
    }
  }

  /**
   * Fetch publication details with multiple approaches
   */
  async fetchPublicationDetails(pubUrl) {
    const fullUrl = `${this.baseUrl}${pubUrl}`;
    
    try {
      // Try API first
      const apiUrl = `${this.apiBaseUrl}/pubs/${pubUrl.replace('/pub/', '')}`;
      
      try {
        const apiResponse = await this.makeRequest(apiUrl);
        if (apiResponse.data) {
          return await this.processPublication(apiResponse.data);
        }
      } catch (apiError) {
        this.logger.warning(`API failed for ${pubUrl}, trying HTML`, apiError.response?.status);
      }
      
      // Fallback to HTML scraping
      const htmlResponse = await this.makeRequest(fullUrl);
      return await this.extractPublicationFromHTML(htmlResponse.data, pubUrl);
      
    } catch (error) {
      this.logger.error(`Failed to fetch publication: ${pubUrl}`, error.message);
      return null;
    }
  }

  /**
   * Extract publication data from HTML page
   */
  async extractPublicationFromHTML(html, pubUrl) {
    try {
      // Extract basic metadata using regex patterns (more reliable than cheerio for this use case)
      const title = this.extractWithRegex(html, /<title>([^·]+)/, 1)?.trim();
      const doi = this.extractWithRegex(html, /citation_doi[^>]+content="([^"]+)"/, 1);
      const authors = this.extractWithRegex(html, /citation_author[^>]+content="([^"]+)"/g, 1);
      const date = this.extractWithRegex(html, /citation_publication_date[^>]+content="([^"]+)"/, 1);
      const abstract = this.extractWithRegex(html, /<meta[^>]+description[^>]+content="([^"]+)"/, 1);
      
      // Extract download links
      const pdfUrl = this.extractWithRegex(html, /citation_pdf_url[^>]+content="([^"]+)"/, 1);
      
      if (!title) {
        return null;
      }
      
      return {
        id: pubUrl.replace('/pub/', ''),
        slug: pubUrl.replace('/pub/', ''),
        title: title.replace(' · CrimRxiv', ''),
        description: abstract || '',
        doi: doi || '',
        authors: authors ? [{ name: authors }] : [],
        createdAt: date || new Date().toISOString(),
        downloads: {
          pdf: pdfUrl
        },
        originalUrl: `${this.baseUrl}${pubUrl}`,
        scrapedAt: new Date().toISOString(),
        source: 'html'
      };
      
    } catch (error) {
      this.logger.error(`Failed to extract from HTML: ${pubUrl}`, error.message);
      return null;
    }
  }

  /**
   * Process publication data from API or HTML
   */
  async processPublication(pubData) {
    try {
      // Normalize publication data regardless of source
      const publication = {
        id: pubData.id || pubData.slug,
        slug: pubData.slug || pubData.id,
        title: pubData.title || '',
        description: pubData.description || '',
        doi: pubData.doi || '',
        createdAt: pubData.createdAt || new Date().toISOString(),
        updatedAt: pubData.updatedAt || null,
        
        // Authors
        authors: this.normalizeAuthors(pubData),
        
        // Downloads
        downloads: this.normalizeDownloads(pubData),
        
        // Collections and member associations
        collections: this.normalizeCollections(pubData),
        members: this.identifyMemberAssociations(pubData),
        
        // Metadata
        originalUrl: pubData.originalUrl || `${this.baseUrl}/pub/${pubData.slug}`,
        scrapedAt: new Date().toISOString(),
        source: pubData.source || 'api'
      };
      
      return publication;
      
    } catch (error) {
      this.logger.error('Failed to process publication', error.message);
      return null;
    }
  }

  /**
   * Check if publication belongs to consortium
   */
  isConsortiumPublication(pubData) {
    // Check collection membership
    if (pubData.collections && Array.isArray(pubData.collections)) {
      return pubData.collections.some(collection => 
        collection.slug.endsWith('1c') || 
        collection.title.toLowerCase().includes('consortium')
      );
    }
    
    // Check if any known consortium members are associated
    if (pubData.members && Array.isArray(pubData.members)) {
      return pubData.members.length > 0;
    }
    
    // Default to including if we can't determine (safer for consortium)
    return true;
  }

  /**
   * Download publication content (PDFs, metadata)
   */
  async downloadPublicationContent() {
    if (this.publications.length === 0) {
      this.logger.info('No publications to download');
      return;
    }
    
    this.logger.info(`📥 Downloading content for ${this.publications.length} publications...`);
    
    await this.fileHelper.ensureDir('./data/consortium/pdfs');
    
    const tracker = new ProgressTracker(this.publications.length, 'Downloading content');
    
    for (const pub of this.publications) {
      try {
        // Download PDF if available
        if (pub.downloads.pdf) {
          const pdfResult = await this.downloadPDF(pub);
          if (pdfResult.success) {
            pub.filePath = pdfResult.filePath;
            pub.fileSize = pdfResult.fileSize;
            tracker.success(`📄 ${path.basename(pdfResult.filePath)}`);
          } else {
            tracker.fail(new Error(pdfResult.error), pub.id);
          }
        } else {
          tracker.increment('📄 No PDF available');
        }
        
        // Rate limiting
        await this.delay(this.config.requestDelay);
        
      } catch (error) {
        tracker.fail(error, pub.id);
      }
    }
    
    tracker.complete();
  }

  /**
   * Download PDF with retry logic
   */
  async downloadPDF(publication) {
    const pdfUrl = publication.downloads.pdf;
    
    if (!pdfUrl) {
      return { success: false, error: 'No PDF URL' };
    }
    
    try {
      return await withRetry(async () => {
        const fileName = `${publication.slug || publication.id}.pdf`;
        const filePath = `./data/consortium/pdfs/${fileName}`;
        
        // Check if already downloaded
        if (await this.fileHelper.exists(filePath)) {
          const fileSize = await this.fileHelper.getFileSize(filePath);
          if (fileSize > 0) {
            return { success: true, filePath, fileSize, skipped: true };
          }
        }
        
        this.logger.info(`📥 Downloading: ${fileName}`);
        
        const response = await this.makeRequest(pdfUrl, {
          responseType: 'stream',
          timeout: 60000 // Longer timeout for large files
        });
        
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', async () => {
            const fileSize = await this.fileHelper.getFileSize(filePath);
            resolve({ success: true, filePath, fileSize });
          });
          writer.on('error', reject);
          response.data.on('error', reject);
        });
        
      }, this.config.maxRetries, 2000);
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Make HTTP request with fault tolerance
   */
  async makeRequest(url, options = {}) {
    // Rate limiting check
    await this.checkRateLimit();
    
    const config = {
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'application/json, text/html, */*',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache'
      },
      ...options
    };
    
    try {
      this.state.rateLimit.requests++;
      const response = await axios.get(url, config);
      
      // Log successful request
      this.logger.info(`✅ Request successful: ${url.substring(0, 50)}...`);
      
      return response;
      
    } catch (error) {
      // Enhanced error handling
      if (error.response) {
        const status = error.response.status;
        const message = `HTTP ${status}: ${error.response.statusText}`;
        
        if (status === 429) {
          this.logger.warning('Rate limited, waiting longer...');
          await this.delay(5000); // Wait 5 seconds for rate limit
          throw new Error(`Rate limited: ${message}`);
        } else if (status >= 500) {
          throw new Error(`Server error: ${message}`);
        } else if (status === 404) {
          throw new Error(`Not found: ${url}`);
        } else {
          throw new Error(`Request failed: ${message}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout');
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('DNS resolution failed');
      } else {
        throw new Error(`Network error: ${error.message}`);
      }
    }
  }

  /**
   * Rate limiting implementation
   */
  async checkRateLimit() {
    const now = Date.now();
    const windowExpired = now - this.state.rateLimit.window > 60000; // 1 minute window
    
    if (windowExpired) {
      // Reset window
      this.state.rateLimit.window = now;
      this.state.rateLimit.requests = 0;
    }
    
    if (this.state.rateLimit.requests >= this.config.maxPerMinute) {
      const waitTime = 60000 - (now - this.state.rateLimit.window);
      this.logger.warning(`Rate limit reached, waiting ${Math.ceil(waitTime/1000)}s...`);
      await this.delay(waitTime);
      
      // Reset after waiting
      this.state.rateLimit.window = Date.now();
      this.state.rateLimit.requests = 0;
    }
  }

  /**
   * Circuit breaker pattern implementation
   */
  checkCircuitBreaker() {
    const now = Date.now();
    
    switch (this.circuitBreaker.state) {
      case 'open':
        if (now - this.circuitBreaker.lastFailure > this.circuitBreaker.timeout) {
          this.circuitBreaker.state = 'half-open';
          this.logger.info('Circuit breaker: Moving to half-open state');
          return true;
        }
        return false;
        
      case 'half-open':
      case 'closed':
        return true;
        
      default:
        return true;
    }
  }

  /**
   * Record failure for circuit breaker
   */
  recordFailure(error) {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    this.state.errors.push({
      message: error.message,
      timestamp: new Date().toISOString(),
      url: error.config?.url || 'unknown'
    });
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'open';
      this.logger.error(`Circuit breaker opened after ${this.circuitBreaker.failures} failures`);
    }
  }

  /**
   * Reset circuit breaker on success
   */
  resetCircuitBreaker() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = 'closed';
    this.circuitBreaker.lastFailure = null;
  }

  /**
   * Utility functions
   */
  extractWithRegex(text, pattern, group = 0) {
    const match = text.match(pattern);
    return match ? match[group] : null;
  }

  normalizeAuthors(pubData) {
    if (pubData.attributions && Array.isArray(pubData.attributions)) {
      return pubData.attributions.map(attr => ({
        name: attr.user?.fullName || attr.name || '',
        affiliation: attr.affiliation || '',
        orcid: attr.orcid || attr.user?.orcid || ''
      })).filter(author => author.name);
    }
    
    if (pubData.authors && Array.isArray(pubData.authors)) {
      return pubData.authors;
    }
    
    return [];
  }

  normalizeDownloads(pubData) {
    const downloads = {};
    
    if (pubData.exports && Array.isArray(pubData.exports)) {
      pubData.exports.forEach(exp => {
        if (exp.format && exp.url) {
          downloads[exp.format] = exp.url;
        }
      });
    }
    
    if (pubData.downloads) {
      Object.assign(downloads, pubData.downloads);
    }
    
    return downloads;
  }

  normalizeCollections(pubData) {
    const collections = [];
    
    if (pubData.collectionPubs && Array.isArray(pubData.collectionPubs)) {
      pubData.collectionPubs.forEach(cp => {
        if (cp.collection) {
          collections.push({
            id: cp.collection.id,
            title: cp.collection.title,
            slug: cp.collection.slug
          });
        }
      });
    }
    
    return collections;
  }

  identifyMemberAssociations(pubData) {
    const memberSlugs = this.members.map(m => m.slug);
    const associations = [];
    
    // Check collection associations
    if (pubData.collections) {
      pubData.collections.forEach(collection => {
        if (memberSlugs.includes(collection.slug)) {
          associations.push(collection.slug);
        }
      });
    }
    
    return [...new Set(associations)];
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * State management
   */
  async saveState() {
    const state = {
      ...this.state,
      lastScrape: new Date().toISOString(),
      totalScraped: this.publications.length,
      circuitBreaker: this.circuitBreaker
    };
    
    return await this.stateManager.saveState('consortium-scraper', state);
  }

  async loadState() {
    const state = await this.stateManager.loadState('consortium-scraper');
    if (state) {
      this.state = { ...this.state, ...state };
      this.circuitBreaker = { ...this.circuitBreaker, ...state.circuitBreaker };
    }
  }

  /**
   * Save scraping results
   */
  async saveResults() {
    this.logger.info('💾 Saving scraping results...');
    
    await this.fileHelper.ensureDir('./data/consortium');
    
    // Save members
    await this.fileHelper.writeJSON('./data/consortium/members.json', this.members);
    
    // Save publications
    await this.fileHelper.writeJSON('./data/consortium/publications.json', this.publications);
    
    // Save summary report
    const report = {
      summary: {
        totalMembers: this.members.length,
        totalPublications: this.publications.length,
        scrapedAt: new Date().toISOString()
      },
      members: this.members,
      publications: this.publications.slice(0, 10), // Sample
      errors: this.state.errors,
      performance: {
        requestsSuccessful: this.state.rateLimit.requests - this.state.errors.length,
        requestsFailed: this.state.errors.length,
        circuitBreakerState: this.circuitBreaker.state
      }
    };
    
    await this.fileHelper.writeJSON('./data/consortium/scraping-report.json', report);
    
    this.logger.success('Results saved successfully');
  }
}