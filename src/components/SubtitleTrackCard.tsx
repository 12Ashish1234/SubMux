import React, { useState } from 'react';
import { Trash2, Tag, Globe, Check, Star } from 'lucide-react';
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

  const handleLangSelect = (code: string) => {
    if (code === 'custom') {
      setIsCustomLang(true);
      onUpdateTrack(track.id, { language: '' });
    } else {
      setIsCustomLang(false);
      onUpdateTrack(track.id, { language: code });
    }
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
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-zinc-900 dark:text-zinc-200 text-xs truncate max-w-[280px]" title={track.filename}>
                {track.filename}
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                {ext || 'SRT'}
              </span>
              {track.is_default && (
                <span className="flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  <span>Default Track</span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3.5 pt-3 border-t border-zinc-200 dark:border-zinc-800/60">
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
              <option value="custom">Other / Custom ISO Code...</option>
            </select>

            {isCustomLang && (
              <input
                type="text"
                placeholder="ISO code (e.g. fre)"
                value={track.language}
                maxLength={4}
                onChange={(e) =>
                  onUpdateTrack(track.id, {
                    language: e.target.value.toLowerCase().replace(/[^a-z]/g, ''),
                  })
                }
                className="w-24 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
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
            placeholder="e.g. English [SDH], Commentary"
            value={track.title}
            onChange={(e) => onUpdateTrack(track.id, { title: e.target.value })}
            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
