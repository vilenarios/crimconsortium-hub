#!/usr/bin/env node

/**
 * Single Article Re-scraper
 * Re-scrape a single article with enhanced HTML content capture
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger, FileHelper } from '../src/lib/utils.js';

class SingleArticleRescraper {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
  }

  async rescrapeSingleArticle(articleSlug) {
    this.logger.info(`🔄 Re-scraping article: ${articleSlug}`);
    
    try {
      // Load existing dataset
      const dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
      if (!dataset) throw new Error('Dataset not found');
      
      // Find the article
      const articleIndex = dataset.publications.findIndex(pub => pub.slug === articleSlug);
      if (articleIndex === -1) {
        throw new Error(`Article ${articleSlug} not found in dataset`);
      }
      
      const existingArticle = dataset.publications[articleIndex];
      this.logger.info(`Found article: ${existingArticle.title}`);
      
      // Re-scrape with enhanced content capture
      const enhancedArticle = await this.scrapeArticleWithHTML(existingArticle.originalUrl);
      
      // Merge with existing data
      const updatedArticle = {
        ...existingArticle,
        ...enhancedArticle,
        lastUpdated: new Date().toISOString()
      };
      
      // Update dataset
      dataset.publications[articleIndex] = updatedArticle;
      
      // Save updated dataset
      await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', dataset);
      
      this.logger.success(`✅ Article ${articleSlug} re-scraped with enhanced content`);
      this.logger.info(`📝 Description: ${enhancedArticle.description ? 'Found' : 'Missing'}`);
      this.logger.info(`🔗 HTML Content: ${enhancedArticle.fullContentHTML ? 'Captured' : 'Missing'}`);
      
      return updatedArticle;
      
    } catch (error) {
      this.logger.error(`Failed to re-scrape ${articleSlug}:`, error.message);
      throw error;
    }
  }

  async scrapeArticleWithHTML(url) {
    this.logger.info(`📥 Fetching: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrimConsortium-Archive/1.0)'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    return {
      description: this.extractAbstract($),
      fullContentHTML: this.extractFullContentHTML($),
      doi: this.extractMetaContent($, 'citation_doi') || '',
    };
  }

  extractAbstract($) {
    // Try multiple selectors for abstract
    const abstractSelectors = [
      'meta[name="description"]',
      '.abstract',
      '.summary', 
      '.description',
      '[data-testid="abstract"]'
    ];
    
    for (const selector of abstractSelectors) {
      const element = $(selector).first();
      const content = element.attr('content') || element.text();
      if (content && content.trim().length > 50) {
        return content.trim();
      }
    }
    return '';
  }

  extractFullContentHTML($) {
    const contentSelectors = [
      '.pub-body-component', 
      '.pub-document', 
      '.article-content', 
      '.content',
      'main',
      '[data-testid="pub-document"]'
    ];
    
    let bestHTML = '';
    let bestLength = 0;
    
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const elementHTML = element.html();
        const elementText = element.text().trim();
        
        if (elementText.length > bestLength) {
          bestHTML = elementHTML;
          bestLength = elementText.length;
        }
      }
    }
    
    return bestHTML || '';
  }

  extractMetaContent($, name) {
    return $(`meta[name="${name}"]`).attr('content') || 
           $(`meta[property="${name}"]`).attr('content') || '';
  }
}

// Run if called with article slug argument
if (process.argv[2]) {
  const scraper = new SingleArticleRescraper();
  scraper.rescrapeSingleArticle(process.argv[2])
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  console.log('Usage: node scripts/single-article-rescraper.js <article-slug>');
  console.log('Example: node scripts/single-article-rescraper.js o05ddjgp');
}