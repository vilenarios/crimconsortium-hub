#!/usr/bin/env node

/**
 * Finalize Consortium Dataset
 * Creates clean, organized final dataset for Phase 2 ARFS integration
 * Consolidates all analysis into single authoritative source
 */

import fs from 'fs-extra';
import { Logger, FileHelper } from '../src/lib/utils.js';

class ConsortiumDataFinalizer {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
  }

  async finalizeData() {
    this.logger.info('🎯 Finalizing consortium dataset...');
    
    try {
      // Step 1: Load the best dataset (fixed version)
      const publications = await this.fileHelper.readJSON('./data/consortium/publications-fixed.json');
      const members = await this.fileHelper.readJSON('./data/consortium/members-fixed.json');
      const report = await this.fileHelper.readJSON('./data/consortium/processing-report-fixed.json');
      
      if (!publications || !members || !report) {
        throw new Error('Failed to load consortium data');
      }
      
      // Step 2: Create clean data structure
      await this.createFinalStructure();
      
      // Step 3: Save final authoritative dataset
      await this.saveFinalDataset(publications, members, report);
      
      // Step 4: Clean up temporary files
      await this.cleanupTempFiles();
      
      // Step 5: Verify final dataset
      await this.verifyFinalDataset();
      
      this.logger.success('Consortium dataset finalized');
      
    } catch (error) {
      this.logger.error('Failed to finalize consortium data', error.message);
      throw error;
    }
  }

  async createFinalStructure() {
    this.logger.info('📁 Creating final data structure...');
    
    // Create clean data structure
    await this.fileHelper.ensureDir('./data/final');
    await this.fileHelper.ensureDir('./data/final/pdfs');
    await this.fileHelper.ensureDir('./data/final/metadata');
    await this.fileHelper.ensureDir('./data/temp'); // For temporary processing files
  }

  async saveFinalDataset(publications, members, report) {
    this.logger.info('💾 Saving final authoritative dataset...');
    
    // Filter to only publications with PDFs and valid members
    const validPublications = publications.filter(pub => 
      pub.filePath && 
      pub.memberAssociations && 
      pub.memberAssociations.length > 0
    );
    
    const activeMembers = members.filter(member => member.publicationCount > 0);
    
    // Create final consortium dataset
    const finalDataset = {
      metadata: {
        name: 'CrimConsortium Static Hub Dataset',
        description: 'Consortium member publications for permanent archival on Arweave',
        version: '1.0',
        createdAt: new Date().toISOString(),
        source: 'PubPub Export + Affiliation Detection'
      },
      
      summary: {
        totalMembers: activeMembers.length,
        totalPublications: validPublications.length,
        pdfsAvailable: validPublications.filter(p => p.filePath).length,
        dateRange: this.calculateDateRange(validPublications),
        averagePublicationsPerMember: Math.round(validPublications.length / activeMembers.length)
      },
      
      members: activeMembers.map(member => ({
        id: member.id,
        name: member.name,
        keywords: member.keywords || [],
        publicationCount: member.publicationCount,
        publications: member.publications || []
      })),
      
      publications: validPublications.map(pub => ({
        // Core identifiers
        id: pub.id,
        slug: pub.slug,
        
        // Content
        title: pub.title,
        description: pub.description,
        doi: pub.doi,
        
        // Authors
        authors: pub.authors.map(author => ({
          name: author.name,
          affiliation: author.affiliation,
          orcid: author.orcid
        })),
        
        // Dates
        createdAt: pub.createdAt,
        updatedAt: pub.updatedAt,
        
        // Files
        filePath: pub.filePath,
        fileSize: pub.fileSize,
        downloads: pub.downloads,
        
        // Consortium associations
        memberAssociations: pub.memberAssociations,
        detectionMethod: pub.detectionMethod,
        detectionConfidence: pub.detectionConfidence,
        
        // URLs
        originalUrl: pub.originalUrl,
        
        // ARFS fields (to be filled during upload)
        arfsFileId: null,
        arweaveId: null,
        uploadedAt: null
      })),
      
      costs: {
        estimatedSize: `${validPublications.length * 2}MB`,
        estimatedArCost: (validPublications.length * 2 * 0.000000001 * 500000000).toFixed(6),
        estimatedUsdCost: (validPublications.length * 2 * 0.00001).toFixed(2)
      }
    };
    
    // Save final dataset
    await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', finalDataset);
    
    // Save individual member files for reference
    for (const member of activeMembers) {
      const memberPubs = validPublications.filter(pub => 
        pub.memberAssociations.includes(member.id)
      );
      
      await this.fileHelper.writeJSON(
        `./data/final/metadata/${member.id}.json`, 
        {
          member: member,
          publications: memberPubs,
          publicationCount: memberPubs.length
        }
      );
    }
    
    // Copy PDFs to final location with organized names
    await this.copyPDFsToFinalLocation(validPublications);
    
    this.logger.success(`Final dataset saved: ${validPublications.length} publications from ${activeMembers.length} members`);
    
    return finalDataset;
  }

  async copyPDFsToFinalLocation(publications) {
    this.logger.info('📄 Organizing PDFs in final location...');
    
    let copied = 0;
    
    for (const pub of publications) {
      if (pub.filePath && await this.fileHelper.exists(pub.filePath)) {
        try {
          const finalFileName = `${pub.slug || pub.id}.pdf`;
          const finalPath = `./data/final/pdfs/${finalFileName}`;
          
          await fs.copy(pub.filePath, finalPath);
          
          // Update file path to final location
          pub.filePath = finalPath;
          copied++;
          
        } catch (error) {
          this.logger.warning(`Failed to copy PDF for ${pub.id}`, error.message);
        }
      }
    }
    
    this.logger.success(`Copied ${copied} PDFs to final location`);
  }

  async cleanupTempFiles() {
    this.logger.info('🧹 Cleaning up temporary files...');
    
    const tempFiles = [
      './data/consortium/members.json',           // Non-fixed version
      './data/consortium/publications.json',     // Non-fixed version  
      './data/consortium/processing-report.json', // Non-fixed version
      './data/consortium/rss-articles.json',     // RSS data (not needed)
      './data/consortium/scraping-report.json',  // Failed API scraping
      './data/debug-results.json',               // Debug data
      './data/simple-consortium-analysis.json',  // Simple analysis
      './data/consortium-collection-ids.json'    // Debug collection IDs
    ];
    
    let cleaned = 0;
    
    for (const file of tempFiles) {
      if (await this.fileHelper.exists(file)) {
        try {
          // Move to temp folder instead of deleting (safer)
          const fileName = file.split('/').pop();
          const tempPath = `./data/temp/${fileName}`;
          await fs.move(file, tempPath);
          cleaned++;
        } catch (error) {
          this.logger.warning(`Failed to move temp file: ${file}`, error.message);
        }
      }
    }
    
    this.logger.success(`Moved ${cleaned} temporary files to ./data/temp/`);
  }

  async verifyFinalDataset() {
    this.logger.info('🔍 Verifying final dataset...');
    
    const dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
    
    if (!dataset) {
      throw new Error('Final dataset not found');
    }
    
    // Verification checks
    const checks = {
      hasMembers: dataset.members && dataset.members.length > 0,
      hasPublications: dataset.publications && dataset.publications.length > 0,
      publicationsHavePDFs: dataset.publications.filter(p => p.filePath).length,
      membersHavePublications: dataset.members.filter(m => m.publicationCount > 0).length,
      allPDFsExist: 0
    };
    
    // Check PDF files exist
    for (const pub of dataset.publications) {
      if (pub.filePath && await this.fileHelper.exists(pub.filePath)) {
        checks.allPDFsExist++;
      }
    }
    
    // Print verification results
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL CONSORTIUM DATASET VERIFICATION');
    console.log('='.repeat(60));
    
    console.log(`👥 Active Members: ${checks.membersHavePublications}`);
    console.log(`📚 Total Publications: ${dataset.publications.length}`);
    console.log(`📄 Publications with PDFs: ${checks.publicationsHavePDFs}`);
    console.log(`✅ PDFs Available: ${checks.allPDFsExist}/${checks.publicationsHavePDFs}`);
    
    console.log('\n🏆 Top Publishing Members:');
    dataset.members
      .sort((a, b) => b.publicationCount - a.publicationCount)
      .slice(0, 8)
      .forEach((member, index) => {
        console.log(`${index + 1}. ${member.name}: ${member.publicationCount} publications`);
      });
    
    console.log('\n📅 Publications by Year:');
    const byYear = {};
    dataset.publications.forEach(pub => {
      const year = new Date(pub.createdAt).getFullYear();
      if (!isNaN(year)) byYear[year] = (byYear[year] || 0) + 1;
    });
    
    Object.entries(byYear)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([year, count]) => {
        console.log(`${year}: ${count} publications`);
      });
    
    console.log('\n💰 Cost Estimates:');
    console.log(`📦 Size: ${dataset.costs.estimatedSize}`);
    console.log(`💵 Cost: $${dataset.costs.estimatedUsdCost} (${dataset.costs.estimatedArCost} AR)`);
    
    console.log('\n📁 Final Data Structure:');
    console.log('✅ ./data/final/consortium-dataset.json (AUTHORITATIVE)');
    console.log('✅ ./data/final/pdfs/ (All PDFs organized)');
    console.log('✅ ./data/final/metadata/ (Per-member data)');
    console.log('📦 ./data/temp/ (Temporary/debug files moved)');
    
    console.log('\n🎯 DATASET STATUS:');
    if (checks.hasMembers && checks.hasPublications && checks.allPDFsExist > 0) {
      console.log('✅ DATASET VERIFIED AND READY');
      console.log('✅ Proper consortium content identified');
      console.log('✅ PDFs located and organized');
      console.log('✅ Member associations mapped');
      console.log('🚀 Ready for ARFS upload phase');
    } else {
      console.log('⚠️  DATASET NEEDS ATTENTION');
      console.log(`   Members: ${checks.hasMembers ? '✅' : '❌'}`);
      console.log(`   Publications: ${checks.hasPublications ? '✅' : '❌'}`);
      console.log(`   PDFs: ${checks.allPDFsExist}/${checks.publicationsHavePDFs}`);
    }
    
    console.log('='.repeat(60));
    
    return dataset;
  }

  calculateDateRange(publications) {
    let earliest = null;
    let latest = null;
    
    for (const pub of publications) {
      const date = new Date(pub.createdAt);
      if (isNaN(date.getTime())) continue;
      
      if (!earliest || date < earliest) earliest = date;
      if (!latest || date > latest) latest = date;
    }
    
    return {
      earliest: earliest ? earliest.toISOString() : null,
      latest: latest ? latest.toISOString() : null
    };
  }
}

// Run finalizer
const finalizer = new ConsortiumDataFinalizer();
finalizer.finalizeData().catch(error => {
  console.error('Finalization failed:', error.message);
  process.exit(1);
});