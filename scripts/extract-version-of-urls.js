#!/usr/bin/env node

/**
 * Version-of URL Extractor
 * Find articles with "This Pub is a Version of" and extract full URLs
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Logger, FileHelper } from '../src/lib/utils.js';

class VersionOfExtractor {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
  }

  async enhanceVersionOfUrls() {
    this.logger.info('🔍 Finding articles with version-of metadata...');
    
    try {
      // Load existing dataset
      const dataset = await this.fileHelper.readJSON('./data/final/consortium-dataset.json');
      if (!dataset) throw new Error('Dataset not found');
      
      // Find articles with "This Pub is a Version of"
      const versionOfArticles = dataset.publications.filter(pub => 
        pub.fullContent && pub.fullContent.includes('This Pub is a Version of')
      );
      
      this.logger.info(`📊 Found ${versionOfArticles.length} articles with version-of metadata`);
      
      if (versionOfArticles.length === 0) {
        this.logger.info('✅ No version-of articles found to enhance');
        return;
      }
      
      // Show what we found
      console.log('\n📄 Articles to enhance:');
      versionOfArticles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.title} (${article.slug})`);
      });
      
      // Process each article
      let enhanced = 0;
      for (const article of versionOfArticles) {
        try {
          this.logger.info(`🔄 Enhancing: ${article.title}`);
          
          const versionOfUrl = await this.extractVersionOfUrl(article.originalUrl);
          
          if (versionOfUrl) {
            // Find article in dataset and update
            const articleIndex = dataset.publications.findIndex(pub => pub.slug === article.slug);
            if (articleIndex !== -1) {
              dataset.publications[articleIndex].versionOfUrl = versionOfUrl;
              dataset.publications[articleIndex].lastEnhanced = new Date().toISOString();
              enhanced++;
              
              this.logger.success(`✅ Enhanced ${article.slug}: ${versionOfUrl}`);
            }
          } else {
            this.logger.info(`⚠️ No version-of URL found for ${article.slug}`);
          }
          
          // Brief delay to be respectful
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          this.logger.error(`Failed to enhance ${article.slug}:`, error.message);
        }
      }
      
      // Save enhanced dataset
      if (enhanced > 0) {
        await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', dataset);
        this.logger.success(`🎉 Enhanced ${enhanced} articles with version-of URLs`);
      }
      
    } catch (error) {
      this.logger.error('Enhancement failed:', error.message);
      throw error;
    }
  }

  async extractVersionOfUrl(articleUrl) {
    try {
      const response = await axios.get(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CrimConsortium-Archive/1.0)'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      
      // Target the specific pub-edge-component link
      const versionOfLink = $('.pub-edge-component a').first().attr('href');
      
      if (versionOfLink) {
        // Return full URL (may be relative or absolute)
        return versionOfLink.startsWith('http') ? versionOfLink : 
               versionOfLink.startsWith('//') ? `https:${versionOfLink}` :
               versionOfLink.startsWith('/') ? `https://www.crimrxiv.com${versionOfLink}` :
               `https://${versionOfLink}`;
      }
      
      return null;
      
    } catch (error) {
      this.logger.error(`Failed to fetch ${articleUrl}:`, error.message);
      return null;
    }
  }
}

// Run the enhancement
const extractor = new VersionOfExtractor();
extractor.enhanceVersionOfUrls()
  .then(() => {
    console.log('\n✅ Version-of URL enhancement complete!');
    console.log('Run "npm run build" to regenerate pages with full URLs.');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });