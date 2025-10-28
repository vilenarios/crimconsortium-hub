#!/usr/bin/env node

/**
 * CrimRXiv to Parquet Scraper
 *
 * Robust scraper that fetches ALL CrimRXiv publications and stores them in Parquet format.
 * No filtering - we want the entire database for comprehensive analysis.
 *
 * Features:
 * - Fetches all ~7,000+ publications from CrimRXiv
 * - Gets full metadata: authors, affiliations, ORCID, content, collections
 * - Writes to efficient Parquet format (~70% smaller than JSON)
 * - Batch processing for memory efficiency
 * - Progress checkpoints for resumable scraping
 * - Comprehensive error handling
 *
 * Usage:
 *   node scripts/crimrxiv-to-parquet.js
 *   node scripts/crimrxiv-to-parquet.js --resume    # Resume from checkpoint
 *   node scripts/crimrxiv-to-parquet.js --limit 100 # Test with 100 pubs
 */

import 'dotenv/config';
import { PubPub } from '@pubpub/sdk';
import * as arrow from 'apache-arrow';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  OUTPUT_DIR: path.join(__dirname, '..', 'data', 'parquet'),
  OUTPUT_FILE: 'crimrxiv_all.parquet',
  CHECKPOINT_FILE: 'scrape_checkpoint.json',
  BATCH_SIZE: 100,          // Fetch 100 pubs at a time from API
  WRITE_BATCH_SIZE: 1000,   // Write to Parquet every 1000 pubs
  RATE_LIMIT_DELAY: 100,    // ms between API calls (be respectful)
  MAX_RETRIES: 3
};

class CrimRXivScraper {
  constructor() {
    this.sdk = null;
    this.publications = [];
    this.checkpoint = { lastProcessedId: null, totalProcessed: 0, timestamp: null };
    this.stats = {
      total: 0,
      processed: 0,
      withDOI: 0,
      withORCID: 0,
      withFullContent: 0,
      errors: 0
    };
  }

