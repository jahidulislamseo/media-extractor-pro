/* =============================================
   Media Extractor Pro — popup.js
   ============================================= */
'use strict';

const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico', 'tiff'];
const videoExts = ['mp4', 'webm', 'ogv', 'mov', 'm4v', '3gp', 'avi', 'flv', 'mkv'];

// ── State ─────────────────────────────────────
let allImages      = [];
let allVideos      = [];
let filteredMedia  = [];
let selected       = new Set();
let currentTab     = 'images'; // 'images' or 'videos'
let activeImgType  = 'all';
let activeVidType  = 'all';
let isListView     = false;
let currentPreview = null;

// ── DOM refs ──────────────────────────────────
const $ = id => document.getElementById(id);
const gallery          = $('gallery');
const imageGrid        = $('imageGrid');
const stateLoading     = $('stateLoading');
const stateEmpty       = $('stateEmpty');
const countNum         = $('countNum');
const selCount         = $('selCount');
const searchInput      = $('searchInput');
const clearSearch      = $('clearSearch');
const imageTypeFilters = $('imageTypeFilters');
const videoTypeFilters = $('videoTypeFilters');
const sizeFilter       = $('sizeFilter');
const sortBy           = $('sortBy');
const selectAll        = $('selectAll');
const downloadBtn      = $('downloadBtn');
const downloadLabel    = $('downloadLabel');
const copyUrlsBtn      = $('copyUrlsBtn');
const exportCsvBtn     = $('exportCsvBtn');
const bulkConvertBtn   = $('bulkConvertBtn');
const optionsToggle    = $('optionsToggle');
const optionsPanel     = $('optionsPanel');
const subfolderInput   = $('subfolderInput');
const renamePatternInput = $('renamePatternInput');
const viewToggle       = $('viewToggle');
const refreshBtn       = $('refreshBtn');
const toast            = $('toast');
const modal            = $('modal');
const modalBg          = $('modalBg');
const modalClose       = $('modalClose');

// Modal preview elements
const previewImg       = $('previewImg');
const previewVideo     = $('previewVideo');
const previewIframe    = $('previewIframe');
const modalMeta        = $('modalMeta');
const modalUrl         = $('modalUrl');
const modalCopy        = $('modalCopy');
const modalDownload    = $('modalDownload');
const modalCopySvg     = $('modalCopySvg');
const modalConvert     = $('modalConvert');

// Tabs
const tabImages        = $('tabImages');
const tabVideos        = $('tabVideos');
const tabImgCount      = $('tabImgCount');
const tabVidCount      = $('tabVidCount');

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupListeners();
  try {
    const manifest = chrome.runtime.getManifest();
    $('aboutAppVer').innerHTML = `Version ${manifest.version} &nbsp;·&nbsp; Manifest V3`;
  } catch (err) { /* noop fallback */ }
  scanPage();
});

async function scanPage() {
  showState('loading');
  refreshBtn.classList.add('spinning');

  // Streaming/DRM platforms — extraction not supported
  const BLOCKED_DOMAINS = [
    'youtube.com', 'youtu.be', 'youtube-nocookie.com',
    'netflix.com', 'primevideo.com', 'disneyplus.com',
    'hulu.com', 'hbomax.com', 'max.com', 'peacocktv.com',
    'paramountplus.com', 'espn.com', 'twitch.tv',
    'spotify.com', 'tidal.com', 'deezer.com',
    'soundcloud.com', 'vimeo.com', 'dailymotion.com',
    'bilibili.com', 'crunchyroll.com', 'funimation.com'
  ];

  function isBlockedUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      return BLOCKED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
    } catch { return false; }
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

    // Inject content script if not already there
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    }).catch(() => {});

    await sleep(250);

    const resp = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractMedia' }, res => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(res);
      });
    });

    if (resp) {
      allImages = resp.images || [];
      allVideos = resp.videos || [];

      // Apply download restriction for streaming platforms (e.g. YouTube)
      setDownloadRestricted(!!resp.downloadRestricted);

      // Update badge count
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        count: allImages.length + allVideos.length
      }).catch(() => {});

      // Update tab count badges
      updateTabCounts();

      // Resolve image dimensions in background
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

  // Show/hide restriction notice banner
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
      // Insert before gallery
      gallery.parentNode.insertBefore(banner, gallery);
    }
    banner.style.display = 'flex';

    // Disable all download/copy action buttons
    downloadBtn.disabled = true;
    downloadBtn.style.opacity = '0.4';
    downloadBtn.title = 'Downloads not available on streaming platforms';
    copyUrlsBtn.disabled = true;
    copyUrlsBtn.style.opacity = '0.4';
    exportCsvBtn.disabled = false; // CSV export (URL list) is still OK
  } else {
    if (banner) banner.style.display = 'none';
    downloadBtn.disabled = false;
    downloadBtn.style.opacity = '';
    downloadBtn.title = '';
    copyUrlsBtn.disabled = false;
    copyUrlsBtn.style.opacity = '';
  }
}


