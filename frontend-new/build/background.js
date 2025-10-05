// Background service worker - Updated to use fetch instead of Socket.IO
console.log('[background] background.js loaded and running');

const SERVER_URL = 'http://localhost:5000';

// Message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[background] received message:', msg?.type);
  
  if (msg?.type === 'PING') {
    sendResponse({ ok: true });
    return true;
  }

  // Handle upload chunks from content script
  if (msg?.type === 'UPLOAD_CHUNK') {
    (async () => {
    try {
      console.log('[background] received UPLOAD_CHUNK message');
      
      let payload = msg.chunk;
      
      // Convert array back to Uint8Array
      if (Array.isArray(payload)) {
        payload = new Uint8Array(payload);
      }
      
      const payloadSize = payload?.byteLength || payload?.length || 0;
      console.log('[background] uploading chunk, size:', payloadSize);
      
      // Send to Flask
      const response = await fetch(`${SERVER_URL}/upload_chunk`, {
        method: 'POST',
        body: payload,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[background] chunk uploaded successfully:', result);
        
        // Notify content script of success
        try {
          chrome.tabs.query({}, (tabs) => {
            for (const tab of tabs) {
              try {
                chrome.tabs.sendMessage(tab.id, {
                  type: 'CHUNK_SAVED',
                  info: result
                });
              } catch (e) {
                // Tab might not have content script
              }
            }
          });
        } catch (e) {
          console.warn('[background] failed to notify tabs:', e);
        }
        
        sendResponse({ ok: true, result });
        
      } catch (err) {
        console.error('[background] UPLOAD_CHUNK error:', err);
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true; // Keep channel open for async response
  }

  // Test endpoint
  if (msg?.type === 'TEST_UPLOAD_CHUNK') {
    (async () => {
      try {
        const size = msg.size || 1024;
        const testData = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
          testData[i] = i & 0xff;
        }
        
        const response = await fetch(`${SERVER_URL}/upload_chunk`, {
          method: 'POST',
          body: testData.buffer,
          headers: {
            'Content-Type': 'application/octet-stream'
          }
        });
        
        const result = await response.json();
        console.log('[background] test upload result:', result);
        sendResponse({ ok: true, result });
        
      } catch (e) {
        console.error('[background] test upload failed:', e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  // Health check
  if (msg?.type === 'CHECK_SERVER') {
    (async () => {
      try {
        const response = await fetch(`${SERVER_URL}/health`);
        const result = await response.json();
        sendResponse({ ok: true, connected: true, result });
      } catch (e) {
        sendResponse({ ok: false, connected: false, error: String(e) });
      }
    })();
    return true;
  }
});

// On extension icon click: inject content script
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[background] extension icon clicked');
  if (!tab?.id) return;
  
  try {
    // Check if content script already exists
    const [{ result: hadListener } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (window.__recordingStripInjected) {
          const el = document.getElementById('recording-strip-overlay');
          if (el) el.style.visibility = 'visible';
          return true;
        }
        return false;
      }
    });

    if (hadListener) {
      console.log('[background] content script already present');
      return;
    }

    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['contentScript.js']
    });
    console.log('[background] content script injected');
    
  } catch (e) {
    console.error('[background] failed to inject content script:', e);
  }
});

// Test server connection on startup
(async () => {
  try {
    const response = await fetch(`${SERVER_URL}/health`);
    const result = await response.json();
    console.log('[background] server connection OK:', result);
  } catch (e) {
    console.warn('[background] server not reachable (this is OK if server not started yet):', e.message);
  }
})();

// Expose test function
globalThis.testUploadChunk = async function(size = 1024) {
  try {
    const testData = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      testData[i] = i & 0xff;
    }
    
    const response = await fetch(`${SERVER_URL}/upload_chunk`, {
      method: 'POST',
      body: testData.buffer,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });
    
    const result = await response.json();
    console.log('[background] test result:', result);
    return { ok: true, result };
  } catch (e) {
    console.error('[background] test failed:', e);
    return { ok: false, error: String(e) };
  }
};

console.log('[background] initialization complete');