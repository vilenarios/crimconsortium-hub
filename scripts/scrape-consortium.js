#!/usr/bin/env node

/**
 * CrimConsortium API-Based Scraper with Fault Tolerance
 * Uses PubPub API to scrape consortium member publications
 * Built for reliability and CrimRXiv team handoff
 */

import axios from 'axios';
import fs from 'fs-extra';
import { Logger, FileHelper, ProgressTracker, StateManager, withRetry } from '../src/lib/utils.js';

class ConsortiumAPIScraper {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.stateManager = new StateManager();
    
    // API Configuration
    this.baseUrl = 'https://www.crimrxiv.com';
    this.apiUrl = 'https://www.crimrxiv.com/api';
    this.communityId = 'cb6ab371-fc70-4ef3-b2e5-d0d0580b4d37'; // CrimRXiv community ID
    
    // Data storage
    this.consortiumMembers = [];
    this.consortiumPublications = [];
    this.collections = [];
    
    // Configuration with fault tolerance
    this.config = {
      requestDelay: 1000,        // 1 second between requests
      timeout: 30000,            // 30 second timeout
      maxRetries: 3,             // Retry failed requests
      userAgent: 'CrimConsortium-Archive-Bot/1.0 (crimrxiv@manchester.ac.uk)',
      maxConcurrent: 2,          // Conservative concurrent requests
      rateLimit: {
        maxPerMinute: 30,        // Conservative rate limiting
        window: 60000            // 1 minute window
      }
    };
    
    // State and error tracking
    this.state = {
      lastScrape: null,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: [],
      rateLimit: {
        requests: 0,
        windowStart: Date.now()
      }
    };
    
