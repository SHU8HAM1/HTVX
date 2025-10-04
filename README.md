# Screen Streamer Extension

Chrome (MV3) extension that captures the user's screen and streams it to a Python backend via WebRTC. The backend (aiohttp + aiortc) receives the stream and periodically saves video frames as JPG files.

## Features
- Capture current tab without picker (chrome.tabCapture)
- Traditional full screen/window/tab capture via getDisplayMedia
- WebRTC peer connection with STUN server
- Simple signaling over HTTPS POST /webrtc/offer
- Backend saves every ~30th frame to `backend/frames/`

## Directory Structure
```
manifest.json              (root)
frontend/
  hello.html
  background.js
  scripts/
    popup.js
backend/
  videoParse.py
  frames/ (created automatically)
requirements.txt
```

## Prerequisites
- Python 3.10+
- Google Chrome

## Install Backend Dependencies
```cmd
pip install -r requirements.txt
```

## Run Backend
```cmd
python backend/videoParse.py
```
The server listens on `http://localhost:5000`.

## Load / Reload Extension in Chrome
1. Go to chrome://extensions
2. Enable Developer Mode
3. Click "Load unpacked" and select the project root folder (the one containing `manifest.json`).
4. After changes to `manifest.json`, click the Reload (⟳) button on the extension card.
5. Click "Inspect service worker" to verify console logs and test `chrome.tabCapture` availability (`chrome.tabCapture` should log an object).

## Use
Option A (Preferred minimal friction):
1. Click "Capture This Tab" (no system picker appears)
2. Current tab begins streaming immediately (handled in background service worker)
3. You can close the popup or navigate within the tab; streaming persists
4. Frames appear in `backend/frames`

Option B (Broader capture):
1. Click "Start Recording"
2. Choose screen/window/tab in system picker
3. Frames appear in `backend/frames`

Click "Stop Recording" to end either mode.

Reopening the popup while a tab stream is active will show status "Tab streaming (background)".

## Notes
- Tab capture only streams the current tab's content (no OS chrome or other windows).
- Full capture still uses the system picker and may show a small dialog; that's normal.
- Minimal error handling and no authentication; add proper security for production.
- To reduce bandwidth or frame saves, adjust frame rate and the modulo check in `videoParse.py`.
- If enterprise policies block capture APIs, coordinate with admin to enable `tabCapture`.

## Next Steps / Ideas
- Persist full video using `aiortc.contrib.media.MediaRecorder` (FFmpeg required)
- Add audio track capture
- Implement authentication / API keys
- Retry logic for ICE failures
- Switch to websockets for real-time signaling
- Automatic reconnection / health checks for long-running sessions
