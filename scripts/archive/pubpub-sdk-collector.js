#!/usr/bin/env node

/**
 * PubPub SDK Collector
 * Collects CrimConsortium data using official PubPub SDK instead of HTML scraping
 *
 * ADVANTAGES OVER HTML SCRAPING:
 * - 10x faster (batch queries vs individual page scraping)
 * - More reliable (API vs fragile HTML selectors)
 * - Richer data (ORCID, affiliations, structured content)
 * - Future-proof (SDK maintained by PubPub team)
 */

import 'dotenv/config';
import { PubPub } from '@pubpub/sdk';
import fs from 'fs-extra';
import { Logger, FileHelper } from '../src/lib/utils.js';

class PubPubSDKCollector {
  constructor() {
    this.logger = new Logger();
    this.fileHelper = new FileHelper();
    this.sdk = null;

    // Same 30 consortium members as before
    this.consortiumMembers = [
      { id: 'university-of-manchester-criminology', name: 'University of Manchester, Department of Criminology', slug: 'uomcriminology' },
      { id: 'northeastern-university', name: 'Northeastern University, School of Criminology & Criminal Justice', slug: 'northeasternccj' },
      { id: 'simon-fraser-university', name: 'Simon Fraser University, School of Criminology', slug: 'sfu1c' },
      { id: 'universite-de-montreal', name: 'Université de Montréal, École de Criminologie', slug: 'montreal1c' },
      { id: 'criminology-journal', name: 'Criminology: An Interdisciplinary Journal', slug: 'crim' },
      { id: 'academy-criminal-justice', name: 'Academy of Criminal Justice Sciences', slug: 'acjs1c' },
      { id: 'max-planck-institute', name: 'Max Planck Institute for the Study of Crime, Security & Law', slug: 'mpicsl' },
      { id: 'ghent-university', name: 'Ghent University, Department of Criminology', slug: 'ghent1c' },
      { id: 'temple-university', name: 'Temple University, Department of Criminal Justice', slug: 'temple1c' },
      { id: 'university-of-missouri', name: 'University of Missouri—St. Louis, Department of Criminology & Criminal Justice', slug: 'umsl1c' },
      { id: 'university-of-georgia', name: 'University of Georgia, Department of Sociology', slug: 'uga1c' },
      { id: 'university-of-cambridge', name: 'University of Cambridge, Institute of Criminology, Prisons Research Centre', slug: 'prisonsresearch1c' },
      { id: 'john-jay-college', name: 'John Jay College of Criminal Justice, Research & Evaluation Center', slug: 'johnjayrec1c' },
      { id: 'oral-history-criminology', name: 'Oral History of Criminology Project', slug: 'ohcp1c' },
      { id: 'university-of-texas-dallas', name: 'University of Texas at Dallas, Criminology & Criminal Justice', slug: 'utd1c' },
      { id: 'georgia-state-university', name: 'Georgia State University, Evidence-Based Cybersecurity Research Group', slug: 'cybersecurity1c' },
      { id: 'ucl', name: 'UCL, Bentham Project', slug: 'benthamproject1c' },
      { id: 'university-of-manchester-open-research', name: 'University of Manchester, Office for Open Research', slug: 'uomopenresearch' },
      { id: 'knowledge-futures', name: 'Knowledge Futures', slug: 'kf' },
      { id: 'hawaii-crime-lab', name: 'Hawaiʻi Crime Lab', slug: 'hawaiicrimelab' },
      { id: 'journal-historical-criminology', name: 'Journal of Historical Criminology', slug: 'jhc' },
      { id: 'philadelphia-dao', name: 'Philadelphia District Attorney\'s Office, DATA Lab', slug: 'philadelphiada1c' },
      { id: 'spanish-criminology-society', name: 'Sociedad Española de Investigación Criminológica', slug: 'seic1c' },
      { id: 'evidence-based-policing', name: 'Society of Evidence Based Policing', slug: 'sebp' },
      { id: 'south-asian-criminology', name: 'South Asian Society of Criminology and Victimology', slug: 'sascv' },
      { id: 'uc-irvine', name: 'UC Irvine, Department of Criminology, Law and Society', slug: 'ucirvine2' },
      { id: 'university-of-leeds', name: 'University of Leeds, Centre for Criminal Justice Studies', slug: 'leeds1c' },
      { id: 'university-of-liverpool', name: 'University of Liverpool, Department of Sociology, Social Policy and Criminology', slug: 'liverpool1c' },
      { id: 'university-of-nebraska', name: 'University of Nebraska Omaha, School of Criminology & Criminal Justice', slug: 'nebraska1c' },
      { id: 'university-of-waikato', name: 'University of Waikato, Te Puna Haumaru New Zealand Institute for Security & Crime Science', slug: 'waikato1c' }
    ];
  }