// ── Tab Count Badges ─────────────────────────
function updateTabCounts() {
  tabImgCount.textContent = allImages.length > 0 ? allImages.length : '';
  tabVidCount.textContent = allVideos.length > 0 ? allVideos.length : '';
}

// ── Dimension resolver for Images ─────────────
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
  let result = currentTab === 'images' ? [...allImages] : [...allVideos];
  const q = searchInput.value.trim().toLowerCase();

  // Search filter
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

  // Type filter
  if (currentTab === 'images') {
    if (activeImgType !== 'all') {
      result = result.filter(i => {
        const ext = i.type || getExt(i.url);
        if (activeImgType === 'jpg') return ext === 'jpg' || ext === 'jpeg';
        return ext === activeImgType;
      });
    }
  } else {
    if (activeVidType !== 'all') {
      result = result.filter(v => {
        const ext = v.type || getExt(v.url);
        return ext === activeVidType;
      });
    }
  }

  // Size filter (mainly applies to images, or videos with known width)
  const minPx = parseInt(sizeFilter.value) || 0;
  if (minPx > 0) {
    result = result.filter(item => item.width >= minPx || item.height >= minPx);
  }

  // Sorting
  const sort = sortBy.value;
  if (sort === 'dimensions-desc') result.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  if (sort === 'dimensions-asc')  result.sort((a, b) => (a.width * a.height) - (b.width * b.height));
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
  const typeLabel = (item.type && item.type !== 'unknown') ? item.type.toUpperCase() : getExt(item.url).toUpperCase();
  const dimText   = (item.width && item.height) ? `${item.width}×${item.height}` : (isVideo ? 'Video' : '');
  const isSvgCode = !!item.rawSvg;

  // Thumbnail selection
  let thumbSrc = item.url;
  if (isVideo) {
    thumbSrc = item.thumbnail || '../icons/icon128.png'; // default placeholder
  }

  // Play button indicator for video grid items
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
    </button>
  ` : '';

  card.innerHTML = `
    <img src="${esc(thumbSrc)}" alt="${esc(item.alt || item.title)}" loading="lazy" />
    ${videoOverlay}
    <div class="card-overlay">
      <div class="card-dim">${dimText}</div>
    </div>
    <span class="type-badge">${esc(typeLabel)}</span>
    <input type="checkbox" class="card-cb" ${selected.has(item.url) ? 'checked' : ''} />
    <div class="card-alt-badge" title="${esc(item.alt || '(No Alt Text)')}">${esc(item.alt || '(No Alt Text)')}</div>
    <div class="card-btns">
      ${dlBtnHtml}
      ${copySvgBtnHtml}
      <button class="card-btn cp-btn" title="Copy URL">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z"/></svg>
      </button>
    </div>`;

  // Fallback for missing/broken thumbnails
  const imgEl = card.querySelector('img');
  imgEl.onerror = function () {
    if (isVideo) {
      // Fallback default gradient and icon for missing video poster
      this.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23e2e8f0'/><polygon points='40,30 70,50 40,70' fill='%2364748b'/></svg>";
    } else {
      this.parentElement.classList.add('broken');
    }
  };

  card.addEventListener('click', e => {
    if (e.target.matches('.card-cb') || e.target.closest('.card-btn')) return;
    openPreview(item);
  });
  card.querySelector('.card-cb').addEventListener('click', e => {
    e.stopPropagation();
    toggleSelect(item.url, card, card.querySelector('.card-cb'));
  });
  // Disable download button on restricted platforms
  const dlBtn = card.querySelector('.dl-btn');
  if (downloadIsRestricted) {
    dlBtn.disabled = true;
    dlBtn.style.opacity = '0.35';
    dlBtn.title = 'Download disabled (Terms of Service)';
  }
  dlBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (downloadIsRestricted) {
      showToast('Downloads not allowed on this platform', 'err');
      return;
    }
    downloadSingle(item.url);
  });
  if (isSvgCode) {
    card.querySelector('.svg-btn').addEventListener('click', e => {
      e.stopPropagation();
      copyText(item.rawSvg, 'SVG Code copied!');
    });
  }
  card.querySelector('.cp-btn').addEventListener('click', e => {
    e.stopPropagation();
    copyText(item.url, 'URL copied!');
  });

  return card;
}

function createListCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'img-card fade-in' + (selected.has(item.url) ? ' selected' : '');
  card.dataset.url = item.url;
  card.dataset.idx = idx;

  const isVideo = currentTab === 'videos';
  const typeLabel = (item.type && item.type !== 'unknown') ? item.type.toUpperCase() : getExt(item.url).toUpperCase();
  const dimText   = (item.width && item.height) ? `${item.width} × ${item.height}px` : (isVideo ? 'Video file' : 'Unknown size');
  const displayName = isVideo ? (item.title || item.url) : item.url;
  const shortName  = displayName.length > 55 ? displayName.substring(0, 52) + '…' : displayName;
  const isSvgCode = !!item.rawSvg;

  let thumbSrc = item.url;
  if (isVideo) {
    thumbSrc = item.thumbnail || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23e2e8f0'/><polygon points='40,30 70,50 40,70' fill='%2364748b'/></svg>";
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
    </button>
  ` : '';

  card.innerHTML = `
    <input type="checkbox" class="card-cb" ${selected.has(item.url) ? 'checked' : ''} />
    <img src="${esc(thumbSrc)}" alt="${esc(item.alt || item.title)}" loading="lazy" />
    <div class="list-info">
      <div class="list-url">${esc(shortName)}</div>
      <div class="list-dim">${dimText}</div>
      <div class="list-alt ${item.alt ? 'has-alt' : 'no-alt'}">Alt: ${esc(item.alt || '(No Alt Text)')}</div>
    </div>
    <span class="type-badge">${esc(typeLabel)}</span>
    <div class="card-btns">
      ${dlBtnHtml}
      ${copySvgBtnHtml}
      <button class="card-btn cp-btn" title="Copy URL">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z"/></svg>
      </button>
    </div>`;

  card.querySelector('img').onerror = function () {
    this.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23e2e8f0'/><polygon points='40,30 70,50 40,70' fill='%2364748b'/></svg>";
  };

  card.addEventListener('click', e => {
    if (e.target.matches('.card-cb') || e.target.closest('.card-btn')) return;
    openPreview(item);
  });
  card.querySelector('.card-cb').addEventListener('click', e => {
    e.stopPropagation();
    toggleSelect(item.url, card, card.querySelector('.card-cb'));
  });
  card.querySelector('.dl-btn').addEventListener('click', e => {
    e.stopPropagation();
    downloadSingle(item.url);
  });
  if (isSvgCode) {
    card.querySelector('.svg-btn').addEventListener('click', e => {
      e.stopPropagation();
      copyText(item.rawSvg, 'SVG Code copied!');
    });
  }
  card.querySelector('.cp-btn').addEventListener('click', e => {
    e.stopPropagation();
    copyText(item.url, 'URL copied!');
  });

  return card;
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

  if (tabName === 'images') {
    tabImages.classList.add('active');
    tabVideos.classList.remove('active');
    imageTypeFilters.style.display = '';
    videoTypeFilters.style.display = 'none';
  } else {
    tabImages.classList.remove('active');
    tabVideos.classList.add('active');
    imageTypeFilters.style.display = 'none';
    videoTypeFilters.style.display = '';
  }

  applyFilters();
}

