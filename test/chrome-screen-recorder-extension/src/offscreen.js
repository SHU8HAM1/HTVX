// Offscreen recorder: guarded single-session tab capture
// Handles start/stop messages and prevents duplicate captures.

chrome.runtime.onMessage.addListener((message) => {
  if (message.target === 'offscreen') {
    switch (message.type) {
      case 'start-recording':
        if (!isRecording && !isStopping) {
          startRecording(message.data);
        }
        break;
      case 'stop-recording':
        console.log('Offscreen: stop-recording message received');
        stopRecording();
        break;
      default:
        console.warn('Offscreen: unrecognized message', message.type);
    }
  }
});

let recorder;
let data = [];
let mediaStream;
let audioCtx;
let isRecording = false;
let isStopping = false;

async function getTabMedia(streamId) {
  // Acquire a tab-specific stream using the provided streamId via getUserMedia.
  return navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30
      }
    }
  });
}

async function startRecording(streamId) {
  try {
    if (isRecording || isStopping) return;

    mediaStream = await getTabMedia(streamId);

    // Optional live playback of captured audio (can remove to avoid extra audio pipeline)
    try {
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(mediaStream);
      source.connect(audioCtx.destination);
    } catch (err) {
      console.warn('AudioContext init failed (continuing anyway):', err);
    }

    data = [];
    recorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm' });
    isRecording = true;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) data.push(e.data);
    };

    recorder.onstop = () => {
      try {
        const blob = new Blob(data, { type: 'video/webm' });
        // For now open in new tab; could send to background for download instead.
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (e) {
        console.error('Assemble blob failed:', e);
      } finally {
        cleanup();
      }
    };

    recorder.start(200); // collect data every 200ms
    window.location.hash = 'recording';
    console.log('Offscreen: recording started');
  } catch (e) {
    console.error('startRecording error:', e);
    cleanup();
  }
}

function stopRecording() {
  if (!recorder || recorder.state !== 'recording' || isStopping) return;
  isStopping = true;
  console.log('Offscreen: stop requested');
  // Stop outgoing tracks first so the recorder quickly flushes remaining data.
  try {
    mediaStream?.getTracks().forEach(tr => {
      try { tr.stop(); } catch {}
    });
  } catch (trackErr) {
    console.warn('Track stop issue:', trackErr);
  }
  window.location.hash = '';

  // Safety timer: if onstop never fires (edge cases) we cleanup anyway.
  const failSafe = setTimeout(() => {
    if (recorder && recorder.state === 'recording') {
      console.warn('Fail-safe forcing recorder.stop');
      try { recorder.stop(); } catch {}
    } else if (recorder) {
      cleanup();
    }
  }, 5000);

  try {
    recorder.onstop = () => {
      clearTimeout(failSafe);
      try {
        const blob = new Blob(data, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        // Notify background we finished (optional consumption there)
        chrome.runtime.sendMessage({ type: 'recording-stopped', target: 'background', blobUrl: url });
        window.open(url, '_blank');
      } catch (e) {
        console.error('Assemble blob failed:', e);
      } finally {
        cleanup();
      }
    };
    recorder.stop();
  } catch (e) {
    console.error('stopRecording error:', e);
    cleanup();
  }
}

function cleanup() {
  try {
    mediaStream?.getTracks().forEach(t => {
      try { t.stop(); } catch {}
    });
    if (audioCtx) {
      try { audioCtx.close(); } catch {}
    }
  } finally {
    recorder = undefined;
    mediaStream = undefined;
    audioCtx = undefined;
    data = [];
    isRecording = false;
    isStopping = false;
    window.location.hash = '';
    console.log('Offscreen: cleaned up');
  }
}