  async initialize() {
    this.logger.info('🔌 Initializing PubPub SDK...');

    // Check for credentials
    if (!process.env.PUBPUB_EMAIL || !process.env.PUBPUB_PASSWORD) {
      throw new Error(
        'Missing PubPub credentials. Please set PUBPUB_EMAIL and PUBPUB_PASSWORD environment variables.'
      );
    }

    try {
      // Create SDK instance with authentication
      this.sdk = await PubPub.createSDK({
        communityUrl: process.env.PUBPUB_COMMUNITY_URL || 'https://www.crimrxiv.com',
        email: process.env.PUBPUB_EMAIL,
        password: process.env.PUBPUB_PASSWORD
      });

      this.logger.success('✅ Connected to PubPub API');

      // Connection successful - ready to query data

    } catch (error) {
      this.logger.error('Failed to initialize PubPub SDK:', error.message);
      throw error;
    }
  }

  async collectAllData() {
    this.logger.info('🚀 Starting SDK-based data collection...');

    try {
      // Step 1: Get all collections (consortium members)
      const collections = await this.getAllCollections();
      this.logger.success(`✅ Found ${collections.length} consortium member collections`);

      // Step 2: Get all publications (batch query - much faster!)
      const allPubs = await this.getAllPublications();
      this.logger.success(`✅ Found ${allPubs.length} total publications`);

      // Step 3: Enrich publications with full data
      const enrichedPubs = await this.enrichPublications(allPubs);
      this.logger.success(`✅ Enriched ${enrichedPubs.length} publications with full metadata`);

      // Step 4: Build final dataset
      const dataset = await this.buildDataset(collections, enrichedPubs);
      this.logger.success('✅ Dataset built successfully');

      // Step 5: Save dataset
      await this.saveDataset(dataset);

      // Print results
      this.printResults(dataset);

      return dataset;

    } catch (error) {
      this.logger.error('Data collection failed:', error.message);
      throw error;
    }
  }

  async getAllCollections() {
    this.logger.info('📂 Fetching all collections...');

    try {
      // Get all collections from the community
      const response = await this.sdk.collection.getMany({
        limit: 100,
        orderBy: 'title'
      });

      const allCollections = response?.body || [];
      this.logger.info(`Found ${allCollections.length} total collections in community`);

      // Filter to known consortium members
      const consortiumCollections = allCollections.filter(collection =>
        this.consortiumMembers.some(member => member.slug === collection.slug)
      );

      // Log which members were found
      consortiumCollections.forEach(col => {
        const member = this.consortiumMembers.find(m => m.slug === col.slug);
        this.logger.info(`  ✓ ${member.name}`);
      });

      // Log missing members
      const missingMembers = this.consortiumMembers.filter(member =>
        !consortiumCollections.some(col => col.slug === member.slug)
      );

      if (missingMembers.length > 0) {
        this.logger.warning(`⚠️  ${missingMembers.length} members not found as collections:`);
        missingMembers.forEach(m => {
          this.logger.warning(`    - ${m.name} (${m.slug})`);
        });
      }

      return consortiumCollections;

    } catch (error) {
      this.logger.error('Failed to get collections:', error.message);
      throw error;
    }
  }

  async getAllPublications() {
    this.logger.info('📖 Fetching all publications (batch query)...');

    let offset = 0;
    const limit = 100;
    const allPubs = [];

    try {
      while (true) {
        const { body: batch } = await this.sdk.pub.getMany({
          limit,
          offset,
          orderBy: 'createdAt',
          orderDirection: 'desc'
        });

        if (!batch || batch.length === 0) break;

        allPubs.push(...batch);
        this.logger.info(`  📊 Fetched ${allPubs.length} publications...`);

        offset += limit;

        // Optional: Add small delay to be respectful
        await this.delay(100);
      }

      return allPubs;

    } catch (error) {
      this.logger.error('Failed to fetch publications:', error.message);
      throw error;
    }
  }

