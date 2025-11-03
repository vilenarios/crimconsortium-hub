/**
 * Manifest Loader
 *
 * Handles loading article manifests and attachments from Arweave or localhost.
 * Each article has a manifest that groups all its files (content, PDFs, images) under one TX ID.
 *
 * Manifest structure:
 * {
 *   "manifest": "arweave/paths",
 *   "version": "0.2.0",
 *   "index": {
 *     "path": "article.md"
 *   },
 *   "paths": {
 *     "article.md": {"id": "tx_id_here"},
 *     "article.html": {"id": "tx_id_here"},
 *     "pdfs/file.pdf": {"id": "tx_id_here"}
 *   }
 * }
 */

import { getManifestUrl, getAttachmentUrl, isDevelopment } from '../config/arweave.js';

export class ManifestLoader {
  constructor() {
    this.manifestCache = new Map();
    this.contentCache = new Map();
  }

  /**
   * Load manifest from Arweave or localhost
   * @param {string} manifestTxId - Transaction ID of the manifest
   * @returns {Promise<object>} Manifest object
   */
  async loadManifest(manifestTxId) {
    // Check cache first
    if (this.manifestCache.has(manifestTxId)) {
      console.log(`📋 Using cached manifest: ${manifestTxId}`);
      return this.manifestCache.get(manifestTxId);
    }

    try {
      const manifestUrl = getManifestUrl(manifestTxId);
      console.log(`📋 Loading manifest from: ${manifestUrl}`);

      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
      }

      const manifest = await response.json();

      // Cache the manifest
      this.manifestCache.set(manifestTxId, manifest);

      console.log(`✅ Manifest loaded: ${manifestTxId}`, manifest);
      return manifest;
    } catch (error) {
      console.error(`❌ Failed to load manifest ${manifestTxId}:`, error);
      throw error;
    }
  }

  /**
   * Get article markdown content from manifest
   * @param {string} manifestTxId - Transaction ID of the manifest
   * @returns {Promise<string>} Markdown content
   */
  async getArticleMarkdown(manifestTxId) {
    const cacheKey = `${manifestTxId}:markdown`;

    // Check cache
    if (this.contentCache.has(cacheKey)) {
      console.log(`📄 Using cached markdown: ${manifestTxId}`);
      return this.contentCache.get(cacheKey);
    }

    try {
      const manifest = await this.loadManifest(manifestTxId);

      // Get markdown path from manifest
      const markdownPath = 'article.md';
      if (!manifest.paths || !manifest.paths[markdownPath]) {
        throw new Error(`Markdown not found in manifest: ${manifestTxId}`);
      }

      // Fetch markdown content
      const markdownUrl = getAttachmentUrl(manifestTxId, markdownPath);
      console.log(`📄 Loading markdown from: ${markdownUrl}`);

      const response = await fetch(markdownUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch markdown: ${response.status} ${response.statusText}`);
      }

      const markdown = await response.text();

      // Cache the content
      this.contentCache.set(cacheKey, markdown);

      console.log(`✅ Markdown loaded: ${manifestTxId.substring(0, 8)}... (${markdown.length} chars)`);
      return markdown;
    } catch (error) {
      console.error(`❌ Failed to load markdown for ${manifestTxId}:`, error);
      throw error;
    }
  }

  /**
   * Get article HTML content from manifest
   * @param {string} manifestTxId - Transaction ID of the manifest
   * @returns {Promise<string>} HTML content
   */
  async getArticleHtml(manifestTxId) {
    const cacheKey = `${manifestTxId}:html`;

    // Check cache
    if (this.contentCache.has(cacheKey)) {
      console.log(`📄 Using cached HTML: ${manifestTxId}`);
      return this.contentCache.get(cacheKey);
    }

    try {
      const manifest = await this.loadManifest(manifestTxId);

      // Get HTML path from manifest
      const htmlPath = 'article.html';
      if (!manifest.paths || !manifest.paths[htmlPath]) {
        console.warn(`HTML not found in manifest: ${manifestTxId}, falling back to markdown`);
        // Fallback to markdown if HTML not available
        return this.getArticleMarkdown(manifestTxId);
      }

      // Fetch HTML content
      const htmlUrl = getAttachmentUrl(manifestTxId, htmlPath);
      console.log(`📄 Loading HTML from: ${htmlUrl}`);

      const response = await fetch(htmlUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch HTML: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();

      // Cache the content
      this.contentCache.set(cacheKey, html);

      console.log(`✅ HTML loaded: ${manifestTxId.substring(0, 8)}... (${html.length} chars)`);
      return html;
    } catch (error) {
      console.error(`❌ Failed to load HTML for ${manifestTxId}:`, error);
      throw error;
    }
  }

  /**
   * Get list of attachments (PDFs, images) from manifest
   * @param {string} manifestTxId - Transaction ID of the manifest
   * @returns {Promise<Array>} Array of attachment objects
   */
  async getAttachments(manifestTxId) {
    try {
      const manifest = await this.loadManifest(manifestTxId);

      if (!manifest.paths) {
        return [];
      }

      // Filter paths for attachments (PDFs, images)
      const attachments = [];
      for (const [path, info] of Object.entries(manifest.paths)) {
        // Skip article content files
        if (path === 'article.md' || path === 'article.html') {
          continue;
        }

        // Get file extension
        const extension = path.split('.').pop().toLowerCase();
        const isPdf = extension === 'pdf';
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension);

        if (isPdf || isImage) {
          const filename = path.split('/').pop();
          const url = getAttachmentUrl(manifestTxId, path);

          attachments.push({
            filename,
            path,
            url,
            txId: info.id,
            type: isPdf ? 'pdf' : 'image',
            extension
          });
        }
      }

      console.log(`📎 Found ${attachments.length} attachments in manifest ${manifestTxId.substring(0, 8)}...`);
      return attachments;
    } catch (error) {
      console.error(`❌ Failed to get attachments for ${manifestTxId}:`, error);
      return [];
    }
  }

  /**
   * Get full article data (metadata + content + attachments)
   * This is a convenience method that combines metadata from parquet with manifest content
   * @param {object} metadata - Article metadata from ParquetDB
   * @returns {Promise<object>} Full article data
   */
  async getFullArticle(metadata) {
    if (!metadata || !metadata.manifest_tx_id) {
      throw new Error('Article metadata or manifest_tx_id missing');
    }

    try {
      // Load content and attachments in parallel
      const [markdown, attachments] = await Promise.all([
        this.getArticleMarkdown(metadata.manifest_tx_id),
        this.getAttachments(metadata.manifest_tx_id)
      ]);

      return {
        ...metadata,
        content_markdown: markdown,
        attachments: attachments
      };
    } catch (error) {
      console.error(`❌ Failed to get full article for ${metadata.slug}:`, error);
      throw error;
    }
  }

  /**
   * Prefetch manifest (warm up cache)
   * Useful for preloading article manifests when user hovers over links
   * @param {string} manifestTxId - Transaction ID to prefetch
   */
  async prefetchManifest(manifestTxId) {
    if (!manifestTxId || this.manifestCache.has(manifestTxId)) {
      return;
    }

    try {
      await this.loadManifest(manifestTxId);
      console.log(`✅ Prefetched manifest: ${manifestTxId.substring(0, 8)}...`);
    } catch (error) {
      console.warn(`⚠️ Failed to prefetch manifest ${manifestTxId}:`, error.message);
    }
  }

  /**
   * Clear caches (useful for development/debugging)
   */
  clearCache() {
    this.manifestCache.clear();
    this.contentCache.clear();
    console.log('🗑️ Manifest and content caches cleared');
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getCacheStats() {
    return {
      manifests: this.manifestCache.size,
      content: this.contentCache.size,
      totalCached: this.manifestCache.size + this.contentCache.size
    };
  }
}

/**
 * Singleton instance for global use
 */
export const manifestLoader = new ManifestLoader();
