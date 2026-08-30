import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Flame, FileText, Type, Palette, Cpu, Sparkles, FolderOpen, Sliders } from 'lucide-react';
import { extractFilename } from '../utils/formatters';

export interface BurnOptions {
  subtitlePath: string;
  fontSize: number;
  fontColor: string;
  hasBox: boolean;
  encoder: string;
  qualityPreset: string;
}

interface BurnSettingsProps {
  options: BurnOptions;
  onChangeOptions: (updates: Partial<BurnOptions>) => void;
}

export const BurnSettings: React.FC<BurnSettingsProps> = ({ options, onChangeOptions }) => {
  const handlePickSubtitle = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: 'Select Subtitle File to Burn',
        filters: [
          {
            name: 'Subtitle Files (*.srt, *.vtt, *.ass)',
            extensions: ['srt', 'vtt', 'ass'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        onChangeOptions({ subtitlePath: selected });
      }
    } catch (err) {
      console.error('Subtitle file picker error:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Subtitle File Selection */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Subtitle File to Burn into Video
          </h2>
        </div>

        {options.subtitlePath ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
            <div className="min-w-0 flex-1 pr-4">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                  {extractFilename(options.subtitlePath)}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                  BURN TARGET
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate mt-0.5">
                {options.subtitlePath}
              </p>
            </div>

            <button
              type="button"
              onClick={handlePickSubtitle}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium transition-colors shrink-0"
            >
              Change Subtitle
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handlePickSubtitle}
            className="w-full border-2 border-dashed border-zinc-300 dark:border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 rounded-xl p-6 text-center transition-all flex flex-col items-center justify-center space-y-2 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Click to select a subtitle file (.srt, .vtt, .ass)
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                The text from this file will be permanently hardcoded onto the video frames.
              </p>
            </div>
          </button>
        )}
      </div>

      {/* 2. Style & Appearance Controls */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Subtitle Appearance & Video Encoder
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Font Size */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center space-x-1">
              <Type className="w-3.5 h-3.5 text-zinc-500" />
              <span>Font Size</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
              {[
                { label: 'Small', size: 18 },
                { label: 'Medium', size: 24 },
                { label: 'Large', size: 30 },
              ].map((opt) => (
                <button
                  key={opt.size}
                  type="button"
                  onClick={() => onChangeOptions({ fontSize: opt.size })}
                  className={`py-1 text-xs font-semibold rounded-lg transition-all ${
                    options.fontSize === opt.size
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Color */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center space-x-1">
              <Palette className="w-3.5 h-3.5 text-zinc-500" />
              <span>Font Color</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
              {[
                { label: 'White', color: 'white', bg: 'bg-white text-zinc-900' },
                { label: 'Yellow', color: 'yellow', bg: 'bg-amber-300 text-amber-950' },
              ].map((opt) => (
                <button
                  key={opt.color}
                  type="button"
                  onClick={() => onChangeOptions({ fontColor: opt.color })}
                  className={`py-1 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                    options.fontColor === opt.color
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full border border-black/20 ${opt.bg}`} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Background Contrast Box */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
              <span>Background Box</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => onChangeOptions({ hasBox: false })}
                className={`py-1 text-xs font-semibold rounded-lg transition-all ${
                  !options.hasBox
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Outline Only
              </button>
              <button
                type="button"
                onClick={() => onChangeOptions({ hasBox: true })}
                className={`py-1 text-xs font-semibold rounded-lg transition-all ${
                  options.hasBox
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Dark Box
              </button>
            </div>
          </div>
        </div>

        {/* Video Encoding Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
          {/* Encoder Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-zinc-500" />
              <span>Hardware Acceleration</span>
            </label>
            <select
              value={options.encoder}
              onChange={(e) => onChangeOptions({ encoder: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="videotoolbox">
                Apple Silicon VideoToolbox GPU (Blazing Fast, Recommended)
              </option>
              <option value="libx264">Software H.264 / libx264 (Maximum Compression)</option>
            </select>
          </div>

          {/* Quality Preset */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center space-x-1">
              <Flame className="w-3.5 h-3.5 text-zinc-500" />
              <span>Quality Preset</span>
            </label>
            <select
              value={options.qualityPreset}
              onChange={(e) => onChangeOptions({ qualityPreset: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-amber-500"
            >
              <option value="high">High Quality (8 Mbps / CRF 19)</option>
              <option value="medium">Balanced (5.5 Mbps / CRF 22)</option>
              <option value="fast">Fast (3.5 Mbps / CRF 26)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
