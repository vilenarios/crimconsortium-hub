#!/usr/bin/env node

/**
 * Upload Articles to Arweave using ArDrive Turbo SDK
 *
 * This script:
 * 1. Reads all article folders from data/articles/
 * 2. Uploads folders in parallel (5 at a time by default)
 * 3. Gets manifest TX ID automatically for each article
 * 4. Updates SQLite with manifest_tx_id
 *
 * The uploadFolder() method creates a manifest automatically,
 * grouping all files in the folder under one TX ID.
 *
 * Usage:
 *   npm run upload:articles                        # Upload all (5 concurrent)
 *   node scripts/upload-articles.js --limit=10     # Test with 10 articles
 *   node scripts/upload-articles.js --concurrency=10  # 10 concurrent uploads
 */

import { TurboFactory, ArweaveSigner } from '@ardrive/turbo-sdk/node';
import { CrimRXivDatabase } from '../src/lib/database.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
const APP_VERSION = packageJson.version;

const CONFIG = {
  ARTICLES_DIR: path.join(__dirname, '../data/articles'),
  WALLET_PATH: process.env.ARWEAVE_WALLET_PATH,
  CONCURRENCY: 20,  // Upload articles in parallel
  DELAY_BETWEEN_BATCHES: 1000  // 1 second delay between batches
};

class ArticleUploader {
  constructor() {
    this.turbo = null;
    this.db = null;
    this.stats = {
      total: 0,
      uploaded: 0,
      skipped: 0,
      failed: 0,
      updated_db: 0
    };
  }

  /**
   * Initialize Turbo SDK and database
   */
  async initialize() {
    console.log('\n' + '='.repeat(60));
    console.log('📤 Upload Articles to Arweave');
    console.log('='.repeat(60) + '\n');

    // Validate wallet
    if (!CONFIG.WALLET_PATH) {
      throw new Error('ARWEAVE_WALLET_PATH not set in .env');
    }

    if (!await fs.pathExists(CONFIG.WALLET_PATH)) {
      throw new Error(`Wallet file not found: ${CONFIG.WALLET_PATH}`);
    }

    // Load wallet
    console.log('🔑 Loading Arweave wallet...');
    const walletJson = JSON.parse(await fs.readFile(CONFIG.WALLET_PATH, 'utf-8'));
    const signer = new ArweaveSigner(walletJson);

    // Initialize Turbo
    console.log('🚀 Initializing Turbo SDK...');
    this.turbo = TurboFactory.authenticated({ signer });

    // Check balance
    const balance = await this.turbo.getBalance();
    console.log(`💰 Balance: ${balance.winc} winc\n`);

    // Initialize database
    console.log('🗄️  Opening SQLite database...');
    this.db = new CrimRXivDatabase();
    this.db.initialize();
    console.log('✅ Database ready\n');
  }

  /**
   * Upload a single article folder
   */
  async uploadArticle(slug, articleDir) {
    try {
      console.log(`\n📦 Uploading: ${slug}`);

      // Check if files exist
      const files = await fs.readdir(articleDir);
      if (files.length === 0) {
        console.log(`   ⚠️  Empty folder, skipping`);
        this.stats.skipped++;
        return null;
      }

      console.log(`   Files: ${files.join(', ')}`);

      // Upload folder using Turbo SDK
      // This automatically creates a manifest!
      console.log(`   📤 Uploading folder...`);

      const uploadResult = await this.turbo.uploadFolder({
        folderPath: articleDir,
        dataItemOpts: {
          tags: [
            { name: 'App-Name', value: 'CrimRXiv-Archive' },
            { name: 'App-Version', value: APP_VERSION },
            { name: 'Article-Slug', value: slug },
            { name: 'License', value: 'OlTlW1xEw75UC0cdmNqvxc3j6iAmFXrS4usWIBfu_3E' }
            // Content-Type auto-detected by SDK for each file type
          ]
        }
      });

      // Get manifest TX ID from manifestResponse
      const manifestTxId = uploadResult.manifestResponse?.id;

      if (!manifestTxId) {
        console.error('   ❌ Error: No manifest TX ID returned');
        console.error('   Upload result:', JSON.stringify(uploadResult, null, 2));
        throw new Error('No manifest TX ID returned from upload');
      }

      console.log(`   ✅ Manifest TX ID: ${manifestTxId}`);
      console.log(`   URL: https://arweave.net/${manifestTxId}`);

      this.stats.uploaded++;

      // Update database with manifest_tx_id
      const updated = this.db.updateManifestTxId(slug, manifestTxId);

      if (updated) {
        this.stats.updated_db++;
        console.log(`   ✅ Updated SQLite with manifest TX ID`);
      } else {
        console.log(`   ⚠️  Failed to update SQLite (article not found?)`);
      }

      return manifestTxId;

    } catch (error) {
      console.error(`   ❌ Upload failed:`, error.message);
      this.stats.failed++;
      return null;
    }
  }

