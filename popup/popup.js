/* =============================================
   Media Extractor Pro — popup.js
   Full Powerhouse Suite v2.0.0
   1. One-Click Bulk "Download as ZIP" (JSZip 3.10.1)
   2. Auto-Scroll & Deep Scraper Engine
   3. Audio / MP3 Extractor Tab
   4. Smart Dimension / Resolution Slider
   5. Offline Canvas Image Format Transcoder
   6. High-Res Platform Parsers (Instagram, TikTok, Pinterest)
   ============================================= */
'use strict';

const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico', 'tiff'];
const videoExts = ['mp4', 'webm', 'ogv', 'mov', 'm4v', '3gp', 'avi', 'flv', 'mkv'];
const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'wma', 'aiff'];

// ── State ─────────────────────────────────────
let allImages       = [];
let allVideos       = [];
let allAudios       = [];
let filteredMedia   = [];
let selected        = new Set();
let currentTab      = 'images'; // 'images' | 'videos' | 'audios'
let activeImgType   = 'all';
let activeVidType   = 'all';
let activeAudType   = 'all';
let isListView      = false;
let currentPreview  = null;
let isAutoScrolling = false;

// ── DOM Refs ──────────────────────────────────
const $ = id => document.getElementById(id);
const gallery            = $('gallery');
const imageGrid          = $('imageGrid');
const stateLoading       = $('stateLoading');
const stateEmpty         = $('stateEmpty');
const countNum           = $('countNum');
const selCount           = $('selCount');
const searchInput        = $('searchInput');
const clearSearch        = $('clearSearch');
const imageTypeFilters   = $('imageTypeFilters');
const videoTypeFilters   = $('videoTypeFilters');
const audioTypeFilters   = $('audioTypeFilters');
const sizeFilter         = $('sizeFilter');
const sortBy             = $('sortBy');
const selectAll          = $('selectAll');
const downloadBtn        = $('downloadBtn');
const downloadLabel      = $('downloadLabel');
const downloadZipBtn     = $('downloadZipBtn');
const copyUrlsBtn        = $('copyUrlsBtn');
const exportCsvBtn       = $('exportCsvBtn');
const autoScrollBtn      = $('autoScrollBtn');
const optionsToggle      = $('optionsToggle');
const optionsPanel       = $('optionsPanel');
const subfolderInput     = $('subfolderInput');
const renamePatternInput = $('renamePatternInput');
const dimSlider          = $('dimSlider');
const dimSliderVal       = $('dimSliderVal');
const convertWebpCheck   = $('convertWebpCheck');
const viewToggle         = $('viewToggle');
const refreshBtn         = $('refreshBtn');
const toast              = $('toast');
const modal              = $('modal');
const modalBg            = $('modalBg');
const modalClose         = $('modalClose');

// Modal Preview Elements
const previewImg         = $('previewImg');
const previewVideo       = $('previewVideo');
const previewAudio       = $('previewAudio');
const previewIframe      = $('previewIframe');
const modalMeta          = $('modalMeta');
const modalUrl           = $('modalUrl');
const modalCopy          = $('modalCopy');
const modalDownload      = $('modalDownload');
const modalCopySvg       = $('modalCopySvg');
const modalSaveJpg       = $('modalSaveJpg');
const modalSavePng       = $('modalSavePng');
const modalOpenTab       = $('modalOpenTab');

// Tabs
const tabImages          = $('tabImages');
const tabVideos          = $('tabVideos');
const tabAudios          = $('tabAudios');
const tabImgCount        = $('tabImgCount');
const tabVidCount        = $('tabVidCount');
const tabAudCount        = $('tabAudCount');

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupListeners();
  try {
    const manifest = chrome.runtime.getManifest();
    $('aboutAppVer').innerHTML = `Version ${manifest.version} &nbsp;·&nbsp; Manifest V3`;
  } catch {}
  scanPage();

  // Listen for live scroll updates and deep scraper progress
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'updateBadge') {
      const total = allImages.length + allVideos.length + allAudios.length;
      if (msg.count !== total) {
        scanPage(true); // silent rescan without jarring spinner
      }
    } else if (msg.action === 'autoScrollProgress') {
      scanPage(true);
      showToast(`Auto-scrolling: Step #${msg.step} (Found ${msg.count || (allImages.length + allVideos.length + allAudios.length)} items)`, 'ok');
    } else if (msg.action === 'autoScrollComplete') {
      setAutoScrollActive(false);
      showToast('🎉 Auto-scrolling reached the end of page!', 'ok');
      scanPage(true);
    }
  });
});

