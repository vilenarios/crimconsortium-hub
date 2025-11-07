#!/usr/bin/env node
import duckdb from 'duckdb';

const db = new duckdb.Database(':memory:');
const conn = db.connect();

conn.all(`
  SELECT slug, version_number, has_multiple_versions
  FROM parquet_scan('public/data/metadata.parquet')
  WHERE slug = 'omn355hv'
`, (err, rows) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log('\n📊 Article version info:');
  console.log(JSON.stringify(rows, null, 2));

  if (rows[0] && rows[0].version_number === 2 && rows[0].has_multiple_versions) {
    console.log('\n✅ Version tracking is working correctly!');
  } else {
    console.log('\n❌ Version tracking needs fixing');
  }

  conn.close();
  db.close();
});