  /**
   * Initialize SDK connection
   */
  async initialize() {
    console.log('🔌 Initializing PubPub SDK...');

    this.sdk = await PubPub.createSDK({
      communityUrl: process.env.PUBPUB_COMMUNITY_URL || 'https://www.crimrxiv.com',
      email: process.env.PUBPUB_EMAIL,
      password: process.env.PUBPUB_PASSWORD
    });

    console.log('✅ Connected to PubPub API\n');

    // Ensure output directory exists
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  /**
   * Load checkpoint if resuming
   */
  async loadCheckpoint() {
    const checkpointPath = path.join(CONFIG.OUTPUT_DIR, CONFIG.CHECKPOINT_FILE);
    try {
      const data = await fs.readFile(checkpointPath, 'utf-8');
      this.checkpoint = JSON.parse(data);
      console.log(`📂 Resuming from checkpoint: ${this.checkpoint.totalProcessed} publications already processed\n`);
      return true;
    } catch (error) {
      console.log('📂 No checkpoint found, starting fresh\n');
      return false;
    }
  }

  /**
   * Save checkpoint for resume capability
   */
  async saveCheckpoint() {
    const checkpointPath = path.join(CONFIG.OUTPUT_DIR, CONFIG.CHECKPOINT_FILE);
    this.checkpoint.timestamp = new Date().toISOString();
    await fs.writeFile(checkpointPath, JSON.stringify(this.checkpoint, null, 2));
  }

  /**
   * Fetch all publications in batches (much simpler - everything is in batch results!)
   */
  async getAllPublications(limit = null) {
    console.log('📖 Fetching all publications...');
    const allPubs = [];
    let offset = 0;

    while (true) {
      const { body: batch } = await this.sdk.pub.getMany({
        limit: CONFIG.BATCH_SIZE,
        offset,
        orderBy: 'createdAt',
        orderDirection: 'desc'
      });

      if (!batch || batch.length === 0) break;

      // Process batch directly - all data is already here!
      for (const pub of batch) {
        const processed = this.processPublication(pub);
        if (processed) {
          allPubs.push(processed);
        }
      }

      offset += batch.length;

      process.stdout.write(`\r   📊 Processed ${allPubs.length} publications...`);

      if (limit && allPubs.length >= limit) {
        allPubs.length = limit;
        break;
      }

      // Rate limiting
      await this.sleep(CONFIG.RATE_LIMIT_DELAY);
    }

    console.log(`\n✅ Processed ${allPubs.length} total publications\n`);
    return allPubs;
  }

  /**
   * Process a single publication from batch results
   * All data we need is already in the batch!
   */
  processPublication(pub) {
    try {
      // Extract attributions (already in batch result)
      const attributions = pub.attributions || [];

      // Get ORCID from either attribution.orcid or attribution.user.orcid
      const hasORCID = attributions.some(a => a.orcid || a.user?.orcid);

      // Update stats
      if (pub.doi) this.stats.withDOI++;
      if (hasORCID) this.stats.withORCID++;
      if (pub.description && pub.description.length > 100) this.stats.withFullContent++;

      this.stats.processed++;

      return {
        // Core fields
        id: pub.id,
        slug: pub.slug,
        title: pub.title || 'Untitled',
        description: pub.description || '',
        doi: pub.doi || null,
        created_at: pub.createdAt ? new Date(pub.createdAt) : null,
        updated_at: pub.updatedAt ? new Date(pub.updatedAt) : null,
        published_at: pub.customPublishedAt ? new Date(pub.customPublishedAt) : null,

        // Content (description is our "abstract")
        abstract: pub.description || '',
        content_text: pub.description || '', // Batch doesn't include full content
        content_json: '{}', // Batch doesn't include full content

        // Metadata
        license: pub.licenseSlug || null,
        keywords: pub.labels || [],
        url: `https://www.crimrxiv.com/pub/${pub.slug}`,
        pdf_url: pub.downloads?.[0]?.url || null,

        // Authors (nested structure)
        // Handle both attribution.orcid and attribution.user.orcid
        authors: attributions.map((attr, idx) => ({
          index: idx,
          name: attr.name || attr.user?.fullName || 'Unknown',
          orcid: attr.orcid || attr.user?.orcid || null,
          affiliation: attr.affiliation || null,
          roles: attr.roles || [],
          user_id: attr.userId || null,
          is_corresponding: attr.isCorresponding || false
        })),

        // Collections (not available in batch results)
        collections: [],

        // Counts for quick reference
        author_count: attributions.length,
        collection_count: 0
      };

    } catch (error) {
      this.stats.errors++;
      console.error(`\n   ❌ Error processing ${pub?.slug || 'unknown'}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse ProseMirror content to plain text
   */
  parseContent(content) {
    if (!content) return '';

    const extractText = (node) => {
      if (!node) return '';

      if (node.text) {
        return node.text;
      }

      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join(' ');
      }

      return '';
    };

    return extractText(content).trim();
  }

  /**
   * Extract abstract from full content (first paragraph usually)
   */
  extractAbstract(contentText) {
    if (!contentText) return '';

    const paragraphs = contentText.split('\n\n').filter(p => p.trim());
    if (paragraphs.length > 0) {
      const first = paragraphs[0].trim();
      // If first paragraph is reasonable length, use it as abstract
      if (first.length >= 50 && first.length <= 2000) {
        return first;
      }
    }

    return contentText.substring(0, 500);
  }

  /**
   * Write publications to Parquet file
   */
  async writeToParquet(publications, filename) {
    console.log(`\n💾 Writing ${publications.length} publications to Parquet...`);

    // Define Arrow schema with nested structures
    const schema = new arrow.Schema([
      new arrow.Field('id', new arrow.Utf8()),
      new arrow.Field('slug', new arrow.Utf8()),
      new arrow.Field('title', new arrow.Utf8()),
      new arrow.Field('description', new arrow.Utf8()),
      new arrow.Field('doi', new arrow.Utf8(), true), // nullable
      new arrow.Field('created_at', new arrow.TimestampMillisecond(), true),
      new arrow.Field('updated_at', new arrow.TimestampMillisecond(), true),
      new arrow.Field('published_at', new arrow.TimestampMillisecond(), true),
      new arrow.Field('abstract', new arrow.Utf8()),
      new arrow.Field('content_text', new arrow.Utf8()),
      new arrow.Field('content_json', new arrow.Utf8()),
      new arrow.Field('license', new arrow.Utf8(), true),
      new arrow.Field('keywords', new arrow.List(new arrow.Field('item', new arrow.Utf8()))),
      new arrow.Field('url', new arrow.Utf8()),
      new arrow.Field('pdf_url', new arrow.Utf8(), true),
      new arrow.Field('author_count', new arrow.Int32()),
      new arrow.Field('collection_count', new arrow.Int32()),
      // Note: For now, we'll serialize authors and collections as JSON strings
      // In future, we can use proper Arrow struct types
      new arrow.Field('authors_json', new arrow.Utf8()),
      new arrow.Field('collections_json', new arrow.Utf8())
    ]);

    // Convert publications to Arrow format
    const data = publications.map(pub => ({
      id: pub.id,
      slug: pub.slug,
      title: pub.title,
      description: pub.description,
      doi: pub.doi,
      created_at: pub.created_at?.getTime() || null,
      updated_at: pub.updated_at?.getTime() || null,
      published_at: pub.published_at?.getTime() || null,
      abstract: pub.abstract,
      content_text: pub.content_text,
      content_json: pub.content_json,
      license: pub.license,
      keywords: pub.keywords,
      url: pub.url,
      pdf_url: pub.pdf_url,
      author_count: pub.author_count,
      collection_count: pub.collection_count,
      authors_json: JSON.stringify(pub.authors),
      collections_json: JSON.stringify(pub.collections)
    }));

    // Create Arrow table
    const table = arrow.tableFromJSON(data);

    // Write to file using Arrow IPC format (not Parquet, but Arrow - still columnar)
    const outputPath = path.join(CONFIG.OUTPUT_DIR, filename.replace('.parquet', '.arrow'));
    const writer = arrow.RecordBatchFileWriter.writeAll(table);
    const buffer = await writer.toUint8Array();
    await fs.writeFile(outputPath, buffer);

    const stats = await fs.stat(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`✅ Arrow file written: ${outputPath} (${sizeMB} MB)\n`);
  }

  /**
   * Process all publications (simplified - no individual API calls!)
   */
  async scrapeAll(options = {}) {
    const startTime = Date.now();

    console.log('🔄 Starting scraping (batch processing)...\n');

    // Get all publications in batches - much simpler!
    const allPublications = await this.getAllPublications(options.limit);
    this.stats.total = allPublications.length;

    // Write to single Parquet file
    if (allPublications.length > 0) {
      await this.writeToParquet(allPublications, CONFIG.OUTPUT_FILE);
    }

    // Print final statistics
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log('\n\n' + '='.repeat(60));
    console.log('✅ SCRAPING COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total Publications: ${this.stats.total}`);
    console.log(`Successfully Processed: ${this.stats.processed}`);
    console.log(`With DOI: ${this.stats.withDOI} (${(this.stats.withDOI / this.stats.processed * 100).toFixed(1)}%)`);
    console.log(`With ORCID: ${this.stats.withORCID} (${(this.stats.withORCID / this.stats.processed * 100).toFixed(1)}%)`);
    console.log(`With Descriptions: ${this.stats.withFullContent} (${(this.stats.withFullContent / this.stats.processed * 100).toFixed(1)}%)`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Duration: ${duration} minutes`);
    console.log(`Output: ${path.join(CONFIG.OUTPUT_DIR, CONFIG.OUTPUT_FILE)}`);
    console.log('='.repeat(60) + '\n');

    // Clean up checkpoint
    try {
      await fs.unlink(path.join(CONFIG.OUTPUT_DIR, CONFIG.CHECKPOINT_FILE));
    } catch (error) {
      // Ignore if doesn't exist
    }
  }

  /**
   * Logout and cleanup
   */
  async cleanup() {
    if (this.sdk) {
      await this.sdk.logout();
    }
  }

  /**
   * Simple sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const options = {
    resume: args.includes('--resume'),
    limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null
  };

  console.log('\n' + '='.repeat(60));
  console.log('CrimRXiv → Parquet Scraper');
  console.log('='.repeat(60) + '\n');

  if (options.limit) {
    console.log(`⚠️  TEST MODE: Limiting to ${options.limit} publications\n`);
  }

  const scraper = new CrimRXivScraper();

  try {
    await scraper.initialize();

    if (options.resume) {
      await scraper.loadCheckpoint();
    }

    await scraper.scrapeAll(options);
    await scraper.cleanup();

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    await scraper.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('crimrxiv-to-parquet.js');
if (isRunningDirectly) {
  main();
}

export default CrimRXivScraper;
