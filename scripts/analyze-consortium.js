#!/usr/bin/env node

/**
 * Consortium Content Analyzer
 * Identifies consortium member institutions and their publications from export data
 */

import fs from 'fs-extra';
import * as cheerio from 'cheerio';
import { Logger, FileHelper, ProgressTracker } from '../src/lib/utils.js';

class ConsortiumAnalyzer {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    this.members = [];
    this.memberPublications = [];
    this.rawExportData = null;
    
    this.stats = {
      totalMembers: 0,
      totalPublications: 0,
      publicationsPerMember: {},
      dateRange: { earliest: null, latest: null }
    };
  }

  async analyze() {
    this.logger.info('🔍 Analyzing CrimConsortium content...');
    
    try {
      // Step 1: Extract member institutions from consortium page
      await this.extractConsortiumMembers();
      
      // Step 2: Load main export data
      await this.loadMainExport();
      
      // Step 3: Identify member publications
      await this.identifyMemberPublications();
      
      // Step 4: Generate consortium report
      await this.generateConsortiumReport();
      
      this.logger.success('Consortium analysis complete');
      
      return {
        members: this.members,
        publications: this.memberPublications,
        stats: this.stats
      };
      
    } catch (error) {
      this.logger.error('Consortium analysis failed', error.message);
      throw error;
    }
  }

  async extractConsortiumMembers() {
    this.logger.info('👥 Extracting consortium member institutions...');
    
    const consortiumHtml = await fs.readFile('./export/consortium/index.html', 'utf8');
    const $ = cheerio.load(consortiumHtml);
    
    // Extract member information from the page
    const memberElements = $('.page-preview-component');
    
    memberElements.each((index, element) => {
      const href = $(element).attr('href');
      const name = $(element).find('span').text().trim();
      const backgroundImage = $(element).attr('style');
      
      if (href && name) {
        // Extract slug from href
        const slug = href.replace('/', '');
        
        // Extract logo URL from background-image style
        let logoUrl = null;
        if (backgroundImage) {
          const urlMatch = backgroundImage.match(/url\(&quot;([^&]*)&quot;\)/);
          if (urlMatch) {
            logoUrl = urlMatch[1];
          }
        }
        
        const member = {
          id: slug,
          name: name,
          slug: slug,
          originalUrl: `https://www.crimrxiv.com${href}`,
          logoUrl: logoUrl,
          publications: [],
          publicationCount: 0
        };
        
        this.members.push(member);
      }
    });
    
    this.stats.totalMembers = this.members.length;
    
    this.logger.success(`Found ${this.members.length} consortium members`);
    
    // Print member list for verification
    console.log('\n📋 Consortium Members:');
    this.members.forEach((member, index) => {
      console.log(`${index + 1}. ${member.name} (${member.slug})`);
    });
    console.log('');
  }

  async loadMainExport() {
    this.logger.info('📊 Loading main export data...');
    
    this.rawExportData = await this.fileHelper.readJSON('./export/export.json');
    
    if (!this.rawExportData || !this.rawExportData.pubs) {
      throw new Error('Invalid export data format');
    }
    
    this.logger.success(`Export loaded: ${this.rawExportData.pubs.length} total publications`);
  }

  async identifyMemberPublications() {
    this.logger.info('🔗 Identifying consortium member publications...');
    
    const tracker = new ProgressTracker(this.rawExportData.pubs.length, 'Analyzing publications');
    
    // Create lookup map for efficient member checking
    const memberSlugs = new Set(this.members.map(m => m.slug));
    const memberLookup = new Map(this.members.map(m => [m.slug, m]));
    
    for (const pub of this.rawExportData.pubs) {
      try {
        // Check if publication belongs to consortium member
        const isMemberPublication = await this.checkMemberPublication(pub, memberSlugs);
        
        if (isMemberPublication) {
          // Determine which member(s) this publication belongs to
          const associatedMembers = await this.findAssociatedMembers(pub, memberLookup);
          
          // Create consortium publication entry
          const consortiumPub = {
            id: pub.id,
            slug: pub.slug,
            title: pub.title || '',
            description: pub.description || '',
            doi: pub.doi || '',
            createdAt: pub.createdAt,
            updatedAt: pub.updatedAt,
            authors: this.extractAuthors(pub),
            downloads: this.extractDownloads(pub),
            members: associatedMembers,
            collections: this.extractCollections(pub),
            originalUrl: `https://www.crimrxiv.com/pub/${pub.slug}`
          };
          
          this.memberPublications.push(consortiumPub);
          
          // Update member publication counts
          associatedMembers.forEach(memberSlug => {
            const member = memberLookup.get(memberSlug);
            if (member) {
              member.publications.push(consortiumPub.id);
              member.publicationCount++;
            }
          });
          
          tracker.success(`📄 ${consortiumPub.title.substring(0, 40)}...`);
        } else {
          tracker.increment('⏭️ Non-member');
        }
        
      } catch (error) {
        tracker.fail(error, pub.id);
      }
    }
    
    const summary = tracker.complete();
    
    this.stats.totalPublications = this.memberPublications.length;
    this.stats.publicationsPerMember = Object.fromEntries(
      this.members.map(m => [m.name, m.publicationCount])
    );
    
    // Calculate date range
    this.calculateDateRange();
    
    this.logger.success(`Found ${this.memberPublications.length} consortium member publications`);
  }

  async checkMemberPublication(pub, memberSlugs) {
    // Check collection membership
    if (pub.collectionPubs && Array.isArray(pub.collectionPubs)) {
      for (const collectionPub of pub.collectionPubs) {
        if (collectionPub.collection && collectionPub.collection.slug) {
          if (memberSlugs.has(collectionPub.collection.slug)) {
            return true;
          }
        }
      }
    }
    
    // Check if publication appears in any member-specific export directories
    const slugsToCheck = Array.from(memberSlugs);
    for (const memberSlug of slugsToCheck) {
      const memberDir = `./export/${memberSlug}`;
      if (await this.fileHelper.exists(memberDir)) {
        const pubDir = `${memberDir}/pub/${pub.slug}`;
        if (await this.fileHelper.exists(pubDir)) {
          return true;
        }
      }
    }
    
    return false;
  }

  async findAssociatedMembers(pub, memberLookup) {
    const associatedMembers = [];
    
    // Check collection associations
    if (pub.collectionPubs && Array.isArray(pub.collectionPubs)) {
      for (const collectionPub of pub.collectionPubs) {
        if (collectionPub.collection && collectionPub.collection.slug) {
          const slug = collectionPub.collection.slug;
          if (memberLookup.has(slug)) {
            associatedMembers.push(slug);
          }
        }
      }
    }
    
    // Remove duplicates
    return [...new Set(associatedMembers)];
  }

  extractAuthors(pub) {
    const authors = [];
    
    if (pub.attributions && Array.isArray(pub.attributions)) {
      for (const attribution of pub.attributions) {
        if (attribution.user && attribution.user.fullName) {
          authors.push({
            name: attribution.user.fullName,
            affiliation: attribution.affiliation || '',
            orcid: attribution.orcid || attribution.user.orcid || ''
          });
        } else if (attribution.name) {
          authors.push({
            name: attribution.name,
            affiliation: attribution.affiliation || '',
            orcid: attribution.orcid || ''
          });
        }
      }
    }
    
    return authors;
  }

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

  extractCollections(pub) {
    const collections = [];
    
    if (pub.collectionPubs && Array.isArray(pub.collectionPubs)) {
      for (const collectionPub of pub.collectionPubs) {
        if (collectionPub.collection) {
          collections.push({
            id: collectionPub.collection.id,
            title: collectionPub.collection.title,
            slug: collectionPub.collection.slug
          });
        }
      }
    }
    
    return collections;
  }

  calculateDateRange() {
    let earliest = null;
    let latest = null;
    
    for (const pub of this.memberPublications) {
      const date = new Date(pub.createdAt);
      if (isNaN(date.getTime())) continue;
      
      if (!earliest || date < earliest) earliest = date;
      if (!latest || date > latest) latest = date;
    }
    
    this.stats.dateRange = {
      earliest: earliest ? earliest.toISOString() : null,
      latest: latest ? latest.toISOString() : null
    };
  }

  async generateConsortiumReport() {
    this.logger.info('📊 Generating consortium report...');
    
    const report = {
      summary: {
        totalMembers: this.stats.totalMembers,
        totalPublications: this.stats.totalPublications,
        averagePublicationsPerMember: Math.round(this.stats.totalPublications / this.stats.totalMembers),
        dateRange: this.stats.dateRange
      },
      members: this.members.map(member => ({
        name: member.name,
        slug: member.slug,
        publicationCount: member.publicationCount,
        logoUrl: member.logoUrl
      })),
      topProducers: this.members
        .sort((a, b) => b.publicationCount - a.publicationCount)
        .slice(0, 10)
        .map(m => ({ name: m.name, count: m.publicationCount })),
      publicationsByYear: this.groupPublicationsByYear(),
      samplePublications: this.memberPublications.slice(0, 10),
      generatedAt: new Date().toISOString()
    };
    
    // Save report
    await this.fileHelper.ensureDir('./data');
    await this.fileHelper.writeJSON('./data/consortium-analysis.json', report);
    
    // Save member list for easy reference
    await this.fileHelper.writeJSON('./data/consortium-members.json', this.members);
    
    // Save filtered publications
    await this.fileHelper.writeJSON('./data/consortium-publications.json', this.memberPublications);
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }

  groupPublicationsByYear() {
    const byYear = {};
    
    for (const pub of this.memberPublications) {
      const year = new Date(pub.createdAt).getFullYear();
      if (!isNaN(year)) {
        byYear[year] = (byYear[year] || 0) + 1;
      }
    }
    
    return byYear;
  }

  printSummary(report) {
    this.logger.success('📋 Consortium Analysis Summary');
    console.log('');
    console.log(`📊 Total Consortium Members: ${report.summary.totalMembers}`);
    console.log(`📚 Total Member Publications: ${report.summary.totalPublications}`);
    console.log(`📈 Average Publications per Member: ${report.summary.averagePublicationsPerMember}`);
    console.log(`📅 Date Range: ${report.summary.dateRange.earliest?.split('T')[0]} to ${report.summary.dateRange.latest?.split('T')[0]}`);
    console.log('');
    
    console.log('🏆 Top 5 Publishing Members:');
    report.topProducers.slice(0, 5).forEach((producer, index) => {
      console.log(`${index + 1}. ${producer.name}: ${producer.count} publications`);
    });
    console.log('');
    
    console.log('📈 Publications by Year:');
    Object.entries(report.publicationsByYear)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([year, count]) => {
        console.log(`${year}: ${count} publications`);
      });
    console.log('');
    
    console.log('💾 Data saved to:');
    console.log('  ./data/consortium-analysis.json    (Full report)');
    console.log('  ./data/consortium-members.json     (Member list)');  
    console.log('  ./data/consortium-publications.json (Publications)');
    console.log('');
    
    // Size estimate for Arweave costs
    const estimatedSize = report.summary.totalPublications * 2; // 2MB average per PDF
    const estimatedCost = estimatedSize * 0.000000001 * 500000000; // Rough AR cost estimate
    
    console.log('💰 Estimated Arweave Costs:');
    console.log(`  Estimated Size: ~${estimatedSize}MB`);
    console.log(`  Estimated Cost: ~$${(estimatedCost * 10).toFixed(2)} (${estimatedCost.toFixed(6)} AR)`);
    console.log('  (Much lower than original 3,630 article estimate!)');
  }
}

// Run analysis if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new ConsortiumAnalyzer();
  analyzer.analyze().catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });
}

export default ConsortiumAnalyzer;