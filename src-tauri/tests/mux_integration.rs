use submux_lib::burner::{build_burn_command, BurnRequest};
use submux_lib::ffmpeg::{check_environment, probe_video};
use submux_lib::muxer::{build_mux_command, MuxRequest, SubtitleTrackConfig};
use std::process::Command;

#[test]
fn test_ffmpeg_environment_and_mux_flow() {
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

    assert!(status.success(), "FFmpeg mux command exited with non-zero code");

    // Probe output to verify streams and metadata
    let out_info = probe_video("/tmp/submux_integrated_out.mp4").expect("Probing output failed");
    assert_eq!(out_info.video_streams_count, 1);
    assert_eq!(out_info.audio_streams_count, 1);
    assert_eq!(out_info.subtitle_streams_count, 2);

    // Check subtitle track 0 (English)
    let sub0 = out_info.streams.iter().find(|s| s.codec_type == "subtitle" && s.index == 2);
    assert!(sub0.is_some());
    assert_eq!(sub0.unwrap().language.as_deref(), Some("eng"));
    assert_eq!(sub0.unwrap().title.as_deref(), Some("English SDH"));

    // Check subtitle track 1 (Hindi)
    let sub1 = out_info.streams.iter().find(|s| s.codec_type == "subtitle" && s.index == 3);
    assert!(sub1.is_some());
    assert_eq!(sub1.unwrap().language.as_deref(), Some("hin"));
    assert_eq!(sub1.unwrap().title.as_deref(), Some("Hindi Native"));
}

#[test]
fn test_subtitle_burn_flow() {
    let burn_req = BurnRequest {
        video_path: "/tmp/submux_test_video.mp4".to_string(),
        subtitle_path: "/tmp/submux_test_en.srt".to_string(),
        output_path: "/tmp/submux_burned_test.mp4".to_string(),
        output_format: Some("mp4".to_string()),
        encoder: Some("h264_videotoolbox".to_string()),
        font_size: Some(24),
        font_color: Some("yellow".to_string()),
        has_box: Some(false),
        quality_preset: Some("fast".to_string()),
    };

    let burn_args = build_burn_command(&burn_req);
    let burn_status = Command::new("ffmpeg")
        .args(&burn_args)
        .status()
        .expect("Failed to execute burn command");
    assert!(burn_status.success(), "Burn ffmpeg failed");
    assert!(std::path::Path::new("/tmp/submux_burned_test.mp4").exists());
}

#[test]
fn test_mkv_mux_flow() {
    let env = check_environment();
    let req = MuxRequest {
        video_path: "/tmp/submux_test_video.mp4".to_string(),
        subtitle_tracks: vec![
            SubtitleTrackConfig {
                path: "/tmp/submux_test_en.srt".to_string(),
                language: "eng".to_string(),
                title: "English Commentary".to_string(),
                is_default: true,
                time_offset_secs: None,
            },
        ],
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
    let out_info = probe_video("/tmp/submux_integrated_out.mkv").expect("Probing MKV output failed");
    assert_eq!(out_info.subtitle_streams_count, 1);
}
