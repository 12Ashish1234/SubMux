import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Sparkles } from 'lucide-react';

import {
  EnvironmentStatus,
  VideoInfo,
  SubtitleTrackConfig,
  MuxProgressPayload,
  MuxResult,
  MuxRequest,
} from './types';
import { TitleBar } from './components/TitleBar';
import { FFmpegChecker } from './components/FFmpegChecker';
import { VideoDropzone } from './components/VideoDropzone';
import { SubtitleList } from './components/SubtitleList';
import { OutputSettings } from './components/OutputSettings';
import { MuxProgressBar } from './components/MuxProgressBar';
import { ResultModal } from './components/ResultModal';
import { suggestOutputPath, replaceFileExtension, getFileExtension } from './utils/formatters';

export function App() {
  const [envStatus, setEnvStatus] = useState<EnvironmentStatus | null>(null);
  const [isCheckingEnv, setIsCheckingEnv] = useState(false);

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isProbing, setIsProbing] = useState(false);

  const [subtitles, setSubtitles] = useState<SubtitleTrackConfig[]>([]);
  const [outputPath, setOutputPath] = useState('');
  const [outputFormat, setOutputFormat] = useState('mkv');
  const [previewCommand, setPreviewCommand] = useState('');

  const [isMuxing, setIsMuxing] = useState(false);
  const [progress, setProgress] = useState<MuxProgressPayload | null>(null);
  const [muxResult, setMuxResult] = useState<MuxResult | null>(null);
  const [muxError, setMuxError] = useState<string | null>(null);

  // Check FFmpeg environment at startup
  const checkEnv = useCallback(async () => {
    setIsCheckingEnv(true);
    try {
      const status = await invoke<EnvironmentStatus>('check_ffmpeg_env');
      setEnvStatus(status);
    } catch (err) {
      console.error('Failed to check environment:', err);
    } finally {
      setIsCheckingEnv(false);
    }
  }, []);

  useEffect(() => {
    checkEnv();
  }, [checkEnv]);

  // Listen to muxing progress events from Rust backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<MuxProgressPayload>('mux-progress', (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Handle Video Selection
  const handleSelectVideo = async (filePath: string) => {
    setIsProbing(true);
    try {
      const info = await invoke<VideoInfo>('probe_video_file', { videoPath: filePath });
      setVideoInfo(info);

      // Determine default container from input
      const ext = getFileExtension(filePath);
      const targetFmt = ['mp4', 'm4v', 'mov'].includes(ext) ? 'mp4' : 'mkv';
      setOutputFormat(targetFmt);
      setOutputPath(suggestOutputPath(filePath, targetFmt));
    } catch (err: any) {
      console.error('Video probe failed:', err);
      // Fallback simple info if probing failed
      const ext = getFileExtension(filePath);
      const targetFmt = ['mp4', 'm4v', 'mov'].includes(ext) ? 'mp4' : 'mkv';
      setOutputFormat(targetFmt);
      setOutputPath(suggestOutputPath(filePath, targetFmt));
      setVideoInfo({
        path: filePath,
        filename: filePath.split(/[/\\]/).pop() || filePath,
        format_name: ext || 'unknown',
        duration_secs: 0,
        size_bytes: 0,
        streams: [],
        video_streams_count: 1,
        audio_streams_count: 1,
        subtitle_streams_count: 0,
      });
    } finally {
      setIsProbing(false);
    }
  };

  const handleClearVideo = () => {
    setVideoInfo(null);
    setOutputPath('');
    setPreviewCommand('');
  };

  // Subtitle Handlers
  const handleAddSubtitles = (newTracks: SubtitleTrackConfig[]) => {
    setSubtitles((prev) => [...prev, ...newTracks]);
  };

  const handleUpdateTrack = (id: string, updates: Partial<SubtitleTrackConfig>) => {
    setSubtitles((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleRemoveTrack = (id: string) => {
    setSubtitles((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      // If the default track was deleted and there are remaining tracks, make first default
      if (remaining.length > 0 && !remaining.some((t) => t.is_default)) {
        remaining[0].is_default = true;
      }
      return remaining;
    });
  };

  const handleSetDefault = (id: string) => {
    setSubtitles((prev) =>
      prev.map((t) => ({
        ...t,
        is_default: t.id === id,
      }))
    );
  };

  // Output Format change handler
  const handleChangeOutputFormat = (format: string) => {
    setOutputFormat(format);
    if (outputPath) {
      setOutputPath(replaceFileExtension(outputPath, format));
    }
  };

  // Update command preview whenever inputs change
  useEffect(() => {
    if (!videoInfo || subtitles.length === 0 || !outputPath) {
      setPreviewCommand('');
      return;
    }

    const request: MuxRequest = {
      video_path: videoInfo.path,
      subtitle_tracks: subtitles.map((s) => ({
        path: s.path,
        language: s.language || 'und',
        title: s.title || '',
        is_default: s.is_default,
      })),
      output_path: outputPath,
      output_format: outputFormat,
      existing_subtitles_count: videoInfo.subtitle_streams_count || 0,
    };

    invoke<string[]>('preview_command', { request })
      .then((args) => {
        // Format command with quotes for paths
        const formatted = args
          .map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
          .join(' ');
        setPreviewCommand(formatted);
      })
      .catch((err) => console.error('Preview command error:', err));
  }, [videoInfo, subtitles, outputPath, outputFormat]);

  // Execute Lossless Mux
  const handleStartMux = async () => {
    if (!videoInfo) return;
    if (subtitles.length === 0) return;
    if (!outputPath) return;

    setIsMuxing(true);
    setProgress({
      percentage: 0,
      out_time_secs: 0,
      total_duration_secs: videoInfo.duration_secs || 0,
      speed: null,
      frame: null,
    });
    setMuxResult(null);
    setMuxError(null);

    const request: MuxRequest = {
      video_path: videoInfo.path,
      subtitle_tracks: subtitles.map((s) => ({
        path: s.path,
        language: s.language || 'und',
        title: s.title || '',
        is_default: s.is_default,
      })),
      output_path: outputPath,
      output_format: outputFormat,
      existing_subtitles_count: videoInfo.subtitle_streams_count || 0,
    };

    try {
      const res = await invoke<MuxResult>('mux_subtitles', { request });
      setMuxResult(res);
    } catch (err: any) {
      console.error('Mux error:', err);
      const errMsg = typeof err === 'string' ? err : JSON.stringify(err);
      if (!errMsg.includes('cancelled by user')) {
        setMuxError(errMsg);
      }
    } finally {
      setIsMuxing(false);
    }
  };

  const handleCancelMux = async () => {
    try {
      await invoke('cancel_mux');
    } catch (err) {
      console.error('Failed to cancel mux:', err);
    }
    setIsMuxing(false);
    setProgress(null);
  };

  const isReadyToMux =
    Boolean(videoInfo) &&
    subtitles.length > 0 &&
    Boolean(outputPath) &&
    !isMuxing &&
    Boolean(envStatus?.ffmpeg_available);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100">
      <TitleBar envStatus={envStatus} onRefreshEnv={checkEnv} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        {/* FFmpeg Missing Notice Banner */}
        {envStatus && !envStatus.ffmpeg_available && (
          <FFmpegChecker
            envStatus={envStatus}
            onRefresh={checkEnv}
            isLoading={isCheckingEnv}
          />
        )}

        {/* Hero / Header info */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
          <div>
            <h1 className="text-xl font-bold text-zinc-100 flex items-center space-x-2">
              <span>Lossless Subtitle Muxer</span>
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Direct Stream Copy (-c copy)
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Attach selectable & toggleable subtitle tracks to MP4 or MKV without video re-encoding or quality loss.
            </p>
          </div>
        </div>

        {/* Video File Dropzone / Card */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">1. Source Video</h2>
          </div>
          <VideoDropzone
            videoInfo={videoInfo}
            isProbing={isProbing}
            onSelectVideo={handleSelectVideo}
            onClearVideo={handleClearVideo}
          />
        </div>

        {/* Subtitle Files List */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-200">2. Subtitle Tracks</h2>
          <SubtitleList
            tracks={subtitles}
            onAddTracks={handleAddSubtitles}
            onUpdateTrack={handleUpdateTrack}
            onRemoveTrack={handleRemoveTrack}
            onSetDefault={handleSetDefault}
          />
        </div>

        {/* Output Settings */}
        {videoInfo && subtitles.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-200">3. Target Destination</h2>
            <OutputSettings
              outputPath={outputPath}
              outputFormat={outputFormat}
              previewCommandString={previewCommand}
              onChangeOutputPath={setOutputPath}
              onChangeOutputFormat={handleChangeOutputFormat}
            />
          </div>
        )}

        {/* Progress Bar with Cancel Button */}
        <MuxProgressBar progress={progress} isMuxing={isMuxing} onCancel={handleCancelMux} />

        {/* Action Button Area */}
        <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-xs text-zinc-400 flex items-center space-x-1.5">
            {!videoInfo && <span>• Select a video file to begin</span>}
            {videoInfo && subtitles.length === 0 && (
              <span>• Add at least one subtitle track (.srt, .vtt, .ass)</span>
            )}
            {videoInfo && subtitles.length > 0 && !outputPath && (
              <span>• Choose an output destination</span>
            )}
            {isReadyToMux && (
              <span className="text-emerald-400 font-medium">
                ✓ Ready to mux {subtitles.length} subtitle track{subtitles.length > 1 ? 's' : ''} into {outputFormat.toUpperCase()}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleStartMux}
            disabled={!isReadyToMux}
            className={`px-6 py-3 rounded-xl font-semibold text-xs flex items-center space-x-2 transition-all shadow-lg ${
              isReadyToMux
                ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-500/20 hover:scale-[1.01]'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{isMuxing ? 'Muxing...' : 'Mux Subtitles'}</span>
          </button>
        </div>
      </main>

      {/* Result Modal (Success or Error) */}
      <ResultModal
        result={muxResult}
        error={muxError}
        onClose={() => {
          setMuxResult(null);
          setMuxError(null);
        }}
      />
    </div>
  );
}

export default App;
