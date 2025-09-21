#!/usr/bin/env node

/**
 * Find Missing Consortium Members
 * Identify all 23 consortium members and ensure we're not missing any
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger, FileHelper } from '../src/lib/utils.js';

class MissingMembersFinder {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    // Members we found with comprehensive scraper
    this.foundMembers = [
      'university-of-manchester',
      'georgia-state-university', 
      'john-jay-college',
      'simon-fraser-university',
      'temple-university',
      'ucl',
      'universite-de-montreal',
      'university-of-cambridge',
      'ghent-university'
    ];
    
    this.allConsortiumMembers = [];
    this.missingMembers = [];
  }

  async findAllConsortiumMembers() {
    this.logger.info('🔍 Finding ALL 23 consortium members...');
    
    try {
      // Scrape consortium page to get complete member list
      await this.scrapeConsortiumPage();
      
      // Compare with what we found
      await this.identifyMissingMembers();
      
      // Save complete member analysis
      await this.saveAnalysis();
      
      this.logger.success('Missing member analysis complete');
      this.printResults();
      
    } catch (error) {
      this.logger.error('Analysis failed', error.message);
      throw error;
    }
  }

  async scrapeConsortiumPage() {
    this.logger.info('📄 Scraping consortium page for complete member list...');
    
    try {
      const response = await axios.get('https://www.crimrxiv.com/consortium', {
        timeout: 30000,
        headers: {
          'User-Agent': 'CrimConsortium-MemberAnalysis/1.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract all member links and names
      const memberElements = $('.page-preview-component, .member-card');
      
      memberElements.each((index, element) => {
        const $element = $(element);
        const href = $element.attr('href');
        const name = $element.find('span').text().trim() || $element.text().trim();
        
        if (href && name && name.includes('University') || name.includes('College') || name.includes('Institute')) {
          const slug = href.replace('/', '');
          const memberId = this.slugToMemberId(slug);
          
          this.allConsortiumMembers.push({
            id: memberId,
            name: name,
            slug: slug,
            url: `https://www.crimrxiv.com${href}`,
            foundInScraper: this.foundMembers.includes(memberId)
          });
        }
      });
      
      // Remove duplicates
      this.allConsortiumMembers = this.allConsortiumMembers.filter((member, index, self) =>
        index === self.findIndex(m => m.id === member.id)
      );
      
      this.logger.success(`Found ${this.allConsortiumMembers.length} consortium members on consortium page`);
      
    } catch (error) {
      this.logger.error('Failed to scrape consortium page', error.message);
      
      // Fallback: Use known member list from previous analysis
      this.allConsortiumMembers = [
        { id: 'university-of-manchester', name: 'University of Manchester, Department of Criminology', foundInScraper: true },
        { id: 'georgia-state-university', name: 'Georgia State University, Evidence-Based Cybersecurity Research Group', foundInScraper: true },
        { id: 'john-jay-college', name: 'John Jay College of Criminal Justice, Research & Evaluation Center', foundInScraper: true },
        { id: 'simon-fraser-university', name: 'Simon Fraser University, School of Criminology', foundInScraper: true },
        { id: 'temple-university', name: 'Temple University, Department of Criminal Justice', foundInScraper: true },
        { id: 'ucl', name: 'UCL, Bentham Project', foundInScraper: true },
        { id: 'universite-de-montreal', name: 'Université de Montréal, École de Criminologie', foundInScraper: true },
        { id: 'university-of-cambridge', name: 'University of Cambridge, Institute of Criminology, Prisons Research Centre', foundInScraper: true },
        { id: 'ghent-university', name: 'Ghent University, Department of Criminology', foundInScraper: true },
        
        // Additional members we know exist but didn't scrape
        { id: 'northeastern-university', name: 'Northeastern University, School of Criminology & Criminal Justice', foundInScraper: false },
        { id: 'max-planck-institute', name: 'Max Planck Institute for the Study of Crime, Security & Law', foundInScraper: false },
        { id: 'knowledge-futures', name: 'Knowledge Futures, creator of PubPub', foundInScraper: false },
        { id: 'academy-criminal-justice', name: 'Academy of Criminal Justice Sciences', foundInScraper: false },
        { id: 'journal-historical-criminology', name: 'Journal of Historical Criminology', foundInScraper: false },
        { id: 'society-evidence-based-policing', name: 'Society of Evidence Based Policing', foundInScraper: false },
        { id: 'south-asian-criminology', name: 'South Asian Society of Criminology and Victimology', foundInScraper: false },
        { id: 'hawaii-crime-lab', name: 'Hawaii Crime Lab', foundInScraper: false },
        { id: 'oral-history-criminology', name: 'Oral History of Criminology Project', foundInScraper: false },
        { id: 'philadelphia-dao', name: 'Philadelphia District Attorney\'s Office, DATA Lab', foundInScraper: false },
        { id: 'university-of-georgia', name: 'University of Georgia, Department of Sociology', foundInScraper: false },
        { id: 'university-of-missouri', name: 'University of Missouri—St. Louis, Department of Criminology & Criminal Justice', foundInScraper: false },
        { id: 'university-of-texas-dallas', name: 'University of Texas at Dallas, Criminology & Criminal Justice', foundInScraper: false },
        { id: 'university-of-leeds', name: 'University of Leeds, Centre for Criminal Justice Studies', foundInScraper: false }
      ];
    }
  }

  identifyMissingMembers() {
    this.missingMembers = this.allConsortiumMembers.filter(member => !member.foundInScraper);
    
    this.logger.info(`📊 Member analysis: ${this.allConsortiumMembers.length} total, ${this.missingMembers.length} missing from scraper`);
  }

  async saveAnalysis() {
    const analysis = {
      totalConsortiumMembers: this.allConsortiumMembers.length,
      membersFound: this.allConsortiumMembers.filter(m => m.foundInScraper).length,
      membersMissing: this.missingMembers.length,
      
      foundMembers: this.allConsortiumMembers.filter(m => m.foundInScraper),
      missingMembers: this.missingMembers,
      
      recommendations: [
        'Add missing member collection page URLs to scraper',
        'Some members may not have public collection pages',
        'Some members may have different URL patterns',
        'Some may be journals/organizations rather than institutions'
      ],
      
      nextSteps: [
        'Research collection URLs for missing members',
        'Add additional member pages to scraper',
        'Re-run comprehensive scraper with complete member list',
        'Verify all 23 members represented'
      ],
      
      generatedAt: new Date().toISOString()
    };
    
    await this.fileHelper.writeJSON('./data/final/missing-members-analysis.json', analysis);
  }

  slugToMemberId(slug) {
    return slug
      .replace(/1c$/, '')
      .replace(/[-_]/g, '-')
      .toLowerCase();
  }

  printResults() {
    console.log('\n' + '='.repeat(70));
    console.log('👥 CONSORTIUM MEMBER ANALYSIS');
    console.log('='.repeat(70));
    
    console.log(`📊 Total Consortium Members: ${this.allConsortiumMembers.length}`);
    console.log(`✅ Found in Comprehensive Scraper: ${this.allConsortiumMembers.filter(m => m.foundInScraper).length}`);
    console.log(`❌ Missing from Scraper: ${this.missingMembers.length}`);
    
    console.log('\n✅ MEMBERS WITH PUBLICATIONS FOUND:');
    this.allConsortiumMembers
      .filter(m => m.foundInScraper)
      .forEach(member => {
        console.log(`   ${member.name}`);
      });
    
    if (this.missingMembers.length > 0) {
      console.log('\n❌ MISSING MEMBERS (need to add to scraper):');
      this.missingMembers.forEach(member => {
        console.log(`   ${member.name}`);
      });
      
      console.log('\n🔧 TO FIX:');
      console.log('1. Research collection page URLs for missing members');
      console.log('2. Add to memberPages object in member-page-scraper.js');
      console.log('3. Re-run comprehensive scraper');
      console.log('4. Should get closer to 23 total members');
    }
    
    console.log('\n💡 NOTE:');
    console.log('Some missing members may be:');
    console.log('• Journals/organizations without publication collections');
    console.log('• Members with private/restricted collections');
    console.log('• Members with different URL patterns');
    console.log('• Inactive members with no recent publications');
    
    console.log('='.repeat(70));
  }
}

const finder = new MissingMembersFinder();
finder.findAllConsortiumMembers().catch(console.error);