let socket;
let pc; //using this for rtc peer connection
let dataChannel;

// Try to load a packaged socket.io client via importScripts (works inside service worker scope)
try {
  importScripts(chrome.runtime.getURL('vendor/socket.io.min.js'));
  console.log('[ServiceWorker] imported socket.io client from vendor');
} catch (e) {
  console.warn('[ServiceWorker] could not import socket.io vendor', e);
}

// Test helper: broadcast a PLAYER_ADD_VIDEO message to all tabs (callable from SW console)
function testAddVideo(url) {
    if (!url) url = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
    console.log('[ServiceWorker:testAddVideo] broadcasting', url);
    chrome.tabs.query({}, (tabs) => {
        for (const t of tabs) {
            try {
                chrome.tabs.sendMessage(t.id, { type: 'PLAYER_ADD_VIDEO', url });
            } catch (e) { /* ignore */ }
        }
    });
}

// Also allow triggering via runtime message from UI or console: { type: 'TEST_ADD_VIDEO', url }
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('test_add_video')
    if (msg && msg.type === 'TEST_ADD_VIDEO') {
        try {
            testAddVideo(msg.url);
            sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, error: String(e) }); }
        return true;
    }
});

// Forward modified chunks received via runtime messaging to the backend socket
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('modified_chunk')
    if (msg && msg.type === 'MODIFIED_CHUNK') {
        try {
            // Ensure socket is initialized
            if (!socket) initializeSocket();
            if (socket && typeof socket.emit === 'function') {
                // Send binary chunk (ArrayBuffer/Blob/string) to backend
                socket.emit('upload_chunk', msg.chunk);
                sendResponse({ ok: true });
            } else {
                console.warn('[ServiceWorker] cannot forward chunk, socket not available');
                sendResponse({ ok: false, error: 'socket not available' });
            }
        } catch (e) {
            console.error('[ServiceWorker] failed to forward chunk', e);
            sendResponse({ ok: false, error: String(e) });
        }
        return true;
    }
});

// Handle direct upload messages from content scripts: { type: 'UPLOAD_CHUNK', chunk }
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('upload chunk')
    if (msg && msg.type === 'UPLOAD_CHUNK') {
        console.log('upload chunk in if')
        (async () => {
            try {
                if (!socket) initializeSocket();
                if (!socket || typeof socket.emit !== 'function') {
                    sendResponse({ ok: false, error: 'socket not available' });
                    return;
                }

                let payload = msg.chunk;
                // If it's a Blob (from MediaRecorder), convert to ArrayBuffer for predictable binary transport
                if (payload && typeof payload.arrayBuffer === 'function') {
                    payload = await payload.arrayBuffer();
                }

                socket.emit('upload_chunk', payload);
                sendResponse({ ok: true });
            } catch (err) {
                console.error('[ServiceWorker] UPLOAD_CHUNK handler failed', err);
                sendResponse({ ok: false, error: String(err) });
            }
        })();
        return true; // indicates async sendResponse
    }
});

// initialize socket connection; forwards events to content scripts in tabs
const initializeSocket = (serverUrl = 'http://localhost:5000') => {
    try {
        console.log('initializeSocket')
        if (typeof io === 'function') {
            socket = io(serverUrl);
            socket.on('connect', () => console.log('[ServiceWorker] socket connected'));
            socket.on('disconnect', () => console.log('[ServiceWorker] socket disconnected'));
            socket.on('video_uploaded', (data) => {
                console.log('[ServiceWorker] video_uploaded', data);
                // Broadcast to all tabs so content scripts receive it
                chrome.tabs.query({}, (tabs) => {
                    for (const t of tabs) {
                        try { chrome.tabs.sendMessage(t.id, { type: 'PLAYER_ADD_VIDEO', url: data.url }); } catch (err) { /* ignore */ }
                    }
                });
            });
            // listen for per-chunk ACKs
            socket.on('chunk_saved', (data) => {
                console.log('[ServiceWorker] chunk_saved', data);
                chrome.tabs.query({}, (tabs) => {
                    for (const t of tabs) {
                        try { chrome.tabs.sendMessage(t.id, { type: 'CHUNK_SAVED', info: data }); } catch (err) { /* ignore */ }
                    }
                });
            });
        } else {
            console.warn('[ServiceWorker] socket.io client not available (io is not defined)');
        }
    } catch (err) {
        console.warn('[ServiceWorker] initializeSocket failed', err);
    }
}

// Expose helpers on the global scope so they are callable from the SW console
try {
    globalThis.initializeSocket = initializeSocket;
    globalThis.testAddVideo = testAddVideo;
    // small helper to send a synthetic chunk for debugging
    globalThis.testUploadChunk = async function testUploadChunk(size = 16) {
        try {
            if (!socket) initializeSocket();
            // wait up to ~3s for socket to connect
            const start = Date.now();
            while ((!socket || typeof socket.emit !== 'function' || socket.connected === false) && Date.now() - start < 3000) {
                await new Promise((r) => setTimeout(r, 120));
            }
            if (!socket || typeof socket.emit !== 'function') {
                console.warn('[ServiceWorker:testUploadChunk] socket not available after wait');
                return { ok: false, error: 'socket not available' };
            }
            const arr = new Uint8Array(size);
            for (let i = 0; i < size; i++) arr[i] = i & 0xff;
            const buf = arr.buffer;
            socket.emit('upload_chunk', buf);
            console.log('[ServiceWorker:testUploadChunk] emitted chunk size=', size);
            return { ok: true };
        } catch (err) {
            console.error('[ServiceWorker:testUploadChunk] error', err);
            return { ok: false, error: String(err) };
        }
    };
} catch (err) {
    console.warn('[ServiceWorker] could not attach globals', err);
}

// Make a best-effort to initialize the socket connection when the service worker starts
try { initializeSocket(); } catch(e){ console.warn('[ServiceWorker] initializeSocket auto-start failed', e); }

//initialize webrtc peer connection
const initializeWebRTC = () => {
    pc = new RTCPeerConnection();

    //create data channel to send in the video chunks
    dataChannel = pc.createDataChannel("vid-chunks");

    //listen for incoming data from the backend
    pc.ondatachannel = (event) => {
        const channel = event.channel;
        channel.onmessage = (msgEvent) => {
            console.log("Recieve WebRTC message from backend: ", msgEvent.data);
            chrome.runtime.sendMessage({
                type: "MODIFIED_CHUNK", chunk: msgEvent.data
            });
        }
    }

    //handles ice candidate
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("ice-candidate", event.candidate);
        }
    }

}



