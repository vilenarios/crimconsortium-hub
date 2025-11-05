# Using DuckDB-WASM from Arweave

**Version:** DuckDB-WASM 1.30.0
**ArNS Name:** `duck-db-wasm`
**Last Updated:** 2025-11-04

---

## What is This?

These are **DuckDB-WASM files permanently hosted on Arweave**, accessible via ArNS (Arweave Name System). You can use them in your web applications instead of loading from npm CDN or bundling them locally.

### Why Use Arweave-Hosted WASM?

- ✅ **Permanent** - Files are stored permanently on Arweave (pay once, available forever)
- ✅ **Decentralized** - Not dependent on a single CDN or server
- ✅ **No npm required** - Load directly from Arweave in your HTML
- ✅ **Version locked** - This specific version (1.30.0) will always be available at this URL
- ✅ **Fast** - Served through Arweave gateways globally
- ✅ **Censorship-resistant** - Cannot be taken down or blocked

---

## Quick Start

### ArNS URLs

Access these WASM files using ArNS:

```
Primary: https://duck-db-wasm.ar.io/
Alternative: https://duck-db-wasm.arweave.net/
```

**Gateway flexibility:**
Any AR.IO gateway works! Replace the domain:
```
https://duck-db-wasm.permagate.io/
https://duck-db-wasm.{any-gateway}.com/
```
Or if you are using a permaweb app, just dynamically load your duck-db-wasm from the current gateway that the user is using your app from.

### Available Files

```
https://duck-db-wasm.ar.io/duckdb-mvp.wasm
https://duck-db-wasm.ar.io/duckdb-eh.wasm
https://duck-db-wasm.ar.io/duckdb-browser-mvp.worker.js
https://duck-db-wasm.ar.io/duckdb-browser-eh.worker.js
https://duck-db-wasm.ar.io/HOW-TO.md (this file)
```

---

## Usage in Your App

### Method 1: Manual Bundle Configuration (Recommended)

Configure DuckDB-WASM to load from Arweave:

```javascript
import * as duckdb from '@duckdb/duckdb-wasm';

// Configure manual bundles pointing to Arweave
const ARWEAVE_BUNDLES = {
    mvp: {
        mainModule: 'https://duck-db-wasm.ar.io/duckdb-mvp.wasm',
        mainWorker: 'https://duck-db-wasm.ar.io/duckdb-browser-mvp.worker.js',
    },
    eh: {
        mainModule: 'https://duck-db-wasm.ar.io/duckdb-eh.wasm',
        mainWorker: 'https://duck-db-wasm.ar.io/duckdb-browser-eh.worker.js',
    }
};

// Select bundle based on browser support
const bundle = await duckdb.selectBundle(ARWEAVE_BUNDLES);

// Create worker from Arweave-hosted file
const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`],
    { type: 'text/javascript' })
);
const worker = new Worker(worker_url);

// Initialize database
const logger = new duckdb.ConsoleLogger();
const db = new duckdb.AsyncDuckDB(logger, worker);
await db.instantiate(bundle.mainModule);

// Connect and use
const conn = await db.connect();
```

### Method 2: Direct Worker Loading

For simpler setup:

```javascript
import * as duckdb from '@duckdb/duckdb-wasm';

// Create worker directly from Arweave
const worker = new Worker('https://duck-db-wasm.ar.io/duckdb-browser-mvp.worker.js');

// Initialize with Arweave WASM module
const logger = new duckdb.ConsoleLogger();
const db = new duckdb.AsyncDuckDB(logger, worker);
await db.instantiate('https://duck-db-wasm.ar.io/duckdb-mvp.wasm');

const conn = await db.connect();

// Query!
const result = await conn.query('SELECT 42 as answer');
console.log(result);
```

### Method 3: No npm - Pure HTML

Load DuckDB-WASM directly from Arweave without any build tools:

```html
<!DOCTYPE html>
<html>
<head>
    <title>DuckDB from Arweave</title>
</head>
<body>
    <h1>DuckDB-WASM from Arweave</h1>
    <button onclick="runQuery()">Run Query</button>
    <pre id="output"></pre>

    <script type="module">
        // Load DuckDB from npm CDN (only the JS, not WASM)
        import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.30.0/+esm';

        let db, conn;

        async function init() {
            // Use Arweave-hosted WASM files
            const ARWEAVE_BUNDLES = {
                mvp: {
                    mainModule: 'https://duck-db-wasm.ar.io/duckdb-mvp.wasm',
                    mainWorker: 'https://duck-db-wasm.ar.io/duckdb-browser-mvp.worker.js',
                },
                eh: {
                    mainModule: 'https://duck-db-wasm.ar.io/duckdb-eh.wasm',
                    mainWorker: 'https://duck-db-wasm.ar.io/duckdb-browser-eh.worker.js',
                }
            };

            const bundle = await duckdb.selectBundle(ARWEAVE_BUNDLES);

            // Create worker from Arweave
            const worker_url = URL.createObjectURL(
                new Blob([`importScripts("${bundle.mainWorker}");`],
                { type: 'text/javascript' })
            );
            const worker = new Worker(worker_url);

            const logger = new duckdb.ConsoleLogger();
            db = new duckdb.AsyncDuckDB(logger, worker);
            await db.instantiate(bundle.mainModule);

            conn = await db.connect();
            console.log('✅ DuckDB ready with Arweave-hosted WASM!');
        }

        async function runQuery() {
            const result = await conn.query(`
                SELECT 'Hello from Arweave!' as message
            `);

            const data = result.toArray().map(row => row.toJSON());
            document.getElementById('output').textContent = JSON.stringify(data, null, 2);
        }

        init();
        window.runQuery = runQuery;
    </script>
