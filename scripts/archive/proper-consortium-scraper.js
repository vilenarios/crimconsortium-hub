#!/usr/bin/env node

/**
 * Proper Consortium Scraper Using PubPub API
 * Queries each consortium member collection directly to get ALL their publications
 */

import axios from 'axios';
import { Logger, FileHelper, ProgressTracker, withRetry } from '../src/lib/utils.js';

class ProperConsortiumScraper {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    this.baseUrl = 'https://www.crimrxiv.com';
    this.apiUrl = 'https://www.crimrxiv.com/api';
    this.communityId = 'cb6ab371-fc70-4ef3-b2e5-d0d0580b4d37';
    
    // Known consortium member collection slugs (from consortium page analysis)
    this.consortiumCollections = {
      'uomcriminology': 'University of Manchester, Department of Criminology',
      'uomopenresearch': 'University of Manchester, Office for Open Research',
      'cybersecurity1c': 'Georgia State University, Evidence-Based Cybersecurity Research Group',
      'johnjayrec1c': 'John Jay College of Criminal Justice, Research & Evaluation Center',
      'sfu1c': 'Simon Fraser University, School of Criminology',
      'temple1c': 'Temple University, Department of Criminal Justice',
      'benthamproject1c': 'UCL, Bentham Project',
      'montreal1c': 'Université de Montréal, École de Criminologie',
      'prisonsresearch1c': 'University of Cambridge, Institute of Criminology, Prisons Research Centre',
      'uga1c': 'University of Georgia, Department of Sociology',
      'umsl1c': 'University of Missouri—St. Louis, Department of Criminology & Criminal Justice',
      'utd1c': 'University of Texas at Dallas, Criminology & Criminal Justice',
      'ghent1c': 'Ghent University, Department of Criminology',
      'acjs1c': 'Academy of Criminal Justice Sciences',
      'northeasternccj': 'Northeastern University, School of Criminology & Criminal Justice'
    };
    
    this.config = {
      requestDelay: 2000,
      timeout: 30000,
      maxRetries: 3,
      userAgent: 'CrimConsortium-Archive-Bot/2.0'
    };
    
