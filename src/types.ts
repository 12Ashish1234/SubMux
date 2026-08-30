export type AppMode = 'mux' | 'burn' | 'batch';

export interface StreamInfo {
  index: number;
  codec_type: 'video' | 'audio' | 'subtitle' | string;
  codec_name?: string;
  language?: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface VideoInfo {
  path: string;
  filename: string;
  format_name: string;
  duration_secs: number;
  size_bytes: number;
  streams: StreamInfo[];
  video_streams_count: number;
  audio_streams_count: number;
  subtitle_streams_count: number;
}

export interface SubtitleTrackConfig {
  id: string;
  path: string;
  filename: string;
  language: string;
  title: string;
  is_default: boolean;
  time_offset_secs?: number; // e.g. +1.5, -0.8
}

export interface MuxRequest {
  video_path: string;
  subtitle_tracks: Array<{
    path: string;
    language: string;
    title: string;
    is_default: boolean;
    time_offset_secs?: number;
  }>;
  output_path: string;
  output_format?: string;
  existing_subtitles_count?: number;
}

export interface BurnRequest {
  video_path: string;
  subtitle_path: string;
  output_path: string;
  output_format?: string;
  encoder?: string;        // "videotoolbox" | "libx264"
  font_size?: number;       // 18, 24, 30
  font_color?: string;      // "white" | "yellow"
  has_box?: boolean;
  quality_preset?: string; // "high" | "medium" | "fast"
  time_offset_secs?: number;
}

export interface BatchItem {
  id: string;
  video_path: string;
  video_filename: string;
  subtitle_path: string | null;
  subtitle_filename: string | null;
  output_path: string;
  output_format: string; // "mkv" | "mp4"
  status: 'ready' | 'no_subtitle' | 'processing' | 'done' | 'error';
  error_message?: string | null;
}

export interface MuxProgressPayload {
  percentage: number;
  out_time_secs: number;
  total_duration_secs: number;
  speed: string | null;
  frame: number | null;
}

export interface MuxResult {
  output_path: string;
  output_size_bytes: number;
}

export interface EnvironmentStatus {
  ffmpeg_available: boolean;
  ffprobe_available: boolean;
  ffmpeg_version?: string;
  ffprobe_version?: string;
  error_message?: string;
}

export const COMMON_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'hin', name: 'Hindi' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fre', name: 'French' },
  { code: 'ger', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'chi', name: 'Chinese' },
  { code: 'por', name: 'Portuguese' },
  { code: 'rus', name: 'Russian' },
  { code: 'ara', name: 'Arabic' },
  { code: 'und', name: 'Undetermined' },
];
