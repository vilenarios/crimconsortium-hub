#!/usr/bin/env node

/**
 * Correct Deployment Process
 * ARFS for upload/organization, ArNS for metadata distribution, ar:// for direct access
 * No GraphQL, no real-time ARFS queries - just fast JSON + ar:// links
 */

import { ARFSClient } from '../src/lib/arfs-client.js';
import { Logger, FileHelper, ProgressTracker } from '../src/lib/utils.js';

class CorrectDeploymentProcess {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.dataset = null;
    this.arfsClient = null;
  }

  async deployCorrectly() {
    this.logger.info('🚀 Starting correct deployment process...');
    
    try {
      // Step 1: Upload PDFs to ARFS and get transaction IDs
      const arfsResults = await this.uploadToARFS();
      
      // Step 2: Create metadata JSON files with ar:// links
      await this.createMetadataFiles(arfsResults);
      
      // Step 3: Deploy metadata to ArNS undernames
      await this.deployMetadataToArNS();
      
      // Step 4: Deploy static site (fetches from ArNS, uses ar:// links)
      await this.deployStaticSite();
      
      // Step 5: Configure ArNS routing
      await this.configureArNSRouting();
      
      this.logger.success('Correct deployment process complete');
      
    } catch (error) {
      this.logger.error('Deployment failed', error.message);
      throw error;
    }
  }

  async uploadToARFS() {
    this.logger.info('📤 Step 1: Upload PDFs to ARFS (organization layer)...');
    
    // Load dataset
    this.dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
    
    // Initialize ARFS client  
    this.arfsClient = new ARFSClient();
    await this.arfsClient.initialize();
    
    // Create folder structure for organization (optional but nice)
    await this.createARFSFolders();
    
    // Upload all PDFs and capture transaction IDs
    const uploadResults = [];
    const tracker = new ProgressTracker(this.dataset.publications.length, 'Uploading to ARFS');
    
    for (const publication of this.dataset.publications) {
      if (!publication.filePath) continue;
      
      try {
        const result = await this.arfsClient.uploadArticle(publication, publication.filePath);
        
        if (result.success) {
          uploadResults.push({
            publicationId: publication.id,
            arfsFileId: result.fileId,           // For ARFS operations (UUID)
            transactionId: result.dataTxId       // For ar:// access (immutable)
          });
          
          tracker.success(`📄 ${publication.title.substring(0, 30)}...`);
        } else {
          tracker.fail(new Error(result.error), publication.id);
        }
        
      } catch (error) {
        tracker.fail(error, publication.id);
      }
    }
    
    tracker.complete();
    
    this.logger.success(`ARFS upload complete: ${uploadResults.length} files uploaded`);
    return uploadResults;
  }

  async createMetadataFiles(arfsResults) {
    this.logger.info('📋 Step 2: Create metadata JSON files with ar:// links...');
    
    // Create lookup for transaction IDs
    const transactionLookup = new Map();
    arfsResults.forEach(result => {
      transactionLookup.set(result.publicationId, result.transactionId);
    });
    
    // Create articles metadata with ar:// links
    const articlesMetadata = {
      articles: this.dataset.publications.map(pub => {
        const transactionId = transactionLookup.get(pub.id);
        
        return {
          id: pub.id,
          slug: pub.slug,
          title: pub.title,
          authors: pub.authors.map(a => ({ name: a.name, affiliation: a.affiliation })),
          abstract: pub.description || '',
          doi: pub.doi || '',
          date: pub.createdAt,
          year: new Date(pub.createdAt).getFullYear(),
          
          // Direct ar:// access (no GraphQL needed)
          pdfUrl: transactionId ? `ar://${transactionId}` : null,
          arweaveTransactionId: transactionId || null,
          
          // Member associations
          memberName: this.dataset.members.find(m => 
            pub.memberAssociations.includes(m.id)
          )?.name || '',
          memberSlug: pub.memberAssociations[0] || '',
          
          // Site navigation (relative paths)
          articleUrl: `/articles/${pub.slug}`,
          memberUrl: `/members/${pub.memberAssociations[0]}`
        };
      }),
      
      metadata: {
        totalArticles: this.dataset.publications.length,
        totalWithPDFs: arfsResults.length,
        useArProtocol: true,
        arfsIntegration: true,
        lastUpdated: new Date().toISOString(),
        accessMethod: 'ArNS metadata + ar:// direct access',
        noGraphQL: true
      }
    };
    
    // Save metadata files for ArNS deployment
    await this.fileHelper.ensureDir('./dist/metadata');
    await this.fileHelper.writeJSON('./dist/metadata/articles.json', articlesMetadata);
    
    // Recent articles for homepage
    const recentMetadata = {
      articles: articlesMetadata.articles
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10),
      generated: new Date().toISOString(),
      useArProtocol: true
    };
    
    await this.fileHelper.writeJSON('./dist/metadata/recent.json', recentMetadata);
    
    // Member metadata
    const membersMetadata = {
      members: this.dataset.members.map(member => ({
        id: member.id,
        name: member.name,
        publicationCount: member.publicationCount,
        profileUrl: `/members/${member.id}`
      })),
      generated: new Date().toISOString()
    };
    
    await this.fileHelper.writeJSON('./dist/metadata/members.json', membersMetadata);
    
    this.logger.success('Metadata JSON files created with ar:// links');
    
    return {
      articlesMetadata,
      recentMetadata, 
      membersMetadata
    };
  }

  async createARFSFolders() {
    this.logger.info('📁 Creating ARFS folders for organization...');
    
    // Create institution folders (optional organization)
    for (const member of this.dataset.members.filter(m => m.publicationCount > 0)) {
      try {
        const folderName = member.name
          .replace(/[^a-zA-Z0-9\s\-]/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase()
          .substring(0, 50);
        
        await this.arfsClient.arDrive.createPublicFolder({
          folderName: folderName,
          driveId: this.arfsClient.driveId,
          parentFolderId: this.arfsClient.articlesFolderId
        });
        
      } catch (error) {
        // Folder might exist, continue
        this.logger.warning(`Could not create folder for ${member.name}`);
      }
    }
    
    this.logger.success('ARFS folders created for organization');
  }

  printCorrectArchitectureSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('🎯 CORRECT ARFS/ArNS ARCHITECTURE SUMMARY');
    console.log('='.repeat(70));
    
    console.log('📊 DATA FLOW:');
    console.log('1. PDFs → ARFS upload → Transaction IDs captured');
    console.log('2. Metadata JSON → Created with ar:// links');  
    console.log('3. ArNS undernames → Serve metadata JSON files');
    console.log('4. Static site → Fetches JSON, uses ar:// for PDFs');
    console.log('5. Users → Fast JSON access + direct ar:// PDF downloads');
    
    console.log('\n🏗️ COMPONENT ROLES:');
    console.log('📁 ARFS: Upload & organize PDFs (get transaction IDs)');
    console.log('🌐 ArNS: Serve metadata JSON files (fast access)');
    console.log('🔗 ar://: Direct PDF access (no GraphQL needed)');
    console.log('⚡ Static site: Fetches JSON + uses ar:// links');
    
    console.log('\n✅ BENEFITS:');
    console.log('✅ No GraphQL queries (faster performance)');
    console.log('✅ No hardcoded gateway URLs'); 
    console.log('✅ Truly decentralized access');
    console.log('✅ Fast metadata via ArNS JSON');
    console.log('✅ Direct PDF access via ar://');
    
    console.log('='.repeat(70));
  }
}

export default CorrectDeploymentProcess;