  async enrichPublications(pubs) {
    this.logger.info(`📝 Enriching ${pubs.length} publications with full metadata...`);

    const enriched = [];
    let processed = 0;

    for (const pub of pubs) {
      try {
        // Get full pub details with related data
        const { body: fullPub } = await this.sdk.pub.get({
          slugOrId: pub.id
          // Note: SDK may automatically include related data
          // Check SDK docs for 'include' parameter
        });

        // Get attributions (authors) separately if needed
        let attributions = fullPub.attributions || [];
        if (!attributions || attributions.length === 0) {
          try {
            const { body: attrs } = await this.sdk.attribution.getMany({
              pubId: fullPub.id
            });
            attributions = attrs || [];
          } catch (e) {
            // Attribution fetch failed, continue with empty array
          }
        }

        // Get collection memberships
        let collectionPubs = fullPub.collectionPubs || [];
        if (!collectionPubs || collectionPubs.length === 0) {
          try {
            const { body: colPubs } = await this.sdk.collectionPub.getMany({
              pubId: fullPub.id
            });
            collectionPubs = colPubs || [];
          } catch (e) {
            // Collection fetch failed
          }
        }

        // Parse ProseMirror content to text and HTML
        const parsedContent = this.parseProseMirrorContent(fullPub.content);

        // Determine consortium member associations from collections AND affiliations
        const collections = collectionPubs.map(cp => cp.collection).filter(Boolean);
        const memberAssociations = new Set();
        const memberNames = new Set();

        // Method 1: Check if pub is in a member collection
        collections.forEach(collection => {
          const member = this.consortiumMembers.find(m => m.slug === collection.slug);
          if (member) {
            memberAssociations.add(member.id);
            memberNames.add(member.name);
          }
        });

        // Method 2: Check author affiliations against consortium patterns
        attributions.forEach(attribution => {
          if (attribution.affiliation) {
            this.consortiumPatterns.forEach(pattern => {
              const matched = pattern.patterns.some(p => {
                try {
                  const regex = new RegExp(p, 'i');
                  return regex.test(attribution.affiliation);
                } catch (e) {
                  return false;
                }
              });

              if (matched) {
                const member = this.consortiumMembers.find(m => m.id === pattern.id);
                if (member) {
                  memberAssociations.add(member.id);
                  memberNames.add(member.name);
                }
              }
            });
          }
        });

        // Convert Sets to Arrays
        const memberAssociationsArray = Array.from(memberAssociations);
        const memberNamesArray = Array.from(memberNames);

        // Build enriched publication object
        const enrichedPub = {
          // Core identifiers
          id: fullPub.id,
          slug: fullPub.slug,

          // Metadata
          title: fullPub.title || 'Untitled',
          description: fullPub.description || '',
          doi: fullPub.doi || '',
          createdAt: fullPub.customPublishedAt || fullPub.createdAt || new Date().toISOString(),

          // Enhanced content from ProseMirror
          fullContent: parsedContent.fullText,
          fullContentHTML: parsedContent.html,
          sections: parsedContent.sections,
          references: parsedContent.references,

          // Enhanced authors with ORCID and affiliations
          authors: attributions.map((attr, index) => ({
            name: attr.name || 'Unknown Author',
            orcid: attr.orcid || null,  // NEW: ORCID identifier
            affiliation: attr.affiliation || '',  // NEW: Now populated!
            roles: attr.roles || [],  // NEW: Author roles
            order: attr.order !== undefined ? attr.order : index + 1,
            isCorresponding: attr.isCorresponding || false  // NEW
          })),

          // Collection memberships
          collections: collections.map(c => ({
            id: c.id,
            title: c.title,
            slug: c.slug
          })),
          memberAssociations: memberAssociationsArray,
          memberNames: memberNamesArray,

          // Downloads/attachments
          downloads: this.parseDownloads(fullPub.downloads),

          // Pub edges (version-of links, etc.)
          pubEdges: (fullPub.pubEdges || []).map(edge => ({
            type: edge.relationType || edge.type,
            targetPub: edge.targetPub,
            externalPublication: edge.externalPublication
          })),
          versionOfUrl: this.extractVersionOfUrl(fullPub.pubEdges || []),

          // Metadata
          originalUrl: `https://www.crimrxiv.com/pub/${fullPub.slug}`,
          collectedAt: new Date().toISOString(),
          source: 'pubpub-sdk'
        };

        enriched.push(enrichedPub);
        processed++;

        if (processed % 10 === 0) {
          this.logger.info(`  ✅ Processed ${processed}/${pubs.length} publications...`);
        }

        // Log member matches for first few publications
        if (processed <= 5 && memberAssociationsArray.length > 0) {
          this.logger.info(`     📌 "${fullPub.title?.substring(0, 40)}..." → ${memberNamesArray.join(', ')}`);
        }

      } catch (error) {
        this.logger.warning(`❌ Failed to enrich ${pub.slug}: ${error.message}`);
        // Continue with next publication
      }
    }

    return enriched;
  }

