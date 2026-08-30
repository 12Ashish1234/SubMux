use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BurnRequest {
    pub video_path: String,
    pub subtitle_path: String,
    pub output_path: String,
    pub output_format: Option<String>,
    pub encoder: Option<String>,        // "videotoolbox" | "libx264"
    pub font_size: Option<u32>,         // e.g. 20, 24, 28
    pub font_color: Option<String>,      // "white" | "yellow"
    pub has_box: Option<bool>,          // translucent background box
    pub quality_preset: Option<String>, // "high" | "medium" | "fast"
}

/// Escapes path for FFmpeg video filter syntax
pub fn escape_filter_path(path: &str) -> String {
    // In FFmpeg -vf subtitles=...
    // Colons ':', single quotes '\'', brackets, and backslashes must be escaped
    path.replace('\\', "\\\\")
        .replace(':', "\\:")
        .replace('\'', "'\\''")
        .replace('[', "\\[")
        .replace(']', "\\]")
}

/// Builds the force_style parameter string for ASS/SRT subtitle rendering
pub fn build_force_style(request: &BurnRequest) -> String {
    let font_size = request.font_size.unwrap_or(24);
    let color_hex = match request.font_color.as_deref() {
        Some("yellow") => "&H0000FFFF&", // ASS format is &HAABBGGRR&
        _ => "&H00FFFFFF&",              // White
    };

    let border_style = if request.has_box.unwrap_or(false) {
        "3" // Opaque box
    } else {
        "1" // Outline + drop shadow
    };

    format!(
        "FontName=Helvetica,FontSize={},PrimaryColour={},OutlineColour=&H00000000&,BackColour=&H80000000&,BorderStyle={},Outline=2,Shadow=1,MarginV=25,Alignment=2",
        font_size, color_hex, border_style
    )
}

/// Pure function to build the FFmpeg argument list for subtitle burn-in
pub fn build_burn_command(request: &BurnRequest) -> Vec<String> {
    let mut args = Vec::new();

    // Overwrite without asking
    args.push("-y".to_string());

    // 1. Input video file
    args.push("-i".to_string());
    args.push(request.video_path.clone());

    // 2. Video Filter with force_style
    let escaped_sub_path = escape_filter_path(&request.subtitle_path);
    let style = build_force_style(request);
    let filter_arg = format!("subtitles='{}':force_style='{}'", escaped_sub_path, style);

    args.push("-vf".to_string());
    args.push(filter_arg);

    // 3. Video Encoder (Hardware VideoToolbox on Apple Silicon or libx264)
    let encoder = request.encoder.as_deref().unwrap_or("videotoolbox");
    if encoder == "libx264" {
        args.push("-c:v".to_string());
        args.push("libx264".to_string());

        let (crf, preset) = match request.quality_preset.as_deref() {
            Some("fast") => ("26", "veryfast"),
            Some("high") => ("19", "slow"),
            _ => ("22", "medium"), // Default medium
        };
        args.push("-crf".to_string());
        args.push(crf.to_string());
        args.push("-preset".to_string());
        args.push(preset.to_string());
    } else {
        // macOS Apple Silicon Hardware Acceleration (VideoToolbox)
        args.push("-c:v".to_string());
        args.push("h264_videotoolbox".to_string());

        let bitrate = match request.quality_preset.as_deref() {
            Some("fast") => "3500k",
            Some("high") => "8000k",
            _ => "5500k",
        };
        args.push("-b:v".to_string());
        args.push(bitrate.to_string());
    }

    // Ensure broad player compatibility with standard 8-bit YUV 4:2:0
    args.push("-pix_fmt".to_string());
    args.push("yuv420p".to_string());

    // 4. Audio stream copy (lossless audio copy, no transcoding)
    args.push("-c:a".to_string());
    args.push("copy".to_string());

    // 5. Output file path
    args.push(request.output_path.clone());

    args
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escape_filter_path() {
        let p = "/Users/test/My Movies/Movie: Part 1 [2024].srt";
        let escaped = escape_filter_path(p);
        assert_eq!(escaped, "/Users/test/My Movies/Movie\\: Part 1 \\[2024\\].srt");
    }

    #[test]
    fn test_build_burn_command_videotoolbox() {
        let req = BurnRequest {
            video_path: "/path/video.mp4".to_string(),
            subtitle_path: "/path/sub.srt".to_string(),
            output_path: "/path/video_burned.mp4".to_string(),
            output_format: Some("mp4".to_string()),
            encoder: Some("videotoolbox".to_string()),
            font_size: Some(26),
            font_color: Some("yellow".to_string()),
            has_box: Some(false),
            quality_preset: Some("high".to_string()),
        };

        let args = build_burn_command(&req);

        assert_eq!(args[0], "-y");
        assert_eq!(args[1], "-i");
        assert_eq!(args[2], "/path/video.mp4");

        // Check filter
        assert_eq!(args[3], "-vf");
        assert!(args[4].starts_with("subtitles='/path/sub.srt':force_style="));
        assert!(args[4].contains("FontSize=26"));
        assert!(args[4].contains("PrimaryColour=&H0000FFFF&"));

        // VideoToolbox flags
        assert!(args.windows(2).any(|w| w[0] == "-c:v" && w[1] == "h264_videotoolbox"));
        assert!(args.windows(2).any(|w| w[0] == "-b:v" && w[1] == "8000k"));
        assert!(args.windows(2).any(|w| w[0] == "-c:a" && w[1] == "copy"));
        assert_eq!(args.last().unwrap(), "/path/video_burned.mp4");
    }

    #[test]
    fn test_build_burn_command_x264() {
        let req = BurnRequest {
            video_path: "/path/video.mkv".to_string(),
            subtitle_path: "/path/sub.srt".to_string(),
            output_path: "/path/video_burned.mkv".to_string(),
            output_format: Some("mkv".to_string()),
            encoder: Some("libx264".to_string()),
            font_size: Some(20),
            font_color: Some("white".to_string()),
            has_box: Some(true),
            quality_preset: Some("fast".to_string()),
        };

        let args = build_burn_command(&req);
        assert!(args.windows(2).any(|w| w[0] == "-c:v" && w[1] == "libx264"));
        assert!(args.windows(2).any(|w| w[0] == "-crf" && w[1] == "26"));
        assert!(args.windows(2).any(|w| w[0] == "-preset" && w[1] == "veryfast"));
        assert!(args[4].contains("BorderStyle=3"));
    }
}
