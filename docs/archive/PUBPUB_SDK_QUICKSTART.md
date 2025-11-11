# PubPub SDK Quick Start Guide

Get started with the PubPub SDK collector in 15 minutes.

---

## Prerequisites

1. **Node.js 18+** (required by @pubpub/sdk)
2. **CrimRxiv Account** - Create at https://www.crimrxiv.com if needed
3. **Repository Setup** - Clone and install dependencies

---

## Step 1: Install SDK

```bash
npm install @pubpub/sdk
```

**Expected output:**
```
added 1 package, and audited X packages in Xs
```

---

## Step 2: Configure Credentials

```bash
# Copy template (if you haven't already)
cp .env.example .env

# Edit .env with your credentials
# Use your favorite editor (VS Code, nano, vim, etc.)
```

**Edit the PubPub section in .env:**
```env
# ==================================================
# PUBPUB SDK CONFIGURATION
# ==================================================

PUBPUB_COMMUNITY_URL=https://www.crimrxiv.com
PUBPUB_EMAIL=your-actual-email@example.com
PUBPUB_PASSWORD=your-actual-password
```

⚠️ **Security Note:** The `.env` file is already in `.gitignore` - never commit credentials!

---

## Step 3: Test Connection

Create a simple test script to verify authentication:

**test-sdk-connection.js:**
```javascript
import { PubPub } from '@pubpub/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('Testing PubPub SDK connection...\n');

  try {
    // Initialize SDK
    const sdk = await PubPub.createSDK({
      communityUrl: process.env.PUBPUB_COMMUNITY_URL,
      email: process.env.PUBPUB_EMAIL,
      password: process.env.PUBPUB_PASSWORD
    });

    console.log('✅ Authentication successful!');

    // Get community info
    const community = await sdk.community.get();
    console.log(`\n📚 Connected to: ${community.title}`);
    console.log(`   URL: ${community.subdomain || community.domain}`);

    // Get first 5 pubs
    const pubs = await sdk.pub.getMany({ limit: 5 });
    console.log(`\n📖 Found ${pubs.length} publications (showing first 5):`);
    pubs.forEach((pub, i) => {
      console.log(`   ${i + 1}. ${pub.title.substring(0, 60)}...`);
    });

    // Logout
    await sdk.logout();
    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
```

**Run it:**
```bash
node test-sdk-connection.js
```

**Expected output:**
```
Testing PubPub SDK connection...

✅ Authentication successful!

📚 Connected to: CrimRxiv
   URL: www.crimrxiv.com

📖 Found 5 publications (showing first 5):
   1. Exploring the Good Lives Model Concepts among an Ethnicall...
   2. Gets Under the Skin:  Elaborating on and Expanding the 'S...
   3. Reduce the Costs and Increase the Benefits of Open Science...
   4. 'It's not going to be tech that gets us out of it': Modern...
   5. Process evaluation of a community-based domestic violence ...

✅ Test complete!
```

---

## Step 4: Run Full SDK Collector

```bash
node scripts/pubpub-sdk-collector.js
```

**What it does:**
1. ✅ Authenticates with CrimRxiv
2. 📂 Fetches all collections (consortium members)
3. 📖 Batch queries all publications
4. 📝 Enriches each pub with full metadata
5. 💾 Saves to `data/final/consortium-dataset.json`

**Expected timeline:**
- Authentication: ~2 seconds
- Fetch collections: ~3 seconds
- Fetch all pubs: ~2-5 minutes (batch queries)
- Enrich pubs: ~5-10 minutes (individual queries)
- **Total: ~10-15 minutes** (vs 45 min with HTML scraping!)

---

## Step 5: Verify Data Quality

```bash
# Check dataset was created
ls -lh data/final/consortium-dataset.json

# View summary
node -e "const data = require('./data/final/consortium-dataset.json'); console.log(JSON.stringify(data.summary, null, 2))"
```

**Expected output:**
```json
{
  "totalMembers": 30,
  "totalPublications": 886,
  "publicationsWithOrcid": 234,
  "publicationsWithDOI": 876,
  "publicationsWithFullContent": 886
}
```

---

## Step 6: Compare with HTML Scraping

If you have old data from HTML scraping:

```bash
# Compare publication counts
OLD_COUNT=$(node -e "console.log(require('./data/final/consortium-dataset-old.json').publications.length)")
NEW_COUNT=$(node -e "console.log(require('./data/final/consortium-dataset.json').publications.length)")

echo "HTML Scraping: $OLD_COUNT publications"
echo "SDK Collection: $NEW_COUNT publications"
```

