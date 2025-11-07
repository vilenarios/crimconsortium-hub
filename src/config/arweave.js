/**
 * Arweave Configuration
 * Centralizes all external resource URLs for development and production
 *
 * Testing Modes (controlled via URL params):
 * 1. Full Local (default dev):  ?mode=local or npm run dev
 *    - App, Parquet, Articles all from localhost
 * 2. Hybrid Testing:  ?mode=hybrid or npm run preview
 *    - App from localhost, Parquet+Articles from Arweave
 * 3. Full Production: Deployed on Arweave
 *    - App, Parquet, Articles all from Arweave
 */

// Detect development vs production environment
const isDev = window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1';

// Check if we should use remote data (hybrid mode)
// Can be forced via URL param: ?mode=hybrid or ?remote=true
const urlParams = new URLSearchParams(window.location.search);
const useRemoteData = urlParams.get('mode') === 'hybrid' ||
                      urlParams.get('remote') === 'true' ||
                      window.location.port === '4174'; // Preview server defaults to hybrid

// NOTE: WASM files CANNOT be loaded cross-origin in Web Workers due to CORS
// So even in hybrid mode on localhost, we must use local WASM files
const useRemoteWasm = !isDev; // Only use remote WASM when actually deployed on Arweave

/**
 * Get the base gateway domain from current hostname
 * Examples:
 *   crimrxiv-demo.arweave.net → arweave.net
 *   crimrxiv-demo.ar.io → ar.io
 *   crimrxiv-demo.permagate.io → permagate.io
 */
function getGatewayDomain() {
  if (isDev) {
    const port = window.location.port || '3005';
    return `localhost:${port}`;
  }

  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // If it's a subdomain format (xxx.gateway.tld or xxx.tld), extract gateway
  if (parts.length >= 2) {
    // Take last 2 parts (gateway.tld) or last 1 part if it's just a TLD
    return parts.slice(-2).join('.');
  }

  return hostname;
}

/**
 * Get protocol (http for localhost, https for production)
 */
function getProtocol() {
  return isDev ? 'http' : 'https';
}

/**
 * ArNS Configuration
 * These values match your .env file:
 * - ARNS_ROOT_NAME=crimrxiv-demo
 * - ARNS_DATA_UNDERNAME=data
 * - ARNS_WASM_NAME=duck-db-wasm
 */
const ARNS_CONFIG = {
  rootName: 'crimrxiv-demo',
  dataUndername: 'data',
  wasmName: 'duck-db-wasm',
};

/**
 * Get Parquet data URL using ArNS undername
 * The ArNS undername points directly to the parquet file (no path needed)
 * Pattern: {dataUndername}_{rootName}.{gateway}
 * Examples:
 *   - App on crimrxiv-demo.ar.io → Data from data_crimrxiv-demo.ar.io
 *   - App on crimrxiv-demo.arweave.net → Data from data_crimrxiv-demo.arweave.net
 *   - App on crimrxiv-demo.permagate.io → Data from data_crimrxiv-demo.permagate.io
 *   - App on localhost (hybrid mode) → Data from data_crimrxiv-demo.arweave.net
 */
function getParquetDataUrl() {
  // On localhost in hybrid mode, use arweave.net gateway
  const gateway = isDev ? 'arweave.net' : getGatewayDomain();
  const protocol = isDev ? 'https' : getProtocol();

  // ArNS undername points directly to the parquet file
  return `${protocol}://${ARNS_CONFIG.dataUndername}_${ARNS_CONFIG.rootName}.${gateway}`;
}

/**
 * Get DuckDB-WASM URLs using ArNS name
 * Pattern: {wasmName}.{gateway}
 * Examples:
 *   - App on crimrxiv-demo.ar.io → WASM from duck-db-wasm.ar.io
 *   - App on crimrxiv-demo.arweave.net → WASM from duck-db-wasm.arweave.net
 *   - App on crimrxiv-demo.permagate.io → WASM from duck-db-wasm.permagate.io
 *
 * NOTE: In production only! Localhost always uses local WASM (CORS restriction)
 */
