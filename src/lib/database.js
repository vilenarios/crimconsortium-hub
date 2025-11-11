/**
 * SQLite Database - Source of Truth for CrimRxiv Data
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

export class CrimRxivDatabase {
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

    // Run migrations
    this.migrate();

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
        avatar TEXT,                     -- Institutional badge/logo URL

        -- Dates
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,

        -- Content (legacy - abstracts only)
        content_text TEXT,
        content_json TEXT,

        -- Full content fields (NEW)
        content_prosemirror TEXT,       -- ProseMirror JSON document
        content_markdown TEXT,           -- Converted Markdown
        content_text_full TEXT,          -- Plain text extraction
        word_count INTEGER,              -- Derived from content

        -- Attachment tracking
        attachments_json TEXT,           -- JSON array of {type, url, filename, arweave_tx_id}
        attachment_count INTEGER DEFAULT 0,

        -- DOI references & citations
        references_json TEXT,            -- Outbound edges (references this article cites)
        citations_json TEXT,             -- Inbound edges (articles citing this one)
        reference_count INTEGER DEFAULT 0,
        citation_count INTEGER DEFAULT 0,

        -- Article file tracking
        article_markdown_path TEXT,      -- Local path to generated Markdown
        article_markdown_size INTEGER,   -- File size in bytes

        -- Status tracking
        full_content_scraped INTEGER DEFAULT 0,
        full_content_scraped_at TEXT,
        markdown_generated INTEGER DEFAULT 0,
        markdown_generated_at TEXT,

        -- Authors (JSON array)
        authors_json TEXT,
        author_count INTEGER DEFAULT 0,

        -- Collections (JSON array)
        collections_json TEXT,
        collection_count INTEGER DEFAULT 0,

        -- Keywords (JSON array)
        keywords_json TEXT,

        -- External publications (version-of relationships)
        external_publications_json TEXT,

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
   * Migrate existing database to add new fields
   */
  migrate() {
    console.log('🔄 Running database migration...');

    // Check if columns already exist
    const tableInfo = this.db.prepare("PRAGMA table_info(articles)").all();
    const existingColumns = new Set(tableInfo.map(col => col.name));

    const newColumns = [
      { name: 'content_prosemirror', type: 'TEXT' },
      { name: 'content_markdown', type: 'TEXT' },
      { name: 'content_text_full', type: 'TEXT' },
      { name: 'word_count', type: 'INTEGER' },
      { name: 'attachments_json', type: 'TEXT' },
      { name: 'attachment_count', type: 'INTEGER DEFAULT 0' },
      { name: 'references_json', type: 'TEXT' },
      { name: 'citations_json', type: 'TEXT' },
      { name: 'reference_count', type: 'INTEGER DEFAULT 0' },
      { name: 'citation_count', type: 'INTEGER DEFAULT 0' },
      { name: 'external_publications_json', type: 'TEXT' },
      { name: 'article_markdown_path', type: 'TEXT' },
      { name: 'article_markdown_size', type: 'INTEGER' },
      { name: 'full_content_scraped', type: 'INTEGER DEFAULT 0' },
      { name: 'full_content_scraped_at', type: 'TEXT' },
      { name: 'markdown_generated', type: 'INTEGER DEFAULT 0' },
      { name: 'markdown_generated_at', type: 'TEXT' },
      // Manifest tracking fields
      { name: 'manifest_tx_id', type: 'TEXT' },
      { name: 'manifest_path', type: 'TEXT' },
      { name: 'manifest_generated', type: 'INTEGER DEFAULT 0' },
      { name: 'manifest_generated_at', type: 'TEXT' },
      { name: 'manifest_uploaded', type: 'INTEGER DEFAULT 0' },
      { name: 'manifest_uploaded_at', type: 'TEXT' },
      // Institutional badge/logo
      { name: 'avatar', type: 'TEXT' },
    ];

    let migrationCount = 0;
    for (const col of newColumns) {
      if (!existingColumns.has(col.name)) {
        console.log(`  Adding column: ${col.name}`);
        this.db.exec(`ALTER TABLE articles ADD COLUMN ${col.name} ${col.type}`);
        migrationCount++;
      }
    }

    if (migrationCount > 0) {
      console.log(`✅ Migration complete: Added ${migrationCount} columns`);
    } else {
      console.log('✅ Database is up to date');
    }
  }

  /**
   * Update article with full content
   */
  updateArticleFullContent(data) {
    return this.db.prepare(`
      UPDATE articles
      SET
        content_prosemirror = ?,
        content_markdown = ?,
        content_text_full = ?,
        word_count = ?,
        attachments_json = ?,
        attachment_count = ?,
        references_json = ?,
        citations_json = ?,
        reference_count = ?,
        citation_count = ?,
        full_content_scraped = 1,
        full_content_scraped_at = ?
      WHERE slug = ? AND is_latest_version = 1
    `).run(
      data.content_prosemirror,
      data.content_markdown,
      data.content_text_full,
      data.word_count,
      data.attachments_json,
      data.attachment_count,
      data.references_json,
      data.citations_json,
      data.reference_count,
      data.citation_count,
      new Date().toISOString(),
      data.slug
    );
  }

  /**
   * Update article markdown generation status
   */
  updateArticleMarkdown(slug, markdownPath, markdownSize) {
    return this.db.prepare(`
      UPDATE articles
      SET
        article_markdown_path = ?,
        article_markdown_size = ?,
        markdown_generated = 1,
        markdown_generated_at = ?
      WHERE slug = ? AND is_latest_version = 1
    `).run(markdownPath, markdownSize, new Date().toISOString(), slug);
  }

  /**
   * Update article Arweave transaction ID
   */
  updateArticleArweave(slug, txId) {
    return this.db.prepare(`
      UPDATE articles
      SET arweave_tx_id = ?
      WHERE slug = ? AND is_latest_version = 1
    `).run(txId, slug);
  }

  /**
   * Get articles needing full content scraping
   */
  getArticlesNeedingFullContent(limit = 100) {
    return this.db.prepare(`
      SELECT *
      FROM articles
      WHERE is_latest_version = 1
        AND full_content_scraped = 0
      ORDER BY published_at DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Get articles needing markdown generation
   */
  getArticlesNeedingMarkdown(limit = 100) {
    return this.db.prepare(`
      SELECT *
      FROM articles
      WHERE is_latest_version = 1
        AND full_content_scraped = 1
        AND markdown_generated = 0
      ORDER BY published_at DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Get articles needing Arweave upload
   */
  getArticlesNeedingUpload(limit = 100) {
    return this.db.prepare(`
      SELECT *
      FROM articles
      WHERE is_latest_version = 1
        AND markdown_generated = 1
        AND arweave_tx_id IS NULL
      ORDER BY published_at DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Update article manifest generation status
   */
  updateArticleManifestGenerated(slug, manifestPath) {
    return this.db.prepare(`
      UPDATE articles
      SET
        manifest_path = ?,
        manifest_generated = 1,
        manifest_generated_at = ?
      WHERE slug = ? AND is_latest_version = 1
    `).run(manifestPath, new Date().toISOString(), slug);
  }

  /**
   * Update article manifest upload status with TX ID
   */
  updateArticleManifestUploaded(slug, manifestTxId) {
    return this.db.prepare(`
      UPDATE articles
      SET
        manifest_tx_id = ?,
        manifest_uploaded = 1,
        manifest_uploaded_at = ?
      WHERE slug = ? AND is_latest_version = 1
    `).run(manifestTxId, new Date().toISOString(), slug);
  }

  /**
   * Get articles needing manifest generation
   */
  getArticlesNeedingManifests(limit = 100) {
    return this.db.prepare(`
      SELECT *
      FROM articles
      WHERE is_latest_version = 1
        AND full_content_scraped = 1
        AND manifest_generated = 0
      ORDER BY published_at DESC
      LIMIT ?
    `).all(limit);
  }

  /**
   * Get articles needing manifest upload to Arweave
   */
  getArticlesNeedingManifestUpload(limit = 100) {
    return this.db.prepare(`
      SELECT *
      FROM articles
      WHERE is_latest_version = 1
        AND manifest_generated = 1
        AND manifest_uploaded = 0
      ORDER BY published_at DESC
      LIMIT ?
    `).all(limit);
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
      const hasFullContent = article.content_prosemirror ? 1 : 0;
      const scrapedAt = hasFullContent ? new Date().toISOString() : null;

      this.db.prepare(`
        INSERT INTO articles (
          id, article_id, slug, version_number, version_timestamp, is_latest_version,
          title, description, abstract, doi, license, avatar,
          created_at, updated_at, published_at,
          content_text, content_json,
          content_prosemirror, content_markdown, content_text_full, word_count,
          authors_json, author_count,
          collections_json, collection_count,
          keywords_json,
          external_publications_json,
          attachments_json, attachment_count,
          full_content_scraped, full_content_scraped_at,
          url, pdf_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        article.avatar || null,
        article.created_at,
        article.updated_at,
        article.published_at,
        article.content_text,
        article.content_json,
        article.content_prosemirror || null,
        article.content_markdown || null,
        article.content_text_full || null,
        article.word_count || 0,
        article.authors_json,
        article.author_count,
        article.collections_json,
        article.collection_count,
        article.keywords_json,
        article.external_publications_json || null,
        article.attachments_json,
        article.attachment_count,
        hasFullContent,
        scrapedAt,
        article.url,
        article.pdf_url
      );

      return { action: 'updated', versionNumber: existing.version_number + 1 };
    } else if (!existing) {
      // Insert first version
      const hasFullContent = article.content_prosemirror ? 1 : 0;
      const scrapedAt = hasFullContent ? new Date().toISOString() : null;

      this.db.prepare(`
        INSERT INTO articles (
          id, article_id, slug, version_number, version_timestamp, is_latest_version,
          title, description, abstract, doi, license, avatar,
          created_at, updated_at, published_at,
          content_text, content_json,
          content_prosemirror, content_markdown, content_text_full, word_count,
          authors_json, author_count,
          collections_json, collection_count,
          keywords_json,
          external_publications_json,
          attachments_json, attachment_count,
          full_content_scraped, full_content_scraped_at,
          url, pdf_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        article.avatar || null,
        article.created_at,
        article.updated_at,
        article.published_at,
        article.content_text,
        article.content_json,
        article.content_prosemirror || null,
        article.content_markdown || null,
        article.content_text_full || null,
        article.word_count || 0,
        article.authors_json,
        article.author_count,
        article.collections_json,
        article.collection_count,
        article.keywords_json,
        article.external_publications_json || null,
        article.attachments_json,
        article.attachment_count,
        hasFullContent,
        scrapedAt,
        article.url,
        article.pdf_url
      );

      return { action: 'inserted', versionNumber: 1 };
    } else {
      // No content changes, but update attachments, collections, authors, avatar, and/or content if provided
      const needsUpdate =
        (article.avatar && article.avatar !== existing.avatar) ||
        (article.attachments_json && article.attachments_json !== existing.attachments_json) ||
        (article.abstract && article.abstract.length > (existing.abstract?.length || 0)) ||
        (article.content_prosemirror && !existing.content_prosemirror) ||
        (article.content_text_full && article.content_text_full.length > (existing.content_text_full?.length || 0)) ||
        (article.collections_json && article.collections_json !== existing.collections_json) ||
        (article.authors_json && article.authors_json !== existing.authors_json) ||
        (article.keywords_json && article.keywords_json !== existing.keywords_json) ||
        (article.external_publications_json && article.external_publications_json !== existing.external_publications_json);

      if (needsUpdate) {
        const hasFullContent = article.content_prosemirror ? 1 : (existing.content_prosemirror ? 1 : 0);
        const scrapedAt = hasFullContent ? new Date().toISOString() : existing.full_content_scraped_at;

        this.db.prepare(`
          UPDATE articles
          SET attachments_json = ?,
              attachment_count = ?,
              abstract = CASE
                WHEN LENGTH(?) > LENGTH(COALESCE(abstract, '')) THEN ?
                ELSE abstract
              END,
              content_prosemirror = COALESCE(?, content_prosemirror),
              content_markdown = COALESCE(?, content_markdown),
              content_text_full = CASE
                WHEN LENGTH(?) > LENGTH(COALESCE(content_text_full, '')) THEN ?
                ELSE content_text_full
              END,
              word_count = CASE
                WHEN ? > word_count THEN ?
                ELSE word_count
              END,
              collections_json = ?,
              collection_count = ?,
              authors_json = ?,
              author_count = ?,
              keywords_json = ?,
              external_publications_json = COALESCE(?, external_publications_json),
              avatar = COALESCE(?, avatar),
              full_content_scraped = ?,
              full_content_scraped_at = ?
          WHERE id = ?
        `).run(
          article.attachments_json,
          article.attachment_count || 0,
          article.abstract || '',
          article.abstract || '',
          article.content_prosemirror,
          article.content_markdown,
          article.content_text_full || '',
          article.content_text_full || '',
          article.word_count || 0,
          article.word_count || 0,
          article.collections_json || '[]',
          article.collection_count || 0,
          article.authors_json || '[]',
          article.author_count || 0,
          article.keywords_json || '[]',
          article.external_publications_json,
          article.avatar,
          hasFullContent,
          scrapedAt,
          existing.id
        );

        return { action: 'attachments_updated', versionNumber: existing.version_number };
      }

      // Truly no changes
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
   * Get single article by slug (latest version)
   */
  getArticleBySlug(slug) {
    return this.db.prepare(`
      SELECT * FROM articles
      WHERE slug = ? AND is_latest_version = 1
      LIMIT 1
    `).get(slug);
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
   * Update manifest_tx_id for an article by slug
   * Used after uploading article folder to Arweave
   */
  updateManifestTxId(slug, manifestTxId) {
    try {
      const result = this.db.prepare(`
        UPDATE articles
        SET manifest_tx_id = ?
        WHERE slug = ? AND is_latest_version = 1
      `).run(manifestTxId, slug);

      return result.changes > 0;
    } catch (error) {
      console.error(`Failed to update manifest_tx_id for ${slug}:`, error);
      return false;
    }
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

export default CrimRxivDatabase;
