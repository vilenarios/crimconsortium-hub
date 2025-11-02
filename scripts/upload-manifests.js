#!/usr/bin/env node

/**
 * Manifest Uploader - Arweave Manifest Pipeline (Phase 3)
 *
 * Uploads article manifests to Arweave:
 * 1. Upload each file in manifest directory (index.html, 1.html, metadata.json, attachments/)
 * 2. Create Arweave manifest JSON linking all files
 * 3. Upload manifest to get manifest TX ID
 * 4. Store manifest TX ID in database
 *
 * Usage:
 *   node scripts/upload-manifests.js                  # Upload all pending
 *   node scripts/upload-manifests.js --limit=10       # Test with 10
 *   node scripts/upload-manifests.js --dry-run        # Estimate costs without uploading
 */

import { CrimRXivDatabase } from '../src/lib/database.js';
import TurboFactory from '@ardrive/turbo-sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import fsPromises from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  MANIFESTS_DIR: path.join(__dirname, '../data/manifests'),
  RATE_LIMIT_MS: 1000, // 1 second between uploads
};

class ManifestUploader {
  constructor(dryRun = false) {
    this.db = null;
    this.turbo = null;
    this.dryRun = dryRun;
    this.uploadedCount = 0;
    this.errorCount = 0;
    this.totalSize = 0;
    this.totalCost = 0;
  }