async function scanPage(silent = false) {
  if (!silent) {
    showState('loading');
    refreshBtn.classList.add('spinning');
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id || !tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('view-source:') ||
        tab.url.startsWith('about:') ||
        tab.url.includes('chromewebstore.google.com')) {
      showState('empty');
      return;
    }

    // Inject content script if not already present
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    }).catch(() => {});

    await sleep(200);

    const resp = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractMedia' }, res => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(res);
      });
    });

    if (resp) {
      allImages = resp.images || [];

      // Deduplicate videos by entity hash or clean URL
      const seenVideoKeys = new Set();
      allVideos = (resp.videos || []).filter(v => {
        if (!v || !v.url) return false;
        let key = v.url.split('?')[0];
        const m = v.url.match(/([0-9a-f]{32})/i);
        if (m) key = 'pin_' + m[1].toLowerCase();
        if (seenVideoKeys.has(key)) return false;
        seenVideoKeys.add(key);
        return true;
      });

      // Audio tracks
      const seenAudioKeys = new Set();
      allAudios = (resp.audios || []).filter(a => {
        if (!a || !a.url) return false;
        const key = a.url.split('?')[0];
        if (seenAudioKeys.has(key)) return false;
        seenAudioKeys.add(key);
        return true;
      });

      // Auto-scroll indicator sync
      if (typeof resp.isAutoScrolling === 'boolean') {
        setAutoScrollActive(resp.isAutoScrolling);
      }

      // Download restriction for streaming platforms (e.g. YouTube)
      setDownloadRestricted(!!resp.downloadRestricted);

      // Update badge count
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        count: allImages.length + allVideos.length + allAudios.length
      }).catch(() => {});

      updateTabCounts();

      // Resolve image dimensions in background for precise filtering
      resolveDimensions(allImages).then(() => {
        if (currentTab === 'images') applyFilters();
      });

      applyFilters();
    } else {
      showState('empty');
    }
  } catch (err) {
    console.warn('[MEP] scan error:', err.message || err);
    showState('empty');
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

// ── Download Restriction (streaming platforms) ─
let downloadIsRestricted = false;

function setDownloadRestricted(restricted) {
  downloadIsRestricted = restricted;

  let banner = document.getElementById('restrictedBanner');
  if (restricted) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'restrictedBanner';
      banner.style.cssText = [
        'background: linear-gradient(135deg, #f59e0b, #d97706)',
        'color: #fff',
        'font-size: 11px',
        'font-weight: 600',
        'padding: 7px 12px',
        'text-align: center',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'gap: 6px',
        'border-radius: 6px',
        'margin: 8px 12px 0',
        'letter-spacing: 0.01em'
      ].join(';');
      banner.innerHTML = '⚠️ Downloads disabled on this platform (Terms of Service)';
      gallery.parentNode.insertBefore(banner, gallery);
    }
    banner.style.display = 'flex';

    downloadBtn.disabled = true;
    downloadBtn.style.opacity = '0.4';
    downloadZipBtn.disabled = true;
    downloadZipBtn.style.opacity = '0.4';
    copyUrlsBtn.disabled = true;
    copyUrlsBtn.style.opacity = '0.4';
  } else {
    if (banner) banner.style.display = 'none';
    downloadBtn.disabled = false;
    downloadBtn.style.opacity = '';
    downloadZipBtn.disabled = false;
    downloadZipBtn.style.opacity = '';
    copyUrlsBtn.disabled = false;
    copyUrlsBtn.style.opacity = '';
  }
}

// ── Tab Count Badges ─────────────────────────
function updateTabCounts() {
  tabImgCount.textContent = allImages.length > 0 ? allImages.length : '';
  tabVidCount.textContent = allVideos.length > 0 ? allVideos.length : '';
  tabAudCount.textContent = allAudios.length > 0 ? allAudios.length : '';
}

// ── Dimension Resolver for Images ─────────────
function resolveDimensions(images) {
  const needDims = images.filter(i => !i.width || !i.height);
  if (!needDims.length) return Promise.resolve();

  const BATCH = 8, TIMEOUT = 2500;
  let i = 0;

  async function next() {
    if (i >= needDims.length) return;
    const batch = needDims.slice(i, i + BATCH);
    i += BATCH;

    await Promise.all(batch.map(img => new Promise(res => {
      const el = new Image();
      el.onload = () => { img.width = el.naturalWidth; img.height = el.naturalHeight; res(); };
      el.onerror = res;
      el.src = img.url;
      setTimeout(res, TIMEOUT);
    })));

    if (currentTab === 'images') applyFilters(true);
    await next();
  }
  return next();
}

// ── Filters & Sort ────────────────────────────
function applyFilters(silent = false) {
  let result = [];
  if (currentTab === 'images') result = [...allImages];
  else if (currentTab === 'videos') result = [...allVideos];
  else result = [...allAudios];

  const q = searchInput.value.trim().toLowerCase();

  // Keyword / URL Search
  if (q) {
    result = result.filter(item => {
      const urlMatch = item.url.toLowerCase().includes(q);
      const textMatch = currentTab === 'images'
        ? (item.alt && item.alt.toLowerCase().includes(q))
        : (item.title && item.title.toLowerCase().includes(q));
      return urlMatch || textMatch;
    });
    clearSearch.classList.add('visible');
  } else {
    clearSearch.classList.remove('visible');
  }

  // Format Type Filters
  if (currentTab === 'images') {
    if (activeImgType !== 'all') {
      result = result.filter(i => {
        const ext = i.type || getExt(i.url);
        if (activeImgType === 'jpg') return ext === 'jpg' || ext === 'jpeg';
        return ext === activeImgType;
      });
    }
  } else if (currentTab === 'videos') {
    if (activeVidType !== 'all') {
      result = result.filter(v => {
        const ext = v.type || getExt(v.url);
        return ext === activeVidType;
      });
    }
  } else {
    if (activeAudType !== 'all') {
      result = result.filter(a => {
        const ext = a.type || getExt(a.url);
        return ext === activeAudType;
      });
    }
  }

  // Dimension Slider Filter (applies to images & videos)
  const sliderPx = parseInt(dimSlider?.value) || 0;
  if (sliderPx > 0 && currentTab !== 'audios') {
    result = result.filter(item => {
      const maxDim = Math.max(item.width || 0, item.height || 0);
      return maxDim >= sliderPx;
    });
  }

  // Dropdown Size Filter
  const minPx = parseInt(sizeFilter.value) || 0;
  if (minPx > 0 && currentTab !== 'audios') {
    result = result.filter(item => (item.width >= minPx || item.height >= minPx));
  }

  // Sorting
  const sort = sortBy.value;
  if (sort === 'dimensions-desc') result.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
  if (sort === 'dimensions-asc')  result.sort((a, b) => ((a.width || 0) * (a.height || 0)) - ((b.width || 0) * (b.height || 0)));
  if (sort === 'type') result.sort((a, b) => (a.type || '').localeCompare(b.type || ''));

  filteredMedia = result;
  countNum.textContent = result.length;

  renderGrid();
  syncSelectAll();
}

