#!/usr/bin/env node

/**
 * Consortium Export Processor
 * Intelligently extracts consortium member publications from export data
 * Team-friendly with comprehensive documentation and error handling
 */

import fs from 'fs-extra';
import path from 'path';
import { Logger, FileHelper, ProgressTracker, getPublicationPath } from '../src/lib/utils.js';

class ConsortiumExportProcessor {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    // Known consortium member slugs from our analysis
    this.consortiumSlugs = [
      'acjs1c', 'ghent1c', 'johnjayrec1c', 'ohcp1c', 'sfu1c', 'temple1c',
      'benthamproject1c', 'montreal1c', 'prisonsresearch1c', 'uga1c', 'umsl1c', 'utd1c',
      'cybersecurity1c', 'kf1c', 'hawaiicrimelab', 'jhc', 'mpicsl', 'sebp', 'sascv',
      'uomcriminology', 'uomopenresearch', 'northeasternccj', 'crimeprevention1c',
      'correctionsandreentry1c', 'violenceandjustice1c', 'raceandjustice1c'
    ];
    
    // Member names mapping
    this.memberNames = {
      'acjs1c': 'Academy of Criminal Justice Sciences',
      'ghent1c': 'Ghent University, Department of Criminology',
      'johnjayrec1c': 'John Jay College of Criminal Justice, Research & Evaluation Center',
      'ohcp1c': 'Oral History of Criminology Project',
      'sfu1c': 'Simon Fraser University, School of Criminology',
      'temple1c': 'Temple University, Department of Criminal Justice',
      'benthamproject1c': 'UCL, Bentham Project',
      'montreal1c': 'Université de Montréal, École de Criminologie',
      'prisonsresearch1c': 'University of Cambridge, Institute of Criminology, Prisons Research Centre',
      'uga1c': 'University of Georgia, Department of Sociology',
      'umsl1c': 'University of Missouri—St. Louis, Department of Criminology & Criminal Justice',
      'utd1c': 'University of Texas at Dallas, Criminology & Criminal Justice',
      'cybersecurity1c': 'Georgia State University, Evidence-Based Cybersecurity Research Group',
      'kf1c': 'Knowledge Futures, creator of PubPub',
      'hawaiicrimelab': 'Hawaii Crime Lab',
      'jhc': 'Journal of Historical Criminology',
      'mpicsl': 'Max Planck Institute for the Study of Crime, Security & Law',
      'sebp': 'Society of Evidence Based Policing',
      'sascv': 'South Asian Society of Criminology and Victimology',
      'uomcriminology': 'University of Manchester, Department of Criminology | Home of CrimRxiv',
      'uomopenresearch': 'University of Manchester, Office for Open Research',
      'northeasternccj': 'Northeastern University, School of Criminology & Criminal Justice',
      'crimeprevention1c': 'Crime Prevention Research',
      'correctionsandreentry1c': 'Corrections and Reentry Research',
      'violenceandjustice1c': 'Violence and Justice Research',
      'raceandjustice1c': 'Race and Justice Research'
    };
    
    // Data storage
    this.consortiumMembers = [];
    this.consortiumPublications = [];
    this.exportData = null;
    
