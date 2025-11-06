# CrimRXiv Archive - Deployment Guide

## Simple One-Command Deployment

The new deployment script provides a streamlined workflow:

```bash
npm run deploy
```

This single command:
1. ✅ Builds production app (`npm run build`)
2. ✅ Uploads `dist/` folder to Arweave via Turbo SDK
3. ✅ Updates your ArNS name to point to the new deployment

## Prerequisites

### Required: Arweave Wallet

**Create a `.env` file** with your wallet path:

```env
ARWEAVE_WALLET_PATH=./path/to/your/wallet.json
```

**Wallet Requirements**:
- Must be a JWK format wallet file
- Must have sufficient AR balance for uploads
- Turbo credits can be purchased at turbo.ardrive.io

### Optional: ArNS Process ID

To enable automatic ArNS updates, add to `.env`:

```env
ARNS_PROCESS_ID=your-arns-process-id
```

**To find your ArNS Process ID**:
1. Go to ar.io name management
2. View your registered name
3. Copy the Process ID from your name's details

**If not set**: Script will skip ArNS update and show manual instructions

## Deployment Process

### 1. Prepare Your Data

```bash
# Import latest data from CrimRXiv
npm run import

# Export to Parquet for browser queries
npm run export
```

### 2. Test Locally

```bash
# Start dev server
npm run dev

# Or preview production build
npm run build
npm run preview
```

### 3. Deploy to Arweave

```bash
npm run deploy
```

**Expected output**:
```
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀
  CrimRXiv Archive - Production Deployment
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀

======================================================================
📦 STEP 1: Building Production App
======================================================================

Running: npm run build
[Vite build output...]
✅ Build complete!

======================================================================
📤 STEP 2: Uploading to Arweave via Turbo
======================================================================

Loading wallet from: ./wallet.json
Initializing Turbo client...
Wallet balance: 1000000000000 winc (1.0 AR)

Uploading folder: C:\Source\crimconsortium-hub\dist
This may take several minutes...

✅ Upload complete!
📍 Manifest ID: abc123...xyz789
🔗 Gateway URL: https://arweave.net/abc123...xyz789
📊 Files uploaded: 42

======================================================================
🔗 STEP 3: Updating ArNS Record
======================================================================

Initializing AR.IO SDK...
ArNS Process ID: process-id-here
New Target ID: abc123...xyz789
Updating ArNS record...

✅ ArNS update transaction submitted!
📍 Update TX: def456...uvw012
⏱️  Changes will propagate within ~5-10 minutes

======================================================================
🎉 DEPLOYMENT COMPLETE!
======================================================================

📋 Deployment Summary:
   ⏱️  Duration: 45.2s
   📍 Manifest ID: abc123...xyz789
   🔗 ArNS Update TX: def456...uvw012

🌐 Access URLs:
   Gateway: https://arweave.net/abc123...xyz789
   ArNS: (will update within 5-10 minutes)

💡 Next Steps:
   1. Wait 5-10 minutes for ArNS propagation
   2. Test your site at the gateway URL
   3. Verify ArNS name points to new deployment
   4. Check that all resources load correctly

✨ Your archive is now permanently deployed!
```

## Cost Estimation

**Typical deployment costs** (using Turbo):

| Component | Size | Cost (AR) | Cost (USD) |
|-----------|------|-----------|------------|
| Built app (dist/) | ~5 MB | ~0.002 AR | ~$0.08 |
| Metadata Parquet | ~20 MB | ~0.008 AR | ~$0.32 |
| **Total** | **~25 MB** | **~0.01 AR** | **~$0.40** |

**Notes**:
- Prices based on Turbo rates as of 2025
- ArNS updates have minimal cost (network fee)
- One-time permanent storage (pay once, store forever)

## ArNS Configuration

### What is ArNS?

ArNS (Arweave Name System) provides human-readable URLs for your permanent Arweave deployments.

**Example**:
- Transaction ID: `abc123xyz789...` (ugly)
- ArNS Name: `crimrxiv.ar-io.dev` (pretty!)