// ── Render Gallery ────────────────────────────
function showState(state) {
  stateLoading.style.display = state === 'loading' ? 'flex' : 'none';
  stateEmpty.style.display   = state === 'empty'   ? 'flex' : 'none';
  imageGrid.style.display    = state === 'grid'    ? ''     : 'none';
}

function renderGrid() {
  if (filteredMedia.length === 0) {
    showState('empty');
    return;
  }

  showState('grid');
  imageGrid.className = 'image-grid' + (isListView ? ' list-view' : '');
  imageGrid.innerHTML = '';

  const frag = document.createDocumentFragment();
  filteredMedia.forEach((item, idx) => {
    frag.appendChild(isListView ? createListCard(item, idx) : createGridCard(item, idx));
  });
  imageGrid.appendChild(frag);
}

function createGridCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'img-card fade-in' + (selected.has(item.url) ? ' selected' : '');
  card.dataset.url = item.url;
  card.dataset.idx = idx;

  const isVideo = currentTab === 'videos';
  const isAudio = currentTab === 'audios';
  const typeLabel = (item.type && item.type !== 'unknown') ? item.type.toUpperCase() : getExt(item.url).toUpperCase();
  const dimText   = (item.width && item.height) ? `${item.width}×${item.height}` : (isVideo ? 'Video' : (isAudio ? 'Audio' : ''));
  const isSvgCode = !!item.rawSvg;

  // Audio Grid Card
  if (isAudio) {
    card.innerHTML = `
      <div class="audio-card-body">
        <div class="audio-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <div class="audio-title-label" title="${esc(item.title || item.url)}">${esc(item.title || 'Audio Track')}</div>
        <audio class="audio-player-mini" src="${esc(item.url)}" preload="none" controls></audio>
      </div>
      <span class="type-badge">${esc(typeLabel)}</span>
      <input type="checkbox" class="card-cb" ${selected.has(item.url) ? 'checked' : ''} />
      <div class="card-btns">
        <button class="card-btn dl-btn" title="Download Audio">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5h3V4h4v7h3l-5 5z"/><path d="M19 19H5v2h14v-2z"/></svg>
        </button>
        <button class="card-btn cp-btn" title="Copy URL">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
      </div>
    `;

    wireCardEvents(card, item);
    return card;
  }

  // Thumbnail selection
  let thumbSrc = item.url;
  if (isVideo) {
    thumbSrc = item.thumbnail || '';
    if (thumbSrc.includes('.0000000.jpg')) {
      thumbSrc = thumbSrc.replace('.0000000.jpg', '.0000001.jpg');
    }
  }

  const videoOverlay = isVideo ? `
    <div class="video-play-indicator" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.15);">
      <svg viewBox="0 0 24 24" fill="currentColor" style="width:28px; height:28px; color:white; filter:drop-shadow(0 2px 8px rgba(0,0,0,0.5));">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </div>` : '';

  const dlBtnHtml = `<button class="card-btn dl-btn" title="Download">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5h3V4h4v7h3l-5 5z"/><path d="M19 19H5v2h14v-2z"/></svg>
       </button>`;

  const copySvgBtnHtml = isSvgCode ? `
    <button class="card-btn svg-btn" title="Copy SVG Code">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>
    </button>` : '';

  const mediaElHtml = (isVideo && !thumbSrc)
    ? `<video src="${esc(item.url)}#t=0.5" preload="metadata" muted playsinline style="width:100%; height:100%; object-fit:cover; position:absolute; inset:0; pointer-events:none;"></video>`
    : `<img src="${esc(thumbSrc || item.url)}" alt="${esc(item.title || item.alt || 'Media')}" loading="lazy" />`;

  card.innerHTML = `
    ${mediaElHtml}
    ${videoOverlay}
    <div class="card-overlay">
      <div class="card-dim">${dimText}</div>
    </div>
    <span class="type-badge">${esc(typeLabel)}</span>
    <input type="checkbox" class="card-cb" ${selected.has(item.url) ? 'checked' : ''} />
    <div class="card-alt-badge" title="${esc(item.title || item.alt || (isVideo ? 'Video' : '(No Alt Text)'))}">${esc(item.title || item.alt || (isVideo ? 'Video' : '(No Alt Text)'))}</div>
    <div class="card-btns">
      ${dlBtnHtml}
      ${copySvgBtnHtml}
      <button class="card-btn cp-btn" title="Copy URL">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z"/></svg>
      </button>
    </div>`;

  const imgEl = card.querySelector('img');
  if (imgEl) {
    imgEl.onerror = function () {
      if (isVideo) {
        const vidPreview = document.createElement('video');
        vidPreview.src = item.url + '#t=0.5';
        vidPreview.muted = true;
        vidPreview.playsInline = true;
        vidPreview.preload = 'metadata';
        vidPreview.style.cssText = 'width:100%; height:100%; object-fit:cover; position:absolute; inset:0; pointer-events:none;';
        this.replaceWith(vidPreview);
      } else {
        this.parentElement.classList.add('broken');
      }
    };
  }

  wireCardEvents(card, item);
  return card;
}

function createListCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'img-card fade-in' + (selected.has(item.url) ? ' selected' : '');
  card.dataset.url = item.url;
  card.dataset.idx = idx;

  const isVideo = currentTab === 'videos';
  const isAudio = currentTab === 'audios';
  const typeLabel = (item.type && item.type !== 'unknown') ? item.type.toUpperCase() : getExt(item.url).toUpperCase();
  const dimText   = (item.width && item.height) ? `${item.width} × ${item.height}px` : (isVideo ? 'Video file' : (isAudio ? 'Audio file' : 'Unknown size'));
  const displayName = (isVideo || isAudio) ? (item.title || item.url) : item.url;
  const shortName  = displayName.length > 55 ? displayName.substring(0, 52) + '…' : displayName;
  const isSvgCode = !!item.rawSvg;

  let thumbSrc = item.url;
  if (isVideo) {
    thumbSrc = item.thumbnail || '';
    if (thumbSrc.includes('.0000000.jpg')) {
      thumbSrc = thumbSrc.replace('.0000000.jpg', '.0000001.jpg');
    }
  }

  const dlBtnHtml = `<button class="card-btn dl-btn" title="Download">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5h3V4h4v7h3l-5 5z"/><path d="M19 19H5v2h14v-2z"/></svg>
       </button>`;

  const copySvgBtnHtml = isSvgCode ? `
    <button class="card-btn svg-btn" title="Copy SVG Code">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>
    </button>` : '';

  let listMediaHtml = '';
  if (isAudio) {
    listMediaHtml = `
      <div style="width:48px; height:48px; border-radius:6px; background:var(--pg); display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
      </div>`;
  } else if (isVideo && !thumbSrc) {
    listMediaHtml = `<video src="${esc(item.url)}#t=0.5" preload="metadata" muted playsinline style="width:48px; height:48px; object-fit:cover; border-radius:4px; pointer-events:none;"></video>`;
  } else {
    listMediaHtml = `<img src="${esc(thumbSrc || item.url)}" alt="${esc(item.title || item.alt || 'Media')}" loading="lazy" />`;
  }

  card.innerHTML = `
    <input type="checkbox" class="card-cb" ${selected.has(item.url) ? 'checked' : ''} />
    ${listMediaHtml}
    <div class="list-info">
      <div class="list-url">${esc(shortName)}</div>
      <div class="list-dim">${dimText}</div>
      <div class="list-alt ${item.title || item.alt ? 'has-alt' : 'no-alt'}">${esc(item.title || (item.alt ? 'Alt: ' + item.alt : (isVideo ? 'Video' : (isAudio ? 'Audio Track' : '(No Alt Text)'))))}</div>
    </div>
    <span class="type-badge">${esc(typeLabel)}</span>
    <div class="card-btns">
      ${dlBtnHtml}
      ${copySvgBtnHtml}
      <button class="card-btn cp-btn" title="Copy URL">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z"/></svg>
      </button>
    </div>`;

  wireCardEvents(card, item);
  return card;
}

function wireCardEvents(card, item) {
  card.addEventListener('click', e => {
    if (e.target.matches('.card-cb') || e.target.closest('.card-btn') || e.target.tagName === 'AUDIO') return;
    openPreview(item);
  });
  card.querySelector('.card-cb').addEventListener('click', e => {
    e.stopPropagation();
    toggleSelect(item.url, card, card.querySelector('.card-cb'));
  });

  const dlBtn = card.querySelector('.dl-btn');
  if (downloadIsRestricted) {
    dlBtn.disabled = true;
    dlBtn.style.opacity = '0.35';
    dlBtn.title = 'Download disabled on streaming platform';
  }
  dlBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (downloadIsRestricted) {
      showToast('Downloads not allowed on this platform', 'err');
      return;
    }
    downloadSingle(item.url);
  });

  const svgBtn = card.querySelector('.svg-btn');
  if (svgBtn) {
    svgBtn.addEventListener('click', e => {
      e.stopPropagation();
      copyText(item.rawSvg, 'SVG Code copied!');
    });
  }

  card.querySelector('.cp-btn').addEventListener('click', e => {
    e.stopPropagation();
    copyText(item.url, 'URL copied!');
  });
}

// ── Selection ─────────────────────────────────
function toggleSelect(url, card, cb) {
  if (selected.has(url)) {
    selected.delete(url);
    card.classList.remove('selected');
    cb.checked = false;
  } else {
    selected.add(url);
    card.classList.add('selected');
    cb.checked = true;
  }
  updateSelCount();
  syncSelectAll();
}