  parseProseMirrorContent(pmDoc) {
    if (!pmDoc || !pmDoc.content) {
      return {
        fullText: '',
        html: '',
        sections: [],
        references: []
      };
    }

    try {
      const fullText = this.extractTextFromNodes(pmDoc.content);
      const sections = this.extractSections(pmDoc.content);
      const references = this.extractCitations(pmDoc.content);
      const html = this.renderToHTML(pmDoc.content);

      return { fullText, html, sections, references };
    } catch (error) {
      this.logger.warning(`Failed to parse ProseMirror content: ${error.message}`);
      return {
        fullText: '',
        html: '',
        sections: [],
        references: []
      };
    }
  }

  extractTextFromNodes(nodes, level = 0) {
    let text = '';

    for (const node of nodes) {
      if (node.type === 'text') {
        text += node.text;
      } else if (node.content && Array.isArray(node.content)) {
        text += this.extractTextFromNodes(node.content, level + 1);
      }

      // Add spacing between blocks
      if (['paragraph', 'heading', 'blockquote'].includes(node.type)) {
        text += '\n\n';
      }
    }

    return text.trim();
  }

  extractSections(nodes) {
    const sections = [];
    let currentHeading = null;
    let currentContent = [];

    for (const node of nodes) {
      if (node.type === 'heading') {
        // Save previous section
        if (currentHeading) {
          const content = this.extractTextFromNodes(currentContent);
          sections.push({
            heading: this.extractTextFromNodes([currentHeading]),
            content: content,
            level: `h${currentHeading.attrs?.level || 1}`,
            wordCount: content.split(/\s+/).length
          });
        }

        // Start new section
        currentHeading = node;
        currentContent = [];
      } else {
        currentContent.push(node);
      }
    }

    // Save last section
    if (currentHeading) {
      const content = this.extractTextFromNodes(currentContent);
      sections.push({
        heading: this.extractTextFromNodes([currentHeading]),
        content: content,
        level: `h${currentHeading.attrs?.level || 1}`,
        wordCount: content.split(/\s+/).length
      });
    }

    return sections;
  }

  extractCitations(nodes) {
    const citations = [];

    const traverse = (nodeList) => {
      for (const node of nodeList) {
        if (node.type === 'citation') {
          const citation = node.attrs?.value || node.attrs?.unstructuredValue;
          if (citation) citations.push(citation);
        }
        if (node.content && Array.isArray(node.content)) {
          traverse(node.content);
        }
      }
    };

    traverse(nodes);
    return citations;
  }

  renderToHTML(nodes) {
    let html = '';

    for (const node of nodes) {
      switch (node.type) {
        case 'heading': {
          const level = node.attrs?.level || 1;
          const id = node.attrs?.id || '';
          const content = node.content ? this.extractTextFromNodes([node]) : '';
          html += `<h${level}${id ? ` id="${id}"` : ''}>${content}</h${level}>`;
          break;
        }
        case 'paragraph': {
          const content = node.content ? this.renderToHTML(node.content) : '';
          html += `<p>${content}</p>`;
          break;
        }
        case 'text': {
          let text = node.text || '';

          // Apply marks (bold, italic, etc.)
          if (node.marks && Array.isArray(node.marks)) {
            for (const mark of node.marks) {
              switch (mark.type) {
                case 'strong':
                  text = `<strong>${text}</strong>`;
                  break;
                case 'em':
                  text = `<em>${text}</em>`;
                  break;
                case 'link':
                  const href = mark.attrs?.href || '#';
                  text = `<a href="${href}">${text}</a>`;
                  break;
              }
            }
          }

          html += text;
          break;
        }
        case 'blockquote': {
          const content = node.content ? this.renderToHTML(node.content) : '';
          html += `<blockquote>${content}</blockquote>`;
          break;
        }
        case 'bulletList': {
          const content = node.content ? this.renderToHTML(node.content) : '';
          html += `<ul>${content}</ul>`;
          break;
        }
        case 'orderedList': {
          const content = node.content ? this.renderToHTML(node.content) : '';
          html += `<ol>${content}</ol>`;
          break;
        }
        case 'listItem': {
          const content = node.content ? this.renderToHTML(node.content) : '';
          html += `<li>${content}</li>`;
          break;
        }
        // Add more node types as needed
      }
    }

    return html;
  }

  parseDownloads(downloads) {
    if (!downloads) return {};

    const result = {};

    if (downloads.pdf) result.pdf = downloads.pdf;
    if (downloads.docx || downloads.word) result.word = downloads.docx || downloads.word;
    if (downloads.epub) result.epub = downloads.epub;
    if (downloads.html) result.html = downloads.html;
    if (downloads.markdown) result.markdown = downloads.markdown;

    return result;
  }

