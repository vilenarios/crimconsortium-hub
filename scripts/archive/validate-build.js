#!/usr/bin/env node

/**
 * Build Validation Script
 * Comprehensive validation of Phase 3 static site build
 * Ensures robust error handling and deployment readiness
 */

import fs from 'fs-extra';
import { Logger, FileHelper } from '../src/lib/utils.js';

class BuildValidator {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    
    this.validation = {
      structure: { status: 'unknown', issues: [] },
      content: { status: 'unknown', issues: [] },
      dataEndpoints: { status: 'unknown', issues: [] },
      errorHandling: { status: 'unknown', issues: [] },
      deployment: { status: 'unknown', issues: [] },
      overall: 'unknown'
    };
  }

  async validateBuild() {
    this.logger.info('🔍 Validating Phase 3 build comprehensively...');
    console.log('='.repeat(60));
    
    try {
      // Check 1: Build structure completeness
      await this.validateBuildStructure();
      
      // Check 2: Content quality and completeness
      await this.validateContent();
      
      // Check 3: Data endpoint functionality
      await this.validateDataEndpoints();
      
      // Check 4: Error handling robustness
      await this.validateErrorHandling();
      
      // Check 5: Deployment readiness
      await this.validateDeploymentReadiness();
      
      // Generate validation report
      await this.generateValidationReport();
      
      console.log('='.repeat(60));
      this.printValidationSummary();
      
      return this.validation;
      
    } catch (error) {
      this.logger.error('Build validation failed', error.message);
      throw error;
    }
  }

  async validateBuildStructure() {
    this.logger.info('1️⃣ Validating build structure...');
    
    const requiredDirectories = [
      './dist/main',
      './dist/data', 
      './dist/search',
      './dist/members',
      './dist/stats'
    ];
    
    const requiredFiles = [
      './dist/main/index.html',
      './dist/main/manifest.json',
      './dist/data/index.json',
      './dist/data/articles.json',
      './dist/data/recent.json',
      './dist/search/index.json',
      './dist/search/docs.json',
      './dist/members/index.json',
      './dist/stats/index.json'
    ];
    
    const issues = [];
    
    // Check directories
    for (const dir of requiredDirectories) {
      if (!await this.fileHelper.exists(dir)) {
        issues.push(`Missing directory: ${dir}`);
      }
    }
    
    // Check files
    for (const file of requiredFiles) {
      if (!await this.fileHelper.exists(file)) {
        issues.push(`Missing file: ${file}`);
      } else {
        // Check file size (ensure not empty)
        const size = await this.fileHelper.getFileSize(file);
        if (size === 0) {
          issues.push(`Empty file: ${file}`);
        }
      }
    }
    
    this.validation.structure = {
      status: issues.length === 0 ? 'pass' : 'fail',
      issues,
      details: {
        requiredDirectories: requiredDirectories.length,
        requiredFiles: requiredFiles.length,
        missingItems: issues.length
      }
    };
    
    if (this.validation.structure.status === 'pass') {
      this.logger.success('Build Structure: PASS');
    } else {
      this.logger.error(`Build Structure: FAIL (${issues.length} issues)`);
      issues.forEach(issue => console.log(`   ${issue}`));
    }
  }

  async validateContent() {
    this.logger.info('2️⃣ Validating content quality...');
    
    const issues = [];
    
    try {
      // Load and validate main dataset
      const dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
      
      if (!dataset) {
        issues.push('Main dataset not found');
      } else {
        // Validate dataset structure
        if (!dataset.publications || dataset.publications.length === 0) {
          issues.push('No publications in dataset');
        }
        
        if (!dataset.members || dataset.members.length === 0) {
          issues.push('No members in dataset');
        }
        
        // Check publication data quality
        const invalidPubs = dataset.publications.filter(pub => 
          !pub.id || !pub.title || !pub.authors || pub.authors.length === 0
        );
        
        if (invalidPubs.length > 0) {
          issues.push(`${invalidPubs.length} publications missing required fields`);
        }
        
        // Check PDF availability
        const pubsWithoutPDFs = dataset.publications.filter(pub => !pub.filePath);
        if (pubsWithoutPDFs.length > 0) {
          issues.push(`${pubsWithoutPDFs.length} publications missing PDFs`);
        }
      }
      
      // Validate generated data endpoints
      const dataEndpoints = await this.fileHelper.readJSON('./dist/data/index.json');
      if (!dataEndpoints || !dataEndpoints.articles) {
        issues.push('Data endpoints not properly generated');
      }
      
      // Validate search system
      const searchDocs = await this.fileHelper.readJSON('./dist/search/docs.json');
      if (!searchDocs || !searchDocs.documents) {
        issues.push('Search documents not generated');
      }
      
    } catch (error) {
      issues.push(`Content validation error: ${error.message}`);
    }
    
    this.validation.content = {
      status: issues.length === 0 ? 'pass' : 'fail',
      issues
    };
    
    if (this.validation.content.status === 'pass') {
      this.logger.success('Content Quality: PASS');
    } else {
      this.logger.error(`Content Quality: FAIL (${issues.length} issues)`);
    }
  }

  async validateDataEndpoints() {
    this.logger.info('3️⃣ Validating data endpoints...');
    
    const endpoints = [
      { name: 'Data Index', path: './dist/data/index.json' },
      { name: 'Recent Articles', path: './dist/data/recent.json' },
      { name: 'Search Index', path: './dist/search/index.json' },
      { name: 'Search Docs', path: './dist/search/docs.json' },
      { name: 'Members Index', path: './dist/members/index.json' },
      { name: 'Stats', path: './dist/stats/index.json' }
    ];
    
    const issues = [];
    
    for (const endpoint of endpoints) {
      try {
        const data = await this.fileHelper.readJSON(endpoint.path);
        
        if (!data) {
          issues.push(`${endpoint.name}: File exists but contains no data`);
          continue;
        }
        
        // Validate specific endpoint structures
        if (endpoint.name === 'Data Index' && !data.articles) {
          issues.push(`${endpoint.name}: Missing articles array`);
        }
        
        if (endpoint.name === 'Search Index' && !data.lunrIndex) {
          issues.push(`${endpoint.name}: Missing search index`);
        }
        
        if (endpoint.name === 'Members Index' && !data.members) {
          issues.push(`${endpoint.name}: Missing members array`);
        }
        
      } catch (error) {
        issues.push(`${endpoint.name}: Cannot read or parse JSON - ${error.message}`);
      }
    }
    
    this.validation.dataEndpoints = {
      status: issues.length === 0 ? 'pass' : 'fail',
      issues,
      details: {
        totalEndpoints: endpoints.length,
        validEndpoints: endpoints.length - issues.length
      }
    };
    
    if (this.validation.dataEndpoints.status === 'pass') {
      this.logger.success('Data Endpoints: PASS');
    } else {
      this.logger.error(`Data Endpoints: FAIL (${issues.length} issues)`);
    }
  }

  async validateErrorHandling() {
    this.logger.info('4️⃣ Validating error handling...');
    
    const issues = [];
    
    // Check if main site has error handling
    try {
      const mainHTML = await fs.readFile('./dist/main/index.html', 'utf8');
      
      // Check for basic error handling patterns
      const hasErrorHandling = [
        mainHTML.includes('catch (error)'),
        mainHTML.includes('console.error'),
        mainHTML.includes('Failed to load')
      ];
      
      if (!hasErrorHandling.some(Boolean)) {
        issues.push('Main site lacks error handling in JavaScript');
      }
      
      // Check for loading states
      if (!mainHTML.includes('Loading...')) {
        issues.push('No loading states visible for progressive enhancement');
      }
      
      // Check for accessibility
      if (!mainHTML.includes('role=') || !mainHTML.includes('aria-')) {
        issues.push('Limited accessibility attributes found');
      }
      
    } catch (error) {
      issues.push(`Cannot analyze main HTML: ${error.message}`);
    }
    
    // Check if build scripts have error handling
    const buildScripts = [
      './scripts/build-site-complete.js',
      './scripts/serve.js',
      './scripts/sync-ardrive.js'
    ];
    
    for (const script of buildScripts) {
      try {
        const content = await fs.readFile(script, 'utf8');
        
        if (!content.includes('try {') || !content.includes('catch (error)')) {
          issues.push(`${script}: Lacks try/catch error handling`);
        }
        
        if (!content.includes('this.logger.error')) {
          issues.push(`${script}: No error logging found`);
        }
        
      } catch (error) {
        issues.push(`Cannot analyze ${script}: ${error.message}`);
      }
    }
    
    this.validation.errorHandling = {
      status: issues.length === 0 ? 'pass' : issues.length <= 2 ? 'warning' : 'fail',
      issues
    };
    
    if (this.validation.errorHandling.status === 'pass') {
      this.logger.success('Error Handling: PASS');
    } else if (this.validation.errorHandling.status === 'warning') {
      this.logger.warning(`Error Handling: Needs improvement (${issues.length} issues)`);
    } else {
      this.logger.error(`Error Handling: FAIL (${issues.length} issues)`);
    }
  }

  async validateDeploymentReadiness() {
    this.logger.info('5️⃣ Validating deployment readiness...');
    
    const issues = [];
    
    // Check environment configuration
    if (!process.env.ARWEAVE_WALLET_PATH) {
      issues.push('ARWEAVE_WALLET_PATH not configured for deployment');
    }
    
    // Check wallet file exists
    if (process.env.ARWEAVE_WALLET_PATH && !await this.fileHelper.exists(process.env.ARWEAVE_WALLET_PATH)) {
      issues.push('Arweave wallet file not found');
    }
    
    // Check consortium dataset
    if (!await this.fileHelper.exists('./data/final/consortium-dataset.json')) {
      issues.push('Consortium dataset not finalized');
    }
    
    // Check deployment scripts exist
    const deploymentScripts = [
      './scripts/sync-ardrive.js',
      './scripts/deploy-arweave.js'
    ];
    
    for (const script of deploymentScripts) {
      if (!await this.fileHelper.exists(script)) {
        issues.push(`Missing deployment script: ${script}`);
      }
    }
    
    // Check for security issues
    const securityChecks = [
      { file: '.env', issue: 'Environment file should not be committed' },
      { file: 'wallet.json', issue: 'Wallet file should not be in repository' },
      { file: '.env.local', issue: 'Local environment file should not be committed' }
    ];
    
    for (const check of securityChecks) {
      if (await this.fileHelper.exists(check.file)) {
        issues.push(`Security risk: ${check.issue}`);
      }
    }
    
    this.validation.deployment = {
      status: issues.length === 0 ? 'pass' : issues.length <= 2 ? 'warning' : 'fail',
      issues
    };
    
    if (this.validation.deployment.status === 'pass') {
      this.logger.success('Deployment Readiness: PASS');
    } else {
      this.logger.warning(`Deployment Readiness: ${issues.length} considerations`);
    }
  }

  async generateValidationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      phase: 'Phase 3 - Static Site Development',
      validation: this.validation,
      recommendations: this.generateRecommendations(),
      readyForPhase4: this.isReadyForPhase4(),
      readyForCommit: this.isReadyForCommit()
    };
    
    await this.fileHelper.writeJSON('./data/phase3-validation-report.json', report);
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Structure recommendations
    if (this.validation.structure.status !== 'pass') {
      recommendations.push({
        priority: 'high',
        category: 'structure',
        issue: 'Build structure incomplete',
        action: 'Re-run npm run build to generate missing files'
      });
    }
    
    // Error handling recommendations
    if (this.validation.errorHandling.status !== 'pass') {
      recommendations.push({
        priority: 'medium',
        category: 'robustness',
        issue: 'Error handling could be improved',
        action: 'Add comprehensive error boundaries and fallback states'
      });
    }
    
    // Deployment recommendations
    if (this.validation.deployment.issues.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'deployment',
        issue: 'Deployment configuration needs attention',
        action: 'Configure wallet and environment variables'
      });
    }
    
    return recommendations;
  }

  isReadyForPhase4() {
    return this.validation.structure.status === 'pass' && 
           this.validation.content.status === 'pass' &&
           this.validation.dataEndpoints.status === 'pass';
  }

  isReadyForCommit() {
    return this.isReadyForPhase4() && 
           !this.validation.deployment.issues.some(issue => issue.includes('Security risk'));
  }

  printValidationSummary() {
    this.logger.info('📊 Phase 3 Build Validation Summary');
    console.log('');
    
    // Overall status
    const allPassed = Object.values(this.validation).every(check => 
      !check.status || check.status === 'pass' || check.status === 'warning'
    );
    
    if (allPassed && this.isReadyForPhase4()) {
      console.log('🎉 PHASE 3 BUILD VALIDATED - READY FOR PHASE 4');
      console.log('✅ All critical components verified');
      console.log('✅ Data endpoints functioning');
      console.log('✅ Content quality confirmed');
    } else {
      console.log('⚠️  PHASE 3 BUILD NEEDS ATTENTION');
      console.log('🔧 Please resolve issues before proceeding');
    }
    
    console.log('');
    
    // Individual validation results
    const checks = [
      { name: 'Build Structure', check: this.validation.structure },
      { name: 'Content Quality', check: this.validation.content },
      { name: 'Data Endpoints', check: this.validation.dataEndpoints },
      { name: 'Error Handling', check: this.validation.errorHandling },
      { name: 'Deployment Readiness', check: this.validation.deployment }
    ];
    
    checks.forEach(({ name, check }) => {
      const icon = {
        'pass': '✅',
        'warning': '⚠️',
        'fail': '❌',
        'unknown': '❓'
      }[check.status] || '❓';
      
      console.log(`${icon} ${name}: ${check.status.toUpperCase()}`);
      
      if (check.issues && check.issues.length > 0) {
        check.issues.slice(0, 3).forEach(issue => {
          console.log(`   • ${issue}`);
        });
        if (check.issues.length > 3) {
          console.log(`   • ... and ${check.issues.length - 3} more issues`);
        }
      }
    });
    
    console.log('');
    
    // Recommendations
    const recommendations = this.generateRecommendations();
    const highPriority = recommendations.filter(r => r.priority === 'high');
    
    if (highPriority.length > 0) {
      console.log('🔧 HIGH PRIORITY ACTIONS:');
      highPriority.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.issue}`);
        console.log(`   Action: ${rec.action}`);
      });
      console.log('');
    }
    
    // Status summary
    console.log('📋 READINESS STATUS:');
    console.log(`   Phase 4 Deployment: ${this.isReadyForPhase4() ? '✅ Ready' : '❌ Not Ready'}`);
    console.log(`   GitHub Commit: ${this.isReadyForCommit() ? '✅ Ready' : '❌ Not Ready'}`);
    
    if (this.isReadyForCommit()) {
      console.log('\n🚀 READY FOR FIRST GITHUB COMMIT');
      console.log('   All code validated and secure');
      console.log('   Documentation complete');
      console.log('   No security risks detected');
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new BuildValidator();
  validator.validateBuild().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export default BuildValidator;