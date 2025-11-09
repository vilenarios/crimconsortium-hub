#!/usr/bin/env node

/**
 * Upload DuckDB WASM Folder to Arweave
 *
 * Uploads the entire public/duckdb/ folder as a manifest.
 * Returns a single TX ID that can be used for ArNS configuration.
 *
 * Files included:
 * - duckdb-mvp.wasm (~7MB)
 * - duckdb-browser-mvp.worker.js
 * - duckdb-eh.wasm (~7MB)
 * - duckdb-browser-eh.worker.js
 * - HOW-TO.md (usage guide)
 *
 * Result: 1 manifest TX ID
 *
 * Usage:
 *   npm run upload:wasm
 */

import { TurboFactory, ArweaveSigner } from '@ardrive/turbo-sdk/node';
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
  WASM_DIR: path.join(__dirname, '../public/duckdb'),
  WALLET_PATH: process.env.ARWEAVE_WALLET_PATH,
};

/**
 * Upload WASM folder to Arweave
 */
async function uploadWasm() {
  console.log('\n' + '='.repeat(60));
  console.log('📤 Upload DuckDB WASM Folder to Arweave');
  console.log('='.repeat(60) + '\n');

  // Validate wallet path
  if (!CONFIG.WALLET_PATH) {
    console.error('❌ Error: ARWEAVE_WALLET_PATH not set in .env');
    console.error('   Please add your Arweave wallet path to .env\n');
    process.exit(1);
  }

  // Check if WASM directory exists
  try {
    await fs.access(CONFIG.WASM_DIR);
  } catch (error) {
    console.error(`❌ Error: WASM directory not found at ${CONFIG.WASM_DIR}`);
    console.error('   WASM files should be in public/duckdb/\n');
    process.exit(1);
  }

  try {
    // Get directory size
    const files = await fs.readdir(CONFIG.WASM_DIR);
    let totalSize = 0;
    for (const file of files) {
      const stats = await fs.stat(path.join(CONFIG.WASM_DIR, file));
      totalSize += stats.size;
    }
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

    console.log(`📦 Folder: public/duckdb/`);
    console.log(`📁 Files: ${files.length}`);
    console.log(`💾 Total Size: ${sizeMB} MB\n`);

    files.forEach(file => console.log(`   - ${file}`));
    console.log('');

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

    // Upload folder as manifest
    console.log('📤 Uploading folder to Arweave...');
    console.log('   This may take a few minutes...\n');

    const uploadResult = await turbo.uploadFolder({
      folderPath: CONFIG.WASM_DIR,
      dataItemOpts: {
        tags: [
          { name: 'App-Name', value: 'CrimRXiv-Archive' },
          { name: 'App-Version', value: APP_VERSION },
          { name: 'Description', value: 'DuckDB-WASM v1.30.0 files for browser-based SQL queries' }
          // Content-Type auto-detected by SDK for each file type
        ]
      }
    });

    // Get manifest TX ID from manifestResponse
    const txId = uploadResult.manifestResponse?.id;

    if (!txId) {
      console.error('❌ Error: No manifest TX ID returned from upload');
      console.error('Upload result:', JSON.stringify(uploadResult, null, 2));
      process.exit(1);
    }

    console.log('✅ Upload successful!\n');
    console.log('='.repeat(60));
    console.log('📊 UPLOAD RESULT');
    console.log('='.repeat(60));
    console.log(`Manifest TX ID: ${txId}`);
    console.log(`Total Size: ${sizeMB} MB`);
    console.log(`Files Uploaded: ${files.length}`);
    console.log('='.repeat(60) + '\n');

    console.log('📋 Access URLs:');
    console.log(`   Direct: https://arweave.net/${txId}`);
    files.forEach(file => {
      console.log(`   - https://arweave.net/${txId}/${file}`);
    });
    console.log('');

    console.log('💡 Next steps:');
    console.log('  1. Wait for confirmation (~2-10 minutes)');
    console.log(`  2. Test URL: https://arweave.net/${txId}/duckdb-mvp.wasm`);
    console.log('  3. Configure ArNS undername manually (if needed)');
    console.log('  4. Deploy app: npm run deploy\n');

    console.log('📝 Manifest TX ID (save this):');
    console.log(`   ${txId}\n`);

    return txId;
  } catch (error) {
    console.error('\n❌ Upload failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && (
  process.argv[1].endsWith('upload-wasm.js') ||
  process.argv[1].endsWith('upload-wasm')
);

if (isRunningDirectly) {
  uploadWasm();
}

export default uploadWasm;
