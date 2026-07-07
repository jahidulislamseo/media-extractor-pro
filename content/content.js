// =============================================
// Media Extractor Pro - Content Script
// Runs in the context of the web page
// =============================================

(function () {
  'use strict';

  // Prevent double injection
  if (window.__mediaExtractorProInjected) return;
  window.__mediaExtractorProInjected = true;

  // ─── Helpers ──────────────────────────────
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico', 'tiff'];
  const videoExts = ['mp4', 'webm', 'ogv', 'mov', 'm4v', '3gp', 'avi', 'flv', 'mkv'];

  function getExt(url) {
    try {
      const clean = url.split('?')[0].split('#')[0];
      return clean.split('.').pop().toLowerCase();
    } catch {
      return 'unknown';
    }
  }

  function parseSrcset(srcset) {
    if (!srcset) return [];
    return srcset
      .split(',')
      .map(s => s.trim().split(/\s+/)[0])
      .filter(url => url && (url.startsWith('http') || url.startsWith('//')));
  }

  function resolveUrl(url) {
    if (!url) return null;
    if (url.startsWith('data:')) return null; // skip data URLs
    if (url.startsWith('blob:')) return null; // skip blob URLs
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('http')) return url;
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return null;
    }
  }

  function getYouTubeId(url) {
    if (!url) return null;
    const cleanUrl = url.startsWith('/') ? 'https://www.youtube.com' + url : url;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = cleanUrl.match(regExp);
    return (match && match[2] && match[2].length === 11) ? match[2] : null;
  }

  function getVimeoId(url) {
    const regExp = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
    const match = url.match(regExp);
    return match ? match[3] : null;
  }

  // ─── Image Extractor ───────────────────────
  function extractImages() {
    const map = new Map(); // url → metadata

    function addImage(rawUrl, extra = {}) {
      const url = resolveUrl(rawUrl);
      if (!url || map.has(url)) return;
      const ext = getExt(url);
      if (videoExts.includes(ext)) return; // skip videos here

      map.set(url, {
        url,
        alt: extra.alt || '',
        width: extra.width || 0,
        height: extra.height || 0,
        type: imageExts.includes(ext) ? ext : 'unknown',
        source: extra.source || 'img',
      });
    }

    // 1. <img> tags
    document.querySelectorAll('img').forEach(img => {
      if (img.src) addImage(img.src, {
        alt: img.alt,
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
        source: 'img'
      });

      parseSrcset(img.srcset).forEach(u => addImage(u, {
        alt: img.alt, source: 'srcset'
      }));

      // Lazy loading attributes
      ['data-src', 'data-lazy', 'data-original', 'data-lazy-src'].forEach(attr => {
        const v = img.getAttribute(attr);
        if (v) addImage(v, { alt: img.alt, source: 'lazy' });
      });
    });

    // 2. <picture> source elements
    document.querySelectorAll('picture source').forEach(src => {
      parseSrcset(src.srcset).forEach(u => addImage(u, { source: 'picture' }));
    });

    // 3. <a> links pointing to images
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href;
      if (href && new RegExp(`\\.(${imageExts.join('|')})(\\?|$)`, 'i').test(href)) {
        addImage(href, { source: 'link' });
      }
    });

    // 4. CSS background-image
    const elements = document.querySelectorAll('*');
    let cssCount = 0;
    elements.forEach(el => {
      if (cssCount > 400) return;
      try {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundImage;
        if (bg && bg !== 'none' && bg.includes('url(')) {
          const matches = bg.matchAll(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/g);
          for (const m of matches) {
            addImage(m[1], { source: 'css' });
            cssCount++;
          }
        }
      } catch { /* skip */ }
    });

    // 5. Open Graph / meta tags
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(meta => {
      const content = meta.getAttribute('content');
      if (content) addImage(content, { source: 'meta' });
    });

    return Array.from(map.values());
  }

  // ─── Video Extractor ───────────────────────
  function extractVideos() {
    const map = new Map();

    function addVideo(rawUrl, extra = {}) {
      const url = resolveUrl(rawUrl);
      if (!url || map.has(url)) return;
      const ext = getExt(url);
      const isKnownExt = videoExts.includes(ext);
      const type = extra.type || (isKnownExt ? ext : 'unknown');

      map.set(url, {
        url,
        title: extra.title || '',
        width: extra.width || 0,
        height: extra.height || 0,
        type,
        thumbnail: extra.thumbnail || '',
        source: extra.source || 'video',
      });
    }

    // 1. <video> tags
    document.querySelectorAll('video').forEach(vid => {
      const poster = vid.getAttribute('poster') || '';
      const w = vid.videoWidth || vid.width || 0;
      const h = vid.videoHeight || vid.height || 0;

      if (vid.src) {
        addVideo(vid.src, { source: 'video-tag', thumbnail: poster, width: w, height: h });
      }

      // Inside sources
      vid.querySelectorAll('source').forEach(src => {
        if (src.src) {
          addVideo(src.src, { source: 'video-source', thumbnail: poster, width: w, height: h });
        }
      });
    });

    // 2. Scrape all <a> links for video files & YouTube video links
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!href) return;

      // Check for direct video file links
      if (new RegExp(`\\.(${videoExts.join('|')})(\\?|$)`, 'i').test(href)) {
        const resolved = resolveUrl(href);
        if (resolved) {
          addVideo(resolved, { source: 'link', title: a.textContent.trim() });
        }
        return;
      }

      // Check for YouTube links (homepage, watch page, search results, etc.)
      const ytId = getYouTubeId(href);
      if (ytId) {
        let title = '';
        
        // Find title container on YouTube desktop layout
        const titleEl = a.closest('ytd-rich-grid-media, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer')
          ?.querySelector('#video-title, #video-title-link, .title');
          
        if (titleEl) {
          title = titleEl.textContent.trim();
        } else {
          title = a.getAttribute('title') || a.getAttribute('aria-label') || a.textContent.trim();
        }

        // Clean duration metadata/channel tags sometimes appended in text
        if (title) {
          title = title.replace(/\s*by\s+.*$/i, '').replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
        }

        addVideo(`https://www.youtube.com/watch?v=${ytId}`, {
          source: 'youtube-link',
          type: 'youtube',
          thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
          title: title || 'YouTube Video'
        });
      }
    });

    // 3. <iframe> embeds (YouTube / Vimeo)
    document.querySelectorAll('iframe').forEach(iframe => {
      const src = iframe.src || iframe.getAttribute('data-src') || '';
      if (!src) return;

      const ytId = getYouTubeId(src);
      if (ytId) {
        addVideo(`https://www.youtube.com/watch?v=${ytId}`, {
          source: 'youtube-embed',
          type: 'youtube',
          thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
          title: iframe.title || 'YouTube Video'
        });
        return;
      }

      const vimId = getVimeoId(src);
      if (vimId) {
        addVideo(`https://vimeo.com/${vimId}`, {
          source: 'vimeo-embed',
          type: 'vimeo',
          thumbnail: 'https://vimeo.com/assets/images/favicon.ico',
          title: iframe.title || 'Vimeo Video'
        });
      }
    });

    // 4. Current page check (if browsing watch page directly)
    const currentYt = getYouTubeId(window.location.href);
    if (currentYt) {
      addVideo(`https://www.youtube.com/watch?v=${currentYt}`, {
        source: 'current-page',
        type: 'youtube',
        thumbnail: `https://img.youtube.com/vi/${currentYt}/hqdefault.jpg`,
        title: document.title.replace('- YouTube', '').trim()
      });
    }

    return Array.from(map.values());
  }

  // ─── Message Listener ─────────────────────
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'extractImages' || request.action === 'extractMedia') {
      try {
        const images = extractImages();
        const videos = extractVideos();
        sendResponse({
          images,
          videos,
          pageUrl: window.location.href,
          pageTitle: document.title,
          timestamp: Date.now()
        });
      } catch (err) {
        sendResponse({ images: [], videos: [], error: err.message });
      }
    }
    return true; // Keep channel open
  });

  // ─── Auto Badge Update ────────────────────
  try {
    const images = extractImages();
    const videos = extractVideos();
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      count: images.length + videos.length
    }).catch(() => {});
  } catch { /* ignore */ }

})();
