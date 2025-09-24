#!/usr/bin/env node

/**
 * Standalone PDF Downloader
 * Downloads PDFs from existing consortium dataset without re-scraping
 */

import axios from 'axios';
import fs from 'fs-extra';
import { Logger, FileHelper } from '../src/lib/utils.js';

class PDFDownloader {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
  }

  async downloadPDF(publication) {
    const pdfUrl = publication.downloads?.pdf;

    if (!pdfUrl) {
      return { success: false, error: 'No PDF URL' };
    }

    try {
      const fileName = `${publication.slug || publication.id}.pdf`;
      const filePath = `./data/final/pdfs/${fileName}`;

      // Check if already exists
      if (await this.fileHelper.exists(filePath)) {
        const stats = await fs.stat(filePath);
        if (stats.size > 0) {
          return { success: true, filePath, fileSize: stats.size, fileName, skipped: true };
        }
      }

      // Download file
      console.log(`📥 Downloading: ${fileName} from ${pdfUrl}`);

      const response = await axios.get(pdfUrl, {
        responseType: 'stream',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          const stats = await fs.stat(filePath);
          resolve({ success: true, filePath, fileSize: stats.size, fileName });
        });

        writer.on('error', (error) => {
          reject({ success: false, error: error.message });
        });
      });

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    console.log('🚀 Starting PDF downloads from existing dataset...\n');

    // Load the existing dataset
    const datasetPath = './data/final/consortium-dataset.json';

    if (!await this.fileHelper.exists(datasetPath)) {
      console.error('❌ Dataset not found! Run "npm run import" first to create the dataset.');
      process.exit(1);
    }

    const dataset = await this.fileHelper.readJSON(datasetPath);

    if (!dataset || !dataset.publications) {
      console.error('❌ Invalid dataset format');
      process.exit(1);
    }

    // Filter publications with PDF links
    const publicationsWithPDFs = dataset.publications.filter(pub =>
      pub.downloads && pub.downloads.pdf
    );

    if (publicationsWithPDFs.length === 0) {
      console.log('ℹ️ No publications with PDF links found in dataset');
      return;
    }

    console.log(`📊 Found ${publicationsWithPDFs.length} publications with PDF links`);
    console.log(`📚 Total publications in dataset: ${dataset.publications.length}\n`);

    // Create PDFs directory
    await this.fileHelper.ensureDir('./data/final/pdfs');

    let downloadedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const failedDownloads = [];

    console.log('Starting downloads...\n');

    for (let i = 0; i < publicationsWithPDFs.length; i++) {
      const pub = publicationsWithPDFs[i];
      const progress = `[${i + 1}/${publicationsWithPDFs.length}]`;

      try {
        const result = await this.downloadPDF(pub);

        if (result.success) {
          if (result.skipped) {
            skippedCount++;
            console.log(`⏭️  ${progress} Already exists: ${result.fileName}`);
          } else {
            downloadedCount++;
            const sizeMB = (result.fileSize / 1024 / 1024).toFixed(2);
            console.log(`✅ ${progress} Downloaded: ${result.fileName} (${sizeMB} MB)`);
          }
        } else {
          failedCount++;
          failedDownloads.push({ slug: pub.slug, error: result.error });
          console.log(`❌ ${progress} Failed: ${pub.slug} - ${result.error}`);
        }

        // Rate limiting to be respectful
        await this.delay(1000);

      } catch (error) {
        failedCount++;
        failedDownloads.push({ slug: pub.slug, error: error.message });
        console.log(`❌ ${progress} Error: ${pub.slug} - ${error.message}`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DOWNLOAD SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Downloaded: ${downloadedCount} PDFs`);
    console.log(`⏭️  Already had: ${skippedCount} PDFs`);
    console.log(`❌ Failed: ${failedCount} PDFs`);
    console.log(`📁 Total PDFs available: ${downloadedCount + skippedCount}`);
    console.log(`📂 Location: data/final/pdfs/`);

    if (failedDownloads.length > 0) {
      console.log('\n❌ Failed downloads:');
      failedDownloads.forEach(f => {
        console.log(`   - ${f.slug}: ${f.error}`);
      });
    }

    console.log('\n✅ PDF download process complete!');
    console.log('💡 Run "npm run build" to include PDFs in the static site');
  }
}

// Run the downloader
const downloader = new PDFDownloader();
downloader.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});