import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import {
  Layers,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  Square,
  Trash2,
  FileVideo,
  Subtitles,
  Loader2,
} from 'lucide-react';
import { BatchItem, MuxRequest, MuxResult } from '../types';

interface BatchQueueProps {
  onCancelAll: () => void;
}

export const BatchQueue: React.FC<BatchQueueProps> = () => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [format, setFormat] = useState<'mkv' | 'mp4'>('mkv');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  const handlePickBatchFiles = async () => {
    try {
      const selectedVideos = await open({
        multiple: true,
        title: 'Select Video Files for Batch Muxing',
        filters: [
          {
            name: 'Video Files (*.mkv, *.mp4, *.mov, *.m4v)',
            extensions: ['mkv', 'mp4', 'mov', 'm4v', 'avi'],
          },
        ],
      });

      if (!selectedVideos) return;
      const videoList = Array.isArray(selectedVideos) ? selectedVideos : [selectedVideos];

      const selectedSubs = await open({
        multiple: true,
        title: 'Select Subtitle Files to Auto-Match (Optional)',
        filters: [
          {
            name: 'Subtitle Files (*.srt, *.vtt, *.ass)',
            extensions: ['srt', 'vtt', 'ass'],
          },
        ],
      });

      const subList = selectedSubs
        ? Array.isArray(selectedSubs)
          ? selectedSubs
          : [selectedSubs]
        : [];

      const matched: BatchItem[] = await invoke('match_batch_files', {
        videoPaths: videoList,
        subtitlePaths: subList,
        defaultFormat: format,
      });

      setItems(matched);
    } catch (err) {
      console.error('Batch selection error:', err);
    }
  };

  const handleManualPickSub = async (itemId: string) => {
    try {
      const selected = await open({
        multiple: false,
        title: 'Select Subtitle for this Video',
        filters: [
          {
            name: 'Subtitle Files (*.srt, *.vtt, *.ass)',
            extensions: ['srt', 'vtt', 'ass'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        const filename = selected.split(/[/\\]/).pop() || selected;
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  subtitle_path: selected,
                  subtitle_filename: filename,
                  status: 'ready',
                }
              : item
          )
        );
      }
    } catch (err) {
      console.error('Error selecting subtitle:', err);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setItems([]);
  };

  const handleStartBatch = async () => {
    const readyItems = items.filter((i) => i.subtitle_path && i.status !== 'done');
    if (readyItems.length === 0) return;

    setIsProcessingBatch(true);

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (!item.subtitle_path || item.status === 'done') continue;

      setCurrentIndex(idx);
      setItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, status: 'processing' } : it))
      );

      try {
        const req: MuxRequest = {
          video_path: item.video_path,
          subtitle_tracks: [
            {
              path: item.subtitle_path,
              language: 'eng',
              title: 'English',
              is_default: true,
            },
          ],
          output_path: item.output_path,
          output_format: item.output_format,
          existing_subtitles_count: 0,
        };

        await invoke<MuxResult>('mux_subtitles', { request: req });

        setItems((prev) =>
          prev.map((it, i) => (i === idx ? { ...it, status: 'done' } : it))
        );
      } catch (err: any) {
        console.error(`Error processing batch item ${idx}:`, err);
        setItems((prev) =>
          prev.map((it, i) =>
            i === idx
              ? { ...it, status: 'error', error_message: String(err) }
              : it
          )
        );
      }
    }

    setIsProcessingBatch(false);
    setCurrentIndex(null);
  };

  const handleStopBatch = async () => {
    try {
      await invoke('cancel_mux');
    } catch (err) {
      console.error('Cancel batch error:', err);
    }
    setIsProcessingBatch(false);
    setCurrentIndex(null);
  };

  const readyCount = items.filter((i) => i.status === 'ready' && i.subtitle_path).length;
  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Batch Header Controls */}
      <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>TV Show & Series Batch Queue</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Auto-pairs episodes with subtitles by filename and muxes all files sequentially.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Format Selector */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setFormat('mkv');
                setItems((prev) =>
                  prev.map((i) => ({
                    ...i,
                    output_format: 'mkv',
                    output_path: i.output_path.replace(/\.[^/.]+$/, '.mkv'),
                  }))
                );
              }}
              className={`px-3 py-1 font-semibold rounded-lg transition-colors ${
                format === 'mkv'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              MKV
            </button>
            <button
              type="button"
              onClick={() => {
                setFormat('mp4');
                setItems((prev) =>
                  prev.map((i) => ({
                    ...i,
                    output_format: 'mp4',
                    output_path: i.output_path.replace(/\.[^/.]+$/, '.mp4'),
                  }))
                );
              }}
              className={`px-3 py-1 font-semibold rounded-lg transition-colors ${
                format === 'mp4'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              MP4
            </button>
          </div>

          <button
            type="button"
            onClick={handlePickBatchFiles}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Add Episodes & Subs...</span>
          </button>
        </div>
      </div>

      {/* Queue Table */}
      {items.length === 0 ? (
        <div
          onClick={handlePickBatchFiles}
          className="border-2 border-dashed border-zinc-300 dark:border-zinc-800 hover:border-blue-500/50 bg-white dark:bg-zinc-900/40 rounded-2xl p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              No files in the batch queue
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Click to select a season folder or multiple episode videos & subtitle files.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Queue Status: {doneCount} of {items.length} completed ({readyCount} ready)
            </span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-zinc-400 hover:text-rose-500 transition-colors flex items-center space-x-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Queue</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {items.map((item, idx) => {
              const isCurrent = currentIndex === idx;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                    isCurrent
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500/60 shadow-sm'
                      : item.status === 'done'
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/30 text-zinc-600 dark:text-zinc-400'
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {/* Status Indicator */}
                  <div className="shrink-0">
                    {item.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : item.status === 'processing' ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : item.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    ) : item.subtitle_path ? (
                      <Clock className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                  </div>

                  {/* Video & Subtitle Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center space-x-2">
                      <FileVideo className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {item.video_filename}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px]">
                      <Subtitles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      {item.subtitle_filename ? (
                        <span className="text-zinc-600 dark:text-zinc-300 truncate">
                          {item.subtitle_filename}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleManualPickSub(item.id)}
                          className="text-amber-500 hover:underline font-medium"
                        >
                          + Match Subtitle Manually...
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Format Pill & Actions */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
                      {item.output_format}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-zinc-400 hover:text-rose-500 transition-colors"
                      title="Remove from queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Bar */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Output will be saved in the source video folder with <code>_subbed.{format}</code> suffix.
            </span>

            <div className="flex items-center space-x-3">
              {isProcessingBatch ? (
                <button
                  type="button"
                  onClick={handleStopBatch}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Batch</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartBatch}
                  disabled={readyCount === 0}
                  className={`px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md ${
                    readyCount > 0
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Mux All ({readyCount} Ready)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
