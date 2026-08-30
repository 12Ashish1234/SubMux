use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SubtitleTrackConfig {
    pub path: String,
    pub language: String, // e.g. "eng", "hin", "spa"
    pub title: String,    // e.g. "English (SDH)", "Hindi Full"
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MuxRequest {
    pub video_path: String,
    pub subtitle_tracks: Vec<SubtitleTrackConfig>,
    pub output_path: String,
    pub output_format: Option<String>, // "mkv", "mp4", etc. If None, inferred from output_path extension
    #[serde(default)]
    pub existing_subtitles_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MuxProgressPayload {
    pub percentage: f64,
    pub out_time_secs: f64,
    pub total_duration_secs: f64,
    pub speed: Option<String>,
    pub frame: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MuxResult {
    pub output_path: String,
    pub output_size_bytes: u64,
}

/// Parses FFmpeg out_time string formatted as HH:MM:SS.fraction (e.g. "01:23:45.678900")
pub fn parse_time_str(time_str: &str) -> Option<f64> {
    let parts: Vec<&str> = time_str.trim().split(':').collect();
    if parts.len() == 3 {
        let hrs = parts[0].parse::<f64>().ok()?;
        let mins = parts[1].parse::<f64>().ok()?;
        let secs = parts[2].parse::<f64>().ok()?;
        Some(hrs * 3600.0 + mins * 60.0 + secs)
    } else {
        None
    }
}

/// Detects the target container format string from format option or file extension.
pub fn get_container_format(request: &MuxRequest) -> String {
    if let Some(ref fmt) = request.output_format {
        return fmt.trim().to_lowercase();
    }
    Path::new(&request.output_path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_else(|| "mkv".to_string())
}

/// Pure function to build the ffmpeg command argument list.
/// Isolated and unit-tested.
pub fn build_mux_command(request: &MuxRequest) -> Vec<String> {
    let mut args = Vec::new();

    // Overwrite output file without asking
    args.push("-y".to_string());

    // 1. Input video file (input index 0)
    args.push("-i".to_string());
    args.push(request.video_path.clone());

    // 2. Input subtitle files (input index 1 .. N)
    for track in &request.subtitle_tracks {
        args.push("-i".to_string());
        args.push(track.path.clone());
    }

    // 3. Map all streams from input video
    args.push("-map".to_string());
    args.push("0".to_string());

    // 4. Map first stream of each subtitle input file
    for i in 0..request.subtitle_tracks.len() {
        args.push("-map".to_string());
        args.push(format!("{}:0", i + 1));
    }

    // 5. Default copy-all codec flag (lossless muxing, no video/audio re-encoding)
    args.push("-c".to_string());
    args.push("copy".to_string());

    // 6. Container-specific subtitle codec mapping
    let container = get_container_format(request);
    let is_mp4 = matches!(container.as_str(), "mp4" | "m4v" | "mov");
    if is_mp4 {
        // MP4 container requires mov_text for timed text subtitles
        args.push("-c:s".to_string());
        args.push("mov_text".to_string());
    } else {
        // Matroska supports srt (SubRip) natively
        args.push("-c:s".to_string());
        args.push("srt".to_string());
    }

    // Check if any of the new tracks is set to default
    let has_new_default = request.subtitle_tracks.iter().any(|t| t.is_default);

    // If a new track is set as default and there were existing subtitle streams in input 0,
    // clear default disposition on existing subtitle streams so only the chosen track is default.
    if has_new_default && request.existing_subtitles_count > 0 {
        for existing_idx in 0..request.existing_subtitles_count {
            args.push(format!("-disposition:s:{}", existing_idx));
            args.push("0".to_string());
        }
    }

    // 7. Track metadata and disposition for each newly added subtitle track
    for (idx, track) in request.subtitle_tracks.iter().enumerate() {
        let stream_idx = request.existing_subtitles_count + idx;
        let lang = if track.language.trim().is_empty() {
            "und"
        } else {
            track.language.trim()
        };

        args.push(format!("-metadata:s:s:{}", stream_idx));
        args.push(format!("language={}", lang));

        let title_clean = track.title.trim();
        if !title_clean.is_empty() {
            args.push(format!("-metadata:s:s:{}", stream_idx));
            args.push(format!("title={}", title_clean));

            // In MP4 / QuickTime container, track label is read from handler_name
            if is_mp4 {
                args.push(format!("-metadata:s:s:{}", stream_idx));
                args.push(format!("handler_name={}", title_clean));
            }
        }

        if track.is_default {
            args.push(format!("-disposition:s:{}", stream_idx));
            args.push("default".to_string());
        } else {
            args.push(format!("-disposition:s:{}", stream_idx));
            args.push("0".to_string());
        }
    }

    // 8. Output file path
    args.push(request.output_path.clone());

    args
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_time_str() {
        assert_eq!(parse_time_str("00:00:02.000000"), Some(2.0));
        assert_eq!(parse_time_str("01:23:45.500"), Some(1.0 * 3600.0 + 23.0 * 60.0 + 45.5));
        assert_eq!(parse_time_str("invalid"), None);
    }

    #[test]
    fn test_single_track_mkv() {
        let req = MuxRequest {
            video_path: "/path/to/movie.mkv".to_string(),
            subtitle_tracks: vec![SubtitleTrackConfig {
                path: "/path/to/movie_en.srt".to_string(),
                language: "eng".to_string(),
                title: "English Full".to_string(),
                is_default: true,
            }],
            output_path: "/path/to/movie_subbed.mkv".to_string(),
            output_format: None,
            existing_subtitles_count: 0,
        };

        let args = build_mux_command(&req);

        assert_eq!(args[0], "-y");
        assert_eq!(args[1], "-i");
        assert_eq!(args[2], "/path/to/movie.mkv");
        assert_eq!(args[3], "-i");
        assert_eq!(args[4], "/path/to/movie_en.srt");
        
        assert!(args.windows(2).any(|w| w[0] == "-map" && w[1] == "0"));
        assert!(args.windows(2).any(|w| w[0] == "-map" && w[1] == "1:0"));
        assert!(args.windows(2).any(|w| w[0] == "-c" && w[1] == "copy"));
        assert!(args.windows(2).any(|w| w[0] == "-c:s" && w[1] == "srt"));

        assert!(args.windows(2).any(|w| w[0] == "-metadata:s:s:0" && w[1] == "language=eng"));
        assert!(args.windows(2).any(|w| w[0] == "-metadata:s:s:0" && w[1] == "title=English Full"));
        assert!(args.windows(2).any(|w| w[0] == "-disposition:s:0" && w[1] == "default"));

        assert_eq!(args.last().unwrap(), "/path/to/movie_subbed.mkv");
    }

    #[test]
    fn test_multiple_tracks_mp4_with_existing_subtitles() {
        let req = MuxRequest {
            video_path: "/path/to/video.mp4".to_string(),
            subtitle_tracks: vec![
                SubtitleTrackConfig {
                    path: "/path/to/eng.srt".to_string(),
                    language: "eng".to_string(),
                    title: "English [SDH]".to_string(),
                    is_default: true,
                },
                SubtitleTrackConfig {
                    path: "/path/to/hin.srt".to_string(),
                    language: "hin".to_string(),
                    title: "Hindi Audio Sub".to_string(),
                    is_default: false,
                },
            ],
            output_path: "/path/to/video_subbed.mp4".to_string(),
            output_format: Some("mp4".to_string()),
            existing_subtitles_count: 1, // Video already had 1 subtitle stream
        };

        let args = build_mux_command(&req);

        // Existing track 0 disposition should be cleared to 0
        assert!(args.windows(2).any(|w| w[0] == "-disposition:s:0" && w[1] == "0"));

        // New track 0 is stream index 1 (1 + 0)
        assert!(args.windows(2).any(|w| w[0] == "-metadata:s:s:1" && w[1] == "language=eng"));
        assert!(args.windows(2).any(|w| w[0] == "-metadata:s:s:1" && w[1] == "title=English [SDH]"));
        assert!(args.windows(2).any(|w| w[0] == "-metadata:s:s:1" && w[1] == "handler_name=English [SDH]"));
        assert!(args.windows(2).any(|w| w[0] == "-disposition:s:1" && w[1] == "default"));

        // New track 1 is stream index 2 (1 + 1)
        assert!(args.windows(2).any(|w| w[0] == "-metadata:s:s:2" && w[1] == "language=hin"));
        assert!(args.windows(2).any(|w| w[0] == "-metadata:s:s:2" && w[1] == "title=Hindi Audio Sub"));
        assert!(args.windows(2).any(|w| w[0] == "-metadata:s:s:2" && w[1] == "handler_name=Hindi Audio Sub"));
        assert!(args.windows(2).any(|w| w[0] == "-disposition:s:2" && w[1] == "0"));
    }
}
