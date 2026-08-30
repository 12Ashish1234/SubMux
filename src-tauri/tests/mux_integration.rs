use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::Once;
use submux_lib::burner::{build_burn_command, BurnRequest};
use submux_lib::ffmpeg::{check_environment, find_binary, probe_video};
use submux_lib::muxer::{build_mux_command, MuxRequest, SubtitleTrackConfig};

static INIT_MEDIA: Once = Once::new();

fn ensure_test_media() {
    INIT_MEDIA.call_once(|| {
        let video_path = "/tmp/submux_test_video.mp4";
        let srt_en = "/tmp/submux_test_en.srt";
        let srt_hi = "/tmp/submux_test_hi.srt";

        let ffmpeg_bin = find_binary("ffmpeg")
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "ffmpeg".to_string());

        // 1. Generate 2-second test video if not present
        if !Path::new(video_path).exists() {
            let _ = Command::new(&ffmpeg_bin)
                .args(&[
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    "testsrc=duration=2:size=320x240:rate=30",
                    "-f",
                    "lavfi",
                    "-i",
                    "sine=frequency=1000:duration=2",
                    "-c:v",
                    "libx264",
                    "-c:a",
                    "aac",
                    "-pix_fmt",
                    "yuv420p",
                    video_path,
                ])
                .status();
        }

        // 2. Generate English SRT subtitle file if not present
        if !Path::new(srt_en).exists() {
            let content_en = "1\n00:00:00,100 --> 00:00:01,800\nEnglish Test Subtitle\n\n";
            let _ = fs::write(srt_en, content_en);
        }

        // 3. Generate Hindi SRT subtitle file if not present
        if !Path::new(srt_hi).exists() {
            let content_hi = "1\n00:00:00,100 --> 00:00:01,800\nHindi Test Subtitle\n\n";
            let _ = fs::write(srt_hi, content_hi);
        }
    });
}

#[test]
fn test_ffmpeg_environment_and_mux_flow() {
    ensure_test_media();

    let env = check_environment();
    assert!(env.ffmpeg_available, "ffmpeg should be available");
    assert!(env.ffprobe_available, "ffprobe should be available");

    // Probe the test video
    let video_info = probe_video("/tmp/submux_test_video.mp4").expect("Probing test video failed");
    assert_eq!(video_info.video_streams_count, 1);
    assert_eq!(video_info.audio_streams_count, 1);
    assert!(video_info.duration_secs > 1.8);

    // Build mux command for MP4 with 2 subtitle tracks
    let req = MuxRequest {
        video_path: "/tmp/submux_test_video.mp4".to_string(),
        subtitle_tracks: vec![
            SubtitleTrackConfig {
                path: "/tmp/submux_test_en.srt".to_string(),
                language: "eng".to_string(),
                title: "English SDH".to_string(),
                is_default: true,
                time_offset_secs: None,
            },
            SubtitleTrackConfig {
                path: "/tmp/submux_test_hi.srt".to_string(),
                language: "hin".to_string(),
                title: "Hindi Native".to_string(),
                is_default: false,
                time_offset_secs: None,
            },
        ],
        output_path: "/tmp/submux_integrated_out.mp4".to_string(),
        output_format: Some("mp4".to_string()),
        existing_subtitles_count: 0,
    };

    let args = build_mux_command(&req);
    let ffmpeg_path = env.ffmpeg_path.unwrap();
    let status = Command::new(&ffmpeg_path)
        .args(&args)
        .status()
        .expect("Failed to execute ffmpeg mux command");

    assert!(
        status.success(),
        "FFmpeg mux command exited with non-zero code"
    );

    // Probe output to verify streams and metadata
    let out_info = probe_video("/tmp/submux_integrated_out.mp4").expect("Probing output failed");
    assert_eq!(out_info.video_streams_count, 1);
    assert_eq!(out_info.audio_streams_count, 1);
    assert_eq!(out_info.subtitle_streams_count, 2);

    // Check subtitle track 0 (English)
    let sub0 = out_info
        .streams
        .iter()
        .find(|s| s.codec_type == "subtitle" && s.index == 2);
    assert!(sub0.is_some());
    assert_eq!(sub0.unwrap().language.as_deref(), Some("eng"));
    assert_eq!(sub0.unwrap().title.as_deref(), Some("English SDH"));

    // Check subtitle track 1 (Hindi)
    let sub1 = out_info
        .streams
        .iter()
        .find(|s| s.codec_type == "subtitle" && s.index == 3);
    assert!(sub1.is_some());
    assert_eq!(sub1.unwrap().language.as_deref(), Some("hin"));
    assert_eq!(sub1.unwrap().title.as_deref(), Some("Hindi Native"));
}

#[test]
fn test_subtitle_burn_flow() {
    ensure_test_media();

    let ffmpeg_bin = find_binary("ffmpeg")
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "ffmpeg".to_string());

    let burn_req = BurnRequest {
        video_path: "/tmp/submux_test_video.mp4".to_string(),
        subtitle_path: "/tmp/submux_test_en.srt".to_string(),
        output_path: "/tmp/submux_burned_test.mp4".to_string(),
        output_format: Some("mp4".to_string()),
        encoder: Some("libx264".to_string()),
        font_size: Some(24),
        font_color: Some("yellow".to_string()),
        has_box: Some(false),
        quality_preset: Some("fast".to_string()),
    };

    let burn_args = build_burn_command(&burn_req);

    // Check if the current environment's FFmpeg was built with 'subtitles' filter (libass)
    let filters_output = Command::new(&ffmpeg_bin).arg("-filters").output();

    if let Ok(out) = filters_output {
        let stdout_str = String::from_utf8_lossy(&out.stdout);
        if !stdout_str.contains("subtitles") {
            println!(
                "Note: Installed FFmpeg does not include 'subtitles' filter (libass). Skipping burn execution."
            );
            return;
        }
    }

    let burn_status = Command::new(&ffmpeg_bin)
        .args(&burn_args)
        .status()
        .expect("Failed to execute burn command");
    assert!(burn_status.success(), "Burn ffmpeg failed");
    assert!(Path::new("/tmp/submux_burned_test.mp4").exists());
}

#[test]
fn test_mkv_mux_flow() {
    ensure_test_media();

    let env = check_environment();
    let req = MuxRequest {
        video_path: "/tmp/submux_test_video.mp4".to_string(),
        subtitle_tracks: vec![SubtitleTrackConfig {
            path: "/tmp/submux_test_en.srt".to_string(),
            language: "eng".to_string(),
            title: "English Commentary".to_string(),
            is_default: true,
            time_offset_secs: None,
        }],
        output_path: "/tmp/submux_integrated_out.mkv".to_string(),
        output_format: Some("mkv".to_string()),
        existing_subtitles_count: 0,
    };

    let args = build_mux_command(&req);
    let ffmpeg_path = env.ffmpeg_path.unwrap();
    let status = Command::new(&ffmpeg_path)
        .args(&args)
        .status()
        .expect("Failed to execute ffmpeg mux command");

    assert!(status.success());
    let out_info =
        probe_video("/tmp/submux_integrated_out.mkv").expect("Probing MKV output failed");
    assert_eq!(out_info.subtitle_streams_count, 1);
}
