import React, { useState } from 'react';
import { Trash2, Tag, Globe, Check, Star, Clock, Plus, Minus, FileCheck, RefreshCw } from 'lucide-react';
import { SubtitleTrackConfig, COMMON_LANGUAGES } from '../types';
import { getFileExtension } from '../utils/formatters';

interface SubtitleTrackCardProps {
  track: SubtitleTrackConfig;
  index: number;
  onUpdateTrack: (id: string, updates: Partial<SubtitleTrackConfig>) => void;
  onRemoveTrack: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export const SubtitleTrackCard: React.FC<SubtitleTrackCardProps> = ({
  track,
  index,
  onUpdateTrack,
  onRemoveTrack,
  onSetDefault,
}) => {
  const ext = getFileExtension(track.path).toUpperCase();
  const [isCustomLang, setIsCustomLang] = useState(
    !COMMON_LANGUAGES.some((l) => l.code === track.language && l.code !== 'und')
  );

  const currentOffset = track.time_offset_secs || 0;

  const handleLangSelect = (code: string) => {
    if (code === 'custom') {
      setIsCustomLang(true);
      onUpdateTrack(track.id, { language: '' });
    } else {
      setIsCustomLang(false);
      onUpdateTrack(track.id, { language: code });
    }
  };

  const adjustOffset = (delta: number) => {
    const next = Math.round((currentOffset + delta) * 10) / 10;
    onUpdateTrack(track.id, { time_offset_secs: next === 0 ? undefined : next });
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-all shadow-sm ${
        track.is_default
          ? 'bg-blue-50/60 dark:bg-zinc-900/90 border-blue-500/50 shadow-blue-500/5'
          : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700/80'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Track header */}
        <div className="flex items-start space-x-3 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              track.is_default
                ? 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50'
            }`}
          >
            #{index + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-zinc-900 dark:text-zinc-200 text-xs truncate max-w-[240px]" title={track.filename}>
                {track.filename}
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                {ext || 'SRT'}
              </span>

              {/* Default Badge */}
              {track.is_default && (
                <span className="flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  <span>Default Track</span>
                </span>
              )}

              {/* Conversion Badge */}
              {track.was_converted && (
                <span className="flex items-center space-x-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Converted from {track.original_format?.toUpperCase()}</span>
                </span>
              )}

              {/* Encoding Verified Badge */}
              <span className="flex items-center space-x-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <FileCheck className="w-2.5 h-2.5" />
                <span>{track.encoding || 'UTF-8'}</span>
              </span>

              {/* Time Sync Offset Badge */}
              {currentOffset !== 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {currentOffset > 0 ? `+${currentOffset}s` : `${currentOffset}s`} sync
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate mt-0.5" title={track.path}>
              {track.path}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onSetDefault(track.id)}
            title="Set as default subtitle track"
            className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              track.is_default
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <Check className="w-3 h-3" />
            <span>{track.is_default ? 'Default' : 'Make Default'}</span>
          </button>

          <button
            type="button"
            onClick={() => onRemoveTrack(track.id)}
            className="p-1.5 bg-zinc-100 hover:bg-rose-100 text-zinc-500 hover:text-rose-600 dark:bg-zinc-800 dark:hover:bg-rose-900/40 dark:text-zinc-400 dark:hover:text-rose-300 rounded-lg transition-colors"
            title="Remove track"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Track Config Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3.5 pt-3 border-t border-zinc-200 dark:border-zinc-800/60">
        {/* Language selector */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center space-x-1">
            <Globe className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
            <span>Track Language</span>
          </label>
          <div className="flex items-center space-x-2">
            <select
              value={isCustomLang ? 'custom' : track.language}
              onChange={(e) => handleLangSelect(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 flex-1"
            >
              {COMMON_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} ({lang.code})
                </option>
              ))}
              <option value="custom">Other / Custom...</option>
            </select>

            {isCustomLang && (
              <input
                type="text"
                placeholder="ISO"
                value={track.language}
                maxLength={4}
                onChange={(e) =>
                  onUpdateTrack(track.id, {
                    language: e.target.value.toLowerCase().replace(/[^a-z]/g, ''),
                  })
                }
                className="w-16 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 rounded-lg px-2 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            )}
          </div>
        </div>

        {/* Track Title / Label */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center space-x-1">
            <Tag className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
            <span>Track Title / Label</span>
          </label>
          <input
            type="text"
            placeholder="e.g. English [SDH]"
            value={track.title}
            onChange={(e) => onUpdateTrack(track.id, { title: e.target.value })}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Subtitle Time Sync / Offset (-itsoffset) */}
        <div>
          <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
              <span>Time Sync Offset</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {currentOffset === 0 ? 'No shift' : `${currentOffset > 0 ? '+' : ''}${currentOffset}s`}
            </span>
          </label>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => adjustOffset(-0.5)}
              title="Delay subtitle by -0.5 seconds"
              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>

            <input
              type="number"
              step="0.1"
              placeholder="0.0s"
              value={currentOffset || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdateTrack(track.id, {
                  time_offset_secs: isNaN(val) ? undefined : val,
                });
              }}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 rounded-lg px-2 py-1.5 text-xs font-mono text-center text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
            />

            <button
              type="button"
              onClick={() => adjustOffset(0.5)}
              title="Advance subtitle by +0.5 seconds"
              className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
