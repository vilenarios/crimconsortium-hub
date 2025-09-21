# 🚀 CrimConsortium Hub - Complete Admin Guide

This guide walks you through the entire process from importing data to deploying the CrimConsortium static website with 835 academic publications from 30 consortium members.

## 📋 Overview

This project creates a complete, permanent website that includes:
- **835 research publications** from criminology consortium members
- **30 institution profiles** (universities and supporting organizations)
- **37 PDF attachments** for direct download
- **Professional design** matching the CrimRXiv academic platform

## 🎯 Two Scenarios

### Scenario A: Starting Fresh (No Data Yet)
Follow all steps from "Getting Started" through "Deployment"

### Scenario B: Data Already Imported
Skip to "Building the Website" if you already have the `data/final/` folder with content

## 🏃 Getting Started (One-Time Setup)

### Step 1: Install Required Software

1. **Install Node.js** (version 18 or higher)
   - Go to https://nodejs.org
   - Download the "LTS" version for your operating system
   - Run the installer with default settings
   - Restart your computer after installation

2. **Verify Installation**
   - Open Terminal (Mac) or Command Prompt (Windows)
   - Type: `node --version`
   - You should see a version number like "v18.x.x" or higher

### Step 2: Set Up the Project

1. **Open Terminal/Command Prompt**
   - Mac: Press Cmd+Space, type "Terminal", press Enter
   - Windows: Press Windows key, type "cmd", press Enter

2. **Navigate to the Project Folder**
   ```
   cd path/to/crimconsortium-hub
   ```
   (Replace "path/to" with the actual location)

3. **Install Dependencies** (one-time only)
   ```
   npm install
   ```
   This downloads necessary tools. Wait for "added X packages" message.

## 📥 Importing Data from CrimRXiv (First Time)

If you don't have the data yet, you need to import it from CrimRXiv first:

### Step 1: Import All Publications
```
npm run import
```

**⏱️ This will take 30-45 minutes!**

**What happens during import:**
- Fetches all 30 consortium member pages from CrimRXiv
- Downloads ~835 publications with full content
- Retrieves available PDF attachments
- Creates a 56MB dataset file

**You'll see progress like this:**
```
✅ University of Manchester: 142 publications
✅ Northeastern University: 89 publications
📋 Knowledge Futures: Supporting member
...continuing through all 30 members...
```

**When complete:**
- Creates `data/final/consortium-dataset.json` (56MB)
- Saves PDFs to `data/final/pdfs/` folder
- Ready to build the website

### Alternative: Faster Import (If Available)
```
npm run import-legacy
```
This uses an optimized scraper that's faster (~30 minutes) but less resumable if interrupted.

## 🔨 Building the Website

After importing data, build the static website:

### Step 2: Build the Complete Site
```
npm run build
```

**What this does:**
- Reads the imported dataset
- Creates 868 individual HTML pages
- Generates homepage with 25 recent publications
- Creates pages for all 30 member institutions
- Copies all PDF attachments to website folder
- Takes about 15 seconds

**You'll see:**
```
✅ Dataset loaded: 835 publications from 30 members
✅ Generated enhanced homepage with 25 recent publications
✅ Generated 835 enhanced article pages
✅ Generated 30 member pages
✅ Copied 37 PDFs to dist folder
✅ Complete site ready at dist/main/
```

**Result:** Your complete website is now in the `dist/main/` folder!

## 👀 Testing Locally

### View the Website on Your Computer
```
npm run dev
```

1. This starts a local preview server
2. Open your web browser
3. Go to: http://localhost:3000
4. You should see:
   - Homepage with 25 recent publications
   - Links to all member institutions
   - Search functionality (if enabled)
   - Professional academic design

### What to Check:
- ✅ Homepage loads correctly
- ✅ Click on a few publications to ensure they open
- ✅ Check member institution pages work
- ✅ Try downloading a PDF (where available)
- ✅ Test on mobile phone (using same WiFi network)

**To stop the preview:** Press Ctrl+C in Terminal/Command Prompt

## 📦 Deploying to Arweave (Permanent Web)

### Understanding Arweave
- Arweave is a permanent storage network
- Once uploaded, your site lives forever
- One-time payment (about $0.82 for this site)
- No monthly hosting fees ever

### Deployment Steps

1. **Locate Your Website Files**
   - Find the `dist/main/` folder in your project
   - This contains your entire website (~82MB)