  /**
   * Initialize database and Turbo SDK
   */
  async initialize() {
    console.log('\n' + '='.repeat(80));
    console.log('☁️  Arweave Manifest Uploader - Archival Pipeline (Phase 3)');
    if (this.dryRun) {
      console.log('🔍 DRY RUN MODE - No actual uploads will be performed');
    }
    console.log('='.repeat(80) + '\n');

    // Initialize database
    console.log('🗄️  Initializing SQLite database...');
    this.db = new CrimRXivDatabase();
    this.db.initialize();
    console.log(this.dryRun ? '✅ Database connected (dry run mode)\n' : '✅ Database connected\n');

    // Initialize Turbo SDK
    if (!this.dryRun) {
      const privateKey = process.env.TURBO_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('TURBO_PRIVATE_KEY not found in .env file');
      }

      console.log('☁️  Initializing Turbo SDK...');
      this.turbo = TurboFactory.authenticated({
        privateKey: JSON.parse(privateKey)
      });
      console.log('✅ Turbo SDK initialized\n');
    }
  }

  /**
   * Process articles needing upload
   */
  async processArticles(limit = null) {
    const articles = this.db.getArticlesNeedingManifestUpload(limit || 999999);

    if (articles.length === 0) {
      console.log('ℹ️  No articles needing manifest upload\n');
      return;
    }

    console.log(`📊 Found ${articles.length} articles needing upload\n`);

    const startTime = Date.now();

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      console.log(`[${i + 1}/${articles.length}]`);
      console.log(`📄 Processing: ${article.slug}`);

      try {
        await this.uploadManifest(article);
        this.uploadedCount++;
        console.log('  ✅ Complete\n');

        // Rate limiting
        if (!this.dryRun && i < articles.length - 1) {
          await this.sleep(CONFIG.RATE_LIMIT_MS);
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}\n`);
        this.errorCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('='.repeat(80));
    console.log(this.dryRun ? '📊 Dry Run Complete' : '☁️  Upload Complete');
    console.log('='.repeat(80));
    console.log(`Total articles: ${articles.length}`);
    console.log(`Uploaded: ${this.uploadedCount}`);
    console.log(`Errors: ${this.errorCount}`);
    console.log(`Total size: ${(this.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Estimated cost: $${this.totalCost.toFixed(4)}`);
    console.log(`Time elapsed: ${duration} minutes`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Upload manifest for a single article
   */
  async uploadManifest(article) {
    const manifestDir = article.manifest_path;

    if (!fs.existsSync(manifestDir)) {
      throw new Error(`Manifest directory not found: ${manifestDir}`);
    }

    // Collect all files to upload
    const files = await this.collectManifestFiles(manifestDir);
    console.log(`  → Found ${files.length} file(s) to upload`);

    // Upload each file and build manifest paths
    const manifestPaths = {};
    let manifestSize = 0;

    for (const file of files) {
      const txId = await this.uploadFile(file.path, file.tags);
      manifestPaths[file.manifestPath] = { id: txId };
      manifestSize += file.size;

      console.log(`  → Uploaded: ${file.manifestPath} (${(file.size / 1024).toFixed(2)} KB)`);
    }

    this.totalSize += manifestSize;

    // Create Arweave manifest
    const manifest = {
      manifest: 'arweave/paths',
      version: '0.2.0',
      index: {
        path: 'metadata.json'
      },
      paths: manifestPaths
    };

    // Upload manifest
    const manifestTxId = await this.uploadManifestJson(manifest);
    console.log(`  → Manifest TX ID: ${manifestTxId}`);

    // Update database
    if (!this.dryRun) {
      this.db.updateArticleManifestUploaded(article.slug, manifestTxId);
    }

    // Estimate cost (rough: $0.01 per MB)
    const costEstimate = (manifestSize / 1024 / 1024) * 0.01;
    this.totalCost += costEstimate;
  }

  /**
   * Collect all files in manifest directory
   */
  async collectManifestFiles(manifestDir) {
    const files = [];

    // metadata.json (lightweight - no content)
    const metadataPath = path.join(manifestDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      const stats = await fsPromises.stat(metadataPath);
      files.push({
        path: metadataPath,
        manifestPath: 'metadata.json',
        size: stats.size,
        tags: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'App-Name', value: 'CrimRXiv-Archive' },
        ]
      });
    }

    // content.json (ProseMirror document)
    const contentPath = path.join(manifestDir, 'content.json');
    if (fs.existsSync(contentPath)) {
      const stats = await fsPromises.stat(contentPath);
      files.push({
        path: contentPath,
        manifestPath: 'content.json',
        size: stats.size,
        tags: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'App-Name', value: 'CrimRXiv-Archive' },
        ]
      });
    }

    // Attachments
    const attachmentsDir = path.join(manifestDir, 'attachments');
    if (fs.existsSync(attachmentsDir)) {
      const attachmentFiles = await fsPromises.readdir(attachmentsDir);

      for (const filename of attachmentFiles) {
        const filepath = path.join(attachmentsDir, filename);
        const stats = await fsPromises.stat(filepath);

        const contentType = this.getContentType(filename);
        files.push({
          path: filepath,
          manifestPath: `attachments/${filename}`,
          size: stats.size,
          tags: [
            { name: 'Content-Type', value: contentType },
            { name: 'App-Name', value: 'CrimRXiv-Archive' },
            { name: 'Filename', value: filename },
          ]
        });
      }
    }

    return files;
  }

  /**
   * Upload a single file to Arweave
   */
  async uploadFile(filepath, tags) {
    if (this.dryRun) {
      // Generate fake TX ID for dry run
      const randomId = Math.random().toString(36).substring(2, 15);
      return `dry-run-${randomId}`;
    }

    const fileData = fs.readFileSync(filepath);
    const result = await this.turbo.uploadFile({
      fileStreamFactory: () => fs.createReadStream(filepath),
      fileSizeFactory: () => fileData.length,
      dataItemOpts: { tags }
    });

    return result.id;
  }

  /**
   * Upload manifest JSON to Arweave
   */
  async uploadManifestJson(manifest) {
    if (this.dryRun) {
      const randomId = Math.random().toString(36).substring(2, 15);
      return `manifest-${randomId}`;
    }

    const manifestJson = JSON.stringify(manifest);
    const buffer = Buffer.from(manifestJson);

    const result = await this.turbo.uploadFile({
      fileStreamFactory: () => {
        const { Readable } = require('stream');
        return Readable.from([buffer]);
      },
      fileSizeFactory: () => buffer.length,
      dataItemOpts: {
        tags: [
          { name: 'Content-Type', value: 'application/x.arweave-manifest+json' },
          { name: 'App-Name', value: 'CrimRXiv-Archive' },
        ]
      }
    });

    return result.id;
  }

  /**
   * Get content type from filename
   */
  getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
      '.pdf': 'application/pdf',
      '.html': 'text/html',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };
    return types[ext] || 'application/octet-stream';
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const uploader = new ManifestUploader();

  try {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
    const dryRun = args.includes('--dry-run');

    const instance = new ManifestUploader(dryRun);
    await instance.initialize();
    await instance.processArticles(limit);
    instance.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    uploader.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('upload-manifests.js');
if (isRunningDirectly) {
  main();
}

export default ManifestUploader;
