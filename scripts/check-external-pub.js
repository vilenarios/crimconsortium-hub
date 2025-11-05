#!/usr/bin/env node
/**
 * Check if we have external publication data in our database
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/sqlite/crimrxiv.db');
const db = new Database(dbPath, { readonly: true });

// Get the example article
const row = db.prepare('SELECT content_json FROM articles WHERE slug = ? LIMIT 1').get('w6df4ln2');

if (row && row.content_json) {
  const data = JSON.parse(row.content_json);

  console.log('Checking for external publication fields...\n');
  console.log('Available top-level keys:');
  console.log(Object.keys(data).sort().join(', '));
  console.log('\n');

  // Check for potential external publication fields
  const potentialFields = [
    'externalPublications',
    'crossref',
    'versionOf',
    'relatedPubs',
    'pubEdges',
    'externalLinks',
    'canonicalUrl',
    'sourceUrl',
    'republication'
  ];

  console.log('Checking for external publication fields:');
  potentialFields.forEach(field => {
    if (data[field]) {
      console.log(`✅ Found: ${field}`);
      console.log(JSON.stringify(data[field], null, 2));
    } else {
      console.log(`❌ Not found: ${field}`);
    }
  });

  // Print sample of the full object (first 50 lines)
  console.log('\n\nFull object sample:');
  console.log(JSON.stringify(data, null, 2).split('\n').slice(0, 50).join('\n'));

} else {
  console.log('Article not found or has no content_json');
}

db.close();
