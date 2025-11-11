# CrimRxiv Parquet Schema Design

## Overview

This document defines the Parquet schema for storing all CrimRxiv publication data efficiently.

## Why Parquet?

- **Columnar Storage**: 10-100x faster queries than JSON
- **Compression**: ~70% smaller than JSON (especially for text fields)
- **Type Safety**: Schema enforcement at storage level
- **Ecosystem**: Works with pandas, DuckDB, Apache Arrow, Spark
- **Future-Proof**: Industry standard for data lakes

## Schema Design

### Core Publications Table (`publications.parquet`)

```
publications/
├── id: string (unique identifier)
├── slug: string (URL-friendly identifier)
├── title: string
├── description: string (short description/tagline)
├── doi: string (nullable)
├── created_at: timestamp
├── updated_at: timestamp
├── published_at: timestamp (nullable)
├── abstract: string (full abstract text)
├── content_text: string (full article text from ProseMirror)
├── content_json: string (serialized ProseMirror JSON)
├── license: string (nullable)
├── keywords: list<string> (Parquet native list type)
├── collection_ids: list<string>
├── collection_names: list<string>
├── url: string (canonical URL)
└── pdf_url: string (nullable)
```

### Authors Table (`authors.parquet`)

```
authors/
├── publication_id: string (FK to publications.id)
├── author_index: int32 (order in author list)
├── name: string
├── orcid: string (nullable)
├── affiliation: string (nullable)
├── roles: list<string> (e.g., ["Author", "Corresponding"])
├── user_id: string (nullable, PubPub user ID)
└── is_corresponding: boolean
```

### Collections Table (`collections.parquet`)

```
collections/
├── id: string (unique identifier)
├── slug: string
├── title: string
├── description: string (nullable)
├── created_at: timestamp
├── publication_count: int32
└── is_public: boolean
```

### Publication-Collection Junction (`publication_collections.parquet`)

```
publication_collections/
├── publication_id: string (FK to publications.id)
├── collection_id: string (FK to collections.id)
└── added_at: timestamp (nullable)
```

## Implementation Strategy

### Phase 1: Simple Single-Table Approach (Start Here)

For initial implementation, use a **denormalized single table** with nested structures:

```
crimrxiv_all.parquet
├── Core fields (id, slug, title, etc.)
├── authors: list<struct<name, orcid, affiliation, roles>>
└── collections: list<struct<id, slug, title>>
```

**Advantages**:
- Simpler to implement
- Easier queries (no joins needed)
- Good for small-to-medium datasets (<100k rows)

**Trade-offs**:
- Some data duplication (collection info repeated per publication)
- Slightly larger file size

### Phase 2: Normalized Multi-Table (Future)

When dataset grows or query patterns require it, split into normalized tables.

## File Structure

```
data/parquet/
├── crimrxiv_all.parquet           # Main denormalized table
├── metadata.json                   # Schema version, scrape timestamp
└── _archive/                       # Historical snapshots
    ├── crimrxiv_2025-10-26.parquet
    └── ...
```

## Query Examples (DuckDB)

```sql
-- Get all publications with ORCID authors
SELECT title, authors
FROM read_parquet('data/parquet/crimrxiv_all.parquet')
WHERE list_contains(authors, x -> x.orcid IS NOT NULL);

-- Count publications by collection
SELECT
  unnest(collection_names) as collection,
  count(*) as pub_count
FROM read_parquet('data/parquet/crimrxiv_all.parquet')
GROUP BY collection
ORDER BY pub_count DESC;

-- Full-text search
SELECT title, abstract
FROM read_parquet('data/parquet/crimrxiv_all.parquet')
WHERE abstract ILIKE '%criminology%';
```

## Data Types Reference

| Field Type | Parquet Type | JavaScript Type | Notes |
|------------|--------------|-----------------|-------|
| ID/Slug | string | string | UTF-8 encoded |
| Text | string | string | UTF-8, supports compression |
| Timestamp | timestamp(ms) | Date | Milliseconds since epoch |
| Count | int32 | number | 32-bit signed integer |
| Boolean | boolean | boolean | 1 bit storage |
| Array | list<T> | Array<T> | Native Parquet list type |
| Object | struct | object | Named fields |

## Migration Path from JSON

1. **Read existing JSON**: `data/final/consortium-dataset.json`
2. **Transform to Parquet schema**: Flatten and type-cast
3. **Write Parquet**: Using apache-arrow
4. **Verify**: DuckDB queries to compare counts
5. **Update scripts**: Point to Parquet instead of JSON

## Tools & Libraries

- **Writer**: `apache-arrow` (Node.js)
- **Reader**: `duckdb-node` or `apache-arrow`
- **Analysis**: DuckDB CLI, pandas, polars
- **Viewer**: `parquet-tools`, DuckDB CLI

## Performance Expectations

For ~7,000 CrimRxiv publications:

| Metric | JSON | Parquet | Improvement |
|--------|------|---------|-------------|
| File Size | ~56 MB | ~8-15 MB | 70-85% reduction |
| Load Time | ~200ms | ~20ms | 10x faster |
| Query Time | Full scan | Columnar projection | 50-100x faster |
| Memory Usage | Full object tree | Only needed columns | 80-90% reduction |

## Next Steps

1. Install `apache-arrow` package
2. Create `scripts/pubpub-to-parquet.js` scraper
3. Implement denormalized schema (Phase 1)
4. Test with subset of data
5. Run full scrape (~7,000 publications)
6. Verify with DuckDB queries
