import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Film, UploadCloud, X, Clock, HardDrive, FileVideo, Music, Subtitles } from 'lucide-react';
import { VideoInfo } from '../types';
import { formatBytes, formatDuration } from '../utils/formatters';

interface VideoDropzoneProps {
  videoInfo: VideoInfo | null;
  isProbing: boolean;
  onSelectVideo: (filePath: string) => void;
  onClearVideo: () => void;
}

export const VideoDropzone: React.FC<VideoDropzoneProps> = ({
  videoInfo,
  isProbing,
  onSelectVideo,
  onClearVideo,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handlePickFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: 'Select Video File',
        filters: [
          {
            name: 'Video Files (*.mkv, *.mp4, *.m4v, *.mov, *.avi)',
            extensions: ['mkv', 'mp4', 'm4v', 'mov', 'avi', 'ts'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        onSelectVideo(selected);
      }
    } catch (err) {
      console.error('File picker error:', err);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const path = (file as any).path || file.name;
      if (path) {
        onSelectVideo(path);
      }
    }
  };

  if (isProbing) {
    return (
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 flex flex-col items-center justify-center space-y-3 animate-pulse shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center">
          <Film className="w-5 h-5 animate-spin" />
        </div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Analyzing video streams & duration...</p>
      </div>
    );
  }

  if (videoInfo) {
    const videoStream = videoInfo.streams.find((s) => s.codec_type === 'video');
    return (
      <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 relative group transition-all shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3.5 flex-1 min-w-0 pr-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 dark:from-blue-600/30 dark:to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Film className="w-6 h-6" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate" title={videoInfo.filename}>
                  {videoInfo.filename}
                </span>
                <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30">
                  {videoInfo.format_name.split(',')[0]}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate mt-0.5" title={videoInfo.path}>
                {videoInfo.path}
              </p>

              {/* Badges / Stats */}
              <div className="flex flex-wrap items-center gap-2.5 mt-3 text-xs text-zinc-700 dark:text-zinc-300">
                <div className="flex items-center space-x-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>{formatBytes(videoInfo.size_bytes)}</span>
                </div>

                <div className="flex items-center space-x-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                  <Clock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>{formatDuration(videoInfo.duration_secs)}</span>
                </div>

                {videoStream && (
                  <div className="flex items-center space-x-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                    <FileVideo className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>
                      {videoStream.codec_name?.toUpperCase() || 'VIDEO'}
                      {videoStream.width && videoStream.height ? ` (${videoStream.width}x${videoStream.height})` : ''}
                    </span>
                  </div>
                )}

                <div className="flex items-center space-x-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                  <Music className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>{videoInfo.audio_streams_count} Audio</span>
                </div>

                {videoInfo.subtitle_streams_count > 0 && (
                  <div className="flex items-center space-x-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700/50">
                    <Subtitles className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span>{videoInfo.subtitle_streams_count} Existing Sub</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePickFile}
              className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium transition-colors"
            >
              Change
            </button>
            <button
              onClick={onClearVideo}
              className="p-1.5 bg-zinc-100 hover:bg-rose-100 text-zinc-500 hover:text-rose-600 dark:bg-zinc-800 dark:hover:bg-rose-900/40 dark:text-zinc-400 dark:hover:text-rose-300 rounded-lg transition-colors"
              title="Remove video"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={handlePickFile}
      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
        isDragOver
          ? 'border-blue-500 bg-blue-500/10 scale-[1.005]'
          : 'border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/70 shadow-sm'
      }`}
    >
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center text-zinc-700 dark:text-zinc-300 group-hover:scale-105 transition-transform shadow-inner">
          <UploadCloud className="w-6 h-6 text-blue-500 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Choose a video file or drag & drop here
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Supports <span className="text-zinc-700 dark:text-zinc-300 font-mono">.mkv</span>,{' '}
            <span className="text-zinc-700 dark:text-zinc-300 font-mono">.mp4</span>,{' '}
            <span className="text-zinc-700 dark:text-zinc-300 font-mono">.mov</span>,{' '}
            <span className="text-zinc-700 dark:text-zinc-300 font-mono">.m4v</span>
          </p>
        </div>
      </div>
    </div>
  );
};
