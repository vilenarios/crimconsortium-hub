#!/usr/bin/env node

/**
 * CrimRXiv Scraper → SQLite
 *
 * Architecture (per PATTERN_GUIDE.md):
 * 1. Scrape from PubPub API
 * 2. Store in SQLite (source of truth)
 * 3. Track versions automatically
 * 4. Export to Parquet later (separate step)
 *
 * Usage:
 *   node scripts/scrape-to-sqlite.js                    # Full scrape
 *   node scripts/scrape-to-sqlite.js --limit 100        # Test with 100 articles
 *   node scripts/scrape-to-sqlite.js --incremental      # Only new/updated articles since last run
 */

import 'dotenv/config';
import { PubPub } from '@pubpub/sdk';
import { CrimRXivDatabase } from '../src/lib/database.js';

const CONFIG = {
  BATCH_SIZE: 100,          // Fetch 100 pubs at a time from API
  RATE_LIMIT_DELAY: 100,    // ms between API calls
  MAX_RETRIES: 5,           // Maximum retry attempts for network errors
  INITIAL_BACKOFF: 5000,    // Initial backoff delay (5s)
  MAX_BACKOFF: 60000,       // Maximum backoff delay (60s)
};

class CrimRXivScraper {
  constructor() {
    this.sdk = null;
    this.db = null;
    this.stats = {
      total: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: 0
    };
  }

  /**
   * Initialize SDK and database
   */
  async initialize() {
    console.log('\n' + '='.repeat(60));
    console.log('CrimRXiv Scraper → SQLite');
    console.log('='.repeat(60) + '\n');

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

    console.log('✅ Connections established\n');
  }

  /**
   * Fetch and process publications incrementally
   */
  async fetchAndProcess(limit = null, incremental = false) {
    let lastScrapeDate = null;

    if (incremental) {
      lastScrapeDate = this.db.getLastScrapeDate();
      if (lastScrapeDate) {
        console.log(`📅 Incremental mode: fetching articles updated since ${lastScrapeDate}\n`);
      } else {
        console.log('⚠️  No previous scrape found, performing full scrape\n');
        incremental = false;
      }
    } else {
      console.log('📖 Full scrape: fetching all publications from PubPub API...\n');
    }

    let offset = 0;
    let totalFetched = 0;
    let consecutiveEmpty = 0;
    const MAX_CONSECUTIVE_EMPTY = 3; // Stop after 3 empty batches in a row

    while (true) {
      let retryCount = 0;
      let success = false;
      let batch = null;

      // Retry loop with exponential backoff
      while (!success && retryCount <= CONFIG.MAX_RETRIES) {
        try {
          const queryParams = {
            limit: CONFIG.BATCH_SIZE,
            offset,
            sortBy: 'updatedAt',
            orderBy: 'DESC'
          };

          // In incremental mode, filter by updatedAt
          if (incremental && lastScrapeDate) {
            queryParams.updatedAtSince = lastScrapeDate;
          }

          const response = await this.sdk.pub.getMany({ query: queryParams });
          batch = response.body;
          success = true;

          // Debug: Log first batch details
          if (offset === 0 && batch && batch.length > 0) {
            console.log(`\n🔍 First batch sample (${batch.length} pubs):`);
            for (let i = 0; i < Math.min(3, batch.length); i++) {
              console.log(`   ${i+1}. ${batch[i].slug} (ID: ${batch[i].id}, Updated: ${batch[i].updatedAt})`);
            }
            console.log('');
          }

        } catch (error) {
          retryCount++;

          // Check if error is retryable (network errors)
          const isRetryable = error.code === 'ECONNRESET' ||
                             error.code === 'ETIMEDOUT' ||
                             error.code === 'ENOTFOUND' ||
                             error.message.includes('fetch failed') ||
                             error.message.includes('network');

          if (!isRetryable || retryCount > CONFIG.MAX_RETRIES) {
            console.error(`\n❌ Non-retryable error or max retries exceeded at offset ${offset}: ${error.message}`);
            console.log(`✅ Saved ${totalFetched} publications before error\n`);
            return totalFetched; // Exit gracefully
          }

          // Calculate backoff delay with exponential increase
          const backoffDelay = Math.min(
            CONFIG.INITIAL_BACKOFF * Math.pow(2, retryCount - 1),
            CONFIG.MAX_BACKOFF
          );

          console.log(`\n⚠️  Network error at offset ${offset} (attempt ${retryCount}/${CONFIG.MAX_RETRIES}): ${error.message}`);
          console.log(`   ⏳ Retrying in ${(backoffDelay / 1000).toFixed(1)}s...`);

          await this.sleep(backoffDelay);
        }
      }

      // If we exhausted retries without success, exit
      if (!success) {
        console.log(`\n❌ Failed to fetch batch after ${CONFIG.MAX_RETRIES} retries. Stopping.`);
        break;
      }

      if (!batch || batch.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
          console.log(`\n✅ Reached end of publications (${consecutiveEmpty} consecutive empty batches)\n`);
          break;
        }
        // Wait a bit and try again
        await this.sleep(CONFIG.RATE_LIMIT_DELAY * 2);
        offset += CONFIG.BATCH_SIZE;
        continue;
      }

      // Reset consecutive empty counter if we got results
      consecutiveEmpty = 0;

      // Process this batch immediately
      for (const pub of batch) {
        this.processArticle(pub);
      }

      totalFetched += batch.length;
      offset += batch.length;

      process.stdout.write(`\r   📊 Fetched and saved ${totalFetched} publications...`);

      if (limit && totalFetched >= limit) {
        break;
      }

      // Rate limiting
      await this.sleep(CONFIG.RATE_LIMIT_DELAY);
    }

