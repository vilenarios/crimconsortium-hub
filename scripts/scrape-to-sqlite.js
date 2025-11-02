#!/usr/bin/env node

/**
 * CrimRXiv Scraper → SQLite (SDK-Based)
 *
 * Uses PubPub SDK to extract:
 * - Full abstracts from ProseMirror documents (not truncated 277 chars!)
 * - PDF attachments from file nodes
 * - Complete metadata
 *
 * Usage:
 *   node scripts/scrape-to-sqlite-sdk.js                 # Full scrape
 *   node scripts/scrape-to-sqlite-sdk.js --limit 10      # Test with 10 articles
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
  BATCH_SIZE: 100,          // Fetch 100 pubs at a time
  TEXT_DELAY: 100,          // ms delay between text.get() calls (rate limiting)
  MAX_RETRIES: 3,
  INITIAL_BACKOFF: 2000,
  MAX_BACKOFF: 30000,
  ATTACHMENTS_DIR: path.join(__dirname, '../data/attachments'),
  DOWNLOAD_TIMEOUT: 60000   // 60 seconds for PDF downloads
};

class CrimRXivScraper {
  constructor() {
    this.sdk = null;
    this.db = null;
    this.collections = new Map(); // collection_id => collection_title
    this.stats = {
      total: 0,
      inserted: 0,
      updated: 0,
      content_enriched: 0,
      unchanged: 0,
      errors: 0
    };
  }

  /**
   * Extract plain text from ProseMirror document
   */
  extractTextFromProseMirror(doc) {
    let text = '';

    const extractNode = (node) => {
      if (node.text) {
        text += node.text + ' ';
      }
      if (node.content) {
        node.content.forEach(extractNode);
      }
    };

    if (doc && doc.content) {
      doc.content.forEach(extractNode);
    }

    return text.trim();
  }

  /**
   * Extract file attachments from ProseMirror document
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
      if (node.content) {
        node.content.forEach(findFiles);
      }
    };

    if (doc && doc.content) {
      doc.content.forEach(findFiles);
    }

    return files;
  }

  /**
   * Calculate word count from text
   */
  calculateWordCount(text) {
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Download attachment file (PDF) to local storage
   * Returns localPath for inclusion in attachments_json
   */
  async downloadAttachment(url, filename, slug) {
    try {
      // Create directory for this article's attachments
      const articleDir = path.join(CONFIG.ATTACHMENTS_DIR, slug);
      await fs.ensureDir(articleDir);

      // Build file path
      const filePath = path.join(articleDir, filename);

      // Check if already downloaded
      if (await fs.pathExists(filePath)) {
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          console.log(`   ✓ Already downloaded: ${filename}`);
          return `data/attachments/${slug}/${filename}`;
        }
      }

      // Download with timeout and retry logic
      let retries = 0;
      while (retries < CONFIG.MAX_RETRIES) {
        try {
          const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: CONFIG.DOWNLOAD_TIMEOUT,
            maxRedirects: 5
          });

          // Save to file
          const writer = fs.createWriteStream(filePath);
          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          console.log(`   ✓ Downloaded: ${filename} (${(await fs.stat(filePath)).size} bytes)`);
          return `data/attachments/${slug}/${filename}`;

        } catch (downloadError) {
          retries++;
          if (retries >= CONFIG.MAX_RETRIES) {
            console.error(`   ⚠️  Failed to download ${filename} after ${CONFIG.MAX_RETRIES} retries`);
            return null;
          }

          const backoff = Math.min(CONFIG.INITIAL_BACKOFF * Math.pow(2, retries - 1), CONFIG.MAX_BACKOFF);
          console.log(`   ⚠️  Download failed, retrying in ${backoff}ms... (${retries}/${CONFIG.MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }

      return null;

    } catch (error) {
      console.error(`   ⚠️  Error downloading ${filename}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch all collections and build id→title map
   */
  async fetchCollections() {
    try {
      console.log('📚 Fetching collections...');

      let offset = 0;
      let hasMore = true;
      const limit = 100;

      while (hasMore) {
        const response = await this.sdk.collection.getMany({
          query: {
            limit,
            offset
          }
        });

        const batch = response.body;

        if (!batch || batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const collection of batch) {
          this.collections.set(collection.id, collection.title);
        }

        offset += limit;

        // If we got fewer than limit, we're done
        if (batch.length < limit) {
          hasMore = false;
        }
      }

      console.log(`✅ Loaded ${this.collections.size} collections\n`);
    } catch (error) {
      console.error('⚠️  Failed to fetch collections:', error.message);
      console.log('   Continuing without collection data...\n');
    }
  }

  /**
   * Initialize SDK and database
   */
  async initialize() {
    console.log('\n' + '='.repeat(70));
    console.log('CrimRXiv Scraper → SQLite (SDK-Based)');
    console.log('='.repeat(70) + '\n');

    // Initialize database
    console.log('🗄️  Initializing SQLite database...');
    this.db = new CrimRXivDatabase();
    this.db.initialize();

    // Initialize SDK
    console.log('🔌 Connecting to PubPub API...');
    this.sdk = await PubPub.createSDK({
      communityUrl: process.env.PUBPUB_COMMUNITY_URL || 'https://www.crimrxiv.com',
      email: process.env.PUBPUB_EMAIL,
      password: process.env.PUBPUB_PASSWORD
    });

    // Fetch collections for mapping
    await this.fetchCollections();

    console.log('✅ Connections established\n');
  }

  /**
   * Fetch publications and process them
   */
  async fetchAndProcess(limit = null) {
    console.log('📖 Fetching publications from PubPub API...\n');

    let offset = 0;
    let totalFetched = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch of pubs
      const response = await this.sdk.pub.getMany({
        query: {
          limit: CONFIG.BATCH_SIZE,
          offset,
          sortBy: 'updatedAt',
          orderBy: 'DESC',
          include: ['collectionPubs', 'attributions', 'community', 'draft']
        }
      });

      const batch = response.body;

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      // Log progress
      if (offset === 0) {
        console.log(`📋 First batch sample (${batch.length} pubs):`);
        for (let i = 0; i < Math.min(3, batch.length); i++) {
          console.log(`   ${i+1}. ${batch[i].slug} (Updated: ${batch[i].updatedAt})`);
        }
        console.log('');
      }

      // Process each pub in batch
      for (const pub of batch) {
        await this.processArticle(pub);
        totalFetched++;

        // Check limit
        if (limit && totalFetched >= limit) {
          hasMore = false;
          break;
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, CONFIG.TEXT_DELAY));
      }

      // Progress update every 100
      if (totalFetched % 100 === 0) {
        console.log(`   📊 Processed ${totalFetched} publications...`);
      }

      offset += CONFIG.BATCH_SIZE;
    }

    this.stats.total = totalFetched;
    return totalFetched;
  }

  /**
   * Process a single article
   */
  async processArticle(pub) {
    try {
      if (!pub.id || !pub.slug) {
        this.stats.errors++;
        return null;
      }

      // Fetch full ProseMirror content
      let prosemirrorDoc = null;
      let fullText = '';
      let files = [];
      let wordCount = 0;

      try {
        const textResponse = await this.sdk.pub.text.get({
          params: { pubId: pub.id }
        });
        prosemirrorDoc = textResponse.body;

        // Extract data from ProseMirror
        fullText = this.extractTextFromProseMirror(prosemirrorDoc);
        files = this.extractFilesFromProseMirror(prosemirrorDoc);
        wordCount = this.calculateWordCount(fullText);

        // Download PDF attachments
        if (files.length > 0) {
          console.log(`   📎 Found ${files.length} attachment(s) for ${pub.slug}`);
          for (const file of files) {
            if (file.url && file.filename) {
              const localPath = await this.downloadAttachment(file.url, file.filename, pub.slug);
              if (localPath) {
                file.localPath = localPath;
              }
            }
          }
        }

      } catch (error) {
        // Some pubs might not have text.get() access
        // Continue with truncated description
        console.error(`   ⚠️  Could not fetch full content for ${pub.slug}: ${error.message.substring(0, 50)}`);
      }

      // Extract attributions
      const attributions = pub.attributions || [];

      // Extract collections using the collections map
      const collections = [];
      if (pub.collectionPubs && Array.isArray(pub.collectionPubs)) {
        for (const collectionPub of pub.collectionPubs) {
          const collectionTitle = this.collections.get(collectionPub.collectionId);
          if (collectionTitle) {
            collections.push(collectionTitle);
          }
        }
      }

      // Build article object
      const article = {
        article_id: pub.id,
        slug: pub.slug,
        title: pub.title || 'Untitled',
        description: pub.description || '',
        abstract: fullText || pub.description || '',
        doi: pub.doi || null,
        license: pub.licenseSlug || null,
        created_at: pub.createdAt || new Date().toISOString(),
        updated_at: pub.updatedAt || new Date().toISOString(),
        published_at: pub.customPublishedAt || pub.createdAt || null,
        content_text: pub.description || '',
        content_json: JSON.stringify(pub),
        content_prosemirror: prosemirrorDoc ? JSON.stringify(prosemirrorDoc) : null,
        content_markdown: null,  // Could convert later if needed
        content_text_full: fullText || null,
        word_count: wordCount,
        authors_json: JSON.stringify(
          attributions.map(attr => ({
            name: attr.name || 'Unknown',
            affiliation: attr.affiliation,
            orcid: attr.orcid,
            is_author: attr.isAuthor,
            is_corresponding: attr.isCorresponding || false
          }))
        ),
        author_count: attributions.length,
        collections_json: JSON.stringify(collections),
        collection_count: collections.length,
        keywords_json: JSON.stringify(pub.labels || []),
        attachments_json: JSON.stringify(files),
        attachment_count: files.length,
        url: `https://www.crimrxiv.com/pub/${pub.slug}`,
        pdf_url: files[0]?.url || null
      };

      // Upsert into database
      const result = this.db.upsertArticle(article);

      // Update stats
      if (result.action === 'inserted') {
        this.stats.inserted++;
      } else if (result.action === 'updated') {
        this.stats.updated++;
      } else if (result.action === 'attachments_updated') {
        this.stats.content_enriched++;
      } else {
        this.stats.unchanged++;
      }

      return result;

    } catch (error) {
      this.stats.errors++;
      console.error(`   ❌ Error processing ${pub.slug}: ${error.message}`);
      return null;
    }
  }

  /**
   * Main scrape method
   */
  async scrape(limit = null) {
    const startTime = Date.now();

    // Fetch and process
    await this.fetchAndProcess(limit);

    // Calculate duration
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2);

    // Get database stats
    const dbStats = this.db.getStats();

    // Print summary
    console.log('✅ Completed: ' + this.stats.total + ' publications processed\n');
    console.log('='.repeat(70));
    console.log('✅ SCRAPING COMPLETE!');
    console.log('='.repeat(70));
    console.log(`Total Processed: ${this.stats.total}`);
    console.log(`New Articles: ${this.stats.inserted}`);
    console.log(`Updated (New Versions): ${this.stats.updated}`);
    console.log(`Content Enriched: ${this.stats.content_enriched}`);
    console.log(`Unchanged: ${this.stats.unchanged}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Duration: ${durationMinutes} minutes`);
    console.log('');
    console.log('Database Statistics:');
    console.log(`  Total Articles (all versions): ${dbStats.total_articles}`);
    console.log(`  Latest Versions: ${dbStats.latest_articles}`);
    console.log(`  Unique Articles: ${dbStats.unique_articles}`);
    console.log(`  Unexported: ${dbStats.unexported_articles}`);
    console.log('='.repeat(70));
    console.log('\n💡 Next steps:');
    console.log('  1. Export to Parquet: npm run export');
    console.log('  2. Deploy to Arweave: npm run deploy\n');
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.sdk) {
      await this.sdk.logout();
    }
    if (this.db) {
      this.db.close();
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

  if (limit) {
    console.log(`\n⚠️  TEST MODE: Limiting to ${limit} publications\n`);
  }

  const scraper = new CrimRXivScraper();

  try {
    await scraper.initialize();
    await scraper.scrape(limit);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await scraper.cleanup();
  }
}

main();
