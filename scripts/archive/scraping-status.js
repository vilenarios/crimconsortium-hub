#!/usr/bin/env node

/**
 * Scraping Status Command
 * Check current progress of incremental scraping
 */

import { Logger, FileHelper } from '../src/lib/utils.js';

class ScrapingStatus {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
  }

  async checkStatus() {
    try {
      const progress = await this.fileHelper.readJSON('./data/final/scraping-progress.json');
      
      if (!progress) {
        console.log('📊 No scraping in progress');
        console.log('Run "npm run import" to start consortium scraping');
        return;
      }
      
      this.displayStatus(progress);
      
    } catch (error) {
      console.log('📊 No active scraping found');
      console.log('Run "npm run import" to start consortium scraping');
    }
  }

  displayStatus(progress) {
    const elapsed = this.getElapsedTime(progress.startedAt);
    const remaining = this.getEstimatedRemaining(progress);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 CONSORTIUM SCRAPING STATUS');
    console.log('='.repeat(60));
    
    console.log(`🔄 Phase: ${progress.phase}`);
    console.log(`⏱️ Elapsed: ${elapsed}`);
    console.log(`📅 Started: ${new Date(progress.startedAt).toLocaleString()}`);
    console.log(`💾 Last saved: ${progress.lastSavedAt ? new Date(progress.lastSavedAt).toLocaleString() : 'Never'}`);
    
    console.log('\n👥 MEMBERS:');
    console.log(`   Completed: ${progress.members.completed}/${progress.members.total}`);
    console.log(`   Status: ${progress.members.status}`);
    
    console.log('\n📚 PUBLICATIONS:');
    console.log(`   Processed: ${progress.publications.processed}/${progress.publications.total}`);
    console.log(`   Progress: ${Math.round((progress.publications.processed / progress.publications.total) * 100)}%`);
    console.log(`   Current batch: ${progress.publications.currentBatch}/${progress.publications.totalBatches}`);
    console.log(`   Estimated remaining: ${remaining}`);
    
    if (progress.quality) {
      console.log('\n📊 QUALITY:');
      console.log(`   Average word count: ${progress.quality.averageWordCount || 'Calculating...'}`);
      console.log(`   Full content extracted: ${progress.quality.publicationsWithFullContent || 0}`);
    }
    
    if (progress.errors && progress.errors.count > 0) {
      console.log('\n⚠️ ERRORS:');
      console.log(`   Total errors: ${progress.errors.count}`);
      console.log(`   Failed publications: ${progress.errors.publications?.length || 0}`);
    }
    
    console.log('\n🎯 NEXT STEPS:');
    if (progress.phase === 'complete') {
      console.log('✅ Scraping complete!');
      console.log('Run "npm run build" to generate site with complete data');
    } else {
      console.log('⏳ Scraping in progress...');
      console.log('Wait for completion or run "npm run preview" to see current results');
    }
    
    console.log('='.repeat(60));
  }

  getElapsedTime(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const minutes = Math.round((now - start) / 60000);
    
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  getEstimatedRemaining(progress) {
    if (progress.phase === 'complete') return '0 minutes';
    
    const processed = progress.publications.processed || 0;
    const total = progress.publications.total || 1;
    const remaining = total - processed;
    
    if (remaining <= 0) return '0 minutes';
    
    // Estimate based on current rate (assume 2 seconds per publication)
    const estimatedMinutes = Math.round((remaining * 2) / 60);
    return `${estimatedMinutes} minutes`;
  }
}

// Run status check
const status = new ScrapingStatus();
status.checkStatus();