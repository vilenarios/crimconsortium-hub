/**
 * ParquetDB - DuckDB-WASM Wrapper for Parquet Queries
 *
 * Handles loading and querying Parquet files using DuckDB-WASM.
 * Implements lazy loading of article batches.
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import { getDataParquetUrl, getUndernameUrl, getAppInfo } from './gateway.js';

export class ParquetDB {
  constructor() {
    this.db = null;
    this.conn = null;
    this.loadedBatches = new Set();
    this.metadataLoaded = false;

    // Determine parquet URLs based on gateway
    this.urls = this.getParquetUrls();

    console.log('📊 ParquetDB configured:', {
      metadata: this.urls.metadata,
      gateway: getAppInfo()
    });
  }

  /**
   * Get parquet URLs based on current gateway
   * - Localhost: Use full localhost URL (DuckDB-WASM needs absolute URLs)
   * - Production: Use ArNS undername for external parquet file
   */
  getParquetUrls() {
    const appInfo = getAppInfo();

    // For localhost development, use full URL
    // DuckDB-WASM requires absolute URLs for fetching
    if (appInfo.isLocalhost) {
      const baseUrl = `${appInfo.protocol}://${appInfo.hostname}:${window.location.port || '3005'}`;
      return {
        metadata: `${baseUrl}/data/metadata.parquet`,
        batchBase: `${baseUrl}/data/articles/`
      };
    }

    // For production on Arweave, use ArNS undername for external parquet
    // Extract root name from current gateway (e.g., crimrxiv-demo.arweave.net -> crimrxiv-demo)
    const rootName = appInfo.gateway.split('.')[0];
    const dataUndername = `data_${rootName}`;

    return {
      metadata: `${appInfo.protocol}://${dataUndername}.arweave.net`,
      batchBase: null  // Articles are loaded via manifest TX IDs, not batch files
    };
  }

  /**
   * Get DuckDB-WASM bundle URLs
   */
  getDuckDBBundles() {
    const appInfo = getAppInfo();

    // For localhost, use bundled files
    if (appInfo.isLocalhost) {
      return {
        mvp: {
          mainModule: './duckdb/duckdb-mvp.wasm',
          mainWorker: './duckdb/duckdb-browser-mvp.worker.js',
        },
        eh: {
          mainModule: './duckdb/duckdb-eh.wasm',
          mainWorker: './duckdb/duckdb-browser-eh.worker.js',
        },
      };
    }

    // For production, use external ArNS-hosted DuckDB-WASM
    // Relative to current gateway (e.g., crimrxiv-demo.arweave.net → duck-db-wasm.arweave.net)
    const gateway = appInfo.gateway; // e.g., crimrxiv-demo.arweave.net
    const gatewayDomain = gateway.split('.').slice(1).join('.'); // arweave.net, ar.io, etc.
    const wasmBase = `${appInfo.protocol}://duck-db-wasm.${gatewayDomain}`;

    return {
      mvp: {
        mainModule: `${wasmBase}/duckdb-mvp.wasm`,
        mainWorker: `${wasmBase}/duckdb-browser-mvp.worker.js`,
      },
      eh: {
        mainModule: `${wasmBase}/duckdb-eh.wasm`,
        mainWorker: `${wasmBase}/duckdb-browser-eh.worker.js`,
      },
    };
  }

  /**
   * Initialize DuckDB-WASM
   */
  async initialize() {
    try {
      console.log('📦 Loading DuckDB-WASM...');

      // Get bundle configuration based on environment
      const MANUAL_BUNDLES = this.getDuckDBBundles();

      console.log('📦 DuckDB WASM URLs:', {
        mvp: MANUAL_BUNDLES.mvp.mainModule,
        worker: MANUAL_BUNDLES.mvp.mainWorker
      });

      // Select bundle (try MVP first, it's the most compatible)
      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

      console.log('📦 Selected bundle:', bundle.mainModule);

      // Create logger
      const logger = new duckdb.ConsoleLogger();

      // Create worker using Blob URL workaround for cross-origin loading
      // This allows loading Workers from external ArNS sources
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
      );
      const worker = new Worker(workerUrl);

      // Initialize database
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule);

      // Connect
      this.conn = await this.db.connect();

      console.log('✅ DuckDB-WASM initialized');

      // Load metadata
      await this.loadMetadata();

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize DuckDB-WASM:', error);
      throw error;
    }
  }

  /**
   * Load metadata.parquet (all articles, lightweight)
   */
  async loadMetadata() {
    if (this.metadataLoaded) return;

    try {
      console.log('📋 Loading metadata.parquet...');

      await this.conn.query(`
        CREATE VIEW IF NOT EXISTS metadata AS
        SELECT * FROM parquet_scan('${this.urls.metadata}')
      `);

      this.metadataLoaded = true;
      console.log('✅ Metadata loaded');
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
          doi,
          author_count,
          arweave_tx_id,
          manifest_tx_id,
          word_count,
          attachment_count,
          reference_count,
          citation_count
        FROM metadata
        WHERE published_at IS NOT NULL
        ORDER BY published_at DESC
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
          published_at,
          doi,
          author_count,
          collection_count,
          arweave_tx_id,
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
      return articles.map(article => ({
        ...article,
        authors: JSON.parse(article.authors_json || '[]'),
        keywords: JSON.parse(article.keywords_json || '[]'),
        collections: JSON.parse(article.collections_json || '[]')
      }));
    } catch (error) {
      console.error('❌ Failed to get all articles:', error);
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
          arweave_tx_id,
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
   */
  async searchByAffiliation(patterns, limit = 500) {
    try {
      if (!patterns || patterns.length === 0) {
        return [];
      }

      // Build WHERE clause for affiliation matching
      // We search within both authors_json and collections_json fields
      const safePatterns = patterns.map(p => p.replace(/'/g, "''"));
      const whereConditions = safePatterns.map(pattern =>
        `(authors_json ILIKE '%${pattern}%' OR collections_json ILIKE '%${pattern}%')`
      ).join(' OR ');

      const result = await this.conn.query(`
        SELECT
          article_id,
          slug,
          title,
          authors_json,
          collections_json,
          abstract_preview,
          keywords_json,
          published_at,
          doi,
          author_count,
          arweave_tx_id,
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
   * Get full article (returns metadata only - manifests fetched from Arweave)
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
  }
}
