// =============================================
// Media Extractor Pro — Service Worker (ES Module)
// Manifest V3 | Production Ready
// =============================================

// ── Badge Helper ──────────────────────────────
function setBadge(count, tabId) {
  const text = count > 0 ? (count > 999 ? '99+' : String(count)) : '';
  const colorOpts = { color: '#6366f1' };
  const textOpts  = { text };
  if (tabId) { colorOpts.tabId = tabId; textOpts.tabId = tabId; }

  chrome.action.setBadgeBackgroundColor(colorOpts).catch(() => {});
  chrome.action.setBadgeText(textOpts).catch(() => {});
}

// ── Message Handler ───────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (request.action === 'updateBadge') {
    setBadge(request.count ?? 0, tabId);
    return false;
  }

  if (request.action === 'downloadImage') {
    const { url, filename, saveAs = false } = request;
    if (!url) return false;

    chrome.downloads.download({
      url,
      filename: filename || `media-extractor-pro/file_${Date.now()}`,
      saveAs,
      conflictAction: 'uniquify',
    }).catch(err => console.warn('[MEP] download error:', err));

    return false;
  }
});

// ── Tab Update → Refresh Badge ────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content.js'],
    }).catch(() => {}); // ok if already injected

    // Short wait for content script to settle
    await new Promise(r => setTimeout(r, 500));

    chrome.tabs.sendMessage(tabId, { action: 'extractMedia' }, res => {
      if (chrome.runtime.lastError) return;
      if (res) {
        const count = (res.images?.length || 0) + (res.videos?.length || 0);
        setBadge(count, tabId);
      }
    });
  } catch { /* tab not scriptable */ }
});

// ── Tab Activated → Update Badge ──────────────
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://')) {
      setBadge(0, tabId);
      return;
    }

    chrome.tabs.sendMessage(tabId, { action: 'extractMedia' }, res => {
      if (chrome.runtime.lastError) return;
      if (res) {
        const count = (res.images?.length || 0) + (res.videos?.length || 0);
        setBadge(count, tabId);
      }
    });
  } catch { /* ignore */ }
});
