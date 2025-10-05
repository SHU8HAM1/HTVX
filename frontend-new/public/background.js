// Background service worker
// Use the UMD socket.io client loaded via importScripts from the extension package.
// This avoids attempting to resolve bare ESM specifiers at runtime in the service worker.
// Responsibility now: Inject the recording overlay content script ONLY when the
// user clicks the extension action (toolbar icon). Prior version auto-injected.
// We keep a lightweight message listener for diagnostics.

let socket = null;
let pc; // for WebRTC peer connection
let dataChannel;

console.log('[background] background.js loaded and running');

// Test helper: broadcast a PLAYER_ADD_VIDEO message to all tabs (callable from SW console)
function testAddVideo(url) {
  if (!url) url = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
  console.log('[background:testAddVideo] broadcasting', url);
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      try { chrome.tabs.sendMessage(t.id, { type: 'PLAYER_ADD_VIDEO', url }); } catch (e) { /* ignore */ }
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'PING') {
    sendResponse({ ok: true });
    return true; // keep channel open if needed
  }

  // allow other contexts (popup/page) to request socket initialization
  if (msg?.type === 'INIT_SOCKET') {
    (async () => {
      try {
        if (!socket) await initSocketBackground();
        sendResponse({ ok: !!socket });
      } catch (e) {
        console.error('[background] INIT_SOCKET failed', e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg?.type === 'TEST_UPLOAD_CHUNK') {
    (async () => {
      try {
        const size = msg.size || 16;
        const res = await globalThis.testUploadChunk(size);
        sendResponse(res);
      } catch (e) {
        console.error('[background] TEST_UPLOAD_CHUNK failed', e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  // allow broadcasting a test video via runtime message
  if (msg?.type === 'TEST_ADD_VIDEO') {
    try {
      testAddVideo(msg.url);
      sendResponse({ ok: true });
    } catch (e) { sendResponse({ ok: false, error: String(e) }); }
    return true;
  }

  // Forward modified chunks received via runtime messaging to the backend socket
  if (msg?.type === 'MODIFIED_CHUNK') {
    (async () => {
      try {
        if (!socket) initSocketBackground();
        // wait briefly for socket
        const start = Date.now();
        while ((!socket || typeof socket.emit !== 'function') && Date.now() - start < 3000) {
          await new Promise((r) => setTimeout(r, 100));
        }
        if (socket && typeof socket.emit === 'function') {
          socket.emit('upload_chunk', msg.chunk);
          sendResponse({ ok: true });
        } else {
          console.warn('[background] cannot forward modified chunk, socket not available');
          sendResponse({ ok: false, error: 'socket not available' });
        }
      } catch (e) {
        console.error('[background] failed to forward modified chunk', e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  // Handle upload chunks coming from content scripts
  if (msg?.type === 'UPLOAD_CHUNK') {
    (async () => {
      try {
        console.log('[background] received UPLOAD_CHUNK message from', sender?.id || sender);
        // Ensure socket is initialized
        if (!socket) initSocketBackground();
        // wait briefly for socket to become available
        const start = Date.now();
        while ((!socket || typeof socket.emit !== 'function') && Date.now() - start < 3000) {
          await new Promise((r) => setTimeout(r, 100));
        }
        if (!socket || typeof socket.emit !== 'function') {
          console.warn('[background] socket not available when handling UPLOAD_CHUNK');
          sendResponse({ ok: false, error: 'socket not available' });
          return;
        }

        let payload = msg.chunk;
        if (payload && typeof payload.arrayBuffer === 'function') {
          payload = await payload.arrayBuffer();
        }
        try {
          console.log('[background] emitting upload_chunk, payload size=', payload && payload.byteLength ? payload.byteLength : (payload && payload.length) || 'unknown');
          socket.emit('upload_chunk', payload);
          console.log('[background] socket.emit returned for upload_chunk');
        } catch (emitErr) {
          console.error('[background] socket.emit error', emitErr);
          sendResponse({ ok: false, error: String(emitErr) });
          return;
        }
        sendResponse({ ok: true });
      } catch (err) {
        console.error('[background] UPLOAD_CHUNK handler error', err);
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
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
  // Use bundled socket.io-client (imported by the bundler). Vite will include this dependency
  // in the background build output so we can use ESM imports here.
  try {
    // Try to load UMD socket.io client provided by the extension under public/vendor
    try {
      importScripts(chrome.runtime.getURL('vendor/socket.io.min.js'));
      console.log('[background] imported socket.io vendor via importScripts');
    } catch (errImport) {
      console.warn('[background] failed to import socket.io vendor via importScripts', errImport);
    }

    // Read the global `io` (if a UMD socket.io client exposed it) without
    // declaring a local `io` first (that would cause a Temporal Dead Zone error).
    const globalIo = (typeof self !== 'undefined' && self.io) || (typeof window !== 'undefined' && window.io) || null;
    if (typeof globalIo !== 'function') {
      console.warn('[background] socket.io client not available (io is not defined); keeping polling fallback');
      return;
    }

    console.log('[background] socket.io client available, connecting to', SOCKET_SERVER);
    socket = globalIo(SOCKET_SERVER);
    socket.on('connect', () => console.log('[background] socket connected'));
  socket.on('connect_error', (err) => console.error('[background] socket connect_error', err));
  socket.on('error', (err) => console.error('[background] socket error', err));
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
    // listen for per-chunk ACKs and forward to tabs
    socket.on('chunk_saved', (data) => {
      console.log('[background] chunk_saved', data);
      chrome.tabs.query({}, (tabs) => {
        for (const t of tabs) {
          try { chrome.tabs.sendMessage(t.id, { type: 'CHUNK_SAVED', info: data }); } catch (err) { /* ignore */ }
        }
      });
    });
    // stop polling once socket connected
    try { clearInterval(pollIntervalHandle); } catch(e){}
    console.log('[background] socket background relay initialized');
  } catch (e) {
    console.warn('[background] initSocketBackground encountered an error, will use polling fallback', e);
  }

  // initialize webrtc peer connection
  const initializeWebRTC = () => {
    pc = new RTCPeerConnection();

    // create data channel to send in the video chunks
    dataChannel = pc.createDataChannel('vid-chunks');

    // listen for incoming data from the backend
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (msgEvent) => {
        console.log('Receive WebRTC message from backend: ', msgEvent.data);
        chrome.runtime.sendMessage({ type: 'MODIFIED_CHUNK', chunk: msgEvent.data });
      };
    };

    // handles ice candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && typeof socket.emit === 'function') {
        socket.emit('ice-candidate', event.candidate);
      }
    };
  };

  try { globalThis.initializeWebRTC = initializeWebRTC; } catch (e) { /* ignore */ }
}

// Expose helpers on global scope (callable from background SW console)
try {
  globalThis.initSocketBackground = initSocketBackground;
  globalThis.initializeSocket = initSocketBackground; // alias
  globalThis.testAddVideo = testAddVideo;
  globalThis.testUploadChunk = async function testUploadChunk(size = 16) {
    try {
      if (!socket) initSocketBackground();
      const start = Date.now();
      while ((!socket || typeof socket.emit !== 'function' || socket.connected === false) && Date.now() - start < 3000) {
        await new Promise((r) => setTimeout(r, 120));
      }
      if (!socket || typeof socket.emit !== 'function') {
        console.warn('[background:testUploadChunk] socket not available');
        return { ok: false, error: 'socket not available' };
      }
      const arr = new Uint8Array(size);
      for (let i = 0; i < size; i++) arr[i] = i & 0xff;
      socket.emit('upload_chunk', arr.buffer);
      console.log('[background:testUploadChunk] emitted chunk size=', size);
      return { ok: true };
    } catch (err) {
      console.error('[background:testUploadChunk] error', err);
      return { ok: false, error: String(err) };
    }
  };
} catch (err) {
  console.warn('[background] could not attach globals', err);
}

// start polling; store handle so socket init can clear it when live socket connects
const pollIntervalHandle = setInterval(pollLatestVideo, POLL_INTERVAL);
// start polling immediately
pollLatestVideo();
initSocketBackground().catch((e)=>console.warn('[background] initSocketBackground failed', e));
