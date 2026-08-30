import React, { useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { X, Film, Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { VideoInfo, SubtitleTrackConfig } from '../types';
import { formatDuration } from '../utils/formatters';

interface VideoPreviewModalProps {
  videoInfo: VideoInfo | null;
  subtitles: SubtitleTrackConfig[];
  onClose: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  videoInfo,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(videoInfo?.duration_secs || 0);

  if (!videoInfo) return null;

  const videoSrc = convertFileSrc(videoInfo.path);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 text-zinc-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-zinc-800">
          <div className="flex items-center space-x-2.5 min-w-0 pr-4">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm truncate" title={videoInfo.filename}>
              {videoInfo.filename}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Container */}
        <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={videoSrc}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setDuration(videoRef.current.duration || videoInfo.duration_secs);
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-contain"
            onClick={togglePlay}
          />
        </div>

        {/* Player Controls Bar */}
        <div className="px-5 pb-4 space-y-2">
          {/* Progress / Scrub bar */}
          <div className="flex items-center space-x-3 text-xs font-mono text-zinc-400">
            <span>{formatDuration(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <span>{formatDuration(duration)}</span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={togglePlay}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
