import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, RefreshCw, Terminal } from 'lucide-react';
import { EnvironmentStatus } from '../types';

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
  const isHealthy = envStatus.ffmpeg_available && envStatus.ffprobe_available;

  if (isHealthy) return null;

  const copyCommand = () => {
    navigator.clipboard.writeText('brew install ffmpeg');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl p-5 mb-6 text-zinc-800 dark:text-zinc-200 shadow-lg backdrop-blur">
      <div className="flex items-start space-x-3.5">
        <div className="p-2 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-rose-700 dark:text-rose-300 text-sm">
              FFmpeg Dependency Missing
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
              SubMux uses <code>ffmpeg</code> and <code>ffprobe</code> to rapidly inspect and multiplex subtitle tracks into video files without quality loss.
              {!envStatus.ffmpeg_available && ' • ffmpeg not found'}
              {!envStatus.ffprobe_available && ' • ffprobe not found'}
            </p>
          </div>

          <div className="bg-zinc-900 dark:bg-zinc-950/80 border border-zinc-700 dark:border-zinc-800 rounded-lg p-2.5 flex items-center justify-between font-mono text-xs text-zinc-200">
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

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Run the command above in Terminal, then click re-check.
            </span>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm"
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
