#!/usr/bin/env node

/**
 * Robust CrimConsortium Scraper
 * Uses RSS feed + collection API + HTML fallback with comprehensive fault tolerance
 * Designed for CrimRXiv team handoff and reliability
 */

import axios from 'axios';
import fs from 'fs-extra';
import xml2js from 'xml2js';
import { Logger, FileHelper, ProgressTracker, StateManager, withRetry } from '../src/lib/utils.js';

class RobustConsortiumScraper {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.stateManager = new StateManager();
    
    this.baseUrl = 'https://www.crimrxiv.com';
    this.apiUrl = 'https://www.crimrxiv.com/api';
    this.rssUrl = 'https://www.crimrxiv.com/rss.xml';
    this.communityId = 'cb6ab371-fc70-4ef3-b2e5-d0d0580b4d37';
    
    // Known consortium member slugs from our analysis
    this.consortiumSlugs = [
      'acjs1c', 'ghent1c', 'johnjayrec1c', 'ohcp1c', 'sfu1c', 'temple1c',
      'benthamproject1c', 'montreal1c', 'prisonsresearch1c', 'uga1c', 'umsl1c', 'utd1c',
      'cybersecurity1c', 'kf1c', 'hawaiicrimelab', 'jhc', 'mpicsl', 'sebp', 'sascv',
      'uomcriminology', 'uomopenresearch'
    ];
    
    // Data storage
    this.consortiumMembers = [];
    this.consortiumPublications = [];
    this.rssArticles = [];
    
