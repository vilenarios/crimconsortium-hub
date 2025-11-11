/**
 * PubPub Export Parser
 * Processes the 353MB export.json file containing 3,630 CrimRxiv articles
 * Team-friendly with progress tracking and data validation
 */

import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { Logger, FileHelper, ProgressTracker, StateManager, withRetry, getPublicationPath } from './utils.js';

export class ExportParser {
  constructor(exportPath = './export/export.json') {
    this.exportPath = exportPath;
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.stateManager = new StateManager();
    
    // Parsed data
    this.rawData = null;
    this.articles = [];
    this.metadata = {
      community: null,
      collections: [],
      totalArticles: 0,
      dateRange: { earliest: null, latest: null }
    };
    
    // Processing options
    this.options = {
      maxArticles: process.env.DEV_ARTICLE_LIMIT ? parseInt(process.env.DEV_ARTICLE_LIMIT) : null,
      downloadPDFs: true,
      validateData: true,
      outputDir: './data/articles',
      pdfDir: './data/articles/pdfs'
    };
    
    // Statistics
    this.stats = {
      parsed: 0,
      valid: 0,
      invalid: 0,
      downloaded: 0,
      downloadFailed: 0,
      duplicates: 0
    };
  }

  /**
   * Main parsing function - processes the entire export
   */
  async parseExport() {
    this.logger.info('📊 Starting CrimRxiv export parsing...');
    
    try {
      await this.stateManager.init();
      
      // Step 1: Load and validate export file
      await this.loadExportFile();
      
      // Step 2: Extract community metadata
      await this.extractCommunityMetadata();
      
      // Step 3: Process articles
      await this.processArticles();
      
      // Step 4: Download PDFs
      if (this.options.downloadPDFs) {
        await this.downloadArticlePDFs();
      }
      
      // Step 5: Validate and organize data
      if (this.options.validateData) {
        await this.validateArticleData();
      }
      
      // Step 6: Save processed data
      await this.saveProcessedData();
      
      // Step 7: Generate report
      await this.generateReport();
      
      this.logger.success('Export parsing completed successfully');
      
      return {
        articles: this.articles,
        metadata: this.metadata,
        stats: this.stats
      };
      
    } catch (error) {
      this.logger.error('Export parsing failed', error.message);
      throw error;
    }
  }

  /**
   * Load and validate the export.json file
   */
  async loadExportFile() {
    this.logger.info(`📁 Loading export file: ${this.exportPath}`);
    
    // Check file exists
    if (!await this.fileHelper.exists(this.exportPath)) {
      throw new Error(`Export file not found: ${this.exportPath}`);
    }
    
    // Check file size
    const fileSize = await this.fileHelper.getFileSize(this.exportPath);
    this.logger.info(`File size: ${this.fileHelper.formatFileSize(fileSize)}`);
    
    if (fileSize < 1000000) { // Less than 1MB seems too small
      this.logger.warning('Export file seems unusually small');
    }
    
    // Load JSON data
    this.logger.info('📖 Reading JSON data...');
    this.rawData = await this.fileHelper.readJSON(this.exportPath);
    
    if (!this.rawData) {
      throw new Error('Failed to parse export JSON file');
    }
    
    // Validate basic structure
    if (!this.rawData.pubs || !Array.isArray(this.rawData.pubs)) {
      throw new Error('Export file does not contain expected pubs array');
    }
    
    this.logger.success(`Export loaded: ${this.rawData.pubs.length} publications found`);
  }

  /**
   * Extract community and metadata information
   */
  async extractCommunityMetadata() {
    this.logger.info('🏛️ Extracting community metadata...');
    
    if (this.rawData.community) {
      this.metadata.community = {
        id: this.rawData.community.id,
        title: this.rawData.community.title,
        description: this.rawData.community.description,
        domain: this.rawData.community.domain,
        subdomain: this.rawData.community.subdomain,
        avatar: this.rawData.community.avatar,
        website: this.rawData.community.website,
        email: this.rawData.community.email,
        twitter: this.rawData.community.twitter,
        createdAt: this.rawData.community.createdAt
      };
    }
    
    // Extract collections
    if (this.rawData.collections && Array.isArray(this.rawData.collections)) {
      this.metadata.collections = this.rawData.collections.map(collection => ({
        id: collection.id,
        title: collection.title,
        slug: collection.slug,
        description: collection.description,
        isPublic: collection.isPublic,
        pageId: collection.pageId,
        communityId: collection.communityId
      }));
    }
    
    this.logger.success(`Community metadata extracted: ${this.metadata.collections.length} collections`);
  }

