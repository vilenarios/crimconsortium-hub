/**
 * Arweave Configuration
 * Centralizes all external resource URLs for development and production
 *
 * Development: Uses local files from localhost
 * Production: Uses ArNS subdomains and transaction IDs on Arweave
 */

// Detect development vs production environment
const isDev = window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1';

/**
 * Production Configuration
 * These URLs are set after uploading resources to Arweave
 *
 * To populate after deployment:
 * 1. Run `npm run upload:parquet` → get TX ID, update PARQUET_TX_ID in .env
 * 2. Run `npm run upload:wasm` → get TX IDs, update WASM_*_TX_ID in .env
 * 3. Configure ArNS undername: data_crimrxiv.arweave.net → PARQUET_TX_ID
 * 4. Rebuild app with production config
 */
const PRODUCTION_CONFIG = {
  // Parquet metadata file (via ArNS undername)
  parquet: 'https://data_crimrxiv.arweave.net/metadata.parquet',

  // DuckDB-WASM bundles (via transaction IDs)
  // Fill these in after running `npm run upload:wasm`
  wasm: {
    mvpModule: 'https://arweave.net/WASM_MVP_TX_ID',
    mvpWorker: 'https://arweave.net/WASM_MVP_WORKER_TX_ID',
    ehModule: 'https://arweave.net/WASM_EH_TX_ID',
    ehWorker: 'https://arweave.net/WASM_EH_WORKER_TX_ID',
  },

  // Base URL for article manifests
  manifestBase: 'https://arweave.net',

  // ArNS gateway
  gateway: 'https://arweave.net',
};

/**
 * Development Configuration
 * Uses local files served by Vite dev server or custom preview server
 */
const DEV_CONFIG = {
  // Parquet metadata file (local)
  parquet: 'http://localhost:4174/data/metadata.parquet',

  // DuckDB-WASM bundles (local)
  wasm: {
    mvpModule: 'http://localhost:4174/duckdb/duckdb-mvp.wasm',
    mvpWorker: 'http://localhost:4174/duckdb/duckdb-browser-mvp.worker.js',
    ehModule: 'http://localhost:4174/duckdb/duckdb-eh.wasm',
    ehWorker: 'http://localhost:4174/duckdb/duckdb-browser-eh.worker.js',
  },

  // Base URL for article manifests (local)
  manifestBase: 'http://localhost:4174/manifests',

  // Local gateway (not used in dev)
  gateway: 'http://localhost:4174',
};

/**
 * Active Configuration
 * Automatically selects dev or production based on hostname
 */
export const ARWEAVE_CONFIG = isDev ? DEV_CONFIG : PRODUCTION_CONFIG;

/**
 * Helper function to get full manifest URL for an article
 * @param {string} manifestTxId - Transaction ID of the article manifest
 * @returns {string} Full URL to manifest
 */
export function getManifestUrl(manifestTxId) {
  if (!manifestTxId) {
    throw new Error('Manifest TX ID is required');
  }

  if (isDev) {
    // In development, manifests are in local /manifests folder
    return `${ARWEAVE_CONFIG.manifestBase}/${manifestTxId}.json`;
  } else {
    // In production, manifests are on Arweave
    return `${ARWEAVE_CONFIG.manifestBase}/${manifestTxId}`;
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
    // In production, use Arweave manifest path syntax
    return `${ARWEAVE_CONFIG.manifestBase}/${manifestTxId}/${path}`;
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
    config: ARWEAVE_CONFIG,
  };
}