function updateSelCount() {
  const n = selected.size;
  selCount.textContent = n > 0 ? `${n} selected` : '0 selected';
  downloadLabel.textContent = n > 0 ? `Download ${n}` : 'Download All';
}

function syncSelectAll() {
  const visibleSelected = filteredMedia.filter(i => selected.has(i.url)).length;
  const total = filteredMedia.length;
  selectAll.checked       = total > 0 && visibleSelected === total;
  selectAll.indeterminate = visibleSelected > 0 && visibleSelected < total;
}

// ── Tabs Switching ────────────────────────────
function switchTab(tabName) {
  if (currentTab === tabName) return;
  currentTab = tabName;
  selected.clear();
  updateSelCount();

  tabImages.classList.toggle('active', tabName === 'images');
  tabVideos.classList.toggle('active', tabName === 'videos');
  tabAudios.classList.toggle('active', tabName === 'audios');

  imageTypeFilters.style.display = tabName === 'images' ? '' : 'none';
  videoTypeFilters.style.display = tabName === 'videos' ? '' : 'none';
  audioTypeFilters.style.display = tabName === 'audios' ? '' : 'none';

  applyFilters();
}

// ── Auto-Scroll & Deep Feed Scraper Control ───
function setAutoScrollActive(active) {
  isAutoScrolling = active;
  autoScrollBtn.classList.toggle('active', active);
  autoScrollBtn.title = active ? 'Stop Auto-Scroll Deep Scraper' : 'Auto-Scroll Deep Feed (Infinite Scraper)';
}

async function toggleAutoScroll() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  if (!isAutoScrolling) {
    setAutoScrollActive(true);
    showToast('🚀 Deep Scraper active! Auto-scrolling feed...', 'ok');
    chrome.tabs.sendMessage(tab.id, { action: 'startAutoScroll', options: { distance: 700, interval: 900 } }).catch(() => {});
  } else {
    setAutoScrollActive(false);
    showToast('⏸️ Auto-scrolling stopped', 'ok');
    chrome.tabs.sendMessage(tab.id, { action: 'stopAutoScroll' }).catch(() => {});
    scanPage(true);
  }
}

// ── Offline Canvas Format Converter ───────────
async function convertImageBlob(blob, targetFormat = 'image/jpeg', quality = 0.95) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      // Solid white background for JPG conversion of transparent PNG/WebP
      if (targetFormat === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(b => {
        if (b) resolve(b);
        else reject(new Error('Canvas conversion failed'));
      }, targetFormat, quality);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

// ── Listeners ─────────────────────────────────
function setupListeners() {
  // Tabs
  tabImages.addEventListener('click', () => switchTab('images'));
  tabVideos.addEventListener('click', () => switchTab('videos'));
  tabAudios.addEventListener('click', () => switchTab('audios'));

  // Auto-Scroll Deep Scraper
  autoScrollBtn.addEventListener('click', toggleAutoScroll);

  // Search
  searchInput.addEventListener('input', () => applyFilters());
  clearSearch.addEventListener('click', () => { searchInput.value = ''; applyFilters(); });

  // Type Filters (Images)
  imageTypeFilters.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      imageTypeFilters.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeImgType = btn.dataset.type;
      applyFilters();
    });
  });

  // Type Filters (Videos)
  videoTypeFilters.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      videoTypeFilters.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeVidType = btn.dataset.type;
      applyFilters();
    });
  });

  // Type Filters (Audios)
  audioTypeFilters.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      audioTypeFilters.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeAudType = btn.dataset.type;
      applyFilters();
    });
  });

  // Dimension Slider
  if (dimSlider) {
    dimSlider.addEventListener('input', () => {
      const val = parseInt(dimSlider.value);
      dimSliderVal.textContent = val === 0 ? 'All sizes' : `≥ ${val}px`;
      applyFilters(true);
    });
  }

  sizeFilter.addEventListener('change', () => applyFilters());
  sortBy.addEventListener('change', () => applyFilters());

  selectAll.addEventListener('change', () => {
    if (selectAll.checked) filteredMedia.forEach(i => selected.add(i.url));
    else filteredMedia.forEach(i => selected.delete(i.url));
    renderGrid();
    updateSelCount();
  });

  viewToggle.addEventListener('click', () => {
    isListView = !isListView;
    viewToggle.title = isListView ? 'Grid view' : 'List view';
    renderGrid();
  });

  refreshBtn.addEventListener('click', () => {
    selected.clear();
    updateSelCount();
    scanPage();
  });

  optionsToggle.addEventListener('click', () => {
    optionsPanel.classList.toggle('open');
    optionsToggle.classList.toggle('active');
  });

  downloadBtn.addEventListener('click', handleDownloadAll);
  downloadZipBtn.addEventListener('click', handleDownloadZip);
  copyUrlsBtn.addEventListener('click', handleCopyUrls);
  exportCsvBtn.addEventListener('click', handleExportCsv);

  // Modal Actions
  modalClose.addEventListener('click', closePreview);
  modalBg.addEventListener('click', closePreview);
  modalDownload.addEventListener('click', () => {
    if (currentPreview) downloadSingle(currentPreview.url);
  });
  modalCopy.addEventListener('click', () => {
    if (currentPreview) copyText(currentPreview.url, 'URL copied!');
  });
  modalOpenTab.addEventListener('click', () => {
    if (currentPreview) chrome.tabs.create({ url: currentPreview.url });
  });

  // Offline Format Converters
  modalSaveJpg.addEventListener('click', async () => {
    if (!currentPreview) return;
    try {
      showToast('Converting to clean JPG...', 'ok');
      const res = await fetch(currentPreview.url);
      const blob = await res.blob();
      const jpgBlob = await convertImageBlob(blob, 'image/jpeg', 0.95);
      const reader = new FileReader();
      reader.onloadend = () => {
        const baseName = getFilename(currentPreview.url).replace(/\.[^.]+$/, '');
        chrome.downloads.download({
          url: reader.result,
          filename: `media-extractor-pro/${baseName}.jpg`,
          saveAs: false
        });
        showToast('Saved pristine JPG!', 'ok');
      };
      reader.readAsDataURL(jpgBlob);
    } catch {
      showToast('Failed to convert image', 'err');
    }
  });

  modalSavePng.addEventListener('click', async () => {
    if (!currentPreview) return;
    try {
      showToast('Converting to lossless PNG...', 'ok');
      const res = await fetch(currentPreview.url);
      const blob = await res.blob();
      const pngBlob = await convertImageBlob(blob, 'image/png');
      const reader = new FileReader();
      reader.onloadend = () => {
        const baseName = getFilename(currentPreview.url).replace(/\.[^.]+$/, '');
        chrome.downloads.download({
          url: reader.result,
          filename: `media-extractor-pro/${baseName}.png`,
          saveAs: false
        });
        showToast('Saved lossless PNG!', 'ok');
      };
      reader.readAsDataURL(pngBlob);
    } catch {
      showToast('Failed to convert image', 'err');
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePreview();
      closeAboutPanel();
    }
  });

  // About Panel
  const infoBtn    = $('infoBtn');
  const aboutPanel = $('aboutPanel');
  const aboutClose = $('aboutClose');

  function openAboutPanel() {
    aboutPanel.classList.add('open');
    infoBtn.classList.add('active');
  }
  function closeAboutPanel() {
    aboutPanel.classList.remove('open');
    infoBtn.classList.remove('active');
  }

  infoBtn.addEventListener('click', () => {
    if (aboutPanel.classList.contains('open')) closeAboutPanel();
    else openAboutPanel();
  });
  aboutClose.addEventListener('click', closeAboutPanel);

  document.addEventListener('click', e => {
    if (
      aboutPanel.classList.contains('open') &&
      !aboutPanel.contains(e.target) &&
      e.target !== infoBtn &&
      !infoBtn.contains(e.target)
    ) {
      closeAboutPanel();
    }
  });

  $('linkHome').addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://www.unifiedtoolspro.xyz/' });
  });
  $('linkSupport').addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/jahidulislamseo/media-extractor-pro' });
  });
  $('linkRate').addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/edeandmopjnajlgijafaajopdbleoklj' });
  });
  $('linkPrivacy').addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/jahidulislamseo/media-extractor-pro/blob/master/PRIVACY.md' });
  });
}