    console.log(`\n✅ Completed: ${totalFetched} publications fetched and saved\n`);
    this.stats.total = totalFetched;
    return totalFetched;
  }

  /**
   * Process and store article in database
   */
  processArticle(pub) {
    try {
      // Skip publications without an ID
      if (!pub.id || !pub.slug) {
        this.stats.errors++;
        if (this.stats.errors <= 5) {
          console.error(`\n   ⚠️  Skipping publication without ID/slug - id: ${pub.id}, slug: ${pub.slug}`);
        }
        return null;
      }

      // Extract attributions
      const attributions = pub.attributions || [];

      // Build article object
      const article = {
        article_id: pub.id,
        slug: pub.slug,
        title: pub.title || 'Untitled',
        description: pub.description || '',
        abstract: pub.description || '',
        doi: pub.doi || null,
        license: pub.licenseSlug || null,
        created_at: pub.createdAt || new Date().toISOString(),
        updated_at: pub.updatedAt || new Date().toISOString(),
        published_at: pub.customPublishedAt || pub.createdAt || null,
        content_text: pub.description || '',  // Batch API doesn't include full content
        content_json: '{}',                    // Batch API doesn't include full content
        authors_json: JSON.stringify(
          attributions.map((attr, idx) => ({
            index: idx,
            name: attr.name || attr.user?.fullName || 'Unknown',
            orcid: attr.orcid || attr.user?.orcid || null,
            affiliation: attr.affiliation || null,
            roles: attr.roles || [],
            user_id: attr.userId || null,
            is_corresponding: attr.isCorresponding || false
          }))
        ),
        author_count: attributions.length,
        collections_json: JSON.stringify([]),  // Batch API doesn't include collections
        collection_count: 0,
        keywords_json: JSON.stringify(pub.labels || []),
        url: `https://www.crimrxiv.com/pub/${pub.slug}`,
        pdf_url: pub.downloads?.[0]?.url || null
      };

      // Upsert into database (handles versioning)
      const result = this.db.upsertArticle(article);

      // Update stats
      if (result.action === 'inserted') {
        this.stats.inserted++;
      } else if (result.action === 'updated') {
        this.stats.updated++;
      } else {
        this.stats.unchanged++;
      }

      return result;
    } catch (error) {
      this.stats.errors++;
      console.error(`\n   ❌ Error processing ${pub.slug}: ${error.message}`);
      return null;
    }
  }

  /**
   * Main scraping workflow
   */
  async scrape(options = {}) {
    const startTime = Date.now();

    // Fetch and process publications incrementally
    await this.fetchAndProcess(options.limit, options.incremental);

    // Print statistics
    const durationMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    const dbStats = this.db.getStats();

    // Record scrape run
    this.db.recordScrapeRun({
      total: this.stats.total,
      inserted: this.stats.inserted,
      updated: this.stats.updated,
      duration: parseFloat(durationSeconds)
    });

    console.log('='.repeat(60));
    console.log('✅ SCRAPING COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total Fetched: ${this.stats.total}`);
    console.log(`New Articles: ${this.stats.inserted}`);
    console.log(`Updated (New Versions): ${this.stats.updated}`);
    console.log(`Unchanged: ${this.stats.unchanged}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Duration: ${durationMinutes} minutes`);
    console.log('');
    console.log('Database Statistics:');
    console.log(`  Total Articles (all versions): ${dbStats.total_articles}`);
    console.log(`  Latest Versions: ${dbStats.latest_articles}`);
    console.log(`  Unique Articles: ${dbStats.unique_articles}`);
    console.log(`  Unexported: ${dbStats.unexported_articles}`);
    console.log('='.repeat(60) + '\n');

    console.log('💡 Next steps:');
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

  /**
   * Sleep utility
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
    limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null,
    incremental: args.includes('--incremental')
  };

  if (options.limit) {
    console.log(`\n⚠️  TEST MODE: Limiting to ${options.limit} publications\n`);
  }

  if (options.incremental) {
    console.log(`\n🔄 INCREMENTAL MODE: Only fetching new/updated articles\n`);
  }

  const scraper = new CrimRXivScraper();

  try {
    await scraper.initialize();
    await scraper.scrape(options);
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
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('scrape-to-sqlite.js');
if (isRunningDirectly) {
  main();
}

export default CrimRXivScraper;
