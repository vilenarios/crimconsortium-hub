/**
 * Gateway Detection and URL Construction Utilities
 *
 * Provides dynamic gateway detection for Arweave apps to work on any gateway
 * without hardcoding URLs. Handles localhost development with arweave.net fallback.
 */

/**
 * Get the current gateway hostname
 * @returns {string} Current gateway (e.g., 'crimrxiv.arweave.net', 'permagate.io', or 'arweave.net' for localhost)
 */
export function getCurrentGateway() {
  if (typeof window === 'undefined') {
    // Server-side rendering or non-browser environment
    return 'arweave.net';
  }

  const hostname = window.location.hostname;

  // Localhost development - use arweave.net
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    return 'arweave.net';
  }

  return hostname;
}

/**
 * Get the protocol to use (https for production, http for localhost)
 * @returns {string} 'https' or 'http'
 */
export function getProtocol() {
  if (typeof window === 'undefined') {
    return 'https';
  }

  const hostname = window.location.hostname;

  // Use http for localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
    return window.location.protocol.replace(':', '') || 'http';
  }

  return 'https';
}

/**
 * Construct URL for ArNS undername (for data files like parquet)
 * Example: data_crimrxiv.arweave.net
 *
 * @param {string} undername - Undername prefix (e.g., 'data')
 * @param {string} path - Path to resource (e.g., '/articles.parquet')
 * @returns {string} Full URL to undername resource
 */
export function getUndernameUrl(undername, path = '/') {
  const gateway = getCurrentGateway();
  const protocol = getProtocol();

  // For localhost, we can't use undernames, so use the main gateway with a different path
  // This won't work in production but is fine for development without actual deployment
  if (gateway === 'arweave.net') {
    // In production on arweave.net, use the proper undername
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
      // Development mode - would need actual TX ID or mock data
      console.warn(`Development mode: undername ${undername} not available on localhost`);
      return `${protocol}://${gateway}/${undername}${path}`;
    }
  }

  // Production: use ArNS undername pattern
  // Example: data_crimrxiv.arweave.net
  const undernameHost = `${undername}_${gateway}`;

  return `${protocol}://${undernameHost}${path}`;
}

/**
 * Construct URL for a manifest resource using TX ID
 * Works on any gateway since TX IDs are universal
 *
 * @param {string} manifestTxId - Arweave transaction ID of the manifest
 * @param {string} path - Path within manifest (e.g., '/metadata.json', '/content.json')
 * @returns {string} Full URL to manifest resource
 */
export function getManifestUrl(manifestTxId, path = '/') {
  const gateway = getCurrentGateway();
  const protocol = getProtocol();

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${protocol}://${gateway}/${manifestTxId}${normalizedPath}`;
}

/**
 * Construct URL for the data parquet file
 * Uses the data_ undername convention
 *
 * @param {string} filename - Parquet filename (default: 'articles.parquet')
 * @returns {string} Full URL to parquet file
 */
export function getDataParquetUrl(filename = 'articles.parquet') {
  return getUndernameUrl('data', `/${filename}`);
}

/**
 * Get current app info for debugging
 * @returns {object} App location info
 */
export function getAppInfo() {
  if (typeof window === 'undefined') {
    return {
      gateway: 'arweave.net',
      protocol: 'https',
      isLocalhost: false,
      hostname: 'server-side',
    };
  }

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

  return {
    gateway: getCurrentGateway(),
    protocol: getProtocol(),
    isLocalhost,
    hostname,
  };
}

/**
 * Example usage:
 *
 * // Get parquet data file
 * const parquetUrl = getDataParquetUrl('articles.parquet');
 * // => https://data_crimrxiv.arweave.net/articles.parquet
 *
 * // Get article metadata
 * const metadataUrl = getManifestUrl('ABC123...XYZ', 'metadata.json');
 * // => https://crimrxiv.arweave.net/ABC123...XYZ/metadata.json
 *
 * // Get article content
 * const contentUrl = getManifestUrl('ABC123...XYZ', 'content.json');
 * // => https://crimrxiv.arweave.net/ABC123...XYZ/content.json
 */
