/**
 * Investigate collections that the Liverpool article belongs to
 */

import 'dotenv/config';
import { PubPub } from '@pubpub/sdk';

async function investigate() {
  console.log('\n🔐 Logging in...');
  const sdk = await PubPub.createSDK({
    communityUrl: 'https://www.crimrxiv.com',
    email: process.env.PUBPUB_EMAIL,
    password: process.env.PUBPUB_PASSWORD
  });
  console.log('✅ Logged in\n');

  // Collection IDs from Liverpool article
  const collectionIds = [
    '72824d3a-2108-474b-b31e-728ef1e21c56',
    'fb44d3fb-7de9-4c5c-9690-a5a8b0a4ceee'
  ];

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📚 COLLECTION INVESTIGATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const collectionId of collectionIds) {
    console.log(`\n🔍 Fetching collection: ${collectionId}\n`);

    try {
      const response = await sdk.collection.get({
        params: {
          idOrSlug: collectionId
        }
      });

      const collection = response.body;

      console.log('Collection Details:');
      console.log('  Title:', collection.title);
      console.log('  Slug:', collection.slug);
      console.log('  Avatar:', collection.avatar || 'null');
      console.log('  Kind:', collection.kind);
      console.log('  Metadata:', JSON.stringify(collection.metadata, null, 2) || 'null');

      if (collection.title?.includes('Liverpool') || collection.slug?.includes('liverpool')) {
        console.log('  ✅ LIVERPOOL COLLECTION FOUND!');
      }

      console.log('');

    } catch (error) {
      console.error(`❌ Error fetching collection ${collectionId}:`, error.message);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

investigate().catch(console.error);