function getDuckDBWasmUrls() {
  const protocol = getProtocol();
  const gateway = getGatewayDomain();
  const wasmBase = `${protocol}://${ARNS_CONFIG.wasmName}.${gateway}`;

  return {
    mvpModule: `${wasmBase}/duckdb-mvp.wasm`,
    mvpWorker: `${wasmBase}/duckdb-browser-mvp.worker.js`,
    ehModule: `${wasmBase}/duckdb-eh.wasm`,
    ehWorker: `${wasmBase}/duckdb-browser-eh.worker.js`,
  };
}

/**
 * Production Configuration
 * Dynamically constructs URLs based on current gateway
 * Works across all 600+ ar.io gateways automatically
 * All resources use ArNS undernames (no raw transaction IDs)
 */
const PRODUCTION_CONFIG = {
  // Parquet metadata file (via ArNS undername on current gateway)
  parquet: getParquetDataUrl(),

  // DuckDB-WASM bundles (via ArNS name on current gateway)
  // See public/duckdb/HOW-TO.md for details
  wasm: getDuckDBWasmUrls(),

  // Base URL for article manifests (current gateway)
  manifestBase: `${getProtocol()}://${getGatewayDomain()}`,

  // Gateway URL
  gateway: `${getProtocol()}://${getGatewayDomain()}`,

  // Mode flag (always use remote articles in production)
  useRemoteArticles: true,
};

/**
 * Get current local server port dynamically
 * Supports both Vite dev server (3005) and preview server (4174)
 */
function getLocalPort() {
  return window.location.port || '3005';
}

/**
 * Development Configuration
 * Uses local files served by Vite dev server or custom preview server
 * Dynamically detects the current port (3005 for dev, 4174 for preview)
 *
 * Supports two sub-modes:
 * - Full Local (port 3005): All resources from localhost
 * - Hybrid (port 4174): Parquet + Articles from Arweave, WASM + App from localhost
 *
 * IMPORTANT: WASM files MUST be local on localhost due to CORS restrictions
 * with Web Workers. Only parquet and articles can be loaded remotely.
 */
const DEV_CONFIG = {
  // Parquet metadata file (local or remote based on mode)
  parquet: useRemoteData
    ? getParquetDataUrl()
    : `http://localhost:${getLocalPort()}/data/metadata.parquet`,

  // DuckDB-WASM bundles (ALWAYS local on localhost - CORS requirement)
  wasm: {
    mvpModule: `http://localhost:${getLocalPort()}/duckdb/duckdb-mvp.wasm`,
    mvpWorker: `http://localhost:${getLocalPort()}/duckdb/duckdb-browser-mvp.worker.js`,
    ehModule: `http://localhost:${getLocalPort()}/duckdb/duckdb-eh.wasm`,
    ehWorker: `http://localhost:${getLocalPort()}/duckdb/duckdb-browser-eh.worker.js`,
  },

  // Base URL for article content
  // In full local mode: /data/articles/{slug}/
  // In hybrid mode: Arweave manifest URLs
  articlesBase: `http://localhost:${getLocalPort()}/data/articles`,

  // Base URL for article manifests (not used in full local mode)
  manifestBase: `http://localhost:${getLocalPort()}/manifests`,

  // Local gateway
  gateway: `http://localhost:${getLocalPort()}`,

  // Mode flag
  useRemoteArticles: useRemoteData,
};

/**
 * Active Configuration
 * Automatically selects dev or production based on hostname
 */
export const ARWEAVE_CONFIG = isDev ? DEV_CONFIG : PRODUCTION_CONFIG;

/**
 * Helper function to get full manifest URL for an article
 * @param {string} manifestTxId - Transaction ID of the article manifest
 * @returns {string} Full URL to manifest JSON
 */
