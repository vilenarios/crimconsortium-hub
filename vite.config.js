import { defineConfig } from 'vite';
import fs from 'fs-extra';
import path from 'path';

// Plugin to exclude external resources from production build
// (They're loaded from external ArNS sources)
// Only excludes when EXCLUDE_EXTERNAL=true (for actual Arweave deployment)
const excludeExternalResources = () => ({
  name: 'exclude-external-resources',
  closeBundle() {
    // Only exclude if explicitly requested (for Arweave deployment)
    // Keep files for local preview testing
    if (process.env.EXCLUDE_EXTERNAL !== 'true') {
      console.log('ℹ️  Keeping bundled files for local preview (set EXCLUDE_EXTERNAL=true to exclude)');
      return;
    }

    // Remove DuckDB WASM (loaded from duck-db-wasm gateway)
    const duckdbDir = path.resolve('dist/duckdb');
    if (fs.existsSync(duckdbDir)) {
      console.log('🗑️  Removing bundled DuckDB WASM files (loaded from ArNS)...');
      fs.removeSync(duckdbDir);
      console.log('✅ DuckDB WASM excluded from build');
    }

    // Remove data folder (parquet loaded from data ArNS)
    const dataDir = path.resolve('dist/data');
    if (fs.existsSync(dataDir)) {
      console.log('🗑️  Removing bundled data folder (loaded from ArNS)...');
      fs.removeSync(dataDir);
      console.log('✅ Data folder excluded from build');
    }
  }
});

export default defineConfig({
  // Base path for deployment
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // Don't inline large assets
    assetsInlineLimit: 4096,

    // No source maps for production
    sourcemap: false,

    rollupOptions: {
      output: {
        // Simple chunking - no DuckDB bundling needed
        manualChunks: {
          'vendor': ['prosemirror-view', 'prosemirror-state', 'prosemirror-model']
        },
      },
    },
  },

  plugins: [
    excludeExternalResources()
  ],

  server: {
    port: 3005,
    strictPort: false,
    open: false,
    host: 'localhost',
  },

  preview: {
    port: 4174,
  },

  // Optimize dependencies - exclude DuckDB from bundling
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
});
