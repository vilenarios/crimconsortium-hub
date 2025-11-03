#!/usr/bin/env node

/**
 * Upload Parquet File to Arweave
 *
 * Uploads the metadata.parquet file from data/export/ to Arweave
 * using Turbo SDK for fast, reliable uploads.
 *
 * After upload:
 * 1. Save the transaction ID to .env (PARQUET_TX_ID)
 * 2. Configure ArNS undername: data_crimrxiv.arweave.net → TX_ID
 *
 * Usage:
 *   npm run upload:parquet
 */

import { TurboFactory, ArweaveSigner } from '@ardrive/turbo-sdk/node';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  PARQUET_PATH: path.join(__dirname, '../data/export/metadata.parquet'),
  WALLET_PATH: process.env.ARWEAVE_WALLET_PATH,
};

/**
 * Upload parquet file to Arweave
 */
async function uploadParquet() {
  console.log('\n' + '='.repeat(60));
  console.log('📤 Upload Parquet to Arweave');
  console.log('='.repeat(60) + '\n');

  // Validate wallet path
  if (!CONFIG.WALLET_PATH) {
    console.error('❌ Error: ARWEAVE_WALLET_PATH not set in .env');
    console.error('   Please add your Arweave wallet path to .env\n');
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
          { name: 'App-Version', value: '1.0.0' },
          { name: 'File-Type', value: 'parquet' },
          { name: 'Data-Type', value: 'metadata' },
          { name: 'Description', value: 'CrimRXiv article metadata in Parquet format' }
        ]
      }
    });

    console.log('✅ Upload successful!\n');
    console.log('='.repeat(60));
    console.log('📊 UPLOAD RESULT');
    console.log('='.repeat(60));
    console.log(`Transaction ID: ${uploadResult.id}`);
    console.log(`Size: ${sizeMB} MB`);
    console.log(`URL: https://arweave.net/${uploadResult.id}`);
    console.log('='.repeat(60) + '\n');

    console.log('💡 Next steps:');
    console.log(`  1. Add to .env:  PARQUET_TX_ID=${uploadResult.id}`);
    console.log(`  2. Configure ArNS undername: data_crimrxiv.arweave.net → ${uploadResult.id}`);
    console.log('  3. Wait for confirmation (~2-10 minutes)');
    console.log('  4. Test URL: https://arweave.net/' + uploadResult.id);
    console.log('  5. Update src/config/arweave.js with production URL\n');

    return uploadResult.id;
  } catch (error) {
    console.error('\n❌ Upload failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  uploadParquet();
}

export default uploadParquet;
