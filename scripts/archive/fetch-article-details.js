#!/usr/bin/env node

/**
 * Fetch full article details for all URLs in the consortium dataset
 * This completes the data that the scraper collected (URLs only)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import { Logger, FileHelper } from '../src/lib/utils.js';

class ArticleDetailsFetcher {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.dataset = null;
    this.enrichedPublications = [];
    this.failedFetches = [];
  }

  async run() {
    this.logger.info('🔍 Fetching full article details for consortium publications...');

    try {
      // Load the dataset with URLs
      await this.loadDataset();

      // Fetch details for each publication
      await this.fetchAllArticleDetails();

      // Save the enriched dataset
      await this.saveEnrichedDataset();

      this.logger.success(`✅ Fetched details for ${this.enrichedPublications.length} articles`);
      if (this.failedFetches.length > 0) {
        this.logger.warning(`⚠️  Failed to fetch ${this.failedFetches.length} articles`);
        console.log('Failed articles:', this.failedFetches.map(f => f.slug));
      }

    } catch (error) {
      this.logger.error('Failed to fetch article details', error.message);
      throw error;
    }
  }

  async loadDataset() {
    this.dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
    if (!this.dataset || !this.dataset.publications) {
      throw new Error('Dataset not found or invalid');
    }
    this.logger.success(`Loaded ${this.dataset.publications.length} publication URLs`);
  }

  async fetchAllArticleDetails() {
    const total = this.dataset.publications.length;
    const batchSize = 10;

    for (let i = 0; i < total; i += batchSize) {
      const batch = this.dataset.publications.slice(i, Math.min(i + batchSize, total));

      this.logger.info(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(total/batchSize)}...`);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(pub => this.fetchArticleDetails(pub))
      );

      // Add successful fetches to enriched list
      batchResults.forEach((result, idx) => {
        if (result) {
          this.enrichedPublications.push(result);
        } else {
          this.failedFetches.push(batch[idx]);
        }
      });

      // Progress update
      this.logger.info(`Progress: ${this.enrichedPublications.length}/${total} articles fetched`);

      // Be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async fetchArticleDetails(publication) {
    try {
      if (!publication || !publication.url) {
        return null;
      }

      const url = publication.url.includes('/release/')
        ? publication.url
        : `${publication.url}/release/1`;

      const response = await axios.get(url, {
        timeout: 30000,
        headers: { 'User-Agent': 'CrimConsortium-Fetcher/1.0' }
      });

      const $ = cheerio.load(response.data);

      // Extract metadata from meta tags and page content
      const title = $('meta[property="og:title"]').attr('content') ||
                   $('meta[name="citation_title"]').attr('content') ||
                   $('h1.pub-title').first().text().trim() ||
                   publication.slug;

      // Extract authors
      const authors = [];
      $('meta[name="citation_author"]').each((i, elem) => {
        const authorName = $(elem).attr('content');
        if (authorName) {
          authors.push({ name: authorName });
        }
      });

      // If no meta tags, try visible author elements
      if (authors.length === 0) {
        $('.byline-component .author-name, .pub-header-byline .author').each((i, elem) => {
          const authorName = $(elem).text().trim();
          if (authorName) {
            authors.push({ name: authorName });
          }
        });
      }

      // Extract abstract/description
      let description = $('meta[property="og:description"]').attr('content') ||
                       $('meta[name="description"]').attr('content') ||
                       $('meta[name="citation_abstract"]').attr('content') ||
                       '';

      // Try to find abstract in the content if not in meta
      if (!description) {
        const abstractSection = $('.pub-body-component .abstract, .abstract-content, .pub-abstract').first().text().trim();
        if (abstractSection) {
          description = abstractSection;
        }
      }

      // Extract dates
      const publishedDate = $('meta[name="citation_publication_date"]').attr('content') ||
                          $('meta[name="citation_online_date"]').attr('content');

      const createdAt = publishedDate || new Date().toISOString();

      // Check for DOI
      const doi = $('meta[name="citation_doi"]').attr('content') ||
                 $('.pub-doi a').text().trim() ||
                 '';

      // Check for PDF
      const pdfUrl = $('meta[name="citation_pdf_url"]').attr('content') ||
                    $('a[href$=".pdf"]').first().attr('href') ||
                    '';

      // Get affiliations for consortium association
      const affiliations = [];
      $('meta[name="citation_author_institution"]').each((i, elem) => {
        affiliations.push($(elem).attr('content'));
      });

      // Create enriched publication object
      return {
        ...publication,
        title,
        authors: authors.length > 0 ? authors : [{ name: 'Author information pending' }],
        description,
        createdAt,
        publishedAt: publishedDate,
        doi,
        pdfUrl,
        affiliations,
        url: publication.url,
        slug: publication.slug,
        memberAssociations: publication.memberAssociation ? [publication.memberAssociation] : [],
        source: publication.source || 'consortium',
        lastFetched: new Date().toISOString()
      };

    } catch (error) {
      this.logger.warning(`Failed to fetch ${publication.slug}: ${error.message}`);
      return null;
    }
  }

  async saveEnrichedDataset() {
    // Create backup of current dataset
    await fs.copy(
      './data/final/consortium-dataset.json',
      './data/final/consortium-dataset-urls-only.backup.json'
    );

    // Save enriched dataset
    const enrichedDataset = {
      ...this.dataset,
      publications: this.enrichedPublications,
      metadata: {
        ...this.dataset.metadata,
        enrichedAt: new Date().toISOString(),
        totalArticles: this.enrichedPublications.length,
        failedFetches: this.failedFetches.length
      }
    };

    await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', enrichedDataset);

    // Save failed fetches for retry
    if (this.failedFetches.length > 0) {
      await this.fileHelper.writeJSON('./data/final/failed-fetches.json', {
        articles: this.failedFetches,
        timestamp: new Date().toISOString()
      });
    }

    this.logger.success(`💾 Saved enriched dataset with ${this.enrichedPublications.length} complete articles`);
  }
}

// Run the fetcher
const fetcher = new ArticleDetailsFetcher();
fetcher.run().catch(console.error);