import React from 'react';
import { Loader2, Zap, Clock, Square } from 'lucide-react';
import { MuxProgressPayload } from '../types';
import { formatDuration } from '../utils/formatters';

interface MuxProgressBarProps {
  progress: MuxProgressPayload | null;
  isMuxing: boolean;
  onCancel: () => void;
}

export const MuxProgressBar: React.FC<MuxProgressBarProps> = ({ progress, isMuxing, onCancel }) => {
  if (!isMuxing) return null;

  const percentage = progress ? Math.min(100, Math.max(0, Math.round(progress.percentage))) : 0;
  const outTime = progress?.out_time_secs || 0;
  const totalDuration = progress?.total_duration_secs || 0;

  return (
    <div className="bg-zinc-900/90 border border-blue-500/40 rounded-2xl p-5 space-y-3.5 shadow-xl shadow-blue-500/5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Lossless Subtitle Muxing in Progress...
            </h3>
            <p className="text-xs text-zinc-400">
              Copying audio/video streams & embedding subtitle tracks
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 active:bg-rose-600/40 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop Muxing</span>
          </button>
          <span className="text-2xl font-bold font-mono text-blue-400 min-w-[60px] text-right">
            {percentage}%
          </span>
        </div>
      </div>

      {/* Determinate Progress Bar */}
      <div className="w-full bg-zinc-950 rounded-full h-3 overflow-hidden p-0.5 border border-zinc-800">
        <div
          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-150 ease-out shadow-sm"
          style={{ width: `${Math.max(2, percentage)}%` }}
        />
      </div>

      {/* Detailed Metrics */}
      <div className="flex items-center justify-between text-xs text-zinc-400 font-mono pt-1">
        <div className="flex items-center space-x-1.5">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <span>
            {formatDuration(outTime)}
            {totalDuration > 0 ? ` / ${formatDuration(totalDuration)}` : ''}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {progress?.frame && progress.frame > 0 && (
            <span>Frame: {progress.frame.toLocaleString()}</span>
          )}
          {progress?.speed && (
            <div className="flex items-center space-x-1 text-emerald-400 font-semibold">
              <Zap className="w-3 h-3" />
              <span>{progress.speed}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
