# CrimConsortium Admin Guide - Static Site Management

## 🎯 **Overview**

This guide covers how to manage and deploy the CrimConsortium static site archive with 835 publications from 30 consortium members.

## 📁 **Current Implementation**

### **What We Have:**
- **Complete static site**: 868 pre-generated HTML pages
- **Full dataset**: 835 publications from all consortium members
- **30 member profiles**: 17 research institutions + 13 supporting organizations
- **37 PDF attachments**: Archived locally for permanent access
- **Self-contained package**: Ready for deployment to Arweave

### **Site Structure:**
```
dist/main/
├── index.html                    # Homepage with 25 recent publications
├── articles/                     # 835 individual article pages
├── members/                      # 30 member profile pages
├── assets/
│   ├── images/                  # Logo and favicon
│   └── pdfs/                    # 37 archived PDF attachments
└── data/
    └── consortium.json          # Complete 56MB dataset
```

## 🛠️ **Build and Deployment**

### **Prerequisites:**
```bash
# Required software
- Node.js 18 or higher
- npm package manager
- Git for version control
```

### **Initial Setup:**
```bash
# Clone repository
git clone [repository-url]
cd crimrxiv-static-hub

# Install dependencies
npm install

# Verify data is present
ls -la data/final/  # Should show consortium-dataset.json and pdfs/
```

### **Building the Site:**
```bash
# Build complete static site
npm run build

# Output:
# ✅ Generated 835 enhanced article pages
# ✅ Generated 30 member pages
# ✅ Copied 37 PDFs to dist folder
# ✅ Built 868 total pages
# ✅ Site ready at dist/main/
```

### **Local Testing:**
```bash
# Start development server
npm run dev

# Visit http://localhost:3000
# Test:
# - Homepage loads with 25 recent publications
# - All member pages accessible
# - Article pages display correctly
# - PDF downloads work for available files
```

## 📊 **Content Overview**

### **Current Statistics:**
```
Publications:
├── Total articles: 835
├── With PDF attachments: 37
├── Recent (homepage): 25
└── Average per member: ~28

Members:
├── Research institutions: 17
├── Supporting organizations: 13
├── Total: 30 consortium members
└── All with dedicated profile pages

Data Size:
├── HTML pages: ~20MB
├── PDF attachments: 26MB
├── Dataset JSON: 56MB
├── Total archive: ~82MB
└── Arweave cost: ~$0.82 one-time
```

## 🔄 **Updating Content**

### **When New Publications Are Added:**

1. **Update the dataset:**
   ```bash
   # Place new consortium export in data/final/
   # File: consortium-dataset.json
   ```

2. **Add any new PDFs:**
   ```bash
   # Copy PDFs to data/final/pdfs/
   # Filename format: {article-slug}.pdf
   ```

3. **Rebuild the site:**
   ```bash
   npm run build
   ```

4. **Test locally:**
   ```bash
   npm run dev
   # Verify new content appears correctly
   ```

## 🚀 **Deployment to Arweave**

### **Manual Deployment Process:**

1. **Prepare the archive:**
   ```bash
   # Site is already built in dist/main/
   # All files are self-contained and ready
   ```

2. **Upload to Arweave:**
   - Use Arweave web wallet or CLI
   - Upload the entire dist/main/ folder
   - Total size: ~82MB
   - Cost: ~$0.82 one-time

3. **Configure ArNS (if using):**
   - Point crimconsortium.ar to the uploaded transaction ID
   - Annual cost: $10-50/year

### **What Gets Deployed:**
```
Everything in dist/main/:
├── 868 HTML pages (all pre-rendered)
├── 37 PDF attachments
├── Logo and favicon
├── Complete dataset JSON
└── No external dependencies
```

## 🔍 **Troubleshooting**

### **Common Issues:**

**Build fails:**
```bash
# Check Node version
node --version  # Should be 18+

# Reinstall dependencies
rm -rf node_modules
npm install

# Verify data exists
ls data/final/consortium-dataset.json
```

**PDFs not showing:**
```bash
# Check PDFs are in correct location
ls data/final/pdfs/

# Verify filenames match article slugs
# Format: {article-slug}.pdf
```

**Pages missing:**
```bash
# Check build output
npm run build
# Should show: "Generated 835 enhanced article pages"

# Verify dist folder
ls dist/main/articles/ | wc -l  # Should be 835
```

## 📋 **Maintenance Scripts**

### **Available Commands:**
```bash
npm run build    # Build complete static site
npm run dev      # Start local development server
npm run import   # Process consortium data (if needed)
npm run validate # Verify build integrity
```

### **Archive Organization:**
```bash
# Deprecated scripts moved to archive
scripts/archive/   # Old/unused build scripts

# Active scripts
scripts/build-enhanced-complete.js     # Main build script
scripts/improved-article-template.js   # Article page template
scripts/serve.js                       # Dev server
```

## ✅ **Quality Checklist**

Before deployment, verify:

- [ ] Build completes without errors
- [ ] Homepage shows 25 recent publications
- [ ] All 30 member pages load correctly
- [ ] Article pages display abstracts and metadata
- [ ] PDF downloads work (for 37 attachments)
- [ ] Footer shows "Powered by ar.io"
- [ ] No broken links or missing images
- [ ] Logo appears in header and footer
- [ ] Mobile responsive design works

## 📞 **Support**

### **For Technical Issues:**
- Review error messages carefully
- Check this documentation
- Verify all prerequisites are installed
- Ensure data files are in correct locations

### **For Content Issues:**
- Verify consortium-dataset.json is complete
- Check PDF filenames match article slugs
- Ensure all members are in the dataset
- Confirm publication metadata is complete

---

**Current Status**: Complete static site with 835 publications ready for deployment to Arweave. No browser admin app or Wander wallet integration required - just build and deploy.