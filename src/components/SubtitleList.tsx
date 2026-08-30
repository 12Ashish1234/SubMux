import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Plus, Subtitles } from 'lucide-react';
import { SubtitleTrackConfig } from '../types';
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
  const handlePickSubtitles = async () => {
    try {
      const selected = await open({
        multiple: true,
        title: 'Select Subtitle Files',
        filters: [
          {
            name: 'Subtitle Files (*.srt, *.vtt, *.ass)',
            extensions: ['srt', 'vtt', 'ass'],
          },
        ],
      });

      if (selected) {
        const filePaths = Array.isArray(selected) ? selected : [selected];
        const newTracks: SubtitleTrackConfig[] = filePaths.map((path, idx) => {
          const filename = extractFilename(path);
          // Try to infer language and title from filename (e.g. video.eng.srt or video.Hindi.srt)
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
          }

          return {
            id: `${Date.now()}-${idx}-${Math.random()}`,
            path,
            filename,
            language: lang,
            title,
            is_default: tracks.length === 0 && idx === 0, // First track default if none exist
          };
        });

        onAddTracks(newTracks);
      }
    } catch (err) {
      console.error('Subtitle file picker error:', err);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files);
      const newTracks: SubtitleTrackConfig[] = fileList.map((file, idx) => {
        const path = (file as any).path || file.name;
        const filename = extractFilename(path);
        return {
          id: `${Date.now()}-${idx}-${Math.random()}`,
          path,
          filename,
          language: 'eng',
          title: 'English',
          is_default: tracks.length === 0 && idx === 0,
        };
      });
      onAddTracks(newTracks);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Subtitles className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-200">
            Subtitle Tracks ({tracks.length})
          </h2>
        </div>

        <button
          onClick={handlePickSubtitles}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-sm"
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
          className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/50 rounded-xl p-6 text-center cursor-pointer transition-all"
        >
          <p className="text-xs font-medium text-zinc-400">
            No subtitles added yet. Click <span className="text-blue-400 font-semibold">+ Add Subtitles</span> or drag subtitle files here.
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Supports <span className="font-mono">.srt</span>, <span className="font-mono">.vtt</span>, <span className="font-mono">.ass</span>
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
