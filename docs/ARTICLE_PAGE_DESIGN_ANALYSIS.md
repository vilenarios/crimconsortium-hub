# CrimRxiv Article Page Design Analysis

**Source:** https://www.crimrxiv.com/pub/1yynad7d/release/1

## Overall Layout Structure
- **Wide content area** with generous margins
- **Single-column design** for readability
- **Minimalist aesthetic** - black, white, and subtle grays
- **Clear visual hierarchy** with whitespace separation

## Header & Navigation
- **CrimRxiv logo** (top left)
- **Search bar** (top center)
- **Black navigation bar** with: Home | Articles (dropdown) | Consortium | News
- **Social media icons** (Twitter, Mastodon, LinkedIn, BlueSky)
- **Login/Dashboard** links (top right)

## Article Metadata Display (Top Section)

### Institutional Badge
- Gray background box
- Institution name (e.g., "Ghent University, Department of Criminology")

### Publication Type & Date
- "Postprints + Versions of Record"
- Date: "Oct 22, 2025"

### Title
- **Extra-large, bold typography** (~2.5-3rem)
- Black color, dominant on page
- Example: "Target Choices of Inner-City Illegal Taggers..."

### Authors
- Listed below title
- Names linked (likely to profiles)
- Format: "Christophe Vandeviver, Kuralarasan Kumar..."

### DOI
- Displayed as "10.21428/cb6ab371.a09333b9"
- Clickable link

### License
- Creative Commons badge/link
- Example: CC-BY-NC-ND 4.0

## Download Section

### Multiple Format Buttons (Grid Layout)
- PDF
- Word
- Markdown
- EPUB
- HTML
- OpenDocument
- Plain Text
- JATS XML
- LaTeX

### Release Information
- "last released 1 week ago"
- Expandable release details

### Version-of-Record Link
- Links to published journal version
- Example: "Version-of-record in *Deviant Behavior*"

## Main Content Sections (Academic Structure)

### Abstract
- First section, often collapsible
- Summary of research

### Introduction
- Research context and questions

### Background/Literature Review
- Existing research

### Data
- Dataset description
- Sample information

### Methods
- Research methodology
- Statistical approaches

### Results
- Findings with tables and figures
- **Table 1**: Data tables with borders, clear headers
- **Figures 1-5**: Charts, graphs, visualizations

### Discussion
- Interpretation of findings
- Implications

### Appendix
- Robustness checks
- Supplementary materials

### References
- Comprehensive bibliography
- Standard academic citation format

## Typography Hierarchy

### Size Scale
- **Title**: ~2.5-3rem (very large)
- **H1 Section Headers**: ~2rem (large, bold)
- **H2 Subsection Headers**: ~1.5rem (medium-bold)
- **Body Text**: ~1rem (16px, readable)
- **Metadata/Captions**: ~0.9rem (slightly smaller)

### Font Family
- Clean sans-serif (likely Inter, Helvetica, or similar)
- Serif font for body text (Georgia or similar for academic feel)

### Spacing
- Large margins between sections (3-4rem)
- Paragraph spacing (1.5-2rem)
- Line height: ~1.6-1.8 for readability

## Color Scheme

### Primary Colors
- **Black** (#000000) - headers, navigation bar, buttons
- **White** (#FFFFFF) - background, button text
- **Dark Gray** (#333, #666) - body text
- **Light Gray** (#F5F5F5, #FAFAFA) - institutional badge, backgrounds
- **Accent Color** - Orange or blue for links

### Interactive States
- Links: Blue or accent color
- Hover: Darkened version (rgba(0,0,0,0.8))
- Focus: Underline or color change

## Tables & Figures

### Table Styling
- Bordered cells
- Header row with bold text
- Alternating row backgrounds (zebra striping)
- Clear column alignment
- Caption above or below

### Figures
- Centered images
- Figure numbers (Figure 1, Figure 2...)
- Descriptive captions below
- Responsive sizing

## Sidebar/Secondary Elements

### Version Information
- Sidebar or boxed section
- Version number and date
- Related publications

### Navigation
- Table of contents (possible)
- Section jump links

## Interactive Elements

### Collapsible Sections
- Abstract can expand/collapse
- Methods sections collapsible
- References may collapse

### Citation Button
- Provides citation formats
- Copy functionality

### Social Sharing
- Share on social media buttons

### Discussion/Comments
- Community engagement section
- Comment threads (at bottom)

## Footer

### Content
- ISSN: 2766-7170
- Help link
- RSS feed
- Legal information
- Social media links (repeated)
- "Powered by PubPub" logo

### Styling
- Dark background
- White text
- Multiple columns for link organization

## Key Design Patterns

### Visual Hierarchy
1. Title (largest, most prominent)
2. Authors and metadata
3. Download options (prominent buttons)
4. Abstract (first content)
5. Main content sections
6. References
7. Comments/discussion

### Spacing Philosophy
- Generous whitespace
- Clear section delineation
- Breathing room around all elements
- No cramped feeling

### Button Styles
- Rectangular with slight rounding
- Black backgrounds for primary actions
- White text
- Hover states with visual feedback
- Grouped logically (all download buttons together)

## Academic Conventions

### Standard Elements
- DOI prominent
- Authors with affiliations
- Publication date
- License clearly stated
- Abstract first
- Structured sections (IMRAD format)
- References at end
- Tables and figures numbered

## Accessibility Features
- High contrast text
- Large, readable fonts
- Clear link differentiation
- Semantic HTML structure
- Alt text for images

## Key Implementation Priorities

1. ✅ Large, bold article title
2. ✅ Clean metadata display (authors, date, DOI)
3. ✅ Multiple download format buttons
4. ✅ Academic section structure (Abstract → Methods → Results → Discussion)
5. ✅ Table and figure styling with captions
6. ✅ Generous spacing between sections
7. ✅ Black navigation bar at top
8. ✅ Footer with links and ISSN
9. ✅ Institutional affiliation badge
10. ✅ Version-of-record link
