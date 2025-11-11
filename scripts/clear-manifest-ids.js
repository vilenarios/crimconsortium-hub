#!/usr/bin/env node

/**
 * Clear manifest_tx_id from database
 *
 * This allows articles to be re-uploaded to Arweave with updated metadata.
 * Run this before re-importing and re-uploading articles.
 */

import { CrimRxivDatabase } from '../src/lib/database.js';

async function clearManifestIds() {
  console.log('\n' + '='.repeat(60));
  console.log('🗑️  Clear Manifest Transaction IDs');
  console.log('='.repeat(60) + '\n');

  const db = new CrimRxivDatabase();
  db.initialize();

  try {
    // Get count before clearing
    const beforeCount = db.db.prepare(`
      SELECT COUNT(*) as count
      FROM articles
      WHERE manifest_tx_id IS NOT NULL
    `).get();

    console.log(`📊 Articles with manifest_tx_id: ${beforeCount.count}`);
    console.log('');

    // Clear manifest_tx_id
    console.log('🔄 Clearing manifest_tx_id from all articles...');
    const result = db.db.prepare(`
      UPDATE articles
      SET manifest_tx_id = NULL,
          manifest_uploaded = 0
      WHERE manifest_tx_id IS NOT NULL
    `).run();

    console.log(`✅ Cleared ${result.changes} articles`);
    console.log('');

    // Verify
    const afterCount = db.db.prepare(`
      SELECT COUNT(*) as count
      FROM articles
      WHERE manifest_tx_id IS NOT NULL
    `).get();

    console.log(`📊 Articles with manifest_tx_id after: ${afterCount.count}`);
    console.log('');
    console.log('✅ Done! Articles can now be re-uploaded with updated metadata.');

  } catch (error) {
    console.error('❌ Error clearing manifest IDs:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

clearManifestIds();