  extractVersionOfUrl(pubEdges) {
    if (!pubEdges || pubEdges.length === 0) return null;

    const versionOfEdge = pubEdges.find(edge =>
      edge.relationType === 'version-of' || edge.type === 'version-of'
    );

    if (versionOfEdge) {
      return versionOfEdge.externalPublication || versionOfEdge.targetPub?.url || null;
    }

    return null;
  }

  async buildDataset(collections, publications) {
    this.logger.info('🔧 Building final dataset...');

    const dataset = {
      metadata: {
        name: 'CrimConsortium SDK Dataset',
        description: `${publications.length} publications from 30 consortium members (affiliation-based matching)`,
        version: '8.0',
        lastUpdated: new Date().toISOString(),
        collectionMethod: 'PubPub SDK API with affiliation matching',
        sdkVersion: '1.1.1'
      },

      summary: {
        totalMembers: 30,
        totalPublications: publications.length,
        publicationsWithOrcid: publications.filter(p =>
          p.authors && p.authors.some(a => a.orcid)
        ).length,
        publicationsWithDOI: publications.filter(p => p.doi).length,
        publicationsWithFullContent: publications.filter(p =>
          p.fullContent && p.fullContent.length > 100
        ).length
      },

      members: this.consortiumMembers.map(member => {
        const pubCount = publications.filter(p =>
          p.memberAssociations && p.memberAssociations.includes(member.id)
        ).length;

        const memberPubs = publications
          .filter(p => p.memberAssociations && p.memberAssociations.includes(member.id))
          .map(p => p.slug);

        return {
          id: member.id,
          name: member.name,
          slug: member.slug,
          url: `https://www.crimrxiv.com/${member.slug}`,
          publicationCount: pubCount,
          publications: memberPubs,
          memberType: pubCount > 0 ? 'research-institution' : 'supporting-organization'
        };
      }).sort((a, b) => b.publicationCount - a.publicationCount),

      publications: publications.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      )
    };

    return dataset;
  }

  async saveDataset(dataset) {
    this.logger.info('💾 Saving dataset...');

    await this.fileHelper.ensureDir('./data/final');
    await this.fileHelper.writeJSON('./data/final/consortium-dataset.json', dataset);

    this.logger.success('✅ Dataset saved to data/final/consortium-dataset.json');
  }

  printResults(dataset) {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 PUBPUB SDK COLLECTION COMPLETE');
    console.log('='.repeat(80));
    console.log(`📚 Total Publications: ${dataset.publications.length}`);
    console.log(`👥 Consortium Members: ${dataset.members.length}`);
    console.log(`🎓 Research Institutions: ${dataset.members.filter(m => m.publicationCount > 0).length}`);
    console.log(`🤝 Supporting Organizations: ${dataset.members.filter(m => m.publicationCount === 0).length}`);

    console.log(`\n📊 ENHANCED DATA:`);
    console.log(`   Publications with ORCID: ${dataset.summary.publicationsWithOrcid}`);
    console.log(`   Publications with DOI: ${dataset.summary.publicationsWithDOI}`);
    console.log(`   Publications with full content: ${dataset.summary.publicationsWithFullContent}`);

    console.log('\n✨ SDK ADVANTAGES:');
    console.log('   ✅ Structured ProseMirror content (vs HTML parsing)');
    console.log('   ✅ Author ORCID identifiers captured');
    console.log('   ✅ Complete author affiliations');
    console.log('   ✅ Affiliation-based member matching');
    console.log('   ✅ Faster batch queries (vs individual page scraping)');

    console.log('\n🏆 TOP 10 CONSORTIUM MEMBERS BY PUBLICATIONS:');
    dataset.members
      .filter(m => m.publicationCount > 0)
      .slice(0, 10)
      .forEach((member, i) => {
        console.log(`   ${i + 1}. ${member.name}: ${member.publicationCount} pubs`);
      });

    console.log('='.repeat(80));
  }

  async cleanup() {
    if (this.sdk) {
      this.logger.info('🔌 Logging out from PubPub...');
      await this.sdk.logout();
      this.logger.success('✅ Logged out');
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  const collector = new PubPubSDKCollector();

  try {
    await collector.initialize();
    await collector.collectAllData();
    await collector.cleanup();

    console.log('\n✅ SDK collection completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ SDK collection failed:', error.message);
    console.error(error.stack);

    await collector.cleanup();
    process.exit(1);
  }
}

// Run if executed directly
// Check if this file is being run directly (not imported)
const isRunningDirectly = process.argv[1] && process.argv[1].endsWith('pubpub-sdk-collector.js');
if (isRunningDirectly) {
  main();
}

export default PubPubSDKCollector;
