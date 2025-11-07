#!/usr/bin/env node

/**
 * Check parquet file for external_publications_json data
 */

import duckdb from 'duckdb';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PARQUET_PATH = path.join(__dirname, '../public/data/metadata.parquet');

const db = new duckdb.Database(':memory:');
const conn = db.connect();

conn.all(`
  SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN external_publications_json IS NOT NULL AND external_publications_json != '[]' THEN 1 END) as has_external_pubs,
    COUNT(CASE WHEN external_publications_json IS NULL OR external_publications_json = '[]' THEN 1 END) as no_external_pubs
  FROM parquet_scan('${PARQUET_PATH.replace(/\\/g, '/')}')
`, (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }

  console.log('\n📊 Parquet File Analysis:');
  console.log('  Total articles:', rows[0].total);
  console.log('  Has external pubs:', rows[0].has_external_pubs);
  console.log('  No external pubs:', rows[0].no_external_pubs);

  // Get sample
  conn.all(`
    SELECT title, external_publications_json
    FROM parquet_scan('${PARQUET_PATH.replace(/\\/g, '/')}')
    WHERE external_publications_json IS NOT NULL AND external_publications_json != '[]'
    LIMIT 3
  `, (err, samples) => {
    if (err) {
      console.error('❌ Error getting samples:', err);
      process.exit(1);
    }

    console.log('\n📋 Sample articles with external publications:');
    samples.forEach((s, i) => {
      console.log(`  ${i+1}. ${s.title.substring(0, 60)}...`);
      console.log(`     External pubs: ${s.external_publications_json.substring(0, 100)}...`);
    });

    conn.close();
    db.close();
  });
});
