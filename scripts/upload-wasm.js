#!/usr/bin/env node

/**
 * Upload WASM Files to Arweave
 *
 * Uploads DuckDB-WASM bundles from public/duckdb/ to Arweave
 * using Turbo SDK for fast, reliable uploads.
 *
 * Files to upload:
 * - duckdb-mvp.wasm
 * - duckdb-mvp.worker.js
 * - duckdb-eh.wasm
 * - duckdb-eh.worker.js
 *
 * After upload:
 * Save transaction IDs to .env:
 * - WASM_MVP_TX_ID
 * - WASM_MVP_WORKER_TX_ID
 * - WASM_EH_TX_ID
 * - WASM_EH_WORKER_TX_ID
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

const CONFIG = {
  WASM_DIR: path.join(__dirname, '../public/duckdb'),
  WALLET_PATH: process.env.ARWEAVE_WALLET_PATH,
  FILES: [
    { name: 'duckdb-mvp.wasm', envKey: 'WASM_MVP_TX_ID', contentType: 'application/wasm' },
    { name: 'duckdb-browser-mvp.worker.js', envKey: 'WASM_MVP_WORKER_TX_ID', contentType: 'application/javascript' },
    { name: 'duckdb-eh.wasm', envKey: 'WASM_EH_TX_ID', contentType: 'application/wasm' },
    { name: 'duckdb-browser-eh.worker.js', envKey: 'WASM_EH_WORKER_TX_ID', contentType: 'application/javascript' }
  ]
};

/**
 * Upload a single WASM file
 */
async function uploadFile(turbo, filePath, filename, contentType) {
  const stats = await fs.stat(filePath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`\n📦 Uploading: ${filename}`);
  console.log(`   Size: ${sizeMB} MB`);

  const fileBuffer = await fs.readFile(filePath);

  const uploadResult = await turbo.uploadFile({
    fileStreamFactory: () => fileBuffer,
    fileSizeFactory: () => stats.size,
    dataItemOpts: {
      tags: [
        { name: 'Content-Type', value: contentType },
        { name: 'App-Name', value: 'CrimRXiv-Archive' },
        { name: 'App-Version', value: '1.0.0' },
        { name: 'File-Name', value: filename },
        { name: 'Description', value: `DuckDB-WASM file for browser-based SQL queries` }
      ]
    }
  });

  console.log(`   ✅ TX ID: ${uploadResult.id}`);
  console.log(`   URL: https://arweave.net/${uploadResult.id}`);

  return {
    filename,
    txId: uploadResult.id,
    size: sizeMB
  };
}

/**
 * Upload all WASM files to Arweave
 */
async function uploadWasm() {
  console.log('\n' + '='.repeat(60));
  console.log('📤 Upload WASM Files to Arweave');
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
    // Load wallet
    console.log('🔑 Loading Arweave wallet...');
    const walletJson = JSON.parse(await fs.readFile(CONFIG.WALLET_PATH, 'utf-8'));
    const signer = new ArweaveSigner(walletJson);

    // Initialize Turbo
    console.log('🚀 Initializing Turbo SDK...');
    const turbo = TurboFactory.authenticated({ signer });

    // Check balance
    const balance = await turbo.getBalance();
    console.log(`💰 Balance: ${balance.winc} winc`);

    // Upload each file
    const results = [];
    for (const file of CONFIG.FILES) {
      const filePath = path.join(CONFIG.WASM_DIR, file.name);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        console.error(`\n⚠️  Warning: ${file.name} not found, skipping...`);
        continue;
      }

      const result = await uploadFile(turbo, filePath, file.name, file.contentType);
      results.push({ ...result, envKey: file.envKey });
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ UPLOAD COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Files uploaded: ${results.length}`);
    console.log(`Total size: ${results.reduce((sum, r) => sum + parseFloat(r.size), 0).toFixed(2)} MB`);
    console.log('='.repeat(60) + '\n');

    console.log('💡 Add these to your .env file:\n');
    results.forEach(result => {
      console.log(`${result.envKey}=${result.txId}`);
    });

    console.log('\n💡 Update src/config/arweave.js with these URLs:\n');
    results.forEach(result => {
      const key = result.filename.replace('duckdb-', '').replace('duckdb-browser-', '').replace('.wasm', 'Module').replace('.worker.js', 'Worker');
      console.log(`  ${key}: 'https://arweave.net/${result.txId}',`);
    });

    console.log('\n💡 Next steps:');
    console.log('  1. Copy TX IDs to .env');
    console.log('  2. Update src/config/arweave.js production config');
    console.log('  3. Wait for confirmation (~2-10 minutes)');
    console.log('  4. Test WASM URLs in browser');
    console.log('  5. Build and deploy app: npm run build && npm run deploy\n');

    return results;
  } catch (error) {
    console.error('\n❌ Upload failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  uploadWasm();
}

export default uploadWasm;
