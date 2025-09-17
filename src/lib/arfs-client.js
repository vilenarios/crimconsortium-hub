/**
 * ARFS Client with Turbo Integration
 * Team-friendly wrapper for ArDrive operations with built-in error handling
 */

import { readJWKFile, arDriveFactory, wrapFileOrFolder } from 'ardrive-core-js';
import { Logger, FileHelper, StateManager, CostTracker, ProgressTracker, withRetry } from './utils.js';
import path from 'path';
import fs from 'fs-extra';

export class ARFSClient {
  constructor(walletPath = process.env.ARWEAVE_WALLET_PATH) {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.stateManager = new StateManager();
    this.costTracker = new CostTracker();
    
    this.walletPath = walletPath;
    this.wallet = null;
    this.arDrive = null;
    
    // ARFS structure IDs (loaded from state)
    this.driveId = null;
    this.rootFolderId = null;
    this.articlesFolderId = null;
    this.metadataFolderId = null;
    this.siteFolderId = null;
    this.backupsFolderId = null;
    
    // Folder cache for performance
    this.folderCache = new Map();
    
    // Upload statistics
    this.stats = {
      totalUploaded: 0,
      totalFailed: 0,
      totalCost: 0,
      lastSync: null
    };
  }

  /**
   * Initialize the ARFS client with wallet and drive setup
   */
  async initialize() {
    this.logger.info('🚀 Initializing ARFS client...');
    
    try {
      // Load wallet
      this.logger.info('📝 Loading Arweave wallet...');
      this.wallet = readJWKFile(this.walletPath);
      
      // Initialize ArDrive with Turbo
      this.logger.info('⚡ Initializing ArDrive with Turbo...');
      this.arDrive = arDriveFactory({ 
        wallet: this.wallet,
        turboSettings: {} // Enable Turbo optimization
      });
      
      // Initialize state manager
      await this.stateManager.init();
      
      // Load existing state if available
      await this.loadState();
      
      this.logger.success('ARFS client initialized successfully');
      return true;
      
    } catch (error) {
      this.logger.error('Failed to initialize ARFS client', error.message);
      throw error;
    }
  }

  /**
   * Create the main drive and folder structure
   */
  async createDriveStructure() {
    this.logger.info('🗂️ Creating ARFS drive structure...');
    
    try {
      // Create main drive
      this.logger.info('📁 Creating CrimRXiv Archive drive...');
      const driveResult = await this.arDrive.createPublicDrive({
        driveName: 'CrimRXiv-Archive'
      });
      
      this.driveId = driveResult.driveId;
      this.rootFolderId = driveResult.rootFolderId;
      
      this.logger.success('Main drive created', 
        `Drive ID: ${this.driveId.toString()}`);
      
      // Create folder structure
      await this.createFolderHierarchy();
      
      // Save state
      await this.saveState();
      
      return {
        driveId: this.driveId,
        rootFolderId: this.rootFolderId
      };
      
    } catch (error) {
      this.logger.error('Failed to create drive structure', error.message);
      throw error;
    }
  }

  /**
   * Create the organized folder hierarchy
   */
  async createFolderHierarchy() {
    this.logger.info('📂 Creating folder hierarchy...');
    
    const folders = [
      { name: 'articles', description: 'Main articles storage' },
      { name: 'metadata', description: 'Search indices and metadata' },
      { name: 'site', description: 'Static website files' },
      { name: 'backups', description: 'Backup files and exports' }
    ];
    
    for (const folder of folders) {
      this.logger.info(`Creating folder: ${folder.name}`);
      
      const result = await this.arDrive.createPublicFolder({
        folderName: folder.name,
        driveId: this.driveId,
        parentFolderId: this.rootFolderId
      });
      
      // Store folder IDs
      switch (folder.name) {
        case 'articles':
          this.articlesFolderId = result.folderId;
          break;
        case 'metadata':
          this.metadataFolderId = result.folderId;
          break;
        case 'site':
          this.siteFolderId = result.folderId;
          break;
        case 'backups':
          this.backupsFolderId = result.folderId;
          break;
      }
      
      this.logger.success(`${folder.name} folder created`);
    }
    
    // Create year folders in articles directory
    await this.createYearFolders();
  }

