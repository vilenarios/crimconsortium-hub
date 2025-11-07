#!/usr/bin/env node

/**
 * Check parquet file schema
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
  DESCRIBE SELECT * FROM parquet_scan('${PARQUET_PATH.replace(/\\/g, '/')}')
`, (err, rows) => {
  if (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }

  console.log('\n📋 Parquet Schema:');
  console.log('Column count:', rows.length);
  console.log('\nColumns:');
  rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.column_type})`);
  });

  // Check for external_publications_json specifically
  const hasExtPubs = rows.some(r => r.column_name === 'external_publications_json');
  console.log(`\n✅ Has external_publications_json column:`, hasExtPubs);

  conn.close();
  db.close();
});
