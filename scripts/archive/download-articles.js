#!/usr/bin/env node

import axios from 'axios';
import * as cheerio from 'cheerio';
import xml2js from 'xml2js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

class CrimRXivDownloader {
  constructor() {
    this.baseUrl = 'https://www.crimrxiv.com';
    this.articleUrls = [];
    this.articles = [];
    this.downloadedCount = 0;
  }

  async init() {
    await fs.ensureDir(path.join(projectRoot, 'data'));
    await fs.ensureDir(path.join(projectRoot, 'articles'));
  }

  async fetchSitemap() {
    console.log('📋 Fetching sitemap...');
    try {
      const response = await axios.get(`${this.baseUrl}/sitemap-0.xml`);
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);
      
      this.articleUrls = result.urlset.url
        .map(url => url.loc[0])
        .filter(url => url.includes('/pub/'))
        .slice(0, 20); // Start with first 20 for testing
      
      console.log(`📊 Found ${this.articleUrls.length} articles to process`);
      return this.articleUrls;
    } catch (error) {
      console.error('❌ Error fetching sitemap:', error.message);
      throw error;
    }
  }

  async fetchRSSFeed() {
    console.log('📡 Fetching RSS feed for metadata...');
    try {
      const response = await axios.get(`${this.baseUrl}/rss.xml`);
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);
      
      const items = result.rss.channel[0].item || [];
      console.log(`📈 Found ${items.length} articles in RSS feed`);
      
      return items.map(item => ({
        title: item.title?.[0] || '',
        link: item.link?.[0] || '',
        pubDate: item.pubDate?.[0] || '',
        description: item.description?.[0] || '',
        author: item.author?.[0] || '',
        guid: item.guid?.[0]?._ || item.guid?.[0] || ''
      }));
    } catch (error) {
      console.error('❌ Error fetching RSS feed:', error.message);
      throw error;
    }
  }

  async downloadArticleMetadata(articleUrl) {
    try {
      console.log(`🔍 Processing: ${articleUrl}`);
      
      const response = await axios.get(articleUrl);
      const $ = cheerio.load(response.data);
      
      // Extract metadata
      const title = $('h1').first().text().trim();
      const authors = [];
      $('.author-name, .author').each((i, el) => {
        const author = $(el).text().trim();
        if (author) authors.push(author);
      });
      
      const abstract = $('.abstract, .description, p').first().text().trim();
      const doi = $('meta[name="citation_doi"]').attr('content') || '';
      const pubDate = $('meta[name="citation_publication_date"]').attr('content') || 
                     $('.date, .published').first().text().trim();
      
      // Find download links
      const downloadLinks = {};
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().toLowerCase();
        
        if (href && (href.includes('assets.pubpub.org') || href.includes('s3.amazonaws.com'))) {
          if (href.includes('.pdf')) {
            downloadLinks.pdf = href.startsWith('http') ? href : this.baseUrl + href;
          } else if (href.includes('.docx')) {
            downloadLinks.word = href.startsWith('http') ? href : this.baseUrl + href;
          }
        }
      });
      
      const article = {
        url: articleUrl,
        id: articleUrl.split('/pub/')[1],
        title,
        authors,
        abstract,
        doi,
        pubDate,
        downloadLinks,
        downloaded: false
      };
      
      console.log(`✅ Metadata extracted for: ${title.substring(0, 50)}...`);
      return article;
      
    } catch (error) {
      console.error(`❌ Error processing ${articleUrl}:`, error.message);
      return null;
    }
  }

  async downloadArticleFile(article, format = 'pdf') {
    if (!article.downloadLinks[format]) {
      console.log(`⚠️  No ${format} link found for: ${article.title}`);
      return false;
    }

    try {
      const downloadUrl = article.downloadLinks[format];
      const filename = `${article.id}.${format}`;
      const filepath = path.join(projectRoot, 'articles', filename);
      
      console.log(`⬇️  Downloading ${format}: ${article.title.substring(0, 40)}...`);
      
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream'
      });
      
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);
      
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ Downloaded: ${filename}`);
          this.downloadedCount++;
          resolve(true);
        });
        writer.on('error', reject);
      });
      
    } catch (error) {
      console.error(`❌ Error downloading ${article.title}:`, error.message);
      return false;
    }
  }

  async processAllArticles() {
    console.log(`🚀 Starting to process ${this.articleUrls.length} articles...`);
    
    for (let i = 0; i < this.articleUrls.length; i++) {
      const url = this.articleUrls[i];
      
      // Rate limiting - wait 1 second between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const article = await this.downloadArticleMetadata(url);
      if (article) {
        this.articles.push(article);
        
        // Download PDF if available
        const downloaded = await this.downloadArticleFile(article, 'pdf');
        article.downloaded = downloaded;
      }
      
      console.log(`📊 Progress: ${i + 1}/${this.articleUrls.length}`);
    }
  }

  async saveMetadata() {
    const metadataPath = path.join(projectRoot, 'data', 'articles.json');
    await fs.writeJson(metadataPath, this.articles, { spaces: 2 });
    console.log(`💾 Saved metadata for ${this.articles.length} articles`);
  }

  async run() {
    try {
      await this.init();
      await this.fetchSitemap();
      await this.processAllArticles();
      await this.saveMetadata();
      
      console.log('\n🎉 Download complete!');
      console.log(`📚 Total articles processed: ${this.articles.length}`);
      console.log(`⬇️  Files downloaded: ${this.downloadedCount}`);
      console.log(`📁 Articles saved to: ./articles/`);
      console.log(`📊 Metadata saved to: ./data/articles.json`);
      
    } catch (error) {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const downloader = new CrimRXivDownloader();
  downloader.run();
}

export default CrimRXivDownloader;