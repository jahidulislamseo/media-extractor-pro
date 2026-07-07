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
const modalOpenTab     = $('modalOpenTab');
const modalDownload    = $('modalDownload');

// Tabs
const tabImages        = $('tabImages');
const tabVideos        = $('tabVideos');

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupListeners();
  scanPage();
});

async function scanPage() {
  showState('loading');
  refreshBtn.classList.add('spinning');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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

      // Update badge count
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        count: allImages.length + allVideos.length
      }).catch(() => {});

      // Resolve image dimensions in background
      resolveDimensions(allImages).then(() => {
        if (currentTab === 'images') applyFilters();
      });

      applyFilters();
    } else {
      showState('empty');
    }
  } catch (err) {
    console.error('[MEP] scan error:', err);
    showState('empty');
  } finally {
    refreshBtn.classList.remove('spinning');
  }
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
        if (activeVidType === 'youtube') return ext === 'youtube';
        if (activeVidType === 'vimeo') return ext === 'vimeo';
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

  // Thumbnail selection
  let thumbSrc = item.url;
  if (isVideo) {
    thumbSrc = item.thumbnail || 'https://vimeo.com/assets/images/favicon.ico'; // default placeholder
    if (item.type === 'youtube' && item.thumbnail) {
      thumbSrc = item.thumbnail;
    }
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

  card.innerHTML = `
    <img src="${esc(thumbSrc)}" alt="${esc(item.alt || item.title)}" loading="lazy" />
    ${videoOverlay}
    <div class="card-overlay">
      <div class="card-dim">${dimText}</div>
    </div>
    <span class="type-badge">${esc(typeLabel)}</span>
    <input type="checkbox" class="card-cb" ${selected.has(item.url) ? 'checked' : ''} />
    <div class="card-btns">
      ${dlBtnHtml}
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
  card.querySelector('.dl-btn').addEventListener('click', e => {
    e.stopPropagation();
    downloadSingle(item.url);
  });
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

  let thumbSrc = item.url;
  if (isVideo) {
    thumbSrc = item.thumbnail || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23e2e8f0'/><polygon points='40,30 70,50 40,70' fill='%2364748b'/></svg>";
  }

  const dlBtnHtml = `<button class="card-btn dl-btn" title="Download">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5h3V4h4v7h3l-5 5z"/><path d="M19 19H5v2h14v-2z"/></svg>
       </button>`;

  card.innerHTML = `
    <input type="checkbox" class="card-cb" ${selected.has(item.url) ? 'checked' : ''} />
    <img src="${esc(thumbSrc)}" alt="${esc(item.alt || item.title)}" loading="lazy" />
    <div class="list-info">
      <div class="list-url">${esc(shortName)}</div>
      <div class="list-dim">${dimText}</div>
    </div>
    <span class="type-badge">${esc(typeLabel)}</span>
    <div class="card-btns">
      ${dlBtnHtml}
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

  downloadBtn.addEventListener('click', handleDownloadAll);
  copyUrlsBtn.addEventListener('click', handleCopyUrls);

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

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePreview();
  });
}

// ── Download Handling ─────────────────────────
async function handleDownloadAll() {
  const toDownload = selected.size > 0
    ? filteredMedia.filter(i => selected.has(i.url))
    : filteredMedia;

  if (!toDownload.length) { showToast('No download-eligible media', 'err'); return; }

  showToast(`Downloading ${toDownload.length} item${toDownload.length !== 1 ? 's' : ''}…`, 'ok');

  for (let i = 0; i < toDownload.length; i++) {
    await downloadSingle(toDownload[i].url);
    if (i < toDownload.length - 1) await sleep(300); // delay to prevent download rate limiting
  }
}

async function downloadSingle(url) {
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isVimeo = url.includes('vimeo.com');

  if (isYouTube) {
    showToast('Opening YouTube MP4 Downloader...', 'ok');
    const ytId = getYouTubeId(url);
    const downloadUrl = `https://www.ssyoutube.com/watch?v=${ytId}`;
    chrome.tabs.create({ url: downloadUrl });
    return;
  }

  if (isVimeo) {
    showToast('Opening Vimeo MP4 Downloader...', 'ok');
    const downloadUrl = `https://vimeodownloader.one/?url=${encodeURIComponent(url)}`;
    chrome.tabs.create({ url: downloadUrl });
    return;
  }

  // Direct video/image files (MP4, WebM, JPG, PNG etc.)
  const filename = `media-extractor-pro/${getFilename(url)}`;
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
    if (item.type === 'youtube') {
      // Show HD thumbnail + play overlay (iframe blocked by YouTube in extensions)
      const ytId = getYouTubeId(item.url);
      const thumbUrl = item.thumbnail || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      previewImg.src = thumbUrl;
      previewImg.style.display = '';
      previewImg.style.cursor = 'pointer';
      previewImg.title = 'Click to watch on YouTube';
      previewImg.onclick = () => chrome.tabs.create({ url: item.url });
      // Show play overlay badge
      const wrap = previewImg.closest('.modal-img-wrap');
      wrap.classList.add('yt-thumb-wrap');
    } else if (item.type === 'vimeo') {
      // Show Vimeo thumbnail + play overlay
      const thumbUrl = item.thumbnail || '';
      if (thumbUrl) {
        previewImg.src = thumbUrl;
        previewImg.style.display = '';
        previewImg.style.cursor = 'pointer';
        previewImg.title = 'Click to watch on Vimeo';
        previewImg.onclick = () => chrome.tabs.create({ url: item.url });
        const wrap = previewImg.closest('.modal-img-wrap');
        wrap.classList.add('yt-thumb-wrap');
      } else {
        previewIframe.src = `https://player.vimeo.com/video/${getVimeoId(item.url)}`;
        previewIframe.style.display = '';
      }
    } else {
      // Standard video file
      previewVideo.src = item.url;
      previewVideo.style.display = '';
      previewVideo.load();
      previewVideo.play().catch(() => {});
    }
  } else {
    // Image element
    previewImg.src = item.url;
    previewImg.style.display = '';
    previewImg.onerror = () => { previewImg.alt = 'Could not load image'; };
  }

  // Update button text
  modalDownload.textContent = isVideo ? 'Download MP4' : 'Download';
  modalOpenTab.style.display = '';

  modalMeta.innerHTML = `
    <span class="meta-pill">🏷️ ${esc(typeLabel)}</span>
    ${dimText ? `<span class="meta-pill">📐 ${dimText}</span>` : ''}
    <span class="meta-pill">🔗 ${esc(item.source || 'source')}</span>
  `;
  modalUrl.textContent = item.url;
  modal.classList.add('open');
}

function closePreview() {
  modal.classList.remove('open');
  
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

function getYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function getVimeoId(url) {
  const regExp = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
  const match = url.match(regExp);
  return match ? match[3] : null;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
