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
 * Optional:
 * - .env with ARNS_ROOT_NAME (default: 'crimrxiv-demo')
 * - .env with ARNS_TTL_SECONDS (default: 60 - cache duration in seconds)
 * - .env with BUNDLE_RESOURCES=true (bundle WASM+data instead of loading externally)
 *
 * Usage:
 *   npm run deploy                    # Load WASM/data from external ArNS
 *   BUNDLE_RESOURCES=true npm run deploy  # Self-contained (bundle everything)
 */

import 'dotenv/config';
import { TurboFactory, ArweaveSigner } from '@ardrive/turbo-sdk/node';
import { ANT } from '@ar.io/sdk';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
const APP_VERSION = packageJson.version;

class Deployer {
  constructor() {
    this.distPath = path.join(__dirname, '../dist');
    this.walletPath = process.env.ARWEAVE_WALLET_PATH;
    this.arnsProcessId = process.env.ARNS_PROCESS_ID;
    this.arnsRootName = process.env.ARNS_ROOT_NAME || 'crimrxiv-demo';
    this.arnsTtlSeconds = parseInt(process.env.ARNS_TTL_SECONDS || '60', 10);

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
      // Check if we should bundle resources or load externally
      const bundleResources = process.env.BUNDLE_RESOURCES === 'true';

      if (bundleResources) {
        console.log('Running: npm run build (includes WASM + data for self-contained deployment)\n');
        execSync('npm run build', {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..')
        });
      } else {
        console.log('Running: npm run build:prod (excludes external resources)\n');
        execSync('npm run build:prod', {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..')
        });
      }
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
            { name: 'App-Version', value: APP_VERSION },
            { name: 'Type', value: 'web-app' }
            // Content-Type auto-detected by SDK for each file type (CSS, JS, HTML, etc.)
          ]
        }
      });

      // Debug: Show upload result structure
      console.log('\n📋 Debug - Upload Result Keys:', Object.keys(uploadResult));
      if (uploadResult.manifestResponse) {
        console.log('📋 Debug - Manifest Response Keys:', Object.keys(uploadResult.manifestResponse));
        console.log('📋 Debug - Manifest ID:', uploadResult.manifestResponse.id);
      }

      // Extract manifest ID from manifestResponse
      const manifestId = uploadResult.manifestResponse?.id;

      if (!manifestId) {
        console.error('❌ No manifest ID returned');
        console.error('Full upload result:', JSON.stringify(uploadResult, null, 2));
        throw new Error('No manifest TX ID returned from upload');
      }

      console.log('\n✅ Upload complete!');
      console.log(`📍 Manifest ID: ${manifestId}`);
      console.log(`🔗 Gateway URL: https://arweave.net/${manifestId}`);
      console.log(`🔗 Test index: https://arweave.net/${manifestId}/index.html`);
      console.log(`📊 Files uploaded: ${uploadResult.fileResponses?.length || 'N/A'}`);

      // Wait a moment for Turbo to settle
      console.log(`\n⏳ Waiting 5 seconds for Turbo upload to settle...`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify manifest structure
      console.log(`\n🔍 Verifying manifest and files...`);
      try {
        const manifestResponse = await fetch(`https://arweave.net/raw/${manifestId}`);
        const manifestData = await manifestResponse.json();

        console.log('📋 Manifest type:', manifestData.manifest);
        console.log('📋 Manifest version:', manifestData.version);
        console.log('📋 Has index:', !!manifestData.index);
        console.log('📋 Index path:', manifestData.index?.path);
        console.log('📋 Total paths:', Object.keys(manifestData.paths || {}).length);

        if (!manifestData.index || !manifestData.index.path) {
          console.warn('⚠️  WARNING: Manifest missing index field! This may cause issues.');
        }

        // Verify index.html is accessible
        if (manifestData.index?.path && manifestData.paths[manifestData.index.path]) {
          const indexTxId = manifestData.paths[manifestData.index.path].id;
          console.log(`\n🔍 Verifying index.html (${indexTxId})...`);

          const indexResponse = await fetch(`https://arweave.net/${indexTxId}`);
          const indexContent = await indexResponse.text();

          if (indexContent.includes('<!DOCTYPE html>') && !indexContent.includes('302 Redirect')) {
            console.log('✅ Index.html is accessible and valid');
          } else {
            console.error('❌ Index.html returned unexpected content (might be 302 redirect)');
            console.error('   This usually means files are not yet available on Arweave');
            console.error('   Wait a few minutes and check the gateway URL manually');
          }
        }
      } catch (error) {
        console.warn('⚠️  Could not verify manifest:', error.message);
        console.warn('   Files might not be available yet. Check manually after a few minutes.');
      }

      console.log(`\n⚠️  IMPORTANT: Test the gateway URL above before it propagates to ArNS!\n`);

      return manifestId;

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

      // Create ArweaveSigner from JWK
      console.log('Creating ArweaveSigner...');
      const signer = new ArweaveSigner(jwk);

      // Initialize ANT with process ID and signer
      console.log('Initializing ANT...');
      const ant = ANT.init({
        processId: this.arnsProcessId,
        signer: signer
      });

      console.log(`ArNS Name: ${this.arnsRootName}`);
      console.log(`ArNS Process ID: ${this.arnsProcessId}`);
      console.log(`New Target ID: ${manifestId}`);
      console.log(`TTL: ${this.arnsTtlSeconds} seconds (${Math.round(this.arnsTtlSeconds / 60)} minutes)`);
      console.log('Updating ArNS root record (@)...\n');

      // Update the root ArNS record (undername '@') to point to new manifest
      const result = await ant.setRecord({
        undername: '@',           // Root record (no subdomain)
        transactionId: manifestId,
        ttlSeconds: this.arnsTtlSeconds
      });

      console.log('✅ ArNS update transaction submitted!');
      console.log(`📍 Result:`, result);
      console.log(`⏱️  Cache TTL: ${this.arnsTtlSeconds}s - Changes propagate in ~5-10 minutes\n`);

      return result;

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
        console.log(`   🔗 ArNS Update: Success`);
      }
      console.log('');

      console.log('🌐 Access URLs:');
      console.log(`   Gateway (immediate): https://arweave.net/${manifestId}`);
      if (this.arnsProcessId) {
        console.log(`   ArNS (5-10 min):     https://${this.arnsRootName}.ar.io`);
        console.log(`                        https://${this.arnsRootName}.arweave.net`);
      }
      console.log('');

      console.log('💡 Next Steps:');
      console.log(`   1. Test immediately at: https://arweave.net/${manifestId}`);
      console.log('   2. Wait 5-10 minutes for ArNS propagation');
      console.log(`   3. Verify ArNS works: https://${this.arnsRootName}.ar.io`);
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
