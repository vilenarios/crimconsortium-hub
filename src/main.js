/**
 * CrimRXiv Archive - Main Entry Point
 *
 * Vite-based SPA for browsing 3,721+ criminology publications
 * Uses DuckDB-WASM to query Parquet files client-side
 */

import './styles/main.css';
import { CrimRXivApp } from './app.js';

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Starting CrimRXiv Archive...');

  const app = new CrimRXivApp();
  await app.initialize();

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    app.cleanup();
  });
});
