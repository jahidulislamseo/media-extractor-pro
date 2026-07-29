// =============================================
// Image & Video Extractor - Content Script
// Extracts standard HTML media elements only.
// On streaming/DRM platforms: media is shown
// for reference only — downloads are disabled.
// =============================================

(function () {
  'use strict';

  // ─── Download-Restricted Domains ─────────────
  // On these platforms, media elements are shown
  // (e.g. thumbnails) but downloading is blocked.
  // This complies with their Terms of Service.
  const DOWNLOAD_RESTRICTED_DOMAINS = [
    'youtube.com', 'youtu.be', 'youtube-nocookie.com',
    'netflix.com', 'primevideo.com', 'disneyplus.com',
    'hulu.com', 'hbomax.com', 'max.com', 'peacocktv.com',
    'paramountplus.com', 'espn.com', 'twitch.tv',
    'spotify.com', 'tidal.com', 'deezer.com',
    'soundcloud.com', 'vimeo.com', 'dailymotion.com',
    'bilibili.com', 'crunchyroll.com', 'funimation.com'
  ];

  const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  const isDownloadRestricted = DOWNLOAD_RESTRICTED_DOMAINS.some(
    d => currentHost === d || currentHost.endsWith('.' + d)
  );

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

    // 6. Inline SVG elements
    document.querySelectorAll('svg').forEach((svg, idx) => {
      // Avoid tiny or empty SVGs
      if (svg.children.length === 0) return;
      
      let w = svg.width?.baseVal?.value || svg.getBoundingClientRect().width || 24;
      let h = svg.height?.baseVal?.value || svg.getBoundingClientRect().height || 24;
      
      try {
        const clone = svg.cloneNode(true);
        if (!clone.getAttribute('xmlns')) {
          clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        
        const svgString = new XMLSerializer().serializeToString(clone);
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        const virtualUrl = `inline-svg-${idx}-${Date.now()}.svg`;
        
        map.set(virtualUrl, {
          url: dataUrl,
          virtual: true,
          rawSvg: svgString,
          alt: svg.getAttribute('aria-label') || svg.querySelector('title')?.textContent || 'Inline SVG Icon',
          width: Math.round(w),
          height: Math.round(h),
          type: 'svg',
          source: 'inline'
        });
      } catch (err) { /* noop */ }
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

    // 2. Scrape all <a> links for direct video files
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!href) return;
      if (new RegExp(`\\.(${videoExts.join('|')})(\\?|$)`, 'i').test(href)) {
        const resolved = resolveUrl(href);
        if (resolved) {
          addVideo(resolved, { source: 'link', title: a.textContent.trim() });
        }
      }
    });

    // 3. Universal YouTube link scanner (works on any page)
    // Scans ALL anchor tags for YouTube watch links.
    // Works on YouTube home, Google Search, blogs, any site.
    document.querySelectorAll('a[href]').forEach(a => {
      try {
        const href = a.getAttribute('href') || '';
        if (!href) return;

        const ytMatch =
          href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ||
          href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (!ytMatch) return;

        const videoId = ytMatch[1];
        const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
        if (map.has(watchUrl)) return;

        const titleEl = a.querySelector('h3, [id*="title"], [class*="title"]');
        const title =
          a.getAttribute('title') ||
          a.getAttribute('aria-label') ||
          (titleEl ? titleEl.textContent.trim() : '') ||
          a.textContent.trim().substring(0, 100) ||
          'YouTube Video';

        const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        map.set(watchUrl, {
          url: watchUrl,
          title,
          thumbnail,
          type: 'youtube',
          width: 0,
          height: 0,
          source: 'yt-link',
        });
      } catch { /* skip */ }
    });

    // 4. YouTube custom elements (ytd-*) — home feed only
    if (currentHost === 'youtube.com' || currentHost.endsWith('.youtube.com')) {
      const cardSelectors = [
        'ytd-rich-item-renderer',
        'ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-playlist-video-renderer'
      ];
      document.querySelectorAll(cardSelectors.join(',')).forEach(card => {
        try {
          const data = card.data || card.__data || {};
          const videoId =
            data?.videoId ||
            card.querySelector('a[href*="watch"]')?.getAttribute('href')?.match(/v=([a-zA-Z0-9_-]{11})/)?.[1];
          if (!videoId) return;

          const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
          if (map.has(watchUrl)) return;

          const titleEl = card.querySelector('#video-title, #video-title-link, h3 a');
          const title = titleEl
            ? (titleEl.getAttribute('title') || titleEl.textContent.trim())
            : data?.title?.runs?.[0]?.text || 'YouTube Video';

          map.set(watchUrl, {
            url: watchUrl,
            title,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            type: 'youtube',
            width: 0,
            height: 0,
            source: 'ytd-card',
          });
        } catch { /* skip */ }
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
          downloadRestricted: isDownloadRestricted, // true on YouTube/streaming sites
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
