#!/usr/bin/env node

/**
 * CrimRXiv Import → data/articles/
 *
 * Simplified workflow:
 * 1. Scrapes CrimRXiv using PubPub SDK
 * 2. Saves ALL content to data/articles/{slug}/
 *    - metadata.json (full article metadata)
 *    - content.json (ProseMirror content)
 *    - article.md (markdown version)
 *    - article.html (HTML version - optional)
 *    - attachments/{filename} (PDFs and other media)
 * 3. Saves metadata to SQLite (for querying + manifest_tx_id storage)
 *
 * Usage:
 *   npm run import
 *   node scripts/import-to-articles.js --limit 10  # Test mode
 */

import 'dotenv/config';
import { PubPub } from '@pubpub/sdk';
import { CrimRXivDatabase } from '../src/lib/database.js';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  BATCH_SIZE: 100,
  TEXT_DELAY: 100,
  MAX_RETRIES: 3,
  INITIAL_BACKOFF: 2000,
  MAX_BACKOFF: 30000,
  ARTICLES_DIR: path.join(__dirname, '../data/articles'),  // Changed!
  DOWNLOAD_TIMEOUT: 60000
};

class CrimRXivImporter {
  constructor() {
    this.sdk = null;
    this.db = null;
    this.collections = new Map();
    this.stats = {
      total: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
      attachments_downloaded: 0,
      attachments_failed: 0,
      folders_created: 0
    };
  }

  /**
   * Convert ProseMirror to Markdown (simplified)
   */
  prosemirrorToMarkdown(doc) {
    // For now, just extract plain text
    // Full markdown serialization can be added later if needed
    return this.extractTextFromProseMirror(doc);
  }

  /**
   * Extract plain text from ProseMirror
   */
  extractTextFromProseMirror(doc) {
    let text = '';
    const extractNode = (node) => {
      if (node.text) text += node.text + ' ';
      if (node.content) node.content.forEach(extractNode);
    };
    if (doc && doc.content) doc.content.forEach(extractNode);
    return text.trim();
  }

  /**
   * Extract abstract from ProseMirror document
   * Looks for content labeled "Abstract" or extracts first few paragraphs
   */
  extractAbstractFromProseMirror(doc) {
    if (!doc || !doc.content) return '';

    let abstractText = '';
    let foundAbstractHeading = false;
    let paragraphsAfterAbstract = 0;

    for (const node of doc.content) {
      // Check if this is an "Abstract" heading
      if (node.type === 'heading' && node.content) {
        const headingText = node.content.map(n => n.text).join('').toLowerCase();
        if (headingText.includes('abstract')) {
          foundAbstractHeading = true;
          continue;
        } else if (foundAbstractHeading) {
          // Stop when we hit another heading after abstract
          break;
        }
      }

      // Extract paragraph content
      if (node.type === 'paragraph' && node.content) {
        const paragraphText = node.content.map(n => n.text || '').join('').trim();

        if (foundAbstractHeading) {
          // Collect paragraphs under "Abstract" heading
          if (paragraphText) {
            abstractText += paragraphText + '\n\n';
            paragraphsAfterAbstract++;
          }

          // Stop after collecting 3-5 paragraphs
          if (paragraphsAfterAbstract >= 5) break;
        } else if (abstractText.length < 1500 && paragraphText.length > 50) {
          // If no "Abstract" heading found, collect first few substantial paragraphs
          // Skip very short paragraphs (likely not abstract)
          abstractText += paragraphText + '\n\n';
        }
      }

      // Stop if we've collected enough content
      if (abstractText.length > 2000) break;
    }

    return abstractText.trim();
  }

  /**
   * Extract file attachments from ProseMirror
   */
  extractFilesFromProseMirror(doc) {
    const files = [];
    const findFiles = (node) => {
      if (node.type === 'file' && node.attrs) {
        files.push({
          url: node.attrs.url,
          filename: node.attrs.fileName,
          fileSize: node.attrs.fileSize,
          type: node.attrs.url?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'
        });
      }
      if (node.content) node.content.forEach(findFiles);
    };
    if (doc && doc.content) doc.content.forEach(findFiles);
    return files;
  }

