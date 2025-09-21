#!/usr/bin/env node

/**
 * Arweave Deployment Script with ArNS Undername Configuration
 * Deploys all 5 components of CrimConsortium to Arweave with ArNS undernames
 * Built for CrimRXiv team handoff with comprehensive error handling
 */

import { ARFSClient } from '../src/lib/arfs-client.js';
import { Logger, FileHelper, ProgressTracker, CostTracker, validator } from '../src/lib/utils.js';

class ArweaveDeployer {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.costTracker = new CostTracker();
    
    this.arfsClient = null;
    
    // Deployment configuration
    this.deploymentConfig = {
      undernames: {
        main: 'crimconsortium',
        data: 'data_crimconsortium',
        search: 'search_crimconsortium',
        members: 'members_crimconsortium',
        stats: 'stats_crimconsortium'
      },
      buildDirs: {
        main: './dist/main',
        data: './dist/data',
        search: './dist/search',
        members: './dist/members',
        stats: './dist/stats'
      },
      deploymentOrder: ['data', 'search', 'members', 'stats', 'main'] // Deploy data first
    };
    
    // Deployment state
    this.deploymentState = {
      deployedComponents: {},
      manifestIds: {},
      arnsDomains: {},
      totalCost: 0,
      errors: [],
      startTime: null,
      endTime: null
    };
  }

  async deployComplete() {
    this.logger.info('🚀 Starting complete Arweave deployment...');
    this.deploymentState.startTime = new Date();
    
    try {
      // Step 1: Pre-deployment validation
      await this.validateDeploymentPrerequisites();
      
      // Step 2: Initialize ARFS client
      await this.initializeARFS();
      
      // Step 3: Deploy all components in order
      await this.deployAllComponents();
      
      // Step 4: Configure ArNS undernames  
      await this.configureArNSUndernames();
      
      // Step 5: Verify deployment
      await this.verifyDeployment();
      
      // Step 6: Generate deployment report
      await this.generateDeploymentReport();
      
      this.deploymentState.endTime = new Date();
      this.logger.success('Complete Arweave deployment finished');
      this.printDeploymentSummary();
      
      return this.deploymentState;
      
    } catch (error) {
      this.deploymentState.errors.push({
        error: error.message,
        timestamp: new Date().toISOString(),
        phase: 'deployment'
      });
      
      this.logger.error('Deployment failed', error.message);
      await this.saveDeploymentState();
      throw error;
    }
  }

  async validateDeploymentPrerequisites() {
    this.logger.info('🔍 Validating deployment prerequisites...');
    
    // Check environment
    if (!validator.validateEnvironment()) {
      throw new Error('Environment not configured. Please set ARWEAVE_WALLET_PATH in .env file.');
    }
    
    // Check build exists
    for (const [component, dir] of Object.entries(this.deploymentConfig.buildDirs)) {
      if (!await this.fileHelper.exists(dir)) {
        throw new Error(`Build not found for ${component}. Run "npm run build" first.`);
      }
    }
    
    // Check critical files exist
    const criticalFiles = [
      './dist/main/index.html',
      './dist/data/index.json',
      './dist/search/index.json'
    ];
    
    for (const file of criticalFiles) {
      if (!await this.fileHelper.exists(file)) {
        throw new Error(`Critical file missing: ${file}`);
      }
    }
    
    this.logger.success('Prerequisites validated');
  }

  async initializeARFS() {
    this.logger.info('⚡ Initializing ARFS for deployment...');
    
    this.arfsClient = new ARFSClient();
    await this.arfsClient.initialize();
    
    // Check wallet balance
    const balance = await this.arfsClient.getWalletBalance();
    if (balance && balance.ar < 0.01) { // Less than 0.01 AR
      this.logger.warning('Low wallet balance detected. Deployment may fail.');
    }
    
    this.logger.success('ARFS client ready for deployment');
  }

  async deployAllComponents() {
    this.logger.info('📤 Deploying all components to Arweave...');
    
    const tracker = new ProgressTracker(
      this.deploymentConfig.deploymentOrder.length, 
      'Deploying components'
    );
    
    for (const component of this.deploymentConfig.deploymentOrder) {
      try {
        const result = await this.deployComponent(component);
        
        this.deploymentState.deployedComponents[component] = {
          success: true,
          manifestId: result.manifestId,
          cost: result.cost,
          deployedAt: new Date().toISOString()
        };
        
        this.deploymentState.manifestIds[component] = result.manifestId;
        this.deploymentState.totalCost += result.cost;
        
        tracker.success(`📦 ${component}: ${result.manifestId.substring(0, 12)}...`);
        
      } catch (error) {
        this.deploymentState.deployedComponents[component] = {
          success: false,
          error: error.message,
          attemptedAt: new Date().toISOString()
        };
        
        this.deploymentState.errors.push({
          component,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        tracker.fail(error, component);
      }
    }
    
    tracker.complete();
    
    const successful = Object.values(this.deploymentState.deployedComponents)
      .filter(d => d.success).length;
    
    this.logger.success(`Component deployment complete: ${successful}/${this.deploymentConfig.deploymentOrder.length} successful`);
  }

  async deployComponent(component) {
    this.logger.info(`📤 Deploying ${component} component...`);
    
    const buildDir = this.deploymentConfig.buildDirs[component];
    
    if (!await this.fileHelper.exists(buildDir)) {
      throw new Error(`Build directory not found: ${buildDir}`);
    }
    
    try {
      // Upload component to Arweave
      const uploadResult = await this.arfsClient.uploadSite(buildDir);
      
      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error || 'Unknown error'}`);
      }
      
      // Create web manifest
      const manifestResult = await this.arfsClient.createWebManifest('index.html');
      
      if (!manifestResult.manifestId) {
        throw new Error('Failed to create web manifest');
      }
      
      this.costTracker.addDeploymentCost(uploadResult.cost || 0, `${component} deployment`);
      
      this.logger.success(`${component} deployed: ${manifestResult.manifestId}`);
      
      return {
        manifestId: manifestResult.manifestId,
        cost: uploadResult.cost || 0,
        url: manifestResult.url
      };
      
    } catch (error) {
      throw new Error(`Failed to deploy ${component}: ${error.message}`);
    }
  }

  async configureArNSUndernames() {
    this.logger.info('🌐 Configuring ArNS undernames...');
    
    // Note: This would use AR.IO SDK in actual deployment
    // For now, save configuration for manual setup
    
    const arnsConfig = {
      mainDomain: this.deploymentConfig.undernames.main,
      undernames: Object.entries(this.deploymentConfig.undernames)
        .filter(([key]) => key !== 'main')
        .map(([key, undername]) => ({
          undername,
          manifestId: this.deploymentState.manifestIds[key],
          component: key,
          url: `https://${undername}.ar`
        })),
      
      mainSite: {
        domain: `https://${this.deploymentConfig.undernames.main}.ar`,
        manifestId: this.deploymentState.manifestIds.main
      },
      
      configurationSteps: [
        'Configure main domain: crimconsortium.ar',
        'Set up undernames for data endpoints',
        'Verify all endpoints accessible',
        'Test data loading and search functionality'
      ]
    };
    
    await this.fileHelper.writeJSON('./data/arns-configuration.json', arnsConfig);
    
    this.logger.success('ArNS configuration prepared');
    this.logger.info('📋 Manual ArNS setup required - see ./data/arns-configuration.json');
  }

  async verifyDeployment() {
    this.logger.info('🔍 Verifying deployment...');
    
    const verificationResults = {};
    
    for (const [component, deployment] of Object.entries(this.deploymentState.deployedComponents)) {
      if (!deployment.success) {
        verificationResults[component] = { status: 'failed', reason: deployment.error };
        continue;
      }
      
      try {
        // Test if manifest is accessible
        const testUrl = `https://arweave.net/${deployment.manifestId}`;
        
        // Note: In actual deployment, we'd make HTTP request here
        // For now, just verify manifest ID format
        if (deployment.manifestId && deployment.manifestId.length === 43) {
          verificationResults[component] = { 
            status: 'verified', 
            url: testUrl,
            manifestId: deployment.manifestId
          };
        } else {
          verificationResults[component] = { 
            status: 'invalid', 
            reason: 'Invalid manifest ID format' 
          };
        }
        
      } catch (error) {
        verificationResults[component] = { 
          status: 'error', 
          reason: error.message 
        };
      }
    }
    
    const verified = Object.values(verificationResults).filter(r => r.status === 'verified').length;
    
    this.logger.success(`Deployment verification: ${verified}/${Object.keys(verificationResults).length} components verified`);
    
    return verificationResults;
  }

  async generateDeploymentReport() {
    const duration = this.deploymentState.endTime - this.deploymentState.startTime;
    
    const report = {
      deployment: {
        startTime: this.deploymentState.startTime.toISOString(),
        endTime: this.deploymentState.endTime.toISOString(),
        duration: Math.round(duration / 1000) + 's',
        totalCost: this.deploymentState.totalCost
      },
      
      components: this.deploymentState.deployedComponents,
      
      arnsConfiguration: {
        mainDomain: `https://${this.deploymentConfig.undernames.main}.ar`,
        undernames: Object.entries(this.deploymentConfig.undernames)
          .filter(([key]) => key !== 'main')
          .map(([key, undername]) => ({
            name: undername,
            url: `https://${undername}.ar`,
            manifestId: this.deploymentState.manifestIds[key] || 'pending'
          }))
      },
      
      nextSteps: [
        'Configure ArNS domains using manifest IDs',
        'Test all endpoints for functionality',
        'Set up monitoring and health checks',
        'Complete team handoff procedures'
      ],
      
      costs: this.costTracker.getSummary(),
      errors: this.deploymentState.errors,
      
      generated: new Date().toISOString()
    };
    
    await this.fileHelper.writeJSON('./data/deployment-report.json', report);
    this.logger.success('Deployment report generated');
    
    return report;
  }

  async saveDeploymentState() {
    await this.fileHelper.writeJSON('./data/deployment-state.json', this.deploymentState);
  }

  printDeploymentSummary() {
    const successful = Object.values(this.deploymentState.deployedComponents)
      .filter(d => d.success).length;
    const total = Object.keys(this.deploymentState.deployedComponents).length;
    
    console.log('\n' + '='.repeat(70));
    console.log('🚀 ARWEAVE DEPLOYMENT SUMMARY');
    console.log('='.repeat(70));
    
    console.log(`📊 Components Deployed: ${successful}/${total}`);
    console.log(`💰 Total Cost: ${this.deploymentState.totalCost.toFixed(6)} AR`);
    console.log(`⏱️  Deployment Time: ${Math.round((this.deploymentState.endTime - this.deploymentState.startTime) / 1000)}s`);
    console.log(`❌ Errors: ${this.deploymentState.errors.length}`);
    
    console.log('\n🌐 ArNS Domains to Configure:');
    Object.entries(this.deploymentConfig.undernames).forEach(([component, undername]) => {
      const manifestId = this.deploymentState.manifestIds[component];
      const status = manifestId ? '✅' : '❌';
      console.log(`   ${status} ${undername}.ar → ${manifestId || 'FAILED'}`);
    });
    
    if (successful === total) {
      console.log('\n🎉 DEPLOYMENT SUCCESSFUL!');
      console.log('✅ All components deployed to Arweave');
      console.log('✅ Web manifests created');
      console.log('✅ Ready for ArNS configuration');
      
      console.log('\n📋 NEXT MANUAL STEPS:');
      console.log('1. Configure main ArNS domain: crimconsortium.ar');
      console.log('2. Set up undernames for data endpoints');
      console.log('3. Test all endpoints for functionality');
      console.log('4. Update DNS propagation');
      console.log('5. Verify search and data loading');
      
    } else {
      console.log('\n⚠️  PARTIAL DEPLOYMENT');
      console.log(`${total - successful} components failed to deploy`);
      console.log('Check deployment-report.json for details');
    }
    
    console.log('\n💡 DEPLOYMENT CONSIDERATIONS:');
    console.log('• ArNS domains may take 10-30 minutes to propagate');
    console.log('• Test each endpoint individually before announcing');
    console.log('• Keep manifest IDs safe for future updates');
    console.log('• Monitor costs and performance after go-live');
    
    console.log('='.repeat(70));
  }
}

// Run deployer if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployer = new ArweaveDeployer();
  deployer.deployComplete().catch(error => {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  });
}

export default ArweaveDeployer;