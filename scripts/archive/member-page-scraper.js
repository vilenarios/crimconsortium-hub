#!/usr/bin/env node

/**
 * Member Page Scraper
 * Scrapes each consortium member's collection page to get ALL their publications
 * This bypasses API restrictions and gets complete publication lists
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger, FileHelper, ProgressTracker, withRetry } from '../src/lib/utils.js';

class MemberPageScraper {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    this.baseUrl = 'https://www.crimrxiv.com';
    
    // Consortium member collection pages (from consortium showcase analysis)
    this.memberPages = {
      'university-of-manchester': {
        name: 'University of Manchester, Department of Criminology',
        url: 'https://www.crimrxiv.com/uomcriminology'
      },
      'georgia-state-university': {
        name: 'Georgia State University, Evidence-Based Cybersecurity Research Group',
        url: 'https://www.crimrxiv.com/cybersecurity1c'
      },
      'john-jay-college': {
        name: 'John Jay College of Criminal Justice, Research & Evaluation Center',
        url: 'https://www.crimrxiv.com/johnjayrec1c'
      },
      'simon-fraser-university': {
        name: 'Simon Fraser University, School of Criminology',
        url: 'https://www.crimrxiv.com/sfu1c'
      },
      'temple-university': {
        name: 'Temple University, Department of Criminal Justice',
        url: 'https://www.crimrxiv.com/temple1c'
      },
      'ucl': {
        name: 'UCL, Bentham Project',
        url: 'https://www.crimrxiv.com/benthamproject1c'
      },
      'universite-de-montreal': {
        name: 'Université de Montréal, École de Criminologie',
        url: 'https://www.crimrxiv.com/montreal1c'
      },
      'university-of-cambridge': {
        name: 'University of Cambridge, Institute of Criminology, Prisons Research Centre',
        url: 'https://www.crimrxiv.com/prisonsresearch1c'
      },
      'ghent-university': {
        name: 'Ghent University, Department of Criminology',
        url: 'https://www.crimrxiv.com/ghent1c'
      }
    };
    
    this.config = {
      requestDelay: 3000, // Be more respectful
      timeout: 30000,
      maxRetries: 3,
      userAgent: 'CrimConsortium-Archive-Bot/2.0'
    };
    
    this.results = {
      members: [],
      publications: [],
      errors: []
    };
  }

  async scrapeAllMemberPages() {
    this.logger.info('🕷️ Scraping ALL consortium member pages for complete publication lists...');
    
    try {
      // Step 1: Scrape each member's collection page
      await this.scrapeMemberCollectionPages();
      
      // Step 2: Get full publication details
      await this.getPublicationDetails();
      
      // Step 3: Process and normalize data
      await this.processResults();
      
      // Step 4: Save comprehensive dataset
      await this.saveComprehensiveDataset();
      
      this.logger.success('Complete member page scraping finished');
      this.printDetailedResults();
      
      return this.results;
      
    } catch (error) {
      this.logger.error('Member page scraping failed', error.message);
      throw error;
    }
  }

  async scrapeMemberCollectionPages() {
    this.logger.info('📄 Scraping consortium member collection pages...');
    
    const tracker = new ProgressTracker(
      Object.keys(this.memberPages).length,
      'Scraping member pages'
    );
    
    for (const [memberId, memberInfo] of Object.entries(this.memberPages)) {
      try {
        await this.delay(this.config.requestDelay);
        
        const publicationLinks = await this.scrapeMemberPage(memberInfo.url);
        
        this.results.members.push({
          id: memberId,
          name: memberInfo.name,
          url: memberInfo.url,
          publicationCount: publicationLinks.length,
          publicationLinks: publicationLinks,
          scrapedAt: new Date().toISOString()
        });
        
        tracker.success(`✅ ${memberInfo.name}: ${publicationLinks.length} publications found`);
        
      } catch (error) {
        this.results.errors.push({
          member: memberId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        tracker.fail(error, memberId);
      }
    }
    
    tracker.complete();
    
    const totalPublications = this.results.members.reduce((sum, member) => sum + member.publicationCount, 0);
    this.logger.success(`Member pages scraped: ${totalPublications} total publication links found`);
  }

  async scrapeMemberPage(url) {
    try {
      return await withRetry(async () => {
        this.logger.info(`🔍 Scraping: ${url}`);
        
        const response = await axios.get(url, {
          timeout: this.config.timeout,
          headers: {
            'User-Agent': this.config.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        
        if (response.status !== 200) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Parse HTML with Cheerio
        const $ = cheerio.load(response.data);
        
        // Extract publication links
        const publicationLinks = [];
        
        // Look for various publication link patterns
        const linkSelectors = [
          'a[href*="/pub/"]',
          '.publication-link',
          '.pub-link',
          '.article-link'
        ];
        
        linkSelectors.forEach(selector => {
          $(selector).each((index, element) => {
            const href = $(element).attr('href');
            const title = $(element).text().trim();
            
            if (href && href.includes('/pub/')) {
              const slug = href.split('/pub/')[1]?.split('/')[0];
              
              if (slug && !publicationLinks.some(link => link.slug === slug)) {
                publicationLinks.push({
                  slug: slug,
                  url: href.startsWith('http') ? href : this.baseUrl + href,
                  title: title || 'Unknown Title',
                  extractedFrom: url
                });
              }
            }
          });
        });
        
        // Also look for any links in publication blocks or content areas
        $('.pub-preview, .publication-preview, .content-block').each((index, element) => {
          const $element = $(element);
          const links = $element.find('a[href*="/pub/"]');
          
          links.each((linkIndex, link) => {
            const href = $(link).attr('href');
            const title = $(link).text().trim();
            
            if (href) {
              const slug = href.split('/pub/')[1]?.split('/')[0];
              
              if (slug && !publicationLinks.some(l => l.slug === slug)) {
                publicationLinks.push({
                  slug: slug,
                  url: href.startsWith('http') ? href : this.baseUrl + href,
                  title: title || 'Unknown Title',
                  extractedFrom: url
                });
              }
            }
          });
        });
        
        this.logger.info(`📄 Found ${publicationLinks.length} publication links on ${url}`);
        return publicationLinks;
        
      }, this.config.maxRetries, 5000);
      
    } catch (error) {
      this.logger.error(`Failed to scrape ${url}:`, error.message);
      return []; // Return empty array on failure
    }
  }

  async getPublicationDetails() {
    this.logger.info('📖 Getting publication details for all found publications...');
    
    // Collect all unique publication links
    const allPublicationLinks = [];
    this.results.members.forEach(member => {
      member.publicationLinks.forEach(link => {
        if (!allPublicationLinks.some(existing => existing.slug === link.slug)) {
          allPublicationLinks.push({
            ...link,
            memberIds: [member.id],
            memberNames: [member.name]
          });
        } else {
          // Add member association to existing publication
          const existing = allPublicationLinks.find(p => p.slug === link.slug);
          if (!existing.memberIds.includes(member.id)) {
            existing.memberIds.push(member.id);
            existing.memberNames.push(member.name);
          }
        }
      });
    });
    
    this.logger.info(`📊 Processing ${allPublicationLinks.length} unique publications...`);
    
    const tracker = new ProgressTracker(allPublicationLinks.length, 'Getting publication details');
    
    // Process publications with rate limiting
    for (const link of allPublicationLinks) {
      try {
        await this.delay(2000); // Be respectful to CrimRXiv
        
        const details = await this.getPublicationMetadata(link);
        
        if (details) {
          this.results.publications.push({
            ...details,
            memberAssociations: link.memberIds,
            memberNames: link.memberNames,
            source: 'member-page-scraping'
          });
          
          tracker.success(`📄 ${details.title?.substring(0, 30)}...`);
        } else {
          tracker.increment(`❌ Failed: ${link.slug}`);
        }
        
      } catch (error) {
        tracker.fail(error, link.slug);
      }
    }
    
    tracker.complete();
    
    this.logger.success(`Publication details collected: ${this.results.publications.length} publications`);
  }

  async getPublicationMetadata(link) {
    try {
      return await withRetry(async () => {
        const response = await axios.get(link.url, {
          timeout: this.config.timeout,
          headers: {
            'User-Agent': this.config.userAgent
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract metadata using meta tags and content
        const title = this.extractMetaContent($, 'citation_title') || 
                      $('h1').first().text().trim() || 
                      link.title;
        
        const authors = this.extractAuthors($);
        const abstract = this.extractAbstract($);
        const doi = this.extractMetaContent($, 'citation_doi');
        const pdfUrl = this.extractMetaContent($, 'citation_pdf_url');
        const pubDate = this.extractMetaContent($, 'citation_publication_date');
        
        return {
          id: link.slug,
          slug: link.slug,
          title: title,
          description: abstract,
          doi: doi || '',
          authors: authors,
          createdAt: pubDate || new Date().toISOString(),
          downloads: pdfUrl ? { pdf: pdfUrl } : {},
          originalUrl: link.url,
          scrapedAt: new Date().toISOString()
        };
        
      }, this.config.maxRetries, 3000);
      
    } catch (error) {
      console.error(`Failed to get metadata for ${link.url}:`, error.message);
      return null;
    }
  }

  extractMetaContent($, name) {
    const meta = $(`meta[name="${name}"], meta[property="${name}"]`).first();
    return meta.attr('content') || null;
  }

  extractAuthors($) {
    const authors = [];
    
    // Try citation_author meta tags
    $('meta[name="citation_author"]').each((index, element) => {
      const author = $(element).attr('content');
      if (author) {
        authors.push({ name: author.trim(), affiliation: '' });
      }
    });
    
    // Fallback: look for byline or author elements
    if (authors.length === 0) {
      $('.byline, .author, .attribution').each((index, element) => {
        const text = $(element).text().trim();
        if (text && !authors.some(a => a.name === text)) {
          authors.push({ name: text, affiliation: '' });
        }
      });
    }
    
    return authors;
  }

  extractAbstract($) {
    // Try multiple selectors for abstract content
    const abstractSelectors = [
      'meta[name="description"]',
      '.abstract',
      '.summary',
      '.description',
      '.pub-description'
    ];
    
    for (const selector of abstractSelectors) {
      const element = $(selector).first();
      const content = element.attr('content') || element.text();
      
      if (content && content.trim().length > 50) {
        return content.trim().substring(0, 500);
      }
    }
    
    return '';
  }

  async processResults() {
    this.logger.info('⚙️ Processing and normalizing results...');
    
    // Update member publication counts based on actual results
    this.results.members.forEach(member => {
      const memberPublications = this.results.publications.filter(pub => 
        pub.memberAssociations.includes(member.id)
      );
      
      member.actualPublicationCount = memberPublications.length;
      member.publications = memberPublications.map(p => p.id);
    });
  }

  async saveComprehensiveDataset() {
    const comprehensiveDataset = {
      metadata: {
        name: 'CrimConsortium Complete Dataset',
        description: 'ALL consortium member publications via member page scraping',
        version: '3.0',
        scrapingMethod: 'Member page HTML scraping',
        createdAt: new Date().toISOString(),
        source: 'CrimRXiv member collection pages'
      },
      
      summary: {
        totalMembers: this.results.members.length,
        totalPublications: this.results.publications.length,
        membersWithContent: this.results.members.filter(m => m.actualPublicationCount > 0).length,
        scrapingErrors: this.results.errors.length,
        dateRange: this.calculateDateRange(this.results.publications)
      },
      
      members: this.results.members.map(member => ({
        id: member.id,
        name: member.name,
        publicationCount: member.actualPublicationCount,
        publications: member.publications,
        sourceUrl: member.url
      })),
      
      publications: this.results.publications,
      
      scrapingReport: {
        memberPagesScraped: this.results.members.length,
        totalPublicationLinks: this.results.members.reduce((sum, m) => sum + m.publicationCount, 0),
        successfulDetails: this.results.publications.length,
        errors: this.results.errors
      }
    };
    
    // Save comprehensive dataset
    await this.fileHelper.writeJSON('./data/final/consortium-dataset-comprehensive.json', comprehensiveDataset);
    
    // Create comparison report
    const comparison = await this.compareWithCurrent(comprehensiveDataset);
    await this.fileHelper.writeJSON('./data/final/scraping-comparison.json', comparison);
    
    this.logger.success('Comprehensive dataset saved');
    return comprehensiveDataset;
  }

  async compareWithCurrent(newDataset) {
    try {
      const currentDataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
      
      return {
        comparison: {
          currentPublications: currentDataset.publications?.length || 0,
          newPublications: newDataset.publications.length,
          increase: newDataset.publications.length - (currentDataset.publications?.length || 0)
        },
        memberComparison: this.memberPages.map(memberId => {
          const current = currentDataset.members?.find(m => m.id === memberId) || { publicationCount: 0 };
          const comprehensive = newDataset.members.find(m => m.id === memberId) || { publicationCount: 0 };
          
          return {
            member: comprehensive.name || memberId,
            currentCount: current.publicationCount,
            comprehensiveCount: comprehensive.publicationCount,
            increase: comprehensive.publicationCount - current.publicationCount
          };
        }),
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        error: 'Could not load current dataset for comparison',
        newDataset: {
          publications: newDataset.publications.length,
          members: newDataset.members.length
        }
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

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printDetailedResults() {
    console.log('\n' + '='.repeat(70));
    console.log('🕷️ COMPREHENSIVE MEMBER PAGE SCRAPING RESULTS');
    console.log('='.repeat(70));
    
    console.log(`📚 Member Pages Scraped: ${this.results.members.length}`);
    console.log(`📄 Total Publications Found: ${this.results.publications.length}`);
    console.log(`❌ Scraping Errors: ${this.results.errors.length}`);
    
    console.log('\n📊 Publications by Institution (Comprehensive):');
    this.results.members
      .filter(m => m.actualPublicationCount > 0)
      .sort((a, b) => b.actualPublicationCount - a.actualPublicationCount)
      .forEach(member => {
        console.log(`   ${member.name}: ${member.actualPublicationCount} publications`);
      });
    
    console.log('\n📈 Comparison with Current Dataset:');
    console.log(`   Current (affiliation-based): 37 publications`);
    console.log(`   Comprehensive (member pages): ${this.results.publications.length} publications`);
    console.log(`   Increase: +${this.results.publications.length - 37} publications`);
    
    if (this.results.errors.length > 0) {
      console.log('\n⚠️  Scraping Errors:');
      this.results.errors.forEach(error => {
        console.log(`   ${error.member}: ${error.error}`);
      });
    }
    
    console.log('\n📁 Data Saved:');
    console.log('   ./data/final/consortium-dataset-comprehensive.json');
    console.log('   ./data/final/scraping-comparison.json');
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Review comprehensive dataset quality');
    console.log('2. Replace current dataset if satisfied');
    console.log('3. npm run build to rebuild with complete data');
    console.log('4. Verify all member pages show accurate counts');
    
    console.log('='.repeat(70));
  }
}

// Run comprehensive member page scraper
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new MemberPageScraper();
  scraper.scrapeAllMemberPages().catch(error => {
    console.error('Scraping failed:', error.message);
    process.exit(1);
  });
}

export default MemberPageScraper;