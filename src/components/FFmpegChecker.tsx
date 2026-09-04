import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AlertTriangle, Copy, Check, RefreshCw, Terminal, Download, Sparkles } from 'lucide-react';
import { EnvironmentStatus, DownloadProgressPayload } from '../types';

interface FFmpegCheckerProps {
  envStatus: EnvironmentStatus;
  onRefresh: () => void;
  isLoading: boolean;
}

export const FFmpegChecker: React.FC<FFmpegCheckerProps> = ({
  envStatus,
  onRefresh,
  isLoading,
}) => {
  const [copied, setCopied] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState<DownloadProgressPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isHealthy = envStatus.ffmpeg_available && envStatus.ffprobe_available;

  if (isHealthy) return null;

  const copyCommand = () => {
    navigator.clipboard.writeText('brew install ffmpeg');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallEngine = async () => {
    setIsInstalling(true);
    setErrorMsg(null);
    setProgress({
      stage: 'init',
      percentage: 5,
      message: 'Initializing download of official FFmpeg engine...',
    });

    try {
      const unlisten = await listen<DownloadProgressPayload>(
        'ffmpeg-download-progress',
        (event) => {
          setProgress(event.payload);
        }
      );

      const result = await invoke<EnvironmentStatus>('install_ffmpeg_engine');
      unlisten();

      if (result.ffmpeg_available && result.ffprobe_available) {
        onRefresh();
      } else {
        setErrorMsg(result.error_message || 'Installation completed but binary validation failed.');
      }
    } catch (err: any) {
      console.error('Failed to install FFmpeg:', err);
      setErrorMsg(typeof err === 'string' ? err : err.message || 'Download failed');
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl p-5 mb-6 text-zinc-800 dark:text-zinc-200 shadow-lg backdrop-blur">
      <div className="flex items-start space-x-3.5">
        <div className="p-2 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 space-y-3.5">
          <div>
            <h3 className="font-semibold text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
              <span>FFmpeg Engine Not Found</span>
              <span className="text-[11px] font-normal text-rose-500 dark:text-rose-400">Required for muxing & burning</span>
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
              SubMux needs <code>ffmpeg</code> and <code>ffprobe</code> to rapidly multiplex subtitle tracks and burn styles without losing video quality.
            </p>
          </div>

          {/* 1-Click Auto Install Banner */}
          <div className="bg-white/80 dark:bg-zinc-900/80 border border-rose-300/60 dark:border-rose-700/50 rounded-xl p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                  Recommended: Automatic 1-Click Setup
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Installs directly into SubMux (~50MB)
              </span>
            </div>

            {isInstalling && progress ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-300 font-medium truncate max-w-[280px]">
                    {progress.message}
                  </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {progress.percentage}%
                  </span>
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  No terminal required. Downloads official verified macOS static builds.
                </p>
                <button
                  onClick={handleInstallEngine}
                  disabled={isInstalling}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-md shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install FFmpeg (1-Click)</span>
                </button>
              </div>
            )}

            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                {errorMsg}
              </p>
            )}
          </div>

          {/* Alternative Terminal Manual Command */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Or install manually via Homebrew if you prefer:
            </span>
            <div className="bg-zinc-900 dark:bg-zinc-950/90 border border-zinc-700 dark:border-zinc-800 rounded-lg p-2.5 flex items-center justify-between font-mono text-xs text-zinc-200">
              <div className="flex items-center space-x-2 overflow-x-auto">
                <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-emerald-400 select-all font-mono">brew install ffmpeg</span>
              </div>
              <button
                onClick={copyCommand}
                className="ml-3 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded text-xs text-zinc-300 flex items-center space-x-1 transition-colors shrink-0"
                title="Copy to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 text-[11px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <button
              onClick={onRefresh}
              disabled={isLoading || isInstalling}
              className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Checking...' : 'Re-check Environment'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
