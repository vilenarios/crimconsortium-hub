import { defineConfig } from 'vite';

export default defineConfig({
  // Base path for deployment (can be overridden for Arweave)
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // Inline small assets as base64 for Arweave compatibility
    assetsInlineLimit: 4096,

    // Generate source maps for debugging
    sourcemap: false,

    rollupOptions: {
      output: {
        // Use manual chunks to optimize loading
        manualChunks: {
          'duckdb': ['@duckdb/duckdb-wasm'],
        },
      },
    },
  },

  server: {
    port: 3005, // Use 3005 to avoid conflicts with other apps on 3000
    strictPort: false, // Auto-increment if 3005 is taken too
    open: false, // Don't auto-open browser (avoid conflicts with other apps)
    host: 'localhost', // Bind to localhost specifically
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },

  preview: {
    port: 4173,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['@duckdb/duckdb-wasm'],
    exclude: ['@duckdb/duckdb-wasm'],
  },

  // Handle .wasm files
  assetsInclude: ['**/*.wasm', '**/*.worker.js'],

  // Plugin to handle WASM MIME types
  plugins: [
    {
      name: 'configure-response-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          }
          next();
        });
      },
    },
  ],
});
