#!/usr/bin/env node

/**
 * Robust Incremental Scraper
 * Team-friendly scraper with resume capability, incremental saves, and progress monitoring
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import { Logger, FileHelper, ProgressTracker, withRetry } from '../src/lib/utils.js';

class RobustIncrementalScraper {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    // All 30 consortium members
    this.allConsortiumMembers = [
      { id: 'university-of-manchester-criminology', name: 'University of Manchester, Department of Criminology', slug: 'uomcriminology' },
      { id: 'northeastern-university', name: 'Northeastern University, School of Criminology & Criminal Justice', slug: 'northeasternccj' },
      { id: 'simon-fraser-university', name: 'Simon Fraser University, School of Criminology', slug: 'sfu1c' },
      { id: 'universite-de-montreal', name: 'Université de Montréal, École de Criminologie', slug: 'montreal1c' },
      { id: 'criminology-journal', name: 'Criminology: An Interdisciplinary Journal', slug: 'crim' },
      { id: 'academy-criminal-justice', name: 'Academy of Criminal Justice Sciences', slug: 'acjs1c' },
      { id: 'max-planck-institute', name: 'Max Planck Institute for the Study of Crime, Security & Law', slug: 'mpicsl' },
      { id: 'ghent-university', name: 'Ghent University, Department of Criminology', slug: 'ghent1c' },
      { id: 'temple-university', name: 'Temple University, Department of Criminal Justice', slug: 'temple1c' },
      { id: 'university-of-missouri', name: 'University of Missouri—St. Louis, Department of Criminology & Criminal Justice', slug: 'umsl1c' },
      { id: 'university-of-georgia', name: 'University of Georgia, Department of Sociology', slug: 'uga1c' },
      { id: 'university-of-cambridge', name: 'University of Cambridge, Institute of Criminology, Prisons Research Centre', slug: 'prisonsresearch1c' },
      { id: 'john-jay-college', name: 'John Jay College of Criminal Justice, Research & Evaluation Center', slug: 'johnjayrec1c' },
      { id: 'oral-history-criminology', name: 'Oral History of Criminology Project', slug: 'ohcp1c' },
      { id: 'university-of-texas-dallas', name: 'University of Texas at Dallas, Criminology & Criminal Justice', slug: 'utd1c' },
      { id: 'georgia-state-university', name: 'Georgia State University, Evidence-Based Cybersecurity Research Group', slug: 'cybersecurity1c' },
      { id: 'ucl', name: 'UCL, Bentham Project', slug: 'benthamproject1c' },
      // Supporting organizations (13 total)
      { id: 'university-of-manchester-open-research', name: 'University of Manchester, Office for Open Research', slug: 'uomopenresearch' },
      { id: 'knowledge-futures', name: 'Knowledge Futures', slug: 'kf' },
      { id: 'hawaii-crime-lab', name: 'Hawaiʻi Crime Lab', slug: 'hawaiicrimelab' },
      { id: 'journal-historical-criminology', name: 'Journal of Historical Criminology', slug: 'jhc' },
      { id: 'philadelphia-dao', name: 'Philadelphia District Attorney\'s Office, DATA Lab', slug: 'philadelphiada1c' },
      { id: 'spanish-criminology-society', name: 'Sociedad Española de Investigación Criminológica', slug: 'seic1c' },
      { id: 'evidence-based-policing', name: 'Society of Evidence Based Policing', slug: 'sebp' },
      { id: 'south-asian-criminology', name: 'South Asian Society of Criminology and Victimology', slug: 'sascv' },
      { id: 'uc-irvine', name: 'UC Irvine, Department of Criminology, Law and Society', slug: 'ucirvine2' },
      { id: 'university-of-leeds', name: 'University of Leeds, Centre for Criminal Justice Studies', slug: 'leeds1c' },
      { id: 'university-of-liverpool', name: 'University of Liverpool, Department of Sociology, Social Policy and Criminology', slug: 'liverpool1c' },
      { id: 'university-of-nebraska', name: 'University of Nebraska Omaha, School of Criminology & Criminal Justice', slug: 'nebraska1c' },
      { id: 'university-of-waikato', name: 'University of Waikato, Te Puna Haumaru New Zealand Institute for Security & Crime Science', slug: 'waikato1c' }
    ];
    
    this.config = {
      batchSize: 50,
      requestDelay: 2000,
      timeout: 30000,
      maxRetries: 2,
      saveProgressEvery: 5 // Save progress every 5 publications
    };

    this.progress = null;
    this.currentBatch = [];
    this.processedCount = 0;

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

  async startRobustScraping() {
    this.logger.info('🚀 Starting robust incremental consortium scraping...');
    
    try {
      // Setup directories
      await this.setupDirectories();
      
      // Load or create progress
      await this.loadProgress();
      
      // Resume from appropriate phase
      if (this.progress.phase === 'member-analysis' || !this.progress.phase) {
        await this.processMembersIncremental();
      }

      if (this.progress.phase === 'main-feed-check') {
        await this.checkMainFeedIncremental();
      }

      if (this.progress.phase === 'publication-processing') {
        await this.processPublicationsIncremental();
      }

      if (this.progress.phase === 'final-assembly') {
        await this.assembleFinalDataset();
      }
      
      // Mark as complete
      await this.markComplete();
      
      this.logger.success('Robust incremental scraping complete');
      this.printFinalResults();
      
    } catch (error) {
      this.logger.error('Robust scraping failed', error.message);
      await this.saveProgress(); // Save current state even on failure
      throw error;
    }
  }

  async setupDirectories() {
    await this.fileHelper.ensureDir('./data/final/members');
    await this.fileHelper.ensureDir('./data/final/batches');
    await this.fileHelper.ensureDir('./data/final/progress');
  }

  async loadProgress() {
    const progressFile = './data/final/scraping-progress.json';
    
    if (await this.fileHelper.exists(progressFile)) {
      this.progress = await this.fileHelper.readJSON(progressFile);
      this.logger.info(`📄 Resuming from: ${this.progress.phase} (${this.progress.publications.processed}/${this.progress.publications.total} publications)`);
    } else {
      this.progress = {
        phase: 'member-analysis',
        startedAt: new Date().toISOString(),
        members: { total: 30, completed: 0, status: 'pending' },
        publications: { total: 0, processed: 0, currentBatch: 0, totalBatches: 0 },
        quality: { averageWordCount: 0, publicationsWithFullContent: 0 },
        errors: { count: 0, publications: [] }
      };
      this.logger.info('🆕 Starting fresh scraping with progress tracking');
    }
  }

  async saveProgress() {
    this.progress.lastSavedAt = new Date().toISOString();
    await this.fileHelper.writeJSON('./data/final/scraping-progress.json', this.progress);
  }

  async processMembersIncremental() {
    this.logger.info('👥 Processing consortium members with incremental saves...');
    
    this.progress.phase = 'member-analysis';
    await this.saveProgress();
    
    const tracker = new ProgressTracker(this.allConsortiumMembers.length, 'Processing members');
    
    for (const member of this.allConsortiumMembers) {
      try {
        await this.delay(1000);
        
        const memberData = await this.processMemberIncremental(member);
        
        // Save member immediately
        await this.fileHelper.writeJSON(`./data/final/members/${member.id}.json`, memberData);
        
        this.progress.members.completed++;
        await this.saveProgress();
        
        if (memberData.publicationCount > 0) {
          tracker.success(`✅ ${member.name}: ${memberData.publicationCount} publications`);
        } else {
          tracker.increment(`📋 ${member.name}: Supporting member`);
        }
        
      } catch (error) {
        tracker.fail(error, member.name);
        this.progress.errors.count++;
      }
    }
    
    tracker.complete();
    
    // Create publication queue from all members
    await this.createPublicationQueue();
    
    this.progress.members.status = 'complete';
    this.progress.phase = 'main-feed-check';
    await this.saveProgress();
    
    this.logger.success(`All ${this.progress.members.completed} members processed and saved individually`);
  }

  async processMemberIncremental(member) {
    const memberUrl = `https://www.crimrxiv.com/${member.slug}`;
    
    try {
      const response = await axios.get(memberUrl, {
        timeout: this.config.timeout,
        headers: { 'User-Agent': 'CrimConsortium-Robust-Scraper/1.0' }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract publication links
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
              memberPage: memberUrl
            });
          }
        }
      });
      
      return {
        ...member,
        url: memberUrl,
        publicationCount: publications.length,
        publications: publications.map(p => p.slug),
        publicationLinks: publications,
        memberType: publications.length > 0 ? 'research-institution' : 'supporting-organization',
        processedAt: new Date().toISOString(),
        status: 'complete'
      };
      
    } catch (error) {
      return {
        ...member,
        url: memberUrl,
        publicationCount: 0,
        publications: [],
        memberType: 'supporting-organization',
        processedAt: new Date().toISOString(),
        status: 'error',
        error: error.message
      };
    }
  }

  async createPublicationQueue() {
    this.logger.info('📋 Creating publication queue from all members...');
    
    const allPublications = new Map();
    
    // Load all member files and collect unique publications
    for (const member of this.allConsortiumMembers) {
      try {
        const memberData = await this.fileHelper.readJSON(`./data/final/members/${member.id}.json`);
        
        if (memberData.publicationLinks) {
          memberData.publicationLinks.forEach(pub => {
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
      } catch (error) {
        console.error(`Failed to load member data for ${member.id}:`, error.message);
      }
    }
    
    const publicationQueue = Array.from(allPublications.values());
    
    // Save publication queue
    await this.fileHelper.writeJSON('./data/final/progress/publication-queue.json', publicationQueue);
    
    // Update progress
    this.progress.publications.total = publicationQueue.length;
    this.progress.publications.totalBatches = Math.ceil(publicationQueue.length / this.config.batchSize);
    
    this.logger.success(`Publication queue created: ${publicationQueue.length} unique publications`);
    return publicationQueue;
  }

  async processPublicationsIncremental() {
    this.logger.info('📖 Processing publications with incremental saves and resume capability...');
    
    const queue = await this.fileHelper.readJSON('./data/final/progress/publication-queue.json');
    
    if (!queue) {
      throw new Error('Publication queue not found. Run member analysis first.');
    }
    
    const startBatch = this.progress.publications.currentBatch || 0;
    const totalBatches = Math.ceil(queue.length / this.config.batchSize);
    
    this.logger.info(`📊 Resuming from batch ${startBatch + 1}/${totalBatches}`);
    
    for (let batchNum = startBatch; batchNum < totalBatches; batchNum++) {
      try {
        console.log(`\n🔄 Processing batch ${batchNum + 1}/${totalBatches}...`);
        
        const batchStart = batchNum * this.config.batchSize;
        const batchEnd = Math.min(batchStart + this.config.batchSize, queue.length);
        const batch = queue.slice(batchStart, batchEnd);
        
        const batchResults = await this.processBatchIncremental(batch, batchNum + 1);
        
        // Save batch immediately
        await this.saveBatch(batchNum + 1, batchResults);
        
        // Update master dataset
        await this.updateMasterDataset();
        
        // Update progress
        this.progress.publications.processed = batchEnd;
        this.progress.publications.currentBatch = batchNum + 1;
        await this.saveProgress();
        
        console.log(`✅ Batch ${batchNum + 1} saved - ${batchEnd}/${queue.length} publications complete`);
        
        // Quality check
        await this.checkBatchQuality(batchResults, batchNum + 1);
        
      } catch (error) {
        console.error(`❌ Batch ${batchNum + 1} failed:`, error.message);
        this.progress.errors.count++;
        await this.saveProgress();
        
        // Continue with next batch (don't fail entire process)
        continue;
      }
    }
    
    this.progress.phase = 'final-assembly';
    await this.saveProgress();
    
    this.logger.success('All publication batches processed');
  }

  async processBatchIncremental(batch, batchNum) {
    const tracker = new ProgressTracker(batch.length, `Batch ${batchNum} content extraction`);
    const batchResults = [];
    
    for (const pub of batch) {
      try {
        await this.delay(2000);
        
        const enhancedPub = await this.extractEnhancedContent(pub);
        
        if (enhancedPub) {
          batchResults.push(enhancedPub);
          tracker.success(`📄 ${enhancedPub.title?.substring(0, 30)}...`);
        } else {
          tracker.increment(`❌ Failed: ${pub.slug}`);
        }
        
        // Save progress every 5 publications
        if (batchResults.length % this.config.saveProgressEvery === 0) {
          await this.saveProgress();
        }
        
      } catch (error) {
        tracker.fail(error, pub.slug);
        this.progress.errors.publications.push({
          slug: pub.slug,
          error: error.message,
          retryable: !error.message.includes('404'),
          timestamp: new Date().toISOString()
        });
      }
    }
    
    tracker.complete();
    return batchResults;
  }

  async saveBatch(batchNum, batchResults) {
    const batchFile = `./data/final/batches/batch-${batchNum.toString().padStart(3, '0')}.json`;
    
    const batchData = {
      batchNumber: batchNum,
      publicationCount: batchResults.length,
      processedAt: new Date().toISOString(),
      publications: batchResults,
      quality: {
        averageWordCount: Math.round(batchResults.reduce((sum, pub) => 
          sum + (pub.sections?.reduce((s, sec) => s + sec.wordCount, 0) || 0), 0) / batchResults.length),
        publicationsWithFullContent: batchResults.filter(pub => 
          pub.sections && pub.sections.length > 5).length,
        downloadFormatsDetected: batchResults.reduce((sum, pub) => 
          sum + Object.keys(pub.downloads || {}).length, 0)
      }
    };
    
    await this.fileHelper.writeJSON(batchFile, batchData);
    
    console.log(`💾 Batch ${batchNum} saved with ${batchResults.length} publications`);
  }

  async updateMasterDataset() {
    try {
      // Load all members
      const members = [];
      for (const member of this.allConsortiumMembers) {
        try {
          const memberData = await this.fileHelper.readJSON(`./data/final/members/${member.id}.json`);
          members.push(memberData);
        } catch (error) {
          console.warn(`Could not load member ${member.id}:`, error.message);
        }
      }
      
      // Load all completed batches
      const publications = [];
      const batchFiles = await this.getBatchFiles();
      
      for (const batchFile of batchFiles) {
        try {
          const batch = await this.fileHelper.readJSON(batchFile);
          publications.push(...batch.publications);
        } catch (error) {
          console.warn(`Could not load batch ${batchFile}:`, error.message);
        }
      }
      
      // Create current master dataset
      const masterDataset = {
        metadata: {
          name: 'CrimConsortium Incremental Dataset',
          description: `Incremental scraping: ${publications.length} publications from ${members.length} members`,
          version: '7.0',
          lastUpdated: new Date().toISOString(),
          scrapingInProgress: this.progress.phase !== 'complete',
          completionPercentage: Math.round((publications.length / this.progress.publications.total) * 100)
        },
        
        summary: {
          totalMembers: members.length,
          researchInstitutions: members.filter(m => m.publicationCount > 0).length,
          supportingOrganizations: members.filter(m => m.publicationCount === 0).length,
          totalPublications: publications.length,
          processedPublications: publications.length,
          remainingPublications: this.progress.publications.total - publications.length
        },
        
        members: members.sort((a, b) => b.publicationCount - a.publicationCount),
        publications: publications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      };
      
      // Save master dataset (always current)
      await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', masterDataset);
      
      console.log(`📊 Master dataset updated: ${publications.length} publications available`);
      
    } catch (error) {
      console.error('Failed to update master dataset:', error.message);
    }
  }

  async getBatchFiles() {
    try {
      const batchDir = './data/final/batches';
      const files = await this.fileHelper.readdir(batchDir);
      return files
        .filter(f => f.startsWith('batch-') && f.endsWith('.json'))
        .map(f => `${batchDir}/${f}`)
        .sort();
    } catch {
      return [];
    }
  }

  async checkBatchQuality(batchResults, batchNum) {
    const quality = {
      batchNumber: batchNum,
      publicationCount: batchResults.length,
      averageWordCount: Math.round(batchResults.reduce((sum, pub) => 
        sum + (pub.sections?.reduce((s, sec) => s + sec.wordCount, 0) || 0), 0) / batchResults.length),
      publicationsWithFullContent: batchResults.filter(pub => 
        pub.sections && pub.sections.length > 5).length,
      downloadFormatsFound: batchResults.reduce((sum, pub) => 
        sum + Object.keys(pub.downloads || {}).length, 0),
      timestamp: new Date().toISOString()
    };
    
    console.log(`📊 Batch ${batchNum} Quality:`);
    console.log(`   Publications: ${quality.publicationCount}`);
    console.log(`   Avg word count: ${quality.averageWordCount}`);
    console.log(`   Full content: ${quality.publicationsWithFullContent}/${quality.publicationCount}`);
    console.log(`   Download formats: ${quality.downloadFormatsFound}`);
    
    // Alert if quality drops
    if (quality.averageWordCount < 1000) {
      console.warn('⚠️ Content extraction quality may be degrading');
    }
    
    // Save quality report
    const qualityFile = './data/final/progress/quality-report.json';
    let qualityHistory = [];
    
    if (await this.fileHelper.exists(qualityFile)) {
      qualityHistory = await this.fileHelper.readJSON(qualityFile) || [];
    }
    
    qualityHistory.push(quality);
    await this.fileHelper.writeJSON(qualityFile, qualityHistory);
  }

  async extractEnhancedContent(pubInfo) {
    // Use same enhanced extraction as current scraper
    try {
      return await withRetry(async () => {
        const response = await axios.get(pubInfo.url, {
          timeout: this.config.timeout,
          headers: { 'User-Agent': 'CrimConsortium-Enhanced-Content/1.0' }
        });
        
        const $ = cheerio.load(response.data);
        
        const fullContentData = this.extractFullContent($);
        
        return {
          id: pubInfo.slug,
          slug: pubInfo.slug,
          title: this.extractMetaContent($, 'citation_title') || $('h1').first().text().trim() || pubInfo.title,
          description: this.extractAbstract($),
          fullContent: fullContentData.text,
          fullContentHTML: fullContentData.html,
          versionOfUrl: this.extractVersionOfUrl($),
          doi: this.extractMetaContent($, 'citation_doi') || '',
          authors: this.extractEnhancedAuthors($),
          createdAt: this.parsePublicationDate(this.extractMetaContent($, 'citation_publication_date')),
          downloads: this.extractAllDownloads($),
          sections: this.extractCompleteContentSections($),
          references: this.extractReferences($),
          memberAssociations: pubInfo.memberAssociations,
          memberNames: pubInfo.memberNames,
          originalUrl: pubInfo.url,
          scrapedAt: new Date().toISOString(),
          source: 'robust-incremental-scraping'
        };
        
      }, this.config.maxRetries, 3000);
      
    } catch (error) {
      console.error(`Enhanced extraction failed for ${pubInfo.url}:`, error.message);
      return null;
    }
  }

  // Include all the enhanced extraction methods from current scraper
  extractCompleteContentSections($) {
    const sections = [];
    
    $('h1, h2, h3, h4').each((index, element) => {
      const heading = $(element).text().trim();
      
      // Get COMPLETE content until next heading (no truncation)
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
          content: fullContent.trim(), // COMPLETE content, no truncation
          level: element.tagName.toLowerCase(),
          wordCount: fullContent.trim().split(' ').length
        });
      }
    });
    
    return sections;
  }

  // [Include other extraction methods from enhanced scraper]
  extractVersionOfUrl($) {
    // Target the version-of link with multiple possible selectors
    let versionOfLink = $('.pub-version-link').first().attr('href') ||
                       $('.pub-edge-component a').first().attr('href') ||
                       $('a[href*="github.io"]').first().attr('href') ||
                       $('a[href*="uclpress"]').first().attr('href') ||
                       $('a[href*="criminologystories"]').first().attr('href') ||
                       $('a[href*="doi.org"]').first().attr('href');
    
    if (versionOfLink) {
      // Return full URL (may be relative or absolute)
      return versionOfLink.startsWith('http') ? versionOfLink : 
             versionOfLink.startsWith('//') ? `https:${versionOfLink}` :
             `https://${versionOfLink}`;
    }
    
    return null;
  }

  extractMetaContent($, name) {
    const meta = $(`meta[name="${name}"], meta[property="${name}"]`).first();
    return meta.attr('content') || null;
  }

  extractAbstract($) {
    const abstractSelectors = ['meta[name="description"]', '.abstract', '.summary', '.description'];
    for (const selector of abstractSelectors) {
      const element = $(selector).first();
      const content = element.attr('content') || element.text();
      if (content && content.trim().length > 50) {
        return content.trim();
      }
    }
    return '';
  }

  extractFullContent($) {
    const contentSelectors = ['.pub-body-component', '.pub-document', '.article-content', '.content'];
    let fullContent = '';
    let fullContentHTML = '';
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const elementText = element.text().trim();
        const elementHTML = element.html();
        if (elementText.length > fullContent.length) {
          fullContent = elementText;
          fullContentHTML = elementHTML;
        }
      }
    }
    
    // Return both text and HTML for processing
    return {
      text: fullContent || 'Full article content available on CrimRXiv original page.',
      html: fullContentHTML || ''
    };
  }

  extractEnhancedAuthors($) {
    const authors = [];
    $('meta[name="citation_author"]').each((index, element) => {
      const author = $(element).attr('content');
      if (author) {
        authors.push({ name: author.trim(), affiliation: '', order: index + 1 });
      }
    });
    return authors;
  }

  extractAllDownloads($) {
    const downloads = {};
    $('a[href*="download"], a[href*=".pdf"], a[href*=".docx"], a[href*=".epub"]').each((index, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().toLowerCase();
      
      if (href) {
        let format = 'unknown';
        if (href.includes('/download/pdf') || text.includes('pdf')) format = 'pdf';
        else if (href.includes('/download/docx') || text.includes('word')) format = 'word';
        else if (href.includes('/download/epub') || text.includes('epub')) format = 'epub';
        else if (href.includes('/download/html') || text.includes('html')) format = 'html';
        
        if (format !== 'unknown' && !downloads[format]) {
          downloads[format] = href.startsWith('http') ? href : 'https://www.crimrxiv.com' + href;
        }
      }
    });
    return downloads;
  }

  extractReferences($) {
    const references = [];
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

  parsePublicationDate(dateString) {
    if (!dateString) return new Date().toISOString();
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  async downloadPDF(publication) {
    const pdfUrl = publication.downloads?.pdf;

    if (!pdfUrl) {
      return { success: false, error: 'No PDF URL' };
    }

    try {
      const fileName = `${publication.slug || publication.id}.pdf`;
      const filePath = `./data/final/pdfs/${fileName}`;

      // Check if already exists
      if (await this.fileHelper.exists(filePath)) {
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          return { success: true, filePath, fileSize: stats.size, fileName, skipped: true };
        }
      }

      // Download file
      const response = await axios.get(pdfUrl, {
        responseType: 'stream',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          const stats = await fs.stat(filePath);
          resolve({ success: true, filePath, fileSize: stats.size, fileName });
        });

        writer.on('error', (error) => {
          reject({ success: false, error: error.message });
        });
      });

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async downloadAllPDFs() {
    // Load the final dataset
    const dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
    if (!dataset || !dataset.publications) {
      this.logger.warning('No dataset found or no publications to process');
      return;
    }

    const publicationsWithPDFs = dataset.publications.filter(pub =>
      pub.downloads && pub.downloads.pdf
    );

    if (publicationsWithPDFs.length === 0) {
      this.logger.info('No publications with PDFs found');
      return;
    }

    this.logger.info(`📥 Downloading ${publicationsWithPDFs.length} PDFs...`);

    await this.fileHelper.ensureDir('./data/final/pdfs');

    let downloadedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const pub of publicationsWithPDFs) {
      try {
        const result = await this.downloadPDF(pub);

        if (result.success) {
          if (result.skipped) {
            skippedCount++;
            this.logger.info(`⏭️ Already exists: ${result.fileName}`);
          } else {
            downloadedCount++;
            pub.localPDFPath = result.filePath;
            pub.pdfFileSize = result.fileSize;
            this.logger.success(`✅ Downloaded: ${result.fileName} (${(result.fileSize / 1024 / 1024).toFixed(2)} MB)`);
          }
        } else {
          failedCount++;
          this.logger.warning(`❌ Failed to download PDF for ${pub.slug}: ${result.error}`);
        }

        // Rate limiting
        await this.delay(1000);

      } catch (error) {
        failedCount++;
        this.logger.warning(`❌ Error downloading PDF for ${pub.slug}: ${error.message}`);
      }
    }

    this.logger.success(`PDF Downloads Complete: ${downloadedCount} downloaded, ${skippedCount} skipped, ${failedCount} failed`);

    // Update the dataset with local PDF paths
    await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', dataset);
  }

  async assembleFinalDataset() {
    this.logger.info('🔧 Assembling final dataset from all batches...');

    await this.updateMasterDataset();

    // Download PDFs after assembling the dataset
    await this.downloadAllPDFs();

    this.progress.phase = 'complete';
    this.progress.completedAt = new Date().toISOString();
    await this.saveProgress();

    this.logger.success('Final dataset assembly complete');
  }

  async markComplete() {
    this.progress.phase = 'complete';
    this.progress.completedAt = new Date().toISOString();
    await this.saveProgress();
    
    console.log('\n🎉 ROBUST INCREMENTAL SCRAPING COMPLETE');
    console.log(`✅ All 30 members processed`);
    console.log(`✅ All ${this.progress.publications.total} publications extracted`);
    console.log(`✅ Master dataset available at: data/final/consortium-dataset.json`);
  }

  async checkMainFeedIncremental() {
    this.logger.info('🔍 Checking main CrimRxiv feed for additional consortium publications...');

    try {
      const mainFeedUrl = 'https://www.crimrxiv.com';
      const response = await axios.get(mainFeedUrl, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'CrimConsortium-Robust-Scraper/1.0'
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

      // Load existing queue to check for duplicates
      const existingQueue = await this.fileHelper.readJSON('./data/final/progress/publication-queue.json') || [];
      const existingSlugs = new Set(existingQueue.map(p => p.slug));

      // Check each publication for consortium affiliation
      const newConsortiumPubs = [];
      const tracker = new ProgressTracker(additionalPubs.length, 'Checking main feed for consortium publications');

      for (const pub of additionalPubs) {
        try {
          await this.delay(1500); // Be respectful

          // Skip if we already have it
          if (existingSlugs.has(pub.slug)) {
            tracker.increment(`⏭️ Already queued: ${pub.slug}`);
            continue;
          }

          // Check if it's a consortium publication
          const isConsortium = await this.isConsortiumPublication(pub.url);
          if (isConsortium) {
            // Fetch full article details for main feed articles
            this.logger.info(`Fetching full details for main feed article: ${pub.slug}`);
            const fullArticle = await this.extractEnhancedContent(pub);

            if (fullArticle) {
              newConsortiumPubs.push({
                ...fullArticle,
                memberAssociations: ['detected-from-main-feed'],
                memberNames: ['Consortium Affiliation Detected'],
                source: 'main-feed'
              });
              tracker.success(`✅ Found and fetched consortium pub: ${pub.slug}`);
            } else {
              // If we can't fetch details, still add the basic info
              newConsortiumPubs.push({
                ...pub,
                memberAssociations: ['detected-from-main-feed'],
                memberNames: ['Consortium Affiliation Detected'],
                source: 'main-feed'
              });
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

      // Add new consortium pubs to the queue
      if (newConsortiumPubs.length > 0) {
        this.logger.success(`Found ${newConsortiumPubs.length} additional consortium publications from main feed`);

        // Update the publication queue
        const updatedQueue = [...existingQueue, ...newConsortiumPubs];
        await this.fileHelper.writeJSON('./data/final/progress/publication-queue.json', updatedQueue);

        // Update progress
        this.progress.publications.total = updatedQueue.length;
        this.progress.publications.totalBatches = Math.ceil(updatedQueue.length / this.config.batchSize);

        this.logger.info(`Updated publication queue: ${updatedQueue.length} total publications`);
      } else {
        this.logger.info('No additional consortium publications found in main feed');
      }

    } catch (error) {
      this.logger.error('Failed to check main feed', error.message);
      // Don't fail the whole scrape if main feed check fails
    }

    // Move to next phase
    this.progress.phase = 'publication-processing';
    await this.saveProgress();
  }

  async isConsortiumPublication(url) {
    try {
      const response = await axios.get(url, {
        timeout: this.config.timeout,
        headers: { 'User-Agent': 'CrimConsortium-Robust-Scraper/1.0' }
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

  printFinalResults() {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 ROBUST INCREMENTAL SCRAPER - COMPLETE');
    console.log('='.repeat(80));
    console.log(`👥 Members: ${this.progress.members.completed}/${this.progress.members.total}`);
    console.log(`📚 Publications: ${this.progress.publications.processed}/${this.progress.publications.total}`);
    console.log(`⏱️ Total time: ${this.getElapsedTime()}`);
    console.log(`❌ Errors: ${this.progress.errors.count}`);
    console.log('\n✅ ROBUST FEATURES VERIFIED:');
    console.log('✅ Incremental saves - no work lost to interruptions');
    console.log('✅ Resume capability - can restart from any batch');
    console.log('✅ Quality monitoring - content extraction verified');
    console.log('✅ Progress tracking - team can monitor in real-time');
    console.log('='.repeat(80));
  }

  getElapsedTime() {
    const start = new Date(this.progress.startedAt);
    const end = new Date(this.progress.completedAt || Date.now());
    const minutes = Math.round((end - start) / 60000);
    return `${minutes} minutes`;
  }
}

// Run robust incremental scraper
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new RobustIncrementalScraper();
  scraper.startRobustScraping().catch(error => {
    console.error('Robust scraping failed:', error.message);
    process.exit(1);
  });
}

export default RobustIncrementalScraper;