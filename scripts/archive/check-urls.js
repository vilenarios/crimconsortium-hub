#!/usr/bin/env node

import fs from 'fs-extra';

const data = await fs.readJSON('./data/final/consortium-dataset-urls-only.backup.json');

const mainFeedPubs = data.publications.filter(p => p.source === 'main-feed');
const memberPubs = data.publications.filter(p => p.source !== 'main-feed');

console.log('Total publications:', data.publications.length);
console.log('Main feed pubs:', mainFeedPubs.length);
console.log('Member page pubs:', memberPubs.length);

console.log('\nFirst member page pub:');
console.log(JSON.stringify(memberPubs[0], null, 2));

console.log('\nUnique sources:');
const sources = [...new Set(data.publications.map(p => p.source))];
console.log(sources);

console.log('\nUnique member associations:');
const associations = [...new Set(data.publications.map(p => p.memberAssociation))];
console.log(associations);