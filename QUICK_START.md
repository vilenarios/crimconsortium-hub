# 🚀 CrimConsortium Static Hub - Quick Start Guide

Welcome to the CrimConsortium Static Hub! This guide will help you get the entire system running from scratch.

## 📋 Prerequisites

- Node.js 18+ installed
- Good internet connection (scraping will take 30-45 minutes)
- ~100MB free disk space

## 🏃 Quick Start (First Time Setup)

### Step 1: Install Dependencies
```bash
npm install
```
This installs all required packages (cheerio, axios, fs-extra, etc.)

### Step 2: Scrape Consortium Data
```bash
npm run import-legacy
```
This will:
- 🕐 Take approximately 30-45 minutes
- 📊 Scrape all 30 consortium member pages from CrimRxiv
- 📚 Fetch ~835 publications with full content
- 📎 Download available PDF attachments
- 💾 Create a 56MB dataset at `data/final/consortium-dataset.json`

**Note:** The scraper will show progress as it works through each member:
```
✅ University of Manchester: 142 publications
✅ Northeastern University: 89 publications
📋 Knowledge Futures: Supporting member
...
```

### Step 3: Build the Static Site
```bash
npm run build
```
This will:
- Generate 868 static HTML pages
- Create homepage with 25 recent publications
- Build member profile pages for all 30 institutions
- Copy PDFs to distribution folder
- Output complete site to `dist/main/`

### Step 4: Test Locally
```bash
npm run dev
```
- Opens development server at http://localhost:3000
- Verify homepage loads with recent publications
- Check member pages and article pages work
- Test PDF downloads

## 🎯 What You Should See

After completing all steps:

1. **Data Directory Structure:**
```
data/
└── final/
    ├── consortium-dataset.json (56MB, 835 publications)
    └── pdfs/ (37 PDF attachments)
```

2. **Build Output:**
```
dist/
└── main/
    ├── index.html (homepage)
    ├── articles/ (835 article pages)
    ├── members/ (30 member pages)
    └── assets/
        ├── images/ (logo, favicon)
        └── pdfs/ (37 PDFs)
```

3. **Local Site:**
- Homepage with 25 recent publications
- 30 consortium member profiles
- 835 individual article pages
- Professional CrimRxiv design

## ⏱️ Time Estimates

- **Initial setup:** 2 minutes
- **First scrape:** 30-45 minutes (one-time)
- **Build site:** 15 seconds
- **Future updates:** Only re-scrape changed content

## 🔧 Available Commands

- `npm run import-legacy` - Full consortium scrape (faster, ~30-45 mins)
- `npm run import` - Incremental scraper (slower but resumable if interrupted)
- `npm run build` - Generate static site
- `npm run dev` - Local development server
- `npm run status` - Check scraping progress (if using incremental scraper)

## 💡 Tips

1. **First time?** Use `npm run import-legacy` for faster initial scraping
2. **Scraping interrupted?** Use `npm run import` which can resume
3. **Want fresh data?** Delete `data/` folder and re-run import
4. **Ready to deploy?** Upload `dist/main/` to Arweave (~$0.82)

## ❓ Troubleshooting

**If scraping seems stuck:**
- It's normal for scraping to take 30-45 minutes
- The scraper adds delays to be respectful to CrimRxiv servers
- Check progress in terminal output

**If build fails:**
- Ensure scraping completed successfully first
- Check that `data/final/consortium-dataset.json` exists
- Try running `npm install` again

## ✅ Success Checklist

- [ ] Dependencies installed
- [ ] Scraping completed (~835 publications found)
- [ ] Build successful (868 pages generated)
- [ ] Local site working at http://localhost:3000
- [ ] Homepage shows 25 recent publications
- [ ] Member pages display correctly
- [ ] Article pages load with content

## 🚢 Ready to Deploy?

Once everything works locally:
1. Your static site is in `dist/main/` (~82MB)
2. Upload entire folder to Arweave
3. Total cost: ~$0.82 one-time
4. Optional: Configure ArNS domain for easy access

---

**Need help?** Check the full documentation in [README.md](README.md) or [docs/](docs/)

**Time to build!** Start with Step 1 above. 🎉