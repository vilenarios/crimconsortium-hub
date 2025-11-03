#!/usr/bin/env node

/**
 * Custom Preview Server with WASM MIME Type Support
 *
 * This server properly serves .wasm files with the correct MIME type
 * and adds required CORS headers for SharedArrayBuffer support.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4174;
const DIST_DIR = path.join(__dirname, '../dist');

// Middleware to set CORS headers (required for SharedArrayBuffer)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// Middleware to set correct MIME types for WASM files
app.use((req, res, next) => {
  if (req.url.endsWith('.wasm')) {
    res.setHeader('Content-Type', 'application/wasm');
  } else if (req.url.endsWith('.worker.js')) {
    res.setHeader('Content-Type', 'application/javascript');
  } else if (req.url.endsWith('.parquet')) {
    res.setHeader('Content-Type', 'application/octet-stream');
  }
  next();
});

// Serve static files from dist directory with proper MIME types
app.use(express.static(DIST_DIR, {
  index: false, // Don't auto-serve index.html
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (filepath.endsWith('.worker.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filepath.endsWith('.parquet')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
  }
}));

// Fallback to index.html ONLY for HTML navigation (not for static assets)
app.get('*', (req, res, next) => {
  // If the request is for a file with an extension, don't serve index.html
  if (path.extname(req.path)) {
    return next();
  }
  // Otherwise, serve index.html for client-side routing
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CrimRXiv Archive Preview Server');
  console.log('='.repeat(60));
  console.log(`\n  ➜  Local:   http://localhost:${PORT}/`);
  console.log(`  ➜  Dist:    ${DIST_DIR}`);
  console.log('\n  ✓ WASM MIME types configured');
  console.log('  ✓ CORS headers enabled');
  console.log('\n  Press Ctrl+C to stop\n');
});