2. **Upload to Arweave**

   **Option A: Using ArConnect Wallet (Easiest)**
   - Install ArConnect browser extension
   - Get AR tokens (about $1 worth)
   - Use ArDrive web app (https://app.ardrive.io)
   - Upload the entire `dist/main/` folder
   - Save the transaction ID you receive

   **Option B: Using Arweave CLI**
   - Requires more technical knowledge
   - See Arweave documentation for details

3. **Optional: Set Up Custom Domain**
   - Purchase an ArNS domain (e.g., crimconsortium.ar)
   - Cost: $10-50 per year
   - Point it to your transaction ID
   - Makes your site easier to access

## 🔄 Updating Content

### Option 1: Re-import Everything from CrimRXiv
```
npm run import
npm run build
```
This fetches all latest content from CrimRXiv (takes 30-45 minutes)

### Option 2: Manual Update with Export File

1. **Get New Data Export**
   - Obtain updated `consortium-dataset.json` from CrimRXiv admin
   - This file contains all publication information

2. **Replace the Dataset**
   ```
   Replace: data/final/consortium-dataset.json
   With: Your new export file
   ```

3. **Add New PDFs** (if any)
   - Copy new PDF files to: `data/final/pdfs/`
   - Name them: `article-slug.pdf` (matching the article URL)

4. **Rebuild the Site**
   ```
   npm run build
   ```

5. **Test Locally**
   ```
   npm run dev
   ```
   Check that new content appears correctly

6. **Deploy Updated Version**
   - Upload the new `dist/main/` folder to Arweave
   - Update ArNS domain to point to new transaction

## ❓ Troubleshooting

### Import/Scraping Issues

**"Scraping seems stuck"**
- Normal - import takes 30-45 minutes
- Check progress messages in Terminal
- If truly stuck, press Ctrl+C and run `npm run import` again (it resumes)

**"No data found"**
- Check internet connection
- CrimRXiv might be temporarily down
- Try `npm run import-legacy` for alternative scraper

### Build Problems

**"Command not found"**
- Make sure you're in the correct folder
- Verify Node.js is installed: `node --version`
- Run `npm install` again

**"Build fails"**
- Check that `data/final/consortium-dataset.json` exists
- If missing, run `npm run import` first
- Ensure the file isn't corrupted (should be ~56MB)
- Try deleting `node_modules` folder and run `npm install` again

### Website Issues

**"Website looks broken"**
- Clear your browser cache
- Try a different browser
- Make sure you're viewing http://localhost:3000 (not file://)

**"PDFs won't download"**
- Check PDFs are in `data/final/pdfs/` folder
- Verify filenames match article slugs exactly
- Ensure PDF files aren't corrupted

**"Pages missing"**
- Run `npm run build` again
- Check Terminal for error messages
- Verify data import completed successfully

## 📊 Understanding Your Website

### File Structure
```
Your Website (dist/main/)
├── index.html           → Homepage
├── articles/            → 835 publication pages
├── members/             → 30 institution pages
└── assets/
    ├── images/          → Logo and graphics
    └── pdfs/            → 37 downloadable PDFs
```

### Content Statistics
- **835 total publications**
- **30 consortium members**
- **37 PDF attachments**
- **~82MB total size**
- **~$0.82 deployment cost**

## ✅ Complete Process Checklist

### First-Time Setup:
- [ ] Node.js installed and verified
- [ ] Project dependencies installed (`npm install`)
- [ ] Data imported from CrimRXiv (`npm run import`)
- [ ] Website built successfully (`npm run build`)
- [ ] Local preview tested (`npm run dev`)

### Before Deployment:
- [ ] Homepage displays 25 recent publications
- [ ] Institution pages load correctly (all 30)
- [ ] Article pages show full content (test several)
- [ ] PDFs download properly (where available)
- [ ] Mobile view looks good
- [ ] Footer shows "Powered by ar.io"
- [ ] Total size is ~82MB in `dist/main/`

## 🆘 Getting Help

### If Something Goes Wrong:

1. **Check the Error Message**
   - Error messages often tell you exactly what's wrong
   - Google the error message for solutions

2. **Common Solutions**
   - Restart Terminal/Command Prompt
   - Run `npm install` again
   - Make sure you're in the right folder
   - Try on a different computer

3. **File Locations**
   - Source data: `data/final/`
   - Built website: `dist/main/`
   - Build scripts: `scripts/`

## 🎉 Success!

Once deployed to Arweave:
- Your site is permanently preserved
- No ongoing hosting costs
- Accessible worldwide
- Immutable academic record
- Professional presentation for research

---

## 🚦 Quick Reference - Complete Process

```bash
# 1. First-time setup
npm install                    # Install tools (one time only)

# 2. Import data from CrimRXiv
npm run import                 # Takes 30-45 minutes
# OR
npm run import-legacy          # Alternative, faster scraper

# 3. Build the website
npm run build                  # Creates 868 pages in ~15 seconds

# 4. Test locally
npm run dev                    # View at http://localhost:3000

# 5. Deploy
# Upload dist/main/ folder to Arweave (~$0.82)
```

**Total time:** ~45 minutes first time, ~1 minute for updates
**Total cost:** ~$0.82 (one-time) + optional domain ($10-50/year)