/**
 * SQLite Database - Source of Truth for CrimRXiv Data
 *
 * Architecture: SQLite is the single source of truth (per PATTERN_GUIDE.md)
 * - Tracks all article versions
 * - Manages export state
 * - Parquet files are regenerated from this database
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CrimRXivDatabase {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(__dirname, '../../data/sqlite/crimrxiv.db');
    this.db = null;
  }

  /**
   * Initialize database and create schema
   */
  initialize() {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance

    // Create schema
    this.createSchema();

    console.log(`✅ Database initialized: ${this.dbPath}`);
  }

  /**
   * Create database schema
   */
  createSchema() {
    // Articles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        -- Primary key
        id TEXT PRIMARY KEY,

        -- Article identity
        article_id TEXT NOT NULL,
        slug TEXT NOT NULL,

        -- Version tracking
        version_number INTEGER DEFAULT 1,
        version_timestamp TEXT NOT NULL,
        is_latest_version INTEGER DEFAULT 1,

        -- Metadata
        title TEXT NOT NULL,
        description TEXT,
        abstract TEXT,
        doi TEXT,
        license TEXT,

        -- Dates
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,

        -- Content
        content_text TEXT,
        content_json TEXT,

        -- Authors (JSON array)
        authors_json TEXT,
        author_count INTEGER DEFAULT 0,

        -- Collections (JSON array)
        collections_json TEXT,
        collection_count INTEGER DEFAULT 0,

        -- Keywords (JSON array)
        keywords_json TEXT,

        -- URLs
        url TEXT,
        pdf_url TEXT,

        -- Export tracking
        exported INTEGER DEFAULT 0,
        export_batch TEXT,
        export_date TEXT,

        -- Arweave tracking
        arweave_tx_id TEXT,
        arns_undername TEXT,

        -- Timestamps
        scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_checked TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_articles_article_id ON articles(article_id);
      CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
      CREATE INDEX IF NOT EXISTS idx_articles_version ON articles(article_id, version_number);
      CREATE INDEX IF NOT EXISTS idx_articles_latest ON articles(is_latest_version);
      CREATE INDEX IF NOT EXISTS idx_articles_exported ON articles(exported);
      CREATE INDEX IF NOT EXISTS idx_articles_export_batch ON articles(export_batch);
      CREATE INDEX IF NOT EXISTS idx_articles_scraped ON articles(scraped_at);
      CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);

      -- Export batches table
      CREATE TABLE IF NOT EXISTS export_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_name TEXT UNIQUE NOT NULL,
        export_date TEXT NOT NULL,
        article_count INTEGER DEFAULT 0,
        file_path TEXT,
        file_size_bytes INTEGER,
        file_size_mb REAL,
        arweave_tx_id TEXT,
        arns_undername TEXT,
        uploaded_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Scrape metadata table
      CREATE TABLE IF NOT EXISTS scrape_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scrape_date TEXT NOT NULL,
        total_articles INTEGER DEFAULT 0,
        new_articles INTEGER DEFAULT 0,
        updated_articles INTEGER DEFAULT 0,
        duration_seconds REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  /**
   * Upsert article (handles versions)
   */
  upsertArticle(article) {
    // Check if article exists
    const existing = this.db.prepare(`
      SELECT * FROM articles
      WHERE article_id = ?
      ORDER BY version_number DESC
      LIMIT 1
    `).get(article.article_id);

    // Generate version ID
    const versionId = existing
      ? `${article.article_id}_v${existing.version_number + 1}`
      : `${article.article_id}_v1`;

    // Determine if this is a new version
    const isNewVersion = existing && (
      existing.updated_at !== article.updated_at ||
      existing.content_text !== article.content_text
    );

    if (isNewVersion) {
      // Mark old version as not latest
      this.db.prepare(`
        UPDATE articles
        SET is_latest_version = 0
        WHERE article_id = ?
      `).run(article.article_id);

      // Insert new version
      this.db.prepare(`
        INSERT INTO articles (
          id, article_id, slug, version_number, version_timestamp, is_latest_version,
          title, description, abstract, doi, license,
          created_at, updated_at, published_at,
          content_text, content_json,
          authors_json, author_count,
          collections_json, collection_count,
          keywords_json,
          url, pdf_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        versionId,
        article.article_id,
        article.slug,
        existing.version_number + 1,
        article.updated_at,
        1, // is_latest_version
        article.title,
        article.description,
        article.abstract,
        article.doi,
        article.license,
        article.created_at,
        article.updated_at,
        article.published_at,
        article.content_text,
        article.content_json,
        article.authors_json,
        article.author_count,
        article.collections_json,
        article.collection_count,
        article.keywords_json,
        article.url,
        article.pdf_url
      );

      return { action: 'updated', versionNumber: existing.version_number + 1 };
    } else if (!existing) {
      // Insert first version
      this.db.prepare(`
        INSERT INTO articles (
          id, article_id, slug, version_number, version_timestamp, is_latest_version,
          title, description, abstract, doi, license,
          created_at, updated_at, published_at,
          content_text, content_json,
          authors_json, author_count,
          collections_json, collection_count,
          keywords_json,
          url, pdf_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        versionId,
        article.article_id,
        article.slug,
        1, // version_number
        article.updated_at,
        1, // is_latest_version
        article.title,
        article.description,
        article.abstract,
        article.doi,
        article.license,
        article.created_at,
        article.updated_at,
        article.published_at,
        article.content_text,
        article.content_json,
        article.authors_json,
        article.author_count,
        article.collections_json,
        article.collection_count,
        article.keywords_json,
        article.url,
        article.pdf_url
      );

      return { action: 'inserted', versionNumber: 1 };
    } else {
      // No changes
      return { action: 'unchanged', versionNumber: existing.version_number };
    }
  }

  /**
   * Get unexported articles
   */
  getUnexportedArticles(limit = 1000) {
    return this.db.prepare(`
      SELECT * FROM articles
      WHERE exported = 0
      ORDER BY published_at DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Get all latest articles
   */
  getLatestArticles() {
    return this.db.prepare(`
      SELECT * FROM articles
      WHERE is_latest_version = 1
      ORDER BY published_at DESC
    `).all();
  }

  /**
   * Mark articles as exported
   */
  markAsExported(articleIds, batchName) {
    const stmt = this.db.prepare(`
      UPDATE articles
      SET exported = 1, export_batch = ?, export_date = ?
      WHERE id = ?
    `);

    const exportDate = new Date().toISOString();
    const transaction = this.db.transaction((ids) => {
      for (const id of ids) {
        stmt.run(batchName, exportDate, id);
      }
    });

    transaction(articleIds);
  }

  /**
   * Record export batch
   */
  recordExportBatch(batchInfo) {
    return this.db.prepare(`
      INSERT INTO export_batches (
        batch_name, export_date, article_count, file_path,
        file_size_bytes, file_size_mb
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      batchInfo.batchName,
      batchInfo.exportDate,
      batchInfo.articleCount,
      batchInfo.filePath,
      batchInfo.fileSizeBytes,
      batchInfo.fileSizeMB
    );
  }

  /**
   * Update batch with Arweave info
   */
  updateBatchArweave(batchName, txId, undername) {
    this.db.prepare(`
      UPDATE export_batches
      SET arweave_tx_id = ?, arns_undername = ?, uploaded_at = ?
      WHERE batch_name = ?
    `).run(txId, undername, new Date().toISOString(), batchName);
  }

  /**
   * Get statistics
   */
  getStats() {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total_articles,
        SUM(CASE WHEN is_latest_version = 1 THEN 1 ELSE 0 END) as latest_articles,
        SUM(CASE WHEN exported = 0 THEN 1 ELSE 0 END) as unexported_articles,
        COUNT(DISTINCT article_id) as unique_articles,
        COUNT(DISTINCT export_batch) as total_batches
      FROM articles
    `).get();

    const batchStats = this.db.prepare(`
      SELECT
        COUNT(*) as batch_count,
        SUM(article_count) as total_exported,
        SUM(file_size_mb) as total_size_mb,
        COUNT(CASE WHEN arweave_tx_id IS NOT NULL THEN 1 END) as uploaded_batches
      FROM export_batches
    `).get();

    return { ...stats, ...batchStats };
  }

  /**
   * Get last scrape date
   */
  getLastScrapeDate() {
    const result = this.db.prepare(`
      SELECT scrape_date
      FROM scrape_metadata
      ORDER BY created_at DESC
      LIMIT 1
    `).get();

    return result ? result.scrape_date : null;
  }

  /**
   * Record scrape run
   */
  recordScrapeRun(stats) {
    return this.db.prepare(`
      INSERT INTO scrape_metadata (
        scrape_date, total_articles, new_articles, updated_articles, duration_seconds
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      stats.total,
      stats.inserted,
      stats.updated,
      stats.duration
    );
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

export default CrimRXivDatabase;
