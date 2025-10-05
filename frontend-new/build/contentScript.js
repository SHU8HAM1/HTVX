// Screen Recording Overlay Content Script (formatted & modular)
// Provides: floating overlay, screen recording via getDisplayMedia, popup control messaging.

(function () {
  try {
    const already = !!window.__recordingStripInjected;
    console.log('[RecorderOverlay] init', { already, url: location.href });
    if (already) return;
    window.__recordingStripInjected = true;

    // -------------------------- Styles -------------------------- //
    injectStyles();

    // -------------------------- DOM Elements -------------------- //
  const strip = createStrip();
  const dragHandle = strip.querySelector('.drag');
    const label = strip.querySelector('.label');
    const startBtn = strip.querySelector('button.start');
    const stopBtn = strip.querySelector('button.stop');
    const hideBtn = strip.querySelector('button.hide');

  // create video player and position it under the strip
  const playerContainer = createPlayer();

    // -------------------------- State --------------------------- //
    let mediaRecorder = null;
    let chunks = [];
    let stream = null;
    let isRecording = false;

    // -------------------------- Helpers ------------------------- //
    function setRecording(active) {
      if (active) {
        strip.classList.add('recording');
        label.textContent = 'Recording...';
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
      } else {
        strip.classList.remove('recording');
        label.textContent = 'Recorder Idle';
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
      }
    }

  async function start() {
  if (isRecording) {
    console.log('[RecorderOverlay] already recording, ignoring start');
    return;
  }
  
  try {
    console.log('[RecorderOverlay] start requested');
    console.log('[RecorderOverlay] requesting getDisplayMedia...');
    
    stream = await navigator.mediaDevices.getDisplayMedia({ 
      video: true, 
      audio: true, 
      preferCurrentTab: true, 
      selfBrowserSurface: 'include', 
      surfaceSwitching: 'include' 
    });
    
    console.log('[RecorderOverlay] got stream:', stream);
    console.log('[RecorderOverlay] stream tracks:', stream.getTracks());
    
    chunks = [];
    
    console.log('[RecorderOverlay] creating MediaRecorder...');
    mediaRecorder = new MediaRecorder(stream, { 
      mimeType: 'video/webm;codecs=vp9,opus' 
    });
    
    console.log('[RecorderOverlay] MediaRecorder created, state:', mediaRecorder.state);
    
    // Event handlers
   mediaRecorder.ondataavailable = async (e) => {
  console.log('[RecorderOverlay] ondataavailable fired! data:', e.data, 'size:', e.data?.size);
  
  if (e.data && e.data.size > 0) {
    chunks.push(e.data);
    
    try {
      const arrayBuffer = await e.data.arrayBuffer();
      console.log('[RecorderOverlay] Converted to ArrayBuffer, size:', arrayBuffer.byteLength);
      
      // FIX: Convert ArrayBuffer to Uint8Array (this preserves data through Chrome messaging)
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log('[RecorderOverlay] Converted to Uint8Array, length:', uint8Array.length);
      
      chrome.runtime.sendMessage(
        { 
          type: 'UPLOAD_CHUNK', 
          chunk: Array.from(uint8Array)  // Convert to regular array
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[RecorderOverlay] Error sending chunk:', chrome.runtime.lastError);
          } else {
            console.log('[RecorderOverlay] Chunk sent successfully:', response);
          }
        }
      );
    } catch (err) {
      console.error('[RecorderOverlay] Failed to process chunk:', err);
    }
  } else {
    console.warn('[RecorderOverlay] ondataavailable but size is 0 or no data');
  }
};
    
    mediaRecorder.onstart = () => {
      console.log('[RecorderOverlay] MediaRecorder.onstart fired - recording is active');
    };
    
    mediaRecorder.onerror = (e) => {
      console.error('[RecorderOverlay] MediaRecorder.onerror:', e);
    };
    
    mediaRecorder.onstop = handleStop;
    
    console.log('[RecorderOverlay] calling mediaRecorder.start(1000)...');
    mediaRecorder.start(1000);
    console.log('[RecorderOverlay] mediaRecorder.start() called, new state:', mediaRecorder.state);
    
    isRecording = true;
    setRecording(true);
    
    console.log('[RecorderOverlay] start() complete successfully');
    
  } catch (e) {
    console.error('[RecorderOverlay] Start failed with error:', e);
    console.error('[RecorderOverlay] Error name:', e.name);
    console.error('[RecorderOverlay] Error message:', e.message);
    strip.style.outline = '2px solid red';
    label.textContent = 'Start failed: ' + (e.message || e);
  }
}

    function stop() {
      if (mediaRecorder && isRecording) mediaRecorder.stop();
    }

    function handleStop() {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recording-' + Date.now() + '.webm';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      isRecording = false;
      setRecording(false);
    }

    function currentState() {
      return {
        recording: isRecording,
      };
    }

    // -------------------------- Events -------------------------- //
    startBtn.addEventListener('click', start);
    stopBtn.addEventListener('click', stop);
    hideBtn.addEventListener('click', () => {
      console.log('[RecorderOverlay] hide clicked');
      strip.remove();
      window.__recordingStripInjected = false;
      if (isRecording) stop();
    });
    enableDrag(strip, dragHandle);

    // -------------------------- Messaging ----------------------- //
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      switch (msg?.type) {
        case 'REC_GET_STATE':
          sendResponse(currentState());
          return true;
        case 'REC_SHOW':
          // Already injected automatically on navigation; reinject logic could be added here.
          strip.style.visibility = 'visible';
          sendResponse(currentState());
          return true;
        case 'REC_START':
          start();
          sendResponse({ ok: true });
          return true;
        case 'REC_STOP':
          stop();
          sendResponse({ ok: true });
          return true;
        case 'REC_HIDE':
          strip.style.visibility = 'hidden';
          playerContainer.style.visibility = 'hidden';
          window.__recordingStripInjected = false;
          sendResponse(currentState());
          return true;
        case 'PLAYER_SET_VIDEOS':
          // payload: { urls: string[], start: number }
          try {
            const p = document.getElementById('rec-video-player');
            if (p && p.__player) p.__player.setVideos(msg.urls || [], msg.start || 0);
            sendResponse({ ok: true });
          } catch (e) { sendResponse({ ok: false, error: String(e) }); }
          return true;
        case 'PLAYER_ADD_VIDEO':
          // payload: { url: string }
          try {
            const p = document.getElementById('rec-video-player');
            if (p && p.__player) p.__player.addUrl(msg.url);
            sendResponse({ ok: true });
          } catch (e) { sendResponse({ ok: false, error: String(e) }); }
          return true;
        case 'CHUNK_SAVED':
          // payload: { info: { filename, size, timestamp } }
          try {
            console.log('[RecorderOverlay] CHUNK_SAVED', msg.info);
            // flash a small saved indicator in the label
            const prev = label.textContent;
            label.textContent = 'Chunk saved';
            setTimeout(() => { label.textContent = prev; }, 800);
            sendResponse({ ok: true });
          } catch (e) { sendResponse({ ok: false, error: String(e) }); }
          return true;
      }
    });

    // Bridge: allow page context to forward binary chunks to the extension.
    // Page can call:
    // window.postMessage({ __ext_bridge: 'HTVX', type: 'UPLOAD_CHUNK_FROM_PAGE', id: 'someId', chunk: <ArrayBuffer|Uint8Array|Blob> }, '*');
    // The content script will forward to chrome.runtime and then post a response back with type 'UPLOAD_CHUNK_RESPONSE'.
    window.addEventListener('message', (event) => {
      try {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.__ext_bridge !== 'HTVX') return;
        if (data.type === 'UPLOAD_CHUNK_FROM_PAGE') {
          const id = data.id || Math.random().toString(36).slice(2);
          const chunk = data.chunk;
          // forward to extension background
          chrome.runtime.sendMessage({ type: 'UPLOAD_CHUNK', chunk }, (resp) => {
            // reply back to page
            window.postMessage({ __ext_bridge: 'HTVX', type: 'UPLOAD_CHUNK_RESPONSE', id, resp }, '*');
          });
        }
        // allow page to request socket initialization from the background SW
        if (data.type === 'INIT_SOCKET_FROM_PAGE') {
          const id = data.id || Math.random().toString(36).slice(2);
          try {
            chrome.runtime.sendMessage({ type: 'INIT_SOCKET' }, (resp) => {
              window.postMessage({ __ext_bridge: 'HTVX', type: 'INIT_SOCKET_RESPONSE', id, resp }, '*');
            });
          } catch (err) {
            window.postMessage({ __ext_bridge: 'HTVX', type: 'INIT_SOCKET_RESPONSE', id, resp: { ok: false, error: String(err) } }, '*');
          }
        }
      } catch (err) {
        // swallow errors to avoid noisy page console traces
      }
    });

    console.log('[RecorderOverlay] ready');

    // -------------------------- Impl Functions ------------------ //
    function injectStyles() {
      const style = document.createElement('style');
      style.id = 'rec-strip-inline-style';
      style.textContent = `
        #recording-strip-overlay { position:fixed; top:12px; left:50%; transform:translateX(-50%); z-index:2147483647; display:flex; align-items:center; gap:12px; padding:8px 16px; backdrop-filter:blur(14px) saturate(160%); -webkit-backdrop-filter:blur(14px) saturate(160%); background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35); border-radius:20px; box-shadow:0 4px 18px -2px rgba(0,0,0,0.25); font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#111; letter-spacing:.2px; }
        @media (prefers-color-scheme: dark){ #recording-strip-overlay { background:rgba(30,30,35,0.55); border-color:rgba(120,120,140,0.35); color:#f5f5f5; } }
        #recording-strip-overlay .rec-dot { width:10px; height:10px; border-radius:50%; background:#e54848; box-shadow:0 0 0 4px rgba(229,72,72,0.18); animation:rec-pulse 1.8s ease-in-out infinite; }
        #recording-strip-overlay.recording .rec-dot { background:#0ea960; box-shadow:0 0 0 4px rgba(14,169,96,0.25); }
        @keyframes rec-pulse { 0%,100% { transform:scale(.9); opacity:.85 } 50% { transform:scale(1.25); opacity:1 } }
        #recording-strip-overlay button { cursor:pointer; border:none; outline:none; font:600 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; border-radius:14px; padding:6px 14px; display:inline-flex; align-items:center; gap:6px; transition:background .18s, box-shadow .18s, transform .18s; backdrop-filter:blur(4px); }
        #recording-strip-overlay button:active { transform:translateY(1px); }
        #recording-strip-overlay button.start { background:linear-gradient(135deg,#16c572,#0ea960); color:#fff; box-shadow:0 2px 6px -1px rgba(14,169,96,0.45); }
        #recording-strip-overlay button.start:hover { background:linear-gradient(135deg,#18d079,#0c9858); }
        #recording-strip-overlay button.stop { background:linear-gradient(135deg,#ff5d5d,#e23030); color:#fff; box-shadow:0 2px 6px -1px rgba(226,48,48,0.45); }
        #recording-strip-overlay button.stop:hover { background:linear-gradient(135deg,#ff6666,#d32121); }
        #recording-strip-overlay button.hide { background:rgba(120,120,140,0.25); color:#fff; font-weight:500; }
        #recording-strip-overlay button.hide:hover { background:rgba(140,140,160,0.35); }
        #recording-strip-overlay .drag { width:60px; height:28px; border-radius:6px; background:rgba(120,120,140,0.35); display:flex; align-items:center; justify-content:center; cursor:grab; position:relative; }
        #recording-strip-overlay .drag:before, #recording-strip-overlay .drag:after { content:''; position:absolute; width:2px; height:60%; background:rgba(255,255,255,0.55); border-radius:2px; }
        #recording-strip-overlay .drag:before { left:4px; }
        #recording-strip-overlay .drag:after { right:4px; }
        #recording-strip-overlay.recording { box-shadow:0 4px 22px -4px rgba(14,169,96,0.55),0 0 0 1px rgba(14,169,96,0.25); }
        #recording-strip-overlay:not(.recording) { box-shadow:0 4px 20px -4px rgba(0,0,0,0.35),0 0 0 1px rgba(255,255,255,0.25); }
        #recording-strip-overlay .label { user-select:none; font-weight:600; font-size:12.5px; letter-spacing:.3px; }
        #recording-strip-overlay .hidden { display:none !important; }
        /* --- Mini glass video player --- */
        #rec-video-player { position:fixed; z-index:2147483646; left:50%; transform:translateX(-50%); top:80px; width:240px; height:135px; border-radius:12px; overflow:hidden; backdrop-filter:blur(10px) saturate(140%); -webkit-backdrop-filter:blur(10px) saturate(140%); background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); box-shadow:0 6px 18px rgba(0,0,0,0.28); transition:width .22s ease,height .22s ease,transform .18s ease,opacity .18s; display:flex; align-items:center; justify-content:center; }
        @media (prefers-color-scheme:dark){ #rec-video-player { background:rgba(18,18,22,0.36); border-color:rgba(120,120,140,0.08); } }
        #rec-video-player.expanded { width:480px; height:270px; }
        #rec-video-player .player-inner { width:100%; height:100%; position:relative; }
        #rec-video-player video { width:100%; height:100%; object-fit:cover; display:block; background:transparent; }
        #rec-video-player .controls { position:absolute; left:0; right:0; bottom:8px; display:flex; justify-content:center; gap:8px; pointer-events:auto; }
        #rec-video-player .dot { width:8px; height:8px; border-radius:999px; background:rgba(255,255,255,0.4); opacity:0.9; transition:transform .15s, background .12s; }
        #rec-video-player .dot.active { transform:scale(1.25); background:rgba(255,255,255,0.95); }
        #rec-video-player .arrow { position:absolute; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.28); color:#fff; border-radius:999px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        #rec-video-player .arrow.left { left:8px; }
        #rec-video-player .arrow.right { right:8px; }
        #rec-video-player .top-right { position:absolute; top:6px; right:6px; display:flex; gap:6px; }
        #rec-video-player button.small { background:rgba(255,255,255,0.06); color:#fff; border:none; width:28px; height:28px; border-radius:6px; cursor:pointer; }
        #rec-video-player .meta { position:absolute; left:8px; top:8px; color:rgba(255,255,255,0.9); font-size:11px; font-weight:600; text-shadow:0 1px 0 rgba(0,0,0,0.6); }
        #rec-video-player .hidden { display:none !important; }
      `;
      document.documentElement.appendChild(style);
    }

    function createStrip() {
      const strip = document.createElement('div');
      strip.id = 'recording-strip-overlay';
      strip.innerHTML = `
        <div class="drag w-[100px]" title="Drag">Drag</div>
        <span class="rec-dot" title="Idle"></span>
        <span class="label">Recorder Idle</span>
        <button class="start" type="button">Start</button>
        <button class="stop hidden" type="button">Stop</button>
        <button class="hide" type="button">Hide</button>
      `;
      document.documentElement.appendChild(strip);
      return strip;
    }

    function createPlayer() {
      const cont = document.createElement('div');
      cont.id = 'rec-video-player';
      cont.innerHTML = `
        <div class="player-inner">
          <video playsinline webkit-playsinline controls></video>
          <div class="arrow left" title="Previous">‹</div>
          <div class="arrow right" title="Next">›</div>
          <div class="top-right">
            <button class="small btn-expand" title="Expand">⤢</button>
          </div>
          <div class="meta hidden">0 / 0</div>
          <div class="controls"></div>
        </div>
      `;
      document.documentElement.appendChild(cont);

      // state
      const video = cont.querySelector('video');
      const left = cont.querySelector('.arrow.left');
      const right = cont.querySelector('.arrow.right');
      const dotsWrap = cont.querySelector('.controls');
      const meta = cont.querySelector('.meta');
      const btnExpand = cont.querySelector('.btn-expand');
      // const btnAdd = cont.querySelector('.btn-add');

      let videos = [/* default empty; can be set via messages */];
      let idx = 0;
      let isExpanded = false;

      cont.style.visibility = 'hidden';

      function renderDots() {
        dotsWrap.innerHTML = '';
        videos.forEach((v, i) => {
          const s = document.createElement('span');
          s.className = 'dot' + (i === idx ? ' active' : '');
          s.title = v;
          s.addEventListener('click', () => showVideoAt(i));
          dotsWrap.appendChild(s);
        });
        meta.textContent = (videos.length ? (idx + 1) + ' / ' + videos.length : '0 / 0');
        meta.classList.toggle('hidden', videos.length === 0);
      }

      function showVideoAt(i) {
        if (!videos.length) return;
        idx = (i + videos.length) % videos.length;
        // smooth fade
        cont.style.opacity = '0.85';
        setTimeout(() => {
          video.src = videos[idx];
          try { video.play().catch(()=>{}); } catch(e){}
          renderDots();
          cont.style.opacity = '1';
        }, 140);
      }

      function next() { if (!videos.length) return; showVideoAt(idx + 1); }
      function prev() { if (!videos.length) return; showVideoAt(idx - 1); }

      left.addEventListener('click', prev);
      right.addEventListener('click', next);
      btnExpand.addEventListener('click', () => toggleExpand());
      // btnAdd.addEventListener('click', () => addUrlPrompt());

      video.addEventListener('ended', () => { next(); });

      function toggleExpand() { isExpanded = !isExpanded; cont.classList.toggle('expanded', isExpanded); }

      function setVideos(arr, startIndex = 0) {
        videos = Array.isArray(arr) ? arr.slice() : [];
        idx = Math.max(0, Math.min(startIndex, videos.length - 1));
        renderDots();
        if (videos.length) showVideoAt(idx);
      }

      function addUrl(url) {
        if (!url) return;
        videos.push(url);
        setVideos(videos, videos.length - 1);
      }

      // expose API
      cont.__player = { setVideos, addUrl, next, prev, toggleExpand };

      // initial render
      renderDots();
      updatePlayerPosition();
      return cont;
    }

    function enableDrag(container, handle) {
      let dragging = true;
      let ox = 0;
      let oy = 0;
      handle.addEventListener('mousedown', (e) => {
        dragging = true;
        const r = container.getBoundingClientRect();
        ox = e.clientX - r.left;
        oy = e.clientY - r.top;
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        e.preventDefault();
      });
      function move(e) {
        if (!dragging) return;
        container.style.left = e.clientX - ox + 'px';
        container.style.top = e.clientY - oy + 'px';
        container.style.transform = 'translateX(0)';
        // reposition player under the strip while dragging
        try { updatePlayerPosition(); } catch (er) { /* ignore */ }
      }
      function up() {
        dragging = false;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      }
    }

    // basic keyboard shortcuts when the player is visible: left/right arrows to navigate, +/- to expand
    window.addEventListener('keydown', (e) => {
      const p = document.getElementById('rec-video-player');
      if (!p) return;
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      const player = p.__player;
      if (!player) return;
      if (e.key === 'ArrowRight') { player.next(); }
      if (e.key === 'ArrowLeft') { player.prev(); }
      if (e.key === '+' || e.key === '=') { player.toggleExpand(); }
    });

    function updatePlayerPosition() {
      try {
        const cont = document.getElementById('rec-video-player');
        const strip = document.getElementById('recording-strip-overlay');
        if (!cont || !strip) return;
        const r = strip.getBoundingClientRect();
        // position player centered under the strip, with a small gap
        const top = window.scrollY + r.top + r.height + 8;
        cont.style.top = top + 'px';
        // keep horizontally centered to strip
        const center = r.left + r.width / 2 + window.scrollX;
        cont.style.left = center + 'px';
        cont.style.transform = 'translateX(-50%)';
      } catch (e) { /* ignore */ }
    }

    // ---------------------- Socket.IO integration ----------------------
    // Load socket.io client if needed and listen for 'video_uploaded' events.
    function initSocketIO() {
      console.log('[RecorderOverlay] initSocketIO');
      const SOCKET_SERVER = window.__SOCKETIO_SERVER__ || 'http://localhost:5000';

      console.log('[RecorderOverlay] initSocketIO to', SOCKET_SERVER);

      function setupSocket() {
        try {
          console.log('[RecorderOverlay] attempting io() connect to', SOCKET_SERVER);
          const socket = io(SOCKET_SERVER);
          socket.on('connect', () => console.log('[RecorderOverlay] socket connected'));
          socket.on('disconnect', () => console.log('[RecorderOverlay] socket disconnected'));
          socket.on('video_uploaded', (data) => {
            console.log('[RecorderOverlay] video_uploaded', data);
            handleIncomingVideo(data);
          });
          // store for potential future use
          window.__rec_socket = socket;
        } catch (err) {
          console.warn('[RecorderOverlay] socket setup failed', err);
        }
      }

      // quick reachability test for the socket.io polling endpoint
      async function checkServerAndLoad() {
        const pingUrl = SOCKET_SERVER.replace(/\/$/, '') + '/socket.io/?EIO=4&transport=polling';
        console.log('[RecorderOverlay] checking socket server reachability at', pingUrl);
        let reachable = false;
        try {
          const resp = await fetch(pingUrl, { method: 'GET', mode: 'cors' });
          console.log('[RecorderOverlay] socket server ping status', resp.status);
          reachable = resp.ok || resp.status === 400 || resp.status === 200;
        } catch (err) {
          console.warn('[RecorderOverlay] socket server ping failed', err);
        }

        if (!window.io) {
          // Prefer loading a local vendor copy packaged with the extension to satisfy CSP.
          try {
            const localUrl = chrome && chrome.runtime && chrome.runtime.getURL
              ? chrome.runtime.getURL('vendor/socket.io.min.js')
              : null;
            if (localUrl) {
              const s = document.createElement('script');
              s.src = localUrl;
              s.onload = () => {
                console.log('[RecorderOverlay] loaded socket.io client from extension vendor');
                if (!reachable) console.warn('[RecorderOverlay] server did not respond to ping; connection may still fail');
                setupSocket();
              };
              s.onerror = () => {
                console.warn('[RecorderOverlay] failed to load local socket.io client from', localUrl, 'falling back to CDN (may be blocked by CSP)');
                // fallback to CDN (may be blocked by extension CSP)
                const s2 = document.createElement('script');
                s2.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
                s2.onload = () => {
                  console.log('[RecorderOverlay] loaded socket.io client from CDN');
                  if (!reachable) console.warn('[RecorderOverlay] server did not respond to ping; connection may still fail');
                  setupSocket();
                };
                s2.onerror = () => console.warn('[RecorderOverlay] failed to load socket.io client from CDN (CSP?)');
                document.head.appendChild(s2);
              };
              document.head.appendChild(s);
            } else {
              // no chrome.runtime.getURL available; fallback to CDN
              const s = document.createElement('script');
              s.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
              s.onload = () => {
                console.log('[RecorderOverlay] loaded socket.io client from CDN');
                if (!reachable) console.warn('[RecorderOverlay] server did not respond to ping; connection may still fail');
                setupSocket();
              };
              s.onerror = () => console.warn('[RecorderOverlay] failed to load socket.io client from CDN (CSP?)');
              document.head.appendChild(s);
            }
          } catch (err) {
            console.warn('[RecorderOverlay] error while attempting to load local socket.io client', err);
          }
        } else {
          if (!reachable) console.warn('[RecorderOverlay] server did not respond to ping; connection may still fail');
          setupSocket();
        }
      }

      checkServerAndLoad().catch((e)=>console.warn('[RecorderOverlay] checkServerAndLoad error', e));
    }

    function handleIncomingVideo(data) {
      try {
        const url = data && data.url;
        if (!url) return;
        const p = document.getElementById('rec-video-player') || playerContainer;
        if (!p) return;

        // If the player was hidden, make it visible
        if (p.style.visibility === 'hidden' || getComputedStyle(p).display === 'none') {
          p.style.visibility = 'visible';
        }

        // Add URL to playlist and navigate to it. addUrl will set the current index to the new one.
        if (p.__player && typeof p.__player.addUrl === 'function') {
          p.__player.addUrl(url);
        } else {
          // fallback: send a runtime message so other parts can handle it
          try { chrome.runtime.sendMessage({ type: 'PLAYER_ADD_VIDEO', url }); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.warn('[RecorderOverlay] handleIncomingVideo error', e);
      }
    }

  // socket events are handled by the extension background worker; do not load a
  // Socket.IO client into page context (CSP and page policies prevent this).
  console.log('[RecorderOverlay] socket events are handled by background worker');
  } catch (err) {
    console.error('[RecorderOverlay] fatal init error', err);
  }
})();