// ── Download Handling ─────────────────────────
async function handleDownloadAll() {
  const toDownload = selected.size > 0
    ? filteredMedia.filter(i => selected.has(i.url))
    : filteredMedia;

  if (!toDownload.length) { showToast('No download-eligible media', 'err'); return; }

  showProgressToast(0, toDownload.length);

  for (let i = 0; i < toDownload.length; i++) {
    await downloadSingle(toDownload[i].url, i + 1);
    showProgressToast(i + 1, toDownload.length);
    if (i < toDownload.length - 1) await sleep(280);
  }
}

// ── One-Click Bulk "Download as ZIP" ──────────
async function handleDownloadZip() {
  if (typeof JSZip === 'undefined') {
    showToast('ZIP library loading...', 'err');
    return;
  }

  const toDownload = selected.size > 0
    ? filteredMedia.filter(i => selected.has(i.url))
    : filteredMedia;

  if (!toDownload.length) { showToast('No media selected for ZIP', 'err'); return; }

  const zip = new JSZip();
  const subfolder = subfolderInput?.value.trim() || 'media-extractor-pro';
  const shouldConvertWebp = convertWebpCheck?.checked || false;

  showProgressToast(0, toDownload.length, 'Packaging ZIP archive...');

  let addedCount = 0;
  for (let i = 0; i < toDownload.length; i++) {
    const item = toDownload[i];
    let downloadUrl = item.url;

    // Resolve Pinterest alternative if needed
    if (downloadUrl.includes('pinimg.com/videos')) {
      const alts = getPinterestAlternativeUrls(downloadUrl);
      for (const alt of alts) {
        try {
          const resp = await fetch(alt, { method: 'HEAD' });
          const ctype = resp.headers.get('content-type') || '';
          if (resp.ok && (ctype.includes('video') || ctype.includes('octet-stream') || !ctype.includes('xml'))) {
            downloadUrl = alt;
            break;
          }
        } catch {}
      }
    }

    try {
      const resp = await fetch(downloadUrl);
      if (!resp.ok) continue;

      let blob = await resp.blob();
      let originalFilename = getFilename(downloadUrl);
      let ext = getExt(downloadUrl);

      // Offline WebP/AVIF to JPG transcoding inside ZIP
      if (shouldConvertWebp && (ext === 'webp' || ext === 'avif')) {
        try {
          blob = await convertImageBlob(blob, 'image/jpeg', 0.95);
          originalFilename = originalFilename.replace(/\.(webp|avif)$/i, '.jpg');
        } catch {}
      }

      if (currentTab === 'videos' && (ext === 'unknown' || ext === 'cmfv' || ext === 'bin')) {
        originalFilename = originalFilename.replace(/\.[^.]+$/, '') + '.mp4';
      }

      zip.file(originalFilename, blob);
      addedCount++;
    } catch {}

    showProgressToast(i + 1, toDownload.length, `Archiving: ${i + 1} / ${toDownload.length}`);
    if (i < toDownload.length - 1) await sleep(50);
  }

  if (addedCount === 0) {
    showToast('Failed to fetch media for ZIP', 'err');
    return;
  }

  showToast('Generating final ZIP file...', 'ok');
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

  const reader = new FileReader();
  reader.onloadend = () => {
    chrome.downloads.download({
      url: reader.result,
      filename: `${subfolder}.zip`,
      saveAs: true
    });
    showToast(`🎉 Packaged all ${addedCount} files into ${subfolder}.zip!`, 'ok');
  };
  reader.readAsDataURL(zipBlob);
}

