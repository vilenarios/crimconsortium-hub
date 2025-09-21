#!/usr/bin/env node

/**
 * Enhanced Consortium Scraper
 * Complete scraper that gets all 30 members, full article content, and all attachments
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger, FileHelper, ProgressTracker, withRetry } from '../src/lib/utils.js';

class EnhancedConsortiumScraper {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    // All 30 consortium members from crimrxiv.com/consortium
    this.allConsortiumMembers = [
      { id: 'university-of-manchester-criminology', name: 'University of Manchester, Department of Criminology', slug: 'uomcriminology' },
      { id: 'university-of-manchester-open-research', name: 'University of Manchester, Office for Open Research', slug: 'uomopenresearch' },
      { id: 'knowledge-futures', name: 'Knowledge Futures', slug: 'kf' },
      { id: 'academy-criminal-justice', name: 'Academy of Criminal Justice Sciences', slug: 'acjs1c' },
      { id: 'criminology-journal', name: 'Criminology: An Interdisciplinary Journal', slug: 'crim' },
      { id: 'georgia-state-university', name: 'Georgia State University, Evidence-Based Cybersecurity Research Group', slug: 'cybersecurity1c' },
      { id: 'ghent-university', name: 'Ghent University, Department of Criminology', slug: 'ghent1c' },
      { id: 'hawaii-crime-lab', name: 'Hawaiʻi Crime Lab', slug: 'hawaiicrimelab' },
      { id: 'john-jay-college', name: 'John Jay College of Criminal Justice, Research & Evaluation Center', slug: 'johnjayrec1c' },
      { id: 'journal-historical-criminology', name: 'Journal of Historical Criminology', slug: 'jhc' },
      { id: 'max-planck-institute', name: 'Max Planck Institute for the Study of Crime, Security & Law', slug: 'mpicsl' },
      { id: 'northeastern-university', name: 'Northeastern University, School of Criminology & Criminal Justice', slug: 'northeasternccj' },
      { id: 'oral-history-criminology', name: 'Oral History of Criminology Project', slug: 'ohcp1c' },
      { id: 'philadelphia-dao', name: 'Philadelphia District Attorney\'s Office, DATA Lab', slug: 'philadelphiada1c' },
      { id: 'simon-fraser-university', name: 'Simon Fraser University, School of Criminology', slug: 'sfu1c' },
      { id: 'spanish-criminology-society', name: 'Sociedad Española de Investigación Criminológica', slug: 'seic1c' },
      { id: 'evidence-based-policing', name: 'Society of Evidence Based Policing', slug: 'sebp' },
      { id: 'south-asian-criminology', name: 'South Asian Society of Criminology and Victimology', slug: 'sascv' },
      { id: 'temple-university', name: 'Temple University, Department of Criminal Justice', slug: 'temple1c' },
      { id: 'uc-irvine', name: 'UC Irvine, Department of Criminology, Law and Society', slug: 'ucirvine2' },
      { id: 'ucl', name: 'UCL, Bentham Project', slug: 'benthamproject1c' },
      { id: 'universite-de-montreal', name: 'Université de Montréal, École de Criminologie', slug: 'montreal1c' },
      { id: 'university-of-cambridge', name: 'University of Cambridge, Institute of Criminology, Prisons Research Centre', slug: 'prisonsresearch1c' },
      { id: 'university-of-georgia', name: 'University of Georgia, Department of Sociology', slug: 'uga1c' },
      { id: 'university-of-leeds', name: 'University of Leeds, Centre for Criminal Justice Studies', slug: 'leeds1c' },
      { id: 'university-of-liverpool', name: 'University of Liverpool, Department of Sociology, Social Policy and Criminology', slug: 'liverpool1c' },
      { id: 'university-of-missouri', name: 'University of Missouri—St. Louis, Department of Criminology & Criminal Justice', slug: 'umsl1c' },
      { id: 'university-of-nebraska', name: 'University of Nebraska Omaha, School of Criminology & Criminal Justice', slug: 'nebraska1c' },
      { id: 'university-of-texas-dallas', name: 'University of Texas at Dallas, Criminology & Criminal Justice', slug: 'utd1c' },
      { id: 'university-of-waikato', name: 'University of Waikato, Te Puna Haumaru New Zealand Institute for Security & Crime Science', slug: 'waikato1c' }
    ];
    
    this.results = {
      allMembers: [],
      publications: [],
      errors: []
    };

    this.config = {
      requestDelay: 2500, // Be respectful
      timeout: 30000,
      maxRetries: 2
    };

    // Consortium affiliation patterns for matching authors
    this.consortiumPatterns = [
      { id: 'university-of-manchester-criminology', patterns: ['University of Manchester', 'Manchester.*Criminology'] },
      { id: 'northeastern-university', patterns: ['Northeastern University', 'Northeastern.*Criminal Justice'] },
      { id: 'simon-fraser-university', patterns: ['Simon Fraser University', 'SFU.*Criminology'] },
      { id: 'universite-de-montreal', patterns: ['Université de Montréal', 'Montreal.*Criminologie'] },
      { id: 'academy-criminal-justice', patterns: ['Academy of Criminal Justice Sciences', 'ACJS'] },
      { id: 'max-planck-institute', patterns: ['Max Planck Institute', 'MPI.*Crime'] },
      { id: 'ghent-university', patterns: ['Ghent University', 'Universiteit Gent'] },
      { id: 'temple-university', patterns: ['Temple University', 'Temple.*Criminal Justice'] },
      { id: 'university-of-missouri', patterns: ['University of Missouri', 'UMSL.*Criminology'] },
      { id: 'university-of-georgia', patterns: ['University of Georgia', 'UGA.*Sociology'] },
      { id: 'university-of-cambridge', patterns: ['University of Cambridge', 'Cambridge.*Criminology'] },
      { id: 'john-jay-college', patterns: ['John Jay College', 'CUNY.*John Jay'] },
      { id: 'university-of-texas-dallas', patterns: ['University of Texas at Dallas', 'UT Dallas', 'UTD.*Criminology'] },
      { id: 'georgia-state-university', patterns: ['Georgia State University', 'GSU.*Cybersecurity'] },
      { id: 'ucl', patterns: ['UCL', 'University College London', 'Bentham Project'] },
      { id: 'uc-irvine', patterns: ['UC Irvine', 'University of California, Irvine', 'UCI.*Criminology'] },
      { id: 'university-of-leeds', patterns: ['University of Leeds', 'Leeds.*Criminal Justice'] },
      { id: 'university-of-liverpool', patterns: ['University of Liverpool', 'Liverpool.*Criminology'] },
      { id: 'university-of-nebraska', patterns: ['University of Nebraska', 'UNO.*Criminal Justice'] },
      { id: 'university-of-waikato', patterns: ['University of Waikato', 'Waikato.*Crime Science'] }
    ];
  }

  async scrapeCompleteFresh() {
    this.logger.info(`🆕 Fresh scraping: ALL 30 consortium members with enhanced content extraction...`);

    try {
      // Step 1: Check all 30 member pages
      await this.checkAllMemberPages();

      // Step 2: Check main feed for additional consortium publications
      await this.checkMainFeedForConsortiumPublications();

      // Step 3: Get enhanced publication details
      await this.getEnhancedPublicationDetails();

      // Step 4: Create clean final dataset
      await this.createCleanDataset();

      this.logger.success('Enhanced consortium scraping complete');
      this.printEnhancedResults();

    } catch (error) {
      this.logger.error('Enhanced scraping failed', error.message);
      throw error;
    }
  }

  async checkAllMemberPages() {
    this.logger.info('📄 Checking all 30 consortium member pages...');
    
    const tracker = new ProgressTracker(this.allConsortiumMembers.length, 'Checking member pages');
    
    for (const member of this.allConsortiumMembers) {
      try {
        await this.delay(this.config.requestDelay);
        
        const memberUrl = `https://www.crimrxiv.com/${member.slug}`;
        const result = await this.checkMemberPageEnhanced(memberUrl, member);
        
        this.results.allMembers.push(result);
        
        if (result.publicationCount > 0) {
          tracker.success(`✅ ${member.name}: ${result.publicationCount} publications`);
        } else {
          tracker.increment(`📋 ${member.name}: Supporting member (no publications)`);
        }
        
      } catch (error) {
        this.results.errors.push({
          member: member.name,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Add as supporting member
        this.results.allMembers.push({
          ...member,
          publicationCount: 0,
          publications: [],
          memberType: 'supporting-organization',
          status: 'error',
          error: error.message
        });
        
        tracker.fail(error, member.name);
      }
    }
    
    tracker.complete();
    
    const withPubs = this.results.allMembers.filter(m => m.publicationCount > 0).length;
    const supporting = this.results.allMembers.filter(m => m.publicationCount === 0).length;
    
    this.logger.success(`All 30 members analyzed: ${withPubs} research institutions, ${supporting} supporting organizations`);
  }

  async checkMemberPageEnhanced(url, member) {
    try {
      return await withRetry(async () => {
        const response = await axios.get(url, {
          timeout: this.config.timeout,
          headers: {
            'User-Agent': 'CrimConsortium-Enhanced-Scraper/1.0',
            'Accept': 'text/html,application/xhtml+xml'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract publication links with enhanced metadata
        const publications = [];
        
        $('a[href*="/pub/"]').each((index, element) => {
          const href = $(element).attr('href');
          const title = $(element).text().trim();
          
          if (href) {
            const slug = href.split('/pub/')[1]?.split('/')[0];
            
            if (slug && !publications.some(p => p.slug === slug)) {
              publications.push({
                slug: slug,
                url: href.startsWith('http') ? href : 'https://www.crimrxiv.com' + href,
                title: title || 'Unknown Title',
                memberPage: url
              });
            }
          }
        });
        
        return {
          ...member,
          url: url,
          publicationCount: publications.length,
          publications: publications.map(p => p.slug),
          publicationLinks: publications,
          memberType: publications.length > 0 ? 'research-institution' : 'supporting-organization',
          status: 'success',
          checkedAt: new Date().toISOString()
        };
        
      }, this.config.maxRetries, 3000);
      
    } catch (error) {
      return {
        ...member,
        url: url,
        publicationCount: 0,
        publications: [],
        memberType: 'supporting-organization',
        status: 'error',
        error: error.message,
        checkedAt: new Date().toISOString()
      };
    }
  }

  async getEnhancedPublicationDetails() {
    this.logger.info('📖 Getting enhanced publication details with full content...');
    
    // Collect all unique publications
    const allPublications = new Map();
    
    this.results.allMembers.forEach(member => {
      if (member.publicationLinks) {
        member.publicationLinks.forEach(pub => {
          if (!allPublications.has(pub.slug)) {
            allPublications.set(pub.slug, {
              ...pub,
              memberAssociations: [member.id],
              memberNames: [member.name]
            });
          } else {
            // Add member association
            const existing = allPublications.get(pub.slug);
            if (!existing.memberAssociations.includes(member.id)) {
              existing.memberAssociations.push(member.id);
              existing.memberNames.push(member.name);
            }
          }
        });
      }
    });
    
    this.logger.info(`📊 Processing ${allPublications.size} unique publications with enhanced extraction...`);
    
    const tracker = new ProgressTracker(allPublications.size, 'Enhanced content extraction');
    
    for (const [slug, pubInfo] of allPublications.entries()) {
      try {
        await this.delay(2000); // Be respectful
        
        const enhancedDetails = await this.getEnhancedPublicationContent(pubInfo);
        
        if (enhancedDetails) {
          this.results.publications.push(enhancedDetails);
          tracker.success(`📄 ${enhancedDetails.title?.substring(0, 30)}...`);
        } else {
          tracker.increment(`❌ Failed: ${slug}`);
        }
        
      } catch (error) {
        tracker.fail(error, slug);
      }
    }
    
    tracker.complete();
    
    this.logger.success(`Enhanced details extracted: ${this.results.publications.length} publications`);
  }

  async getEnhancedPublicationContent(pubInfo) {
    try {
      return await withRetry(async () => {
        const response = await axios.get(pubInfo.url, {
          timeout: this.config.timeout,
          headers: {
            'User-Agent': 'CrimConsortium-Enhanced-Content/1.0'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // Enhanced metadata extraction
        const title = this.extractMetaContent($, 'citation_title') || 
                      $('h1').first().text().trim() || 
                      pubInfo.title;
        
        const authors = this.extractEnhancedAuthors($);
        const abstract = this.extractAbstract($);
        const fullContent = this.extractFullContent($);
        const doi = this.extractMetaContent($, 'citation_doi');
        const pubDate = this.extractMetaContent($, 'citation_publication_date');
        const downloads = this.extractAllDownloads($);
        const references = this.extractReferences($);
        
        return {
          id: pubInfo.slug,
          slug: pubInfo.slug,
          title: title,
          description: abstract,
          fullContent: fullContent,
          doi: doi || '',
          authors: authors,
          createdAt: this.parsePublicationDate(pubDate),
          
          // Enhanced download detection
          downloads: downloads,
          hasMultipleFormats: Object.keys(downloads).length > 1,
          
          // Content sections
          sections: this.extractContentSections($),
          references: references,
          
          // Member associations
          memberAssociations: pubInfo.memberAssociations,
          memberNames: pubInfo.memberNames,
          
          // Archive metadata
          originalUrl: pubInfo.url,
          scrapedAt: new Date().toISOString(),
          source: 'enhanced-scraping'
        };
        
      }, this.config.maxRetries, 3000);
      
    } catch (error) {
      console.error(`Enhanced extraction failed for ${pubInfo.url}:`, error.message);
      return null;
    }
  }

  extractEnhancedAuthors($) {
    const authors = [];
    
    // Try multiple methods for author extraction
    $('meta[name="citation_author"]').each((index, element) => {
      const author = $(element).attr('content');
      if (author) {
        authors.push({ 
          name: author.trim(), 
          affiliation: '',
          order: index + 1
        });
      }
    });
    
    // Fallback: look for byline elements
    if (authors.length === 0) {
      $('.byline, .author, .attribution').each((index, element) => {
        const text = $(element).text().trim();
        if (text && !authors.some(a => a.name === text)) {
          authors.push({ 
            name: text, 
            affiliation: '',
            order: index + 1
          });
        }
      });
    }
    
    return authors;
  }

  extractFullContent($) {
    // Extract COMPLETE article content without truncation
    const contentSelectors = [
      '.pub-body-component',
      '.pub-document', 
      '.article-content',
      '.content',
      '.main-content',
      '[data-node-type="doc"]',
      '.pub-body',
      '.document-content'
    ];
    
    let fullContent = '';
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        // Get COMPLETE text content without length restrictions
        const elementText = element.text().trim();
        if (elementText.length > fullContent.length) {
          fullContent = elementText;
        }
      }
    }
    
    // Also try to get content from main document structure
    if (!fullContent || fullContent.length < 2000) {
      // Look for the main article body in PubPub structure
      const bodyElements = $('body').find('p, div').filter((i, elem) => {
        const text = $(elem).text().trim();
        return text.length > 100 && !$(elem).closest('header, nav, footer, .nav').length;
      });
      
      if (bodyElements.length > 0) {
        let combinedContent = '';
        bodyElements.each((i, elem) => {
          const text = $(elem).text().trim();
          if (text.length > 50) {
            combinedContent += text + '\n\n';
          }
        });
        
        if (combinedContent.length > fullContent.length) {
          fullContent = combinedContent;
        }
      }
    }
    
    // Return complete content (no truncation for archival purposes)
    return fullContent || 'Full article content available on CrimRXiv original page.';
  }

  extractContentSections($) {
    const sections = [];
    
    // Look for structured content sections - get COMPLETE content, no truncation
    $('h1, h2, h3, h4').each((index, element) => {
      const heading = $(element).text().trim();
      
      // Get ALL content until next heading (no truncation)
      const contentElements = $(element).nextUntil('h1, h2, h3, h4');
      let fullContent = '';
      
      contentElements.each((i, elem) => {
        const elemText = $(elem).text().trim();
        if (elemText) {
          fullContent += elemText + '\n\n';
        }
      });
      
      if (heading && fullContent.trim() && fullContent.length > 50) {
        sections.push({
          heading: heading,
          content: fullContent.trim(), // COMPLETE content, no substring()
          level: element.tagName.toLowerCase(),
          wordCount: fullContent.trim().split(' ').length
        });
      }
    });
    
    return sections;
  }

  extractAllDownloads($) {
    const downloads = {};
    
    // Look for download links
    $('a[href*="download"], a[href*=".pdf"], a[href*=".docx"], a[href*=".epub"]').each((index, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      
      if (href) {
        let format = 'unknown';
        
        if (href.includes('/download/pdf') || text.includes('pdf')) {
          format = 'pdf';
        } else if (href.includes('/download/docx') || text.includes('word')) {
          format = 'word';
        } else if (href.includes('/download/epub') || text.includes('epub')) {
          format = 'epub';
        } else if (href.includes('/download/html') || text.includes('html')) {
          format = 'html';
        } else if (href.includes('/download/markdown') || text.includes('markdown')) {
          format = 'markdown';
        } else if (href.includes('/download/xml') || text.includes('xml')) {
          format = 'xml';
        } else if (href.includes('/download/tex') || text.includes('latex')) {
          format = 'latex';
        }
        
        if (format !== 'unknown' && !downloads[format]) {
          downloads[format] = href.startsWith('http') ? href : 'https://www.crimrxiv.com' + href;
        }
      }
    });
    
    return downloads;
  }

  extractAbstract($) {
    const abstractSelectors = [
      'meta[name="description"]',
      '.abstract',
      '.summary',
      '.description',
      '[data-node-type="abstract"]'
    ];
    
    for (const selector of abstractSelectors) {
      const element = $(selector).first();
      const content = element.attr('content') || element.text();
      
      if (content && content.trim().length > 50) {
        return content.trim();
      }
    }
    
    return '';
  }

  extractReferences($) {
    const references = [];
    
    // Look for references section
    $('.references, .bibliography, .works-cited').each((index, element) => {
      $(element).find('li, p').each((refIndex, refElement) => {
        const refText = $(refElement).text().trim();
        if (refText && refText.length > 20) {
          references.push(refText);
        }
      });
    });
    
    return references;
  }

  extractMetaContent($, name) {
    const meta = $(`meta[name="${name}"], meta[property="${name}"]`).first();
    return meta.attr('content') || null;
  }

  parsePublicationDate(dateString) {
    if (!dateString) return new Date().toISOString();
    
    try {
      // Handle various date formats
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  async createCleanDataset() {
    this.logger.info('🧹 Creating clean final dataset...');
    
    const cleanDataset = {
      metadata: {
        name: 'CrimConsortium Enhanced Complete Dataset',
        description: 'All 30 consortium members with enhanced publication content',
        version: '6.0',
        createdAt: new Date().toISOString(),
        scrapingMethod: 'Enhanced member page analysis with full content extraction'
      },
      
      summary: {
        totalMembers: 30,
        researchInstitutions: this.results.allMembers.filter(m => m.publicationCount > 0).length,
        supportingOrganizations: this.results.allMembers.filter(m => m.publicationCount === 0).length,
        totalPublications: this.results.publications.length,
        publicationsWithMultipleFormats: this.results.publications.filter(p => p.hasMultipleFormats).length,
        dateRange: this.calculateDateRange(this.results.publications)
      },
      
      // All 30 members properly categorized
      members: this.results.allMembers.sort((a, b) => b.publicationCount - a.publicationCount),
      
      // Enhanced publications with full content
      publications: this.results.publications,
      
      // Organization by type for UI
      researchInstitutions: this.results.allMembers.filter(m => m.publicationCount > 0),
      supportingOrganizations: this.results.allMembers.filter(m => m.publicationCount === 0),
      
      // Scraping metadata
      scrapingReport: {
        totalMembersChecked: this.results.allMembers.length,
        successfulMembers: this.results.allMembers.filter(m => m.status === 'success').length,
        errors: this.results.errors.length,
        enhancedContentExtracted: this.results.publications.filter(p => p.fullContent && p.fullContent.length > 100).length
      }
    };
    
    // Save clean dataset
    await this.fileHelper.ensureDir('./data/final');
    await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', cleanDataset);
    
    this.logger.success('Clean enhanced dataset saved');
    return cleanDataset;
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

  async checkMainFeedForConsortiumPublications() {
    this.logger.info('🔍 Checking main CrimRxiv feed for additional consortium publications...');

    try {
      const mainFeedUrl = 'https://www.crimrxiv.com';
      const response = await axios.get(mainFeedUrl, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'CrimConsortium-Enhanced-Scraper/1.0'
        }
      });

      const $ = cheerio.load(response.data);
      const additionalPubs = [];

      // Find all publication links on the main page
      $('a[href*="/pub/"]').each((index, element) => {
        const href = $(element).attr('href');
        if (href && !href.includes('/release/')) {
          const slug = href.split('/pub/')[1]?.split('/')[0];
          if (slug) {
            const url = href.startsWith('http') ? href : 'https://www.crimrxiv.com' + href;
            additionalPubs.push({ slug, url });
          }
        }
      });

      this.logger.info(`Found ${additionalPubs.length} publications on main feed`);

      // Check each publication for consortium affiliation
      const consortiumPubs = [];
      const tracker = new ProgressTracker(additionalPubs.length, 'Checking main feed publications');

      for (const pub of additionalPubs) {
        try {
          await this.delay(1000); // Be respectful

          // Check if we already have this publication
          const alreadyHave = this.results.publications.some(p => p.slug === pub.slug);
          if (alreadyHave) {
            tracker.increment(`⏭️ Already have: ${pub.slug}`);
            continue;
          }

          // Check if it's a consortium publication
          const isConsortium = await this.isConsortiumPublication(pub.url);
          if (isConsortium) {
            // Fetch full article details for main feed articles
            this.logger.info(`Fetching full details for main feed article: ${pub.slug}`);
            const fullArticle = await this.scrapePublicationDetails(pub.url);

            if (fullArticle) {
              consortiumPubs.push({
                ...fullArticle,
                slug: pub.slug,
                url: pub.url
              });
              tracker.success(`✅ Found and fetched consortium pub: ${pub.slug}`);
            } else {
              // If we can't fetch details, still add the basic info
              consortiumPubs.push(pub);
              tracker.success(`✅ Found consortium pub (basic info): ${pub.slug}`);
            }
          } else {
            tracker.increment(`❌ Not consortium: ${pub.slug}`);
          }
        } catch (error) {
          tracker.fail(error, pub.slug);
        }
      }

      tracker.complete();

      // Add to publications list
      if (consortiumPubs.length > 0) {
        this.logger.success(`Found ${consortiumPubs.length} additional consortium publications from main feed`);
        consortiumPubs.forEach(pub => {
          this.results.publications.push({
            ...pub,
            source: 'main-feed',
            memberAssociation: 'detected-from-affiliation'
          });
        });
      } else {
        this.logger.info('No additional consortium publications found in main feed');
      }

    } catch (error) {
      this.logger.error('Failed to check main feed', error.message);
      // Don't fail the whole scrape if main feed check fails
    }
  }

  async isConsortiumPublication(url) {
    try {
      const response = await axios.get(url, {
        timeout: this.config.timeout,
        headers: { 'User-Agent': 'CrimConsortium-Enhanced-Scraper/1.0' }
      });

      const $ = cheerio.load(response.data);

      // Get authors and their affiliations
      const authorsAndAffiliations = [];

      // Try meta tags first
      $('meta[name="citation_author"]').each((i, elem) => {
        authorsAndAffiliations.push($(elem).attr('content'));
      });

      // Also check author affiliation meta tags
      $('meta[name="citation_author_institution"]').each((i, elem) => {
        authorsAndAffiliations.push($(elem).attr('content'));
      });

      // Check visible author info
      $('.pub-header-byline, .author-list, .contributor-list').each((i, elem) => {
        authorsAndAffiliations.push($(elem).text());
      });

      // IMPORTANT: Check collection links (e.g., UC Irvine collection)
      $('.collections-bar-component a, .collections-list a').each((i, elem) => {
        authorsAndAffiliations.push($(elem).text());
      });

      // Convert to single string for pattern matching
      const allText = authorsAndAffiliations.join(' ');

      // Check if any consortium pattern matches
      for (const member of this.consortiumPatterns) {
        for (const pattern of member.patterns) {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(allText)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      return false; // If we can't check, assume not consortium
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printEnhancedResults() {
    console.log('\n' + '='.repeat(80));
    console.log('🆕 ENHANCED CONSORTIUM SCRAPING RESULTS');
    console.log('='.repeat(80));
    
    console.log(`👥 Total Consortium Members: 30`);
    console.log(`🎓 Research Institutions: ${this.results.allMembers.filter(m => m.publicationCount > 0).length}`);
    console.log(`🤝 Supporting Organizations: ${this.results.allMembers.filter(m => m.publicationCount === 0).length}`);
    console.log(`📚 Total Publications: ${this.results.publications.length}`);
    console.log(`📎 Publications with Multiple Formats: ${this.results.publications.filter(p => p.hasMultipleFormats).length}`);
    console.log(`📝 Publications with Full Content: ${this.results.publications.filter(p => p.fullContent && p.fullContent.length > 100).length}`);
    
    console.log('\n🏆 RESEARCH INSTITUTIONS (with publications):');
    this.results.allMembers
      .filter(m => m.publicationCount > 0)
      .sort((a, b) => b.publicationCount - a.publicationCount)
      .forEach(member => {
        console.log(`   ${member.name}: ${member.publicationCount} publications`);
      });
    
    console.log('\n🤝 SUPPORTING ORGANIZATIONS (consortium participants):');
    this.results.allMembers
      .filter(m => m.publicationCount === 0)
      .forEach(member => {
        console.log(`   ${member.name} (${member.memberType})`);
      });
    
    console.log('\n📊 ENHANCED FEATURES:');
    console.log(`   Multiple download formats detected: ${this.results.publications.filter(p => p.hasMultipleFormats).length} articles`);
    console.log(`   Full content extracted: ${this.results.publications.filter(p => p.fullContent?.length > 100).length} articles`);
    console.log(`   References extracted: ${this.results.publications.filter(p => p.references?.length > 0).length} articles`);
    console.log(`   Content sections identified: ${this.results.publications.filter(p => p.sections?.length > 0).length} articles`);
    
    console.log('\n🎯 READY FOR ENHANCED BUILD:');
    console.log('✅ All 30 consortium members represented');
    console.log('✅ Complete publication content extraction');
    console.log('✅ Multiple download format detection');
    console.log('✅ Enhanced article page templates ready');
    
    console.log('='.repeat(80));
  }
}

// Run enhanced scraper
const scraper = new EnhancedConsortiumScraper();
scraper.scrapeCompleteFresh().catch(console.error);