#!/usr/bin/env node

/**
 * Complete Consortium Scraper
 * Checks all 30 consortium members and correctly identifies which have publications
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger, FileHelper, ProgressTracker, withRetry } from '../src/lib/utils.js';

class CompleteConsortiumScraper {
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
      { id: 'spanish-criminology-society', name: 'Sociedad Española de Investigación Criminológica', slug: 'sebp' },
      { id: 'evidence-based-policing', name: 'Society of Evidence Based Policing', slug: 'sebp' },
      { id: 'south-asian-criminology', name: 'South Asian Society of Criminology and Victimology', slug: 'sascv' },
      { id: 'temple-university', name: 'Temple University, Department of Criminal Justice', slug: 'temple1c' },
      { id: 'uc-irvine', name: 'UC Irvine, Department of Criminology, Law and Society', slug: 'uci1c' },
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
      membersWithPublications: [],
      membersWithoutPublications: [],
      totalPublications: 0,
      errors: []
    };
    
    this.config = {
      requestDelay: 2000,
      timeout: 30000,
      maxRetries: 2
    };
  }

  async scrapeAllMembers() {
    this.logger.info(`🕷️ Checking ALL ${this.allConsortiumMembers.length} consortium members for publications...`);
    
    try {
      await this.checkAllMemberPages();
      await this.processResults();
      await this.saveCompleteDataset();
      
      this.logger.success('Complete consortium analysis finished');
      this.printCompleteResults();
      
    } catch (error) {
      this.logger.error('Complete scraping failed', error.message);
      throw error;
    }
  }

  async checkAllMemberPages() {
    this.logger.info('📄 Checking all 30 member pages for publications...');
    
    const tracker = new ProgressTracker(this.allConsortiumMembers.length, 'Checking member pages');
    
    for (const member of this.allConsortiumMembers) {
      try {
        await this.delay(this.config.requestDelay);
        
        const memberUrl = `https://www.crimrxiv.com/${member.slug}`;
        const result = await this.checkMemberPage(memberUrl, member);
        
        this.results.allMembers.push(result);
        
        if (result.publicationCount > 0) {
          this.results.membersWithPublications.push(result);
          this.results.totalPublications += result.publicationCount;
          tracker.success(`✅ ${member.name}: ${result.publicationCount} publications`);
        } else {
          this.results.membersWithoutPublications.push(result);
          tracker.increment(`📋 ${member.name}: No publications found`);
        }
        
      } catch (error) {
        this.results.errors.push({
          member: member.name,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Add as member without publications
        this.results.allMembers.push({
          ...member,
          publicationCount: 0,
          publications: [],
          status: 'error',
          error: error.message
        });
        
        tracker.fail(error, member.name);
      }
    }
    
    tracker.complete();
    
    this.logger.success(`Analysis complete: ${this.results.membersWithPublications.length} members with publications, ${this.results.membersWithoutPublications.length} without`);
  }

  async checkMemberPage(url, member) {
    try {
      return await withRetry(async () => {
        const response = await axios.get(url, {
          timeout: this.config.timeout,
          headers: {
            'User-Agent': 'CrimConsortium-Complete-Analysis/1.0'
          }
        });
        
        const $ = cheerio.load(response.data);
        
        // Extract publication links
        const publicationLinks = [];
        
        $('a[href*="/pub/"]').each((index, element) => {
          const href = $(element).attr('href');
          const title = $(element).text().trim();
          
          if (href) {
            const slug = href.split('/pub/')[1]?.split('/')[0];
            if (slug && !publicationLinks.some(p => p.slug === slug)) {
              publicationLinks.push({
                slug: slug,
                url: href.startsWith('http') ? href : 'https://www.crimrxiv.com' + href,
                title: title || 'Unknown Title'
              });
            }
          }
        });
        
        return {
          ...member,
          url: url,
          publicationCount: publicationLinks.length,
          publications: publicationLinks.map(p => p.slug),
          publicationLinks: publicationLinks,
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
        status: 'failed',
        error: error.message,
        checkedAt: new Date().toISOString()
      };
    }
  }

  async processResults() {
    this.logger.info('⚙️ Processing complete consortium results...');
    
    // Collect all unique publications
    const allPublications = new Set();
    
    this.results.membersWithPublications.forEach(member => {
      member.publications.forEach(pubId => {
        allPublications.add(pubId);
      });
    });
    
    this.logger.info(`📊 Found ${allPublications.size} unique publications across all members`);
  }

  async saveCompleteDataset() {
    const completeDataset = {
      metadata: {
        name: 'Complete CrimConsortium Dataset',
        description: 'All 30 consortium members analyzed for publications',
        version: '4.0',
        scrapingMethod: 'Complete member page analysis',
        createdAt: new Date().toISOString(),
        totalMembersAnalyzed: this.allConsortiumMembers.length
      },
      
      summary: {
        totalMembers: this.results.allMembers.length,
        membersWithPublications: this.results.membersWithPublications.length,
        membersWithoutPublications: this.results.membersWithoutPublications.length,
        totalPublications: this.results.totalPublications,
        errors: this.results.errors.length
      },
      
      allMembers: this.results.allMembers,
      membersWithPublications: this.results.membersWithPublications,
      membersWithoutPublications: this.results.membersWithoutPublications,
      
      scrapingReport: {
        successfulChecks: this.results.allMembers.filter(m => m.status === 'success').length,
        failedChecks: this.results.errors.length,
        averagePublicationsPerMember: Math.round(this.results.totalPublications / this.results.membersWithPublications.length)
      }
    };
    
    await this.fileHelper.writeJSON('./data/final/complete-consortium-analysis.json', completeDataset);
    this.logger.success('Complete consortium analysis saved');
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printCompleteResults() {
    console.log('\n' + '='.repeat(80));
    console.log('👥 COMPLETE CONSORTIUM MEMBER ANALYSIS (ALL 30 MEMBERS)');
    console.log('='.repeat(80));
    
    console.log(`📊 Total Members Analyzed: ${this.results.allMembers.length}`);
    console.log(`✅ Members with Publications: ${this.results.membersWithPublications.length}`);
    console.log(`📋 Members without Publications: ${this.results.membersWithoutPublications.length}`);
    console.log(`📄 Total Publications Found: ${this.results.totalPublications}`);
    console.log(`❌ Analysis Errors: ${this.results.errors.length}`);
    
    console.log('\n📚 MEMBERS WITH PUBLICATIONS:');
    this.results.membersWithPublications
      .sort((a, b) => b.publicationCount - a.publicationCount)
      .forEach(member => {
        console.log(`   ${member.name}: ${member.publicationCount} publications`);
      });
    
    console.log('\n📋 MEMBERS WITHOUT PUBLICATIONS:');
    this.results.membersWithoutPublications.forEach(member => {
      console.log(`   ${member.name} (${member.status})`);
    });
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ ANALYSIS ERRORS:');
      this.results.errors.forEach(error => {
        console.log(`   ${error.member}: ${error.error}`);
      });
    }
    
    console.log('\n💡 INSIGHTS:');
    console.log(`• ${this.results.membersWithPublications.length} of 30 members actively publish research`);
    console.log(`• ${this.results.membersWithoutPublications.length} members are supporters/infrastructure/journals`);
    console.log(`• Average publications per active member: ${Math.round(this.results.totalPublications / this.results.membersWithPublications.length)}`);
    
    console.log('\n🎯 THIS EXPLAINS THE DIFFERENCE:');
    console.log('✅ 30 total consortium members (supporters + publishers)');
    console.log(`✅ ~${this.results.membersWithPublications.length} active research institutions with publications`);
    console.log(`✅ ~${this.results.membersWithoutPublications.length} supporting organizations (KF, journals, societies)`);
    
    console.log('='.repeat(80));
  }
}

// Run complete analysis
const scraper = new CompleteConsortiumScraper();
scraper.scrapeAllMembers().catch(console.error);