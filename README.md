# Media Extractor Pro — Chrome Extension

A premium Chrome Extension built with Manifest V3 to extract, preview, filter, and download all images and videos from any webpage instantly. Highly integrated with the UnifiedTools Pro website converter.

[![Available in the Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v1.1.0-blue.svg?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/media-extractor-pro/edeandmopjnajlgijafaajopdbleoklj)

![Media Extractor Pro Icon](icons/icon128.png)

## Features

### 🖼️ Image Extraction
- **DOM Image Extraction:** Detects all standard `<img>` tags, dynamic `srcset` tags, picture sources, and lazy-loading elements.
- **CSS Background Detector:** Scans computed CSS styles to extract background images.
- **⚡ Inline SVG Scraper (New):** Extracts raw inline `<svg>` templates from the DOM. Enables copying the XML source code directly to your clipboard in one click!
- **Image Formats Supported:** JPG, PNG, GIF, WEBP, SVG, AVIF, BMP, ICO.

### 🎥 Video Extraction
- **HTML5 Video Player Detector:** Scans `<video>` tags and their `<source>` children to extract direct video files (MP4, WebM, OGV, etc.).
- **Video Scraper:** Detects standard HTML5 video elements and video file sources.
- **Video Formats Supported:** MP4, WEBM, OGV, MOV, M4V, 3GP, AVI, FLV, MKV.

### 📊 SEO Alt-Text Audit & CSV Export (New)
- **Alt-Text Badge Indicators:** Displays alt text directly on preview cards. Features visual status indicators (emerald green for completed Alt texts, amber/orange for missing Alt text tags) so you can audit webpage SEO at a glance.
- **Spreadsheet Export:** Export all extracted image URLs, file formats, dimensions, and Alt tags directly to a structured `.csv` sheet with a single click.

### ⚙️ Customizable Renaming & Subfolders (New)
- **Organized Subfolders:** Set a custom folder path under your Downloads directory (e.g. `Downloads/my-subfolder/`).
- **Smart Renaming Patterns:** Configure name templates using numbering placeholders (e.g., `logo-[index]` to automatically save files as `logo-1.png`, `logo-2.png`, etc.).

### 🔗 Website Image Converter Integration (New)
- **Single Redirect:** Inside the full-screen modal preview, click the **"Convert Image"** button to load the image directly into the UnifiedTools Pro converter.
- **Bulk Convert:** Select multiple images (or click "Select All") and click the **"Convert"** button in the bottom bar to open all images at once on the `UnifiedTools Pro` converter page for instant conversion (WebP, PNG, etc.).

### ⏳ Live Download Progress Toast (New)
- Replaced static notifications with a sleek, animated percentage and width-transitioning progress strip. Perfect for tracking large bulk download queues.

---

## Folder Structure

```text
image-extractor-pro/
├── manifest.json         # Extension Manifest V3 metadata
├── PRIVACY.md            # Privacy policy (Chrome Web Store required)
├── popup/
│   ├── popup.html        # Main popup GUI with dual tabs & media modals
│   ├── popup.css         # Modern light theme CSS styles
│   └── popup.js          # Image/Video tabs, filters, preview, & downloads
├── content/
│   └── content.js        # DOM image/video/SVG scraping scripts
├── background/
│   └── service-worker.js # Badge counts & downloads manager
└── icons/
    ├── icon16.png        # Transparent extension icons in different sizes
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## Local Installation (For Testing)

1. Open Google Chrome.
2. Go to **`chrome://extensions/`**.
3. Toggle the **Developer mode** switch (top-right corner) to **ON**.
4. Click the **"Load unpacked"** button (top-left).
5. Select this `image-extractor-pro` folder.
6. The extension is now ready! Pin it to your Chrome toolbar and test on any site (e.g. Unsplash, Wikipedia).

---

## Publishing to the Chrome Web Store

To publish this extension so anyone can install it:

### Step 1: Zip the extension directory
Compress all files and folders inside the `image-extractor-pro` directory into a single `.zip` file. (Make sure `manifest.json` is at the root of the ZIP file).

*Note: You can run our packaging script (`make_zip.py`) to generate a perfect `.zip` file automatically!*

### Step 2: Upload to Developer Dashboard
1. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with a Google Account.
3. Click **"New Item"** (top-right) or select the existing draft extension.
4. Drag and drop the generated `image-extractor-pro.zip` file.

### Step 3: Complete Product Listing
Fill out the required information:
- **Description:** Detail the new features (Alt-text tags, CSV, inline SVG copy, and website conversion).
- **Permissions Justification:** Explain why you use `activeTab` and `scripting` (to scan the currently active site's DOM for images/videos).
- **Graphic Assets:** Upload the Store icon, and the 440x280 & 1400x560 store promo tiles.

### Step 4: Submit for Review
Click **"Submit for Review"** to publish.