  /**
   * Process external publications (version-of relationships)
   * Fetches full details for each outbound edge using pubEdge.get()
   */
  async processExternalPublications(pub) {
    const externalPubs = [];

    // Check if pub has outbound edges
    if (!pub.outboundEdges || pub.outboundEdges.length === 0) {
      return externalPubs;
    }

    console.log(`   📎 Processing ${pub.outboundEdges.length} outbound edge(s)...`);

    for (const edge of pub.outboundEdges) {
      if (edge.externalPublicationId) {
        try {
          // Fetch full edge details including nested externalPublication
          const edgeResponse = await this.sdk.pubEdge.get({
            params: { id: edge.id }
          });

          // Add delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, CONFIG.TEXT_DELAY));

          if (edgeResponse.body && edgeResponse.body.externalPublication) {
            const extPub = edgeResponse.body.externalPublication;
            externalPubs.push({
              externalPublicationId: edge.externalPublicationId,
              relationType: edge.relationType,
              title: extPub.title,
              url: extPub.url,
              description: extPub.description,
              doi: extPub.doi,
              publicationDate: extPub.publicationDate
            });
            console.log(`      ✅ External pub: ${extPub.title?.substring(0, 60) || 'Untitled'}...`);
          }
        } catch (error) {
          console.error(`      ❌ Failed to fetch edge ${edge.id}:`, error.message);
        }
      }
    }

    return externalPubs;
  }

  /**
   * Download attachment (PDF or other media)
   */
  async downloadAttachment(url, filename, articleDir) {
    try {
      const attachmentsDir = path.join(articleDir, 'attachments');
      await fs.ensureDir(attachmentsDir);

      const filePath = path.join(attachmentsDir, filename);

      // Skip if already exists
      if (await fs.pathExists(filePath)) {
        return { success: true, path: filePath, skipped: true };
      }

      console.log(`    📥 Downloading: ${filename}`);

      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: CONFIG.DOWNLOAD_TIMEOUT,
        maxRedirects: 5
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      this.stats.attachments_downloaded++;
      return { success: true, path: filePath };
    } catch (error) {
      console.error(`    ❌ Failed to download ${filename}:`, error.message);
      this.stats.attachments_failed++;
      return { success: false, error: error.message };
    }
  }

