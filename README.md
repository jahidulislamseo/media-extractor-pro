# Media Extractor Pro — Chrome Extension (v2.0.0)

[![🌐 Official Website](https://img.shields.io/badge/🌐_Website-Live-4f46e5?style=for-the-badge)](https://jahidulislamseo.github.io/media-extractor-pro/)
[![Downloads](https://img.shields.io/github/downloads/jahidulislamseo/media-extractor-pro/total?style=for-the-badge&logo=github&color=2ea44f&label=Downloads)](https://github.com/jahidulislamseo/media-extractor-pro/releases)
[![⬇️ Download ZIP (v2.0.0)](https://img.shields.io/badge/⬇️_Download_Extension_ZIP-v2.0.0-2563eb?style=for-the-badge&logo=github&logoColor=white)](https://github.com/jahidulislamseo/media-extractor-pro/releases/download/v2.0.0/media-extractor-pro-v2.0.0.zip)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-v2.0.0-059669?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/media-extractor-pro/edeandmopjnajlgijafaajopdbleoklj)

> 🚀 **Direct Download:** **[👉 Click Here to Download Extension ZIP (v2.0.0)](https://github.com/jahidulislamseo/media-extractor-pro/releases/download/v2.0.0/media-extractor-pro-v2.0.0.zip)**  
> *Unzip the file → Go to `chrome://extensions` → Turn on **Developer mode** → Click **Load unpacked** and select the folder.*

A high-performance Chrome Extension built with Manifest V3 to extract, preview, filter, and download images, videos, and audio tracks from any webpage instantly. Includes built-in offline ZIP archiving, deep feed auto-scrolling, and canvas format conversion.

![Media Extractor Pro Icon](icons/icon128.png)

## 🌟 What's New in v2.0.0 (Powerhouse Suite)

1. **📦 1-Click "Download as ZIP":** Package all selected or filtered media into a single uncompressed or compressed `.zip` archive offline using bundled local JSZip 3.10.1 (no 50 individual download prompts).
2. **🔄 Auto-Scroll & Deep Scraper Engine:** Scrape infinite-scroll feeds (Pinterest, Instagram, Unsplash, etc.) automatically at custom speeds with live telemetry.
3. **🎵 Audio / MP3 Extractor Tab:** Dedicated `Audios` tab detecting `<audio>`, audio sources, and podcast media with an in-popup player preview.
4. **📐 Dynamic Dimension Slider:** Filter media dynamically by minimum resolution (e.g., exclude icons <150px, keep only >1080p Full HD).
5. **🎨 Offline Canvas Image Converter:** Transcode modern WebP and AVIF formats into clean JPG and PNG formats directly on your machine without external web requests.
6. **🖱️ Right-Click Context Menu:** Instant right-click shortcuts to extract media from any page or directly download image/video assets in original master resolution.
7. **📸 Specialized High-Res Parsers:** High-fidelity parsers for Instagram carousels & reels, TikTok clean videos, and Pinterest original master resolutions.

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

1. [Click here to download the extension package (v2.0.0 ZIP)](https://github.com/jahidulislamseo/media-extractor-pro/releases/download/v2.0.0/media-extractor-pro-v2.0.0.zip) (or grab it from the [Releases page](https://github.com/jahidulislamseo/media-extractor-pro/releases)).
2. Extract (unzip) the downloaded file on your computer. You will get the extension files.
3. Open Google Chrome (or Edge / Brave / Opera).
4. In the address bar, type **`chrome://extensions`** and press **Enter**.
5. Turn **ON** the **"Developer mode"** toggle in the top-right corner.
6. Click the **"Load unpacked"** button in the top-left corner.
7. Select the unzipped folder (the folder containing `manifest.json`).
8. Done! The extension icon will appear in your browser toolbar. Click the puzzle icon 🧩 and pin **Media Extractor Pro** for quick access.

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
