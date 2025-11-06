#!/usr/bin/env node

/**
 * CrimRXiv Archive - Simple Production Deployment
 *
 * This script:
 * 1. Builds the production app
 * 2. Uploads dist/ folder to Arweave using Turbo SDK
 * 3. Updates ArNS root name to point to the new deployment
 *
 * Requirements:
 * - .env with ARWEAVE_WALLET_PATH (JWK wallet file)
 * - .env with ARNS_PROCESS_ID (your ArNS name's process ID)
 *
 * Usage:
 *   npm run deploy
 */

import 'dotenv/config';
import { TurboFactory } from '@ardrive/turbo-sdk';
import { IO } from '@ar.io/sdk';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Deployer {
  constructor() {
    this.distPath = path.join(__dirname, '../dist');
    this.walletPath = process.env.ARWEAVE_WALLET_PATH;
    this.arnsProcessId = process.env.ARNS_PROCESS_ID;

    if (!this.walletPath) {
      throw new Error('ARWEAVE_WALLET_PATH not set in .env file');
    }

    if (!this.arnsProcessId) {
      console.warn('⚠️  ARNS_PROCESS_ID not set - ArNS update will be skipped');
    }
  }

  /**
   * Step 1: Build production app
   */
  async buildProduction() {
    console.log('\n' + '='.repeat(70));
    console.log('📦 STEP 1: Building Production App');
    console.log('='.repeat(70) + '\n');

    try {
      console.log('Running: npm run build\n');
      execSync('npm run build', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      console.log('\n✅ Build complete!\n');
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      throw error;
    }
  }

  /**
   * Step 2: Upload dist/ folder to Arweave using Turbo SDK
   */
  async uploadToArweave() {
    console.log('='.repeat(70));
    console.log('📤 STEP 2: Uploading to Arweave via Turbo');
    console.log('='.repeat(70) + '\n');

    try {
      // Load wallet
      console.log(`Loading wallet from: ${this.walletPath}`);
      const jwk = JSON.parse(readFileSync(this.walletPath, 'utf-8'));

      // Initialize Turbo client
      console.log('Initializing Turbo client...');
      const turbo = TurboFactory.authenticated({ privateKey: jwk });

      // Get balance
      const balance = await turbo.getBalance();
      console.log(`Wallet balance: ${balance.winc} winc (${balance.winc / 1e12} AR)\n`);

      // Upload folder
      console.log(`Uploading folder: ${this.distPath}`);
      console.log('This may take several minutes...\n');

      const uploadResult = await turbo.uploadFolder({
        folderPath: this.distPath,
        dataItemOpts: {
          tags: [
            { name: 'App-Name', value: 'CrimRXiv-Archive' },
            { name: 'App-Version', value: '2.0' },
            { name: 'Content-Type', value: 'application/x.arweave-manifest+json' },
            { name: 'Type', value: 'web-app' }
          ]
        }
      });

      console.log('\n✅ Upload complete!');
      console.log(`📍 Manifest ID: ${uploadResult.manifestId}`);
      console.log(`🔗 Gateway URL: https://arweave.net/${uploadResult.manifestId}`);
      console.log(`📊 Files uploaded: ${uploadResult.fileResponses?.length || 'N/A'}\n`);

      return uploadResult.manifestId;

    } catch (error) {
      console.error('❌ Upload failed:', error.message);
      throw error;
    }
  }

  /**
   * Step 3: Update ArNS to point to new deployment
   */
  async updateArNS(manifestId) {
    if (!this.arnsProcessId) {
      console.log('='.repeat(70));
      console.log('⏭️  STEP 3: ArNS Update Skipped');
      console.log('='.repeat(70) + '\n');
      console.log('To enable automatic ArNS updates:');
      console.log('1. Add ARNS_PROCESS_ID to your .env file');
      console.log('2. Run this script again\n');
      return;
    }

    console.log('='.repeat(70));
    console.log('🔗 STEP 3: Updating ArNS Record');
    console.log('='.repeat(70) + '\n');

    try {
      // Load wallet
      const jwk = JSON.parse(readFileSync(this.walletPath, 'utf-8'));

      // Initialize IO client
      console.log('Initializing AR.IO SDK...');
      const io = IO.init({
        signer: jwk
      });

      console.log(`ArNS Process ID: ${this.arnsProcessId}`);
      console.log(`New Target ID: ${manifestId}`);
      console.log('Updating ArNS record...\n');

      // Update the ArNS record to point to new manifest
      const result = await io.setRecord({
        processId: this.arnsProcessId,
        transactionId: manifestId,
        ttlSeconds: 3600 // 1 hour TTL
      });

      console.log('✅ ArNS update transaction submitted!');
      console.log(`📍 Update TX: ${result.id}`);
      console.log('⏱️  Changes will propagate within ~5-10 minutes\n');

      return result.id;

    } catch (error) {
      console.error('❌ ArNS update failed:', error.message);
      console.log('\n💡 You can manually update ArNS:');
      console.log(`   1. Go to ar.io name management`);
      console.log(`   2. Update your name to point to: ${manifestId}\n`);
      throw error;
    }
  }

  /**
   * Run complete deployment
   */
  async deploy() {
    console.log('\n' + '🚀'.repeat(35));
    console.log('  CrimRXiv Archive - Production Deployment');
    console.log('🚀'.repeat(35) + '\n');

    const startTime = Date.now();

    try {
      // Step 1: Build
      await this.buildProduction();

      // Step 2: Upload
      const manifestId = await this.uploadToArweave();

      // Step 3: Update ArNS
      let arnsUpdateId = null;
      try {
        arnsUpdateId = await this.updateArNS(manifestId);
      } catch (error) {
        console.warn('⚠️  ArNS update failed but deployment succeeded');
      }

      // Success summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('\n' + '='.repeat(70));
      console.log('🎉 DEPLOYMENT COMPLETE!');
      console.log('='.repeat(70) + '\n');

      console.log('📋 Deployment Summary:');
      console.log(`   ⏱️  Duration: ${duration}s`);
      console.log(`   📍 Manifest ID: ${manifestId}`);
      if (arnsUpdateId) {
        console.log(`   🔗 ArNS Update TX: ${arnsUpdateId}`);
      }
      console.log('');

      console.log('🌐 Access URLs:');
      console.log(`   Gateway: https://arweave.net/${manifestId}`);
      if (this.arnsProcessId) {
        console.log(`   ArNS: (will update within 5-10 minutes)`);
      }
      console.log('');

      console.log('💡 Next Steps:');
      console.log('   1. Wait 5-10 minutes for ArNS propagation');
      console.log('   2. Test your site at the gateway URL');
      console.log('   3. Verify ArNS name points to new deployment');
      console.log('   4. Check that all resources load correctly');
      console.log('');

      console.log('✨ Your archive is now permanently deployed!\n');

    } catch (error) {
      console.error('\n' + '='.repeat(70));
      console.error('❌ DEPLOYMENT FAILED');
      console.error('='.repeat(70));
      console.error(`\nError: ${error.message}\n`);
      process.exit(1);
    }
  }
}

// Run deployment
const deployer = new Deployer();
deployer.deploy().catch(error => {
  console.error('Deployment error:', error);
  process.exit(1);
});