  /**
   * Process all articles from the export
   */
  async processArticles() {
    const totalPubs = this.rawData.pubs.length;
    const maxToProcess = this.options.maxArticles || totalPubs;
    const toProcess = Math.min(totalPubs, maxToProcess);
    
    this.logger.info(`📚 Processing ${toProcess} articles...`);
    
    if (this.options.maxArticles && this.options.maxArticles < totalPubs) {
      this.logger.warning(`Development mode: processing only ${maxToProcess} of ${totalPubs} articles`);
    }
    
    const tracker = new ProgressTracker(toProcess, 'Processing articles');
    const seenIds = new Set(); // Track duplicates
    
    for (let i = 0; i < toProcess; i++) {
      const pub = this.rawData.pubs[i];
      
      try {
        // Check for duplicates
        if (seenIds.has(pub.id)) {
          this.stats.duplicates++;
          tracker.increment('📋 Duplicate skipped');
          continue;
        }
        seenIds.add(pub.id);
        
        // Process article
        const article = await this.processArticle(pub);
        
        if (article) {
          this.articles.push(article);
          this.stats.valid++;
          tracker.success();
        } else {
          this.stats.invalid++;
          tracker.fail(new Error('Invalid article data'), pub.id);
        }
        
        this.stats.parsed++;
        
      } catch (error) {
        this.stats.invalid++;
        tracker.fail(error, pub.id || 'unknown');
      }
    }
    
    const summary = tracker.complete();
    this.metadata.totalArticles = this.articles.length;
    
    // Calculate date range
    this.calculateDateRange();
    
    this.logger.success(`Article processing complete: ${this.stats.valid} valid, ${this.stats.invalid} invalid`);
  }

  /**
   * Process a single article from the export
   */
  async processArticle(pub) {
    try {
      // Basic validation
      if (!pub.id || !pub.title || !pub.slug) {
        return null;
      }
      
      // Extract authors
      const authors = this.extractAuthors(pub);
      
      // Extract collections
      const collections = this.extractCollections(pub);
      
      // Extract export URLs (PDFs and other formats)
      const downloads = this.extractDownloadUrls(pub);
      
      // Extract publication dates
      const dates = this.extractDates(pub);
      
      // Calculate publication path for organization
      const pubPath = getPublicationPath(dates.created);
      
      // Build normalized article object
      const article = {
        // Basic information
        id: pub.id,
        slug: pub.slug,
        title: pub.title || '',
        description: pub.description || '',
        htmlTitle: pub.htmlTitle,
        htmlDescription: pub.htmlDescription,
        
        // Academic metadata
        doi: pub.doi || '',
        customPublishedAt: pub.customPublishedAt,
        labels: pub.labels,
        metadata: pub.metadata,
        
        // Authors and attributions
        authors: authors.names,
        authorDetails: authors.details,
        attributions: pub.attributions || [],
        
        // Content and media
        avatar: pub.avatar,
        downloads: downloads,
        hasContent: !!(pub.draft && pub.draft.doc),
        
        // Dates
        createdAt: dates.created,
        updatedAt: dates.updated,
        publishedAt: dates.published,
        
        // Organization
        collections: collections,
        communityId: pub.communityId,
        
        // Publication organization
        publicationPath: pubPath,
        
        // Export metadata
        originalUrl: `https://www.crimrxiv.com/pub/${pub.slug}`,
        exportSource: 'PubPub',
        processed: new Date().toISOString(),
        
        // File information (to be filled during PDF download)
        filePath: null,
        fileSize: 0,
        fileHash: null
      };
      
      return article;
      
    } catch (error) {
      this.logger.error(`Failed to process article: ${pub.id}`, error.message);
      return null;
    }
  }

  /**
   * Extract author information from publication
   */
  extractAuthors(pub) {
    const names = [];
    const details = [];
    
    if (pub.attributions && Array.isArray(pub.attributions)) {
      for (const attribution of pub.attributions) {
        if (attribution.user) {
          names.push(attribution.user.fullName || '');
          details.push({
            name: attribution.user.fullName || '',
            firstName: attribution.user.firstName || '',
            lastName: attribution.user.lastName || '',
            email: attribution.user.email || '',
            orcid: attribution.orcid || attribution.user.orcid || '',
            affiliation: attribution.affiliation || '',
            title: attribution.title || '',
            isAuthor: attribution.isAuthor || false,
            order: attribution.order || 0
          });
        } else if (attribution.name) {
          names.push(attribution.name);
          details.push({
            name: attribution.name,
            affiliation: attribution.affiliation || '',
            title: attribution.title || '',
            orcid: attribution.orcid || '',
            isAuthor: attribution.isAuthor || false,
            order: attribution.order || 0
          });
        }
      }
    }
    
    return { names: names.filter(Boolean), details };
  }