  /**
   * Save a specific version to data/articles/{slug}/{releaseNumber}/
   */
  async saveVersionFolder(articleDir, releaseNumber, metadata, prosemirrorContent) {
    try {
      const versionDir = path.join(articleDir, String(releaseNumber));
      await fs.ensureDir(versionDir);

      // 1. Save metadata.json
      await fs.writeJSON(path.join(versionDir, 'metadata.json'), metadata, { spaces: 2 });

      // 2. Save content.json (ProseMirror)
      if (prosemirrorContent) {
        await fs.writeJSON(path.join(versionDir, 'content.json'), prosemirrorContent, { spaces: 2 });

        // 3. Save article.md (Markdown)
        try {
          const markdown = this.prosemirrorToMarkdown(prosemirrorContent);
          if (markdown) {
            await fs.writeFile(path.join(versionDir, 'article.md'), markdown, 'utf-8');
          }
        } catch (error) {
          console.warn(`    ⚠️  Could not generate markdown for release ${releaseNumber}:`, error.message);
        }
      }

      // 4. Download attachments
      const files = this.extractFilesFromProseMirror(prosemirrorContent);
      const attachments = [];

      for (const file of files) {
        if (file.url && file.filename) {
          const result = await this.downloadAttachment(file.url, file.filename, versionDir);
          if (result.success) {
            attachments.push({
              filename: file.filename,
              path: `attachments/${file.filename}`,
              size: file.fileSize,
              type: file.type,
              url: file.url
            });
          }
        }
      }

      // 5. Save attachments manifest
      if (attachments.length > 0) {
        await fs.writeJSON(path.join(versionDir, 'attachments.json'), attachments, { spaces: 2 });
      }

      return { success: true, attachments };
    } catch (error) {
      console.error(`    ❌ Failed to save version ${releaseNumber}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save article to data/articles/{slug}/
   */
  async saveArticleFolder(article, prosemirrorContent) {
    try {
      const articleDir = path.join(CONFIG.ARTICLES_DIR, article.slug);
      await fs.ensureDir(articleDir);

      // 1. Save metadata.json
      const metadata = {
        id: article.article_id,
        slug: article.slug,
        title: article.title,
        abstract: article.abstract,
        description: article.description,
        authors: JSON.parse(article.authors_json || '[]'),
        keywords: JSON.parse(article.keywords_json || '[]'),
        collections: JSON.parse(article.collections_json || '[]'),
        doi: article.doi,
        license: article.license,
        dates: {
          created: article.created_at,
          updated: article.updated_at,
          published: article.published_at
        },
        urls: {
          canonical: article.url,
          pdf: article.pdf_url
        },
        statistics: {
          wordCount: article.word_count || 0,
          authorCount: article.author_count || 0,
          attachmentCount: article.attachment_count || 0
        }
      };

      await fs.writeJSON(path.join(articleDir, 'metadata.json'), metadata, { spaces: 2 });

      // 2. Save content.json (ProseMirror)
      if (prosemirrorContent) {
        await fs.writeJSON(path.join(articleDir, 'content.json'), prosemirrorContent, { spaces: 2 });

        // 3. Save article.md (Markdown)
        try {
          const markdown = this.prosemirrorToMarkdown(prosemirrorContent);
          if (markdown) {
            await fs.writeFile(path.join(articleDir, 'article.md'), markdown, 'utf-8');
          }
        } catch (error) {
          console.warn(`    ⚠️  Could not generate markdown:`, error.message);
        }
      }

      // 4. Download attachments (PDFs and other media)
      const files = this.extractFilesFromProseMirror(prosemirrorContent);
      const attachments = [];

      for (const file of files) {
        if (file.url && file.filename) {
          const result = await this.downloadAttachment(file.url, file.filename, articleDir);
          if (result.success) {
            attachments.push({
              filename: file.filename,
              path: `attachments/${file.filename}`,
              size: file.fileSize,
              type: file.type,
              url: file.url
            });
          }
        }
      }

      // 5. Save attachments manifest
      if (attachments.length > 0) {
        await fs.writeJSON(path.join(articleDir, 'attachments.json'), attachments, { spaces: 2 });
      }

      this.stats.folders_created++;
      return { success: true, attachments };
    } catch (error) {
      console.error(`    ❌ Failed to save article folder:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize SDK and database
   */
  async initialize() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 CrimRXiv Import → data/articles/');
    console.log('='.repeat(60) + '\n');

    // Check credentials
    if (!process.env.PUBPUB_EMAIL || !process.env.PUBPUB_PASSWORD) {
      throw new Error('Missing PUBPUB_EMAIL or PUBPUB_PASSWORD in .env');
    }

    // Initialize PubPub SDK
    console.log('🔐 Logging into PubPub...');
    this.sdk = await PubPub.createSDK({
      communityUrl: 'https://www.crimrxiv.com',
      email: process.env.PUBPUB_EMAIL,
      password: process.env.PUBPUB_PASSWORD
    });
    console.log('✅ Logged in successfully\n');

    // Initialize database
    console.log('🗄️  Opening SQLite database...');
    this.db = new CrimRXivDatabase();
    this.db.initialize();
    console.log('✅ Database ready\n');

    // Ensure articles directory exists
    await fs.ensureDir(CONFIG.ARTICLES_DIR);
  }

  /**
   * Process a single publication (with all releases/versions)
   */
  async processPub(pub) {
    try {
      console.log(`\n📄 Processing: ${pub.title}`);
      console.log(`   Slug: ${pub.slug}`);

      // FILTER: Skip drafts and low-quality articles
      // Check if article has releases (published versions)
      const releases = (pub.releases || []).sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
      );
      const hasReleases = releases.length > 0;

      // Check if article has authors with valid names
      const authors = pub.attributions || [];
      const validAuthors = authors.filter(a => a.user?.fullName || a.name);
      const hasAuthors = validAuthors.length > 0;

      // Skip if:
      // 1. No releases (never published) OR
      // 2. No valid authors (incomplete/draft) - UNLESS it's a news article
      //    News articles have attributions.length = 0 OR all attributions have no names
      const isNewsArticle = pub.title && (
        pub.title.includes('CrimRxiv') ||
        pub.title.includes('Consortium') ||
        pub.title.includes('Crimversations')
      );

      if (!hasReleases) {
        console.log(`   ⏭️  SKIPPED: No releases (draft)`);
        this.stats.unchanged++;
        return;
      }

      if (!hasAuthors && !isNewsArticle) {
        console.log(`   ⏭️  SKIPPED: No authors (incomplete/draft)`);
        this.stats.unchanged++;
        return;
      }

      const articleDir = path.join(CONFIG.ARTICLES_DIR, pub.slug);
      await fs.ensureDir(articleDir);

      console.log(`   Releases: ${releases.length}`);

      // Process all releases
      const versionManifest = [];
      for (let i = 0; i < releases.length; i++) {
        const release = releases[i];
        const releaseNumber = i + 1; // Release numbers start at 1

        console.log(`   📦 Fetching release ${releaseNumber} (historyKey: ${release.historyKey})...`);

        // Get content for this specific release
        const textResponse = await this.sdk.pub.text.get({
          params: { pubId: pub.id },
          query: { historyKey: release.historyKey }
        });
        await new Promise(resolve => setTimeout(resolve, CONFIG.TEXT_DELAY));

        const prosemirrorContent = textResponse?.body || null;

        // Prepare metadata for this version
        const versionMetadata = {
          releaseNumber: releaseNumber,
          historyKey: release.historyKey,
          createdAt: release.createdAt,
          noteText: release.noteText,
          title: pub.title,
          doi: pub.doi,
          url: `https://www.crimrxiv.com/pub/${pub.slug}/release/${releaseNumber}`
        };

        // Save this version to {slug}/{releaseNumber}/
        const versionResult = await this.saveVersionFolder(
          articleDir,
          releaseNumber,
          versionMetadata,
          prosemirrorContent
        );

        if (versionResult.success) {
          versionManifest.push({
            number: releaseNumber,
            historyKey: release.historyKey,
            createdAt: release.createdAt,
            noteText: release.noteText,
            url: `https://www.crimrxiv.com/pub/${pub.slug}/release/${releaseNumber}`
          });
        }
      }

      // Get latest version content (for root level and SQLite)
      const textResponse = await this.sdk.pub.text.get({
        params: { pubId: pub.id }
      });
      await new Promise(resolve => setTimeout(resolve, CONFIG.TEXT_DELAY));

      const prosemirrorContent = textResponse?.body || null;
      const contentText = this.extractTextFromProseMirror(prosemirrorContent);

      // Skip if article has minimal content (< 50 words)
      const wordCount = contentText ? contentText.trim().split(/\s+/).length : 0;
      if (wordCount < 50) {
        console.log(`   ⏭️  SKIPPED: Insufficient content (${wordCount} words, need 50+)`);
        // Delete the folder we just created since we're skipping this article
        await fs.remove(articleDir);
        this.stats.unchanged++;
        return;
      }

      const abstractText = this.extractAbstractFromProseMirror(prosemirrorContent);
      const files = this.extractFilesFromProseMirror(prosemirrorContent);

      // Fetch external publications (version-of relationships)
      const externalPubs = await this.processExternalPublications(pub);

      // Prepare article data for SQLite
      const article = {
        article_id: pub.id,
        slug: pub.slug,
        version_number: releases.length || 1,  // Track latest version number
        title: pub.title,
        description: pub.description || '',
        abstract: abstractText || pub.description || '',
        doi: pub.doi || null,
        license: pub.licenseSlug || null,
        created_at: pub.createdAt,
        updated_at: pub.updatedAt,
        published_at: pub.publishedAt || pub.createdAt,
        content_text: contentText,
        content_prosemirror: prosemirrorContent ? JSON.stringify(prosemirrorContent) : null,
        authors_json: JSON.stringify(pub.attributions?.map(a => ({
          name: a.user?.fullName || a.name || null,
          affiliation: a.affiliation,
          orcid: a.orcid,
          is_corresponding: a.isCorresponding || false
        })) || []),
        author_count: pub.attributions?.length || 0,
        collections_json: JSON.stringify(pub.collectionPubs?.map(cp => cp.collection?.title).filter(Boolean) || []),
        collection_count: pub.collectionPubs?.length || 0,
        keywords_json: JSON.stringify([]),
        word_count: contentText.split(/\s+/).length,
        attachment_count: files.length,
        url: `https://www.crimrxiv.com/pub/${pub.slug}`,
        pdf_url: files[0]?.url || null,
        external_publications_json: externalPubs.length > 0 ? JSON.stringify(externalPubs) : null
      };

      // Save latest version to root level (for backwards compatibility)
      const folderResult = await this.saveArticleFolder(article, prosemirrorContent);

      if (!folderResult.success) {
        console.error(`   ❌ Failed to save article folder`);
        this.stats.errors++;
        return;
      }

      // Save versions manifest
      if (versionManifest.length > 0) {
        await fs.writeJSON(path.join(articleDir, 'versions.json'), {
          total: versionManifest.length,
          latest: versionManifest[versionManifest.length - 1].number,
          versions: versionManifest
        }, { spaces: 2 });
      }

      // Update attachments JSON for SQLite
      if (folderResult.attachments && folderResult.attachments.length > 0) {
        article.attachments_json = JSON.stringify(folderResult.attachments);
      }

      // Upsert into SQLite (for metadata + manifest_tx_id storage)
      const result = this.db.upsertArticle(article);

      if (result.action === 'inserted') {
        this.stats.inserted++;
        console.log(`   ✅ Inserted (new article)`);
      } else if (result.action === 'updated') {
        this.stats.updated++;
        console.log(`   ✅ Updated (changes detected)`);
      } else {
        this.stats.unchanged++;
        console.log(`   ⏭️  Unchanged (skipped)`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing ${pub.slug}:`, error.message);
      this.stats.errors++;
    }
  }

  /**
   * Main import workflow
   */
  async import() {
    const startTime = Date.now();

    // Check for --limit flag
    const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

    console.log('📚 Fetching publications...\n');

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Fetch batch using correct SDK API
      const response = await this.sdk.pub.getMany({
        query: {
          limit: CONFIG.BATCH_SIZE,
          offset: offset,
          sortBy: 'updatedAt',
          orderBy: 'DESC',
          include: ['collectionPubs', 'attributions', 'community', 'draft', 'releases', 'outboundEdges']
        }
      });

      // Extract pubs array from response body
      // Check if response is an error
      if (response.body && response.body.message) {
        console.error('\n❌ PubPub API Error:');
        console.error('Name:', response.body.name);
        console.error('Message:', response.body.message);
        console.error('Details:', JSON.stringify(response.body.details, null, 2));
        throw new Error(`PubPub API Error: ${response.body.message}`);
      }

      const pubs = response.body || [];

      if (!pubs || pubs.length === 0) {
        console.log('⚠️  No more publications to fetch');
        hasMore = false;
        break;
      }

      console.log(`📦 Batch: ${offset + 1} - ${offset + pubs.length} (${pubs.length} in this batch)`);

      // Process pubs in parallel (5 at a time)
      const CONCURRENCY = 5;
      for (let i = 0; i < pubs.length; i += CONCURRENCY) {
        const chunk = pubs.slice(i, i + CONCURRENCY);

        // Process this chunk in parallel
        await Promise.all(chunk.map(async (pub) => {
          this.stats.total++;
          await this.processPub(pub);
        }));

        // Check limit
        if (limit && this.stats.total >= limit) {
          console.log(`\n⚠️  Reached limit of ${limit} articles\n`);
          hasMore = false;
          break;
        }
      }

      offset += pubs.length;

      // If we got less than a full batch, we're done
      if (pubs.length < CONFIG.BATCH_SIZE) {
        hasMore = false;
      }
    }

    // Print summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('✅ IMPORT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total Processed: ${this.stats.total}`);
    console.log(`Inserted (new): ${this.stats.inserted}`);
    console.log(`Updated: ${this.stats.updated}`);
    console.log(`Unchanged: ${this.stats.unchanged}`);
    console.log(`Errors: ${this.stats.errors}`);
    console.log(`Folders Created: ${this.stats.folders_created}`);
    console.log(`Attachments Downloaded: ${this.stats.attachments_downloaded}`);
    console.log(`Attachments Failed: ${this.stats.attachments_failed}`);
    console.log(`Duration: ${duration} minutes`);
    console.log('='.repeat(60) + '\n');

    console.log('💡 Next steps:');
    console.log('  1. Export metadata: npm run export');
    console.log('  2. Upload articles: npm run upload:articles');
    console.log('  3. Re-export with TX IDs: npm run export');
    console.log('  4. Upload parquet: npm run upload:parquet\n');
  }

  /**
   * Cleanup
   */
  async cleanup() {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const importer = new CrimRXivImporter();

  try {
    await importer.initialize();
    await importer.import();
    await importer.cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
    await importer.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
const isRunningDirectly = process.argv[1] && (
  process.argv[1].endsWith('import-to-articles.js') ||
  process.argv[1].endsWith('import-to-articles')
);

if (isRunningDirectly) {
  main();
}

export default CrimRXivImporter;
