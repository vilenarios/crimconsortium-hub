#!/usr/bin/env node

/**
 * Upload Parquet File to Arweave + Update ArNS Undername
 *
 * This script:
 * 1. Uploads metadata.parquet to Arweave using Turbo SDK
 * 2. Automatically updates ArNS undername to point to new TX ID
 * 3. Provides verification URLs
 *
 * Required .env variables:
 * - ARWEAVE_WALLET_PATH: Path to Arweave wallet JWK file
 * - ARNS_ROOT_NAME: Root ArNS name (e.g., "crimrxiv")
 * - ARNS_DATA_UNDERNAME: Data undername (e.g., "data")
 * - ARNS_PROCESS_ID: ANT process ID for the ArNS name
 *
 * Result: {ARNS_DATA_UNDERNAME}_{ARNS_ROOT_NAME} → Parquet TX ID
 * Example: data_crimrxiv → ar://abc123.../metadata.parquet
 *
 * Usage:
 *   npm run upload:parquet
 */

import { TurboFactory, ArweaveSigner } from '@ardrive/turbo-sdk/node';
import { ANT } from '@ar.io/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, '../package.json'), 'utf-8'));
const APP_VERSION = packageJson.version;

const CONFIG = {
  PARQUET_PATH: path.join(__dirname, '../public/data/metadata.parquet'),
  WALLET_PATH: process.env.ARWEAVE_WALLET_PATH,
  ARNS_ROOT_NAME: process.env.ARNS_ROOT_NAME,
  ARNS_DATA_UNDERNAME: process.env.ARNS_DATA_UNDERNAME || 'data',
  ARNS_PROCESS_ID: process.env.ARNS_PROCESS_ID,
};

/**
 * Update ArNS undername to point to new TX ID
 */