### Manual ArNS Setup (if not automated)

1. **Purchase/Register an ArNS name**:
   - Go to ar.io
   - Register a name (e.g., `crimrxiv`)
   - Get your Process ID

2. **Configure the name**:
   - Set target to your manifest ID
   - Set TTL (recommended: 3600 seconds = 1 hour)
   - Save changes

3. **Wait for propagation**:
   - Changes propagate to gateways in 5-10 minutes
   - Test at: `https://your-name.ar-io.dev`

### ArNS Undernames (Optional)

You can create undernames for different resources:

```
crimrxiv.ar-io.dev          → Main app
data_crimrxiv.ar-io.dev     → Parquet data file
wasm_crimrxiv.ar-io.dev     → DuckDB WASM bundles
```

**Benefits**:
- Organize resources by purpose
- Update independently
- Clearer architecture

## Troubleshooting

### "ARWEAVE_WALLET_PATH not set"

**Solution**: Create `.env` file with wallet path:
```env
ARWEAVE_WALLET_PATH=./wallet.json
```

### "Insufficient balance"

**Solution**:
1. Check balance: `node -e "import('@ardrive/turbo-sdk').then(async ({TurboFactory}) => { const t = TurboFactory.authenticated({privateKey: require('./wallet.json')}); console.log(await t.getBalance()) })"`
2. Purchase Turbo credits at turbo.ardrive.io
3. Or fund wallet with AR tokens

### "ArNS update failed"

**Workaround**: Update manually:
1. Copy the manifest ID from deployment output
2. Go to ar.io name management
3. Update your name to point to new manifest ID
4. Wait 5-10 minutes for propagation

### "Upload timeout"

**Solution**:
- Check internet connection
- Try again (Turbo is reliable, timeouts are rare)
- Use a smaller build (check dist/ size)

### Gateway not loading resources

**Check**:
1. Verify all files uploaded successfully
2. Check browser console for CORS errors
3. Wait a few minutes for gateway propagation
4. Try different gateway (arweave.net, g8way.io, etc.)

## Advanced: Deploying Parquet Separately

If you want to deploy the Parquet file separately (for ArNS undername):

```bash
# Deploy main app
npm run deploy

# Deploy Parquet file separately (manual)
npx @ardrive/turbo-cli upload-file public/data/metadata.parquet \
  --wallet-file ./wallet.json \
  --tags "Content-Type:application/octet-stream" \
  --tags "App-Name:CrimRXiv-Data"
```

Then configure ArNS undername:
```
data_crimrxiv.ar-io.dev → parquet-tx-id
```

## Full Deployment Checklist

- [ ] Data imported from CrimRXiv (`npm run import`)
- [ ] Parquet exported (`npm run export`)
- [ ] Tested locally (`npm run dev`)
- [ ] Built production (`npm run build`)
- [ ] Previewed production build (`npm run preview`)
- [ ] Wallet has sufficient balance
- [ ] `.env` configured with wallet path
- [ ] ArNS Process ID added to `.env` (optional)
- [ ] Deployed to Arweave (`npm run deploy`)
- [ ] Waited 5-10 minutes for propagation
- [ ] Tested gateway URL
- [ ] Verified ArNS name updated
- [ ] All resources loading correctly
- [ ] Search functionality working
- [ ] External publication links working

## Continuous Deployment

For regular updates (new articles, bug fixes):

```bash
# 1. Update data
npm run import
npm run export

# 2. Deploy
npm run deploy

# That's it! ArNS updates automatically.
```

**Frequency recommendations**:
- Data updates: Weekly or as needed
- Bug fixes: As needed
- Feature updates: As needed

**Note**: Each deployment creates a new permanent snapshot. Old versions remain accessible via their transaction IDs.

---

## Alternative: Keep Old deploy-full Script

If you prefer the interactive wizard:

```bash
npm run deploy:full
```

This runs the original `scripts/deploy-full.js` with step-by-step prompts.

---

**Questions?** Check the main README.md or open an issue on GitHub.
