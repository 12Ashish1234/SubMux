export interface EnvironmentStatus {
  ffmpeg_available: boolean;
  ffprobe_available: boolean;
  ffmpeg_path: string | null;
  ffprobe_path: string | null;
  ffmpeg_version: string | null;
  ffprobe_version: string | null;
  error_message: string | null;
}

export interface StreamInfo {
  index: number;
  codec_type: string;
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
  id: string; // React key
  path: string;
  filename: string;
  language: string; // ISO 639-2 e.g. "eng", "hin"
  title: string;
  is_default: boolean;
  size_bytes?: number;
}

export interface MuxRequest {
  video_path: string;
  subtitle_tracks: {
    path: string;
    language: string;
    title: string;
    is_default: boolean;
  }[];
  output_path: string;
  output_format?: string | null;
  existing_subtitles_count?: number;
}

export interface MuxProgressPayload {
  percentage: number;
  out_time_secs: number;
  total_duration_secs: number;
  speed?: string | null;
  frame?: number | null;
}

export interface MuxResult {
  output_path: string;
  output_size_bytes: number;
}

export const COMMON_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'hin', name: 'Hindi (हिंदी)' },
  { code: 'spa', name: 'Spanish (Español)' },
  { code: 'fre', name: 'French (Français)' },
  { code: 'ger', name: 'German (Deutsch)' },
  { code: 'jpn', name: 'Japanese (日本語)' },
  { code: 'kor', name: 'Korean (한국어)' },
  { code: 'chi', name: 'Chinese (中文)' },
  { code: 'ita', name: 'Italian (Italiano)' },
  { code: 'por', name: 'Portuguese (Português)' },
  { code: 'rus', name: 'Russian (Русский)' },
  { code: 'ara', name: 'Arabic (العربية)' },
  { code: 'tam', name: 'Tamil (தமிழ்)' },
  { code: 'tel', name: 'Telugu (తెలుగు)' },
  { code: 'ben', name: 'Bengali (বাংলা)' },
  { code: 'und', name: 'Undetermined / Custom' },
] as const;