// ── Listeners ─────────────────────────────────
function setupListeners() {
  // Tabs
  tabImages.addEventListener('click', () => switchTab('images'));
  tabVideos.addEventListener('click', () => switchTab('videos'));

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
  copyUrlsBtn.addEventListener('click', handleCopyUrls);
  exportCsvBtn.addEventListener('click', handleExportCsv);
  bulkConvertBtn.addEventListener('click', handleBulkConvert);

  // Modal actions
  modalClose.addEventListener('click', closePreview);
  modalBg.addEventListener('click', closePreview);
  modalDownload.addEventListener('click', () => { 
    if (currentPreview) {
      downloadSingle(currentPreview.url); 
    }
  });
  modalCopy.addEventListener('click', () => { if (currentPreview) copyText(currentPreview.url, 'URL copied!'); });
  modalOpenTab.addEventListener('click', () => { if (currentPreview) chrome.tabs.create({ url: currentPreview.url }); });
  modalConvert.addEventListener('click', async () => {
    if (currentPreview) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isLocal = tab && tab.url && tab.url.includes('localhost');
      const baseUrl = isLocal ? 'http://localhost:3000' : 'https://www.unifiedtoolspro.xyz';
      const targetUrl = `${baseUrl}/tools/image-converter?src=${encodeURIComponent(currentPreview.url)}`;
      chrome.tabs.create({ url: targetUrl });
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePreview();
      closeAboutPanel();
    }
  });

  // ── About / Info Panel ──────────────────────
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
    if (aboutPanel.classList.contains('open')) {
      closeAboutPanel();
    } else {
      openAboutPanel();
    }
  });

  aboutClose.addEventListener('click', closeAboutPanel);

  // Close panel when clicking outside of it
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

  // External links (open in new tab)
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
    if (i < toDownload.length - 1) await sleep(300); // delay to prevent download rate limiting
  }
}