export function getManifestUrl(manifestTxId) {
  if (!manifestTxId) {
    throw new Error('Manifest TX ID is required');
  }

  // In hybrid mode or production, load from Arweave
  if (useRemoteData || !isDev) {
    const protocol = isDev ? 'https' : getProtocol();
    const gateway = isDev ? 'arweave.net' : getGatewayDomain();

    // SPECIAL CASE: ar.io gateway cannot resolve transaction IDs, only ArNS names
    // Use arweave.net for manifests when viewing from ar.io
    if (gateway === 'ar.io') {
      return `${protocol}://arweave.net/raw/${manifestTxId}`;
    }

    // For all other gateways, use the current gateway
    // Use /raw/ prefix to get manifest JSON instead of index content
    return `${protocol}://${gateway}/raw/${manifestTxId}`;
  }

  // In full local mode only, use local manifests folder
  return `${ARWEAVE_CONFIG.manifestBase}/${manifestTxId}.json`;
}

/**
 * Helper function to get attachment URL from manifest
 * @param {string} manifestTxId - Transaction ID of the article manifest
 * @param {string} path - Path within manifest (e.g., "article.md" or "pdfs/file.pdf")
 * @returns {string} Full URL to attachment
 */
export function getAttachmentUrl(manifestTxId, path) {
  if (!manifestTxId || !path) {
    throw new Error('Both manifestTxId and path are required');
  }

  // In hybrid mode or production, load from Arweave
  if (useRemoteData || !isDev) {
    const protocol = isDev ? 'https' : getProtocol();
    const gateway = isDev ? 'arweave.net' : getGatewayDomain();

    // SPECIAL CASE: ar.io gateway cannot resolve transaction IDs
    // Use arweave.net for attachments when viewing from ar.io
    if (gateway === 'ar.io') {
      return `${protocol}://arweave.net/${manifestTxId}/${path}`;
    }

    // For all other gateways, use the current gateway
    return `${protocol}://${gateway}/${manifestTxId}/${path}`;
  }

  // In full local mode only, use local manifest structure
  return `${ARWEAVE_CONFIG.manifestBase}/${manifestTxId}/${path}`;
}

/**
 * Helper function to check if we're in development mode
 * @returns {boolean}
 */
export function isDevelopment() {
  return isDev;
}

/**
 * Get local article content URL (by slug, for full local testing)
 * @param {string} slug - Article slug
 * @param {string} filename - File within article directory (e.g., "content.json", "article.md")
 * @returns {string} Full URL to local article file
 */
export function getLocalArticleUrl(slug, filename) {
  if (!slug || !filename) {
    throw new Error('Both slug and filename are required');
  }

  return `${ARWEAVE_CONFIG.articlesBase}/${slug}/${filename}`;
}

/**
 * Check if we're using remote data sources
 * @returns {boolean}
 */
export function isUsingRemoteData() {
  return !isDev || useRemoteData;
}

/**
 * Get current testing mode
 * @returns {string} 'local' | 'hybrid' | 'production'
 */
export function getTestingMode() {
  if (!isDev) return 'production';
  return useRemoteData ? 'hybrid' : 'local';
}

/**
 * Get environment info for debugging
 * @returns {object} Environment configuration details
 */
export function getEnvironmentInfo() {
  return {
    environment: isDev ? 'development' : 'production',
    testingMode: getTestingMode(),
    useRemoteData: isUsingRemoteData(),
    hostname: window.location.hostname,
    port: window.location.port,
    gateway: isDev ? 'localhost' : getGatewayDomain(),
    protocol: getProtocol(),
    config: ARWEAVE_CONFIG,
  };
}

/**
 * Get the current gateway domain (exported for debugging)
 * @returns {string} Gateway domain
 */
export function getCurrentGateway() {
  return getGatewayDomain();
}

/**
 * Log configuration on initialization
 */
console.log('🌐 Arweave Config Initialized:', {
  environment: isDev ? 'development' : 'production',
  hostname: window.location.hostname,
  gateway: isDev ? 'localhost' : getGatewayDomain(),
  arnsConfig: isDev ? 'N/A (using localhost)' : ARNS_CONFIG,
  parquetUrl: ARWEAVE_CONFIG.parquet,
  wasmUrls: ARWEAVE_CONFIG.wasm,
});

/**
 * Export ArNS configuration for external use
 */
export const ARNS_NAMES = ARNS_CONFIG;
