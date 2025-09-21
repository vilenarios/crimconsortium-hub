#!/usr/bin/env node

/**
 * Create Final Comprehensive Dataset
 * Combines all 30 consortium members with accurate publication counts
 */

import { Logger, FileHelper } from '../src/lib/utils.js';

class FinalDatasetCreator {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
  }

  async createFinalDataset() {
    this.logger.info('🎯 Creating final comprehensive consortium dataset...');
    
    try {
      // Load complete analysis results
      const completeAnalysis = await this.fileHelper.readJSON('./data/final/complete-consortium-analysis.json');
      const comprehensivePublications = await this.fileHelper.readJSON('./data/final/consortium-dataset-comprehensive.json');
      
      if (!completeAnalysis || !comprehensivePublications) {
        throw new Error('Complete analysis data not found');
      }
      
      // Create final dataset with all 30 members
      const finalDataset = {
        metadata: {
          name: 'CrimConsortium Final Complete Dataset',
          description: 'All 30 consortium members with complete publication data',
          version: '5.0',
          createdAt: new Date().toISOString(),
          totalConsortiumMembers: 30,
          researchInstitutions: completeAnalysis.summary.membersWithPublications,
          supportingOrganizations: completeAnalysis.summary.membersWithoutPublications,
          scrapingMethod: 'Complete member page analysis + publication detail scraping'
        },
        
        summary: {
          totalMembers: 30,
          researchMembers: completeAnalysis.summary.membersWithPublications,
          supportingMembers: completeAnalysis.summary.membersWithoutPublications,
          totalPublications: comprehensivePublications.publications.length,
          dateRange: comprehensivePublications.summary.dateRange
        },
        
        // All 30 members (with and without publications)
        members: completeAnalysis.allMembers.map(member => ({
          id: member.id,
          name: member.name,
          slug: member.slug,
          publicationCount: member.publicationCount,
          hasPublications: member.publicationCount > 0,
          memberType: member.publicationCount > 0 ? 'research-institution' : 'supporting-organization',
          publications: member.publications || [],
          sourceUrl: member.url
        })),
        
        // Complete publication dataset (using detailed scraping results)
        publications: comprehensivePublications.publications,
        
        // Organization by type
        researchInstitutions: completeAnalysis.allMembers
          .filter(m => m.publicationCount > 0)
          .sort((a, b) => b.publicationCount - a.publicationCount),
          
        supportingOrganizations: completeAnalysis.allMembers
          .filter(m => m.publicationCount === 0)
          .sort((a, b) => a.name.localeCompare(b.name))
      };
      
      // Save final comprehensive dataset
      await this.fileHelper.writeJSON('./data/final/consortium-dataset-final.json', finalDataset);
      
      // Replace main dataset
      await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', finalDataset);
      
      this.logger.success('Final comprehensive dataset created');
      this.printFinalSummary(finalDataset);
      
      return finalDataset;
      
    } catch (error) {
      this.logger.error('Failed to create final dataset', error.message);
      throw error;
    }
  }

  printFinalSummary(dataset) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL COMPREHENSIVE CONSORTIUM DATASET');
    console.log('='.repeat(80));
    
    console.log(`👥 Total Consortium Members: ${dataset.summary.totalMembers}`);
    console.log(`🎓 Research Institutions: ${dataset.summary.researchMembers}`);
    console.log(`🤝 Supporting Organizations: ${dataset.summary.supportingMembers}`);
    console.log(`📚 Total Publications: ${dataset.summary.totalPublications}`);
    
    console.log('\n🏆 TOP RESEARCH INSTITUTIONS:');
    dataset.researchInstitutions.slice(0, 10).forEach(member => {
      console.log(`   ${member.name}: ${member.publicationCount} publications`);
    });
    
    console.log('\n🤝 SUPPORTING ORGANIZATIONS:');
    dataset.supportingOrganizations.slice(0, 8).forEach(member => {
      console.log(`   ${member.name} (infrastructure/journal/society)`);
    });
    
    console.log('\n📊 DATASET STATISTICS:');
    console.log(`   Average publications per research institution: ${Math.round(dataset.summary.totalPublications / dataset.summary.researchMembers)}`);
    console.log(`   Date range: ${dataset.summary.dateRange.earliest?.split('T')[0]} to ${dataset.summary.dateRange.latest?.split('T')[0]}`);
    console.log(`   Publication growth: ${dataset.summary.totalPublications} total publications archived`);
    
    console.log('\n✅ READY FOR FINAL BUILD:');
    console.log(`   Site will show all 30 consortium members`);
    console.log(`   ${dataset.summary.researchMembers} research institutions with publication counts`);
    console.log(`   ${dataset.summary.supportingMembers} supporting organizations as consortium participants`);
    console.log(`   ${dataset.summary.totalPublications} publications ready for ArDrive upload`);
    
    console.log('='.repeat(80));
  }
}

// Create final dataset
const creator = new FinalDatasetCreator();
creator.createFinalDataset().catch(console.error);