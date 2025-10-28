#!/usr/bin/env node

/**
 * SQLite → Parquet Exporter
 *
 * Architecture (per PATTERN_GUIDE.md):
 * - SQLite is source of truth
 * - Parquet files are read-only exports
 * - Never update Parquet directly, always re-export from SQLite
 *
 * Generates:
 * 1. metadata.parquet (~5MB) - All latest articles, points to batches
 * 2. articles/batch-NNN.parquet (~30MB each) - Full article data
 *
 * Usage:
 *   node scripts/export-to-parquet.js
 */

import { CrimRXivDatabase } from '../src/lib/database.js';
import duckdb from 'duckdb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  OUTPUT_DIR: path.join(__dirname, '../data/parquet'),
  ARTICLES_PER_BATCH: 1000,  // Target ~30MB per batch
  COMPRESSION: 'ZSTD',       // Best for web delivery
  ROW_GROUP_SIZE: 100000     // Optimize for queries
};

class ParquetExporter {
  constructor() {
    this.db = null;
    this.duckDb = null;
    this.duckConn = null;
  }

  /**
   * Initialize connections
   */
  async initialize() {
    console.log('\n' + '='.repeat(60));
    console.log('SQLite → Parquet Exporter');
    console.log('='.repeat(60) + '\n');

    // Initialize SQLite
    console.log('🗄️  Opening SQLite database...');
    this.db = new CrimRXivDatabase();
    this.db.initialize();

    // Initialize DuckDB for Parquet export
    console.log('🦆 Initializing DuckDB...');
    this.duckDb = new duckdb.Database(':memory:');
    this.duckConn = this.duckDb.connect();

    // Ensure output directories exist
    await fs.mkdir(path.join(CONFIG.OUTPUT_DIR, 'articles'), { recursive: true });

    console.log('✅ Connections established\n');
  }