  /**
   * Main upload workflow (with concurrency)
   */
  async upload() {
    const startTime = Date.now();

    // Check for --limit flag
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

    // Check for --concurrency flag
    const concurrencyArg = process.argv.find(arg => arg.startsWith('--concurrency='));
    const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : CONFIG.CONCURRENCY;

    // Get all article folders
    const allArticles = await fs.readdir(CONFIG.ARTICLES_DIR);
    console.log(`📚 Found ${allArticles.length} article folders`);
    console.log(`🔀 Concurrency: ${concurrency} uploads in parallel\n`);

    if (limit) {
      console.log(`⚠️  Testing mode: Will upload only ${limit} articles\n`);
    }

    // Filter to only valid directories that need uploading
    const articlesToProcess = [];
    for (const slug of allArticles) {
      const articleDir = path.join(CONFIG.ARTICLES_DIR, slug);

      try {
        const stat = await fs.stat(articleDir);
        if (!stat.isDirectory()) continue;

        this.stats.total++;

        // Check if already uploaded
        const existing = this.db.getArticleBySlug(slug);
        if (existing && existing.manifest_tx_id) {
          this.stats.skipped++;
          continue;
        }

        articlesToProcess.push({ slug, articleDir });

        // Stop if we've hit the limit
        if (limit && articlesToProcess.length >= limit) {
          break;
        }
      } catch (error) {
        // Skip if we can't stat the directory
        continue;
      }
    }

    console.log(`📤 Ready to upload: ${articlesToProcess.length} articles`);
    console.log(`⏭️  Skipped: ${this.stats.skipped} (already uploaded)\n`);

    // Process in batches with concurrency
    for (let i = 0; i < articlesToProcess.length; i += concurrency) {
      const batch = articlesToProcess.slice(i, i + concurrency);
      const batchNum = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(articlesToProcess.length / concurrency);

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} articles)`);
      console.log('='.repeat(60));

      // Upload batch concurrently
      const uploadPromises = batch.map(({ slug, articleDir }) =>
        this.uploadArticle(slug, articleDir)
      );

      // Wait for all uploads in this batch to complete
      await Promise.allSettled(uploadPromises);

      // Progress update
      const remaining = articlesToProcess.length - (i + batch.length);
      if (remaining > 0) {
        console.log(`\n✅ Batch ${batchNum} complete. ${remaining} articles remaining...`);

        // Delay between batches
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
      }
    }

    // Print summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('✅ UPLOAD COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total Articles: ${this.stats.total}`);
    console.log(`Uploaded: ${this.stats.uploaded}`);
    console.log(`Skipped: ${this.stats.skipped}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Database Updated: ${this.stats.updated_db}`);
    console.log(`Duration: ${duration} minutes`);
    console.log('='.repeat(60) + '\n');

    console.log('💡 Next steps:');
    console.log('  1. Re-export metadata with TX IDs:');
    console.log('     npm run export');
    console.log('');
    console.log('  2. Upload parquet (auto-updates ArNS):');
    console.log('     npm run upload:parquet');
    console.log('');
    console.log('  3. Deploy app:');
    console.log('     npm run deploy\n');
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const uploader = new ArticleUploader();

  try {
    await uploader.initialize();
    await uploader.upload();
    await uploader.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    await uploader.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && (
  process.argv[1].endsWith('upload-articles.js') ||
  process.argv[1].endsWith('upload-articles')
);

if (isRunningDirectly) {
  main();
}

export default ArticleUploader;