    // Circuit breaker for fault tolerance
    this.circuitBreaker = {
      failures: 0,
      threshold: 5,             // Open after 5 failures
      timeout: 300000,          // 5 minute timeout
      lastFailure: null,
      state: 'closed'           // closed, open, half-open
    };
  }

  /**
   * Main scraping function
   */
  async scrapeConsortium() {
    this.logger.info('🕷️ Starting CrimConsortium API scraping...');
    
    try {
      await this.stateManager.init();
      await this.loadState();
      
      // Check circuit breaker
      if (!this.isCircuitBreakerClosed()) {
        throw new Error('Circuit breaker is open - too many recent failures. Please wait before retrying.');
      }
      
      // Step 1: Get consortium page collection
      await this.getConsortiumCollection();
      
      // Step 2: Get all member collections
      await this.getMemberCollections();
      
      // Step 3: Get publications from member collections
      await this.getMemberPublications();
      
      // Step 4: Download PDFs
      await this.downloadPublicationPDFs();
      
      // Step 5: Save results
      await this.saveResults();
      await this.saveState();
      
      // Reset circuit breaker on success
      this.resetCircuitBreaker();
      
      this.logger.success(`Scraping complete: ${this.consortiumPublications.length} publications from ${this.consortiumMembers.length} members`);
      
      return {
        members: this.consortiumMembers,
        publications: this.consortiumPublications,
        stats: this.getStats()
      };
      
    } catch (error) {
      this.recordFailure(error);
      await this.saveState();
      this.logger.error('Consortium scraping failed', error.message);
      throw error;
    }
  }

  /**
   * Get the main consortium collection/page
   */
  async getConsortiumCollection() {
    this.logger.info('🏛️ Getting consortium collection data...');
    
    try {
      // Try to get consortium as a collection first
      const collectionResponse = await this.makeAPIRequest('/api/collections/consortium', {
        include: ['attributions', 'collectionPubs', 'page'],
        attributes: ['id', 'title', 'slug', 'layout', 'metadata', 'kind']
      });
      
      if (collectionResponse.data) {
        this.logger.success('Found consortium collection via API');
        return await this.processConsortiumCollection(collectionResponse.data);
      }
      
    } catch (error) {
      this.logger.warning('Consortium collection API failed, trying page approach', error.message);
    }
    
    // Fallback to page approach
    try {
      const pageResponse = await this.makeAPIRequest('/api/pages/consortium');
      
      if (pageResponse.data) {
        this.logger.success('Found consortium page via API');
        return await this.processConsortiumPage(pageResponse.data);
      }
      
    } catch (error) {
      this.logger.error('Both collection and page API calls failed', error.message);
      throw error;
    }
  }

  /**
   * Process consortium collection data
   */
  async processConsortiumCollection(collectionData) {
    this.logger.info('⚙️ Processing consortium collection...');
    
    // Extract layout blocks to find member references
    if (collectionData.layout && collectionData.layout.blocks) {
      for (const block of collectionData.layout.blocks) {
        if (block.type === 'collections-pages' && block.content && block.content.items) {
          // Process member collection/page references
          for (const item of block.content.items) {
            if (item.type === 'collection' || item.type === 'page') {
              await this.addConsortiumMember(item);
            }
          }
        }
      }
    }
    
    // Get publications directly associated with consortium collection
    if (collectionData.collectionPubs && Array.isArray(collectionData.collectionPubs)) {
      this.logger.info(`Found ${collectionData.collectionPubs.length} publications in consortium collection`);
      
      for (const collectionPub of collectionData.collectionPubs) {
        await this.fetchPublicationDetails(collectionPub.pubId);
      }
    }
  }

  /**
   * Add consortium member and get their details
   */
  async addConsortiumMember(memberRef) {
    try {
      let memberData = null;
      
      if (memberRef.type === 'collection') {
        // Get collection details
        memberData = await this.makeAPIRequest(`/api/collections/${memberRef.id}`, {
          include: ['attributions', 'collectionPubs']
        });
      } else if (memberRef.type === 'page') {
        // Get page details
        memberData = await this.makeAPIRequest(`/api/pages/${memberRef.id}`);
      }
      
      if (memberData && memberData.data) {
        const member = {
          id: memberData.data.id,
          name: memberData.data.title,
          slug: memberData.data.slug,
          type: memberRef.type,
          avatar: memberData.data.avatar,
          description: memberData.data.description,
          publications: [],
          publicationCount: 0,
          scrapedAt: new Date().toISOString()
        };
        
        this.consortiumMembers.push(member);
        
        this.logger.success(`Added member: ${member.name}`);
        
        // Get publications for this member if it's a collection
        if (memberRef.type === 'collection' && memberData.data.collectionPubs) {
          for (const collectionPub of memberData.data.collectionPubs) {
            await this.fetchPublicationDetails(collectionPub.pubId, member);
          }
        }
      }
      
    } catch (error) {
      this.logger.error(`Failed to add member: ${memberRef.id}`, error.message);
    }
  }

  /**
   * Get member collections (alternative approach)
   */
  async getMemberCollections() {
    this.logger.info('📚 Getting member collections...');
    
    // Known consortium member collection slugs (from our analysis)
    const memberSlugs = [
      'acjs1c', 'ghent1c', 'johnjayrec1c', 'ohcp1c', 'sfu1c', 'temple1c',
      'benthamproject1c', 'montreal1c', 'prisonsresearch1c', 'uga1c', 'umsl1c', 'utd1c',
      'cybersecurity1c', 'kf1c', 'hawaiicrimelab', 'jhc', 'mpicsl', 'sebp', 'sascv',
      'uomcriminology', 'uomopenresearch'
    ];
    
    const tracker = new ProgressTracker(memberSlugs.length, 'Fetching member collections');
    
    for (const slug of memberSlugs) {
      try {
        await this.delay(this.config.requestDelay);
        
        const memberData = await this.makeAPIRequest(`/api/collections/${slug}`, {
          include: ['attributions', 'collectionPubs', 'page'],
          attributes: ['id', 'title', 'slug', 'avatar', 'description', 'kind', 'metadata']
        });
        
        if (memberData.data) {
          const member = {
            id: memberData.data.id,
            name: memberData.data.title,
            slug: memberData.data.slug,
            type: 'collection',
            avatar: memberData.data.avatar,
            description: memberData.data.description,
            kind: memberData.data.kind,
            publications: [],
            publicationCount: memberData.data.collectionPubs ? memberData.data.collectionPubs.length : 0,
            collectionPubs: memberData.data.collectionPubs || [],
            scrapedAt: new Date().toISOString()
          };
          
          this.consortiumMembers.push(member);
          tracker.success(`✅ ${member.name}`);
          
        } else {
          tracker.increment(`❌ No data for ${slug}`);
        }
        
      } catch (error) {
        tracker.fail(error, slug);
      }
    }
    
    tracker.complete();
    this.logger.success(`Found ${this.consortiumMembers.length} consortium members with data`);
  }

  /**
   * Get publications for all members
   */
  async getMemberPublications() {
    this.logger.info('📄 Getting member publications...');
    
    const allCollectionPubs = this.consortiumMembers
      .flatMap(member => member.collectionPubs || []);
    
    if (allCollectionPubs.length === 0) {
      this.logger.warning('No collection publications found');
      return;
    }
    
    this.logger.info(`Found ${allCollectionPubs.length} publication references`);
    
    const tracker = new ProgressTracker(allCollectionPubs.length, 'Fetching publication details');
    
    // Process in batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < allCollectionPubs.length; i += batchSize) {
      const batch = allCollectionPubs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (collectionPub) => {
        try {
          await this.delay(this.config.requestDelay / batchSize); // Spread out requests
          
          const pubData = await this.fetchPublicationDetails(collectionPub.pubId);
          if (pubData) {
            // Associate with member
            const member = this.consortiumMembers.find(m => 
              m.collectionPubs && m.collectionPubs.some(cp => cp.id === collectionPub.id)
            );
            
            if (member) {
              pubData.memberAssociations = [member.slug];
              member.publications.push(pubData.id);
            }
            
            this.consortiumPublications.push(pubData);
            tracker.success(`📄 ${pubData.title?.substring(0, 30)}...`);
          } else {
            tracker.increment(`❌ Failed to get ${collectionPub.pubId}`);
          }
          
        } catch (error) {
          tracker.fail(error, collectionPub.pubId);
        }
      });
      
      await Promise.all(batchPromises);
    }
    
    tracker.complete();
    this.logger.success(`Retrieved ${this.consortiumPublications.length} consortium publications`);
  }

  /**
   * Fetch individual publication details
   */
  async fetchPublicationDetails(pubId, associatedMember = null) {
    try {
      const response = await this.makeAPIRequest(`/api/pubs/${pubId}`, {
        include: ['attributions', 'collectionPubs', 'draft', 'releases'],
        attributes: [
          'id', 'slug', 'title', 'htmlTitle', 'description', 'htmlDescription',
          'avatar', 'doi', 'downloads', 'customPublishedAt', 'labels', 'metadata',
          'createdAt', 'updatedAt'
        ]
      });
      
      if (!response.data) {
        return null;
      }
      
      const pub = response.data;
      
      // Normalize publication data
      const publication = {
        id: pub.id,
        slug: pub.slug,
        title: pub.title || pub.htmlTitle || '',
        description: pub.description || pub.htmlDescription || '',
        doi: pub.doi || '',
        avatar: pub.avatar,
        
        // Dates
        createdAt: pub.createdAt,
        updatedAt: pub.updatedAt,
        publishedAt: pub.customPublishedAt || pub.createdAt,
        
        // Authors and attributions
        authors: this.normalizeAuthors(pub.attributions || []),
        attributions: pub.attributions || [],
        
        // Downloads and exports
        downloads: this.normalizeDownloads(pub.downloads || []),
        
        // Collections and associations
        collections: this.normalizeCollections(pub.collectionPubs || []),
        memberAssociations: associatedMember ? [associatedMember.slug] : [],
        
        // Metadata
        labels: pub.labels || [],
        metadata: pub.metadata || {},
        
        // URLs
        originalUrl: `${this.baseUrl}/pub/${pub.slug}`,
        
        // Scraping metadata
        scrapedAt: new Date().toISOString(),
        source: 'api'
      };
      
      return publication;
      
    } catch (error) {
      this.logger.error(`Failed to fetch publication: ${pubId}`, error.message);
      return null;
    }
  }

  /**
   * Download PDFs for publications
   */
  async downloadPublicationPDFs() {
    const publicationsWithPDFs = this.consortiumPublications.filter(pub => 
      pub.downloads.pdf
    );
    
    if (publicationsWithPDFs.length === 0) {
      this.logger.info('No PDFs to download');
      return;
    }
    
    this.logger.info(`📥 Downloading ${publicationsWithPDFs.length} PDFs...`);
    
    await this.fileHelper.ensureDir('./data/consortium/pdfs');
    
    const tracker = new ProgressTracker(publicationsWithPDFs.length, 'Downloading PDFs');
    
    for (const pub of publicationsWithPDFs) {
      try {
        const result = await this.downloadPDF(pub);
        
        if (result.success) {
          pub.filePath = result.filePath;
          pub.fileSize = result.fileSize;
          tracker.success(`📄 ${result.fileName}`);
        } else {
          tracker.fail(new Error(result.error), pub.id);
        }
        
        // Rate limiting delay
        await this.delay(this.config.requestDelay);
        
      } catch (error) {
        tracker.fail(error, pub.id);
      }
    }
    
    tracker.complete();
  }

  /**
   * Download PDF with comprehensive error handling
   */
  async downloadPDF(publication) {
    const pdfUrl = publication.downloads.pdf;
    
    if (!pdfUrl) {
      return { success: false, error: 'No PDF URL available' };
    }
    
    try {
      return await withRetry(async () => {
        const fileName = `${publication.slug || publication.id}.pdf`;
        const filePath = `./data/consortium/pdfs/${fileName}`;
        
        // Check if already exists
        if (await this.fileHelper.exists(filePath)) {
          const fileSize = await this.fileHelper.getFileSize(filePath);
          if (fileSize > 0) {
            return { success: true, filePath, fileSize, fileName, skipped: true };
          }
        }
        
        // Download file
        const response = await this.makeRequest(pdfUrl, {
          responseType: 'stream',
          timeout: 60000 // Longer timeout for files
        });
        
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
          writer.on('finish', async () => {
            try {
              const fileSize = await this.fileHelper.getFileSize(filePath);
              resolve({ success: true, filePath, fileSize, fileName });
            } catch (error) {
              reject(error);
            }
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
   * Make API request with comprehensive fault tolerance
   */
  async makeAPIRequest(endpoint, params = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    return await this.makeRequest(url, { params });
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
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      ...options
    };
    
    this.state.totalRequests++;
    
    try {
      const response = await axios.get(url, config);
      
      this.state.successfulRequests++;
      this.state.rateLimit.requests++;
      
      return response;
      
    } catch (error) {
      this.state.failedRequests++;
      
      // Enhanced error handling
      let errorMessage = 'Unknown error';
      
      if (error.response) {
        const status = error.response.status;
        errorMessage = `HTTP ${status}: ${error.response.statusText}`;
        
        if (status === 429) {
          // Rate limiting
          this.logger.warning('Rate limited, waiting...');
          await this.delay(5000);
          throw new Error(`Rate limited: ${errorMessage}`);
        } else if (status >= 500) {
          // Server error
          throw new Error(`Server error: ${errorMessage}`);
        } else if (status === 404) {
          throw new Error(`Not found: ${errorMessage}`);
        } else if (status === 403) {
          throw new Error(`Access denied: ${errorMessage}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'DNS resolution failed';
      } else {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Rate limiting implementation
   */
  async checkRateLimit() {
    const now = Date.now();
    const windowExpired = now - this.state.rateLimit.windowStart > this.config.rateLimit.window;
    
    if (windowExpired) {
      this.state.rateLimit.windowStart = now;
      this.state.rateLimit.requests = 0;
    }
    
    if (this.state.rateLimit.requests >= this.config.rateLimit.maxPerMinute) {
      const waitTime = this.config.rateLimit.window - (now - this.state.rateLimit.windowStart);
      this.logger.warning(`Rate limit reached, waiting ${Math.ceil(waitTime/1000)}s...`);
      await this.delay(waitTime);
      
      // Reset after waiting
      this.state.rateLimit.windowStart = Date.now();
      this.state.rateLimit.requests = 0;
    }
  }

  /**
   * Circuit breaker implementation
   */
  isCircuitBreakerClosed() {
    const now = Date.now();
    
    switch (this.circuitBreaker.state) {
      case 'open':
        if (this.circuitBreaker.lastFailure && 
            now - this.circuitBreaker.lastFailure > this.circuitBreaker.timeout) {
          this.circuitBreaker.state = 'half-open';
          this.logger.info('Circuit breaker: Moving to half-open state');
          return true;
        }
        this.logger.warning('Circuit breaker is open - waiting for timeout');
        return false;
        
      case 'half-open':
      case 'closed':
        return true;
        
      default:
        return true;
    }
  }

  recordFailure(error) {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    this.state.errors.push({
      message: error.message,
      timestamp: new Date().toISOString(),
      stack: error.stack
    });
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'open';
      this.logger.error(`Circuit breaker opened after ${this.circuitBreaker.failures} failures`);
    }
  }

  resetCircuitBreaker() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = 'closed';
    this.circuitBreaker.lastFailure = null;
  }

  /**
   * Data normalization utilities
   */
  normalizeAuthors(attributions) {
    return attributions.map(attr => ({
      name: attr.user?.fullName || attr.name || '',
      firstName: attr.user?.firstName || '',
      lastName: attr.user?.lastName || '',
      affiliation: attr.affiliation || '',
      orcid: attr.orcid || attr.user?.orcid || '',
      roles: attr.roles || [],
      isAuthor: attr.isAuthor || false,
      order: attr.order || 0
    })).filter(author => author.name);
  }

  normalizeDownloads(downloads) {
    const normalized = {};
    
    if (Array.isArray(downloads)) {
      downloads.forEach(download => {
        if (download.type && download.url) {
          normalized[download.type] = download.url;
        }
      });
    }
    
    return normalized;
  }

  normalizeCollections(collectionPubs) {
    return collectionPubs.map(cp => ({
      id: cp.collectionId,
      pubId: cp.pubId,
      rank: cp.rank,
      contextHint: cp.contextHint
    }));
  }

  /**
   * State and results management
   */
  async saveResults() {
    this.logger.info('💾 Saving consortium scraping results...');
    
    await this.fileHelper.ensureDir('./data/consortium');
    
    // Save members
    await this.fileHelper.writeJSON('./data/consortium/members.json', this.consortiumMembers);
    
    // Save publications
    await this.fileHelper.writeJSON('./data/consortium/publications.json', this.consortiumPublications);
    
    // Generate summary report
    const report = {
      summary: {
        totalMembers: this.consortiumMembers.length,
        totalPublications: this.consortiumPublications.length,
        scrapedAt: new Date().toISOString(),
        source: 'pubpub-api'
      },
      members: this.consortiumMembers.map(m => ({
        name: m.name,
        slug: m.slug,
        publicationCount: m.publications.length
      })),
      publications: this.consortiumPublications.map(p => ({
        id: p.id,
        title: p.title,
        authors: p.authors.map(a => a.name),
        memberAssociations: p.memberAssociations
      })),
      performance: this.getStats(),
      errors: this.state.errors.slice(-10) // Last 10 errors
    };
    
    await this.fileHelper.writeJSON('./data/consortium/scraping-report.json', report);
    
    this.logger.success('Results saved successfully');
    this.printSummary(report);
  }

  async saveState() {
    const state = {
      ...this.state,
      lastScrape: new Date().toISOString(),
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

  getStats() {
    return {
      requests: {
        total: this.state.totalRequests,
        successful: this.state.successfulRequests,
        failed: this.state.failedRequests,
        successRate: this.state.totalRequests > 0 ? 
          (this.state.successfulRequests / this.state.totalRequests * 100).toFixed(1) + '%' : '0%'
      },
      circuitBreaker: {
        state: this.circuitBreaker.state,
        failures: this.circuitBreaker.failures
      },
      errors: this.state.errors.length
    };
  }

  printSummary(report) {
    this.logger.success('📊 Consortium Scraping Summary');
    console.log('');
    console.log(`👥 Members Found: ${report.summary.totalMembers}`);
    console.log(`📚 Publications Found: ${report.summary.totalPublications}`);
    console.log(`📈 Success Rate: ${report.performance.requests.successRate}`);
    console.log(`⚡ Circuit Breaker: ${report.performance.circuitBreaker.state}`);
    console.log('');
    
    if (report.members.length > 0) {
      console.log('🏆 Top Publishing Members:');
      report.members
        .sort((a, b) => b.publicationCount - a.publicationCount)
        .slice(0, 5)
        .forEach((member, index) => {
          console.log(`${index + 1}. ${member.name}: ${member.publicationCount} publications`);
        });
      console.log('');
    }
    
    console.log('📁 Data saved to:');
    console.log('  ./data/consortium/members.json');
    console.log('  ./data/consortium/publications.json');
    console.log('  ./data/consortium/scraping-report.json');
    console.log('');
    
    if (report.errors > 0) {
      console.log(`⚠️  ${report.errors} errors occurred - check scraping-report.json for details`);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run scraper if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new ConsortiumAPIScraper();
  scraper.scrapeConsortium().catch(error => {
    console.error('Scraping failed:', error);
    process.exit(1);
  });
}

export default ConsortiumAPIScraper;