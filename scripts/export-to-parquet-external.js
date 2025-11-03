#!/usr/bin/env node

/**
 * SQLite → Parquet Exporter (External Architecture)
 *
 * Architecture:
 * - SQLite is source of truth
 * - Parquet files are read-only exports for browser consumption
 * - Exports to data/export/ (not public/data/)
 * - Parquet file is uploaded to Arweave and accessed via ArNS undername
 *
 * Generates:
 * - metadata.parquet (~5MB) - All latest articles with manifest_tx_id references
 *
 * Usage:
 *   npm run export
 */

import { CrimRXivDatabase } from '../src/lib/database.js';
import duckdb from 'duckdb';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  OUTPUT_DIR: path.join(__dirname, '../data/export'),  // Export to data/export/ for uploading
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
    console.log('SQLite → Parquet Exporter (External Architecture)');
    console.log('='.repeat(60) + '\n');

    // Initialize SQLite
    console.log('🗄️  Opening SQLite database...');
    this.db = new CrimRXivDatabase();
    this.db.initialize();

    // Initialize DuckDB for Parquet export
    console.log('🦆 Initializing DuckDB...');
    this.duckDb = new duckdb.Database(':memory:');
    this.duckConn = this.duckDb.connect();

    // Ensure output directory exists
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });

    console.log('✅ Connections established\n');
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

    // Add has_multiple_versions flag and full abstract
    const enrichedArticles = latestArticles.map(article => ({
      ...article,
      has_multiple_versions: (versionCounts[article.article_id] || 1) > 1,
      abstract: article.abstract || '',
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
            abstract VARCHAR,
            abstract_preview VARCHAR,
            authors_json VARCHAR,
            author_count INTEGER,
            keywords_json VARCHAR,
            collections_json VARCHAR,
            collection_count INTEGER,
            doi VARCHAR,
            license VARCHAR,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            published_at TIMESTAMP,
            url VARCHAR,
            pdf_url VARCHAR,
            version_number INTEGER,
            version_timestamp TIMESTAMP,
            has_multiple_versions BOOLEAN,
            manifest_tx_id VARCHAR,
            word_count INTEGER,
            attachment_count INTEGER,
            reference_count INTEGER,
            citation_count INTEGER
          )
        `, (err) => {
          if (err) return reject(err);

          const stmt = this.duckConn.prepare(`
            INSERT INTO metadata_temp VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?
            )
          `);

          for (const article of enrichedArticles) {
            stmt.run(
              article.article_id,
              article.slug,
              article.title,
              article.description,
              article.abstract,
              article.abstract_preview,
              article.authors_json,
              article.author_count,
              article.keywords_json,
              article.collections_json,
              article.collection_count,
              article.doi,
              article.license,
              article.created_at,
              article.updated_at,
              article.published_at,
              article.url,
              article.pdf_url,
              article.version_number,
              article.version_timestamp,
              article.has_multiple_versions,
              article.manifest_tx_id,
              article.word_count || 0,
              article.attachment_count || 0,
              article.reference_count || 0,
              article.citation_count || 0
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

            resolve({ articles: latestArticles.length, sizeMB });
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

    // Export metadata
    const result = await this.exportMetadata();

    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const stats = this.db.getStats();

    console.log('='.repeat(60));
    console.log('✅ EXPORT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Articles Exported: ${result.articles}`);
    console.log(`File Size: ${result.sizeMB} MB`);
    console.log(`Duration: ${duration} seconds`);
    console.log('');
    console.log('Database Statistics:');
    console.log(`  Total Articles: ${stats.total_articles}`);
    console.log(`  Latest Versions: ${stats.latest_articles}`);
    console.log('');
    console.log('Output File:');
    console.log(`  ${CONFIG.OUTPUT_DIR}/metadata.parquet`);
    console.log('='.repeat(60) + '\n');

    console.log('💡 Next steps:');
    console.log('  1. Upload parquet to Arweave:  npm run upload:parquet');
    console.log('  2. Upload WASM files:          npm run upload:wasm');
    console.log('  3. Configure ArNS undername:   data_crimrxiv.arweave.net → TX_ID');
    console.log('  4. Update .env with TX IDs');
    console.log('  5. Test locally:               npm run preview');
    console.log('  6. Deploy app to Arweave:      npm run deploy\n');
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
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('export-to-parquet-external.js');
if (isRunningDirectly) {
  main();
}

export default ParquetExporter;