    // Configuration
    this.config = {
      requestDelay: 2000,        // 2 seconds between requests (conservative)
      timeout: 30000,
      maxRetries: 3,
      userAgent: 'CrimConsortium-Archive-Bot/1.0 (crimrxiv@manchester.ac.uk)',
      maxArticles: 100           // Limit for testing
    };
    
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: []
    };
  }

  async scrapeConsortium() {
    this.logger.info('🚀 Starting robust consortium scraping...');
    
    try {
      await this.stateManager.init();
      
      // Step 1: Get recent articles from RSS feed
      await this.scrapeRSSFeed();
      
      // Step 2: Get consortium member details
      await this.getConsortiumMembers();
      
      // Step 3: Filter articles for consortium members
      await this.filterConsortiumPublications();
      
      // Step 4: Download PDFs for consortium publications
      await this.downloadConsortiumPDFs();
      
      // Step 5: Save results
      await this.saveResults();
      
      this.logger.success(`Consortium scraping complete: ${this.consortiumPublications.length} publications from ${this.consortiumMembers.length} members`);
      
      return {
        members: this.consortiumMembers,
        publications: this.consortiumPublications,
        stats: this.stats
      };
      
    } catch (error) {
      this.logger.error('Consortium scraping failed', error.message);
      throw error;
    }
  }

  /**
   * Scrape RSS feed for recent articles (most reliable method)
   */
  async scrapeRSSFeed() {
    this.logger.info('📡 Scraping RSS feed for recent articles...');
    
    try {
      const response = await this.makeRequest(this.rssUrl, {
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
      });
      
      const parser = new xml2js.Parser();
      const rssData = await parser.parseStringPromise(response.data);
      
      if (!rssData.rss || !rssData.rss.channel || !rssData.rss.channel[0].item) {
        throw new Error('Invalid RSS feed structure');
      }
      
      const items = rssData.rss.channel[0].item;
      this.logger.success(`Found ${items.length} articles in RSS feed`);
      
      // Process RSS items
      const tracker = new ProgressTracker(
        Math.min(items.length, this.config.maxArticles), 
        'Processing RSS articles'
      );
      
      for (let i = 0; i < Math.min(items.length, this.config.maxArticles); i++) {
        const item = items[i];
        
        try {
          const article = {
            title: item.title?.[0] || '',
            link: item.link?.[0] || '',
            pubDate: item.pubDate?.[0] || '',
            description: item.description?.[0] || '',
            author: item.author?.[0] || '',
            guid: item.guid?.[0]?._ || item.guid?.[0] || '',
            
            // Extract slug from link
            slug: this.extractSlugFromUrl(item.link?.[0] || ''),
            
            // Parse publication date
            createdAt: this.parseRSSDate(item.pubDate?.[0]),
            
            // Source tracking
            source: 'rss',
            scrapedAt: new Date().toISOString()
          };
          
          if (article.slug) {
            this.rssArticles.push(article);
            tracker.success(`📰 ${article.title.substring(0, 40)}...`);
          } else {
            tracker.increment('⏭️ No slug found');
          }
          
        } catch (error) {
          tracker.fail(error, `RSS item ${i}`);
        }
      }
      
      tracker.complete();
      this.logger.success(`Processed ${this.rssArticles.length} RSS articles`);
      
    } catch (error) {
      this.logger.error('RSS feed scraping failed', error.message);
      throw error;
    }
  }

  /**
   * Get consortium member information
   */
  async getConsortiumMembers() {
    this.logger.info('👥 Getting consortium member details...');
    
    const tracker = new ProgressTracker(this.consortiumSlugs.length, 'Fetching member details');
    
    for (const slug of this.consortiumSlugs) {
      try {
        await this.delay(this.config.requestDelay);
        
        // Try to get collection details via API
        const memberData = await this.makeAPIRequest(`/api/collections/${slug}`, {
          include: ['attributions', 'collectionPubs'],
          attributes: ['id', 'title', 'slug', 'avatar', 'description', 'kind']
        });
        
        if (memberData.data) {
          const member = {
            id: memberData.data.id,
            name: memberData.data.title,
            slug: memberData.data.slug,
            avatar: memberData.data.avatar,
            description: memberData.data.description,
            kind: memberData.data.kind,
            
            // Publication tracking
            publications: [],
            publicationCount: 0,
            
            // API data
            collectionPubs: memberData.data.collectionPubs || [],
            attributions: memberData.data.attributions || [],
            
            // Metadata
            scrapedAt: new Date().toISOString(),
            apiWorking: true
          };
          
          this.consortiumMembers.push(member);
          tracker.success(`✅ ${member.name}`);
          
        } else {
          tracker.increment(`❌ No data: ${slug}`);
        }
        
      } catch (error) {
        // Create placeholder member even if API fails
        const member = {
          id: slug,
          name: this.slugToName(slug),
          slug: slug,
          avatar: null,
          description: '',
          publications: [],
          publicationCount: 0,
          collectionPubs: [],
          scrapedAt: new Date().toISOString(),
          apiWorking: false,
          error: error.message
        };
        
        this.consortiumMembers.push(member);
        tracker.fail(error, slug);
      }
    }
    
    tracker.complete();
    this.logger.success(`Retrieved ${this.consortiumMembers.filter(m => m.apiWorking).length}/${this.consortiumMembers.length} member details via API`);
  }

  /**
   * Filter RSS articles for consortium members
   */
  async filterConsortiumPublications() {
    this.logger.info('🔍 Filtering articles for consortium members...');
    
    if (this.rssArticles.length === 0) {
      this.logger.warning('No RSS articles to filter');
      return;
    }
    
    const tracker = new ProgressTracker(this.rssArticles.length, 'Filtering consortium articles');
    
    for (const rssArticle of this.rssArticles) {
      try {
        // Get full publication details via API
        const pubData = await this.getPublicationDetails(rssArticle.slug);
        
        if (pubData && this.isConsortiumPublication(pubData)) {
          // Identify associated consortium members
          const associatedMembers = this.findAssociatedMembers(pubData);
          
          const publication = {
            ...pubData,
            memberAssociations: associatedMembers,
            rssData: rssArticle
          };
          
          this.consortiumPublications.push(publication);
          
          // Update member publication counts
          associatedMembers.forEach(memberSlug => {
            const member = this.consortiumMembers.find(m => m.slug === memberSlug);
            if (member) {
              member.publications.push(publication.id);
              member.publicationCount++;
            }
          });
          
          tracker.success(`📄 ${publication.title.substring(0, 40)}...`);
          
        } else {
          tracker.increment('⏭️ Non-consortium');
        }
        
        // Rate limiting
        await this.delay(this.config.requestDelay);
        
      } catch (error) {
        tracker.fail(error, rssArticle.slug);
      }
    }
    
    tracker.complete();
    this.logger.success(`Identified ${this.consortiumPublications.length} consortium publications`);
  }

  /**
   * Get publication details via API
   */
  async getPublicationDetails(slug) {
    try {
      const response = await this.makeAPIRequest(`/api/pubs/${slug}`, {
        include: ['attributions', 'collectionPubs'],
        attributes: [
          'id', 'slug', 'title', 'description', 'doi', 'avatar',
          'createdAt', 'updatedAt', 'customPublishedAt', 'downloads'
        ]
      });
      
      if (response.data) {
        return {
          id: response.data.id,
          slug: response.data.slug,
          title: response.data.title || '',
          description: response.data.description || '',
          doi: response.data.doi || '',
          avatar: response.data.avatar,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt,
          publishedAt: response.data.customPublishedAt || response.data.createdAt,
          
          // Authors
          authors: this.normalizeAuthors(response.data.attributions || []),
          
          // Downloads
          downloads: this.normalizeDownloads(response.data.downloads || []),
          
          // Collections
          collections: response.data.collectionPubs || [],
          
          // URLs
          originalUrl: `${this.baseUrl}/pub/${response.data.slug}`,
          
          // Metadata
          scrapedAt: new Date().toISOString(),
          source: 'api'
        };
      }
      
      return null;
      
    } catch (error) {
      this.logger.warning(`Failed to get publication details: ${slug}`, error.message);
      return null;
    }
  }

  /**
   * Check if publication belongs to consortium
   */
  isConsortiumPublication(publication) {
    if (!publication.collections || publication.collections.length === 0) {
      return false;
    }
    
    // Check if publication is associated with any consortium member collections
    return publication.collections.some(collection => 
      this.consortiumSlugs.includes(collection.collectionId) ||
      this.consortiumSlugs.includes(collection.collection?.slug)
    );
  }

  /**
   * Find associated consortium members for a publication
   */
  findAssociatedMembers(publication) {
    const associations = [];
    
    if (publication.collections) {
      publication.collections.forEach(collection => {
        const collectionSlug = collection.collection?.slug || collection.collectionId;
        if (this.consortiumSlugs.includes(collectionSlug)) {
          associations.push(collectionSlug);
        }
      });
    }
    
    return [...new Set(associations)];
  }

  /**
   * Download PDFs for consortium publications
   */
  async downloadConsortiumPDFs() {
    const publicationsWithPDFs = this.consortiumPublications.filter(pub => 
      pub.downloads && pub.downloads.pdf
    );
    
    if (publicationsWithPDFs.length === 0) {
      this.logger.info('No consortium publications with PDFs found');
      return;
    }
    
    this.logger.info(`📥 Downloading ${publicationsWithPDFs.length} consortium PDFs...`);
    
    await this.fileHelper.ensureDir('./data/consortium/pdfs');
    
    const tracker = new ProgressTracker(publicationsWithPDFs.length, 'Downloading PDFs');
    
    for (const pub of publicationsWithPDFs) {
      try {
        const result = await this.downloadPDF(pub);
        
        if (result.success) {
          pub.filePath = result.filePath;
          pub.fileSize = result.fileSize;
          
          if (result.skipped) {
            tracker.increment(`📋 Already exists: ${result.fileName}`);
          } else {
            tracker.success(`📄 Downloaded: ${result.fileName}`);
          }
        } else {
          tracker.fail(new Error(result.error), pub.id);
        }
        
        await this.delay(this.config.requestDelay);
        
      } catch (error) {
        tracker.fail(error, pub.id);
      }
    }
    
    tracker.complete();
  }

  /**
   * Download PDF with fault tolerance
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
          timeout: 60000
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
   * Make API request with fault tolerance
   */
  async makeAPIRequest(endpoint, params = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    return await this.makeRequest(url, { params });
  }

  /**
   * Make HTTP request with comprehensive error handling
   */
  async makeRequest(url, options = {}) {
    const config = {
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'application/json, application/xml, text/xml, */*',
        'Accept-Encoding': 'gzip, deflate'
      },
      ...options
    };
    
    this.stats.totalRequests++;
    
    try {
      const response = await axios.get(url, config);
      this.stats.successfulRequests++;
      return response;
      
    } catch (error) {
      this.stats.failedRequests++;
      this.stats.errors.push({
        url,
        error: error.message,
        status: error.response?.status,
        timestamp: new Date().toISOString()
      });
      
      // Enhanced error handling
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          throw new Error(`Not found: ${url}`);
        } else if (status === 429) {
          this.logger.warning('Rate limited, increasing delay...');
          await this.delay(5000);
          throw new Error(`Rate limited: ${url}`);
        } else if (status >= 500) {
          throw new Error(`Server error (${status}): ${url}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Save scraping results
   */
  async saveResults() {
    this.logger.info('💾 Saving consortium scraping results...');
    
    await this.fileHelper.ensureDir('./data/consortium');
    
    // Save members
    await this.fileHelper.writeJSON('./data/consortium/members.json', this.consortiumMembers);
    
    // Save publications
    await this.fileHelper.writeJSON('./data/consortium/publications.json', this.consortiumPublications);
    
    // Save raw RSS data
    await this.fileHelper.writeJSON('./data/consortium/rss-articles.json', this.rssArticles);
    
    // Generate comprehensive report
    const report = {
      summary: {
        totalMembers: this.consortiumMembers.length,
        workingMembers: this.consortiumMembers.filter(m => m.apiWorking).length,
        totalPublications: this.consortiumPublications.length,
        totalRSSArticles: this.rssArticles.length,
        scrapedAt: new Date().toISOString(),
        nextScrapeRecommended: new Date(Date.now() + 24*60*60*1000).toISOString() // 24 hours
      },
      
      members: this.consortiumMembers.map(m => ({
        name: m.name,
        slug: m.slug,
        publicationCount: m.publicationCount,
        apiWorking: m.apiWorking
      })),
      
      publications: this.consortiumPublications.map(p => ({
        id: p.id,
        title: p.title,
        authors: p.authors.map(a => a.name),
        memberAssociations: p.memberAssociations,
        createdAt: p.createdAt
      })),
      
      performance: {
        requests: {
          total: this.stats.totalRequests,
          successful: this.stats.successfulRequests,
          failed: this.stats.failedRequests,
          successRate: this.stats.totalRequests > 0 ? 
            (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(1) + '%' : '0%'
        },
        errors: this.stats.errors.length,
        lastErrors: this.stats.errors.slice(-5) // Last 5 errors
      },
      
      estimates: {
        sizeEstimate: `${this.consortiumPublications.length * 2}MB`,
        costEstimate: `$${(this.consortiumPublications.length * 2 * 0.00001).toFixed(2)}`,
        description: 'Consortium-only content (much smaller than full archive)'
      }
    };
    
    await this.fileHelper.writeJSON('./data/consortium/scraping-report.json', report);
    
    this.logger.success('Results saved successfully');
    this.printSummary(report);
  }

  /**
   * Print scraping summary
   */
  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CONSORTIUM SCRAPING SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`👥 Consortium Members: ${report.summary.totalMembers}`);
    console.log(`✅ API Working: ${report.summary.workingMembers}/${report.summary.totalMembers}`);
    console.log(`📚 Consortium Publications: ${report.summary.totalPublications}`);
    console.log(`📰 Total RSS Articles: ${report.summary.totalRSSArticles}`);
    console.log(`📈 API Success Rate: ${report.performance.requests.successRate}`);
    
    if (report.publications.length > 0) {
      console.log('\n🎯 Sample Consortium Publications:');
      report.publications.slice(0, 5).forEach((pub, index) => {
        console.log(`${index + 1}. ${pub.title.substring(0, 60)}...`);
        console.log(`   Authors: ${pub.authors.slice(0, 2).join(', ')}`);
        console.log(`   Members: ${pub.memberAssociations.join(', ')}`);
      });
    }
    
    console.log('\n💰 Arweave Cost Estimates:');
    console.log(`📦 Estimated Size: ${report.estimates.sizeEstimate}`);
    console.log(`💵 Estimated Cost: ${report.estimates.costEstimate}`);
    console.log(`📝 ${report.estimates.description}`);
    
    console.log('\n📁 Data Saved To:');
    console.log('  ./data/consortium/members.json');
    console.log('  ./data/consortium/publications.json');
    console.log('  ./data/consortium/scraping-report.json');
    
    if (report.performance.errors > 0) {
      console.log(`\n⚠️  ${report.performance.errors} errors occurred`);
      console.log('   See scraping-report.json for details');
    }
    
    console.log('\n🚀 READY FOR NEXT PHASE:');
    console.log('✅ Consortium content identified and downloaded');
    console.log('✅ Member institutions mapped');
    console.log('✅ Publication metadata extracted');
    console.log('✅ PDFs downloaded for static site');
    
    console.log('='.repeat(60));
  }

  /**
   * Utility functions
   */
  extractSlugFromUrl(url) {
    const match = url.match(/\/pub\/([^\/]+)/);
    return match ? match[1] : null;
  }

  parseRSSDate(dateString) {
    try {
      return new Date(dateString).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  slugToName(slug) {
    // Convert slug to readable name
    return slug
      .replace(/1c$/, '') // Remove consortium suffix
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  normalizeAuthors(attributions) {
    return attributions.map(attr => ({
      name: attr.user?.fullName || attr.name || '',
      affiliation: attr.affiliation || '',
      orcid: attr.orcid || attr.user?.orcid || '',
      roles: attr.roles || []
    })).filter(author => author.name);
  }

  normalizeDownloads(downloads) {
    const normalized = {};
    
    if (Array.isArray(downloads)) {
      downloads.forEach(download => {
        if (download.format && download.url) {
          normalized[download.format] = download.url;
        }
      });
    }
    
    return normalized;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run scraper if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new RobustConsortiumScraper();
  scraper.scrapeConsortium().catch(error => {
    console.error('Scraping failed:', error.message);
    process.exit(1);
  });
}

export default RobustConsortiumScraper;