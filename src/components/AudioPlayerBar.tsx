import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  X,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Sparkles
} from 'lucide-react';
import { CallRecording } from '../services/storageService';
import { formatDuration, formatBytes } from '../utils/formatters';

interface AudioPlayerBarProps {
  recording: CallRecording | null;
  onClose: () => void;
  isPersian: boolean;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  recording,
  onClose,
  isPersian,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!recording) return;

    setCurrentTime(0);
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        // Auto-play might be restricted
        console.log('Autoplay prevented:', e);
      });
    }
  }, [recording]);

  if (!recording) return null;

  const audioSrc = recording.audioUrl || (recording.mp3Blob ? URL.createObjectURL(recording.mp3Blob) : '');

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value);
    setCurrentTime(target);
    if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const skipSeconds = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.min(duration || recording.duration, Math.max(0, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleDownload = () => {
    if (!recording.mp3Blob) return;
    const url = URL.createObjectURL(recording.mp3Blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = (recording.contactName || 'call')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .substring(0, 30);
    const dateStr = new Date(recording.timestamp).toISOString().slice(0, 10);
    a.download = `${cleanName}_${dateStr}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const displayDuration = duration || recording.duration;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl p-3 md:px-8 transition-transform w-full max-w-full overflow-hidden"
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 w-full max-w-full overflow-hidden">
        {/* Left: Call Info */}
        <div className="flex items-center gap-3 w-full md:w-auto min-w-[200px] justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${recording.direction === 'incoming' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
              {recording.direction === 'incoming' ? (
                <PhoneIncoming className="w-4 h-4" />
              ) : (
                <PhoneOutgoing className="w-4 h-4" />
              )}
            </div>
            <div className="truncate max-w-[160px] md:max-w-[240px]">
              <div className="text-xs font-semibold text-slate-100 truncate">
                {recording.contactName}
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                <span>{recording.phoneNumber}</span>
                <span>·</span>
                <span>{formatBytes(recording.sizeBytes)}</span>
                <span>·</span>
                <span className="text-amber-400">MP3 ({recording.bitrate}k)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={handleDownload}
              className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors"
              title="Download MP3"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Playback Controls & Progress Bar */}
        <div className="flex-1 max-w-2xl w-full flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => skipSeconds(-10)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-0.5"
              title="10s Back"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[10px] font-mono">10</span>
            </button>

            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={() => skipSeconds(10)}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors text-xs flex items-center gap-0.5"
              title="10s Forward"
            >
              <RotateCw className="w-4 h-4" />
              <span className="text-[10px] font-mono">10</span>
            </button>

            <button
              onClick={cyclePlaybackRate}
              className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
              title="Speed"
            >
              {playbackRate}x
            </button>
          </div>

          {/* Time scrubber bar */}
          <div className="w-full flex items-center gap-2 text-[11px] font-mono text-slate-400 tabular-nums">
            <span className="w-10 text-left">{formatDuration(Math.round(currentTime))}</span>
            <input
              type="range"
              min={0}
              max={displayDuration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="w-10 text-right">{formatDuration(Math.round(displayDuration))}</span>
          </div>
        </div>

        {/* Right: Volume & Download MP3 & Close */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="hover:text-slate-200"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = Number(e.target.value);
                setVolume(val);
                setIsMuted(false);
                if (audioRef.current) {
                  audioRef.current.volume = val;
                  audioRef.current.muted = false;
                }
              }}
              className="w-16 h-1 bg-slate-800 rounded appearance-none accent-slate-400 cursor-pointer"
            />
          </div>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-lg transition-colors"
            title="Download MP3"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isPersian ? 'دانلود MP3' : 'Download MP3'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
