// Minimal background service worker placeholder
// Currently capture/recording happens in the content script because getDisplayMedia
// must be invoked from a document context. This worker can be extended for
// download handling or offscreen documents if desired.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'PING') {
    sendResponse({ ok: true });
    return true;
  }
});
