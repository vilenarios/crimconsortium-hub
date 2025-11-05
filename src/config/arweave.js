/**
 * Arweave Configuration
 * Centralizes all external resource URLs for development and production
 *
 * Development: Uses local files from localhost
 * Production: Dynamically uses current gateway (works across all 600+ ar.io gateways)
 */

// Detect development vs production environment
const isDev = window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1';

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
 */
function getParquetDataUrl() {
  const protocol = getProtocol();
  const gateway = getGatewayDomain();

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
 */
const DEV_CONFIG = {
  // Parquet metadata file (local)
  parquet: `http://localhost:${getLocalPort()}/data/metadata.parquet`,

  // DuckDB-WASM bundles (local)
  wasm: {
    mvpModule: `http://localhost:${getLocalPort()}/duckdb/duckdb-mvp.wasm`,
    mvpWorker: `http://localhost:${getLocalPort()}/duckdb/duckdb-browser-mvp.worker.js`,
    ehModule: `http://localhost:${getLocalPort()}/duckdb/duckdb-eh.wasm`,
    ehWorker: `http://localhost:${getLocalPort()}/duckdb/duckdb-browser-eh.worker.js`,
  },

  // Base URL for article manifests (local)
  manifestBase: `http://localhost:${getLocalPort()}/manifests`,

  // Local gateway (not used in dev)
  gateway: `http://localhost:${getLocalPort()}`,
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

  if (isDev) {
    // In development, manifests are in local /manifests folder
    return `${ARWEAVE_CONFIG.manifestBase}/${manifestTxId}.json`;
  } else {
    const protocol = getProtocol();
    const gateway = getGatewayDomain();

    // SPECIAL CASE: ar.io gateway cannot resolve transaction IDs, only ArNS names
    // Use arweave.net for manifests when viewing from ar.io
    if (gateway === 'ar.io') {
      return `${protocol}://arweave.net/raw/${manifestTxId}`;
    }

    // For all other gateways, use the current gateway
    // Use /raw/ prefix to get manifest JSON instead of index content
    return `${protocol}://${gateway}/raw/${manifestTxId}`;
  }
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

  if (isDev) {
    // In development, use local manifest structure
    return `${ARWEAVE_CONFIG.manifestBase}/${manifestTxId}/${path}`;
  } else {
    const protocol = getProtocol();
    const gateway = getGatewayDomain();

    // SPECIAL CASE: ar.io gateway cannot resolve transaction IDs
    // Use arweave.net for attachments when viewing from ar.io
    if (gateway === 'ar.io') {
      return `${protocol}://arweave.net/${manifestTxId}/${path}`;
    }

    // For all other gateways, use the current gateway
    return `${protocol}://${gateway}/${manifestTxId}/${path}`;
  }
}

/**
 * Helper function to check if we're in development mode
 * @returns {boolean}
 */
export function isDevelopment() {
  return isDev;
}

/**
 * Get environment info for debugging
 * @returns {object} Environment configuration details
 */
export function getEnvironmentInfo() {
  return {
    environment: isDev ? 'development' : 'production',
    hostname: window.location.hostname,
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
