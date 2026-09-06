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
media-extractor-pro/
├── manifest.json         # Extension Manifest V3 metadata
├── PRIVACY.md            # Privacy policy
├── popup/
│   ├── popup.html        # Main popup interface
│   ├── popup.css         # Modern styling & responsive layouts
│   └── popup.js          # Core UI logic, filters, and downloads
├── content/
│   └── content.js        # High-performance media extraction engine
├── background/
│   └── service-worker.js # Background download & badge manager
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 How to Download & Install from GitHub

You do **not** need Node.js or any build tools to use this extension. It runs natively in Google Chrome, Microsoft Edge, Brave, and other Chromium browsers.

### Method 1: Download ZIP (Easiest)

1. Click the green **`<> Code`** button at the top of this GitHub repository.
2. Select **"Download ZIP"** (or [click here to download](https://github.com/jahidulislamseo/media-extractor-pro/archive/refs/heads/master.zip)).
3. Extract (unzip) the downloaded file on your computer. You will get a folder named `media-extractor-pro-master`.
4. Open Google Chrome (or Edge / Brave / Opera).
5. In the address bar, type **`chrome://extensions`** and press **Enter**.
6. Turn **ON** the **"Developer mode"** toggle in the top-right corner.
7. Click the **"Load unpacked"** button in the top-left corner.
8. Select the unzipped `media-extractor-pro-master` folder (the folder containing `manifest.json`).
9. Done! The extension icon will appear in your browser toolbar. Click the puzzle icon 🧩 and pin **Media Extractor Pro** for quick access.

### Method 2: Git Clone

```bash
git clone https://github.com/jahidulislamseo/media-extractor-pro.git
```
Then follow steps 4–9 above and select the cloned `media-extractor-pro` folder.

---

## 🔄 How to Update to the Latest Version

If you already installed the extension and want to get the latest fixes:
1. Re-download the ZIP or run `git pull origin master` in your folder.
2. Go to **`chrome://extensions`**.
3. Find **"Image & Video Extractor"** and click the **Reload (🔄)** icon button.

---

## Publishing to the Chrome Web Store

To build a clean `.zip` package for Chrome Web Store distribution:

```bash
zip -r media-extractor-pro.zip . -x "*.git*" "*.DS_Store*" "*.vscode*" "*.zip" "*scratch*"
```

Upload the resulting `media-extractor-pro.zip` file directly to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