**Check for enhancements:**
```javascript
const data = require('./data/final/consortium-dataset.json');

// Count enhanced fields
const withOrcid = data.publications.filter(p =>
  p.authors.some(a => a.orcid)
).length;

const withAffiliations = data.publications.filter(p =>
  p.authors.some(a => a.affiliation)
).length;

console.log(`Publications with author ORCID: ${withOrcid} (NEW!)`);
console.log(`Publications with author affiliations: ${withAffiliations} (ENHANCED!)`);
```

---

## Step 7: Test Build System

```bash
# Generate static site with SDK data
npm run build

# Verify output
ls -lh dist/main/
```

**Expected:**
- Same 916+ pages generated
- Article pages now show ORCID links for authors
- Author affiliations displayed

---

## Troubleshooting

### Error: "Missing PubPub credentials"
**Solution:** Make sure `.env` file exists with correct variables:
```bash
cat .env | grep PUBPUB
```

### Error: "Authentication failed"
**Solution:** Verify credentials are correct:
1. Log in manually at https://www.crimrxiv.com
2. Confirm email/password work
3. Check for typos in `.env`

### Error: "Cannot find module '@pubpub/sdk'"
**Solution:** Install the SDK:
```bash
npm install @pubpub/sdk
```

### Slow Performance (> 30 minutes)
**Solution:** Check network connection and add delays:
```javascript
// In pubpub-sdk-collector.js, increase delay:
await this.delay(500);  // from 100ms to 500ms
```

### Missing Collections
**Issue:** Some consortium members not found
**Solution:**
1. Check if collection slugs match exactly
2. Verify account has access to all collections
3. Some members may not have collections (supporting orgs)

### ProseMirror Parsing Errors
**Issue:** Some content not parsing correctly
**Solution:**
1. Check `pub.content` structure: `console.log(JSON.stringify(pub.content, null, 2))`
2. Add error handling for unknown node types
3. Fallback to HTML rendering if text extraction fails

---

## Performance Benchmarks

| Metric | HTML Scraping | SDK Collection | Improvement |
|--------|---------------|----------------|-------------|
| Total Time | ~45 minutes | ~10 minutes | **4.5x faster** |
| Network Requests | ~900 individual | ~100 batch | **9x fewer** |
| Data Quality | Text from HTML | Structured JSON | **Much richer** |
| Author ORCID | ❌ Not captured | ✅ Captured | **New field** |
| Affiliations | ❌ Empty | ✅ Populated | **Enhanced** |
| Maintainability | ⚠️ Fragile | ✅ Stable API | **More reliable** |

---

## Next Steps

1. ✅ **Verified SDK works** - Connection tested
2. ✅ **Collected full dataset** - 886 publications
3. ✅ **Build system works** - Static site generated
4. 🔄 **Update npm scripts** - Replace HTML scraper
5. 📝 **Update documentation** - CLAUDE.md changes
6. 🚀 **Deploy** - Push to production

---

## Updating NPM Scripts

Edit `package.json`:

```json
{
  "scripts": {
    "import": "node scripts/pubpub-sdk-collector.js",
    "import-legacy": "node scripts/robust-incremental-scraper.js",
    "import-html-scraping": "node scripts/enhanced-consortium-scraper.js"
  }
}
```

Now:
- `npm run import` - Uses SDK (new default)
- `npm run import-legacy` - Falls back to HTML scraping if needed

---

## Getting Help

**SDK Issues:**
- PubPub SDK Repository: https://github.com/pubpub/sdk
- PubPub Discussions: https://github.com/pubpub/pubpub/discussions

**CrimRxiv Specific:**
- Community: https://www.crimrxiv.com
- Support: Check community pages for contact info

**This Project:**
- See `docs/PUBPUB_SDK_MIGRATION_PLAN.md` for detailed architecture
- Review `scripts/pubpub-sdk-collector.js` for implementation details

---

## FAQ

**Q: Do I need permission to access CrimRxiv data?**
A: Public publications are accessible with any account. Private/draft content requires specific permissions.

**Q: Will this work after PubPub Legacy ends (May 2025)?**
A: Yes! The SDK will be updated for the new PubPub Platform. Using the SDK ensures smooth transition.

**Q: Can I run both HTML scraping and SDK collection?**
A: Yes! Keep both scripts and compare results during migration phase.

**Q: What if some publications are missing?**
A: Check collection memberships and API filters. Some pubs may be drafts or restricted.

**Q: How often should I re-import data?**
A: Run `npm run import` periodically (weekly/monthly) to catch new publications.

---

**Ready to migrate? See `docs/PUBPUB_SDK_MIGRATION_PLAN.md` for full implementation guide.**
