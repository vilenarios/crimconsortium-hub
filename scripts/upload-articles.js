#!/usr/bin/env node

/**
 * Upload Articles to Arweave using ArDrive Turbo SDK
 *
 * This script:
 * 1. Reads all article folders from data/articles/
 * 2. Uploads each folder using Turbo SDK uploadFolder()
 * 3. Gets manifest TX ID automatically for each article
 * 4. Updates SQLite with manifest_tx_id
 *
 * The uploadFolder() method creates a manifest automatically,
 * grouping all files in the folder under one TX ID.
 *
 * Usage:
 *   npm run upload:articles
 *   node scripts/upload-articles.js --limit 10  # Test with 10 articles
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

const CONFIG = {
  ARTICLES_DIR: path.join(__dirname, '../data/articles'),
  WALLET_PATH: process.env.ARWEAVE_WALLET_PATH,
  BATCH_SIZE: 10,  // Upload 10 articles at a time
  DELAY_BETWEEN_UPLOADS: 2000  // 2 second delay between uploads
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
            { name: 'App-Version', value: '1.0.0' },
            { name: 'Content-Type', value: 'application/x.arweave-manifest+json' },
            { name: 'Article-Slug', value: slug }
          ]
        }
      });

      const manifestTxId = uploadResult.id;
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
   * Main upload workflow
   */
  async upload() {
    const startTime = Date.now();

    // Check for --limit flag
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

    // Get all article folders
    const articles = await fs.readdir(CONFIG.ARTICLES_DIR);
    console.log(`📚 Found ${articles.length} article folders\n`);

    if (limit) {
      console.log(`⚠️  Testing mode: Will upload only ${limit} articles\n`);
    }

    // Process articles
    for (const slug of articles) {
      const articleDir = path.join(CONFIG.ARTICLES_DIR, slug);
      const stat = await fs.stat(articleDir);

      // Skip if not a directory
      if (!stat.isDirectory()) {
        continue;
      }

      this.stats.total++;

      // Check if already uploaded (has manifest_tx_id in database)
      const existing = this.db.getArticleBySlug(slug);
      if (existing && existing.manifest_tx_id) {
        console.log(`\n⏭️  Skipping ${slug} (already has manifest: ${existing.manifest_tx_id})`);
        this.stats.skipped++;
        continue;
      }

      // Upload article
      await this.uploadArticle(slug, articleDir);

      // Delay between uploads to avoid rate limits
      if (this.stats.uploaded < articles.length) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_UPLOADS));
      }

      // Check limit
      if (limit && this.stats.uploaded >= limit) {
        console.log(`\n⚠️  Reached upload limit of ${limit}\n`);
        break;
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
    console.log('  1. Re-export metadata with TX IDs: npm run export');
    console.log('  2. Upload parquet: npm run upload:parquet');
    console.log('  3. Configure ArNS: data_crimrxiv.arweave.net → PARQUET_TX_ID');
    console.log('  4. Build and deploy app: npm run build && npm run deploy\n');
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
