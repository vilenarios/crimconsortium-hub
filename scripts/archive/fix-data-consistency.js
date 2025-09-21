#!/usr/bin/env node

/**
 * Fix Data Consistency Issues
 * Deep dive analysis and correction of member publication counts
 */

import { Logger, FileHelper } from '../src/lib/utils.js';

class DataConsistencyFixer {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.dataset = null;
  }

  async fixDataConsistency() {
    this.logger.info('🔍 Deep dive: Analyzing data consistency issues...');
    
    try {
      // Load current dataset
      await this.loadDataset();
      
      // Analyze inconsistencies
      await this.analyzeInconsistencies();
      
      // Fix member publication counts
      await this.fixMemberCounts();
      
      // Validate fixed data
      await this.validateFixedData();
      
      // Save corrected dataset
      await this.saveCorrectedDataset();
      
      this.logger.success('Data consistency issues fixed');
      
    } catch (error) {
      this.logger.error('Failed to fix data consistency', error.message);
      throw error;
    }
  }

  async loadDataset() {
    this.dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
    if (!this.dataset) {
      throw new Error('Dataset not found');
    }
    
    this.logger.success(`Dataset loaded: ${this.dataset.publications.length} publications, ${this.dataset.members.length} members`);
  }

  async analyzeInconsistencies() {
    this.logger.info('📊 Analyzing data inconsistencies...');
    
    const inconsistencies = [];
    
    for (const member of this.dataset.members) {
      // Count actual publications for this member
      const actualPublications = this.dataset.publications.filter(pub => 
        pub.memberAssociations && pub.memberAssociations.includes(member.id)
      );
      
      const storedCount = member.publicationCount;
      const actualCount = actualPublications.length;
      const listedCount = member.publications ? member.publications.length : 0;
      
      if (storedCount !== actualCount || storedCount !== listedCount) {
        inconsistencies.push({
          member: member.name,
          id: member.id,
          storedCount: storedCount,
          actualCount: actualCount,
          listedCount: listedCount,
          actualPublications: actualPublications.map(p => ({ id: p.id, title: p.title }))
        });
      }
    }
    
    console.log('\n📊 DATA CONSISTENCY ANALYSIS:');
    console.log('='.repeat(60));
    
    if (inconsistencies.length === 0) {
      console.log('✅ No inconsistencies found - data is consistent');
    } else {
      console.log(`❌ Found ${inconsistencies.length} members with inconsistent counts:`);
      
      inconsistencies.forEach(issue => {
        console.log(`\n🏛️  ${issue.member}:`);
        console.log(`   Stored count: ${issue.storedCount}`);
        console.log(`   Actual publications: ${issue.actualCount}`);
        console.log(`   Listed publications: ${issue.listedCount}`);
        console.log(`   Publications found:`);
        issue.actualPublications.forEach(pub => {
          console.log(`     • ${pub.title.substring(0, 60)}...`);
        });
      });
    }
    
    console.log('='.repeat(60));
    return inconsistencies;
  }

  async fixMemberCounts() {
    this.logger.info('🔧 Fixing member publication counts...');
    
    let fixed = 0;
    
    for (const member of this.dataset.members) {
      // Get actual publications for this member
      const memberPublications = this.dataset.publications.filter(pub => 
        pub.memberAssociations && pub.memberAssociations.includes(member.id)
      );
      
      const correctCount = memberPublications.length;
      const correctPublicationIds = memberPublications.map(p => p.id);
      
      // Update member object with correct data
      if (member.publicationCount !== correctCount || 
          JSON.stringify(member.publications) !== JSON.stringify(correctPublicationIds)) {
        
        console.log(`🔧 Fixing ${member.name}: ${member.publicationCount} → ${correctCount}`);
        
        member.publicationCount = correctCount;
        member.publications = correctPublicationIds;
        fixed++;
      }
    }
    
    this.logger.success(`Fixed ${fixed} member publication counts`);
  }

  async validateFixedData() {
    this.logger.info('✅ Validating fixed data...');
    
    let totalPublications = 0;
    let validMembers = 0;
    
    for (const member of this.dataset.members) {
      const actualPubs = this.dataset.publications.filter(pub => 
        pub.memberAssociations && pub.memberAssociations.includes(member.id)
      );
      
      if (member.publicationCount === actualPubs.length && 
          member.publications.length === actualPubs.length) {
        validMembers++;
        totalPublications += actualPubs.length;
        
        console.log(`✅ ${member.name}: ${member.publicationCount} publications (consistent)`);
      } else {
        console.log(`❌ ${member.name}: Still inconsistent!`);
      }
    }
    
    // Update metadata
    this.dataset.metadata = {
      ...this.dataset.metadata,
      totalPublications: this.dataset.publications.length,
      totalMembers: this.dataset.members.length,
      activeMembersWithContent: validMembers,
      lastConsistencyCheck: new Date().toISOString(),
      dataConsistent: validMembers === this.dataset.members.length
    };
    
    this.logger.success(`Validation complete: ${validMembers}/${this.dataset.members.length} members consistent`);
  }

  async saveCorrectedDataset() {
    // Save corrected dataset
    await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', this.dataset);
    
    // Also create a backup of the corrected data
    await this.fileHelper.writeJSON(
      `./data/final/consortium-dataset-corrected-${new Date().toISOString().split('T')[0]}.json`, 
      this.dataset
    );
    
    this.logger.success('Corrected dataset saved');
  }

  async printSummary() {
    console.log('\n🎯 DATA CONSISTENCY FIX SUMMARY:');
    console.log('='.repeat(60));
    
    // Group publications by member for verification
    const memberStats = this.dataset.members.map(member => {
      const publications = this.dataset.publications.filter(pub => 
        pub.memberAssociations && pub.memberAssociations.includes(member.id)
      );
      
      return {
        name: member.name,
        count: member.publicationCount,
        actualPubs: publications.length,
        consistent: member.publicationCount === publications.length
      };
    }).sort((a, b) => b.count - a.count);
    
    memberStats.forEach(stat => {
      const icon = stat.consistent ? '✅' : '❌';
      console.log(`${icon} ${stat.name}: ${stat.count} publications`);
    });
    
    const totalConsistent = memberStats.filter(s => s.consistent).length;
    console.log(`\n📊 Result: ${totalConsistent}/${memberStats.length} members have consistent data`);
    console.log(`📚 Total publications: ${this.dataset.publications.length}`);
    console.log(`👥 Total members: ${this.dataset.members.length}`);
    
    console.log('='.repeat(60));
  }
}

// Run fixer
const fixer = new DataConsistencyFixer();
fixer.fixDataConsistency()
  .then(() => fixer.printSummary())
  .catch(error => {
    console.error('Fix failed:', error);
    process.exit(1);
  });