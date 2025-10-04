async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({});
  const exists = contexts.find(c => c.contextType === 'OFFSCREEN_DOCUMENT');
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Record tab via tabCapture with popup closed'
    });
  }
}

// (Optional) remove this old action click handler if no longer needed
// chrome.action.onClicked.addListener(...);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'POPUP_START') {
      await ensureOffscreen();
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: activeTab.id });
      chrome.runtime.sendMessage({
        type: 'start-recording',
        target: 'offscreen',
        data: streamId
      });
      sendResponse({ ok: true });
    } else if (msg.type === 'POPUP_STOP') {
      chrome.runtime.sendMessage({
        type: 'stop-recording',
        target: 'offscreen'
      });
      sendResponse({ ok: true });
    }
  })();
  return true; // keep channel open
});