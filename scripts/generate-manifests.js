#!/usr/bin/env node

/**
 * Manifest Generator - Arweave Manifest Pipeline (Phase 2)
 *
 * Creates Arweave manifest directories for each article:
 *   data/manifests/{slug}/
 *     ├─ metadata.json       (complete article data + ProseMirror content)
 *     └─ attachments/
 *         ├─ article.pdf
 *         └─ supplement.csv
 *
 * The app will render ProseMirror JSON directly in the browser for perfect fidelity.
 *
 * Usage:
 *   node scripts/generate-manifests.js              # Process all articles
 *   node scripts/generate-manifests.js --limit=10   # Test with 10 articles
 */

import { CrimRXivDatabase } from '../src/lib/database.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  OUTPUT_DIR: path.join(__dirname, '../data/manifests'),
  ATTACHMENTS_SOURCE_DIR: path.join(__dirname, '../data/attachments'),
};

class ManifestGenerator {
  constructor() {
    this.db = null;
    this.processedCount = 0;
    this.errorCount = 0;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    console.log('\n' + '='.repeat(80));
    console.log('📦 Arweave Manifest Generator - JSON + ProseMirror (Phase 2)');
    console.log('='.repeat(80) + '\n');

    console.log('🗄️  Initializing SQLite database...');
    this.db = new CrimRXivDatabase();
    this.db.initialize();
    console.log('✅ Database connected\n');

    // Ensure output directory exists
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
    console.log(`📁 Output directory: ${CONFIG.OUTPUT_DIR}\n`);
  }

  /**
   * Process articles needing manifest generation
   */
  async processArticles(limit = null) {
    const articles = this.db.getArticlesNeedingManifests(limit || 999999);

    if (articles.length === 0) {
      console.log('ℹ️  No articles needing manifest generation\n');
      return;
    }

    console.log(`📊 Found ${articles.length} articles needing manifests\n`);

    const startTime = Date.now();

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      console.log(`[${i + 1}/${articles.length}]`);
      console.log(`📄 Processing: ${article.slug}`);

      try {
        await this.generateManifest(article);
        this.processedCount++;
        console.log('  ✅ Complete\n');
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}\n`);
        this.errorCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('='.repeat(80));
    console.log('📊 Manifest Generation Complete');
    console.log('='.repeat(80));
    console.log(`Total articles: ${articles.length}`);
    console.log(`Generated: ${this.processedCount}`);
    console.log(`Errors: ${this.errorCount}`);
    console.log(`Time elapsed: ${duration} minutes`);
    console.log(`Output directory: ${CONFIG.OUTPUT_DIR}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Generate manifest for a single article
   */
  async generateManifest(article) {
    const manifestDir = path.join(CONFIG.OUTPUT_DIR, article.slug);

    // Create manifest directory structure
    await fs.mkdir(manifestDir, { recursive: true });
    await fs.mkdir(path.join(manifestDir, 'attachments'), { recursive: true });

    console.log(`  → Creating manifest directory...`);

    // Generate metadata.json (without content)
    const metadata = this.generateMetadataJson(article);
    const metadataJson = JSON.stringify(metadata, null, 2);

    await fs.writeFile(
      path.join(manifestDir, 'metadata.json'),
      metadataJson
    );

    const metadataSize = Buffer.byteLength(metadataJson, 'utf8');
    console.log(`  → Generated metadata.json (${(metadataSize / 1024).toFixed(2)} KB)`);

    // Generate content.json (ProseMirror document only)
    const content = this.generateContentJson(article);
    if (content) {
      const contentJson = JSON.stringify(content, null, 2);

      await fs.writeFile(
        path.join(manifestDir, 'content.json'),
        contentJson
      );

      const contentSize = Buffer.byteLength(contentJson, 'utf8');
      console.log(`  → Generated content.json (${(contentSize / 1024).toFixed(2)} KB)`);
    }

    // Copy attachments
    const attachments = JSON.parse(article.attachments_json || '[]');
    for (const attachment of attachments) {
      if (attachment.localPath) {
        const sourcePath = path.join(__dirname, '..', attachment.localPath);
        const destPath = path.join(manifestDir, 'attachments', attachment.filename);

        try {
          await fs.copyFile(sourcePath, destPath);
          console.log(`  → Copied attachment: ${attachment.filename}`);
        } catch (error) {
          console.warn(`  ⚠️  Could not copy attachment: ${attachment.filename}`);
        }
      }
    }

    // Update database
    this.db.updateArticleManifestGenerated(article.slug, manifestDir);
  }

  /**
   * Generate metadata.json (lightweight - no content)
   */
  generateMetadataJson(article) {
    const authors = JSON.parse(article.authors_json || '[]');
    const keywords = JSON.parse(article.keywords_json || '[]');
    const collections = JSON.parse(article.collections_json || '[]');
    const attachments = JSON.parse(article.attachments_json || '[]');
    const references = JSON.parse(article.references_json || '[]');
    const citations = JSON.parse(article.citations_json || '[]');

    return {
      // Article identity
      article_id: article.article_id,
      slug: article.slug,

      // Version info
      version: {
        number: article.version_number,
        timestamp: article.version_timestamp,
        is_latest: article.is_latest_version === 1,
      },

      // Core metadata
      title: article.title,
      abstract: article.abstract || article.description,
      doi: article.doi,
      license: article.license,

      // Dates
      dates: {
        created: article.created_at,
        updated: article.updated_at,
        published: article.published_at,
      },

      // Authors with affiliations
      authors: authors.map(author => ({
        name: author.name,
        orcid: author.orcid || null,
        affiliation: author.affiliation || null,
        is_corresponding: author.is_corresponding || false,
      })),

      // Keywords and collections
      keywords,
      collections,

      // Statistics
      statistics: {
        word_count: article.word_count || 0,
        attachment_count: article.attachment_count || 0,
        reference_count: article.reference_count || 0,
        citation_count: article.citation_count || 0,
      },

      // Attachments (relative paths within manifest)
      attachments: attachments.map(att => ({
        type: att.type,
        filename: att.filename,
        path: `attachments/${att.filename}`,  // Relative path in manifest
        original_url: att.url,
      })),

      // References and citations
      references,
      citations,

      // Original URLs
      urls: {
        original: article.url,
        pdf: article.pdf_url,
      },

      // Schema version for future compatibility
      schema_version: '1.0',
      created_with: 'CrimRXiv Archival Pipeline v1.0',
    };
  }

  /**
   * Generate content.json (ProseMirror document only)
   */
  generateContentJson(article) {
    if (!article.content_prosemirror) {
      return null;
    }

    try {
      return JSON.parse(article.content_prosemirror);
    } catch (error) {
      console.warn(`  ⚠️  Could not parse ProseMirror content: ${error.message}`);
      return null;
    }
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
  const generator = new ManifestGenerator();

  try {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    const limitArg = args.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

    await generator.initialize();
    await generator.processArticles(limit);
    generator.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    generator.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('generate-manifests.js');
if (isRunningDirectly) {
  main();
}

export default ManifestGenerator;