  /**
   * Export article batches
   */
  async exportBatches() {
    // Get unexported articles
    const unexported = this.db.getUnexportedArticles(999999);

    if (unexported.length === 0) {
      console.log('ℹ️  No unexported articles found\n');
      return [];
    }

    console.log(`📦 Found ${unexported.length} unexported articles\n`);

    // Calculate batches
    const batchCount = Math.ceil(unexported.length / CONFIG.ARTICLES_PER_BATCH);
    const exportDate = new Date().toISOString().split('T')[0];
    const batches = [];

    console.log(`📊 Creating ${batchCount} batch file(s)...\n`);

    // Export each batch
    for (let i = 0; i < batchCount; i++) {
      const start = i * CONFIG.ARTICLES_PER_BATCH;
      const end = Math.min(start + CONFIG.ARTICLES_PER_BATCH, unexported.length);
      const batchArticles = unexported.slice(start, end);

      const batchName = `${exportDate}_batch-${String(i + 1).padStart(3, '0')}`;
      const outputPath = path.join(CONFIG.OUTPUT_DIR, 'articles', `${batchName}.parquet`);

      console.log(`  📝 Batch ${i + 1}/${batchCount}: ${batchName}`);
      console.log(`     Articles: ${batchArticles.length}`);

      // Write batch to Parquet
      await this.writeBatchParquet(batchArticles, outputPath);

      // Get file stats
      const stats = await fs.stat(outputPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      console.log(`     Size: ${sizeMB} MB`);
      console.log(`     ✅ Written\n`);

      // Record in database
      this.db.recordExportBatch({
        batchName,
        exportDate: new Date().toISOString(),
        articleCount: batchArticles.length,
        filePath: outputPath,
        fileSizeBytes: stats.size,
        fileSizeMB: parseFloat(sizeMB)
      });

      // Mark articles as exported
      this.db.markAsExported(
        batchArticles.map(a => a.id),
        batchName
      );

      batches.push({
        batchName,
        articleCount: batchArticles.length,
        sizeMB: parseFloat(sizeMB),
        path: outputPath
      });
    }

    return batches;
  }

  /**
   * Write batch to Parquet file
   */
  async writeBatchParquet(articles, outputPath) {
    return new Promise((resolve, reject) => {
      // Create temporary table
      this.duckConn.run('DROP TABLE IF EXISTS articles_temp', (err) => {
        if (err) return reject(err);

        // Create table
        this.duckConn.run(`
          CREATE TABLE articles_temp (
            id VARCHAR,
            article_id VARCHAR,
            slug VARCHAR,
            version_number INTEGER,
            version_timestamp TIMESTAMP,
            is_latest_version BOOLEAN,
            title VARCHAR,
            description VARCHAR,
            abstract VARCHAR,
            doi VARCHAR,
            license VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            published_at TIMESTAMP,
            content_text VARCHAR,
            content_json VARCHAR,
            authors_json VARCHAR,
            author_count INTEGER,
            collections_json VARCHAR,
            collection_count INTEGER,
            keywords_json VARCHAR,
            url VARCHAR,
            pdf_url VARCHAR
          )
        `, (err) => {
          if (err) return reject(err);

          // Prepare insert statement
          const stmt = this.duckConn.prepare(`
            INSERT INTO articles_temp VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `);

          // Insert all articles
          for (const article of articles) {
            stmt.run(
              article.id,
              article.article_id,
              article.slug,
              article.version_number,
              article.version_timestamp,
              article.is_latest_version ? true : false,
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
          }

          stmt.finalize();

          // Export to Parquet
          this.duckConn.run(`
            COPY (SELECT * FROM articles_temp ORDER BY published_at DESC)
            TO '${outputPath.replace(/\\/g, '/')}'
            (FORMAT PARQUET, COMPRESSION '${CONFIG.COMPRESSION}', ROW_GROUP_SIZE ${CONFIG.ROW_GROUP_SIZE})
          `, (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    });
  }

  /**
   * Export metadata.parquet
   */
  async exportMetadata() {
    console.log('📋 Exporting metadata.parquet...\n');

    const latestArticles = this.db.getLatestArticles();

    if (latestArticles.length === 0) {
      console.log('⚠️  No articles to export\n');
      return;
    }

    const outputPath = path.join(CONFIG.OUTPUT_DIR, 'metadata.parquet');

    // Check for multiple versions
    const versionCounts = {};
    this.db.db.prepare(`
      SELECT article_id, COUNT(*) as count
      FROM articles
      GROUP BY article_id
      HAVING count > 1
    `).all().forEach(row => {
      versionCounts[row.article_id] = row.count;
    });

    // Add has_multiple_versions flag
    const enrichedArticles = latestArticles.map(article => ({
      ...article,
      has_multiple_versions: (versionCounts[article.article_id] || 1) > 1,
      abstract_preview: article.abstract ? article.abstract.substring(0, 500) : ''
    }));

    return new Promise((resolve, reject) => {
      // Create temporary table
      this.duckConn.run('DROP TABLE IF EXISTS metadata_temp', (err) => {
        if (err) return reject(err);

        this.duckConn.run(`
          CREATE TABLE metadata_temp (
            article_id VARCHAR,
            slug VARCHAR,
            title VARCHAR,
            description VARCHAR,
            abstract_preview VARCHAR,
            authors_json VARCHAR,
            author_count INTEGER,
            keywords_json VARCHAR,
            collections_json VARCHAR,
            collection_count INTEGER,
            doi VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            published_at TIMESTAMP,
            url VARCHAR,
            version_number INTEGER,
            version_timestamp TIMESTAMP,
            has_multiple_versions BOOLEAN,
            export_batch VARCHAR,
            arweave_tx_id VARCHAR
          )
        `, (err) => {
          if (err) return reject(err);

          const stmt = this.duckConn.prepare(`
            INSERT INTO metadata_temp VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `);

          for (const article of enrichedArticles) {
            stmt.run(
              article.article_id,
              article.slug,
              article.title,
              article.description,
              article.abstract_preview,
              article.authors_json,
              article.author_count,
              article.keywords_json,
              article.collections_json,
              article.collection_count,
              article.doi,
              article.created_at,
              article.updated_at,
              article.published_at,
              article.url,
              article.version_number,
              article.version_timestamp,
              article.has_multiple_versions,
              article.export_batch,
              article.arweave_tx_id
            );
          }

          stmt.finalize();

          // Export to Parquet
          this.duckConn.run(`
            COPY (SELECT * FROM metadata_temp ORDER BY published_at DESC)
            TO '${outputPath.replace(/\\/g, '/')}'
            (FORMAT PARQUET, COMPRESSION '${CONFIG.COMPRESSION}')
          `, async (err) => {
            if (err) return reject(err);

            const stats = await fs.stat(outputPath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

            console.log(`  📊 Articles: ${latestArticles.length}`);
            console.log(`  💾 Size: ${sizeMB} MB`);
            console.log(`  ✅ Written: ${outputPath}\n`);

            resolve();
          });
        });
      });
    });
  }

  /**
   * Main export workflow
   */
  async export() {
    const startTime = Date.now();

    // Export article batches
    const batches = await this.exportBatches();

    // Export metadata
    await this.exportMetadata();

    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const stats = this.db.getStats();

    console.log('='.repeat(60));
    console.log('✅ EXPORT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Batches Created: ${batches.length}`);
    console.log(`Total Exported: ${batches.reduce((sum, b) => sum + b.articleCount, 0)} articles`);
    console.log(`Total Size: ${batches.reduce((sum, b) => sum + b.sizeMB, 0).toFixed(2)} MB`);
    console.log(`Duration: ${duration} seconds`);
    console.log('');
    console.log('Database Statistics:');
    console.log(`  Total Articles: ${stats.total_articles}`);
    console.log(`  Latest Versions: ${stats.latest_articles}`);
    console.log(`  Unexported: ${stats.unexported_articles}`);
    console.log(`  Batches: ${stats.total_batches}`);
    console.log('');
    console.log('Output Files:');
    console.log(`  Metadata: data/parquet/metadata.parquet`);
    batches.forEach(b => {
      console.log(`  Batch: data/parquet/articles/${b.batchName}.parquet (${b.sizeMB} MB)`);
    });
    console.log('='.repeat(60) + '\n');

    console.log('💡 Next steps:');
    console.log('  1. Deploy to Arweave: npm run deploy');
    console.log('  2. Configure ArNS undernames for each batch\n');
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.duckConn) {
      this.duckConn.close();
    }
    if (this.duckDb) {
      this.duckDb.close();
    }
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const exporter = new ParquetExporter();

  try {
    await exporter.initialize();
    await exporter.export();
    await exporter.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    await exporter.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('export-to-parquet.js');
if (isRunningDirectly) {
  main();
}

export default ParquetExporter;
