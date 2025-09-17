#!/usr/bin/env node

/**
 * Incremental Sync State Management
 * Ensures fault-tolerant, resumable uploads with proper state tracking
 * Critical for CrimRXiv team operations
 */

import { Logger, FileHelper, StateManager } from '../src/lib/utils.js';
import crypto from 'crypto';

class IncrementalSyncManager {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.stateManager = new StateManager();
    
    this.uploadState = {
      version: '1.0',
      driveInfo: {
        driveId: null,
        rootFolderId: null,
        institutionFolders: {}
      },
      uploadedPublications: {},
      failedUploads: [],
      lastSync: null,
      totalUploaded: 0,
      totalCost: 0,
      batchNumber: 0
    };
  }

  /**
   * Load or initialize upload state
   */
  async loadUploadState() {
    this.logger.info('📋 Loading upload state...');
    
    const state = await this.stateManager.loadState('arfs-upload');
    
    if (state) {
      this.uploadState = { ...this.uploadState, ...state };
      this.logger.success(`State loaded: ${this.uploadState.totalUploaded} publications previously uploaded`);
    } else {
      this.logger.info('No previous state found - starting fresh');
    }
    
    return this.uploadState;
  }

  /**
   * Save upload state after successful operations
   */
  async saveUploadState() {
    this.uploadState.lastSync = new Date().toISOString();
    this.uploadState.batchNumber++;
    
    return await this.stateManager.saveState('arfs-upload', this.uploadState);
  }

  /**
   * Check if publication needs upload
   */
  async needsUpload(publication) {
    const existing = this.uploadState.uploadedPublications[publication.id];
    
    if (!existing) {
      return { needsUpload: true, reason: 'new publication' };
    }
    
    // Check if file content changed
    if (publication.filePath) {
      try {
        const currentHash = await this.calculateFileHash(publication.filePath);
        if (currentHash !== existing.fileHash) {
          return { needsUpload: true, reason: 'content changed' };
        }
      } catch (error) {
        return { needsUpload: true, reason: 'hash calculation failed' };
      }
    }
    
    // Check if upload failed previously
    if (!existing.arfsFileId || !existing.arweaveId) {
      return { needsUpload: true, reason: 'previous upload incomplete' };
    }
    
    // Check if in failed uploads list
    if (this.uploadState.failedUploads.some(failed => failed.publicationId === publication.id)) {
      return { needsUpload: true, reason: 'retry failed upload' };
    }
    
    return { needsUpload: false, reason: 'already uploaded and unchanged' };
  }

  /**
   * Record successful upload
   */
  async recordSuccessfulUpload(publication, uploadResult) {
    const fileHash = publication.filePath ? 
      await this.calculateFileHash(publication.filePath) : null;
    
    this.uploadState.uploadedPublications[publication.id] = {
      arfsFileId: uploadResult.fileId,
      arweaveId: uploadResult.arweaveId,
      uploadedAt: new Date().toISOString(),
      fileHash: fileHash,
      fileSize: publication.fileSize || 0,
      memberAssociations: publication.memberAssociations || [],
      cost: uploadResult.cost || 0
    };
    
    this.uploadState.totalUploaded++;
    this.uploadState.totalCost += uploadResult.cost || 0;
    
    // Remove from failed uploads if present
    this.uploadState.failedUploads = this.uploadState.failedUploads.filter(
      failed => failed.publicationId !== publication.id
    );
    
    this.logger.info(`✅ Recorded successful upload: ${publication.title.substring(0, 40)}...`);
  }

  /**
   * Record failed upload for retry tracking
   */
  async recordFailedUpload(publication, error) {
    const failedUpload = {
      publicationId: publication.id,
      title: publication.title,
      error: error.message,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    
    // Check if already in failed list
    const existingIndex = this.uploadState.failedUploads.findIndex(
      failed => failed.publicationId === publication.id
    );
    
    if (existingIndex >= 0) {
      this.uploadState.failedUploads[existingIndex].retryCount++;
      this.uploadState.failedUploads[existingIndex].error = error.message;
      this.uploadState.failedUploads[existingIndex].timestamp = new Date().toISOString();
    } else {
      this.uploadState.failedUploads.push(failedUpload);
    }
    
    this.logger.error(`❌ Recorded failed upload: ${publication.title.substring(0, 40)}...`);
  }

  /**
   * Get upload statistics
   */
  getUploadStats() {
    return {
      totalUploaded: this.uploadState.totalUploaded,
      totalCost: this.uploadState.totalCost,
      failedUploads: this.uploadState.failedUploads.length,
      lastSync: this.uploadState.lastSync,
      batchNumber: this.uploadState.batchNumber,
      driveConfigured: !!this.uploadState.driveInfo.driveId
    };
  }

  /**
   * Get publications that need upload
   */
  async getPublicationsToUpload(allPublications) {
    const toUpload = [];
    const toSkip = [];
    
    for (const publication of allPublications) {
      const check = await this.needsUpload(publication);
      
      if (check.needsUpload) {
        toUpload.push({
          publication,
          reason: check.reason
        });
      } else {
        toSkip.push({
          publication,
          reason: check.reason
        });
      }
    }
    
    this.logger.info(`📊 Upload analysis: ${toUpload.length} to upload, ${toSkip.length} to skip`);
    
    return { toUpload, toSkip };
  }

  /**
   * Store drive and folder information
   */
  async storeDriveInfo(driveId, rootFolderId, institutionFolders = {}) {
    this.uploadState.driveInfo = {
      driveId: driveId?.toString(),
      rootFolderId: rootFolderId?.toString(),
      institutionFolders: Object.fromEntries(
        Object.entries(institutionFolders).map(([key, value]) => [key, value?.toString()])
      )
    };
    
    await this.saveUploadState();
    this.logger.success('Drive information stored');
  }

  /**
   * Calculate file hash for change detection
   */
  async calculateFileHash(filePath) {
    try {
      const fileBuffer = await this.fileHelper.readJSON(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      // If file read fails, return a timestamp-based hash
      const stats = await fs.stat(filePath);
      return crypto.createHash('sha256').update(stats.mtime.toISOString()).digest('hex');
    }
  }

  /**
   * Generate sync report for team visibility
   */
  async generateSyncReport() {
    const report = {
      status: 'ready',
      dataset: {
        source: './data/final/consortium-dataset.json',
        totalPublications: 0,
        totalMembers: 0
      },
      uploadState: this.getUploadStats(),
      lastUpdated: new Date().toISOString(),
      nextRecommendedSync: new Date(Date.now() + 7*24*60*60*1000).toISOString() // 1 week
    };
    
    // Load dataset info if available
    try {
      const dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
      if (dataset) {
        report.dataset.totalPublications = dataset.publications.length;
        report.dataset.totalMembers = dataset.members.length;
        report.status = 'dataset-ready';
      }
    } catch (error) {
      report.status = 'dataset-missing';
      report.error = 'Run "npm run import" to create dataset';
    }
    
    await this.fileHelper.writeJSON('./data/sync-status.json', report);
    
    return report;
  }

  /**
   * Print status for team visibility
   */
  printStatus() {
    const stats = this.getUploadStats();
    
    console.log('\n📊 INCREMENTAL SYNC STATUS');
    console.log('─'.repeat(40));
    console.log(`📤 Total Uploaded: ${stats.totalUploaded}`);
    console.log(`💰 Total Cost: ${stats.totalCost.toFixed(6)} AR`);
    console.log(`❌ Failed Uploads: ${stats.failedUploads}`);
    console.log(`🔄 Last Sync: ${stats.lastSync || 'Never'}`);
    console.log(`📊 Batch Number: ${stats.batchNumber}`);
    console.log(`🗂️  Drive Ready: ${stats.driveConfigured ? '✅' : '❌'}`);
    
    if (this.uploadState.failedUploads.length > 0) {
      console.log('\n⚠️  Failed Uploads to Retry:');
      this.uploadState.failedUploads.slice(0, 5).forEach(failed => {
        console.log(`   ${failed.title.substring(0, 40)}... (${failed.retryCount} retries)`);
      });
    }
  }
}

// Test incremental sync if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const syncManager = new IncrementalSyncManager();
  
  async function testIncrementalSync() {
    await syncManager.loadUploadState();
    const report = await syncManager.generateSyncReport();
    syncManager.printStatus();
    
    console.log('\n🔧 Incremental sync system ready for Phase 2 ARFS integration');
  }
  
  testIncrementalSync().catch(console.error);
}

export default IncrementalSyncManager;