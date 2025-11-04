#!/usr/bin/env node

/**
 * CrimRXiv Import → data/articles/
 *
 * Simplified workflow:
 * 1. Scrapes CrimRXiv using PubPub SDK
 * 2. Saves ALL content to data/articles/{slug}/
 *    - metadata.json (full article metadata)
 *    - content.json (ProseMirror content)
 *    - article.md (markdown version)
 *    - article.html (HTML version - optional)
 *    - attachments/{filename} (PDFs and other media)
 * 3. Saves metadata to SQLite (for querying + manifest_tx_id storage)
 *
 * Usage:
 *   npm run import
 *   node scripts/import-to-articles.js --limit 10  # Test mode
 */

import 'dotenv/config';
import { PubPub } from '@pubpub/sdk';
import { CrimRXivDatabase } from '../src/lib/database.js';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  BATCH_SIZE: 100,
  TEXT_DELAY: 100,
  MAX_RETRIES: 3,
  INITIAL_BACKOFF: 2000,
  MAX_BACKOFF: 30000,
  ARTICLES_DIR: path.join(__dirname, '../data/articles'),  // Changed!
  DOWNLOAD_TIMEOUT: 60000
};

class CrimRXivImporter {
  constructor() {
    this.sdk = null;
    this.db = null;
    this.collections = new Map();
    this.stats = {
      total: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
      attachments_downloaded: 0,
      attachments_failed: 0,
      folders_created: 0
    };
  }

  /**
   * Convert ProseMirror to Markdown (simplified)
   */
  prosemirrorToMarkdown(doc) {
    // For now, just extract plain text
    // Full markdown serialization can be added later if needed
    return this.extractTextFromProseMirror(doc);
  }

  /**
   * Extract plain text from ProseMirror
   */
  extractTextFromProseMirror(doc) {
    let text = '';
    const extractNode = (node) => {
      if (node.text) text += node.text + ' ';
      if (node.content) node.content.forEach(extractNode);
    };
    if (doc && doc.content) doc.content.forEach(extractNode);
    return text.trim();
  }

  /**
   * Extract file attachments from ProseMirror
   */
  extractFilesFromProseMirror(doc) {
    const files = [];
    const findFiles = (node) => {
      if (node.type === 'file' && node.attrs) {
        files.push({
          url: node.attrs.url,
          filename: node.attrs.fileName,
          fileSize: node.attrs.fileSize,
          type: node.attrs.url?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
        });
      }
      if (node.content) node.content.forEach(findFiles);
    };
    if (doc && doc.content) doc.content.forEach(findFiles);
    return files;
  }

  /**
   * Download attachment (PDF or other media)
   */
  async downloadAttachment(url, filename, articleDir) {
    try {
      const attachmentsDir = path.join(articleDir, 'attachments');
      await fs.ensureDir(attachmentsDir);

      const filePath = path.join(attachmentsDir, filename);

      // Skip if already exists
      if (await fs.pathExists(filePath)) {
        return { success: true, path: filePath, skipped: true };
      }

      console.log(`    📥 Downloading: ${filename}`);

      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: CONFIG.DOWNLOAD_TIMEOUT,
        maxRedirects: 5
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      this.stats.attachments_downloaded++;
      return { success: true, path: filePath };
    } catch (error) {
      console.error(`    ❌ Failed to download ${filename}:`, error.message);
      this.stats.attachments_failed++;
      return { success: false, error: error.message };
    }
  }

