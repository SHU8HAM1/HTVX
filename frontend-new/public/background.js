// Background service worker
// Responsibility now: Inject the recording overlay content script ONLY when the
// user clicks the extension action (toolbar icon). Prior version auto-injected.
// We keep a lightweight message listener for diagnostics.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'PING') {
    sendResponse({ ok: true });
    return true; // keep channel open if needed
  }
});

// On action (toolbar) click: inject or re-show the overlay strip in active tab.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    // First attempt to tell an already injected script to just show itself.
    const [{ result: hadListener } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // If the global flag exists we assume content script previously ran.
        if (window.__recordingStripInjected) {
          // Try to unhide if it was hidden.
          const el = document.getElementById('recording-strip-overlay');
            if (el) el.style.visibility = 'visible';
          return true;
        }
        return false;
      }
    });

    if (hadListener) {
      console.log('[background] strip already present, made visible');
      return;
    }

    // Not present: inject the real content script file.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['contentScript.js']
    });
    console.log('[background] content script injected on demand');
  } catch (e) {
    console.error('[background] failed to inject content script', e);
  }
});

// ----------------- Background relay: poll server for latest uploaded video and forward to tabs
let lastSeen = null;
const POLL_INTERVAL = 2000; // ms
const SERVER_LATEST = 'http://localhost:5000/latest_video';

async function pollLatestVideo() {
  try {
    const res = await fetch(SERVER_LATEST, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const url = data && data.url;
    if (url && url !== lastSeen) {
      lastSeen = url;
      console.log('[background] new video url', url);
      // broadcast to all tabs
      const tabs = await chrome.tabs.query({});
      for (const t of tabs) {
        try { chrome.tabs.sendMessage(t.id, { type: 'PLAYER_ADD_VIDEO', url }); } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    // network probably down; ignore and retry
    // console.warn('[background] pollLatestVideo error', e);
  }
}

setInterval(pollLatestVideo, POLL_INTERVAL);

// Attempt to use socket.io client in background (live push). If extension environment
// blocks remote modules, this will fail and we'll keep polling as a fallback.
async function initSocketBackground() {
  const SOCKET_SERVER = 'http://localhost:5000';
  // Try ESM client from CDN
  try {
    console.log('[background] attempting to load socket.io ESM client');
    const mod = await import('https://cdn.socket.io/4.7.2/socket.io.esm.min.js');
    const io = mod.io || window.io || (mod.default && mod.default.io) || mod.default;
    if (!io) {
      console.warn('[background] socket.io ESM client loaded but io not found');
      return;
    }
    console.log('[background] socket.io client loaded, connecting to', SOCKET_SERVER);
    const socket = io(SOCKET_SERVER);
    socket.on('connect', () => console.log('[background] socket connected'));
    socket.on('disconnect', () => console.log('[background] socket disconnected'));
    socket.on('video_uploaded', (data) => {
      console.log('[background] video_uploaded', data);
      if (data && data.url) {
        lastSeen = data.url;
        // forward to all tabs
        chrome.tabs.query({}, (tabs) => {
          for (const t of tabs) {
            try { chrome.tabs.sendMessage(t.id, { type: 'PLAYER_ADD_VIDEO', url: data.url }); } catch (e) {}
          }
        });
      }
    });
    // stop polling once socket connected
    try { clearInterval(pollIntervalHandle); } catch(e){}
    console.log('[background] socket background relay initialized');
  } catch (e) {
    console.warn('[background] failed to load socket.io ESM client, will use polling fallback', e);
  }
}

// start polling; store handle so socket init can clear it when live socket connects
const pollIntervalHandle = setInterval(pollLatestVideo, POLL_INTERVAL);
// start polling immediately
pollLatestVideo();
initSocketBackground().catch((e)=>console.warn('[background] initSocketBackground failed', e));
