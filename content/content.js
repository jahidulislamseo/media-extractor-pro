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
    const clean = String(url).replace(/\\\//g, '/').trim();
    if (clean.startsWith('data:')) return null; // skip data URLs
    if (clean.startsWith('blob:')) return null; // skip blob URLs
    if (clean.startsWith('//')) return 'https:' + clean;
    if (clean.startsWith('http')) return clean;
    try {
      return new URL(clean, window.location.href).href;
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

  // ─── Pinterest Video & Title Helpers ──────────
  function resolvePinterestVideo(url) {
    if (!url) return null;
    const str = String(url).replace(/\\/g, '');
    if (!str.includes('pinimg.com') && !currentHost.includes('pinterest.')) return null;
    const m = str.match(/([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{32})/i);
    if (m) {
      const hash = m[4].toLowerCase();
      return {
        hash,
        mp4Url: `https://v1.pinimg.com/videos/mc/720p/${m[1]}/${m[2]}/${m[3]}/${hash}.mp4`,
        fallbackMp4: `https://v1.pinimg.com/videos/mc/expMp4/${m[1]}/${m[2]}/${m[3]}/${hash}_t1.mp4`,
        thumbUrl: `https://i.pinimg.com/videos/thumbnails/originals/${m[1]}/${m[2]}/${m[3]}/${hash}.0000001.jpg`
      };
    }
    const m2 = str.match(/([0-9a-f]{32})/i);
    if (m2) {
      const h = m2[1].toLowerCase();
      const p1 = h.slice(0, 2), p2 = h.slice(2, 4), p3 = h.slice(4, 6);
      return {
        hash: h,
        mp4Url: `https://v1.pinimg.com/videos/mc/720p/${p1}/${p2}/${p3}/${h}.mp4`,
        fallbackMp4: `https://v1.pinimg.com/videos/mc/expMp4/${p1}/${p2}/${p3}/${h}_t1.mp4`,
        thumbUrl: `https://i.pinimg.com/videos/thumbnails/originals/${p1}/${p2}/${p3}/${h}.0000001.jpg`
      };
    }
    return null;
  }

  function getPinterestThumbnail(videoUrl) {
    if (!videoUrl) return '';
    const pinRes = resolvePinterestVideo(videoUrl);
    if (pinRes) return pinRes.thumbUrl;
    return '';
  }

  function findTitleByThumbnail(thumbUrl, videoUrl = '') {
    // 1. If currently on a Pinterest Pin page, get main pin title
    if (currentHost.includes('pinterest.') && window.location.pathname.includes('/pin/')) {
      const pinTitle = document.querySelector('h1')?.textContent?.trim() ||
        document.querySelector('[data-test-id="pin-title"]')?.textContent?.trim() ||
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
      if (pinTitle) {
        const cleanTitle = pinTitle.replace(/\s*\|\s*Pinterest.*$/i, '').trim();
        if (cleanTitle) return cleanTitle;
      }
    }
    if (!thumbUrl && !videoUrl) return '';
    try {
      const hashMatch = (thumbUrl + ' ' + videoUrl).match(/[0-9a-f]{32}/i);
      if (hashMatch) {
        const hash = hashMatch[0];
        const matchingImg = document.querySelector(`img[src*="${hash}"]`);
        if (matchingImg) {
          const card = matchingImg.closest('[data-test-id="pin"], div[role="listitem"], [data-grid-item="true"], a') || matchingImg.parentElement;
          const title = matchingImg.alt || matchingImg.title || card?.querySelector('h2, h3, [title]')?.getAttribute('title') || card?.querySelector('h2, h3')?.textContent?.trim() || '';
          if (title) return title;
        }
      }
    } catch {}
    return '';
  }

  // ─── Stream Chunk Filter & Video Deduplication ─
  function isStreamingChunk(url) {
    if (!url) return true;
    const clean = url.split('?')[0].toLowerCase();
    // Exclude fragmented streaming chunks and manifests
    if (clean.endsWith('.cmfv') || clean.endsWith('.cmfa') || clean.endsWith('.m4s') || clean.endsWith('.ts') || clean.endsWith('.dash') || clean.endsWith('.m3u8') || clean.endsWith('.mpd')) {
      return true;
    }
    if (clean.includes('init.mp4') || clean.includes('init.cmfv') || clean.includes('/init-') || clean.includes('-init')) {
      return true;
    }
    return false;
  }

  function getVideoKey(url) {
    if (!url) return '';
    const yt = url.match(/(?:watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (yt) return 'yt_' + yt[1];

    if (url.includes('pinimg.com') || currentHost.includes('pinterest.')) {
      const pinHash = url.match(/([0-9a-f]{32})/i);
      if (pinHash) return 'pin_' + pinHash[1].toLowerCase();
    }

    return url.split('?')[0].split('#')[0];
  }

  function getQualityScore(url) {
    if (!url) return 0;
    const u = url.toLowerCase();
    if (u.includes('1080p') || u.includes('1080w')) return 100;
    if (u.includes('720p') || u.includes('720w') || u.includes('_t1') || u.includes('exp7') || u.includes('v_720')) return 80;
    if (u.includes('480p') || u.includes('480w') || u.includes('exp6')) return 60;
    if (u.includes('360p') || u.includes('360w')) return 40;
    if (u.includes('.mp4')) return 50;
    if (u.includes('.webm')) return 45;
    return 20;
  }

  // Cache for asynchronously resolved feed pin videos
  const resolvedPinsCache = new Set();
  const cachedFeedVideos = new Map();

  function resolvePinVideoAsync(pinId, thumb, title) {
    if (!pinId || resolvedPinsCache.has(pinId)) return;
    resolvedPinsCache.add(pinId);

    fetch(`/pin/${pinId}/`, { credentials: 'same-origin' })
      .then(res => res.text())
      .then(html => {
        const m = html.match(/https:\/\/v1\.pinimg\.com\/videos\/mc\/(?:720p|expMp4)\/[^"'\s\\]+\.mp4/);
        if (m) {
          const vUrl = m[0];
          const pinRes = resolvePinterestVideo(vUrl);
          const finalMp4 = pinRes ? pinRes.mp4Url : vUrl;
          const finalThumb = thumb || (pinRes ? pinRes.thumbUrl : '');
          cachedFeedVideos.set('pin_' + pinId, {
            url: finalMp4,
            title: title || '',
            width: 720,
            height: 1280,
            type: 'mp4',
            thumbnail: finalThumb,
            source: 'pinterest-feed-pin',
            qualityScore: 80
          });
          triggerMediaUpdate();
        }
      })
      .catch(() => {});
  }

  // ─── Video Extractor ───────────────────────
  function extractVideos() {
    const map = new Map(); // videoKey → metadata

    function addVideo(rawUrl, extra = {}) {
      if (!rawUrl) return;
      const cleanRaw = String(rawUrl).replace(/\\\//g, '/').replace(/\\/g, '').trim();
      const url = resolveUrl(cleanRaw);
      if (!url) return;

      // Check if this is a Pinterest video or stream fragment
      const pinRes = resolvePinterestVideo(url);
      let targetUrl = url;
      let targetType = extra.type || '';
      let targetThumb = extra.thumbnail || '';
      let targetScore = getQualityScore(url);

      if (pinRes) {
        // Upgrade any stream chunk / m3u8 / hash to direct 720p HD MP4
        targetUrl = pinRes.mp4Url;
        targetType = 'mp4';
        targetScore = 80;
        if (!targetThumb || targetThumb.includes('.0000000.jpg')) {
          const posterImg = document.querySelector('video[poster]')?.getAttribute('poster') ||
            document.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
            document.querySelector('[data-test-id="pin"] img')?.src;
          targetThumb = posterImg || pinRes.thumbUrl;
        }
      } else {
        // Reject non-standalone streaming fragments (.cmfv, .cmfa, .m4s, .ts, etc.) for other sites
        if (isStreamingChunk(url)) return;
      }

      if (targetThumb && targetThumb.includes('.0000000.jpg')) {
        targetThumb = targetThumb.replace('.0000000.jpg', '.0000001.jpg');
      }

      const ext = getExt(targetUrl);
      const isKnownExt = videoExts.includes(ext);
      // Strictly ignore unknown non-video formats
      if (!isKnownExt && !targetUrl.includes('youtube.com/watch') && !targetUrl.includes('youtu.be/') && !pinRes) {
        return;
      }

      const type = targetType || (isKnownExt ? ext : 'mp4');
      const videoKey = getVideoKey(targetUrl);
      if (!videoKey) return;

      let title = extra.title || '';
      if ((!title || title === 'Video') && (targetThumb || targetUrl)) {
        title = findTitleByThumbnail(targetThumb, targetUrl);
      }

      const score = targetScore;

      // If video entity already exists in map, upgrade to higher quality or enrich
      if (map.has(videoKey)) {
        const existing = map.get(videoKey);
        // Quality priority: Replace with higher quality (e.g. 720p/1080p over 360p/480p)
        if (score > (existing.qualityScore || 0)) {
          existing.url = targetUrl;
          existing.qualityScore = score;
          existing.type = type;
          if (extra.width && extra.height) {
            existing.width = extra.width;
            existing.height = extra.height;
          }
        }
        if ((!existing.thumbnail || existing.thumbnail.includes('.0000000.jpg')) && targetThumb) {
          existing.thumbnail = targetThumb;
        }
        if ((!existing.title || existing.title === 'Video') && title) existing.title = title;
        if ((!existing.width || !existing.height) && (extra.width && extra.height)) {
          existing.width = extra.width;
          existing.height = extra.height;
        }
        return;
      }

      map.set(videoKey, {
        url: targetUrl,
        title: title || '',
        width: extra.width || 0,
        height: extra.height || 0,
        type,
        thumbnail: targetThumb || '',
        source: extra.source || 'video',
        qualityScore: score,
      });
    }

    // 0. Include all async resolved feed videos
    for (const v of cachedFeedVideos.values()) {
      addVideo(v.url, v);
    }

    // 1. Schema.org JSON-LD (<script type="application/ld+json">)
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const jsonText = script.textContent.trim();
        if (!jsonText) return;
        const data = JSON.parse(jsonText);

        function handleLdItem(item) {
          if (!item || typeof item !== 'object') return;

          if (Array.isArray(item['@graph'])) {
            item['@graph'].forEach(handleLdItem);
            return;
          }

          const itemType = item['@type'];
          const isVideoObj = itemType === 'VideoObject' ||
            (Array.isArray(itemType) && itemType.includes('VideoObject')) ||
            (typeof itemType === 'string' && itemType.toLowerCase().includes('videoobject'));

          if (isVideoObj) {
            const videoUrl = item.contentUrl || item.embedUrl;
            if (videoUrl) {
              let thumb = '';
              if (typeof item.thumbnailUrl === 'string') {
                thumb = item.thumbnailUrl;
              } else if (Array.isArray(item.thumbnailUrl) && item.thumbnailUrl.length > 0) {
                thumb = typeof item.thumbnailUrl[0] === 'string' ? item.thumbnailUrl[0] : item.thumbnailUrl[0]?.url || '';
              } else if (item.thumbnail && typeof item.thumbnail === 'object') {
                thumb = item.thumbnail.url || '';
              }
              if (!thumb && videoUrl.includes('pinimg.com')) {
                thumb = getPinterestThumbnail(videoUrl);
              }

              let w = 0, h = 0;
              if (item.width) {
                const matchW = String(item.width).match(/\d+/);
                if (matchW) w = parseInt(matchW[0], 10);
              }
              if (item.height) {
                const matchH = String(item.height).match(/\d+/);
                if (matchH) h = parseInt(matchH[0], 10);
              }

              const title = item.name || item.headline || item.description?.substring(0, 100) || '';
              addVideo(videoUrl, {
                title,
                thumbnail: thumb,
                width: w,
                height: h,
                type: 'mp4',
                source: 'schema-ld+json'
              });
            }
          }

          // Search nested properties
          for (const key of Object.keys(item)) {
            if (item[key] && typeof item[key] === 'object') {
              handleLdItem(item[key]);
            }
          }
        }

        if (Array.isArray(data)) {
          data.forEach(handleLdItem);
        } else {
          handleLdItem(data);
        }
      } catch (err) { /* skip malformed json-ld */ }
    });

    // 2. Open Graph & Twitter Video Meta tags
    try {
      const ogVideo = document.querySelector('meta[property="og:video:secure_url"], meta[property="og:video"], meta[property="og:video:url"]')?.getAttribute('content');
      const twitterStream = document.querySelector('meta[name="twitter:player:stream"]')?.getAttribute('content');
      const ogThumb = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]')?.getAttribute('content') || '';
      const ogTitle = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.getAttribute('content') || document.title || '';

      if (ogVideo) {
        addVideo(ogVideo, {
          title: ogTitle,
          thumbnail: ogThumb || getPinterestThumbnail(ogVideo),
          source: 'og-video'
        });
      }
      if (twitterStream) {
        addVideo(twitterStream, {
          title: ogTitle,
          thumbnail: ogThumb || getPinterestThumbnail(twitterStream),
          source: 'twitter-stream'
        });
      }
    } catch { /* skip */ }

    // 3. Deep Pinterest Redux State & Story Pin JSON Parser
    try {
      document.querySelectorAll('script[type="application/json"], script[id*="PWS"]').forEach(script => {
        const text = script.textContent.trim();
        if (!text || (!text.includes('video') && !text.includes('pinimg.com'))) return;
        try {
          const data = JSON.parse(text);
          function traverse(obj) {
            if (!obj || typeof obj !== 'object') return;

            // Detect video_list in pin data
            if (obj.video_list && typeof obj.video_list === 'object') {
              const vList = obj.video_list;
              const preferredKey = ['V_1080P', 'V_720P', 'V_EXP7', 'V_EXP6', 'V_480P', 'V_HLSV4', 'V_HLSV3_MOBILE'].find(k => vList[k]?.url);
              const chosen = preferredKey ? vList[preferredKey] : Object.values(vList).find(v => v?.url);
              if (chosen && chosen.url) {
                let vUrl = chosen.url;
                if (vUrl.includes('.m3u8') && vUrl.includes('pinimg.com')) {
                  const hashMatch = vUrl.match(/([0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{32})/i);
                  if (hashMatch) {
                    vUrl = `https://v1.pinimg.com/videos/iht/expMp4/${hashMatch[1]}_720w.mp4`;
                  }
                }

                const thumb = chosen.thumbnail || getPinterestThumbnail(vUrl);
                const title = findTitleByThumbnail(thumb);
                addVideo(vUrl, {
                  width: chosen.width || 0,
                  height: chosen.height || 0,
                  thumbnail: thumb,
                  title: title,
                  source: 'pinterest-json'
                });
              }
            }

            if (Array.isArray(obj)) {
              obj.forEach(traverse);
            } else {
              for (const k of Object.keys(obj)) {
                if (typeof obj[k] === 'object' && obj[k] !== null) {
                  traverse(obj[k]);
                }
              }
            }
          }
          traverse(data);
        } catch { /* skip */ }
      });
    } catch { /* skip */ }

    // 4. Browser Resource Timing API Scanner
    // Automatically captures complete videos fetched as user scrolls the feed
    try {
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        performance.getEntriesByType('resource').forEach(entry => {
          const name = entry.name;
          if (!name) return;

          // Check Pinterest video stream / CDN files (converts .cmfv / .m3u8 chunks to 720p HD MP4)
          if (name.includes('pinimg.com') && (name.includes('/videos/') || name.includes('.mp4') || name.includes('.cmfv') || name.includes('.m3u8'))) {
            const pinRes = resolvePinterestVideo(name);
            if (pinRes) {
              addVideo(pinRes.mp4Url, {
                thumbnail: pinRes.thumbUrl,
                type: 'mp4',
                source: 'network-stream'
              });
              return;
            }
          }

          if ((name.includes('.mp4') || name.includes('.webm')) && !isStreamingChunk(name)) {
            const clean = resolveUrl(name.split('?')[0]);
            if (clean && !isStreamingChunk(clean)) {
              addVideo(clean, {
                source: 'network-stream'
              });
            }
          }
        });
      }
    } catch { /* skip */ }

    // 5. Pinterest Specific Video CDN Script Scanner
    try {
      document.querySelectorAll('script:not([src])').forEach(s => {
        const text = s.textContent;
        if (!text || text.length > 800000) return;
        if (!text.includes('pinimg.com/videos')) return;

        const pinMatches = text.matchAll(/https?:\\?\/\\?\/[a-zA-Z0-9_\-\.]*pinimg\.com\\?\/videos\\?\/[^\s"'<>\\]+/gi);
        for (const m of pinMatches) {
          const vUrl = m[0].replace(/\\/g, '');
          const pinRes = resolvePinterestVideo(vUrl);
          if (pinRes) {
            addVideo(pinRes.mp4Url, { source: 'pinterest-script', type: 'mp4', thumbnail: pinRes.thumbUrl });
          }
        }
      });
    } catch { /* skip */ }

    // 6. <video> tags & child source elements
    document.querySelectorAll('video').forEach(vid => {
      let poster = vid.getAttribute('poster') || vid.poster || '';
      const w = vid.videoWidth || vid.naturalWidth || parseInt(vid.getAttribute('width')) || 0;
      const h = vid.videoHeight || vid.naturalHeight || parseInt(vid.getAttribute('height')) || 0;

      // Find parent pin container to get title and thumbnail
      const pinContainer = vid.closest('[data-test-id="pin"], div[role="listitem"], [data-grid-item="true"], article') || vid.parentElement;
      const pinImg = pinContainer?.querySelector('img');
      if (!poster && pinImg) poster = pinImg.src;
      const title = pinImg?.alt || pinContainer?.querySelector('h2, h3, [title]')?.getAttribute('title') || '';

      // Check direct src on video tag
      const vidSrc = vid.getAttribute('src') || vid.src || vid.getAttribute('data-src') || vid.getAttribute('data-video-src');
      if (vidSrc && !vidSrc.startsWith('blob:')) {
        addVideo(vidSrc, { source: 'video-tag', thumbnail: poster, width: w, height: h, title });
      } else if (vid.currentSrc && !vid.currentSrc.startsWith('blob:')) {
        addVideo(vid.currentSrc, { source: 'video-tag', thumbnail: poster, width: w, height: h, title });
      }

      // Inside source elements
      vid.querySelectorAll('source').forEach(src => {
        const sUrl = src.getAttribute('src') || src.src || src.getAttribute('data-src');
        if (sUrl && !sUrl.startsWith('blob:')) {
          addVideo(sUrl, { source: 'video-source', thumbnail: poster, width: w, height: h, title });
        }
      });
    });

    // 7. Pinterest Feed Cards with Video Duration Badges
    document.querySelectorAll('[data-test-id="pin"], div[role="listitem"], [data-grid-item="true"]').forEach(card => {
      try {
        const text = card.innerText || '';
        const hasTimeBadge = /\b\d{1,2}:\d{2}\b/.test(text);
        const pinImg = card.querySelector('img');
        if (hasTimeBadge && pinImg?.src) {
          const thumb = pinImg.src;
          const title = pinImg.alt || card.querySelector('h2, h3, [title]')?.getAttribute('title') || '';
          
          const vid = card.querySelector('video');
          if (vid) {
            const vSrc = vid.src || vid.getAttribute('src') || vid.getAttribute('data-src') || vid.currentSrc;
            if (vSrc && !vSrc.startsWith('blob:')) {
              addVideo(vSrc, { thumbnail: vid.poster || thumb, title, source: 'pin-card' });
            }
          }

          // Check for pin link and trigger background HD MP4 resolution
          const pinLink = card.querySelector('a[href*="/pin/"]');
          const pinHref = pinLink ? pinLink.getAttribute('href') : '';
          const pinIdMatch = pinHref ? pinHref.match(/\/pin\/(\d+)/) : null;
          if (pinIdMatch) {
            resolvePinVideoAsync(pinIdMatch[1], thumb, title);
          }
        }
      } catch {}
    });

    // 8. Scrape all <a> links for direct video files
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

    // 6. Universal YouTube link scanner (works on any page)
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

    // 7. YouTube custom elements (ytd-*) — home feed only
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

    return Array.from(map.values()).map(item => {
      const { qualityScore, ...rest } = item;
      return rest;
    });
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

  // ─── Auto Badge & Live Feed Scanner ───────
  let rescanTimeout = null;
  function triggerMediaUpdate() {
    clearTimeout(rescanTimeout);
    rescanTimeout = setTimeout(() => {
      try {
        const images = extractImages();
        const videos = extractVideos();
        chrome.runtime.sendMessage({
          action: 'updateBadge',
          count: images.length + videos.length
        }).catch(() => {});
      } catch { /* ignore */ }
    }, 600);
  }

  try {
    const images = extractImages();
    const videos = extractVideos();
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      count: images.length + videos.length
    }).catch(() => {});
  } catch { /* ignore */ }

  window.addEventListener('scroll', triggerMediaUpdate, { passive: true });

  try {
    const observer = new MutationObserver(mutations => {
      let hasNewMedia = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.tagName === 'VIDEO' || node.tagName === 'IMG' || node.querySelector?.('video, img, [data-test-id="pin"]')) {
                hasNewMedia = true;
                break;
              }
            }
          }
        }
        if (hasNewMedia) break;
      }
      if (hasNewMedia) triggerMediaUpdate();
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  } catch { /* ignore */ }

})();
