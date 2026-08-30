import React, { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { Settings, FolderOpen, Terminal, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { extractFilename } from '../utils/formatters';

interface OutputSettingsProps {
  outputPath: string;
  outputFormat: string; // "mkv" | "mp4"
  previewCommandString: string;
  onChangeOutputPath: (path: string) => void;
  onChangeOutputFormat: (format: string) => void;
}

export const OutputSettings: React.FC<OutputSettingsProps> = ({
  outputPath,
  outputFormat,
  previewCommandString,
  onChangeOutputPath,
  onChangeOutputFormat,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleBrowseOutput = async () => {
    try {
      const selected = await save({
        defaultPath: outputPath || `output_subbed.${outputFormat}`,
        filters: [
          {
            name: outputFormat.toUpperCase() + ' Video',
            extensions: [outputFormat],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        onChangeOutputPath(selected);
      }
    } catch (err) {
      console.error('Save dialog error:', err);
    }
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(previewCommandString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center space-x-2">
        <Settings className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Output Settings</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Container format toggle */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-zinc-400">Container Format</label>
          <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => onChangeOutputFormat('mkv')}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                outputFormat === 'mkv'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              MKV
            </button>
            <button
              type="button"
              onClick={() => onChangeOutputFormat('mp4')}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                outputFormat === 'mp4'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              MP4
            </button>
          </div>
          <p className="text-[10px] text-zinc-400">
            {outputFormat === 'mkv'
              ? 'Matroska container (lossless SRT timed-text).'
              : 'MP4 container (lossless mov_text timed-text, Apple compatible).'}
          </p>
        </div>

        {/* Output path picker */}
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[11px] font-medium text-zinc-400">Destination File</label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={outputPath}
              onChange={(e) => onChangeOutputPath(e.target.value)}
              placeholder="/path/to/output_subbed.mkv"
              className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-blue-500 truncate"
              title={outputPath}
            />
            <button
              type="button"
              onClick={handleBrowseOutput}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-colors shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse...</span>
            </button>
          </div>
          <p className="text-[10px] text-zinc-400 truncate">
            Target file: <span className="font-mono text-zinc-300">{extractFilename(outputPath) || 'Not set'}</span>
          </p>
        </div>
      </div>

      {/* Command Preview Accordion */}
      {previewCommandString && (
        <div className="pt-2 border-t border-zinc-800/60">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-zinc-300 py-1"
          >
            <div className="flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              <span>Preview FFmpeg Command</span>
            </div>
            {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showPreview && (
            <div className="mt-2 bg-zinc-950 rounded-xl border border-zinc-800 p-3 relative group">
              <pre className="text-[11px] font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all pr-12 leading-relaxed">
                {previewCommandString}
              </pre>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="absolute top-2.5 right-2.5 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center space-x-1 transition-colors"
                title="Copy command"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
