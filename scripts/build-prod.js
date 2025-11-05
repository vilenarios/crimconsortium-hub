#!/usr/bin/env node

/**
 * Production build script
 * Sets EXCLUDE_EXTERNAL=true and runs vite build
 */

import { spawn } from 'child_process';

console.log('🏗️  Building for production (excluding external resources)...\n');

// Set environment variable
process.env.EXCLUDE_EXTERNAL = 'true';

// Run vite build
const build = spawn('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXCLUDE_EXTERNAL: 'true' }
});

build.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Production build complete (external resources excluded)');
    console.log('📦 Ready to upload dist/ folder to Arweave\n');
  } else {
    console.error(`\n❌ Build failed with code ${code}`);
    process.exit(code);
  }
});