async function updateArNSRecord(txId, walletJwk) {
  console.log('\n' + '='.repeat(60));
  console.log('🌐 Updating ArNS Undername');
  console.log('='.repeat(60) + '\n');

  console.log(`📝 Undername: ${CONFIG.ARNS_DATA_UNDERNAME}`);
  console.log(`📝 Root name: ${CONFIG.ARNS_ROOT_NAME}`);
  console.log(`📝 Target TX: ${txId}\n`);

  try {
    // Validate inputs
    if (!CONFIG.ARNS_PROCESS_ID) {
      throw new Error('ARNS_PROCESS_ID is not configured in .env');
    }
    if (!CONFIG.ARNS_DATA_UNDERNAME) {
      throw new Error('ARNS_DATA_UNDERNAME is not configured in .env');
    }
    if (!txId) {
      throw new Error('Transaction ID is missing');
    }

    // Create ArweaveSigner from JWK
    console.log('🔑 Creating ArweaveSigner...');
    const signer = new ArweaveSigner(walletJwk);

    // Initialize ANT with process ID and signer
    console.log('🔧 Initializing ANT...');
    console.log(`   Process ID: ${CONFIG.ARNS_PROCESS_ID}`);
    console.log(`   Signer type: ${signer.constructor.name}`);

    const ant = ANT.init({
      processId: CONFIG.ARNS_PROCESS_ID,
      signer: signer
    });

    console.log(`   ANT initialized: ${typeof ant}`);
    console.log(`   ANT methods: ${Object.keys(ant).join(', ')}`);

    // Set the undername record
    console.log('\n📤 Setting undername record...');

    const recordParams = {
      undername: CONFIG.ARNS_DATA_UNDERNAME,
      transactionId: txId,
      ttlSeconds: 60
    };

    console.log(`   Undername: "${recordParams.undername}" (type: ${typeof recordParams.undername})`);
    console.log(`   TX ID: "${recordParams.transactionId}" (type: ${typeof recordParams.transactionId})`);
    console.log(`   TTL: ${recordParams.ttlSeconds} seconds (type: ${typeof recordParams.ttlSeconds})`);

    // Validate all parameters are defined
    if (!recordParams.undername || recordParams.undername === 'undefined') {
      throw new Error(`Invalid undername: "${recordParams.undername}"`);
    }
    if (!recordParams.transactionId || recordParams.transactionId === 'undefined') {
      throw new Error(`Invalid transactionId: "${recordParams.transactionId}"`);
    }
    if (typeof recordParams.ttlSeconds !== 'number' || recordParams.ttlSeconds <= 0) {
      throw new Error(`Invalid ttlSeconds: ${recordParams.ttlSeconds}`);
    }

    // AR.IO SDK expects an object with undername, transactionId, and ttlSeconds
    const result = await ant.setRecord(recordParams);

    console.log('✅ ArNS record updated!\n');
    console.log('='.repeat(60));
    console.log('🌐 ARNS UPDATE RESULT');
    console.log('='.repeat(60));
    console.log(`Undername: ${CONFIG.ARNS_DATA_UNDERNAME}_${CONFIG.ARNS_ROOT_NAME}`);
    console.log(`Target TX: ${txId}`);
    console.log(`Direct URL: https://${CONFIG.ARNS_DATA_UNDERNAME}_${CONFIG.ARNS_ROOT_NAME}.arweave.net`);
    console.log(`Result:`, result);
    console.log('='.repeat(60) + '\n');

    return result;
  } catch (error) {
    console.error('❌ Failed to update ArNS record:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('\n💡 You can manually update the record later using:');
    console.error(`   ARNS_DATA_UNDERNAME=${CONFIG.ARNS_DATA_UNDERNAME}`);
    console.error(`   TX_ID=${txId}\n`);
    throw error;
  }
}

/**
 * Upload parquet file to Arweave
 */
async function uploadParquet() {
  console.log('\n' + '='.repeat(60));
  console.log('📤 Upload Parquet to Arweave + Update ArNS');
  console.log('='.repeat(60) + '\n');

  // Validate configuration
  const missingVars = [];
  if (!CONFIG.WALLET_PATH) missingVars.push('ARWEAVE_WALLET_PATH');
  if (!CONFIG.ARNS_ROOT_NAME) missingVars.push('ARNS_ROOT_NAME');
  if (!CONFIG.ARNS_PROCESS_ID) missingVars.push('ARNS_PROCESS_ID');

  if (missingVars.length > 0) {
    console.error('❌ Error: Missing required .env variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease add these to your .env file\n');
    process.exit(1);
  }

  // Check if parquet file exists
  try {
    await fs.access(CONFIG.PARQUET_PATH);
  } catch (error) {
    console.error(`❌ Error: Parquet file not found at ${CONFIG.PARQUET_PATH}`);
    console.error('   Run "npm run export" first to generate the parquet file\n');
    process.exit(1);
  }

  try {
    // Get file stats
    const stats = await fs.stat(CONFIG.PARQUET_PATH);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`📦 File: ${path.basename(CONFIG.PARQUET_PATH)}`);
    console.log(`💾 Size: ${sizeMB} MB\n`);

    // Load wallet
    console.log('🔑 Loading Arweave wallet...');
    const walletJson = JSON.parse(await fs.readFile(CONFIG.WALLET_PATH, 'utf-8'));
    const signer = new ArweaveSigner(walletJson);

    // Initialize Turbo
    console.log('🚀 Initializing Turbo SDK...');
    const turbo = TurboFactory.authenticated({ signer });

    // Check balance
    const balance = await turbo.getBalance();
    console.log(`💰 Balance: ${balance.winc} winc\n`);

    // Read file
    console.log('📖 Reading parquet file...');
    const fileBuffer = await fs.readFile(CONFIG.PARQUET_PATH);

    // Upload
    console.log('📤 Uploading to Arweave via Turbo...');
    console.log('   This may take a few minutes...\n');

    const uploadResult = await turbo.uploadFile({
      fileStreamFactory: () => fileBuffer,
      fileSizeFactory: () => stats.size,
      dataItemOpts: {
        tags: [
          { name: 'Content-Type', value: 'application/octet-stream' },
          { name: 'App-Name', value: 'CrimRXiv-Archive' },
          { name: 'App-Version', value: APP_VERSION },
          { name: 'File-Type', value: 'parquet' },
          { name: 'Data-Type', value: 'metadata' },
          { name: 'Description', value: 'CrimRXiv article metadata in Parquet format' }
        ]
      }
    });

    // Verify we got a transaction ID
    if (!uploadResult.id) {
      console.error('❌ Error: No transaction ID returned from upload');
      console.error('Upload result:', JSON.stringify(uploadResult, null, 2));
      throw new Error('No transaction ID returned from upload');
    }

    console.log('✅ Upload successful!\n');
    console.log('='.repeat(60));
    console.log('📊 UPLOAD RESULT');
    console.log('='.repeat(60));
    console.log(`Transaction ID: ${uploadResult.id}`);
    console.log(`Size: ${sizeMB} MB`);
    console.log(`Direct URL: https://arweave.net/${uploadResult.id}`);
    console.log('='.repeat(60) + '\n');

    // Update ArNS record to point to new TX ID
    try {
      await updateArNSRecord(uploadResult.id, walletJson);
    } catch (error) {
      console.warn('⚠️  Warning: Upload succeeded but ArNS update failed');
      console.warn('   You can update the record manually later\n');
    }

    console.log('💡 Next steps:');
    console.log('  1. Wait for confirmation (~2-10 minutes)');
    console.log(`  2. Test direct URL: https://arweave.net/${uploadResult.id}`);
    console.log(`  3. Test ArNS URL: https://${CONFIG.ARNS_DATA_UNDERNAME}_${CONFIG.ARNS_ROOT_NAME}.arweave.net`);
    console.log('  4. Deploy app: npm run deploy\n');

    return uploadResult.id;
  } catch (error) {
    console.error('\n❌ Upload failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && (
  process.argv[1].endsWith('upload-parquet.js') ||
  process.argv[1].endsWith('upload-parquet')
);

if (isRunningDirectly) {
  uploadParquet();
}

export default uploadParquet;
