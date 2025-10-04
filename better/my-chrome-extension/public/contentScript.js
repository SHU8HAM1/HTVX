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
      if (isRecording) return;
      try {
        console.log('[RecorderOverlay] start requested');
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        chunks = [];
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        mediaRecorder.onstop = handleStop;
        mediaRecorder.start();
        isRecording = true;
        setRecording(true);
      } catch (e) {
        console.warn('[RecorderOverlay] Start failed', e);
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
          window.__recordingStripInjected = false;
          sendResponse(currentState());
          return true;
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
      }
      function up() {
        dragging = false;
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      }
    }
  } catch (err) {
    console.error('[RecorderOverlay] fatal init error', err);
  }
})();