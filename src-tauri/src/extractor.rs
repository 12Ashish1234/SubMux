use crate::ffmpeg::find_binary;
use std::process::Command;

pub fn build_extract_command(
    video_path: &str,
    stream_index: usize,
    output_path: &str,
) -> Vec<String> {
    vec![
        "-y".to_string(),
        "-i".to_string(),
        video_path.to_string(),
        "-map".to_string(),
        format!("0:{}", stream_index),
        output_path.to_string(),
    ]
}

pub fn extract_subtitle_track(
    video_path: &str,
    stream_index: usize,
    output_path: &str,
) -> Result<String, String> {
    let ffmpeg_path = find_binary("ffmpeg").ok_or_else(|| {
        "ffmpeg binary not found. Please install ffmpeg via Homebrew: brew install ffmpeg"
            .to_string()
    })?;

    let args = build_extract_command(video_path, stream_index, output_path);

    let output = Command::new(&ffmpeg_path)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute extraction command: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Subtitle extraction failed:\n{}", err_msg));
    }

    Ok(output_path.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_extract_command() {
        let cmd = build_extract_command("/path/to/movie.mkv", 2, "/path/to/sub.srt");
        assert_eq!(
            cmd,
            vec![
                "-y",
                "-i",
                "/path/to/movie.mkv",
                "-map",
                "0:2",
                "/path/to/sub.srt"
            ]
        );
    }
}
