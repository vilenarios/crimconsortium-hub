#!/usr/bin/env node

/**
 * Debug Consortium Filtering
 * Investigates why we're missing consortium publications
 */

import fs from 'fs-extra';
import { Logger, FileHelper } from '../src/lib/utils.js';

class ConsortiumDebugger {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
  }

  async debug() {
    this.logger.info('🔍 Debugging consortium publication filtering...');
    
    // Step 1: Check export structure
    await this.examineExportStructure();
    
    // Step 2: Find consortium collections in export.json
    await this.findConsortiumCollections();
    
    // Step 3: Sample publication analysis
    await this.analyzePublicationStructure();
    
    // Step 4: Check collection associations
    await this.checkCollectionAssociations();
  }

  async examineExportStructure() {
    this.logger.info('📁 Examining export structure...');
    
    // Check if consortium member directories have content
    const memberDirs = [
      'ghent1c', 'acjs1c', 'johnjayrec1c', 'temple1c', 'uga1c'
    ];
    
    for (const dir of memberDirs) {
      const dirPath = `./export/${dir}`;
      
      if (await this.fileHelper.exists(dirPath)) {
        const files = await fs.readdir(dirPath);
        console.log(`📂 ${dir}: ${files.join(', ')}`);
        
        // Check if index.html contains publication references
        const indexPath = `${dirPath}/index.html`;
        if (await this.fileHelper.exists(indexPath)) {
          const html = await fs.readFile(indexPath, 'utf8');
          const pubMatches = html.match(/\/pub\/[a-z0-9]+/g) || [];
          console.log(`   📄 Publications referenced: ${pubMatches.length}`);
          
          if (pubMatches.length > 0) {
            console.log(`   📋 Sample: ${pubMatches.slice(0, 3).join(', ')}`);
          }
        }
      }
    }
  }

  async findConsortiumCollections() {
    this.logger.info('🔍 Finding consortium collections in export.json...');
    
    const exportData = await this.fileHelper.readJSON('./export/export.json');
    
    if (exportData.collections && Array.isArray(exportData.collections)) {
      console.log(`📊 Total collections in export: ${exportData.collections.length}`);
      
      // Find collections with consortium-like names
      const consortiumCollections = exportData.collections.filter(collection => 
        collection.slug.endsWith('1c') ||
        collection.title.toLowerCase().includes('consortium') ||
        collection.title.toLowerCase().includes('university') ||
        collection.title.toLowerCase().includes('college') ||
        collection.title.toLowerCase().includes('institute')
      );
      
      console.log(`🎯 Potential consortium collections: ${consortiumCollections.length}`);
      
      consortiumCollections.slice(0, 10).forEach(collection => {
        console.log(`📂 ${collection.slug}: ${collection.title}`);
        console.log(`   ID: ${collection.id}`);
        console.log(`   Public: ${collection.isPublic}`);
      });
      
      // Save consortium collection IDs for reference
      const collectionIds = consortiumCollections.map(c => c.id);
      await this.fileHelper.writeJSON('./data/consortium-collection-ids.json', {
        collectionIds,
        collections: consortiumCollections
      });
      
      this.logger.success(`Saved ${collectionIds.length} consortium collection IDs`);
    }
  }

  async analyzePublicationStructure() {
    this.logger.info('📋 Analyzing publication structure...');
    
    const exportData = await this.fileHelper.readJSON('./export/export.json');
    
    // Take first 10 publications and examine their structure
    const samplePubs = exportData.pubs.slice(0, 10);
    
    for (const pub of samplePubs) {
      console.log(`\n📄 Publication: ${pub.title?.substring(0, 50)}...`);
      console.log(`   ID: ${pub.id}`);
      console.log(`   Slug: ${pub.slug}`);
      console.log(`   Collections: ${pub.collectionPubs?.length || 0}`);
      
      if (pub.collectionPubs && pub.collectionPubs.length > 0) {
        pub.collectionPubs.forEach(cp => {
          if (cp.collection) {
            console.log(`   📂 Collection: ${cp.collection.slug} (${cp.collection.title})`);
          }
        });
      }
      
      // Check attributions for consortium affiliations
      if (pub.attributions && pub.attributions.length > 0) {
        pub.attributions.forEach(attr => {
          if (attr.affiliation) {
            console.log(`   🏛️  Affiliation: ${attr.affiliation}`);
          }
        });
      }
    }
  }

  async checkCollectionAssociations() {
    this.logger.info('🔗 Checking collection associations...');
    
    const exportData = await this.fileHelper.readJSON('./export/export.json');
    
    // Load consortium collection IDs if available
    let consortiumCollectionIds = [];
    if (await this.fileHelper.exists('./data/consortium-collection-ids.json')) {
      const data = await this.fileHelper.readJSON('./data/consortium-collection-ids.json');
      consortiumCollectionIds = data.collectionIds || [];
    }
    
    console.log(`🎯 Using ${consortiumCollectionIds.length} consortium collection IDs for filtering`);
    
    // Count publications associated with consortium collections
    let consortiumPubCount = 0;
    const associationCounts = {};
    
    for (const pub of exportData.pubs) {
      if (pub.collectionPubs && Array.isArray(pub.collectionPubs)) {
        for (const cp of pub.collectionPubs) {
          if (consortiumCollectionIds.includes(cp.collectionId)) {
            consortiumPubCount++;
            
            // Count by collection
            const collectionSlug = cp.collection?.slug || cp.collectionId;
            associationCounts[collectionSlug] = (associationCounts[collectionSlug] || 0) + 1;
            
            console.log(`✅ Found: ${pub.title?.substring(0, 40)}... → ${collectionSlug}`);
            break; // Only count once per publication
          }
        }
      }
    }
    
    console.log(`\n📊 Total consortium publications found: ${consortiumPubCount}`);
    console.log('\n📈 Publications by collection:');
    Object.entries(associationCounts).forEach(([collection, count]) => {
      console.log(`   ${collection}: ${count} publications`);
    });
    
    // Save results
    await this.fileHelper.writeJSON('./data/debug-results.json', {
      consortiumPubCount,
      associationCounts,
      consortiumCollectionIds,
      debuggedAt: new Date().toISOString()
    });
    
    this.logger.success('Debug analysis complete');
  }
}

// Run debugger
const debug = new ConsortiumDebugger();
debug.debug().catch(error => {
  console.error('Debug failed:', error);
  process.exit(1);
});