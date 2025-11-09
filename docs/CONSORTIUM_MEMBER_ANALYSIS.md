# Consortium Member Publication Analysis

## Summary

**Date**: 2025-11-09
**Total Members**: 31
**Members with Publications**: 28 (90%)
**Members with 0 Publications**: 3 (10%)
**Total Publications Tracked**: 626

## Major Improvements

### Before Pattern Updates
- **Members with 0 publications**: 6
- **Total publications tracked**: 587

### After Pattern Updates
- **Members with 0 publications**: 3 ✅
- **Total publications tracked**: 626 ✅ (+39 publications)

## Fixed Members

### 1. Criminology: An Interdisciplinary Journal
**Status**: ✅ **301 publications** (was 0)

**Updated Patterns**:
- `Criminology: An Interdisciplinary Journal`
- `CRIMINOLOGY` ⭐ NEW (73 external pubs)
- `Criminology & Public Policy` ⭐ NEW (10 external pubs)
- `Criminology and Public Policy` ⭐ NEW (1 external pub)

**Breakdown**:
- Affiliations: 46
- External Publications: 288

---

### 2. Sociedad Española de Investigación Criminológica
**Status**: ✅ **37 publications** (was 0)

**Updated Patterns**:
- `Sociedad Española de Investigación Criminológica`
- `SEIC`
- `Revista Española De Investigación Criminológica` ⭐ NEW (37 external pubs)

**Breakdown**:
- External Publications: 37

---

### 3. Journal of Historical Criminology
**Status**: ✅ **1 publication** (was 0)

**Updated Patterns**:
- `Journal of Historical Criminology`
- `ASC Historical Criminology`
- `Historical Criminology` ⭐ NEW (1 external pub)

**Breakdown**:
- External Publications: 1

---

### 4. Society of Evidence Based Policing
**Status**: ✅ **1 publication** (was 0)

**Updated Patterns**:
- `Society of Evidence Based Policing`
- `SEBP`
- `Evidence Based Policing` ⭐ NEW (1 affiliation)

**Breakdown**:
- Affiliations: 1

---

## Remaining Zero-Publication Members

These 3 members have no publications in our current archive (1,645 articles):

### 1. Hawai'i Crime Lab
**Patterns Tested**: `Hawaii Crime Lab`, `Hawai'i Crime Lab`, `Hawaii`, `Hawai`
**Result**: No matches in affiliations, external publications, or collections

### 2. South Asian Society of Criminology and Victimology
**Patterns Tested**: `South Asian Society of Criminology`, `South Asian`, `Asian Society`
**Result**: No matches in affiliations, external publications, or collections

### 3. University of Liverpool
**Patterns Tested**: `University of Liverpool`, `Liverpool`
**Result**: No matches in affiliations, external publications, or collections

**Note**: These members may have publications on CrimRxiv.com that haven't been imported yet, or they may not have publications in the archive at all. This is expected as not all consortium members have publications in CrimRxiv.

---

## Top 10 Members by Publication Count

| Rank | Member | Publications |
|------|--------|-------------|
| 1 | Criminology: An Interdisciplinary Journal | 301 |
| 2 | Sociedad Española de Investigación Criminológica | 37 |
| 3 | University of South Carolina | 34 |
| 4 | Georgia State University | 26 |
| 5 | University of Nebraska Omaha | 25 |
| 6 | University of Manchester (Criminology) | 24 |
| 7 | University of Manchester (Open Research) | 24 |
| 8 | Oral History of Criminology Project | 20 |
| 9 | University of Cambridge | 18 |
| 10 | John Jay College | 17 |

---

## Technical Implementation

### Enhanced Search Logic
The `searchByAffiliation()` method now searches across three fields:

1. **authors_json** - Author affiliations (universities, institutions)
2. **external_publications_json** ⭐ NEW - Journal names from version-of-record publications
3. **collections_json** - Collection-based memberships

### Example Query Pattern
```sql
SELECT * FROM metadata
WHERE
  authors_json ILIKE '%University of Cambridge%'
  OR external_publications_json ILIKE '%CRIMINOLOGY%'
  OR collections_json ILIKE '%Historical Criminology%'
```

This multi-field search ensures we capture publications from:
- **Universities**: Author affiliations
- **Journals**: External publication journal names
- **Organizations**: Collection memberships or affiliations

---

## Files Updated

1. **src/components/consortium.js** - Updated member patterns
2. **src/lib/parquet-db-external.js** - Enhanced searchByAffiliation() method
3. **scripts/test-all-consortium-members.js** - Comprehensive test script
4. **scripts/investigate-zero-members.js** - Investigation script for zero-result members
5. **scripts/analyze-journals.js** - Journal name analysis script

---

## Next Steps

1. ✅ **Completed**: Fixed 4 members with pattern updates
2. ✅ **Completed**: Verified 28 of 31 members now show publications
3. ⚠️ **Optional**: Decide whether to hide the 3 zero-publication member pages
4. ⚠️ **Optional**: Full re-import to ensure latest data

---

## Testing

Run the comprehensive test:
```bash
node scripts/test-all-consortium-members.js
```

View specific member pages:
- http://localhost:3005/#/member/criminology-journal (301 pubs)
- http://localhost:3005/#/member/sociedad-espanola (37 pubs)
- http://localhost:3005/#/member/journal-historical-criminology (1 pub)
- http://localhost:3005/#/member/society-evidence-based-policing (1 pub)