  /**
   * Save a specific version to data/articles/{slug}/{releaseNumber}/
   */
  async saveVersionFolder(articleDir, releaseNumber, metadata, prosemirrorContent) {
    try {
      const versionDir = path.join(articleDir, String(releaseNumber));
      await fs.ensureDir(versionDir);

      // 1. Save metadata.json
      await fs.writeJSON(path.join(versionDir, 'metadata.json'), metadata, { spaces: 2 });

      // 2. Save content.json (ProseMirror)
      if (prosemirrorContent) {
        await fs.writeJSON(path.join(versionDir, 'content.json'), prosemirrorContent, { spaces: 2 });

        // 3. Save article.md (Markdown)
        try {
          const markdown = this.prosemirrorToMarkdown(prosemirrorContent);
          if (markdown) {
            await fs.writeFile(path.join(versionDir, 'article.md'), markdown, 'utf-8');
          }
        } catch (error) {
          console.warn(`    ⚠️  Could not generate markdown for release ${releaseNumber}:`, error.message);
        }
      }

      // 4. Download attachments
      const files = this.extractFilesFromProseMirror(prosemirrorContent);
      const attachments = [];

      for (const file of files) {
        if (file.url && file.filename) {
          const result = await this.downloadAttachment(file.url, file.filename, versionDir);
          if (result.success) {
            attachments.push({
              filename: file.filename,
              path: `attachments/${file.filename}`,
              size: file.fileSize,
              type: file.type,
              url: file.url
            });
          }
        }
      }

      // 5. Save attachments manifest
      if (attachments.length > 0) {
        await fs.writeJSON(path.join(versionDir, 'attachments.json'), attachments, { spaces: 2 });
      }

      return { success: true, attachments };
    } catch (error) {
      console.error(`    ❌ Failed to save version ${releaseNumber}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save article to data/articles/{slug}/
   */
  async saveArticleFolder(article, prosemirrorContent) {
    try {
      const articleDir = path.join(CONFIG.ARTICLES_DIR, article.slug);
      await fs.ensureDir(articleDir);

      // 1. Save metadata.json
      const metadata = {
        id: article.article_id,
        slug: article.slug,
        title: article.title,
        abstract: article.abstract,
        description: article.description,
        authors: JSON.parse(article.authors_json || '[]'),
        keywords: JSON.parse(article.keywords_json || '[]'),
        collections: JSON.parse(article.collections_json || '[]'),
        doi: article.doi,
        license: article.license,
        dates: {
          created: article.created_at,
          updated: article.updated_at,
          published: article.published_at
        },
        urls: {
          canonical: article.url,
          pdf: article.pdf_url
        },
        statistics: {
          wordCount: article.word_count || 0,
          authorCount: article.author_count || 0,
          attachmentCount: article.attachment_count || 0
        }
      };

      await fs.writeJSON(path.join(articleDir, 'metadata.json'), metadata, { spaces: 2 });

      // 2. Save content.json (ProseMirror)
      if (prosemirrorContent) {
        await fs.writeJSON(path.join(articleDir, 'content.json'), prosemirrorContent, { spaces: 2 });

        // 3. Save article.md (Markdown)
        try {
          const markdown = this.prosemirrorToMarkdown(prosemirrorContent);
          if (markdown) {
            await fs.writeFile(path.join(articleDir, 'article.md'), markdown, 'utf-8');
          }
        } catch (error) {
          console.warn(`    ⚠️  Could not generate markdown:`, error.message);
        }
      }

      // 4. Download attachments (PDFs and other media)
      const files = this.extractFilesFromProseMirror(prosemirrorContent);
      const attachments = [];

      for (const file of files) {
        if (file.url && file.filename) {
          const result = await this.downloadAttachment(file.url, file.filename, articleDir);
          if (result.success) {
            attachments.push({
              filename: file.filename,
              path: `attachments/${file.filename}`,
              size: file.fileSize,
              type: file.type,
              url: file.url
            });
          }
        }
      }

      // 5. Save attachments manifest
      if (attachments.length > 0) {
        await fs.writeJSON(path.join(articleDir, 'attachments.json'), attachments, { spaces: 2 });
      }

      this.stats.folders_created++;
      return { success: true, attachments };
    } catch (error) {
      console.error(`    ❌ Failed to save article folder:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize SDK and database
   */
  async initialize() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 CrimRXiv Import → data/articles/');
    console.log('='.repeat(60) + '\n');

    // Check credentials
    if (!process.env.PUBPUB_EMAIL || !process.env.PUBPUB_PASSWORD) {
      throw new Error('Missing PUBPUB_EMAIL or PUBPUB_PASSWORD in .env');
    }

    // Initialize PubPub SDK
    console.log('🔐 Logging into PubPub...');
    this.sdk = await PubPub.createSDK({
      communityUrl: 'https://www.crimrxiv.com',
      email: process.env.PUBPUB_EMAIL,
      password: process.env.PUBPUB_PASSWORD
    });
    console.log('✅ Logged in successfully\n');

    // Initialize database
    console.log('🗄️  Opening SQLite database...');
    this.db = new CrimRXivDatabase();
    this.db.initialize();
    console.log('✅ Database ready\n');

    // Ensure articles directory exists
    await fs.ensureDir(CONFIG.ARTICLES_DIR);
  }

  /**
   * Process a single publication (with all releases/versions)
   */
  async processPub(pub) {
    try {
      console.log(`\n📄 Processing: ${pub.title}`);
      console.log(`   Slug: ${pub.slug}`);

      const articleDir = path.join(CONFIG.ARTICLES_DIR, pub.slug);
      await fs.ensureDir(articleDir);

      // Sort releases by createdAt to get version numbers (1, 2, 3...)
      const releases = (pub.releases || []).sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
      );

      console.log(`   Releases: ${releases.length || 0}`);

      // Process all releases
      const versionManifest = [];
      for (let i = 0; i < releases.length; i++) {
        const release = releases[i];
        const releaseNumber = i + 1; // Release numbers start at 1

        console.log(`   📦 Fetching release ${releaseNumber} (historyKey: ${release.historyKey})...`);

        // Get content for this specific release
        const textResponse = await this.sdk.pub.text.get({
          params: { pubId: pub.id },
          query: { historyKey: release.historyKey }
        });
        await new Promise(resolve => setTimeout(resolve, CONFIG.TEXT_DELAY));

        const prosemirrorContent = textResponse?.body || null;

        // Prepare metadata for this version
        const versionMetadata = {
          releaseNumber: releaseNumber,
          historyKey: release.historyKey,
          createdAt: release.createdAt,
          noteText: release.noteText,
          title: pub.title,
          doi: pub.doi,
          url: `https://www.crimrxiv.com/pub/${pub.slug}/release/${releaseNumber}`
        };

        // Save this version to {slug}/{releaseNumber}/
        const versionResult = await this.saveVersionFolder(
          articleDir,
          releaseNumber,
          versionMetadata,
          prosemirrorContent
        );

        if (versionResult.success) {
          versionManifest.push({
            number: releaseNumber,
            historyKey: release.historyKey,
            createdAt: release.createdAt,
            noteText: release.noteText,
            url: `https://www.crimrxiv.com/pub/${pub.slug}/release/${releaseNumber}`
          });
        }
      }

      // Get latest version content (for root level and SQLite)
      const textResponse = await this.sdk.pub.text.get({
        params: { pubId: pub.id }
      });
      await new Promise(resolve => setTimeout(resolve, CONFIG.TEXT_DELAY));

      const prosemirrorContent = textResponse?.body || null;
      const contentText = this.extractTextFromProseMirror(prosemirrorContent);
      const files = this.extractFilesFromProseMirror(prosemirrorContent);

      // Prepare article data for SQLite
      const article = {
        article_id: pub.id,
        slug: pub.slug,
        title: pub.title,
        description: pub.description || '',
        abstract: pub.description || '',
        doi: pub.doi || null,
        license: pub.licenseSlug || null,
        created_at: pub.createdAt,
        updated_at: pub.updatedAt,
        published_at: pub.publishedAt || pub.createdAt,
        content_text: contentText,
        content_prosemirror: prosemirrorContent ? JSON.stringify(prosemirrorContent) : null,
        authors_json: JSON.stringify(pub.attributions?.map(a => ({
          name: a.name,
          affiliation: a.affiliation,
          orcid: a.orcid,
          is_corresponding: a.isCorresponding || false
        })) || []),
        author_count: pub.attributions?.length || 0,
        collections_json: JSON.stringify(pub.collectionPubs?.map(cp => cp.collection?.title).filter(Boolean) || []),
        collection_count: pub.collectionPubs?.length || 0,
        keywords_json: JSON.stringify([]),
        word_count: contentText.split(/\s+/).length,
        attachment_count: files.length,
        url: `https://www.crimrxiv.com/pub/${pub.slug}`,
        pdf_url: files[0]?.url || null
      };

      // Save latest version to root level (for backwards compatibility)
      const folderResult = await this.saveArticleFolder(article, prosemirrorContent);

      if (!folderResult.success) {
        console.error(`   ❌ Failed to save article folder`);
        this.stats.errors++;
        return;
      }

      // Save versions manifest
      if (versionManifest.length > 0) {
        await fs.writeJSON(path.join(articleDir, 'versions.json'), {
          total: versionManifest.length,
          latest: versionManifest[versionManifest.length - 1].number,
          versions: versionManifest
        }, { spaces: 2 });
      }

      // Update attachments JSON for SQLite
      if (folderResult.attachments && folderResult.attachments.length > 0) {
        article.attachments_json = JSON.stringify(folderResult.attachments);
      }

      // Upsert into SQLite (for metadata + manifest_tx_id storage)
      const result = this.db.upsertArticle(article);

      if (result.action === 'inserted') {
        this.stats.inserted++;
        console.log(`   ✅ Inserted (new article)`);
      } else if (result.action === 'updated') {
        this.stats.updated++;
        console.log(`   ✅ Updated (changes detected)`);
      } else {
        this.stats.unchanged++;
        console.log(`   ⏭️  Unchanged (skipped)`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${pub.slug}:`, error.message);
      this.stats.errors++;
    }
  }

  /**
   * Main import workflow
   */
  async import() {
    const startTime = Date.now();

    // Check for --limit flag
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

    console.log('📚 Fetching publications...\n');

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch using correct SDK API
      const response = await this.sdk.pub.getMany({
        query: {
          limit: CONFIG.BATCH_SIZE,
          offset: offset,
          sortBy: 'updatedAt',
          orderBy: 'DESC',
          include: ['collectionPubs', 'attributions', 'community', 'draft', 'releases']
        }
      });

      // Extract pubs array from response body
      const pubs = response.body || [];

      if (!pubs || pubs.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`📦 Batch: ${offset + 1} - ${offset + pubs.length} of ???`);

      // Process each pub
      for (const pub of pubs) {
        this.stats.total++;
        await this.processPub(pub);

        // Check limit
        if (limit && this.stats.total >= limit) {
          console.log(`\n⚠️  Reached limit of ${limit} articles\n`);
          hasMore = false;
          break;
        }
      }

      offset += pubs.length;

      // If we got less than a full batch, we're done
      if (pubs.length < CONFIG.BATCH_SIZE) {
        hasMore = false;
      }
    }

    // Print summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('✅ IMPORT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total Processed: ${this.stats.total}`);
    console.log(`Inserted (new): ${this.stats.inserted}`);
    console.log(`Updated: ${this.stats.updated}`);
    console.log(`Unchanged: ${this.stats.unchanged}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Folders Created: ${this.stats.folders_created}`);
    console.log(`Attachments Downloaded: ${this.stats.attachments_downloaded}`);
    console.log(`Attachments Failed: ${this.stats.attachments_failed}`);
    console.log(`Duration: ${duration} minutes`);
    console.log('='.repeat(60) + '\n');

    console.log('💡 Next steps:');
    console.log('  1. Export metadata: npm run export');
    console.log('  2. Upload articles: npm run upload:articles');
    console.log('  3. Re-export with TX IDs: npm run export');
    console.log('  4. Upload parquet: npm run upload:parquet\n');
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
  const importer = new CrimRXivImporter();

  try {
    await importer.initialize();
    await importer.import();
    await importer.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    await importer.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && (
  process.argv[1].endsWith('import-to-articles.js') ||
  process.argv[1].endsWith('import-to-articles')
);

if (isRunningDirectly) {
  main();
}

export default CrimRXivImporter;