  /**
   * Create year-based folder structure for articles
   */
  async createYearFolders() {
    this.logger.info('📅 Creating year-based folder structure...');
    
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // Create folders for 2020 to current year
    for (let year = 2020; year <= currentYear; year++) {
      years.push(year.toString());
    }
    
    for (const year of years) {
      const yearResult = await this.arDrive.createPublicFolder({
        folderName: year,
        driveId: this.driveId,
        parentFolderId: this.articlesFolderId
      });
      
      this.folderCache.set(year, yearResult.folderId);
      
      // Create month folders for current year
      if (year === currentYear.toString()) {
        await this.createMonthFolders(yearResult.folderId, parseInt(year));
      }
    }
    
    this.logger.success('Year folders created');
  }

  /**
   * Create month folders for a specific year
   */
  async createMonthFolders(yearFolderId, year) {
    const months = [
      '01-january', '02-february', '03-march', '04-april',
      '05-may', '06-june', '07-july', '08-august', 
      '09-september', '10-october', '11-november', '12-december'
    ];
    
    const currentMonth = new Date().getMonth();
    const isCurrentYear = year === new Date().getFullYear();
    
    for (let i = 0; i < months.length; i++) {
      // Only create months up to current month for current year
      if (isCurrentYear && i > currentMonth) break;
      
      const monthResult = await this.arDrive.createPublicFolder({
        folderName: months[i],
        driveId: this.driveId,
        parentFolderId: yearFolderId
      });
      
      this.folderCache.set(`${year}/${months[i]}`, monthResult.folderId);
    }
  }

  /**
   * Get or create folder for article based on publication date
   */
  async getArticleFolder(publicationDate) {
    const date = new Date(publicationDate);
    const year = date.getFullYear().toString();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const monthName = date.toLocaleDateString('en-US', { month: 'long' }).toLowerCase();
    const folderName = `${month}-${monthName}`;
    const folderPath = `${year}/${folderName}`;
    
    // Check cache first
    if (this.folderCache.has(folderPath)) {
      return this.folderCache.get(folderPath);
    }
    
    // Get year folder
    let yearFolderId = this.folderCache.get(year);
    if (!yearFolderId) {
      // Create year folder if it doesn't exist
      const yearResult = await this.arDrive.createPublicFolder({
        folderName: year,
        driveId: this.driveId,
        parentFolderId: this.articlesFolderId
      });
      yearFolderId = yearResult.folderId;
      this.folderCache.set(year, yearFolderId);
    }
    
    // Get or create month folder
    const monthResult = await this.arDrive.createPublicFolder({
      folderName: folderName,
      driveId: this.driveId,
      parentFolderId: yearFolderId
    });
    
    this.folderCache.set(folderPath, monthResult.folderId);
    return monthResult.folderId;
  }

  /**
   * Upload a single article with metadata
   */
  async uploadArticle(articleData, filePath) {
    try {
      // Get appropriate folder based on publication date
      const folderId = await this.getArticleFolder(articleData.createdAt);
      
      // Prepare custom metadata
      const customMetadata = this.prepareArticleMetadata(articleData);
      
      // Wrap file with metadata
      const wrappedFile = wrapFileOrFolder(filePath, 'application/pdf', customMetadata);
      
      // Upload with conflict resolution
      const result = await this.arDrive.uploadPublicFile({
        parentFolderId: folderId,
        wrappedFile,
        conflictResolution: 'upsert' // Only upload if content changed
      });
      
      // Track costs
      if (result.fastFinalityIndexes && result.fastFinalityIndexes.length > 0) {
        // Estimate cost based on file size
        const fileSize = await this.fileHelper.getFileSize(filePath);
        const estimatedCost = fileSize * 0.000000001; // Rough estimate
        this.costTracker.addUploadCost(estimatedCost, 
          `Article: ${articleData.title?.substring(0, 50)}...`);
      }
      
      return {
        success: true,
        fileId: result.created[0]?.fileId,
        arweaveId: result.created[0]?.dataTxId,
        cost: result.cost || 0,
        skipped: result.created.length === 0 // File was unchanged
      };
      
    } catch (error) {
      this.logger.error(`Failed to upload article: ${articleData.id}`, error.message);
      return {
        success: false,
        error: error.message,
        articleId: articleData.id
      };
    }
  }

