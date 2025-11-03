import { defineConfig } from 'vite';

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

  // Only include parquet for local dev
  assetsInclude: ['**/*.parquet'],
});
