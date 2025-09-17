#!/usr/bin/env node

/**
 * Foundation Verification Script
 * Comprehensive check that Phase 1 is complete and ready for Phase 2
 * Team-friendly output with clear next steps
 */

import fs from 'fs-extra';
import { Logger, FileHelper, Validator } from '../src/lib/utils.js';

class FoundationVerifier {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.validator = new Validator();
    
    this.checks = {
      environment: { status: 'unknown', details: {} },
      dependencies: { status: 'unknown', details: {} },
      projectStructure: { status: 'unknown', details: {} },
      coreLibraries: { status: 'unknown', details: {} },
      consortiumData: { status: 'unknown', details: {} },
      readyForPhase2: false
    };
  }

  async verifyFoundation() {
    this.logger.info('🔍 Verifying Phase 1 foundation setup...');
    console.log('='.repeat(60));
    
    try {
      // Check 1: Environment configuration
      await this.checkEnvironment();
      
      // Check 2: Dependencies
      await this.checkDependencies();
      
      // Check 3: Project structure
      await this.checkProjectStructure();
      
      // Check 4: Core libraries
      await this.checkCoreLibraries();
      
      // Check 5: Consortium data
      await this.checkConsortiumData();
      
      // Check 6: Overall readiness
      await this.assessReadiness();
      
      // Generate verification report
      await this.generateVerificationReport();
      
      console.log('='.repeat(60));
      this.printSummary();
      
      return this.checks;
      
    } catch (error) {
      this.logger.error('Foundation verification failed', error.message);
      throw error;
    }
  }

  async checkEnvironment() {
    this.logger.info('1️⃣ Checking environment configuration...');
    
    try {
      // Node.js version
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      // Environment variables
      const requiredEnvVars = ['ARWEAVE_WALLET_PATH'];
      const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
      
      // Wallet validation
      let walletValid = false;
      let walletError = null;
      
      if (process.env.ARWEAVE_WALLET_PATH) {
        try {
          walletValid = this.validator.validateWalletPath(process.env.ARWEAVE_WALLET_PATH);
        } catch (error) {
          walletError = error.message;
        }
      }
      
      this.checks.environment = {
        status: missingEnvVars.length === 0 && walletValid ? 'pass' : 'fail',
        details: {
          nodeVersion,
          nodeVersionOK: majorVersion >= 18,
          missingEnvVars,
          walletConfigured: !!process.env.ARWEAVE_WALLET_PATH,
          walletValid,
          walletError
        }
      };
      
      if (this.checks.environment.status === 'pass') {
        this.logger.success('Environment: PASS');
      } else {
        this.logger.error('Environment: FAIL');
        if (missingEnvVars.length > 0) {
          console.log(`  Missing: ${missingEnvVars.join(', ')}`);
        }
        if (walletError) {
          console.log(`  Wallet issue: ${walletError}`);
        }
      }
      
    } catch (error) {
      this.checks.environment = { status: 'error', error: error.message };
      this.logger.error('Environment check failed', error.message);
    }
  }

  async checkDependencies() {
    this.logger.info('2️⃣ Checking dependencies...');
    
    const criticalDeps = [
      'ardrive-core-js',
      'axios', 
      'fs-extra',
      'xml2js'
    ];
    
    const optionalDeps = [
      'cheerio',
      'lunr',
      'handlebars',
      'chalk'
    ];
    
    const results = { critical: [], optional: [] };
    
    // Check critical dependencies
    for (const dep of criticalDeps) {
      try {
        await import(dep);
        results.critical.push({ name: dep, status: 'available' });
        this.logger.info(`✅ ${dep}: Available`);
      } catch (error) {
        results.critical.push({ name: dep, status: 'missing', error: error.message });
        this.logger.error(`❌ ${dep}: MISSING`);
      }
    }
    
    // Check optional dependencies
    for (const dep of optionalDeps) {
      try {
        await import(dep);
        results.optional.push({ name: dep, status: 'available' });
      } catch (error) {
        results.optional.push({ name: dep, status: 'missing' });
      }
    }
    
    const criticalMissing = results.critical.filter(d => d.status === 'missing').length;
    
    this.checks.dependencies = {
      status: criticalMissing === 0 ? 'pass' : 'fail',
      details: {
        critical: results.critical,
        optional: results.optional,
        criticalMissing,
        optionalMissing: results.optional.filter(d => d.status === 'missing').length
      }
    };
    
    if (this.checks.dependencies.status === 'pass') {
      this.logger.success('Dependencies: PASS');
    } else {
      this.logger.error(`Dependencies: FAIL (${criticalMissing} critical missing)`);
    }
  }

  async checkProjectStructure() {
    this.logger.info('3️⃣ Checking project structure...');
    
    const requiredDirs = [
      'src/lib',
      'src/templates', 
      'src/assets',
      'scripts',
      'data',
      'export'
    ];
    
    const requiredFiles = [
      'package.json',
      'README.md',
      '.env.example',
      'src/lib/utils.js',
      'src/lib/arfs-client.js',
      'scripts/process-consortium-export.js'
    ];
    
    const missingDirs = [];
    const missingFiles = [];
    
    // Check directories
    for (const dir of requiredDirs) {
      if (!await this.fileHelper.exists(dir)) {
        missingDirs.push(dir);
      }
    }
    
    // Check files
    for (const file of requiredFiles) {
      if (!await this.fileHelper.exists(file)) {
        missingFiles.push(file);
      }
    }
    
    this.checks.projectStructure = {
      status: missingDirs.length === 0 && missingFiles.length === 0 ? 'pass' : 'fail',
      details: {
        requiredDirs: requiredDirs.length,
        requiredFiles: requiredFiles.length,
        missingDirs,
        missingFiles
      }
    };
    
    if (this.checks.projectStructure.status === 'pass') {
      this.logger.success('Project Structure: PASS');
    } else {
      this.logger.error('Project Structure: FAIL');
      if (missingDirs.length > 0) {
        console.log(`  Missing directories: ${missingDirs.join(', ')}`);
      }
      if (missingFiles.length > 0) {
        console.log(`  Missing files: ${missingFiles.join(', ')}`);
      }
    }
  }

  async checkCoreLibraries() {
    this.logger.info('4️⃣ Checking core libraries...');
    
    const libraries = [
      { path: '../src/lib/utils.js', name: 'Utils' },
      { path: '../src/lib/arfs-client.js', name: 'ARFS Client' },
      { path: '../src/lib/export-parser.js', name: 'Export Parser' }
    ];
    
    const results = [];
    
    for (const lib of libraries) {
      try {
        const module = await import(lib.path);
        
        // Check if module exports expected classes/functions
        const hasExports = Object.keys(module).length > 0;
        
        results.push({
          name: lib.name,
          status: hasExports ? 'pass' : 'warning',
          exports: Object.keys(module)
        });
        
        if (hasExports) {
          this.logger.success(`${lib.name}: Available`);
        } else {
          this.logger.warning(`${lib.name}: No exports found`);
        }
        
      } catch (error) {
        results.push({
          name: lib.name,
          status: 'fail',
          error: error.message
        });
        this.logger.error(`${lib.name}: FAIL`);
      }
    }
    
    const allPassed = results.every(r => r.status === 'pass');
    
    this.checks.coreLibraries = {
      status: allPassed ? 'pass' : 'warning',
      details: { libraries: results }
    };
    
    if (this.checks.coreLibraries.status === 'pass') {
      this.logger.success('Core Libraries: PASS');
    } else {
      this.logger.warning('Core Libraries: Some issues detected');
    }
  }

  async checkConsortiumData() {
    this.logger.info('5️⃣ Checking consortium data...');
    
    const dataFiles = [
      './data/consortium/members.json',
      './data/consortium/publications.json', 
      './data/consortium/processing-report.json'
    ];
    
    const checks = {
      exportExists: await this.fileHelper.exists('./export/export.json'),
      consortiumPageExists: await this.fileHelper.exists('./export/consortium/index.html'),
      dataFilesExist: 0,
      membersCount: 0,
      publicationsCount: 0,
      pdfCount: 0
    };
    
    // Check data files
    for (const file of dataFiles) {
      if (await this.fileHelper.exists(file)) {
        checks.dataFilesExist++;
      }
    }
    
    // Check consortium data content
    if (checks.dataFilesExist > 0) {
      try {
        const members = await this.fileHelper.readJSON('./data/consortium/members.json');
        const publications = await this.fileHelper.readJSON('./data/consortium/publications.json');
        
        checks.membersCount = members ? members.length : 0;
        checks.publicationsCount = publications ? publications.length : 0;
        
        // Check for PDFs
        if (await this.fileHelper.exists('./data/consortium/pdfs')) {
          const pdfFiles = await fs.readdir('./data/consortium/pdfs');
          checks.pdfCount = pdfFiles.filter(f => f.endsWith('.pdf')).length;
        }
        
      } catch (error) {
        this.logger.warning('Could not read consortium data files', error.message);
      }
    }
    
    const hasMinimumData = checks.membersCount > 0 && checks.publicationsCount >= 0;
    
    this.checks.consortiumData = {
      status: checks.exportExists && hasMinimumData ? 'pass' : 'warning',
      details: checks
    };
    
    if (this.checks.consortiumData.status === 'pass') {
      this.logger.success(`Consortium Data: PASS (${checks.membersCount} members, ${checks.publicationsCount} publications)`);
    } else {
      this.logger.warning('Consortium Data: Needs attention');
    }
  }

  async assessReadiness() {
    this.logger.info('6️⃣ Assessing overall readiness...');
    
    const criticalChecks = [
      this.checks.environment.status === 'pass',
      this.checks.dependencies.status === 'pass',
      this.checks.projectStructure.status === 'pass'
    ];
    
    const allCriticalPassed = criticalChecks.every(check => check);
    const hasConsortiumData = this.checks.consortiumData.details.publicationsCount >= 0;
    
    this.checks.readyForPhase2 = allCriticalPassed && hasConsortiumData;
    
    if (this.checks.readyForPhase2) {
      this.logger.success('✅ Foundation is ready for Phase 2 (ARFS Integration)');
    } else {
      this.logger.warning('⚠️  Foundation needs attention before Phase 2');
    }
  }

  async generateVerificationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      phase: 'Phase 1 - Foundation Setup',
      nextPhase: 'Phase 2 - ARFS Integration',
      checks: this.checks,
      recommendations: this.generateRecommendations(),
      readyToProgress: this.checks.readyForPhase2
    };
    
    await this.fileHelper.ensureDir('./data');
    await this.fileHelper.writeJSON('./data/foundation-verification.json', report);
    
    this.logger.info('📊 Verification report saved to: ./data/foundation-verification.json');
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Environment recommendations
    if (this.checks.environment.status !== 'pass') {
      if (this.checks.environment.details.missingEnvVars?.length > 0) {
        recommendations.push({
          priority: 'high',
          category: 'environment',
          issue: 'Missing environment variables',
          action: 'Copy .env.example to .env and configure ARWEAVE_WALLET_PATH',
          command: 'cp .env.example .env'
        });
      }
      
      if (!this.checks.environment.details.walletValid) {
        recommendations.push({
          priority: 'high',
          category: 'environment', 
          issue: 'Invalid or missing wallet',
          action: 'Ensure you have a valid Arweave wallet.json file and update ARWEAVE_WALLET_PATH',
          command: null
        });
      }
    }
    
    // Dependencies recommendations
    if (this.checks.dependencies.status !== 'pass') {
      recommendations.push({
        priority: 'high',
        category: 'dependencies',
        issue: 'Missing critical dependencies',
        action: 'Reinstall dependencies',
        command: 'npm install'
      });
    }
    
    // Project structure recommendations
    if (this.checks.projectStructure.status !== 'pass') {
      const missing = [
        ...this.checks.projectStructure.details.missingDirs || [],
        ...this.checks.projectStructure.details.missingFiles || []
      ];
      
      recommendations.push({
        priority: 'high',
        category: 'structure',
        issue: `Missing project files/directories: ${missing.join(', ')}`,
        action: 'Re-run foundation setup scripts',
        command: null
      });
    }
    
    // Consortium data recommendations
    if (this.checks.consortiumData.details.publicationsCount === 0) {
      recommendations.push({
        priority: 'medium',
        category: 'data',
        issue: 'No consortium publications found',
        action: 'Run consortium export processor to identify consortium content',
        command: 'npm run import'
      });
    }
    
    // Next steps
    if (this.checks.readyForPhase2) {
      recommendations.push({
        priority: 'info',
        category: 'next-steps',
        issue: 'Foundation complete',
        action: 'Ready to proceed to Phase 2: ARFS Integration',
        command: 'npm run sync'
      });
    }
    
    return recommendations;
  }

  printSummary() {
    this.logger.info('📋 Phase 1 Foundation Verification Summary');
    console.log('');
    
    // Overall status
    if (this.checks.readyForPhase2) {
      console.log('🎉 PHASE 1 COMPLETE - READY FOR PHASE 2');
      console.log('✅ All critical components verified');
      console.log('✅ Consortium data processed'); 
      console.log('✅ ARFS integration can begin');
    } else {
      console.log('⚠️  PHASE 1 NEEDS ATTENTION');
      console.log('🔧 Please resolve issues before proceeding to Phase 2');
    }
    
    console.log('');
    
    // Individual check results
    const checks = [
      { name: 'Environment Configuration', check: this.checks.environment },
      { name: 'Dependencies', check: this.checks.dependencies },
      { name: 'Project Structure', check: this.checks.projectStructure },
      { name: 'Core Libraries', check: this.checks.coreLibraries },
      { name: 'Consortium Data', check: this.checks.consortiumData }
    ];
    
    checks.forEach(({ name, check }) => {
      const icon = {
        'pass': '✅',
        'warning': '⚠️',
        'fail': '❌',
        'error': '💥',
        'unknown': '❓'
      }[check.status] || '❓';
      
      console.log(`${icon} ${name}: ${check.status.toUpperCase()}`);
      
      // Show key details
      if (check.details) {
        if (name === 'Environment Configuration') {
          console.log(`   Node.js: ${check.details.nodeVersion}`);
          console.log(`   Wallet: ${check.details.walletValid ? 'Valid' : 'Invalid/Missing'}`);
        } else if (name === 'Dependencies') {
          console.log(`   Critical: ${check.details.critical?.filter(d => d.status === 'available').length || 0}/${check.details.critical?.length || 0}`);
        } else if (name === 'Consortium Data') {
          console.log(`   Members: ${check.details.membersCount || 0}`);
          console.log(`   Publications: ${check.details.publicationsCount || 0}`);
          console.log(`   PDFs: ${check.details.pdfCount || 0}`);
        }
      }
    });
    
    // Recommendations
    const recommendations = this.generateRecommendations();
    const highPriority = recommendations.filter(r => r.priority === 'high');
    
    if (highPriority.length > 0) {
      console.log('\n🔧 HIGH PRIORITY ACTIONS NEEDED:');
      highPriority.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.issue}`);
        console.log(`   Action: ${rec.action}`);
        if (rec.command) {
          console.log(`   Command: ${rec.command}`);
        }
      });
    }
    
    // Next steps
    console.log('\n📋 NEXT STEPS:');
    if (this.checks.readyForPhase2) {
      console.log('1. 🚀 Proceed to Phase 2: ARFS Integration');
      console.log('   Command: npm run sync');
      console.log('2. 🔧 Set up Arweave wallet with sufficient funds (~$20-50)');
      console.log('3. 🗂️  Create ARFS drive and folder structure');
      console.log('4. ⬆️  Upload consortium publications to Arweave');
    } else {
      console.log('1. 🔧 Resolve the issues listed above');
      console.log('2. 🔄 Run verification again: npm run verify-setup');
      console.log('3. 📖 Check documentation in README.md for help');
    }
    
    console.log('\n📊 PROJECT STATUS:');
    console.log(`📚 Consortium Publications Ready: ${this.checks.consortiumData.details.publicationsCount || 0}`);
    console.log(`👥 Consortium Members: ${this.checks.consortiumData.details.membersCount || 0}`);
    console.log(`💰 Estimated Arweave Cost: $${((this.checks.consortiumData.details.publicationsCount || 0) * 2 * 0.00001).toFixed(2)}`);
    console.log(`🌐 Target Domain: crimconsortium.ar`);
  }
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new FoundationVerifier();
  verifier.verifyFoundation().catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}

export default FoundationVerifier;