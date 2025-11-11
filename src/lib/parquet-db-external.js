/**
 * ParquetDB (External Resources) - DuckDB-WASM Wrapper for Parquet Queries
 *
 * New architecture: Loads resources from external URLs
 * - Development: localhost URLs
 * - Production: ArNS subdomains and Arweave TX IDs
 *
 * Handles loading and querying Parquet files using DuckDB-WASM.
 * Implements lazy loading of article batches.
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import { ARWEAVE_CONFIG, isDevelopment } from '../config/arweave.js';

export class ParquetDB {
  constructor() {
    this.db = null;
    this.conn = null;
    this.metadataLoaded = false;
    this.workerUrl = null; // Store worker URL for cleanup

    console.log('📊 ParquetDB configured:', {
      environment: isDevelopment() ? 'development' : 'production',
      parquet: ARWEAVE_CONFIG.parquet,
      wasm: ARWEAVE_CONFIG.wasm
    });
  }

  /**
   * Initialize DuckDB-WASM from external resources
   */
  async initialize() {
    try {
      console.log('📦 Loading DuckDB-WASM from external resources...');

      // Create manual bundle configuration using external URLs
      const MANUAL_BUNDLES = {
        mvp: {
          mainModule: ARWEAVE_CONFIG.wasm.mvpModule,
          mainWorker: ARWEAVE_CONFIG.wasm.mvpWorker,
        },
        eh: {
          mainModule: ARWEAVE_CONFIG.wasm.ehModule,
          mainWorker: ARWEAVE_CONFIG.wasm.ehWorker,
        },
      };

      console.log('📦 WASM bundles:', MANUAL_BUNDLES);

      // Select bundle (try MVP first, it's the most compatible)
      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

      console.log('📦 Selected bundle:', bundle);

      // Create logger
      const logger = new duckdb.ConsoleLogger();

      // Create worker using Blob to avoid CORS issues with external URLs
      // This is required when loading from Arweave - see public/duckdb/HOW-TO.md
      this.workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`],
        { type: 'text/javascript' })
      );
      const worker = new Worker(this.workerUrl);

      console.log('📦 Worker created from:', bundle.mainWorker);
      console.log('📦 Worker blob URL:', this.workerUrl);

      // Initialize database
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule);

      // Connect
      this.conn = await this.db.connect();

      console.log('✅ DuckDB-WASM initialized');

      // Load metadata from external parquet
      await this.loadMetadata();

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize DuckDB-WASM:', error);
      throw error;
    }
  }

  /**
   * Load metadata.parquet from external URL (via ArNS undername)
   * ArNS undername points directly to the parquet file (no path needed)
   * - Development: http://localhost:{port}/data/metadata.parquet
   * - Production: https://data_crimrxiv-demo.{gateway}
   *   Examples:
   *     - https://data_crimrxiv-demo.ar.io
   *     - https://data_crimrxiv-demo.arweave.net
   *     - https://data_crimrxiv-demo.permagate.io
   */
  async loadMetadata() {
    if (this.metadataLoaded) return;

    try {
      console.log('📋 Loading metadata from external URL:', ARWEAVE_CONFIG.parquet);

      await this.conn.query(`
        CREATE VIEW IF NOT EXISTS metadata AS
        SELECT * FROM parquet_scan('${ARWEAVE_CONFIG.parquet}')
      `);

      this.metadataLoaded = true;
      console.log('✅ Metadata loaded from external URL');
    } catch (error) {
      console.error('❌ Failed to load metadata:', error);
      throw error;
    }
  }

  /**
   * Get recent articles (homepage)
   */
  async getRecentArticles(limit = 25) {
    try {
      const result = await this.conn.query(`
        SELECT
          article_id,
          slug,
          title,
          authors_json,
          abstract_preview,
          keywords_json,
          published_at,
          version_timestamp,
          doi,
          author_count,
          manifest_tx_id,
          word_count,
          attachment_count,
          reference_count,
          citation_count
        FROM metadata
        WHERE published_at IS NOT NULL
        ORDER BY COALESCE(version_timestamp, published_at) DESC
        LIMIT ${limit}
      `);

      const articles = result.toArray().map(row => row.toJSON());

      // Parse JSON fields
      return articles.map(article => ({
        ...article,
        authors: JSON.parse(article.authors_json || '[]'),
        keywords: JSON.parse(article.keywords_json || '[]')
      }));
    } catch (error) {
      console.error('❌ Failed to get recent articles:', error);
      throw error;
    }
  }

  /**
   * Get all articles (for browse/filter pages)
   */
  async getAllArticles() {
    try {
      const result = await this.conn.query(`
        SELECT
          article_id,
          slug,
          title,
          authors_json,
          abstract_preview,
          keywords_json,
          collections_json,
          external_publications_json,
          published_at,
          doi,
          author_count,
          collection_count,
          manifest_tx_id,
          word_count,
          attachment_count,
          reference_count,
          citation_count
        FROM metadata
        WHERE published_at IS NOT NULL
        ORDER BY published_at DESC
      `);

      const articles = result.toArray().map(row => row.toJSON());

      // Parse JSON fields
      const parsed = articles.map(article => ({
        ...article,
        authors: JSON.parse(article.authors_json || '[]'),
        keywords: JSON.parse(article.keywords_json || '[]'),
        collections: JSON.parse(article.collections_json || '[]'),
        external_publications: JSON.parse(article.external_publications_json || '[]')
      }));

      // DEBUG: Log statistics
      const withExtPubs = parsed.filter(a => a.external_publications && a.external_publications.length > 0).length;
      const withoutExtPubs = parsed.filter(a => !a.external_publications || a.external_publications.length === 0).length;
      console.log('📊 getAllArticles() stats:', {
        total: parsed.length,
        withExternalPubs: withExtPubs,
        withoutExternalPubs: withoutExtPubs
      });

      return parsed;
    } catch (error) {
      console.error('❌ Failed to get all articles:', error);
      throw error;
    }
  }

  /**
   * Get news articles (CrimRxiv Consortium updates and Crimversations)
   * News articles have author_count = 0 and specific title patterns
   */
  async getNewsArticles(limit = 50) {
    try {
      const result = await this.conn.query(`
        SELECT
          article_id,
          slug,
          title,
          authors_json,
          abstract_preview,
          keywords_json,
          published_at,
          version_timestamp,
          doi,
          author_count,
          manifest_tx_id,
          word_count,
          attachment_count,
          reference_count,
          citation_count
        FROM metadata
        WHERE
          author_count = 0
          AND (
            title ILIKE '%CrimRxiv%'
            OR title ILIKE '%Consortium%'
            OR title ILIKE '%Crimversations%'
          )
        ORDER BY COALESCE(version_timestamp, published_at) DESC
        LIMIT ${limit}
      `);

      const articles = result.toArray().map(row => row.toJSON());

      return articles.map(article => ({
        ...article,
        authors: JSON.parse(article.authors_json || '[]'),
        keywords: JSON.parse(article.keywords_json || '[]')
      }));
    } catch (error) {
      console.error('❌ Failed to get news articles:', error);
      throw error;
    }
  }

  /**
   * Search articles (full-text search in metadata)
   */
  async search(query, limit = 50) {
    try {
      // Escape single quotes for SQL
      const safeQuery = query.replace(/'/g, "''");

      const result = await this.conn.query(`
        SELECT
          article_id,
          slug,
          title,
          authors_json,
          abstract_preview,
          keywords_json,
          published_at,
          doi,
          author_count,
          manifest_tx_id,
          word_count,
          attachment_count,
          reference_count,
          citation_count
        FROM metadata
        WHERE
          title ILIKE '%${safeQuery}%'
          OR abstract_preview ILIKE '%${safeQuery}%'
          OR keywords_json ILIKE '%${safeQuery}%'
          OR authors_json ILIKE '%${safeQuery}%'
        ORDER BY published_at DESC
        LIMIT ${limit}
      `);

      const articles = result.toArray().map(row => row.toJSON());

      return articles.map(article => ({
        ...article,
        authors: JSON.parse(article.authors_json || '[]'),
        keywords: JSON.parse(article.keywords_json || '[]')
      }));
    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * Search articles by affiliation patterns (for consortium members)
   * Searches author affiliations AND external publications (for journals)
   */
  async searchByAffiliation(patterns, limit = 500) {
    try {
      if (!patterns || patterns.length === 0) {
        return [];
      }

      // Build WHERE clause for affiliation matching
      // Search in:
      // 1. authors_json - for university affiliations
      // 2. external_publications_json - for journal names (e.g., "Criminology: An Interdisciplinary Journal")
      // 3. collections_json - for collection-based members
      // 4. avatar - for institutional badge/logo URLs (e.g., "University of Liverpool" in filename)
      const safePatterns = patterns.map(p => p.replace(/'/g, "''"));
      const whereConditions = safePatterns.map(pattern =>
        `(authors_json ILIKE '%${pattern}%' OR external_publications_json ILIKE '%${pattern}%' OR collections_json ILIKE '%${pattern}%' OR avatar ILIKE '%${pattern}%')`
      ).join(' OR ');

      const result = await this.conn.query(`
        SELECT
          article_id,
          slug,
          title,
          authors_json,
          collections_json,
          external_publications_json,
          abstract_preview,
          keywords_json,
          published_at,
          doi,
          author_count,
          manifest_tx_id,
          word_count,
          attachment_count,
          reference_count,
          citation_count
        FROM metadata
        WHERE ${whereConditions}
        ORDER BY published_at DESC
        LIMIT ${limit}
      `);

      const articles = result.toArray().map(row => row.toJSON());
      return articles.map(article => ({
        ...article,
        authors: JSON.parse(article.authors_json || '[]'),
        keywords: JSON.parse(article.keywords_json || '[]')
      }));
    } catch (error) {
      console.error('❌ Search by affiliation error:', error);
      return [];
    }
  }

  /**
   * Get article metadata from metadata.parquet
   */
  async getArticleMetadata(slug) {
    try {
      const result = await this.conn.query(`
        SELECT *
        FROM metadata
        WHERE slug = '${slug}'
        LIMIT 1
      `);

      const rows = result.toArray();
      if (rows.length === 0) return null;

      const article = rows[0].toJSON();
      return {
        ...article,
        authors: JSON.parse(article.authors_json || '[]'),
        keywords: JSON.parse(article.keywords_json || '[]'),
        collections: JSON.parse(article.collections_json || '[]')
      };
    } catch (error) {
      console.error(`❌ Failed to get metadata for ${slug}:`, error);
      throw error;
    }
  }

  /**
   * Get full article (returns metadata only - manifests fetched separately)
   */
  async getArticleFull(slug) {
    try {
      // Just return metadata - full content is fetched from Arweave manifest if needed
      const metadata = await this.getArticleMetadata(slug);
      if (!metadata) {
        throw new Error(`Article not found: ${slug}`);
      }

      return metadata;
    } catch (error) {
      console.error(`❌ Failed to get full article ${slug}:`, error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    try {
      const result = await this.conn.query(`
        SELECT
          COUNT(*) as total_articles,
          COUNT(DISTINCT article_id) as unique_articles,
          MIN(published_at) as oldest_article,
          MAX(published_at) as newest_article,
          SUM(author_count) as total_authors
        FROM metadata
      `);

      return result.toArray()[0].toJSON();
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      return {
        total_articles: 0,
        unique_articles: 0,
        oldest_article: null,
        newest_article: null,
        total_authors: 0
      };
    }
  }

  /**
   * Cleanup
   */
  async close() {
    if (this.conn) {
      await this.conn.close();
    }
    if (this.db) {
      await this.db.terminate();
    }
    // Clean up blob URL to prevent memory leaks
    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = null;
    }
  }
}