  /**
   * Extract collection information
   */
  extractCollections(pub) {
    const collections = [];
    
    if (pub.collectionPubs && Array.isArray(pub.collectionPubs)) {
      for (const collectionPub of pub.collectionPubs) {
        if (collectionPub.collection) {
          collections.push({
            id: collectionPub.collection.id,
            title: collectionPub.collection.title,
            slug: collectionPub.collection.slug,
            isPublic: collectionPub.collection.isPublic
          });
        }
      }
    }
    
    return collections;
  }

  /**
   * Extract download URLs for various formats
   */
  extractDownloadUrls(pub) {
    const downloads = {};
    
    if (pub.exports && Array.isArray(pub.exports)) {
      for (const exportItem of pub.exports) {
        if (exportItem.format && exportItem.url) {
          downloads[exportItem.format] = {
            url: exportItem.url,
            historyKey: exportItem.historyKey,
            createdAt: exportItem.createdAt
          };
        }
      }
    }
    
    return downloads;
  }

  /**
   * Extract and normalize publication dates
   */
  extractDates(pub) {
    return {
      created: pub.createdAt || null,
      updated: pub.updatedAt || null,
      published: pub.customPublishedAt || pub.createdAt || null
    };
  }

  /**
   * Download PDFs for all articles
   */
  async downloadArticlePDFs() {
    this.logger.info('📥 Starting PDF downloads...');
    
    // Ensure PDF directory exists
    await this.fileHelper.ensureDir(this.options.pdfDir);
    
    const articlesWithPdfs = this.articles.filter(article => 
      article.downloads.pdf && article.downloads.pdf.url
    );
    
    if (articlesWithPdfs.length === 0) {
      this.logger.warning('No articles with PDF downloads found');
      return;
    }
    
    this.logger.info(`Found ${articlesWithPdfs.length} articles with PDFs`);
    
    const tracker = new ProgressTracker(articlesWithPdfs.length, 'Downloading PDFs');
    
    // Download with limited concurrency to be respectful
    const batchSize = 5;
    for (let i = 0; i < articlesWithPdfs.length; i += batchSize) {
      const batch = articlesWithPdfs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(article => 
        this.downloadArticlePDF(article, tracker)
      );
      
      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < articlesWithPdfs.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    tracker.complete();
    
    this.logger.success(`PDF downloads complete: ${this.stats.downloaded} successful, ${this.stats.downloadFailed} failed`);
  }

  /**
   * Download PDF for a single article
   */
  async downloadArticlePDF(article, tracker) {
    const pdfInfo = article.downloads.pdf;
    if (!pdfInfo || !pdfInfo.url) {
      tracker.fail(new Error('No PDF URL'), article.id);
      return;
    }
    
    try {
      const result = await withRetry(async () => {
        return await this.downloadFile(pdfInfo.url, article);
      }, 3, 1000);
      
      if (result.success) {
        article.filePath = result.filePath;
        article.fileSize = result.fileSize;
        article.fileHash = result.fileHash;
        this.stats.downloaded++;
        tracker.success(`📄 ${path.basename(result.filePath)}`);
      } else {
        this.stats.downloadFailed++;
        tracker.fail(new Error(result.error), article.id);
      }
      
    } catch (error) {
      this.stats.downloadFailed++;
      tracker.fail(error, article.id);
    }
  }

  /**
   * Download a file with error handling
   */
  async downloadFile(url, article) {
    try {
      // Create filename based on article info
      const pubPath = article.publicationPath;
      const fileName = `${article.slug || article.id}.pdf`;
      const fullDir = path.join(this.options.pdfDir, pubPath.path);
      const filePath = path.join(fullDir, fileName);
      
      // Ensure directory exists
      await this.fileHelper.ensureDir(fullDir);
      
      // Check if file already exists
      if (await this.fileHelper.exists(filePath)) {
        const fileSize = await this.fileHelper.getFileSize(filePath);
        if (fileSize > 0) {
          return {
            success: true,
            filePath,
            fileSize,
            fileHash: null, // Would need to calculate if needed
            skipped: true
          };
        }
      }
      
      // Download file
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'CrimRxiv-Archive-Bot/1.0'
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Save file
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          try {
            const fileSize = await this.fileHelper.getFileSize(filePath);
            resolve({
              success: true,
              filePath,
              fileSize,
              fileHash: null
            });
          } catch (error) {
            reject(error);
          }
        });
        
        writer.on('error', reject);
        response.data.on('error', reject);
      });
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate processed article data
   */
  async validateArticleData() {
    this.logger.info('🔍 Validating article data...');
    
    const issues = [];
    let validCount = 0;
    
    for (const article of this.articles) {
      const articleIssues = [];
      
      // Required fields
      if (!article.id) articleIssues.push('Missing ID');
      if (!article.title) articleIssues.push('Missing title');
      if (!article.slug) articleIssues.push('Missing slug');
      
      // Recommended fields
      if (!article.description) articleIssues.push('Missing description/abstract');
      if (!article.authors || article.authors.length === 0) articleIssues.push('No authors');
      if (!article.createdAt) articleIssues.push('Missing creation date');
      
      // File validation
      if (this.options.downloadPDFs) {
        if (!article.filePath) {
          articleIssues.push('No PDF file');
        } else if (!await this.fileHelper.exists(article.filePath)) {
          articleIssues.push('PDF file missing');
        }
      }
      
      if (articleIssues.length === 0) {
        validCount++;
      } else {
        issues.push({
          id: article.id,
          title: article.title.substring(0, 50) + '...',
          issues: articleIssues
        });
      }
    }
    
    this.logger.success(`Validation complete: ${validCount} valid, ${issues.length} with issues`);
    
    if (issues.length > 0 && issues.length < 10) {
      this.logger.warning('Articles with issues:');
      issues.forEach(issue => {
        console.log(`  ${issue.id}: ${issue.issues.join(', ')}`);
      });
    }
    
    return { validCount, issues };
  }

  /**
   * Calculate date range of articles
   */
  calculateDateRange() {
    let earliest = null;
    let latest = null;
    
    for (const article of this.articles) {
      const date = new Date(article.createdAt || article.publishedAt);
      if (isNaN(date.getTime())) continue;
      
      if (!earliest || date < earliest) earliest = date;
      if (!latest || date > latest) latest = date;
    }
    
    this.metadata.dateRange = {
      earliest: earliest ? earliest.toISOString() : null,
      latest: latest ? latest.toISOString() : null
    };
  }

  /**
   * Save processed data to disk
   */
  async saveProcessedData() {
    this.logger.info('💾 Saving processed data...');
    
    // Ensure output directory exists
    await this.fileHelper.ensureDir(this.options.outputDir);
    
    // Save individual article files
    this.logger.info('Saving individual article files...');
    const articleTracker = new ProgressTracker(this.articles.length, 'Saving articles');
    
    for (const article of this.articles) {
      const pubPath = article.publicationPath;
      const articleDir = path.join(this.options.outputDir, pubPath.path);
      const articleFile = path.join(articleDir, `${article.slug || article.id}.json`);
      
      await this.fileHelper.ensureDir(articleDir);
      await this.fileHelper.writeJSON(articleFile, article);
      
      articleTracker.success();
    }
    
    articleTracker.complete();
    
    // Save master index file
    const indexFile = path.join(this.options.outputDir, 'articles-index.json');
    await this.fileHelper.writeJSON(indexFile, {
      metadata: this.metadata,
      articles: this.articles.map(article => ({
        id: article.id,
        slug: article.slug,
        title: article.title,
        authors: article.authors,
        createdAt: article.createdAt,
        publicationPath: article.publicationPath,
        filePath: article.filePath,
        originalUrl: article.originalUrl
      })),
      stats: this.stats,
      generated: new Date().toISOString()
    });
    
    // Save metadata file
    const metadataFile = path.join(this.options.outputDir, 'metadata.json');
    await this.fileHelper.writeJSON(metadataFile, this.metadata);
    
    this.logger.success('All data saved successfully');
  }

  /**
   * Generate processing report
   */
  async generateReport() {
    const report = {
      summary: {
        totalParsed: this.stats.parsed,
        validArticles: this.stats.valid,
        invalidArticles: this.stats.invalid,
        duplicates: this.stats.duplicates,
        pdfDownloads: this.stats.downloaded,
        downloadFailures: this.stats.downloadFailed
      },
      metadata: this.metadata,
      dateRange: this.metadata.dateRange,
      collections: this.metadata.collections.length,
      options: this.options,
      processing: {
        started: new Date().toISOString(),
        completed: new Date().toISOString()
      }
    };
    
    // Save report
    const reportFile = path.join('./data', 'import-report.json');
    await this.fileHelper.writeJSON(reportFile, report);
    
    // Print summary to console
    this.logger.success('📊 Import Report Generated');
    console.log(`  Total Articles: ${report.summary.validArticles}`);
    console.log(`  Date Range: ${report.dateRange.earliest?.split('T')[0]} to ${report.dateRange.latest?.split('T')[0]}`);
    console.log(`  Collections: ${report.collections}`);
    console.log(`  PDFs Downloaded: ${report.summary.pdfDownloads}`);
    console.log(`  Report saved: ${reportFile}`);
    
    return report;
  }
}