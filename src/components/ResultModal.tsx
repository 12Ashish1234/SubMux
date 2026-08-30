import React, { useState } from 'react';
import { CheckCircle2, AlertOctagon, Folder, Copy, Check, X } from 'lucide-react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { MuxResult } from '../types';
import { formatBytes, extractFilename } from '../utils/formatters';

interface ResultModalProps {
  result: MuxResult | null;
  error: string | null;
  onClose: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ result, error, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!result && !error) return null;

  const handleShowInFinder = async () => {
    if (result?.output_path) {
      try {
        await revealItemInDir(result.output_path);
      } catch (err) {
        console.error('Failed to reveal file in Finder:', err);
      }
    }
  };

  const handleCopyError = () => {
    if (error) {
      navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Success View */}
        {result && (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    Muxing Complete!
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Subtitles losslessly attached without re-encoding
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium">Output File</span>
                <span className="text-zinc-200 font-semibold">
                  {extractFilename(result.output_path)}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono break-all bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
                {result.output_path}
              </p>
              {result.output_size_bytes > 0 && (
                <div className="flex justify-between items-center text-xs pt-1 border-t border-zinc-800/80">
                  <span className="text-zinc-400">File Size</span>
                  <span className="text-emerald-400 font-mono font-medium">
                    {formatBytes(result.output_size_bytes)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={handleShowInFinder}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-blue-500/10"
              >
                <Folder className="w-4 h-4" />
                <span>Show in Finder</span>
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}

        {/* Error View */}
        {error && !result && (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-rose-300">
                    Muxing Operation Failed
                  </h3>
                  <p className="text-xs text-zinc-400">
                    FFmpeg encountered an error while multiplexing
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">FFmpeg Error Output</span>
                <button
                  onClick={handleCopyError}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs flex items-center space-x-1 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span className="text-[11px]">Copy Log</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="max-h-56 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[11px] font-mono text-rose-300/90 whitespace-pre-wrap break-all leading-relaxed select-text">
                {error}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-zinc-400">
                Check that subtitle codecs match the container format.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
