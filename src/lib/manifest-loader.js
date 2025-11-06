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
   * Get article ProseMirror content from manifest (content.json)
   * @param {string} manifestTxId - Transaction ID of the manifest
   * @returns {Promise<object|null>} ProseMirror JSON document or null if not available
   */
  async getArticleProseMirror(manifestTxId) {
    const cacheKey = `${manifestTxId}:prosemirror`;

    // Check cache
    if (this.contentCache.has(cacheKey)) {
      console.log(`📄 Using cached ProseMirror: ${manifestTxId}`);
      return this.contentCache.get(cacheKey);
    }

    try {
      const manifest = await this.loadManifest(manifestTxId);

      // Get content.json path from manifest
      const contentPath = 'content.json';
      if (!manifest.paths || !manifest.paths[contentPath]) {
        console.warn(`content.json not found in manifest: ${manifestTxId}`);
        return null;
      }

      // Fetch ProseMirror content
      const contentUrl = getAttachmentUrl(manifestTxId, contentPath);
      console.log(`📄 Loading ProseMirror from: ${contentUrl}`);

      const response = await fetch(contentUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch content.json: ${response.status} ${response.statusText}`);
      }

      const prosemirrorDoc = await response.json();

      // Cache the content
      this.contentCache.set(cacheKey, prosemirrorDoc);

      console.log(`✅ ProseMirror loaded: ${manifestTxId.substring(0, 8)}...`);
      return prosemirrorDoc;
    } catch (error) {
      console.error(`❌ Failed to load ProseMirror for ${manifestTxId}:`, error);
      return null;
    }
  }

  /**
   * Get article metadata from manifest (metadata.json)
   * @param {string} manifestTxId - Transaction ID of the manifest
   * @returns {Promise<object|null>} Metadata object or null if not available
   */
  async getArticleMetadata(manifestTxId) {
    const cacheKey = `${manifestTxId}:metadata`;

    // Check cache
    if (this.contentCache.has(cacheKey)) {
      console.log(`📄 Using cached metadata: ${manifestTxId}`);
      return this.contentCache.get(cacheKey);
    }

    try {
      const manifest = await this.loadManifest(manifestTxId);

      // Get metadata.json path from manifest
      const metadataPath = 'metadata.json';
      if (!manifest.paths || !manifest.paths[metadataPath]) {
        console.warn(`metadata.json not found in manifest: ${manifestTxId}`);
        return null;
      }

      // Fetch metadata
      const metadataUrl = getAttachmentUrl(manifestTxId, metadataPath);
      console.log(`📄 Loading metadata from: ${metadataUrl}`);

      const response = await fetch(metadataUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata.json: ${response.status} ${response.statusText}`);
      }

      const metadata = await response.json();

      // Cache the content
      this.contentCache.set(cacheKey, metadata);

      console.log(`✅ Metadata loaded: ${manifestTxId.substring(0, 8)}...`);
      return metadata;
    } catch (error) {
      console.error(`❌ Failed to load metadata for ${manifestTxId}:`, error);
      return null;
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
      // Load all content in parallel (ProseMirror, metadata, attachments)
      const [prosemirrorDoc, manifestMetadata, attachments] = await Promise.all([
        this.getArticleProseMirror(metadata.manifest_tx_id),
        this.getArticleMetadata(metadata.manifest_tx_id),
        this.getAttachments(metadata.manifest_tx_id)
      ]);

      // Merge parquet metadata with manifest metadata (manifest takes precedence for richer data)
      const mergedMetadata = {
        ...metadata,
        ...(manifestMetadata || {}),
      };

      return {
        ...mergedMetadata,
        content_prosemirror: prosemirrorDoc,
        attachments: attachments,
        // Keep original parquet metadata accessible
        _parquetMetadata: metadata
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
