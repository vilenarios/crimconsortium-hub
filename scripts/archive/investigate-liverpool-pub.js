/**
 * Investigate Liverpool article pub object for institutional associations
 * Looking for: tags, labels, metadata, collections, or other fields
 */

import 'dotenv/config';
import { PubPub } from '@pubpub/sdk';
import Database from 'better-sqlite3';

async function investigate() {
  console.log('\n🔐 Logging in...');
  const sdk = await PubPub.createSDK({
    communityUrl: 'https://www.crimrxiv.com',
    email: process.env.PUBPUB_EMAIL,
    password: process.env.PUBPUB_PASSWORD
  });
  console.log('✅ Logged in\n');

  // Get the Liverpool article
  const slug = 'x6d4bp2s';
  console.log(`📄 Fetching full pub object for: ${slug}\n`);

  try {
    // Fetch with ALL possible includes to see everything
    const response = await sdk.pub.get({
      params: {
        slugOrId: slug
      },
      query: {
        include: [
          'attributions',
          'collectionPubs',
          'community',
          'draft',
          'releases',
          'outboundEdges',
          'inboundEdges',
          'members',
          'reviews',
          'submission'
        ]
      }
    });

    const pub = response.body;

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 FULL PUB OBJECT ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check avatar field (noticed Liverpool in URL)
    console.log('🖼️  AVATAR FIELD:');
    console.log('   ', pub.avatar || 'null');
    if (pub.avatar && pub.avatar.includes('Liverpool')) {
      console.log('   ✅ Contains "Liverpool" in avatar URL!');
    }
    console.log('');

    // Check for labels/tags
    console.log('🏷️  LABELS/TAGS:');
    console.log('   labels:', pub.labels || 'null');
    console.log('   tags:', pub.tags || 'null');
    console.log('');

    // Check metadata field
    console.log('📊 METADATA:');
    console.log('   ', JSON.stringify(pub.metadata, null, 2) || 'null');
    console.log('');

    // Check collectionPubs
    console.log('📚 COLLECTION PUBS:');
    if (pub.collectionPubs && pub.collectionPubs.length > 0) {
      console.log(`   Found ${pub.collectionPubs.length} collection(s):`);
      pub.collectionPubs.forEach((cp, i) => {
        console.log(`\n   Collection ${i + 1}:`);
        console.log('   - Collection ID:', cp.collectionId);
        console.log('   - Rank:', cp.rank);
        if (cp.collection) {
          console.log('   - Collection Title:', cp.collection.title);
          console.log('   - Collection Slug:', cp.collection.slug);
          console.log('   - Collection Avatar:', cp.collection.avatar);
          console.log('   - Collection Metadata:', JSON.stringify(cp.collection.metadata, null, 2));
        }
      });
    } else {
      console.log('   None');
    }
    console.log('');

    // Check attributions (we know affiliations are null, but check for other data)
    console.log('👥 ATTRIBUTIONS:');
    if (pub.attributions && pub.attributions.length > 0) {
      console.log(`   Found ${pub.attributions.length} attribution(s):`);
      pub.attributions.forEach((attr, i) => {
        console.log(`\n   Attribution ${i + 1}:`);
        console.log('   - Name:', attr.name);
        console.log('   - Affiliation:', attr.affiliation || 'null');
        console.log('   - ORCID:', attr.orcid || 'null');
        console.log('   - User ID:', attr.userId || 'null');
        console.log('   - Is Author:', attr.isAuthor);
        console.log('   - Role:', attr.role || 'null');

        // Check if attribution has any other fields
        const otherFields = Object.keys(attr).filter(key =>
          !['id', 'name', 'affiliation', 'orcid', 'userId', 'isAuthor', 'role', 'pubId', 'createdAt', 'updatedAt'].includes(key)
        );
        if (otherFields.length > 0) {
          console.log('   - Other fields:', otherFields.join(', '));
          otherFields.forEach(field => {
            console.log(`     - ${field}:`, attr[field]);
          });
        }
      });
    } else {
      console.log('   None');
    }
    console.log('');

    // Check for custom fields we might not know about
    console.log('🔍 OTHER PUB FIELDS:');
    const commonFields = [
      'id', 'slug', 'title', 'description', 'avatar', 'doi', 'customPublishedAt',
      'downloads', 'labels', 'tags', 'metadata', 'htmlTitle', 'htmlDescription',
      'communityId', 'createdAt', 'updatedAt', 'attributions', 'collectionPubs',
      'community', 'draft', 'releases', 'outboundEdges', 'inboundEdges', 'members', 'reviewers'
    ];

    const otherFields = Object.keys(pub).filter(key => !commonFields.includes(key));
    if (otherFields.length > 0) {
      console.log('   Found unexpected/custom fields:');
      otherFields.forEach(field => {
        console.log(`   - ${field}:`, typeof pub[field] === 'object' ? JSON.stringify(pub[field], null, 2) : pub[field]);
      });
    } else {
      console.log('   No custom fields detected');
    }
    console.log('');

    // Dump full object to file for detailed inspection
    console.log('💾 Writing full pub object to file...');
    const fs = await import('fs/promises');
    await fs.writeFile(
      'liverpool-pub-full.json',
      JSON.stringify(pub, null, 2),
      'utf-8'
    );
    console.log('   ✅ Saved to liverpool-pub-full.json\n');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎯 POTENTIAL LIVERPOOL ASSOCIATION FIELDS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const findings = [];

    if (pub.avatar && pub.avatar.includes('Liverpool')) {
      findings.push('✅ Avatar URL contains "Liverpool"');
    }

    if (pub.collectionPubs && pub.collectionPubs.length > 0) {
      const liverpoolCollections = pub.collectionPubs.filter(cp =>
        cp.collection && (
          cp.collection.title?.includes('Liverpool') ||
          cp.collection.slug?.includes('liverpool')
        )
      );
      if (liverpoolCollections.length > 0) {
        findings.push(`✅ Found ${liverpoolCollections.length} Liverpool collection(s)`);
      }
    }

    if (findings.length > 0) {
      findings.forEach(f => console.log(f));
    } else {
      console.log('❌ No obvious Liverpool associations found');
      console.log('   Check liverpool-pub-full.json for manual inspection');
    }

  } catch (error) {
    console.error('❌ Error fetching pub:', error);
    throw error;
  }
}

investigate().catch(console.error);