function showProgressToast(current, total) {
  const percent = Math.round((current / total) * 100);
  let msg = `Downloading: ${current} / ${total} items (${percent}%)`;
  if (current === total) {
    msg = `🎉 Successfully downloaded all ${total} items!`;
    showToast(msg, 'ok');
  } else {
    toast.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px; width:100%; text-align:left;">
        <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:600;">
          <span>⏳ Downloading...</span>
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

async function downloadSingle(url, index = 1) {
  // Direct video/image files (MP4, WebM, JPG, PNG etc.)
  const subfolder = subfolderInput?.value.trim() || 'media-extractor-pro';
  const renamePattern = renamePatternInput?.value.trim() || '';
  
  let originalFilename = getFilename(url);
  let ext = getExt(url);
  if (ext === 'unknown') ext = 'png'; // fallback
  
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
    await chrome.runtime.sendMessage({ action: 'downloadImage', url, filename });
  } catch {
    chrome.tabs.create({ url }); // fallback
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

  // CSV Headers: URL, Type, Width, Height, Alt Text/Title
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

// ── Bulk Convert Handling ──────────────────────
async function handleBulkConvert() {
  const toConvert = selected.size > 0
    ? filteredMedia.filter(i => selected.has(i.url))
    : filteredMedia;

  if (!toConvert.length) { showToast('No images to convert', 'err'); return; }

  // Filter only images (exclude videos/unknowns)
  const imageItems = toConvert.filter(i => {
    const ext = i.type || getExt(i.url);
    return imageExts.includes(ext);
  });

  if (!imageItems.length) { showToast('No eligible images selected', 'err'); return; }

  showToast(`Sending ${imageItems.length} images to converter...`, 'ok');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isLocal = tab && tab.url && tab.url.includes('localhost');
  const baseUrl = isLocal ? 'http://localhost:3000' : 'https://www.unifiedtoolspro.xyz';
  
  let queryString = `?`;
  imageItems.forEach((item, idx) => {
    if (idx > 0) queryString += `&`;
    queryString += `src=${encodeURIComponent(item.url)}`;
  });
  
  const targetUrl = `${baseUrl}/tools/image-converter${queryString}`;
  chrome.tabs.create({ url: targetUrl });
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
  
  // Hide all modal media components initially
  previewImg.style.display = 'none';
  previewVideo.style.display = 'none';
  previewIframe.style.display = 'none';

  const isVideo = currentTab === 'videos';
  const typeLabel = (item.type && item.type !== 'unknown') ? item.type.toUpperCase() : getExt(item.url).toUpperCase();
  const dimText = (item.width && item.height) ? `${item.width} × ${item.height}px` : null;

  // Render correct media element inside preview modal
  if (isVideo) {
    // Standard video file
    previewVideo.src = item.url;
    previewVideo.style.display = '';
    previewVideo.load();
    previewVideo.play().catch(() => {});
  } else {
    // Image element
    previewImg.src = item.url;
    previewImg.style.display = '';
    previewImg.onerror = () => { previewImg.alt = 'Could not load image'; };
  }

  // Update button text
  modalDownload.textContent = isVideo ? 'Download MP4' : 'Download';
  modalOpenTab.style.display = '';

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
    <div class="meta-alt-pill ${item.alt ? 'has-alt' : 'no-alt'}">
      <span>📝 Alt:</span>
      <strong>${esc(item.alt || '(No Alt Text)')}</strong>
    </div>
  `;
  modalUrl.textContent = item.url;
  modal.classList.add('open');
}

function closePreview() {
  modal.classList.remove('open');
  modalCopySvg.onclick = null;
  
  // Clear/Pause src attributes to stop background sounds
  previewImg.src = '';
  previewImg.style.cursor = '';
  previewImg.onclick = null;
  previewImg.closest('.modal-img-wrap').classList.remove('yt-thumb-wrap');
  
  previewVideo.pause();
  previewVideo.src = '';
  
  previewIframe.src = '';
  modalOpenTab.style.display = '';
  
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
  } catch { /* noop */ }
  return `file_${Date.now()}.${getExt(url) !== 'unknown' ? getExt(url) : 'bin'}`;
}

function getExt(url) {
  try {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    return [...imageExts, ...videoExts].includes(ext) ? ext : 'unknown';
  } catch { return 'unknown'; }
}



function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
