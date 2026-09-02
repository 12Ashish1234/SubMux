import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Subtitles } from 'lucide-react';
import { SubtitleTrackConfig, SanitizeResult } from '../types';
import { SubtitleTrackCard } from './SubtitleTrackCard';
import { extractFilename } from '../utils/formatters';

interface SubtitleListProps {
  tracks: SubtitleTrackConfig[];
  onAddTracks: (newTracks: SubtitleTrackConfig[]) => void;
  onUpdateTrack: (id: string, updates: Partial<SubtitleTrackConfig>) => void;
  onRemoveTrack: (id: string) => void;
  onSetDefault: (id: string) => void;
}

export const SubtitleList: React.FC<SubtitleListProps> = ({
  tracks,
  onAddTracks,
  onUpdateTrack,
  onRemoveTrack,
  onSetDefault,
}) => {
  const processSubtitleFiles = async (filePaths: string[]) => {
    const newTracks: SubtitleTrackConfig[] = [];

    for (let idx = 0; idx < filePaths.length; idx++) {
      const path = filePaths[idx];
      const filename = extractFilename(path);
      const lower = filename.toLowerCase();
      let lang = 'eng';
      let title = 'English';

      if (lower.includes('hin') || lower.includes('hindi')) {
        lang = 'hin';
        title = 'Hindi';
      } else if (lower.includes('spa') || lower.includes('spanish')) {
        lang = 'spa';
        title = 'Spanish';
      } else if (lower.includes('fre') || lower.includes('fra') || lower.includes('french')) {
        lang = 'fre';
        title = 'French';
      } else if (lower.includes('ger') || lower.includes('deu') || lower.includes('german')) {
        lang = 'ger';
        title = 'German';
      } else if (lower.includes('jpn') || lower.includes('japanese')) {
        lang = 'jpn';
        title = 'Japanese';
      } else if (lower.includes('chi') || lower.includes('chinese')) {
        lang = 'chi';
        title = 'Chinese';
      } else if (lower.includes('ara') || lower.includes('arabic')) {
        lang = 'ara';
        title = 'Arabic';
      } else if (lower.includes('rus') || lower.includes('russian')) {
        lang = 'rus';
        title = 'Russian';
      }

      let sanitizedPath = path;
      let detectedEncoding = 'UTF-8';
      let originalFormat = 'srt';
      let wasConverted = false;
      let cuesCount = 0;

      try {
        const sanResult = await invoke<SanitizeResult>('sanitize_subtitle', { inputPath: path });
        sanitizedPath = sanResult.sanitized_path;
        detectedEncoding = sanResult.detected_encoding;
        originalFormat = sanResult.original_format;
        wasConverted = sanResult.was_converted;
        cuesCount = sanResult.cues_count;
      } catch (e) {
        console.warn('Subtitle sanitization warning:', e);
      }

      newTracks.push({
        id: `${Date.now()}-${idx}-${Math.random()}`,
        path: sanitizedPath,
        filename,
        language: lang,
        title,
        is_default: tracks.length === 0 && idx === 0,
        encoding: detectedEncoding,
        original_format: originalFormat,
        was_converted: wasConverted,
        cues_count: cuesCount,
      });
    }

    if (newTracks.length > 0) {
      onAddTracks(newTracks);
    }
  };

  const handlePickSubtitles = async () => {
    try {
      const selected = await open({
        multiple: true,
        title: 'Select Subtitle Files',
        filters: [
          {
            name: 'Subtitle Files (*.srt, *.vtt, *.ass, *.ssa)',
            extensions: ['srt', 'vtt', 'ass', 'ssa'],
          },
        ],
      });

      if (selected) {
        const filePaths = Array.isArray(selected) ? selected : [selected];
        await processSubtitleFiles(filePaths);
      }
    } catch (err) {
      console.error('Subtitle file picker error:', err);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files);
      const paths = fileList.map((file) => (file as any).path || file.name).filter(Boolean);
      await processSubtitleFiles(paths);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Subtitles className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Subtitle Tracks ({tracks.length})
          </h2>
        </div>

        <button
          onClick={handlePickSubtitles}
          className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 active:bg-zinc-300 dark:active:bg-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Subtitles</span>
        </button>
      </div>

      {tracks.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={handlePickSubtitles}
          className="border border-dashed border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/30 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-xl p-6 text-center cursor-pointer transition-all shadow-sm"
        >
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            No subtitles added yet. Click <span className="text-blue-600 dark:text-blue-400 font-semibold">+ Add Subtitles</span> or drag subtitle files here.
          </p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            Supports <span className="font-mono">.srt</span>, <span className="font-mono">.vtt</span>, <span className="font-mono">.ass</span> (Auto-converted & UTF-8 verified)
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tracks.map((track, idx) => (
            <SubtitleTrackCard
              key={track.id}
              track={track}
              index={idx}
              onUpdateTrack={onUpdateTrack}
              onRemoveTrack={onRemoveTrack}
              onSetDefault={onSetDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
};
