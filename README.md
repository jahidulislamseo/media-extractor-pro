# Media Extractor Pro — Chrome Extension

A premium Chrome Extension built with Manifest V3 to extract, preview, filter, and download all images and videos from any webpage instantly.

![Media Extractor Pro Icon](icons/icon128.png)

## Features

### 🖼️ Image Extraction
- **DOM Image Extraction:** Detects all standard `<img>` tags, dynamic `srcset` tags, picture sources, and lazy-loading elements.
- **CSS Background Detector:** Scans computed CSS styles to extract background images.
- **Image Formats Supported:** JPG, PNG, GIF, WEBP, SVG, AVIF, BMP, ICO.

### 🎥 Video Extraction
- **HTML5 Video Player Detector:** Scans `<video>` tags and their `<source>` children to extract direct video files (MP4, WebM, OGV, etc.).
- **Embed Video Scraper:** Detects YouTube and Vimeo iframes, extracts video links, and fetches video thumbnails automatically.
- **Video Formats Supported:** MP4, WEBM, OGV, MOV, M4V, 3GP, AVI, FLV, MKV.

### ⚙️ Filters & Tools
- **Split Tab Layout:** Toggle between **Images** and **Videos** tabs inside the popup dashboard.
- **Advanced Formats Chip-Filter:** Filter by file format chips dynamically based on selected media tab.
- **Size/Dimension Filter:** Filter by minimum size (Any, 50px, 100px, 300px, 500px, 1000px).
- **Search Bar:** Live search items by URL or metadata.
- **Dual Grid/List Views:** Choose between visual grid gallery or lists displaying title, URL, type, and size.
- **Dual Previews:**
  - Image preview card.
  - Video preview playing direct MP4s in custom HTML5 players, or loading YouTube/Vimeo embeds.
- **Single & Bulk Downloads:** Downloader with queue management to avoid Chrome download rate limits.

---

## Folder Structure

```text
image-extractor-pro/
├── manifest.json         # Extension Manifest V3 metadata
├── PRIVACY.md            # Privacy policy (Chrome Web Store required)
├── popup/
│   ├── popup.html        # Main popup GUI with dual tabs & media modals
│   ├── popup.css         # Modern light theme CSS styles
│   └── popup.js          # Image/Video tabs, filter, preview, & downloads
├── content/
│   └── content.js        # DOM image and video scraping scripts
├── background/
│   └── service-worker.js # Badge counts & downloads manager
└── icons/
    ├── icon16.png        # Extension icons in different sizes
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
6. The extension is now ready! Pin it to your Chrome toolbar and test on any site (e.g. YouTube, Vimeo, Unsplash).

---

## Publishing to the Chrome Web Store

To publish this extension so anyone can install it:

### Step 1: Zip the extension directory
Compress all files and folders inside the `image-extractor-pro` directory into a single `.zip` file. (Make sure `manifest.json` is at the root of the ZIP file).

*Note: You can run our packaging script to generate a perfect `.zip` file automatically!*

### Step 2: Upload to Developer Dashboard
1. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with a Google Account.
3. Click **"New Item"** (top-right).
4. Drag and drop the generated `image-extractor-pro.zip` file.

### Step 3: Complete Product Listing
Fill out the required information:
- **Description:** Detail the features (Images + Videos tabs, MP4/YouTube embeds, WEBP filters).
- **Permissions Justification:** Explain why you use `activeTab` and `scripting` (to scan the currently active site's DOM for images/videos).
- **Privacy Policy:** Link to your online privacy policy.
- **Screenshots:** Add screenshots showing both Images and Videos tabs.

### Step 4: Submit for Review
Click **"Submit for Review"** to publish.
