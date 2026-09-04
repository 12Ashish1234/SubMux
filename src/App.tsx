import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Sparkles, Flame } from 'lucide-react';

import {
  AppMode,
  EnvironmentStatus,
  VideoInfo,
  SubtitleTrackConfig,
  MuxProgressPayload,
  MuxResult,
  MuxRequest,
  BurnRequest,
} from './types';
import { TitleBar } from './components/TitleBar';
import { ModeSelector } from './components/ModeSelector';
import { FFmpegChecker } from './components/FFmpegChecker';
import { VideoDropzone } from './components/VideoDropzone';
import { SubtitleList } from './components/SubtitleList';
import { BurnSettings, BurnOptions } from './components/BurnSettings';
import { OutputSettings } from './components/OutputSettings';
import { MuxProgressBar } from './components/MuxProgressBar';
import { ResultModal } from './components/ResultModal';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { BatchQueue } from './components/BatchQueue';
import { suggestOutputPath, replaceFileExtension, getFileExtension } from './utils/formatters';
import { useTheme } from './utils/useTheme';

export function App() {
  const { theme, preference, toggleTheme } = useTheme();
  const [mode, setMode] = useState<AppMode>('mux');

  const [envStatus, setEnvStatus] = useState<EnvironmentStatus | null>(null);
  const [isCheckingEnv, setIsCheckingEnv] = useState(false);

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Mux Mode State
  const [subtitles, setSubtitles] = useState<SubtitleTrackConfig[]>([]);

  // Burn Mode State
  const [burnOptions, setBurnOptions] = useState<BurnOptions>({
    subtitlePath: '',
    fontSize: 24,
    fontColor: 'white',
    hasBox: false,
    encoder: 'videotoolbox',
    qualityPreset: 'high',
  });

  const [outputPath, setOutputPath] = useState('');
  const [outputFormat, setOutputFormat] = useState('mp4');
  const [previewCommand, setPreviewCommand] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<MuxProgressPayload | null>(null);
  const [result, setResult] = useState<MuxResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // Listen to progress events from Rust backend
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

      const ext = getFileExtension(filePath);
      const targetFmt = mode === 'burn' ? 'mp4' : ['mp4', 'm4v', 'mov'].includes(ext) ? 'mp4' : 'mkv';
      setOutputFormat(targetFmt);
      setOutputPath(suggestOutputPath(filePath, targetFmt));
    } catch (err: any) {
      console.error('Video probe failed:', err);
      const ext = getFileExtension(filePath);
      const targetFmt = mode === 'burn' ? 'mp4' : ['mp4', 'm4v', 'mov'].includes(ext) ? 'mp4' : 'mkv';
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

  // Subtitle Handlers for Mux Mode
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

  // Update Command Preview
  useEffect(() => {
    if (!videoInfo || !outputPath || mode === 'batch') {
      setPreviewCommand('');
      return;
    }

    if (mode === 'mux') {
      if (subtitles.length === 0) {
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
          time_offset_secs: s.time_offset_secs,
        })),
        output_path: outputPath,
        output_format: outputFormat,
        existing_subtitles_count: videoInfo.subtitle_streams_count || 0,
      };

      invoke<string[]>('preview_command', { request })
        .then((args) => {
          const formatted = args
            .map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
            .join(' ');
          setPreviewCommand(formatted);
        })
        .catch(console.error);
    } else {
      // Burn Mode
      if (!burnOptions.subtitlePath) {
        setPreviewCommand('');
        return;
      }
      const request: BurnRequest = {
        video_path: videoInfo.path,
        subtitle_path: burnOptions.subtitlePath,
        output_path: outputPath,
        output_format: outputFormat,
        encoder: burnOptions.encoder,
        font_size: burnOptions.fontSize,
        font_color: burnOptions.fontColor,
        has_box: burnOptions.hasBox,
        quality_preset: burnOptions.qualityPreset,
      };

      invoke<string[]>('preview_burn_command', { request })
        .then((args) => {
          const formatted = args
            .map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
            .join(' ');
          setPreviewCommand(formatted);
        })
        .catch(console.error);
    }
  }, [mode, videoInfo, subtitles, burnOptions, outputPath, outputFormat]);

  // Execute Action (Mux or Burn)
  const handleStartProcessing = async () => {
    if (!videoInfo || !outputPath) return;

    setIsProcessing(true);
    setProgress({
      percentage: 0,
      out_time_secs: 0,
      total_duration_secs: videoInfo.duration_secs || 0,
      speed: null,
      frame: null,
    });
    setResult(null);
    setError(null);

    try {
      if (mode === 'mux') {
        const request: MuxRequest = {
          video_path: videoInfo.path,
          subtitle_tracks: subtitles.map((s) => ({
            path: s.path,
            language: s.language || 'und',
            title: s.title || '',
            is_default: s.is_default,
            time_offset_secs: s.time_offset_secs,
          })),
          output_path: outputPath,
          output_format: outputFormat,
          existing_subtitles_count: videoInfo.subtitle_streams_count || 0,
        };
        const res = await invoke<MuxResult>('mux_subtitles', { request });
        setResult(res);
      } else {
        const request: BurnRequest = {
          video_path: videoInfo.path,
          subtitle_path: burnOptions.subtitlePath,
          output_path: outputPath,
          output_format: outputFormat,
          encoder: burnOptions.encoder,
          font_size: burnOptions.fontSize,
          font_color: burnOptions.fontColor,
          has_box: burnOptions.hasBox,
          quality_preset: burnOptions.qualityPreset,
        };
        const res = await invoke<MuxResult>('burn_subtitles', { request });
        setResult(res);
      }
    } catch (err: any) {
      console.error('Processing error:', err);
      const errMsg = typeof err === 'string' ? err : JSON.stringify(err);
      if (!errMsg.includes('cancelled by user')) {
        setError(errMsg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    try {
      await invoke('cancel_mux');
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
    setIsProcessing(false);
    setProgress(null);
  };

  const isReady =
    Boolean(videoInfo) &&
    Boolean(outputPath) &&
    !isProcessing &&
    Boolean(envStatus?.ffmpeg_available) &&
    (mode === 'mux' ? subtitles.length > 0 : Boolean(burnOptions.subtitlePath));

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      <TitleBar
        envStatus={envStatus}
        onRefreshEnv={checkEnv}
        theme={theme}
        preference={preference}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        {/* FFmpeg Missing Notice Banner */}
        {envStatus && !envStatus.ffmpeg_available && (
          <FFmpegChecker
            envStatus={envStatus}
            onRefresh={checkEnv}
            isLoading={isCheckingEnv}
          />
        )}

        {/* Mode Selector Switcher */}
        <ModeSelector mode={mode} onChangeMode={setMode} />

        {/* BATCH QUEUE MODE VIEW */}
        {mode === 'batch' ? (
          <BatchQueue onCancelAll={handleCancel} />
        ) : (
          /* SINGLE FILE (MUX / BURN) MODE VIEW */
          <>
            {/* 1. Source Video Dropzone */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">1. Source Video</h2>
              </div>
              <VideoDropzone
                videoInfo={videoInfo}
                isProbing={isProbing}
                onSelectVideo={handleSelectVideo}
                onClearVideo={handleClearVideo}
                onOpenPreview={() => setPreviewModalOpen(true)}
              />
            </div>

            {/* 2. Subtitle Section: Mux (Multi-Track) vs Burn (Single Track + Style) */}
            {mode === 'mux' ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">2. Subtitle Tracks</h2>
                <SubtitleList
                  tracks={subtitles}
                  onAddTracks={handleAddSubtitles}
                  onUpdateTrack={handleUpdateTrack}
                  onRemoveTrack={handleRemoveTrack}
                  onSetDefault={handleSetDefault}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">2. Burn-In Configuration</h2>
                <BurnSettings
                  options={burnOptions}
                  onChangeOptions={(updates) => setBurnOptions((prev) => ({ ...prev, ...updates }))}
                />
              </div>
            )}

            {/* 3. Output Settings */}
            {videoInfo && (mode === 'mux' ? subtitles.length > 0 : burnOptions.subtitlePath) && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">3. Target Destination</h2>
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
            <MuxProgressBar progress={progress} isMuxing={isProcessing} onCancel={handleCancel} />

            {/* Action Button Area */}
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center space-x-1.5">
                {!videoInfo && <span>• Select a video file to begin</span>}
                {videoInfo && mode === 'mux' && subtitles.length === 0 && (
                  <span>• Add at least one subtitle track (.srt, .vtt, .ass)</span>
                )}
                {videoInfo && mode === 'burn' && !burnOptions.subtitlePath && (
                  <span>• Choose a subtitle file to burn</span>
                )}
                {videoInfo && !outputPath && <span>• Choose an output destination</span>}
                {isReady && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {mode === 'mux'
                      ? `✓ Ready to mux ${subtitles.length} track${subtitles.length > 1 ? 's' : ''} into ${outputFormat.toUpperCase()}`
                      : `✓ Ready to burn subtitles with Apple Silicon GPU into ${outputFormat.toUpperCase()}`}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleStartProcessing}
                disabled={!isReady}
                className={`px-6 py-3 rounded-xl font-semibold text-xs flex items-center space-x-2 transition-all shadow-lg ${
                  isReady
                    ? mode === 'mux'
                      ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-blue-500/20 hover:scale-[1.01]'
                      : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white shadow-amber-500/20 hover:scale-[1.01]'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-60'
                }`}
              >
                {mode === 'mux' ? <Sparkles className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
                <span>
                  {isProcessing
                    ? mode === 'mux'
                      ? 'Muxing...'
                      : 'Burning Subtitles...'
                    : mode === 'mux'
                    ? 'Mux Subtitles'
                    : 'Burn-In Subtitles'}
                </span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* Video Preview Modal */}
      {previewModalOpen && (
        <VideoPreviewModal
          videoInfo={videoInfo}
          subtitles={subtitles}
          onClose={() => setPreviewModalOpen(false)}
        />
      )}

      {/* Result Modal (Success or Error) */}
      <ResultModal
        result={result}
        error={error}
        onClose={() => {
          setResult(null);
          setError(null);
        }}
      />
    </div>
  );
}

export default App;