    this.results = {
      collections: [],
      publications: [],
      members: [],
      errors: []
    };
  }

  async scrapeAllConsortiumCollections() {
    this.logger.info('🕷️ Scraping ALL consortium collections via PubPub API...');
    
    try {
      // Step 1: Get all consortium member collections
      await this.getConsortiumCollections();
      
      // Step 2: Get publications from each collection
      await this.getPublicationsFromCollections();
      
      // Step 3: Get full publication details
      await this.getFullPublicationDetails();
      
      // Step 4: Save comprehensive results
      await this.saveResults();
      
      this.logger.success('Complete consortium scraping finished');
      this.printResults();
      
      return this.results;
      
    } catch (error) {
      this.logger.error('Consortium scraping failed', error.message);
      throw error;
    }
  }

  async getConsortiumCollections() {
    this.logger.info('📚 Getting consortium member collections...');
    
    const tracker = new ProgressTracker(
      Object.keys(this.consortiumCollections).length, 
      'Fetching collections'
    );
    
    for (const [slug, name] of Object.entries(this.consortiumCollections)) {
      try {
        await this.delay(this.config.requestDelay);
        
        const collection = await this.getCollection(slug);
        
        if (collection) {
          this.results.collections.push({
            slug: slug,
            name: name,
            id: collection.id,
            title: collection.title,
            publicationCount: collection.collectionPubs ? collection.collectionPubs.length : 0,
            collectionPubs: collection.collectionPubs || [],
            isPublic: collection.isPublic
          });
          
          tracker.success(`✅ ${name}: ${collection.collectionPubs?.length || 0} publications`);
        } else {
          tracker.increment(`❌ Failed: ${slug}`);
        }
        
      } catch (error) {
        this.results.errors.push({
          collection: slug,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        tracker.fail(error, slug);
      }
    }
    
    tracker.complete();
    
    const totalCollections = this.results.collections.length;
    const totalPublications = this.results.collections.reduce((sum, col) => sum + col.publicationCount, 0);
    
    this.logger.success(`Collections loaded: ${totalCollections} collections with ${totalPublications} total publications`);
  }

  async getCollection(slug) {
    try {
      return await withRetry(async () => {
        const url = `${this.apiUrl}/collections/${slug}`;
        
        const response = await axios.get(url, {
          params: {
            include: ['collectionPubs', 'attributions'],
            attributes: ['id', 'title', 'slug', 'isPublic', 'metadata']
          },
          timeout: this.config.timeout,
          headers: {
            'User-Agent': this.config.userAgent,
            'Accept': 'application/json'
          }
        });
        
        if (response.data) {
          return response.data;
        }
        
        throw new Error('No data returned');
        
      }, this.config.maxRetries, 2000);
      
    } catch (error) {
      console.error(`Failed to get collection ${slug}:`, error.response?.status || error.message);
      return null;
    }
  }

  async getPublicationsFromCollections() {
    this.logger.info('📄 Getting publications from collections...');
    
    // Flatten all publication IDs from all collections
    const allPubIds = new Set();
    
    this.results.collections.forEach(collection => {
      collection.collectionPubs.forEach(collectionPub => {
        allPubIds.add(collectionPub.pubId);
      });
    });
    
    this.logger.info(`Found ${allPubIds.size} unique publication IDs across all collections`);
    
    // Create publication entries with collection associations
    Array.from(allPubIds).forEach(pubId => {
      // Find which collections this publication belongs to
      const memberCollections = this.results.collections.filter(collection => 
        collection.collectionPubs.some(cp => cp.pubId === pubId)
      );
      
      this.results.publications.push({
        id: pubId,
        memberCollections: memberCollections.map(col => ({
          slug: col.slug,
          name: col.name,
          id: col.id
        })),
        details: null // Will be filled in next step
      });
    });
  }

  async getFullPublicationDetails() {
    this.logger.info('📖 Getting full publication details...');
    
    const tracker = new ProgressTracker(
      this.results.publications.length,
      'Fetching publication details'
    );
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < this.results.publications.length; i += batchSize) {
      const batch = this.results.publications.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (pub, index) => {
        try {
          await this.delay(index * 500); // Stagger requests in batch
          
          const details = await this.getPublicationDetails(pub.id);
          if (details) {
            pub.details = details;
            tracker.success(`📄 ${details.title?.substring(0, 30)}...`);
          } else {
            tracker.increment(`❌ Failed: ${pub.id}`);
          }
          
        } catch (error) {
          tracker.fail(error, pub.id);
        }
      });
      
      await Promise.all(batchPromises);
      
      // Delay between batches
      if (i + batchSize < this.results.publications.length) {
        await this.delay(this.config.requestDelay);
      }
    }
    
    tracker.complete();
    
    const successfulDetails = this.results.publications.filter(p => p.details).length;
    this.logger.success(`Publication details loaded: ${successfulDetails}/${this.results.publications.length} successful`);
  }

  async getPublicationDetails(pubId) {
    try {
      return await withRetry(async () => {
        const url = `${this.apiUrl}/pubs/${pubId}`;
        
        const response = await axios.get(url, {
          params: {
            include: ['attributions', 'collectionPubs'],
            attributes: [
              'id', 'slug', 'title', 'description', 'doi', 'avatar',
              'createdAt', 'updatedAt', 'customPublishedAt', 'downloads'
            ]
          },
          timeout: this.config.timeout,
          headers: {
            'User-Agent': this.config.userAgent,
            'Accept': 'application/json'
          }
        });
        
        return response.data;
        
      }, this.config.maxRetries, 2000);
      
    } catch (error) {
      console.error(`Failed to get publication ${pubId}:`, error.response?.status || error.message);
      return null;
    }
  }

  async saveResults() {
    this.logger.info('💾 Saving comprehensive consortium data...');
    
    // Create member summaries
    this.results.members = this.results.collections.map(collection => ({
      id: this.slugToId(collection.slug),
      name: collection.name,
      slug: collection.slug,
      collectionId: collection.id,
      publicationCount: collection.publicationCount,
      publications: collection.collectionPubs.map(cp => cp.pubId)
    }));
    
    // Create normalized publication data
    const normalizedPublications = this.results.publications
      .filter(pub => pub.details)
      .map(pub => ({
        id: pub.details.id,
        slug: pub.details.slug,
        title: pub.details.title || '',
        description: pub.details.description || '',
        doi: pub.details.doi || '',
        createdAt: pub.details.createdAt,
        updatedAt: pub.details.updatedAt,
        
        // Authors from API
        authors: (pub.details.attributions || []).map(attr => ({
          name: attr.user?.fullName || attr.name || '',
          affiliation: attr.affiliation || '',
          orcid: attr.orcid || attr.user?.orcid || ''
        })),
        
        // Member associations from collections
        memberAssociations: pub.memberCollections.map(col => this.slugToId(col.slug)),
        memberNames: pub.memberCollections.map(col => col.name),
        
        // Downloads from API
        downloads: pub.details.downloads || {},
        
        // Archive metadata
        originalUrl: `https://www.crimrxiv.com/pub/${pub.details.slug}`,
        scrapedAt: new Date().toISOString(),
        source: 'api-collection-based',
        
        // File paths (to be filled during PDF processing)
        filePath: null,
        fileSize: 0
      }));
    
    // Save comprehensive dataset
    const comprehensiveDataset = {
      metadata: {
        name: 'CrimConsortium Complete Dataset',
        description: 'All consortium member publications via API collection queries',
        version: '3.0',
        scrapingMethod: 'API-based collection queries',
        createdAt: new Date().toISOString(),
        source: 'PubPub API + Collection Analysis'
      },
      
      summary: {
        totalMembers: this.results.members.length,
        totalCollections: this.results.collections.length,
        totalPublications: normalizedPublications.length,
        successfulCollections: this.results.collections.filter(c => c.publicationCount > 0).length,
        dateRange: this.calculateDateRange(normalizedPublications)
      },
      
      members: this.results.members,
      publications: normalizedPublications,
      
      collectionsAnalyzed: this.results.collections,
      errors: this.results.errors
    };
    
    // Save complete dataset
    await this.fileHelper.writeJSON('./data/final/consortium-dataset-complete.json', comprehensiveDataset);
    
    // Save analysis report
    const report = {
      summary: comprehensiveDataset.summary,
      comparisonWithPrevious: await this.compareWithPrevious(comprehensiveDataset),
      memberBreakdown: this.results.members.map(m => ({
        name: m.name,
        publicationCount: m.publicationCount
      })),
      generatedAt: new Date().toISOString()
    };
    
    await this.fileHelper.writeJSON('./data/final/api-scraping-report.json', report);
    
    this.logger.success('Comprehensive consortium data saved');
    
    return comprehensiveDataset;
  }

  async compareWithPrevious(newDataset) {
    try {
      const previousDataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
      
      return {
        previousPublications: previousDataset.publications?.length || 0,
        newPublications: newDataset.publications.length,
        increase: newDataset.publications.length - (previousDataset.publications?.length || 0),
        percentIncrease: Math.round(((newDataset.publications.length / (previousDataset.publications?.length || 1)) - 1) * 100)
      };
      
    } catch (error) {
      return {
        previousPublications: 0,
        newPublications: newDataset.publications.length,
        increase: newDataset.publications.length,
        note: 'No previous dataset found'
      };
    }
  }

  calculateDateRange(publications) {
    let earliest = null;
    let latest = null;
    
    publications.forEach(pub => {
      const date = new Date(pub.createdAt);
      if (isNaN(date.getTime())) return;
      
      if (!earliest || date < earliest) earliest = date;
      if (!latest || date > latest) latest = date;
    });
    
    return {
      earliest: earliest ? earliest.toISOString() : null,
      latest: latest ? latest.toISOString() : null
    };
  }

  slugToId(slug) {
    // Convert collection slug to standardized member ID
    const mapping = {
      'uomcriminology': 'university-of-manchester',
      'cybersecurity1c': 'georgia-state-university',
      'johnjayrec1c': 'john-jay-college',
      'sfu1c': 'simon-fraser-university',
      'temple1c': 'temple-university',
      'benthamproject1c': 'ucl',
      'montreal1c': 'universite-de-montreal',
      'prisonsresearch1c': 'university-of-cambridge',
      'uga1c': 'university-of-georgia',
      'umsl1c': 'university-of-missouri',
      'utd1c': 'university-of-texas-dallas',
      'ghent1c': 'ghent-university',
      'acjs1c': 'academy-criminal-justice',
      'northeasternccj': 'northeastern-university'
    };
    
    return mapping[slug] || slug.replace(/1c$/, '').replace(/[-_]/g, '-');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printResults() {
    console.log('\n' + '='.repeat(70));
    console.log('🕷️ COMPLETE CONSORTIUM SCRAPING RESULTS');
    console.log('='.repeat(70));
    
    console.log(`📚 Collections Analyzed: ${this.results.collections.length}`);
    console.log(`📄 Total Publications Found: ${this.results.publications.filter(p => p.details).length}`);
    console.log(`❌ Errors: ${this.results.errors.length}`);
    
    console.log('\n📊 Publications by Institution:');
    this.results.members
      .filter(m => m.publicationCount > 0)
      .sort((a, b) => b.publicationCount - a.publicationCount)
      .forEach(member => {
        console.log(`   ${member.name}: ${member.publicationCount} publications`);
      });
    
    const previousCount = 37; // Our current count
    const newCount = this.results.publications.filter(p => p.details).length;
    const increase = newCount - previousCount;
    
    console.log('\n📈 Comparison with Previous:');
    console.log(`   Previous (affiliation-based): ${previousCount} publications`);
    console.log(`   New (API collection-based): ${newCount} publications`);
    console.log(`   Increase: +${increase} publications (${Math.round((increase/previousCount)*100)}% more)`);
    
    if (this.results.errors.length > 0) {
      console.log('\n⚠️  Errors Encountered:');
      this.results.errors.slice(0, 5).forEach(error => {
        console.log(`   ${error.collection}: ${error.error}`);
      });
    }
    
    console.log('\n📁 Data Saved:');
    console.log('   ./data/final/consortium-dataset-complete.json');
    console.log('   ./data/final/api-scraping-report.json');
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Review the comprehensive dataset');
    console.log('2. Replace current dataset if satisfied');
    console.log('3. Rebuild site with complete data');
    console.log('4. Verify all member counts accurate');
    
    console.log('='.repeat(70));
  }
}

// Run comprehensive scraper
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new ProperConsortiumScraper();
  scraper.scrapeAllConsortiumCollections().catch(error => {
    console.error('Scraping failed:', error.message);
    process.exit(1);
  });
}

export default ProperConsortiumScraper;