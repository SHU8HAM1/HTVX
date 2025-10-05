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