function showProgressToast(current, total, prefix = 'Downloading') {
  const percent = Math.round((current / total) * 100);
  let msg = `${prefix}: ${current} / ${total} (${percent}%)`;
  if (current === total && !prefix.includes('Archiving')) {
    msg = `🎉 Successfully processed all ${total} items!`;
    showToast(msg, 'ok');
  } else {
    toast.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px; width:100%; text-align:left;">
        <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:600;">
          <span>⏳ ${prefix}</span>
          <span>${current}/${total} (${percent}%)</span>
        </div>
        <div style="width:100%; height:4px; background:rgba(255,255,255,0.2); border-radius:2px; overflow:hidden;">
          <div style="width:${percent}%; height:100%; background:#fff; transition:width 0.2s ease;"></div>
        </div>
      </div>
    `;
    toast.className = 'toast show';
    clearTimeout(toastTimer);
  }
}

function getPinterestAlternativeUrls(url) {
  if (!url || !url.includes('pinimg.com/videos')) return [];
  const hashMatch = url.match(/([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{32})/i);
  if (!hashMatch) return [];
  const [, p1, p2, p3, hash] = hashMatch;
  const isIht = url.includes('/iht/');
  return isIht ? [
    `https://v1.pinimg.com/videos/iht/expMp4/${p1}/${p2}/${p3}/${hash}_720w.mp4`,
    `https://v1.pinimg.com/videos/mc/720p/${p1}/${p2}/${p3}/${hash}.mp4`,
    `https://v1.pinimg.com/videos/mc/expMp4/${p1}/${p2}/${p3}/${hash}_t1.mp4`
  ] : [
    `https://v1.pinimg.com/videos/mc/720p/${p1}/${p2}/${p3}/${hash}.mp4`,
    `https://v1.pinimg.com/videos/iht/expMp4/${p1}/${p2}/${p3}/${hash}_720w.mp4`,
    `https://v1.pinimg.com/videos/mc/expMp4/${p1}/${p2}/${p3}/${hash}_t1.mp4`
  ];
}

async function downloadSingle(url, index = 1) {
  const subfolder = subfolderInput?.value.trim() || 'media-extractor-pro';
  const renamePattern = renamePatternInput?.value.trim() || '';
  const shouldConvertWebp = convertWebpCheck?.checked || false;

  let downloadUrl = url;
  if (url.includes('pinimg.com/videos')) {
    const alts = getPinterestAlternativeUrls(url);
    for (const alt of alts) {
      try {
        const resp = await fetch(alt, { method: 'HEAD' });
        const ctype = resp.headers.get('content-type') || '';
        if (resp.ok && (ctype.includes('video') || ctype.includes('octet-stream') || !ctype.includes('xml'))) {
          downloadUrl = alt;
          break;
        }
      } catch {}
    }
  }

  let originalFilename = getFilename(downloadUrl);
  let ext = getExt(downloadUrl);

  if (currentTab === 'videos') {
    if (ext === 'unknown' || ext === 'png' || ext === 'cmfv' || ext === 'bin') ext = 'mp4';
    originalFilename = originalFilename.replace(/\.(cmfv|cmfa|bin|unknown)$/i, '.mp4');
    if (!originalFilename.toLowerCase().endsWith('.mp4') && !originalFilename.toLowerCase().endsWith('.webm')) {
      originalFilename += '.mp4';
    }
  } else if (currentTab === 'audios') {
    if (ext === 'unknown' || ext === 'bin') ext = 'mp3';
    originalFilename = originalFilename.replace(/\.(bin|unknown)$/i, '.mp3');
  } else {
    if (ext === 'unknown') ext = 'png';
  }

  // Handle WebP to JPG transcoding on download
  if (shouldConvertWebp && (ext === 'webp' || ext === 'avif')) {
    try {
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      const jpgBlob = await convertImageBlob(blob, 'image/jpeg', 0.95);
      const reader = new FileReader();
      reader.onloadend = () => {
        let finalJpgName = originalFilename.replace(/\.(webp|avif)$/i, '.jpg');
        if (renamePattern) {
          finalJpgName = renamePattern.includes('[index]') ? renamePattern.replace(/\[index\]/g, String(index)) + '.jpg' : `${renamePattern}-${index}.jpg`;
        }
        chrome.downloads.download({
          url: reader.result,
          filename: `${subfolder}/${finalJpgName}`,
          saveAs: false
        });
      };
      reader.readAsDataURL(jpgBlob);
      return;
    } catch {}
  }

  let finalFilename = originalFilename;
  if (renamePattern) {
    let formattedPattern = renamePattern;
    if (formattedPattern.includes('[index]')) {
      formattedPattern = formattedPattern.replace(/\[index\]/g, String(index));
    } else {
      formattedPattern = `${formattedPattern}-${index}`;
    }
    finalFilename = `${formattedPattern}.${ext}`;
  }

  const filename = `${subfolder}/${finalFilename}`;
  try {
    await chrome.runtime.sendMessage({ action: 'downloadImage', url: downloadUrl, filename });
  } catch {
    chrome.tabs.create({ url: downloadUrl });
  }
}

