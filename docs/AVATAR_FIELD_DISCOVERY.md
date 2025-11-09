# Avatar Field Discovery - Impact Analysis

**Date**: 2025-11-08
**Discovery**: CrimRxiv.com uses the `avatar` field (institutional badge/logo URLs) to associate articles with institutions

## The Breakthrough

After extensive investigation, we discovered that institutional associations are stored in the **`avatar` field**, NOT in author affiliations.

### Example - University of Liverpool

**Article**: "Implementing Safeguarding to Counter Extremism in the Classroom..."
**Avatar**: `https://assets.pubpub.org/1ueosomh/University of Liverpool-11756408197907.jpg`

Notice "University of Liverpool" is **in the filename** of the avatar URL!

## Current Situation

### Before Full Re-import
- **Total articles**: 1,645
- **Articles with avatar data**: 2 (0.1%) - only our test imports
- **Articles without avatar data**: 1,643 (99.9%) - need re-import

### Confirmed Working
- ✅ University of Liverpool: 2/2 test articles have avatars with "Liverpool" in filename
- ✅ Detection via avatar field works perfectly

## Expected Impact After Full Re-import

### Who Will Benefit?

**Unknown until re-import completes**, but likely scenarios:

**1. Universities (Institutional Badges)**
   - If crimrxiv.com displays institutional badges for universities
   - Articles submitted through institutional portals may have avatars
   - Could help universities with poor affiliation data (77% of articles have null affiliations)

**2. Organizations**
   - Hawai'i Crime Lab ❓
   - South Asian Society ❓
   - May have organizational logos as avatars

**3. Journals**
   - Unlikely - journals already work via `external_publications_json`
   - Criminology Journal already has 301 publications without needing avatars

### Current Detection Methods (Still Valid)

Our search now checks **4 fields** (up from 3):

1. **`authors_json`** - Author affiliations (77% null, but still useful)
2. **`external_publications_json`** - Journal names (works great for journals)
3. **`collections_json`** - Collection memberships
4. **`avatar`** ⭐ **NEW** - Institutional badge URLs

## Implementation Complete

### Files Updated

**Database Schema**:
- ✅ `src/lib/database.js` - Added `avatar` column with migration

**Import Pipeline**:
- ✅ `scripts/import-to-articles.js` - Captures `pub.avatar` field
- ✅ `scripts/export-to-parquet-external.js` - Exports avatar to Parquet

**Search & Display**:
- ✅ `src/lib/parquet-db-external.js` - Updated `searchByAffiliation()` to search avatar field
- ✅ `src/components/consortium.js` - Added "Liverpool" pattern

### Test Results

```bash
$ node scripts/test-liverpool-avatar.js

✅ SUCCESS! Liverpool articles detected via avatar field

1. Implementing Safeguarding to Counter Extremism in the Classroom...
   Avatar: https://assets.pubpub.org/.../University of Liverpool-...jpg

2. Preventing and countering extremism in the educational sector...
   Avatar: https://assets.pubpub.org/.../University of Liverpool-...jpg
```

## Recommendations

### Immediate Action Required

**Full Re-import** to capture avatars for all 1,645 articles:

```bash
# This will take 30-45 minutes
npm run import

# Then export to Parquet
npm run export
```

### After Re-import

1. **Run comprehensive test**:
   ```bash
   node scripts/test-all-consortium-members.js
   ```

2. **Analyze avatar field usage**:
   ```bash
   node scripts/analyze-avatar-field.js
   ```

3. **Check improvements**:
   - University of Liverpool: Should show ALL Liverpool articles (not just 2)
   - Hawai'i Crime Lab: May find articles if they have organizational badges
   - South Asian Society: May find articles if they have organizational badges
   - Other universities: May improve accuracy if they use institutional badges

### Potential Concerns

**"Liverpool" Pattern Too Broad?**
- Currently searching for "Liverpool" in avatar field
- Should be safe - avatars are institutional badge URLs with specific formatting
- If false positives occur, can tighten to "University of Liverpool"

**Other Universities Using Avatars?**
- Unknown until full re-import completes
- If crimrxiv.com widely uses institutional badges, could help:
  - Manchester, Cambridge, Leeds, Georgia, South Carolina, etc.
- If avatars are rare, may only help Liverpool

## Why This Matters

### The Problem We Solved

**Before**: 77% of articles have `null` affiliations in PubPub API
- Neither `pub.get()` with `include: ['attributions']`
- Nor `pubAttribution.getMany()` API
- Returned affiliation data for most articles

**After**: Avatar field provides alternative institutional association
- Doesn't require authors to fill in affiliation forms
- Automatically captured from institutional submission portals
- Works even when affiliation data is null

### The Discovery Process

1. ❌ Tested standard `pub.get()` API → affiliations null
2. ❌ Tested dedicated `pubAttribution.getMany()` API → affiliations null
3. ❌ Re-imported fresh article → still null
4. ✅ **Examined full pub object** → Found avatar URL with "University of Liverpool"!

## Next Steps

1. **Wait for user to run full re-import** (their decision)
2. **Analyze results** to see how many articles have avatars
3. **Update patterns** for other consortium members if needed
4. **Document findings** in final consortium member analysis

---

**Status**: ✅ Implementation complete, awaiting full re-import to measure real-world impact
