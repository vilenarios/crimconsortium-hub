#!/usr/bin/env node

/**
 * Foundation Testing Script
 * Tests core components and checks for compatibility issues
 * Designed for CrimRXiv team to verify setup before proceeding
 */

import { Logger, FileHelper, Validator, StateManager } from '../src/lib/utils.js';
import { ExportParser } from '../src/lib/export-parser.js';
import { ARFSClient } from '../src/lib/arfs-client.js';
import fs from 'fs-extra';
import path from 'path';

class FoundationTester {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.validator = new Validator();
    this.results = {
      environment: null,
      dependencies: null,
      exportData: null,
      arfsCompatibility: null,
      overall: 'unknown'
    };
  }

  async runAllTests() {
    this.logger.info('🧪 Running foundation tests...');
    console.log('='.repeat(60));
    
    try {
      // Test 1: Environment validation
      await this.testEnvironment();
      
      // Test 2: Dependency compatibility
      await this.testDependencies();
      
      // Test 3: Export data availability
      await this.testExportData();
      
      // Test 4: ARFS compatibility (careful test)
      await this.testARFSCompatibility();
      
      // Generate final report
      await this.generateReport();
      
    } catch (error) {
      this.logger.error('Foundation test failed', error.message);
      this.results.overall = 'failed';
    }
    
    console.log('='.repeat(60));
    this.printSummary();
  }

  async testEnvironment() {
    this.logger.info('1️⃣ Testing environment configuration...');
    
    try {
      // Check Node.js version
      const nodeVersion = process.version;
      this.logger.info(`Node.js version: ${nodeVersion}`);
      
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      if (majorVersion < 18) {
        this.logger.warning('Node.js version is below recommended (18+)');
      }
      
      // Check environment variables
      const envValid = this.validator.validateEnvironment();
      
      // Check required directories
      const requiredDirs = ['data', 'export', 'src', 'scripts'];
      const missingDirs = [];
      
      for (const dir of requiredDirs) {
        if (!await this.fileHelper.exists(dir)) {
          missingDirs.push(dir);
        }
      }
      
      this.results.environment = {
        nodeVersion,
        envValid,
        missingDirs,
        status: envValid && missingDirs.length === 0 ? 'pass' : 'warning'
      };
      
      if (this.results.environment.status === 'pass') {
        this.logger.success('Environment configuration: PASS');
      } else {
        this.logger.warning('Environment configuration: ISSUES FOUND');
        if (missingDirs.length > 0) {
          console.log(`  Missing directories: ${missingDirs.join(', ')}`);
        }
      }
      
    } catch (error) {
      this.results.environment = { status: 'fail', error: error.message };
      this.logger.error('Environment test failed', error.message);
    }
  }

  async testDependencies() {
    this.logger.info('2️⃣ Testing dependency compatibility...');
    
    const dependencies = [
      { name: 'ardrive-core-js', critical: true },
      { name: 'axios', critical: true },
      { name: 'fs-extra', critical: true },
      { name: 'cheerio', critical: false },
      { name: 'lunr', critical: false },
      { name: 'handlebars', critical: false }
    ];
    
    const results = [];
    
    for (const dep of dependencies) {
      try {
        const module = await import(dep.name);
        results.push({
          name: dep.name,
          status: 'available',
          critical: dep.critical
        });
        this.logger.info(`✅ ${dep.name}: Available`);
        
      } catch (error) {
        results.push({
          name: dep.name,
          status: 'missing',
          critical: dep.critical,
          error: error.message
        });
        
        if (dep.critical) {
          this.logger.error(`❌ ${dep.name}: MISSING (Critical)`);
        } else {
          this.logger.warning(`⚠️ ${dep.name}: Missing (Optional)`);
        }
      }
    }
    
    const criticalMissing = results.filter(r => r.status === 'missing' && r.critical);
    const status = criticalMissing.length === 0 ? 'pass' : 'fail';
    
    this.results.dependencies = { results, status, criticalMissing: criticalMissing.length };
    
    if (status === 'pass') {
      this.logger.success('Dependency check: PASS');
    } else {
      this.logger.error(`Dependency check: FAIL (${criticalMissing.length} critical dependencies missing)`);
    }
  }

  async testExportData() {
    this.logger.info('3️⃣ Testing export data availability...');
    
    try {
      const exportPath = './export/export.json';
      
      // Check if export file exists
      if (!await this.fileHelper.exists(exportPath)) {
        this.results.exportData = {
          status: 'missing',
          message: 'Export file not found',
          path: exportPath
        };
        this.logger.error('Export data: MISSING');
        return;
      }
      
      // Check file size
      const fileSize = await this.fileHelper.getFileSize(exportPath);
      const fileSizeFormatted = this.fileHelper.formatFileSize(fileSize);
      
      this.logger.info(`Export file size: ${fileSizeFormatted}`);
      
      if (fileSize < 1000000) { // Less than 1MB
        this.logger.warning('Export file seems too small');
      }
      
      // Try to parse a small sample
      this.logger.info('Testing JSON parsing...');
      
      // Read first few KB to test JSON validity
      const fd = await fs.open(exportPath, 'r');
      const buffer = Buffer.alloc(1024);
      await fd.read(buffer, 0, 1024, 0);
      await fd.close();
      
      const sample = buffer.toString();
      if (!sample.startsWith('{')) {
        throw new Error('Export file does not appear to be valid JSON');
      }
      
      // Test with ExportParser (limited)
      process.env.DEV_ARTICLE_LIMIT = '5'; // Test with just 5 articles
      const parser = new ExportParser(exportPath);
      
      this.logger.info('Testing export parser with 5 articles...');
      await parser.loadExportFile();
      
      const totalPubs = parser.rawData.pubs?.length || 0;
      
      this.results.exportData = {
        status: 'pass',
        fileSize,
        fileSizeFormatted,
        totalPubs,
        validJson: true
      };
      
      this.logger.success(`Export data: PASS (${totalPubs} articles found)`);
      
      // Reset environment
      delete process.env.DEV_ARTICLE_LIMIT;
      
    } catch (error) {
      this.results.exportData = {
        status: 'fail',
        error: error.message
      };
      this.logger.error('Export data test failed', error.message);
    }
  }

  async testARFSCompatibility() {
    this.logger.info('4️⃣ Testing ARFS compatibility...');
    
    try {
      // Check if wallet path is configured
      const walletPath = process.env.ARWEAVE_WALLET_PATH;
      
      if (!walletPath) {
        this.results.arfsCompatibility = {
          status: 'skip',
          message: 'Wallet path not configured (safe to skip for now)',
          canProceed: true
        };
        this.logger.warning('ARFS test: SKIPPED (No wallet configured)');
        return;
      }
      
      // Check if wallet file exists
      if (!await this.fileHelper.exists(walletPath)) {
        this.results.arfsCompatibility = {
          status: 'warning',
          message: 'Wallet file not found',
          canProceed: false
        };
        this.logger.warning('ARFS test: Wallet file not found');
        return;
      }
      
      this.logger.info('Testing ARFS client initialization (no network calls)...');
      
      // Test basic ARFS client creation (without network calls)
      const arfsClient = new ARFSClient(walletPath);
      
      // Test if we can read the wallet file
      const walletValid = this.validator.validateWalletPath(walletPath);
      
      if (!walletValid) {
        this.results.arfsCompatibility = {
          status: 'fail',
          message: 'Invalid wallet file',
          canProceed: false
        };
        this.logger.error('ARFS test: Invalid wallet file');
        return;
      }
      
      // Test ardrive-core-js import
      try {
        const { readJWKFile } = await import('ardrive-core-js');
        const wallet = readJWKFile(walletPath);
        
        if (!wallet || !wallet.kty) {
          throw new Error('Wallet file format invalid');
        }
        
        this.results.arfsCompatibility = {
          status: 'pass',
          message: 'ARFS client can be initialized',
          canProceed: true,
          walletValid: true
        };
        
        this.logger.success('ARFS compatibility: PASS');
        
      } catch (error) {
        if (error.message.includes('not web compatible')) {
          this.results.arfsCompatibility = {
            status: 'warning',
            message: 'ardrive-core-js may have web compatibility issues',
            canProceed: true,
            needsAlternative: true,
            error: error.message
          };
          this.logger.warning('ARFS compatibility: Web compatibility warning detected');
        } else {
          throw error;
        }
      }
      
    } catch (error) {
      this.results.arfsCompatibility = {
        status: 'fail',
        message: 'ARFS compatibility test failed',
        error: error.message,
        canProceed: false
      };
      this.logger.error('ARFS compatibility test failed', error.message);
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      results: this.results,
      recommendations: this.generateRecommendations()
    };
    
    // Save report
    await this.fileHelper.ensureDir('./data');
    await this.fileHelper.writeJSON('./data/foundation-test-report.json', report);
    
    this.logger.info('📊 Test report saved to: ./data/foundation-test-report.json');
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Environment recommendations
    if (this.results.environment?.status !== 'pass') {
      if (this.results.environment?.missingDirs?.length > 0) {
        recommendations.push({
          type: 'environment',
          priority: 'high',
          message: 'Create missing directories',
          action: `mkdir -p ${this.results.environment.missingDirs.join(' ')}`
        });
      }
      
      if (!this.results.environment?.envValid) {
        recommendations.push({
          type: 'environment',
          priority: 'high',
          message: 'Configure environment variables',
          action: 'Copy .env.example to .env and configure wallet path'
        });
      }
    }
    
    // Dependency recommendations
    if (this.results.dependencies?.criticalMissing > 0) {
      recommendations.push({
        type: 'dependencies',
        priority: 'high',
        message: 'Install missing critical dependencies',
        action: 'npm install'
      });
    }
    
    // Export data recommendations
    if (this.results.exportData?.status === 'missing') {
      recommendations.push({
        type: 'data',
        priority: 'high',
        message: 'Export data not found',
        action: 'Ensure CrimRXiv export.json is placed in ./export/ directory'
      });
    }
    
    // ARFS recommendations
    if (this.results.arfsCompatibility?.needsAlternative) {
      recommendations.push({
        type: 'arfs',
        priority: 'medium',
        message: 'Consider alternative approach for web compatibility',
        action: 'May need to use Turbo SDK directly or find web-compatible alternative'
      });
    }
    
    if (this.results.arfsCompatibility?.status === 'fail') {
      recommendations.push({
        type: 'arfs',
        priority: 'high',
        message: 'Fix ARFS configuration before proceeding to upload phase',
        action: 'Check wallet configuration and ardrive-core-js compatibility'
      });
    }
    
    return recommendations;
  }

  printSummary() {
    this.logger.info('📋 Foundation Test Summary');
    console.log('');
    
    // Overall status
    const allPassed = Object.values(this.results).every(result => 
      !result || result.status === 'pass' || result.status === 'skip'
    );
    
    const hasWarnings = Object.values(this.results).some(result => 
      result && result.status === 'warning'
    );
    
    const hasFailed = Object.values(this.results).some(result => 
      result && result.status === 'fail'
    );
    
    if (allPassed && !hasWarnings) {
      this.results.overall = 'pass';
      console.log('🎉 Overall Status: ALL TESTS PASSED');
      console.log('✅ Ready to proceed with Phase 2 (Data Processing)');
    } else if (!hasFailed) {
      this.results.overall = 'warning';
      console.log('⚠️  Overall Status: WARNINGS DETECTED');
      console.log('🔄 Can proceed with caution - some features may need attention');
    } else {
      this.results.overall = 'fail';
      console.log('❌ Overall Status: CRITICAL ISSUES FOUND');
      console.log('🛑 Must resolve issues before proceeding');
    }
    
    console.log('');
    
    // Individual test results
    const tests = [
      { name: 'Environment', result: this.results.environment },
      { name: 'Dependencies', result: this.results.dependencies },
      { name: 'Export Data', result: this.results.exportData },
      { name: 'ARFS Compatibility', result: this.results.arfsCompatibility }
    ];
    
    tests.forEach(test => {
      const status = test.result?.status || 'unknown';
      const icon = {
        'pass': '✅',
        'warning': '⚠️',
        'fail': '❌',
        'skip': '⏭️',
        'unknown': '❓'
      }[status];
      
      console.log(`${icon} ${test.name}: ${status.toUpperCase()}`);
      
      if (test.result?.message) {
        console.log(`   ${test.result.message}`);
      }
    });
    
    // Recommendations
    const recommendations = this.generateRecommendations();
    if (recommendations.length > 0) {
      console.log('');
      console.log('🔧 Recommendations:');
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
        console.log(`   Action: ${rec.action}`);
      });
    }
    
    console.log('');
    console.log('📄 Detailed report saved to: ./data/foundation-test-report.json');
  }
}

// Run tests if script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new FoundationTester();
  tester.runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export default FoundationTester;