</body>
</html>
```

---

## Configuration Options

### Using Different Gateways

You can use any AR.IO gateway:

```javascript
// Primary
const BASE_URL = 'https://duck-db-wasm.ar.io';

// Alternative gateways
const BASE_URL = 'https://duck-db-wasm.arweave.net';
const BASE_URL = 'https://duck-db-wasm.permagate.io';

const BUNDLES = {
    mvp: {
        mainModule: `${BASE_URL}/duckdb-mvp.wasm`,
        mainWorker: `${BASE_URL}/duckdb-browser-mvp.worker.js`,
    },
    eh: {
        mainModule: `${BASE_URL}/duckdb-eh.wasm`,
        mainWorker: `${BASE_URL}/duckdb-browser-eh.worker.js`,
    }
};
```

### Environment Variables

Store the base URL in your config:

```javascript
// .env
VITE_DUCKDB_BASE_URL=https://duck-db-wasm.ar.io

// config.js
export const DUCKDB_BASE_URL = import.meta.env.VITE_DUCKDB_BASE_URL || 'https://duck-db-wasm.ar.io';

export const DUCKDB_BUNDLES = {
    mvp: {
        mainModule: `${DUCKDB_BASE_URL}/duckdb-mvp.wasm`,
        mainWorker: `${DUCKDB_BASE_URL}/duckdb-browser-mvp.worker.js`,
    },
    eh: {
        mainModule: `${DUCKDB_BASE_URL}/duckdb-eh.wasm`,
        mainWorker: `${DUCKDB_BASE_URL}/duckdb-browser-eh.worker.js`,
    }
};
```

---

## Complete Example App

```html
<!DOCTYPE html>
<html>
<head>
    <title>DuckDB-WASM from Arweave Example</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        button { padding: 10px 20px; margin: 10px 0; cursor: pointer; font-size: 16px; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .success { color: green; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>🦆 DuckDB-WASM from Arweave</h1>
    <p>This demo loads DuckDB-WASM files from Arweave's permanent storage.</p>

    <div id="status">⏳ Initializing...</div>

    <button onclick="testQuery()">Run Test Query</button>
    <button onclick="loadCSV()">Load CSV from URL</button>
    <button onclick="analytics()">Run Analytics</button>

    <h3>Output:</h3>
    <pre id="output">Waiting for query...</pre>

    <script type="module">
        import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.30.0/+esm';

        let db, conn;

        async function init() {
            try {
                const BASE_URL = 'https://duck-db-wasm.ar.io';

                const BUNDLES = {
                    mvp: {
                        mainModule: `${BASE_URL}/duckdb-mvp.wasm`,
                        mainWorker: `${BASE_URL}/duckdb-browser-mvp.worker.js`,
                    },
                    eh: {
                        mainModule: `${BASE_URL}/duckdb-eh.wasm`,
                        mainWorker: `${BASE_URL}/duckdb-browser-eh.worker.js`,
                    }
                };

                const bundle = await duckdb.selectBundle(BUNDLES);

                const worker_url = URL.createObjectURL(
                    new Blob([`importScripts("${bundle.mainWorker}");`],
                    { type: 'text/javascript' })
                );
                const worker = new Worker(worker_url);

                const logger = new duckdb.ConsoleLogger();
                db = new duckdb.AsyncDuckDB(logger, worker);
                await db.instantiate(bundle.mainModule);

                conn = await db.connect();

                document.getElementById('status').innerHTML =
                    '<span class="success">✅ DuckDB ready! Using Arweave-hosted WASM files.</span>';
            } catch (err) {
                document.getElementById('status').innerHTML =
                    `<span class="error">❌ Error: ${err.message}</span>`;
            }
        }

        async function testQuery() {
            try {
                const result = await conn.query(`
                    SELECT
                        'DuckDB-WASM' as source,
                        'Arweave' as hosted_on,
                        '1.30.0' as version,
                        'Permanent!' as storage
                `);

                const data = result.toArray().map(row => row.toJSON());
                document.getElementById('output').textContent =
                    JSON.stringify(data, null, 2);
            } catch (err) {
                document.getElementById('output').textContent =
                    `Error: ${err.message}`;
            }
        }

        async function loadCSV() {
            try {
                await conn.query(`
                    CREATE OR REPLACE TABLE demo AS
                    SELECT * FROM read_csv_auto(
                        'https://raw.githubusercontent.com/datasets/covid-19/master/data/countries-aggregated.csv'
                    )
                `);

                const result = await conn.query(`
                    SELECT
                        Country,
                        SUM(Confirmed) as total_cases
                    FROM demo
                    GROUP BY Country
                    ORDER BY total_cases DESC
                    LIMIT 10
                `);

                const data = result.toArray().map(row => row.toJSON());
                document.getElementById('output').textContent =
                    'Top 10 Countries by COVID Cases:\n\n' +
                    JSON.stringify(data, null, 2);
            } catch (err) {
                document.getElementById('output').textContent =
                    `Error: ${err.message}`;
            }
        }

        async function analytics() {
            try {
                await conn.query(`
                    CREATE OR REPLACE TABLE sales AS
                    SELECT * FROM (VALUES
                        ('2024-01-15', 'Laptop', 1200.00, 'Electronics'),
                        ('2024-01-16', 'Mouse', 25.00, 'Electronics'),
                        ('2024-01-17', 'Desk', 450.00, 'Furniture'),
                        ('2024-01-18', 'Chair', 300.00, 'Furniture'),
                        ('2024-01-19', 'Monitor', 400.00, 'Electronics')
                    ) AS t(date, product, amount, category)
                `);

                const result = await conn.query(`
                    SELECT
                        category,
                        COUNT(*) as product_count,
                        SUM(amount) as total_sales,
                        AVG(amount) as avg_price
                    FROM sales
                    GROUP BY category
                    ORDER BY total_sales DESC
                `);

                const data = result.toArray().map(row => row.toJSON());
                document.getElementById('output').textContent =
                    'Sales by Category:\n\n' +
                    JSON.stringify(data, null, 2);
            } catch (err) {
                document.getElementById('output').textContent =
                    `Error: ${err.message}`;
            }
        }

        init();
        window.testQuery = testQuery;
        window.loadCSV = loadCSV;
        window.analytics = analytics;
    </script>
</body>
</html>
```

---

## Benefits of Arweave Hosting

### For Developers

1. **Permanent URLs** - These files will be available at this ArNS name forever
2. **No npm dependency** - Load directly from Arweave
3. **Decentralized** - Not dependent on npm, jsdelivr, or any CDN
4. **Version locked** - This specific DuckDB version (1.30.0) won't change
5. **Fast loading** - Served through global Arweave gateway network

### For Users

1. **Privacy** - No tracking from npm CDN
2. **Reliability** - Cannot be taken down or blocked
3. **Speed** - Cached by Arweave gateways globally
4. **Censorship-resistant** - Always accessible

---

## Browser Compatibility

Works in all modern browsers:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

Requirements:
- WebAssembly support
- Web Workers
- SharedArrayBuffer (for optimal performance)

---

## Troubleshooting

### CORS Issues

Arweave gateways serve files with proper CORS headers. If you experience issues:

```javascript
// Try a different gateway
const BASE_URL = 'https://duck-db-wasm.arweave.net';
```

### Loading Errors

```javascript
// Add error handling
try {
    await db.instantiate(bundle.mainModule);
} catch (err) {
    console.error('Failed to load WASM from Arweave:', err);
    // Fallback to npm CDN if needed
}
```

### Slow Initial Load

First load may take a few seconds. The WASM files are ~14MB total. They will be cached by the browser after first load.

### Gateway Down

If one gateway is slow or down, try another:

```javascript
const GATEWAYS = [
    'https://duck-db-wasm.ar.io',
    'https://duck-db-wasm.permagate.io',
    'https://duck-db-wasm.vilenarios.com',
];

// Try gateways in order
for (const gateway of GATEWAYS) {
    try {
        const response = await fetch(`${gateway}/duckdb-mvp.wasm`, { method: 'HEAD' });
        if (response.ok) {
            BASE_URL = gateway;
            break;
        }
    } catch (err) {
        continue;
    }
}
```

Alternatively, leverage the AR.IO Wayfinder Protocol for decentralized routing and verification
**Wayfinder**: https://docs.ar.io/learn/wayfinder
---

## ArNS vs Direct TX ID

You can access these files in two ways:

**1. ArNS (Recommended):**
```
https://duck-db-wasm.ar.io/duckdb-mvp.wasm
```
- Human-readable
- Can be updated to point to newer versions
- Gateway-agnostic

**2. Direct Arweave TX ID:**
```
https://arweave.net/{tx-id}/duckdb-mvp.wasm
```
- Immutable (always points to exact same files)
- No DNS required
- Faster resolution

Both work! ArNS is easier for developers, TX ID is more immutable.

---

## Version Information

- **DuckDB-WASM Version:** 1.30.0
- **Upload Date:** 2025-11-04
- **ArNS Name:** `duck-db-wasm`
- **File Size:** ~14 MB total
- **Files Included:** 4 WASM/JS files + this guide

---

## Resources

- **DuckDB Docs:** https://duckdb.org/docs/
- **DuckDB-WASM GitHub:** https://github.com/duckdb/duckdb-wasm
- **Arweave:** https://arweave.com
- **AR.IO Network:** https://ar.io
- **ArNS Docs:** https://docs.ar.io/learn/arns

---

## License

DuckDB-WASM: MIT License
Files hosted on Arweave: Permanent and immutable

---

**Happy Querying from the Permaweb!** 🦆🌐
