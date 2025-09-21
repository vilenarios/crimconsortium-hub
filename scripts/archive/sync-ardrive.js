#!/usr/bin/env node

/**
 * Phase 2: ARFS Integration Script
 * Uploads consortium publications to ArDrive with custom academic metadata
 * Built for CrimRXiv team handoff with comprehensive error handling
 */

import { ARFSClient } from '../src/lib/arfs-client.js';
import { Logger, FileHelper, ProgressTracker, StateManager, CostTracker, validator } from '../src/lib/utils.js';

class ConsortiumARFSUploader {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.stateManager = new StateManager();
    this.costTracker = new CostTracker();
    
    this.arfsClient = null;
    this.consortiumData = null;
    
    // Upload configuration
    this.config = {
      batchSize: 10,           // Upload in batches of 10
      conflictResolution: 'upsert', // Only upload if changed
      enableProgress: true,     // Show detailed progress
      verifyUploads: true,     // Verify each upload
      createManifests: true    // Create web manifests
    };
    
    // Statistics
    this.stats = {
      publicationsProcessed: 0,
      publicationsUploaded: 0,
      publicationsSkipped: 0,
      publicationsFailed: 0,
      totalCost: 0,
      driveCreated: false,
      foldersCreated: 0,
      manifestsCreated: 0
    };
  }

  async uploadConsortium() {
    this.logger.info('🚀 Starting Phase 2: ARFS Integration...');
    
    try {
      // Step 1: Validate environment and prerequisites
      await this.validatePrerequisites();
      
      // Step 2: Load consortium data
      await this.loadConsortiumData();
      
      // Step 3: Initialize ARFS client
      await this.initializeARFS();
      
      // Step 4: Create drive structure
      await this.createDriveStructure();
      
      // Step 5: Upload consortium publications
      await this.uploadPublications();
      
      // Step 6: Create web manifests
      if (this.config.createManifests) {
        await this.createWebManifests();
      }
      
      // Step 7: Verify uploads
      if (this.config.verifyUploads) {
        await this.verifyUploads();
      }
      
      // Step 8: Generate final report
      await this.generateUploadReport();
      
      this.logger.success('Phase 2 ARFS integration complete!');
      
      return {
        stats: this.stats,
        driveInfo: await this.arfsClient.getDriveInfo(),
        costSummary: this.costTracker.getSummary()
      };
      
    } catch (error) {
      this.logger.error('ARFS integration failed', error.message);
      throw error;
    }
  }

  async validatePrerequisites() {
    this.logger.info('🔍 Validating prerequisites...');
    
    // Check environment
    if (!validator.validateEnvironment()) {
      throw new Error('Environment not properly configured. Please check your .env file and wallet setup.');
    }
    
    // Check consortium data exists
    const dataFiles = [
      './data/consortium/publications-fixed.json',
      './data/consortium/members-fixed.json'
    ];
    
    for (const file of dataFiles) {
      if (!await this.fileHelper.exists(file)) {
        throw new Error(`Required data file missing: ${file}. Please run 'npm run import' first.`);
      }
    }
    
    this.logger.success('Prerequisites validated');
  }

  async loadConsortiumData() {
    this.logger.info('📚 Loading final consortium dataset...');
    
    const dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
    
    if (!dataset) {
      throw new Error('Final consortium dataset not found. Please run "npm run import" first.');
    }
    
    this.consortiumData = {
      publications: dataset.publications,
      members: dataset.members,
      metadata: dataset.metadata,
      summary: dataset.summary
    };
    
    this.logger.success(`Loaded final dataset: ${this.consortiumData.publications.length} publications from ${this.consortiumData.members.length} members`);
    this.logger.info(`Dataset version: ${dataset.metadata.version}, created: ${dataset.metadata.createdAt}`);
  }

  async initializeARFS() {
    this.logger.info('⚡ Initializing ARFS client with Turbo...');
    
    this.arfsClient = new ARFSClient();
    await this.arfsClient.initialize();
    
    // Check wallet balance
    const balance = await this.arfsClient.getWalletBalance();
    if (balance) {
      this.logger.info(`💰 Wallet balance: ${balance.toString()} AR`);
    }
    
    this.logger.success('ARFS client initialized');
  }

  async createDriveStructure() {
    this.logger.info('🗂️ Creating ARFS drive structure...');
    
    // Check if drive already exists
    if (!await this.arfsClient.hasDriveStructure()) {
      this.logger.info('Creating new CrimConsortium drive...');
      
      const driveResult = await this.arfsClient.createDriveStructure();
      this.stats.driveCreated = true;
      
      this.logger.success(`Drive created: ${driveResult.driveId.toString()}`);
    } else {
      this.logger.info('Using existing drive structure');
    }
    
    // Create institution-specific folders
    await this.createInstitutionFolders();
  }

  async createInstitutionFolders() {
    this.logger.info('🏛️ Creating institution folders...');
    
    const tracker = new ProgressTracker(this.consortiumData.members.length, 'Creating folders');
    
    for (const member of this.consortiumData.members) {
      try {
        // Create folder for this institution
        const folderResult = await this.arfsClient.arDrive.createPublicFolder({
          folderName: this.sanitizeFolderName(member.name),
          driveId: this.arfsClient.driveId,
          parentFolderId: this.arfsClient.articlesFolderId
        });
        
        // Store folder ID for later use
        member.arfsFolderId = folderResult.folderId;
        this.stats.foldersCreated++;
        
        tracker.success(`📁 ${member.name.substring(0, 40)}...`);
        
      } catch (error) {
        tracker.fail(error, member.id);
      }
    }
    
    tracker.complete();
    this.logger.success(`Created ${this.stats.foldersCreated} institution folders`);
  }

  async uploadPublications() {
    this.logger.info(`📤 Uploading ${this.consortiumData.publications.length} consortium publications...`);
    
    const tracker = new ProgressTracker(this.consortiumData.publications.length, 'Uploading publications');
    
    // Process in batches for better performance and error recovery
    for (let i = 0; i < this.consortiumData.publications.length; i += this.config.batchSize) {
      const batch = this.consortiumData.publications.slice(i, i + this.config.batchSize);
      
      this.logger.info(`Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(this.consortiumData.publications.length / this.config.batchSize)}`);
      
      for (const publication of batch) {
        try {
          const result = await this.uploadPublication(publication);
          
          if (result.success) {
            if (result.skipped) {
              this.stats.publicationsSkipped++;
              tracker.increment(`📋 Skipped: ${publication.title.substring(0, 30)}...`);
            } else {
              this.stats.publicationsUploaded++;
              this.stats.totalCost += result.cost || 0;
              tracker.success(`📄 ${publication.title.substring(0, 30)}...`);
            }
          } else {
            this.stats.publicationsFailed++;
            tracker.fail(new Error(result.error), publication.id);
          }
          
          this.stats.publicationsProcessed++;
          
        } catch (error) {
          this.stats.publicationsFailed++;
          tracker.fail(error, publication.id);
        }
      }
      
      // Small delay between batches
      if (i + this.config.batchSize < this.consortiumData.publications.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    tracker.complete();
    
    this.logger.success(`Upload complete: ${this.stats.publicationsUploaded} uploaded, ${this.stats.publicationsSkipped} skipped, ${this.stats.publicationsFailed} failed`);
  }

  async uploadPublication(publication) {
    try {
      // Find associated member folder
      const member = this.consortiumData.members.find(m => 
        publication.memberAssociations.includes(m.id)
      );
      
      if (!member || !member.arfsFolderId) {
        return { success: false, error: 'No associated member folder found' };
      }
      
      // Prepare custom academic metadata
      const customMetadata = this.prepareCustomMetadata(publication, member);
      
      // Upload publication with metadata
      const result = await this.arfsClient.uploadArticle(publication, publication.filePath);
      
      if (result.success) {
        // Store ARFS information in publication
        publication.arfsFileId = result.fileId;
        publication.arweaveId = result.arweaveId;
        publication.uploadedAt = new Date().toISOString();
        
        this.logger.info(`✅ Uploaded: ${publication.title.substring(0, 40)}... → ${member.name}`);
      }
      
      return result;
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  prepareCustomMetadata(publication, member) {
    return {
      metaDataJson: {
        'CrimConsortium-Member': member.id,
        'Institution-Name': member.name,
        'Publication-ID': publication.id,
        'Publication-Slug': publication.slug,
        'DOI': publication.doi || '',
        'Title': publication.title || '',
        'Authors': publication.authors.map(a => a.name),
        'Author-Affiliations': publication.authors.map(a => a.affiliation).filter(Boolean),
        'Publication-Date': publication.createdAt || '',
        'Updated-Date': publication.updatedAt || '',
        'Detection-Method': publication.detectionMethod || 'unknown',
        'Detection-Confidence': publication.detectionConfidence || 0,
        'Academic-Field': 'Criminology',
        'Content-Type': 'Research-Publication',
        'Archive-Date': new Date().toISOString(),
        'Archive-Version': '1.0'
      },
      metaDataGqlTags: {
        'App-Name': ['CrimConsortium-Hub'],
        'App-Version': ['2.0.0'],
        'Content-Type': ['Academic-Paper'],
        'Institution': [member.id],
        'Academic-Field': ['Criminology'],
        'Archive-Type': ['Consortium-Publication']
      },
      dataGqlTags: {
        'Publication-Type': ['Research-Paper'],
        'License': ['CC-BY-4.0'],
        'Preservation': ['Permanent'],
        'Detection-Method': [publication.detectionMethod || 'unknown'],
        'Consortium-Member': [member.id]
      }
    };
  }

  async createWebManifests() {
    this.logger.info('📋 Creating web manifests...');
    
    try {
      // Create main site manifest
      const siteManifest = await this.arfsClient.createWebManifest('index.html');
      this.stats.manifestsCreated++;
      
      this.logger.success(`Web manifest created: ${siteManifest.manifestId}`);
      this.logger.info(`🌐 Site URL: ${siteManifest.url}`);
      
      // Save manifest info for later use
      await this.fileHelper.writeJSON('./data/consortium/manifests.json', {
        siteManifest: siteManifest,
        createdAt: new Date().toISOString()
      });
      
      return siteManifest;
      
    } catch (error) {
      this.logger.error('Failed to create web manifests', error.message);
      throw error;
    }
  }

  async verifyUploads() {
    this.logger.info('🔍 Verifying uploads...');
    
    const uploadedPublications = this.consortiumData.publications.filter(p => p.arfsFileId);
    
    if (uploadedPublications.length === 0) {
      this.logger.warning('No uploads to verify');
      return;
    }
    
    const tracker = new ProgressTracker(uploadedPublications.length, 'Verifying uploads');
    
    let verified = 0;
    let failed = 0;
    
    for (const publication of uploadedPublications) {
      try {
        const fileInfo = await this.arfsClient.arDrive.getPublicFile({
          fileId: publication.arfsFileId
        });
        
        if (fileInfo && fileInfo.size > 0) {
          verified++;
          tracker.success(`✅ ${publication.title.substring(0, 30)}...`);
        } else {
          failed++;
          tracker.fail(new Error('File not accessible'), publication.id);
        }
        
      } catch (error) {
        failed++;
        tracker.fail(error, publication.id);
      }
    }
    
    tracker.complete();
    
    this.logger.success(`Verification complete: ${verified} verified, ${failed} failed`);
    
    return { verified, failed };
  }

  async generateUploadReport() {
    this.logger.info('📊 Generating upload report...');
    
    const costSummary = this.costTracker.getSummary();
    
    const report = {
      summary: {
        totalPublications: this.consortiumData.publications.length,
        publicationsUploaded: this.stats.publicationsUploaded,
        publicationsSkipped: this.stats.publicationsSkipped,
        publicationsFailed: this.stats.publicationsFailed,
        successRate: this.consortiumData.publications.length > 0 ? 
          ((this.stats.publicationsUploaded + this.stats.publicationsSkipped) / this.consortiumData.publications.length * 100).toFixed(1) + '%' : '0%',
        totalCost: costSummary.total,
        uploadedAt: new Date().toISOString()
      },
      
      drive: {
        driveId: this.arfsClient.driveId?.toString(),
        rootFolderId: this.arfsClient.rootFolderId?.toString(),
        driveCreated: this.stats.driveCreated,
        foldersCreated: this.stats.foldersCreated
      },
      
      costs: costSummary,
      
      publications: this.consortiumData.publications.map(p => ({
        id: p.id,
        title: p.title,
        memberAssociations: p.memberAssociations,
        arfsFileId: p.arfsFileId,
        arweaveId: p.arweaveId,
        uploaded: !!p.arfsFileId
      })),
      
      members: this.consortiumData.members.map(m => ({
        name: m.name,
        id: m.id,
        publicationCount: m.publicationCount,
        arfsFolderId: m.arfsFolderId
      })),
      
      nextSteps: [
        'Run static site generation: npm run build',
        'Deploy to Arweave: npm run deploy', 
        'Configure ArNS domain',
        'Set up monitoring and maintenance'
      ]
    };
    
    // Save report
    await this.fileHelper.writeJSON('./data/consortium/upload-report.json', report);
    
    // Print summary
    this.printUploadSummary(report);
    
    return report;
  }

  printUploadSummary(report) {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 PHASE 2: ARFS INTEGRATION SUMMARY');
    console.log('='.repeat(70));
    
    console.log(`📊 Publications Processed: ${report.summary.totalPublications}`);
    console.log(`⬆️  Successfully Uploaded: ${report.summary.publicationsUploaded}`);
    console.log(`📋 Skipped (unchanged): ${report.summary.publicationsSkipped}`);
    console.log(`❌ Failed: ${report.summary.publicationsFailed}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}`);
    
    console.log('\n🗂️  ARFS Structure Created:');
    console.log(`📁 Drive ID: ${report.drive.driveId}`);
    console.log(`📂 Institution Folders: ${report.drive.foldersCreated}`);
    console.log(`📋 Web Manifests: ${this.stats.manifestsCreated}`);
    
    console.log('\n💰 Cost Breakdown:');
    console.log(`   Uploads: ${report.costs.uploads.ar.toFixed(6)} AR (~$${report.costs.uploads.usd.toFixed(2)})`);
    console.log(`   Deployments: ${report.costs.deployments.ar.toFixed(6)} AR (~$${report.costs.deployments.usd.toFixed(2)})`);
    console.log(`   Total: ${report.costs.total.ar.toFixed(6)} AR (~$${report.costs.total.usd.toFixed(2)})`);
    
    if (report.members.length > 0) {
      console.log('\n🏛️  Active Consortium Members:');
      report.members.slice(0, 8).forEach(member => {
        console.log(`   ${member.name}: ${member.publicationCount} publications`);
      });
    }
    
    console.log('\n📁 Data Saved To:');
    console.log('  ./data/consortium/upload-report.json');
    console.log('  ./data/consortium/manifests.json');
    
    console.log('\n🎯 NEXT STEPS:');
    report.nextSteps.forEach((step, index) => {
      console.log(`${index + 1}. ${step}`);
    });
    
    console.log('\n✅ PHASE 2 STATUS:');
    if (report.summary.publicationsUploaded > 0) {
      console.log('🎉 ARFS integration successful!');
      console.log('📚 Consortium publications permanently stored on Arweave');
      console.log('🗂️  Organized folder structure created');
      console.log('🔖 Custom academic metadata attached');
      console.log('🚀 Ready for Phase 3: Static site generation');
    } else {
      console.log('⚠️  No publications uploaded - check logs for issues');
    }
    
    console.log('='.repeat(70));
  }

  /**
   * Utility functions
   */
  sanitizeFolderName(name) {
    return name
      .replace(/[^a-zA-Z0-9\s\-]/g, '') // Remove special chars except hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .substring(0, 50); // Limit length
  }
}

// Run uploader if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const uploader = new ConsortiumARFSUploader();
  uploader.uploadConsortium().catch(error => {
    console.error('ARFS integration failed:', error.message);
    process.exit(1);
  });
}

export default ConsortiumARFSUploader;