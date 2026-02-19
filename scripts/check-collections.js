#!/usr/bin/env node

/**
 * Quick check of collection data quality across imported articles
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkCollections() {
  const articlesDir = path.join(__dirname, '../data/articles');

  const slugs = await fs.readdir(articlesDir);

  let total = 0;
  let withCollections = 0;
  let emptyCollections = 0;
  const sampleArticles = [];

  for (const slug of slugs) {
    const metadataPath = path.join(articlesDir, slug, 'metadata.json');

    if (!await fs.pathExists(metadataPath)) continue;

    const metadata = await fs.readJSON(metadataPath);
    total++;

    if (metadata.collections && metadata.collections.length > 0) {
      withCollections++;

      // Sample first 5 articles with collections
      if (sampleArticles.length < 5) {
        sampleArticles.push({
          slug,
          title: metadata.title?.substring(0, 60) + '...',
          collections: metadata.collections
        });
      }
    } else {
      emptyCollections++;
    }
  }

  console.log('\n📊 Collection Data Quality Report');
  console.log('='.repeat(60));
  console.log(`Total articles: ${total}`);
  console.log(`With collections: ${withCollections} (${(withCollections/total*100).toFixed(1)}%)`);
  console.log(`Empty collections: ${emptyCollections} (${(emptyCollections/total*100).toFixed(1)}%)`);
  console.log('');

  console.log('📋 Sample articles with collections:');
  sampleArticles.forEach((article, i) => {
    console.log(`\n${i + 1}. ${article.slug}`);
    console.log(`   Title: ${article.title}`);
    console.log(`   Collections: ${article.collections.join(', ')}`);
  });

  console.log('\n✅ Done!\n');
}

checkCollections().catch(console.error);
