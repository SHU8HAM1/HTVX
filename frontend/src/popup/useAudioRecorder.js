import { useCallback, useRef, useState } from 'react';

export function useAudioRecorder() {
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const chunksRef = useRef([]);

  const start = useCallback(async () => {
    if (isRecording) return;
    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        } catch (err) {
          console.error('Blob creation failed', err);
        }
      };
      mr.start();
      setIsRecording(true);
    } catch (e) {
      setError(e.message || 'Unable to access microphone');
    }
  }, [isRecording]);

  const stop = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== 'recording') return;
    mr.stop();
    mr.stream.getTracks().forEach(t => t.stop());
    setIsRecording(false);
  }, []);

  const play = useCallback(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.play();
  }, [audioUrl]);

  const download = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
  }, [audioUrl]);

  return { isRecording, audioUrl, error, start, stop, play, download };
}
