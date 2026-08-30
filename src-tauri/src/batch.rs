use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BatchItem {
    pub id: String,
    pub video_path: String,
    pub video_filename: String,
    pub subtitle_path: Option<String>,
    pub subtitle_filename: Option<String>,
    pub output_path: String,
    pub output_format: String, // "mkv" | "mp4"
    pub status: String,        // "ready" | "no_subtitle" | "processing" | "done" | "error"
    pub error_message: Option<String>,
}

/// Normalizes filename for fuzzy matching (removes extensions, release tags, spaces, dots)
pub fn clean_name(filename: &str) -> String {
    let base = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename)
        .to_lowercase();

    base.replace(['.', '_', '-'], " ")
}

/// Extracts season/episode identifier like "s01e05", "1x05", "e05", "ep05"
pub fn extract_episode_token(name: &str) -> Option<String> {
    let lower = name.to_lowercase();
    let chars: Vec<char> = lower.chars().collect();
    let len = chars.len();

    // 1. Match s01e05 / s1e1
    for i in 0..len {
        if chars[i] == 's' {
            let mut j = i + 1;
            while j < len && chars[j].is_ascii_digit() {
                j += 1;
            }
            if j > i + 1 && j < len && chars[j] == 'e' {
                let mut k = j + 1;
                while k < len && chars[k].is_ascii_digit() {
                    k += 1;
                }
                if k > j + 1 {
                    let s_str: String = chars[i + 1..j].iter().collect();
                    let e_str: String = chars[j + 1..k].iter().collect();
                    if let (Ok(s), Ok(e)) = (s_str.parse::<u32>(), e_str.parse::<u32>()) {
                        return Some(format!("s{:02}e{:02}", s, e));
                    }
                }
            }
        }
    }

    // 2. Match 1x05
    for i in 0..len {
        if chars[i] == 'x' {
            let mut start = i;
            while start > 0 && chars[start - 1].is_ascii_digit() {
                start -= 1;
            }
            let mut end = i + 1;
            while end < len && chars[end].is_ascii_digit() {
                end += 1;
            }
            if start < i && end > i + 1 {
                let s_str: String = chars[start..i].iter().collect();
                let e_str: String = chars[i + 1..end].iter().collect();
                if let (Ok(s), Ok(e)) = (s_str.parse::<u32>(), e_str.parse::<u32>()) {
                    return Some(format!("s{:02}e{:02}", s, e));
                }
            }
        }
    }

    // 3. Match e05 / ep05 / episode 05
    for i in 0..len {
        if chars[i] == 'e' {
            let mut j = i + 1;
            if j < len && chars[j] == 'p' {
                j += 1;
            }
            // Skip optional space or dash
            while j < len && (chars[j] == ' ' || chars[j] == '-' || chars[j] == '_') {
                j += 1;
            }
            let start_digits = j;
            while j < len && chars[j].is_ascii_digit() {
                j += 1;
            }
            if j > start_digits {
                let e_str: String = chars[start_digits..j].iter().collect();
                if let Ok(e) = e_str.parse::<u32>() {
                    return Some(format!("e{:02}", e));
                }
            }
        }
    }

    None
}

/// Automatically matches video files with corresponding subtitle files
pub fn match_videos_and_subtitles(
    video_paths: &[String],
    subtitle_paths: &[String],
    default_format: &str,
) -> Vec<BatchItem> {
    let mut items = Vec::new();

    for (idx, vid_path) in video_paths.iter().enumerate() {
        let vid_p = Path::new(vid_path);
        let vid_filename = vid_p
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or(vid_path)
            .to_string();

        let vid_clean = clean_name(&vid_filename);
        let vid_ep = extract_episode_token(&vid_filename);

        // Find best matching subtitle
        let mut best_match: Option<String> = None;
        let mut best_score = 0;

        for sub_path in subtitle_paths {
            let sub_filename = Path::new(sub_path)
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or(sub_path);

            let sub_clean = clean_name(sub_filename);
            let sub_ep = extract_episode_token(sub_filename);

            // 1. Exact match on episode token (e.g. S01E01)
            if let (Some(ref vep), Some(ref sep)) = (&vid_ep, &sub_ep) {
                if vep == sep {
                    best_match = Some(sub_path.clone());
                    break;
                }
            }

            // 2. Exact stem match (e.g. Movie.mkv and Movie.srt or Movie.en.srt)
            if sub_clean.starts_with(&vid_clean) || vid_clean.starts_with(&sub_clean) {
                let score = sub_clean.len().min(vid_clean.len());
                if score > best_score {
                    best_score = score;
                    best_match = Some(sub_path.clone());
                }
            }
        }

        let sub_filename = best_match.as_ref().map(|p| {
            Path::new(p)
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or(p)
                .to_string()
        });

        let output_format = default_format.to_lowercase();
        let stem = vid_p
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output");
        let parent = vid_p.parent().unwrap_or_else(|| Path::new(""));
        let output_filename = format!("{}_subbed.{}", stem, output_format);
        let output_path = parent.join(output_filename).to_string_lossy().to_string();

        let status = if best_match.is_some() {
            "ready".to_string()
        } else {
            "no_subtitle".to_string()
        };

        items.push(BatchItem {
            id: format!("batch-{}-{}", idx, date_id()),
            video_path: vid_path.clone(),
            video_filename: vid_filename,
            subtitle_path: best_match,
            subtitle_filename: sub_filename,
            output_path,
            output_format,
            status,
            error_message: None,
        });
    }

    items
}

fn date_id() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_episode_token_extraction() {
        assert_eq!(
            extract_episode_token("Series.S01E05.1080p.mkv"),
            Some("s01e05".to_string())
        );
        assert_eq!(
            extract_episode_token("Show.1x02.HDTV.mp4"),
            Some("s01e02".to_string())
        );
        assert_eq!(
            extract_episode_token("Anime - Episode 09.mkv"),
            Some("e09".to_string())
        );
    }

    #[test]
    fn test_batch_auto_matching() {
        let videos = vec![
            "/Media/Show.S01E01.720p.mkv".to_string(),
            "/Media/Show.S01E02.720p.mkv".to_string(),
        ];
        let subs = vec![
            "/Media/Show.S01E02.English.srt".to_string(),
            "/Media/Show.S01E01.English.srt".to_string(),
        ];

        let matched = match_videos_and_subtitles(&videos, &subs, "mp4");
        assert_eq!(matched.len(), 2);
        assert_eq!(
            matched[0].subtitle_filename.as_deref(),
            Some("Show.S01E01.English.srt")
        );
        assert_eq!(
            matched[1].subtitle_filename.as_deref(),
            Some("Show.S01E02.English.srt")
        );
        assert_eq!(matched[0].status, "ready");
    }
}
