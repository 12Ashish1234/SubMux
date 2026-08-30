import React from 'react';
import { Layers, Flame } from 'lucide-react';
import { AppMode } from '../types';

interface ModeSelectorProps {
  mode: AppMode;
  onChangeMode: (mode: AppMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onChangeMode }) => {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800/80">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
          <span>{mode === 'mux' ? 'Lossless Subtitle Muxer' : 'Subtitle Burn-In Engine'}</span>
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
              mode === 'mux'
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
          >
            {mode === 'mux' ? 'Direct Stream Copy (-c copy)' : 'Apple Silicon GPU (-c:v videotoolbox)'}
          </span>
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {mode === 'mux'
            ? 'Losslessly attach selectable, toggleable subtitle tracks without re-encoding video or losing quality.'
            : 'Hardcode subtitles directly into video frames with Apple Silicon hardware acceleration for TVs and social media.'}
        </p>
      </div>

      {/* Segmented Control */}
      <div className="bg-zinc-200/80 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-300/80 dark:border-zinc-800 flex items-center space-x-1 shrink-0 shadow-inner">
        <button
          type="button"
          onClick={() => onChangeMode('mux')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === 'mux'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-blue-500" />
          <span>Lossless Mux</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeMode('burn')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === 'burn'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-amber-500" />
          <span>Burn-In Subtitles</span>
        </button>
      </div>
    </div>
  );
};
