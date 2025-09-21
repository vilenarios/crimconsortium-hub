#!/usr/bin/env node

/**
 * Simple Consortium Analysis (No External Dependencies)
 * Uses only Node.js built-ins to analyze consortium content
 */

import fs from 'fs';
import path from 'path';

class SimpleConsortiumAnalyzer {
  constructor() {
    this.members = [];
    this.memberPublications = [];
    this.stats = {
      totalMembers: 0,
      totalPublications: 0,
      publicationsPerMember: {}
    };
  }

  async analyze() {
    console.log('🔍 Starting simple consortium analysis...');
    
    try {
      // Step 1: Extract members from consortium HTML
      await this.extractMembersFromHTML();
      
      // Step 2: Check which member directories exist in export
      await this.findMemberDirectories();
      
      // Step 3: Count publications per member
      await this.countMemberPublications();
      
      // Step 4: Generate report
      await this.generateReport();
      
      console.log('✅ Analysis complete');
      
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  async extractMembersFromHTML() {
    console.log('👥 Extracting consortium members...');
    
    const consortiumHtml = await fs.promises.readFile('./export/consortium/index.html', 'utf8');
    
    // Simple regex to extract member names and links
    const spanMatches = consortiumHtml.match(/<span>[^<]+<\/span>/g) || [];
    const hrefMatches = consortiumHtml.match(/href="\/[^"]+"/g) || [];
    
    // Extract member names
    const memberNames = spanMatches
      .map(match => match.replace(/<\/?span>/g, ''))
      .filter(name => 
        name.includes('University') || 
        name.includes('College') || 
        name.includes('Institute') ||
        name.includes('Department') ||
        name.includes('Society') ||
        name.includes('Academy') ||
        name.includes('Journal') ||
        name.includes('Lab') ||
        name.includes('Office') ||
        name.includes('Project')
      );
    
    // Extract member slugs
    const memberSlugs = hrefMatches
      .map(match => match.replace(/href="\/([^"]+)"/, '$1'))
      .filter(slug => 
        slug.endsWith('1c') || // Consortium member pattern
        slug === 'uomcriminology' ||
        slug === 'uomopenresearch' ||
        slug === 'kf1c' ||
        slug === 'hawaiicrimelab' ||
        slug === 'jhc' ||
        slug === 'mpicsl' ||
        slug === 'sebp' ||
        slug === 'sascv'
      );
    
    // Combine names and slugs
    for (let i = 0; i < Math.min(memberNames.length, memberSlugs.length); i++) {
      this.members.push({
        name: memberNames[i],
        slug: memberSlugs[i] || `member-${i}`,
        publicationCount: 0,
        hasDirectory: false
      });
    }
    
    this.stats.totalMembers = this.members.length;
    
    console.log(`✅ Found ${this.members.length} consortium members`);
    
    // Print member list
    console.log('\n📋 Consortium Members:');
    this.members.forEach((member, index) => {
      console.log(`${index + 1}. ${member.name}`);
      console.log(`   Slug: ${member.slug}`);
    });
    console.log('');
  }

  async findMemberDirectories() {
    console.log('📁 Checking for member directories in export...');
    
    let found = 0;
    
    for (const member of this.members) {
      const memberDir = `./export/${member.slug}`;
      
      try {
        await fs.promises.access(memberDir);
        member.hasDirectory = true;
        found++;
        console.log(`✅ ${member.slug}: Directory found`);
      } catch {
        console.log(`⚠️  ${member.slug}: No directory`);
      }
    }
    
    console.log(`\n📊 ${found}/${this.members.length} members have export directories`);
  }

  async countMemberPublications() {
    console.log('📚 Counting publications per member...');
    
    let totalPubs = 0;
    
    for (const member of this.members) {
      if (!member.hasDirectory) {
        continue;
      }
      
      const memberDir = `./export/${member.slug}`;
      
      try {
        // Check if pub directory exists
        const pubDir = path.join(memberDir, 'pub');
        
        try {
          const pubEntries = await fs.promises.readdir(pubDir);
          const pubDirs = [];
          
          for (const entry of pubEntries) {
            const entryPath = path.join(pubDir, entry);
            const stat = await fs.promises.stat(entryPath);
            if (stat.isDirectory()) {
              pubDirs.push(entry);
            }
          }
          
          member.publicationCount = pubDirs.length;
          totalPubs += pubDirs.length;
          
          console.log(`📄 ${member.slug}: ${pubDirs.length} publications`);
          
        } catch {
          console.log(`📄 ${member.slug}: No publications found`);
        }
        
      } catch (error) {
        console.log(`❌ ${member.slug}: Error checking publications`);
      }
    }
    
    this.stats.totalPublications = totalPubs;
    console.log(`\n📊 Total consortium publications: ${totalPubs}`);
  }

  async generateReport() {
    console.log('📊 Generating consortium report...');
    
    // Create summary report
    const report = {
      summary: {
        totalMembers: this.stats.totalMembers,
        membersWithDirectories: this.members.filter(m => m.hasDirectory).length,
        totalPublications: this.stats.totalPublications,
        averagePublicationsPerMember: Math.round(this.stats.totalPublications / this.members.filter(m => m.hasDirectory).length)
      },
      members: this.members,
      topProducers: this.members
        .filter(m => m.publicationCount > 0)
        .sort((a, b) => b.publicationCount - a.publicationCount)
        .slice(0, 10),
      estimates: {
        sizeEstimate: `${this.stats.totalPublications * 2}MB`,
        costEstimate: `$${(this.stats.totalPublications * 2 * 0.00001).toFixed(2)}`,
        description: 'Much smaller than full CrimRXiv archive'
      },
      generatedAt: new Date().toISOString()
    };
    
    // Ensure data directory exists
    try {
      await fs.promises.mkdir('./data', { recursive: true });
    } catch {} // Directory might already exist
    
    // Save report
    await fs.promises.writeFile(
      './data/simple-consortium-analysis.json', 
      JSON.stringify(report, null, 2)
    );
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📋 CONSORTIUM ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`📊 Total Members: ${report.summary.totalMembers}`);
    console.log(`📁 Members with Export Data: ${report.summary.membersWithDirectories}`);
    console.log(`📚 Total Publications: ${report.summary.totalPublications}`);
    console.log(`📈 Avg Publications/Member: ${report.summary.averagePublicationsPerMember}`);
    
    console.log('\n🏆 Top Publishing Members:');
    report.topProducers.slice(0, 8).forEach((member, index) => {
      console.log(`${index + 1}. ${member.name}: ${member.publicationCount} pubs`);
    });
    
    console.log('\n💰 Cost Estimates for Arweave:');
    console.log(`📦 Estimated Size: ${report.estimates.sizeEstimate}`);
    console.log(`💵 Estimated Cost: ${report.estimates.costEstimate}`);
    console.log(`📝 Note: ${report.estimates.description}`);
    
    console.log('\n📄 Report saved to: ./data/simple-consortium-analysis.json');
    
    console.log('\n🎯 PROJECT SCOPE CONFIRMED:');
    console.log('✅ Focus on consortium members only (not full CrimRXiv)');
    console.log('✅ Much smaller, more manageable dataset');
    console.log('✅ Lower costs and faster development');
    console.log('✅ Clear handoff to CrimRXiv team');
    
    console.log('\n🚀 Ready to proceed with consortium-focused implementation!');
    console.log('='.repeat(60));
  }
}

// Run analysis
const analyzer = new SimpleConsortiumAnalyzer();
analyzer.analyze().catch(error => {
  console.error('Analysis failed:', error);
  process.exit(1);
});