// ── Copy URLs ─────────────────────────────────
function handleCopyUrls() {
  const urls = selected.size > 0
    ? filteredMedia.filter(i => selected.has(i.url)).map(i => i.url)
    : filteredMedia.map(i => i.url);

  if (!urls.length) { showToast('No media to copy', 'err'); return; }
  copyText(urls.join('\n'), `${urls.length} link${urls.length !== 1 ? 's' : ''} copied!`);
}

// ── CSV Export ────────────────────────────────
function handleExportCsv() {
  const toExport = selected.size > 0
    ? filteredMedia.filter(i => selected.has(i.url))
    : filteredMedia;

  if (!toExport.length) { showToast('No media to export', 'err'); return; }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "URL,Type,Width,Height,Alt Text / Title\n";

  toExport.forEach(item => {
    const url = item.url.replace(/"/g, '""');
    const type = (item.type || getExt(item.url)).toUpperCase();
    const width = item.width || "";
    const height = item.height || "";
    const alt = (item.alt || item.title || "").replace(/"/g, '""');
    csvContent += `"${url}","${type}","${width}","${height}","${alt}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `extracted-media-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`${toExport.length} items exported to CSV!`, 'ok');
}

function copyText(text, msg) {
  navigator.clipboard.writeText(text)
    .then(() => showToast(msg, 'ok'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast(msg, 'ok');
    });
}

// ── Preview Modal ─────────────────────────────
function openPreview(item) {
  currentPreview = item;

  previewImg.style.display = 'none';
  previewVideo.style.display = 'none';
  previewAudio.style.display = 'none';
  previewIframe.style.display = 'none';
  modalSaveJpg.style.display = 'none';
  modalSavePng.style.display = 'none';

  const isVideo = currentTab === 'videos';
  const isAudio = currentTab === 'audios';
  const isImage = currentTab === 'images';
  const typeLabel = (item.type && item.type !== 'unknown') ? item.type.toUpperCase() : getExt(item.url).toUpperCase();
  const dimText = (item.width && item.height) ? `${item.width} × ${item.height}px` : null;

  if (isAudio) {
    previewAudio.src = item.url;
    previewAudio.style.display = 'block';
    previewAudio.play().catch(() => {});
    modalDownload.textContent = 'Download Audio';
  } else if (isVideo) {
    previewVideo.src = item.url;
    previewVideo.style.display = '';
    previewVideo.load();
    previewVideo.play().catch(() => {});
    modalDownload.textContent = 'Download MP4';
  } else {
    previewImg.src = item.url;
    previewImg.style.display = '';
    previewImg.onerror = () => { previewImg.alt = 'Could not load image'; };
    modalDownload.textContent = 'Download';

    // Enable offline format conversion buttons
    modalSaveJpg.style.display = '';
    modalSavePng.style.display = '';
  }

  if (item.rawSvg) {
    modalCopySvg.style.display = '';
    modalCopySvg.onclick = () => copyText(item.rawSvg, 'SVG Code copied!');
  } else {
    modalCopySvg.style.display = 'none';
  }

  modalMeta.innerHTML = `
    <span class="meta-pill">🏷️ ${esc(typeLabel)}</span>
    ${dimText ? `<span class="meta-pill">📐 ${dimText}</span>` : ''}
    <span class="meta-pill">🔗 ${esc(item.source || 'source')}</span>
    <div class="meta-alt-pill ${item.alt || item.title ? 'has-alt' : 'no-alt'}">
      <span>📝 Alt/Title:</span>
      <strong>${esc(item.alt || item.title || '(None)')}</strong>
    </div>
  `;
  modalUrl.textContent = item.url;
  modal.classList.add('open');
}

function closePreview() {
  modal.classList.remove('open');
  modalCopySvg.onclick = null;

  previewImg.src = '';
  previewVideo.pause();
  previewVideo.src = '';
  previewAudio.pause();
  previewAudio.src = '';
  previewIframe.src = '';

  currentPreview = null;
}

// ── Toast ─────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className   = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ── Helpers ───────────────────────────────────
function getFilename(url) {
  try {
    const name = url.split('?')[0].split('/').pop();
    if (name && /\.\w{2,5}$/.test(name)) return name;
  } catch {}
  return `file_${Date.now()}.${getExt(url) !== 'unknown' ? getExt(url) : 'bin'}`;
}

function getExt(url) {
  try {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    return [...imageExts, ...videoExts, ...audioExts].includes(ext) ? ext : 'unknown';
  } catch { return 'unknown'; }
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
