import React from 'react';
import { useAudioRecorder } from './useAudioRecorder';

const Icon = ({ name, className = '' }) => <i className={`si-${name} ${className}`}></i>;

export default function Popup() {
  const { isRecording, audioUrl, error, start, stop, play, download } = useAudioRecorder();
  const toggle = () => (isRecording ? stop() : start());

  const shellClasses = 'w-full h-full flex items-center justify-center px-3 relative rounded-2xl border border-white/15 shadow-[0_6px_22px_-6px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-xl bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),rgba(15,15,17,0.72))]';
  const toolbarClasses = 'flex items-center w-full justify-between gap-4';
  const statusClasses = 'flex items-center gap-2 text-neutral-300 font-medium tracking-wide flex-1';
  const controlsClasses = 'flex items-center gap-3';
  const baseBtn = 'w-10 h-10 rounded-2xl border border-white/20 flex items-center justify-center text-neutral-100 transition relative overflow-hidden bg-gradient-to-br from-white/25 to-white/5 backdrop-blur-lg hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.14)] active:translate-y-0 active:scale-95 active:shadow-inner disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale disabled:hover:translate-y-0';
  const recordActive = 'from-rose-500 to-rose-900 shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_6px_16px_-4px_rgba(255,50,80,0.6),0_0_10px_2px_rgba(255,60,80,0.55)] animate-pulse';
  const dotBase = 'w-2.5 h-2.5 rounded-full transition bg-gradient-to-br from-neutral-500 to-neutral-700 shadow-[0_0_0_2px_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.55)_inset]';
  const dotRecording = 'from-rose-400 to-rose-900 shadow-[0_0_6px_2px_rgba(255,70,70,0.55),0_0_0_2px_rgba(255,255,255,0.08)]';

  return (
    <div className={shellClasses}>
      <div className={toolbarClasses}>
        <div className={statusClasses}>
          <div className={`${dotBase} ${isRecording ? dotRecording : ''} ${isRecording ? 'animate-pulse' : ''}`} />
          <span className="text-[13px]" aria-live="polite">
            {error ? `Error: ${error}` : isRecording ? 'Recording…' : audioUrl ? 'Ready (recorded)' : 'Ready'}
          </span>
        </div>
        <div className={controlsClasses}>
          <button
            id="recordBtn"
            aria-pressed={isRecording}
            onClick={toggle}
            className={`${baseBtn} ${isRecording ? recordActive : ''}`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            <Icon name={isRecording ? 'square' : 'circle'} />
          </button>
            <button
              id="playBtn"
              className={baseBtn}
              disabled={!audioUrl}
              onClick={play}
              title="Play Recording"
            >
              <Icon name="play" />
            </button>
            <button
              id="downloadBtn"
              className={baseBtn}
              disabled={!audioUrl}
              onClick={download}
              title="Download Recording"
            >
              <Icon name="download" />
            </button>
        </div>
      </div>
    </div>
  );
}
