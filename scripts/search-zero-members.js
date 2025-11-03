/**
 * Search for articles related to members with 0 articles
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'data', 'sqlite', 'crimrxiv.db');
const db = new Database(dbPath, { readonly: true });

console.log('=== Searching for Hawaii/Hawai\'i Crime Lab ===');
const hawaii = db.prepare(`
  SELECT slug, title, authors_json, collections_json
  FROM articles
  WHERE authors_json LIKE '%Hawaii%'
     OR authors_json LIKE '%Hawai%'
     OR collections_json LIKE '%Hawaii%'
     OR collections_json LIKE '%Hawai%'
  LIMIT 10
`).all();
console.log(`Found: ${hawaii.length} articles`);
hawaii.forEach(a => {
  console.log(`- ${a.title.substring(0, 80)}`);
  if (a.authors_json.includes('Hawaii') || a.authors_json.includes('Hawai')) {
    console.log(`  Authors: ${a.authors_json.substring(0, 200)}`);
  }
});

console.log('\n=== Searching for Journal of Historical Criminology ===');
const journal = db.prepare(`
  SELECT slug, title, authors_json, collections_json
  FROM articles
  WHERE authors_json LIKE '%Historical Criminology%'
     OR collections_json LIKE '%Historical Criminology%'
  LIMIT 10
`).all();
console.log(`Found: ${journal.length} articles`);
journal.forEach(a => {
  console.log(`- ${a.title.substring(0, 80)}`);
});

console.log('\n=== Searching for South Asian Society ===');
const southAsian = db.prepare(`
  SELECT slug, title, authors_json, collections_json
  FROM articles
  WHERE authors_json LIKE '%South Asian%'
     OR collections_json LIKE '%South Asian%'
  LIMIT 10
`).all();
console.log(`Found: ${southAsian.length} articles`);
southAsian.forEach(a => {
  console.log(`- ${a.title.substring(0, 80)}`);
});

// Check if these are collections/supporting orgs rather than author affiliations
console.log('\n=== Checking collections field for these organizations ===');
const collectionCheck = db.prepare(`
  SELECT DISTINCT collections_json
  FROM articles
  WHERE collections_json LIKE '%Crime Lab%'
     OR collections_json LIKE '%Historical Criminology%'
     OR collections_json LIKE '%South Asian%'
  LIMIT 20
`).all();
console.log(`Found ${collectionCheck.length} articles with matching collections`);
collectionCheck.forEach(c => {
  console.log(c.collections_json);
});

db.close();
