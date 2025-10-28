#!/usr/bin/env node

/**
 * CrimRXiv Web Scraper → SQLite
 *
 * Uses web scraping (Axios + Cheerio) instead of PubPub SDK to bypass 10-publication limit.
 *
 * Architecture (per PATTERN_GUIDE.md):
 * 1. Scrape publication list from CrimRXiv website
 * 2. Scrape each article page for full metadata
 * 3. Store in SQLite (source of truth)
 * 4. Track versions automatically
 * 5. Export to Parquet later (separate step)
 *
 * Usage:
 *   node scripts/scrape-web-to-sqlite.js                # Full scrape
 *   node scripts/scrape-web-to-sqlite.js --limit 100    # Test with 100 articles
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { CrimRXivDatabase } from '../src/lib/database.js';

const CONFIG = {
  BASE_URL: 'https://www.crimrxiv.com',
  REQUEST_DELAY: 1000,      // 1s between requests to be respectful
  TIMEOUT: 30000,           // 30s timeout
  MAX_RETRIES: 3
};

class CrimRXivWebScraper {
  constructor() {
    this.db = null;
    this.stats = {
      total: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: 0
    };
    this.seenSlugs = new Set();
  }

  /**
   * Initialize database
   */
  async initialize() {
    console.log('\n' + '='.repeat(60));
    console.log('CrimRXiv Web Scraper → SQLite');
    console.log('='.repeat(60) + '\n');

    // Initialize database
    console.log('🗄️  Initializing SQLite database...');
    this.db = new CrimRXivDatabase();
    this.db.initialize();

    console.log('✅ Database ready\n');
  }

  /**
   * Scrape all publications
   */
  async scrapeAll(limit = null) {
    const startTime = Date.now();

    console.log('🌐 Starting web scraping from crimrxiv.com...\n');

    // Step 1: Collect all publication slugs
    const slugs = await this.collectAllSlugs(limit);
    console.log(`\n📊 Found ${slugs.length} publications to scrape\n`);

    // Step 2: Scrape each publication
    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];

      try {
        // Rate limiting
        if (i > 0) {
          await this.sleep(CONFIG.REQUEST_DELAY);
        }

        // Scrape article
        const article = await this.scrapeArticle(slug);

        if (article) {
          // Save to database
          const result = this.db.upsertArticle(article);

          // Update stats
          if (result.action === 'inserted') {
            this.stats.inserted++;
          } else if (result.action === 'updated') {
            this.stats.updated++;
          } else {
            this.stats.unchanged++;
          }

          this.stats.total++;

          process.stdout.write(`\r   📄 Scraped ${this.stats.total}/${slugs.length} articles (${this.stats.inserted} new, ${this.stats.updated} updated)`);
        } else {
          this.stats.errors++;
        }

      } catch (error) {
        this.stats.errors++;
        console.error(`\n   ❌ Error scraping ${slug}: ${error.message}`);
      }
    }

    console.log('\n');

    // Print statistics
    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    const durationMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
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
    console.log(`Total Scraped: ${this.stats.total}`);
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
   * Collect all publication slugs from the website
   */
  async collectAllSlugs(limit = null) {
    const slugs = [];
    let page = 0;
    const pageSize = 50; // Approximate number per page

    console.log('🔍 Collecting publication list...');

    while (true) {
      try {
        // Try to load page with offset (if supported)
        const url = page === 0
          ? CONFIG.BASE_URL
          : `${CONFIG.BASE_URL}?offset=${page * pageSize}`;

        const response = await axios.get(url, {
          timeout: CONFIG.TIMEOUT,
          headers: {
            'User-Agent': 'CrimConsortium-WebScraper/1.0'
          }
        });

        const $ = cheerio.load(response.data);
        let foundOnPage = 0;

        // Find all publication links
        $('a[href*="/pub/"]').each((index, element) => {
          const href = $(element).attr('href');
          if (href && !href.includes('/release/') && !href.includes('/draft')) {
            const slug = href.split('/pub/')[1]?.split('/')[0];
            if (slug && !this.seenSlugs.has(slug)) {
              this.seenSlugs.add(slug);
              slugs.push(slug);
              foundOnPage++;
            }
          }
        });

        process.stdout.write(`\r   📊 Found ${slugs.length} publications (page ${page + 1})...`);

        // Stop if no new publications found or reached limit
        if (foundOnPage === 0 || (limit && slugs.length >= limit)) {
          break;
        }

        page++;
        await this.sleep(CONFIG.REQUEST_DELAY);

      } catch (error) {
        console.error(`\n   ⚠️  Error loading page ${page}: ${error.message}`);
        break;
      }
    }

    // Apply limit if specified
    return limit ? slugs.slice(0, limit) : slugs;
  }

  /**
   * Scrape individual article page
   */
  async scrapeArticle(slug) {
    const url = `${CONFIG.BASE_URL}/pub/${slug}`;

    try {
      const response = await axios.get(url, {
        timeout: CONFIG.TIMEOUT,
        headers: {
          'User-Agent': 'CrimConsortium-WebScraper/1.0'
        }
      });

      const $ = cheerio.load(response.data);

      // Extract metadata
      const title = this.extractMeta($, 'citation_title') ||
                    $('h1').first().text().trim() ||
                    'Untitled';

      const authors = this.extractAuthors($);
      const abstract = this.extractAbstract($) || this.extractMeta($, 'description') || '';
      const doi = this.extractMeta($, 'citation_doi');
      const publishedDate = this.extractMeta($, 'citation_publication_date');
      const keywords = this.extractKeywords($);

      // Generate article ID (CrimRXiv doesn't expose UUID in HTML, so use slug-based ID)
      const article_id = slug;

      // Get current timestamp
      const now = new Date().toISOString();

      return {
        article_id: article_id,
        slug: slug,
        title: title,
        description: abstract,
        abstract: abstract,
        doi: doi || null,
        license: null, // Not easily extractable from HTML
        created_at: publishedDate || now,
        updated_at: now,
        published_at: publishedDate || now,
        content_text: abstract,
        content_json: '{}',
        authors_json: JSON.stringify(authors),
        author_count: authors.length,
        collections_json: JSON.stringify([]),
        collection_count: 0,
        keywords_json: JSON.stringify(keywords),
        url: url,
        pdf_url: this.extractPdfUrl($)
      };

    } catch (error) {
      console.error(`\n   ❌ Failed to scrape ${url}: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract meta tag content
   */
  extractMeta($, name) {
    return $(`meta[name="${name}"]`).attr('content') ||
           $(`meta[property="${name}"]`).attr('content') ||
           '';
  }

  /**
   * Extract authors
   */
  extractAuthors($) {
    const authors = [];

    $('meta[name="citation_author"]').each((index, element) => {
      const name = $(element).attr('content');
      if (name) {
        authors.push({
          index: index,
          name: name,
          orcid: null,
          affiliation: null,
          roles: [],
          user_id: null,
          is_corresponding: false
        });
      }
    });

    return authors;
  }

  /**
   * Extract abstract
   */
  extractAbstract($) {
    // Try multiple selectors
    let abstract = '';

    // Try meta description first
    abstract = this.extractMeta($, 'description');
    if (abstract && abstract.length > 50) return abstract;

    // Try common abstract containers
    const abstractSelectors = [
      '.abstract',
      '[data-node-type="abstract"]',
      '.pub-body-component p:first-of-type',
      '.editor p:first-of-type'
    ];

    for (const selector of abstractSelectors) {
      const text = $(selector).first().text().trim();
      if (text && text.length > 50) {
        return text;
      }
    }

    return abstract;
  }

  /**
   * Extract keywords
   */
  extractKeywords($) {
    const keywords = [];

    $('meta[name="citation_keywords"]').each((index, element) => {
      const keyword = $(element).attr('content');
      if (keyword) {
        keywords.push(keyword);
      }
    });

    return keywords;
  }

  /**
   * Extract PDF URL
   */
  extractPdfUrl($) {
    return $('meta[name="citation_pdf_url"]').attr('content') || null;
  }

  /**
   * Sleep utility
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
  const args = process.argv.slice(2);
  const options = {
    limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null
  };

  if (options.limit) {
    console.log(`\n⚠️  TEST MODE: Limiting to ${options.limit} publications\n`);
  }

  const scraper = new CrimRXivWebScraper();

  try {
    await scraper.initialize();
    await scraper.scrapeAll(options.limit);
    scraper.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    scraper.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('scrape-web-to-sqlite.js');
if (isRunningDirectly) {
  main();
}

export default CrimRXivWebScraper;