  /**
   * Bulk upload articles with progress tracking
   */
  async bulkUploadArticles(articles, options = {}) {
    const {
      batchSize = 50,
      progressCallback = null
    } = options;
    
    this.logger.info(`📤 Starting bulk upload of ${articles.length} articles...`);
    
    const tracker = new ProgressTracker(articles.length, 'Uploading articles');
    const results = {
      successful: [],
      failed: [],
      skipped: [],
      totalCost: 0
    };
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      
      this.logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)}`);
      
      // Process batch in parallel with limited concurrency
      const batchPromises = batch.map(async (article) => {
        const result = await this.uploadArticle(article, article.filePath);
        
        if (result.success) {
          if (result.skipped) {
            results.skipped.push(article.id);
            tracker.increment('📋 Skipped (unchanged)');
          } else {
            results.successful.push({
              articleId: article.id,
              fileId: result.fileId,
              arweaveId: result.arweaveId
            });
            results.totalCost += result.cost;
            tracker.success('✅ Uploaded');
          }
        } else {
          results.failed.push({
            articleId: article.id,
            error: result.error
          });
          tracker.fail(new Error(result.error), article.id);
        }
        
        if (progressCallback) {
          progressCallback(tracker.current, tracker.total);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches to be respectful
      if (i + batchSize < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const summary = tracker.complete();
    
    // Update statistics
    this.stats.totalUploaded += results.successful.length;
    this.stats.totalFailed += results.failed.length;
    this.stats.totalCost += results.totalCost;
    this.stats.lastSync = new Date().toISOString();
    
    // Save updated state
    await this.saveState();
    
    // Print cost summary
    this.costTracker.printSummary();
    
    return {
      ...results,
      summary,
      statistics: this.stats
    };
  }

  /**
   * Prepare custom metadata for article
   */
  prepareArticleMetadata(article) {
    return {
      metaDataJson: {
        'CrimRXiv-ID': article.id,
        'DOI': article.doi || '',
        'Title': article.title || '',
        'Publication-Date': article.createdAt || '',
        'Authors': (article.attributions || []).map(a => a.user?.fullName || a.name).filter(Boolean),
        'Abstract': (article.description || '').substring(0, 500), // Limit for metadata
        'Keywords': article.keywords || [],
        'Export-Source': 'PubPub',
        'Last-Updated': new Date().toISOString(),
        'Archive-Version': '1.0'
      },
      metaDataGqlTags: {
        'App-Name': ['CrimRXiv-Archive'],
        'App-Version': ['2.0.0'],
        'Content-Type': ['Academic-Paper'],
        'Archive-Date': [new Date().toISOString().split('T')[0]]
      },
      dataGqlTags: {
        'Article-Type': ['Research-Paper'],
        'Academic-Field': ['Criminology'],
        'License': ['CC-BY-4.0'],
        'Preservation': ['Permanent']
      }
    };
  }

  /**
   * Upload website files to ARFS
   */
  async uploadSite(siteDir) {
    this.logger.info('🌐 Uploading static site to ARFS...');
    
    try {
      const result = await this.arDrive.uploadAllEntities({
        entitiesToUpload: [{
          wrappedEntity: wrapFileOrFolder(siteDir),
          destFolderId: this.siteFolderId
        }],
        conflictResolution: 'replace' // Always update site files
      });
      
      this.logger.success('Site uploaded successfully');
      
      return {
        success: true,
        created: result.created,
        cost: result.totalCost
      };
      
    } catch (error) {
      this.logger.error('Failed to upload site', error.message);
      throw error;
    }
  }

  /**
   * Create web manifest for browser access
   */
  async createWebManifest(indexFile = 'index.html') {
    this.logger.info('📋 Creating web manifest...');
    
    try {
      const manifest = await this.arDrive.uploadPublicManifest({
        folderId: this.siteFolderId,
        destManifestName: indexFile,
        conflictResolution: 'replace'
      });
      
      this.logger.success('Web manifest created', 
        `Manifest ID: ${manifest.manifestId}`);
      
      return {
        manifestId: manifest.manifestId,
        url: `https://arweave.net/${manifest.manifestId}`
      };
      
    } catch (error) {
      this.logger.error('Failed to create web manifest', error.message);
      throw error;
    }
  }

  /**
   * Verify uploaded files
   */
  async verifyUploads(uploadResults) {
    this.logger.info('🔍 Verifying uploads...');
    
    const verificationTracker = new ProgressTracker(
      uploadResults.successful.length, 
      'Verifying files'
    );
    
    let verified = 0;
    let failed = 0;
    
    for (const upload of uploadResults.successful) {
      try {
        // Check if file exists and is accessible
        const fileInfo = await this.arDrive.getPublicFile({ 
          fileId: upload.fileId 
        });
        
        if (fileInfo) {
          verified++;
          verificationTracker.success();
        } else {
          failed++;
          verificationTracker.fail(new Error('File not found'), upload.articleId);
        }
        
      } catch (error) {
        failed++;
        verificationTracker.fail(error, upload.articleId);
      }
    }
    
    verificationTracker.complete();
    
    this.logger.success(`Verification complete`, 
      `${verified} verified, ${failed} failed`);
    
    return { verified, failed };
  }

  /**
   * Save current state
   */
  async saveState() {
    const state = {
      driveId: this.driveId?.toString(),
      rootFolderId: this.rootFolderId?.toString(),
      articlesFolderId: this.articlesFolderId?.toString(),
      metadataFolderId: this.metadataFolderId?.toString(),
      siteFolderId: this.siteFolderId?.toString(),
      backupsFolderId: this.backupsFolderId?.toString(),
      folderCache: Object.fromEntries(this.folderCache),
      stats: this.stats,
      walletAddress: this.wallet ? await this.arDrive.getWalletAddress() : null
    };
    
    return await this.stateManager.saveState('arfs', state);
  }

  /**
   * Load existing state
   */
  async loadState() {
    const state = await this.stateManager.loadState('arfs');
    
    if (state) {
      this.driveId = state.driveId;
      this.rootFolderId = state.rootFolderId;
      this.articlesFolderId = state.articlesFolderId;
      this.metadataFolderId = state.metadataFolderId;
      this.siteFolderId = state.siteFolderId;
      this.backupsFolderId = state.backupsFolderId;
      
      // Restore folder cache
      if (state.folderCache) {
        this.folderCache = new Map(Object.entries(state.folderCache));
      }
      
      // Restore statistics
      if (state.stats) {
        this.stats = { ...this.stats, ...state.stats };
      }
      
      this.logger.info('ARFS state loaded from previous session');
      return true;
    }
    
    return false;
  }

  /**
   * Check if drive structure exists
   */
  async hasDriveStructure() {
    return !!(this.driveId && this.rootFolderId && this.articlesFolderId);
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance() {
    try {
      const balance = await this.wallet.getBalance();
      return balance;
    } catch (error) {
      this.logger.error('Failed to get wallet balance', error.message);
      return null;
    }
  }

  /**
   * Get drive information
   */
  async getDriveInfo() {
    if (!this.driveId) return null;
    
    try {
      const driveInfo = await this.arDrive.getPublicDrive({ 
        driveId: this.driveId 
      });
      return driveInfo;
    } catch (error) {
      this.logger.error('Failed to get drive info', error.message);
      return null;
    }
  }
}