    this.stats = {
      totalExportPublications: 0,
      consortiumPublications: 0,
      membersWithContent: 0,
      duplicatesRemoved: 0,
      pdfsFound: 0
    };
  }

  /**
   * Main processing function
   */
  async processConsortiumExport() {
    this.logger.info('📊 Processing consortium content from export data...');
    
    try {
      // Step 1: Load export data
      await this.loadExportData();
      
      // Step 2: Initialize consortium members
      await this.initializeConsortiumMembers();
      
      // Step 3: Find consortium publications in export
      await this.findConsortiumPublications();
      
      // Step 4: Copy consortium PDFs from export assets
      await this.copyConsortiumPDFs();
      
      // Step 5: Generate comprehensive report
      await this.generateReport();
      
      this.logger.success('Consortium export processing complete');
      
      return {
        members: this.consortiumMembers,
        publications: this.consortiumPublications,
        stats: this.stats
      };
      
    } catch (error) {
      this.logger.error('Consortium export processing failed', error.message);
      throw error;
    }
  }

  /**
   * Load the main export.json file
   */
  async loadExportData() {
    this.logger.info('📁 Loading export data...');
    
    const exportPath = './export/export.json';
    
    if (!await this.fileHelper.exists(exportPath)) {
      throw new Error(`Export file not found: ${exportPath}`);
    }
    
    const fileSize = await this.fileHelper.getFileSize(exportPath);
    this.logger.info(`Export file size: ${this.fileHelper.formatFileSize(fileSize)}`);
    
    this.exportData = await this.fileHelper.readJSON(exportPath);
    
    if (!this.exportData || !this.exportData.pubs) {
      throw new Error('Invalid export file format');
    }
    
    this.stats.totalExportPublications = this.exportData.pubs.length;
    this.logger.success(`Export loaded: ${this.stats.totalExportPublications} total publications`);
  }

  /**
   * Initialize consortium member objects
   */
  async initializeConsortiumMembers() {
    this.logger.info('👥 Initializing consortium members...');
    
    for (const slug of this.consortiumSlugs) {
      const member = {
        id: slug,
        name: this.memberNames[slug] || this.slugToName(slug),
        slug: slug,
        
        // Publication tracking
        publications: [],
        publicationCount: 0,
        
        // Check if member has export directory
        hasExportDir: await this.fileHelper.exists(`./export/${slug}`),
        
        // Metadata
        scrapedAt: new Date().toISOString()
      };
      
      this.consortiumMembers.push(member);
    }
    
    const membersWithDirs = this.consortiumMembers.filter(m => m.hasExportDir).length;
    this.logger.success(`Initialized ${this.consortiumMembers.length} members (${membersWithDirs} have export directories)`);
  }

  /**
   * Find consortium publications in the export data
   */
  async findConsortiumPublications() {
    this.logger.info('🔍 Finding consortium publications in export...');
    
    const tracker = new ProgressTracker(this.exportData.pubs.length, 'Analyzing publications');
    
    for (const pub of this.exportData.pubs) {
      try {
        const isConsortium = this.checkIfConsortiumPublication(pub);
        
        if (isConsortium) {
          const publication = await this.processConsortiumPublication(pub);
          if (publication) {
            this.consortiumPublications.push(publication);
            
            // Update member publication counts
            publication.memberAssociations.forEach(memberSlug => {
              const member = this.consortiumMembers.find(m => m.slug === memberSlug);
              if (member) {
                member.publications.push(publication.id);
                member.publicationCount++;
              }
            });
            
            tracker.success(`📄 ${publication.title.substring(0, 40)}...`);
          } else {
            tracker.increment('⚠️  Processing failed');
          }
        } else {
          tracker.increment('⏭️ Non-consortium');
        }
        
      } catch (error) {
        tracker.fail(error, pub.id || 'unknown');
      }
    }
    
    const summary = tracker.complete();
    this.stats.consortiumPublications = this.consortiumPublications.length;
    this.stats.membersWithContent = this.consortiumMembers.filter(m => m.publicationCount > 0).length;
    
    this.logger.success(`Found ${this.stats.consortiumPublications} consortium publications across ${this.stats.membersWithContent} members`);
  }

  /**
   * Check if publication belongs to consortium
   */
  checkIfConsortiumPublication(pub) {
    // Method 1: Check collection associations
    if (pub.collectionPubs && Array.isArray(pub.collectionPubs)) {
      for (const collectionPub of pub.collectionPubs) {
        if (collectionPub.collection && this.consortiumSlugs.includes(collectionPub.collection.slug)) {
          return true;
        }
      }
    }
    
    // Method 2: Check if publication exists in consortium member export directories
    if (pub.slug) {
      for (const memberSlug of this.consortiumSlugs) {
        const memberPubPath = `./export/${memberSlug}/pub/${pub.slug}`;
        if (fs.existsSync(memberPubPath)) {
          return true;
        }
      }
    }
    
    // Method 3: Check author affiliations for consortium institutions
    if (pub.attributions && Array.isArray(pub.attributions)) {
      for (const attribution of pub.attributions) {
        const affiliation = attribution.affiliation || '';
        if (this.isConsortiumAffiliation(affiliation)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if affiliation belongs to consortium institution
   */
  isConsortiumAffiliation(affiliation) {
    const consortiumInstitutions = [
      'University of Manchester',
      'Georgia State University',
      'Ghent University',
      'John Jay College',
      'Simon Fraser University',
      'Temple University',
      'University of Cambridge',
      'University of Georgia',
      'University of Missouri',
      'University of Texas at Dallas',
      'Northeastern University',
      'Max Planck Institute',
      'Knowledge Futures'
    ];
    
    return consortiumInstitutions.some(institution => 
      affiliation.toLowerCase().includes(institution.toLowerCase())
    );
  }

  /**
   * Process a consortium publication
   */
  async processConsortiumPublication(pub) {
    try {
      // Extract author information
      const authors = this.extractAuthors(pub);
      
      // Extract download URLs
      const downloads = this.extractDownloads(pub);
      
      // Find associated consortium members
      const memberAssociations = this.findMemberAssociations(pub);
      
      // Extract publication path for organization
      const pubPath = getPublicationPath(pub.createdAt || new Date());
      
      const publication = {
        // Basic information
        id: pub.id,
        slug: pub.slug,
        title: pub.title || '',
        description: pub.description || '',
        htmlTitle: pub.htmlTitle,
        htmlDescription: pub.htmlDescription,
        
        // Academic metadata
        doi: pub.doi || '',
        avatar: pub.avatar,
        labels: pub.labels,
        metadata: pub.metadata,
        
        // Authors and attributions
        authors: authors,
        attributions: pub.attributions || [],
        
        // Downloads and files
        downloads: downloads,
        
        // Dates
        createdAt: pub.createdAt,
        updatedAt: pub.updatedAt,
        customPublishedAt: pub.customPublishedAt,
        
        // Consortium associations
        memberAssociations: memberAssociations,
        collections: pub.collectionPubs || [],
        
        // Organization
        publicationPath: pubPath,
        
        // URLs
        originalUrl: `https://www.crimrxiv.com/pub/${pub.slug}`,
        
        // Processing metadata
        exportSource: 'PubPub',
        processedAt: new Date().toISOString(),
        
        // File information (to be filled during PDF processing)
        filePath: null,
        fileSize: 0
      };
      
      return publication;
      
    } catch (error) {
      this.logger.error(`Failed to process publication: ${pub.id}`, error.message);
      return null;
    }
  }

  /**
   * Find member associations for a publication
   */
  findMemberAssociations(pub) {
    const associations = [];
    
    // Check collection associations
    if (pub.collectionPubs && Array.isArray(pub.collectionPubs)) {
      for (const collectionPub of pub.collectionPubs) {
        if (collectionPub.collection && this.consortiumSlugs.includes(collectionPub.collection.slug)) {
          associations.push(collectionPub.collection.slug);
        }
      }
    }
    
    // Check export directory presence
    if (pub.slug) {
      for (const memberSlug of this.consortiumSlugs) {
        const memberPubPath = `./export/${memberSlug}/pub/${pub.slug}`;
        if (fs.existsSync(memberPubPath)) {
          associations.push(memberSlug);
        }
      }
    }
    
    return [...new Set(associations)];
  }

  /**
   * Extract author information
   */
  extractAuthors(pub) {
    const authors = [];
    
    if (pub.attributions && Array.isArray(pub.attributions)) {
      for (const attribution of pub.attributions) {
        if (attribution.user) {
          authors.push({
            name: attribution.user.fullName || '',
            firstName: attribution.user.firstName || '',
            lastName: attribution.user.lastName || '',
            email: attribution.user.email || '',
            affiliation: attribution.affiliation || '',
            orcid: attribution.orcid || attribution.user.orcid || '',
            roles: attribution.roles || [],
            isAuthor: attribution.isAuthor || false,
            order: attribution.order || 0
          });
        } else if (attribution.name) {
          authors.push({
            name: attribution.name,
            affiliation: attribution.affiliation || '',
            orcid: attribution.orcid || '',
            roles: attribution.roles || [],
            isAuthor: attribution.isAuthor || false,
            order: attribution.order || 0
          });
        }
      }
    }
    
    return authors.filter(author => author.name);
  }

  /**
   * Extract download URLs
   */
  extractDownloads(pub) {
    const downloads = {};
    
    if (pub.exports && Array.isArray(pub.exports)) {
      for (const exportItem of pub.exports) {
        if (exportItem.format && exportItem.url) {
          downloads[exportItem.format] = exportItem.url;
        }
      }
    }
    
    return downloads;
  }

  /**
   * Copy consortium PDFs from export assets
   */
  async copyConsortiumPDFs() {
    this.logger.info('📁 Copying consortium PDFs from export assets...');
    
    const publicationsWithPDFs = this.consortiumPublications.filter(pub => pub.downloads.pdf);
    
    if (publicationsWithPDFs.length === 0) {
      this.logger.warning('No consortium publications with PDFs found');
      return;
    }
    
    await this.fileHelper.ensureDir('./data/consortium/pdfs');
    
    const tracker = new ProgressTracker(publicationsWithPDFs.length, 'Copying PDFs');
    
    for (const pub of publicationsWithPDFs) {
      try {
        const result = await this.copyPDF(pub);
        
        if (result.success) {
          pub.filePath = result.filePath;
          pub.fileSize = result.fileSize;
          this.stats.pdfsFound++;
          
          if (result.copied) {
            tracker.success(`📄 Copied: ${result.fileName}`);
          } else {
            tracker.increment(`📋 Already exists: ${result.fileName}`);
          }
        } else {
          tracker.fail(new Error(result.error), pub.id);
        }
        
      } catch (error) {
        tracker.fail(error, pub.id);
      }
    }
    
    tracker.complete();
    this.logger.success(`PDF processing complete: ${this.stats.pdfsFound} PDFs found`);
  }

  /**
   * Copy PDF from export assets
   */
  async copyPDF(publication) {
    const pdfUrl = publication.downloads.pdf;
    
    if (!pdfUrl) {
      return { success: false, error: 'No PDF URL' };
    }
    
    try {
      // Extract asset path from URL
      const urlParts = pdfUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const assetHash = urlParts[urlParts.length - 2];
      
      // Look for PDF in export assets
      const possiblePaths = [
        `./export/assets/assets_pubpub_org/${assetHash}/${fileName}`,
        `./export/assets/assets_pubpub_org/${assetHash}.pdf`,
        `./export/assets/${assetHash}/${fileName}`,
        `./export/assets/${assetHash}.pdf`
      ];
      
      let sourcePath = null;
      for (const path of possiblePaths) {
        if (await this.fileHelper.exists(path)) {
          sourcePath = path;
          break;
        }
      }
      
      if (!sourcePath) {
        return { success: false, error: 'PDF not found in export assets' };
      }
      
      // Copy to consortium directory
      const destFileName = `${publication.slug || publication.id}.pdf`;
      const destPath = `./data/consortium/pdfs/${destFileName}`;
      
      // Check if already exists
      if (await this.fileHelper.exists(destPath)) {
        const fileSize = await this.fileHelper.getFileSize(destPath);
        if (fileSize > 0) {
          return { success: true, filePath: destPath, fileSize, fileName: destFileName, copied: false };
        }
      }
      
      // Copy file
      await fs.copy(sourcePath, destPath);
      
      const fileSize = await this.fileHelper.getFileSize(destPath);
      
      return { 
        success: true, 
        filePath: destPath, 
        fileSize, 
        fileName: destFileName, 
        copied: true,
        sourcePath 
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate comprehensive report
   */
  async generateReport() {
    this.logger.info('📊 Generating consortium report...');
    
    await this.fileHelper.ensureDir('./data/consortium');
    
    // Calculate statistics
    const publicationsByYear = this.groupPublicationsByYear();
    const topProducers = this.consortiumMembers
      .filter(m => m.publicationCount > 0)
      .sort((a, b) => b.publicationCount - a.publicationCount);
    
    const report = {
      summary: {
        totalMembers: this.consortiumMembers.length,
        membersWithContent: this.stats.membersWithContent,
        totalPublications: this.stats.consortiumPublications,
        pdfsFound: this.stats.pdfsFound,
        averagePublicationsPerMember: this.stats.membersWithContent > 0 ? 
          Math.round(this.stats.consortiumPublications / this.stats.membersWithContent) : 0,
        processedAt: new Date().toISOString()
      },
      
      members: this.consortiumMembers.map(m => ({
        name: m.name,
        slug: m.slug,
        publicationCount: m.publicationCount,
        hasExportDir: m.hasExportDir
      })),
      
      topProducers: topProducers.slice(0, 10).map(m => ({
        name: m.name,
        publicationCount: m.publicationCount
      })),
      
      publicationsByYear,
      
      samplePublications: this.consortiumPublications.slice(0, 10).map(p => ({
        id: p.id,
        title: p.title,
        authors: p.authors.map(a => a.name),
        memberAssociations: p.memberAssociations,
        createdAt: p.createdAt,
        hasPDF: !!p.filePath
      })),
      
      costs: {
        estimatedSize: `${this.stats.consortiumPublications * 2}MB`,
        estimatedCost: `$${(this.stats.consortiumPublications * 2 * 0.00001).toFixed(2)}`,
        description: 'Consortium publications only - much smaller than full archive'
      },
      
      stats: this.stats
    };
    
    // Save detailed data
    await this.fileHelper.writeJSON('./data/consortium/members.json', this.consortiumMembers);
    await this.fileHelper.writeJSON('./data/consortium/publications.json', this.consortiumPublications);
    await this.fileHelper.writeJSON('./data/consortium/processing-report.json', report);
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }

  /**
   * Group publications by year
   */
  groupPublicationsByYear() {
    const byYear = {};
    
    for (const pub of this.consortiumPublications) {
      const year = new Date(pub.createdAt).getFullYear();
      if (!isNaN(year)) {
        byYear[year] = (byYear[year] || 0) + 1;
      }
    }
    
    return byYear;
  }

  /**
   * Print comprehensive summary
   */
  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CONSORTIUM EXPORT PROCESSING SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`📈 Total Export Publications: ${this.stats.totalExportPublications}`);
    console.log(`📚 Consortium Publications: ${report.summary.totalPublications}`);
    console.log(`👥 Total Members: ${report.summary.totalMembers}`);
    console.log(`✅ Members with Content: ${report.summary.membersWithContent}`);
    console.log(`📄 PDFs Found: ${report.summary.pdfsFound}`);
    console.log(`📊 Avg Pubs/Member: ${report.summary.averagePublicationsPerMember}`);
    
    if (report.topProducers.length > 0) {
      console.log('\n🏆 Top Publishing Members:');
      report.topProducers.slice(0, 8).forEach((member, index) => {
        console.log(`${index + 1}. ${member.name}: ${member.publicationCount} publications`);
      });
    }
    
    if (Object.keys(report.publicationsByYear).length > 0) {
      console.log('\n📅 Publications by Year:');
      Object.entries(report.publicationsByYear)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([year, count]) => {
          console.log(`${year}: ${count} publications`);
        });
    }
    
    if (report.samplePublications.length > 0) {
      console.log('\n📄 Sample Publications:');
      report.samplePublications.slice(0, 3).forEach((pub, index) => {
        console.log(`${index + 1}. ${pub.title.substring(0, 60)}...`);
        console.log(`   Authors: ${pub.authors.slice(0, 2).join(', ')}`);
        console.log(`   Members: ${pub.memberAssociations.join(', ')}`);
        console.log(`   PDF: ${pub.hasPDF ? '✅' : '❌'}`);
      });
    }
    
    console.log('\n💰 Arweave Cost Estimates:');
    console.log(`📦 Estimated Size: ${report.costs.estimatedSize}`);
    console.log(`💵 Estimated Cost: ${report.costs.estimatedCost}`);
    console.log(`📝 ${report.costs.description}`);
    
    console.log('\n📁 Data Saved To:');
    console.log('  ./data/consortium/members.json');
    console.log('  ./data/consortium/publications.json');
    console.log('  ./data/consortium/processing-report.json');
    
    console.log('\n🎯 PROJECT STATUS:');
    if (report.summary.totalPublications > 0) {
      console.log('✅ Consortium content successfully identified');
      console.log('✅ Ready to proceed to ARFS upload phase');
      console.log('✅ Much smaller scope than full CrimRXiv archive');
    } else {
      console.log('⚠️  No consortium publications found');
      console.log('💡 May need to adjust filtering criteria or check export data');
    }
    
    console.log('='.repeat(60));
  }

  /**
   * Utility functions
   */
  slugToName(slug) {
    return slug
      .replace(/1c$/, '') // Remove consortium suffix
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Run processor if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const processor = new ConsortiumExportProcessor();
  processor.processConsortiumExport().catch(error => {
    console.error('Processing failed:', error.message);
    process.exit(1);
  });
}

export default ConsortiumExportProcessor;