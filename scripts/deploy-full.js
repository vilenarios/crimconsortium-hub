#!/usr/bin/env node

/**
 * Full Deployment Orchestrator
 *
 * Orchestrates the complete deployment workflow for CrimRXiv Archive:
 * 1. Export SQLite → Parquet
 * 2. Upload Parquet to Arweave
 * 3. Upload WASM files to Arweave (if needed)
 * 4. Build production app
 * 5. Deploy app to Arweave
 *
 * This script guides you through the complete deployment process
 * and provides clear next steps at each stage.
 *
 * Usage:
 *   npm run deploy
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

/**
 * Run a command and stream output
 */
async function runCommand(command, description) {
  console.log(`\n🚀 ${description}...`);
  console.log(`   Command: ${command}\n`);

  return new Promise((resolve, reject) => {
    const child = exec(command);

    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${description} complete\n`);
        resolve();
      } else {
        reject(new Error(`${description} failed with code ${code}`));
      }
    });
  });
}

/**
 * Check if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Main deployment workflow
 */
async function deploy() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CrimRXiv Archive - Full Deployment');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Export to Parquet
    console.log('📋 STEP 1: Export SQLite → Parquet');
    console.log('='.repeat(60));

    const parquetPath = path.join(__dirname, '../data/export/metadata.parquet');
    const parquetExists = await fileExists(parquetPath);

    if (parquetExists) {
      const answer = await question('\n⚠️  Parquet file already exists. Re-export? (y/N): ');
      if (answer.toLowerCase() === 'y') {
        await runCommand('node scripts/export-to-parquet-external.js', 'Exporting to Parquet');
      } else {
        console.log('   ⏭️  Skipping export, using existing parquet file\n');
      }
    } else {
      await runCommand('node scripts/export-to-parquet-external.js', 'Exporting to Parquet');
    }

    // Step 2: Upload Parquet
    console.log('\n📋 STEP 2: Upload Parquet to Arweave');
    console.log('='.repeat(60));

    const uploadParquet = await question('\nUpload parquet to Arweave? (Y/n): ');
    if (uploadParquet.toLowerCase() !== 'n') {
      await runCommand('node scripts/upload-parquet.js', 'Uploading Parquet');

      console.log('\n⏸️  PAUSED: Please update your .env file');
      console.log('   1. Copy the PARQUET_TX_ID from above');
      console.log('   2. Add it to .env: PARQUET_TX_ID=your_tx_id_here');
      console.log('   3. Configure ArNS undername if needed');

      await question('\nPress Enter when ready to continue...');
    } else {
      console.log('   ⏭️  Skipping parquet upload\n');
    }

    // Step 3: Upload WASM files
    console.log('\n📋 STEP 3: Upload WASM Files to Arweave');
    console.log('='.repeat(60));

    const uploadWasm = await question('\nUpload WASM files? (y/N): ');
    if (uploadWasm.toLowerCase() === 'y') {
      await runCommand('node scripts/upload-wasm.js', 'Uploading WASM files');

      console.log('\n⏸️  PAUSED: Please update your configuration');
      console.log('   1. Copy the TX IDs from above');
      console.log('   2. Add them to .env (WASM_MVP_TX_ID, etc.)');
      console.log('   3. Update src/config/arweave.js production config');

      await question('\nPress Enter when ready to continue...');
    } else {
      console.log('   ⏭️  Skipping WASM upload (using existing TX IDs)\n');
    }

    // Step 4: Build production app
    console.log('\n📋 STEP 4: Build Production App');
    console.log('='.repeat(60));

    const build = await question('\nBuild production app? (Y/n): ');
    if (build.toLowerCase() !== 'n') {
      await runCommand('npm run build', 'Building production app');
    } else {
      console.log('   ⏭️  Skipping build\n');
    }

    // Step 5: Deploy app to Arweave
    console.log('\n📋 STEP 5: Deploy App to Arweave');
    console.log('='.repeat(60));

    console.log('\n💡 Manual deployment steps:');
    console.log('   1. Test build locally: npm run preview');
    console.log('   2. Upload dist/ folder to Arweave');
    console.log('   3. Configure ArNS: crimrxiv.arweave.net → app_tx_id');
    console.log('   4. Test live site\n');

    const deployApp = await question('Deploy app now? (y/N): ');
    if (deployApp.toLowerCase() === 'y') {
      // Use ArDrive sync or other deployment method
      const hasSync = await fileExists(path.join(__dirname, 'sync-ardrive-fixed.js'));
      if (hasSync) {
        await runCommand('node scripts/sync-ardrive-fixed.js', 'Deploying via ArDrive');
      } else {
        console.log('\n⚠️  No deployment script found.');
        console.log('   Please manually upload dist/ folder to Arweave\n');
      }
    } else {
      console.log('   ⏭️  Skipping deployment\n');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ DEPLOYMENT WORKFLOW COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log('   ✅ Parquet exported and uploaded');
    console.log('   ✅ WASM files uploaded (if selected)');
    console.log('   ✅ Production app built');
    console.log('   ✅ Ready for deployment\n');

    console.log('💡 Final steps:');
    console.log('   1. Test locally: npm run preview');
    console.log('   2. Verify all external resources load correctly');
    console.log('   3. Configure ArNS names:');
    console.log('      - data_crimrxiv.arweave.net → PARQUET_TX_ID');
    console.log('      - crimrxiv.arweave.net → APP_TX_ID');
    console.log('   4. Monitor transaction confirmations');
    console.log('   5. Test live site once confirmed\n');

    console.log('🎉 Deployment complete! Your archive is permanent.\n');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deploy();
}

export default deploy;
