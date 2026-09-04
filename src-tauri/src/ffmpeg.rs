use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

use crate::burner::{build_burn_command, BurnRequest};
use crate::muxer::{build_mux_command, parse_time_str, MuxProgressPayload, MuxRequest, MuxResult};

#[derive(Default)]
pub struct ActiveMuxState {
    pub current_pid: Arc<Mutex<Option<u32>>>,
    pub is_cancelled: Arc<AtomicBool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentStatus {
    pub ffmpeg_available: bool,
    pub ffprobe_available: bool,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub ffmpeg_version: Option<String>,
    pub ffprobe_version: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamInfo {
    pub index: usize,
    pub codec_type: String, // "video", "audio", "subtitle"
    pub codec_name: Option<String>,
    pub language: Option<String>,
    pub title: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub path: String,
    pub filename: String,
    pub format_name: String,
    pub duration_secs: f64,
    pub size_bytes: u64,
    pub streams: Vec<StreamInfo>,
    pub video_streams_count: usize,
    pub audio_streams_count: usize,
    pub subtitle_streams_count: usize,
}

/// Find full path of a binary on macOS, checking bundled sidecars, Homebrew, and PATH
pub fn find_binary(binary_name: &str) -> Option<PathBuf> {
    // 0. Check App bundle executable folder (SubMux.app/Contents/MacOS/...) and Resources
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let direct_bundle = exe_dir.join(binary_name);
            if direct_bundle.exists() && direct_bundle.is_file() {
                return Some(direct_bundle);
            }
            let resource_binary = exe_dir.join("../Resources").join(binary_name);
            if resource_binary.exists() && resource_binary.is_file() {
                return Some(resource_binary);
            }
        }
    }

    // 1. Check user Application Support directory (~/Library/Application Support/SubMux/bin/...)
    let home = std::env::var("HOME").unwrap_or_default();
    let app_support_paths = [
        format!(
            "{}/Library/Application Support/SubMux/bin/{}",
            home, binary_name
        ),
        format!(
            "{}/Library/Application Support/com.submux.desktop/bin/{}",
            home, binary_name
        ),
    ];
    for path_str in &app_support_paths {
        let p = PathBuf::from(path_str);
        if p.exists() && p.is_file() {
            return Some(p);
        }
    }

    // 2. Check standard known paths on macOS (Homebrew, Cargo, Local)
    let known_paths = [
        format!("/opt/homebrew/bin/{}", binary_name),
        format!("/usr/local/bin/{}", binary_name),
        format!("{}/.cargo/bin/{}", home, binary_name),
        format!("{}/bin/{}", home, binary_name),
        format!("/usr/bin/{}", binary_name),
    ];

    for path_str in &known_paths {
        let p = PathBuf::from(path_str);
        if p.exists() && p.is_file() {
            return Some(p);
        }
    }

    // 2. Check PATH environment variable
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(binary_name);
            if candidate.exists() && candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

/// Startup check for both ffmpeg and ffprobe
pub fn check_environment() -> EnvironmentStatus {
    let ffmpeg_path = find_binary("ffmpeg");
    let ffprobe_path = find_binary("ffprobe");

    let mut ffmpeg_version = None;
    let mut ffprobe_version = None;
    let mut error_parts: Vec<String> = Vec::new();

    if let Some(ref path) = ffmpeg_path {
        match Command::new(path).arg("-version").output() {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let first_line = stdout.lines().next().unwrap_or("").trim().to_string();
                ffmpeg_version = Some(first_line);
            }
            Ok(_) => {
                error_parts.push("ffmpeg binary was found but exited with an error.".to_string());
            }
            Err(e) => {
                error_parts.push(format!("Failed to execute ffmpeg: {}", e));
            }
        }
    } else {
        error_parts.push("ffmpeg binary not found in standard macOS paths or PATH.".to_string());
    }

    if let Some(ref path) = ffprobe_path {
        match Command::new(path).arg("-version").output() {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let first_line = stdout.lines().next().unwrap_or("").trim().to_string();
                ffprobe_version = Some(first_line);
            }
            Ok(_) => {
                error_parts.push("ffprobe binary was found but exited with an error.".to_string());
            }
            Err(e) => {
                error_parts.push(format!("Failed to execute ffprobe: {}", e));
            }
        }
    } else {
        error_parts.push("ffprobe binary not found in standard macOS paths or PATH.".to_string());
    }

    let is_ok = ffmpeg_version.is_some() && ffprobe_version.is_some();
    let error_message = if is_ok {
        None
    } else {
        Some(format!(
            "{}\n\nPlease install ffmpeg via Homebrew:\n    brew install ffmpeg",
            error_parts.join("\n")
        ))
    };

    EnvironmentStatus {
        ffmpeg_available: ffmpeg_version.is_some(),
        ffprobe_available: ffprobe_version.is_some(),
        ffmpeg_path: ffmpeg_path.map(|p| p.to_string_lossy().to_string()),
        ffprobe_path: ffprobe_path.map(|p| p.to_string_lossy().to_string()),
        ffmpeg_version,
        ffprobe_version,
        error_message,
    }
}

/// Uses ffprobe to inspect video container format, duration, and streams
pub fn probe_video(video_path: &str) -> Result<VideoInfo, String> {
    let ffprobe_path = find_binary("ffprobe").ok_or_else(|| {
        "ffprobe binary not found. Please install ffmpeg via Homebrew: brew install ffmpeg"
            .to_string()
    })?;

    let path_obj = Path::new(video_path);
    if !path_obj.exists() {
        return Err(format!("Video file does not exist: {}", video_path));
    }

    let filename = path_obj
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| video_path.to_string());

    let output = Command::new(ffprobe_path)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            video_path,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe error: {}", stderr));
    }

    let json_val: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse ffprobe json output: {}", e))?;

    let format_obj = json_val.get("format");
    let duration_secs = format_obj
        .and_then(|f| f.get("duration"))
        .and_then(|d| d.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let size_bytes = format_obj
        .and_then(|f| f.get("size"))
        .and_then(|s| s.as_str())
        .and_then(|s| s.parse::<u64>().ok())
        .or_else(|| fs::metadata(video_path).ok().map(|m| m.len()))
        .unwrap_or(0);

    let format_name = format_obj
        .and_then(|f| f.get("format_name"))
        .and_then(|n| n.as_str())
        .unwrap_or("unknown")
        .to_string();

    let mut streams = Vec::new();
    let mut video_count = 0;
    let mut audio_count = 0;
    let mut subtitle_count = 0;

    if let Some(streams_arr) = json_val.get("streams").and_then(|s| s.as_array()) {
        for stream in streams_arr {
            let index = stream.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as usize;
            let codec_type = stream
                .get("codec_type")
                .and_then(|t| t.as_str())
                .unwrap_or("unknown")
                .to_string();

            let codec_name = stream
                .get("codec_name")
                .and_then(|c| c.as_str())
                .map(|s| s.to_string());

            let tags = stream.get("tags");
            let language = tags
                .and_then(|t| t.get("language"))
                .and_then(|l| l.as_str())
                .map(|s| s.to_string());
            let title = tags
                .and_then(|t| t.get("title").or_else(|| t.get("name")))
                .and_then(|t| t.as_str())
                .map(|s| s.to_string());

            let width = stream
                .get("width")
                .and_then(|w| w.as_u64())
                .map(|w| w as u32);
            let height = stream
                .get("height")
                .and_then(|h| h.as_u64())
                .map(|h| h as u32);

            match codec_type.as_str() {
                "video" => video_count += 1,
                "audio" => audio_count += 1,
                "subtitle" => subtitle_count += 1,
                _ => {}
            }

            streams.push(StreamInfo {
                index,
                codec_type,
                codec_name,
                language,
                title,
                width,
                height,
            });
        }
    }

    Ok(VideoInfo {
        path: video_path.to_string(),
        filename,
        format_name,
        duration_secs,
        size_bytes,
        streams,
        video_streams_count: video_count,
        audio_streams_count: audio_count,
        subtitle_streams_count: subtitle_count,
    })
}

/// Terminates any actively running muxing process
pub fn cancel_mux_process(state: &ActiveMuxState) {
    state.is_cancelled.store(true, Ordering::SeqCst);
    let mut pid_guard = state.current_pid.lock().unwrap();
    if let Some(pid) = *pid_guard {
        // Send kill command to child PID on macOS
        let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
        *pid_guard = None;
    }
}

/// Runs ffmpeg with progress parsing, cancellation support, and real-time event emission
pub fn run_mux(app_handle: &AppHandle, request: &MuxRequest) -> Result<MuxResult, String> {
    let ffmpeg_path = find_binary("ffmpeg").ok_or_else(|| {
        "ffmpeg binary not found. Please install ffmpeg via Homebrew: brew install ffmpeg"
            .to_string()
    })?;

    // Probe duration for percentage calculation
    let total_duration_secs = match probe_video(&request.video_path) {
        Ok(info) => info.duration_secs,
        Err(_) => 0.0,
    };

    let base_args = build_mux_command(request);

    // Prepare arguments with progress pipe
    // We insert `-progress pipe:1 -nostats` right after `-y`
    let mut cmd_args = vec![
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        "-nostats".to_string(),
    ];

    // Append remaining arguments (skipping the initial `-y` in base_args)
    for arg in base_args.iter().skip(1) {
        cmd_args.push(arg.clone());
    }

    let mut child = Command::new(&ffmpeg_path)
        .args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let child_pid = child.id();
    let state = app_handle.state::<ActiveMuxState>();
    state.is_cancelled.store(false, Ordering::SeqCst);
    {
        let mut pid_guard = state.current_pid.lock().unwrap();
        *pid_guard = Some(child_pid);
    }

    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture ffmpeg stdout")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("Failed to capture ffmpeg stderr")?;

    let is_running = Arc::new(AtomicBool::new(true));
    let is_running_clone = is_running.clone();

    // Read stderr in a separate thread to prevent pipe deadlocks and collect error output
    let stderr_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let mut full_stderr = String::new();
        for line in reader.lines() {
            if let Ok(l) = line {
                full_stderr.push_str(&l);
                full_stderr.push('\n');
            }
            if !is_running_clone.load(Ordering::Relaxed) {
                break;
            }
        }
        full_stderr
    });

    // Read progress lines from stdout
    let stdout_reader = BufReader::new(stdout);
    let mut current_speed: Option<String> = None;
    let mut current_frame: Option<u64> = None;

    for line in stdout_reader.lines() {
        let line_str = match line {
            Ok(l) => l,
            Err(_) => break,
        };

        let trimmed = line_str.trim();
        if let Some((k, v)) = trimmed.split_once('=') {
            match k {
                "frame" => {
                    if let Ok(f) = v.parse::<u64>() {
                        current_frame = Some(f);
                    }
                }
                "speed" => {
                    current_speed = Some(v.to_string());
                }
                "out_time" => {
                    if let Some(out_secs) = parse_time_str(v) {
                        let percentage = if total_duration_secs > 0.0 {
                            ((out_secs / total_duration_secs) * 100.0).clamp(0.0, 99.9)
                        } else {
                            0.0
                        };

                        let _ = app_handle.emit(
                            "mux-progress",
                            MuxProgressPayload {
                                percentage,
                                out_time_secs: out_secs,
                                total_duration_secs,
                                speed: current_speed.clone(),
                                frame: current_frame,
                            },
                        );
                    }
                }
                // Fallback for out_time_us / out_time_ms (both in microseconds in FFmpeg)
                "out_time_us" | "out_time_ms" => {
                    if let Ok(us) = v.parse::<f64>() {
                        let out_secs = us / 1_000_000.0;
                        let percentage = if total_duration_secs > 0.0 {
                            ((out_secs / total_duration_secs) * 100.0).clamp(0.0, 99.9)
                        } else {
                            0.0
                        };

                        let _ = app_handle.emit(
                            "mux-progress",
                            MuxProgressPayload {
                                percentage,
                                out_time_secs: out_secs,
                                total_duration_secs,
                                speed: current_speed.clone(),
                                frame: current_frame,
                            },
                        );
                    }
                }
                "progress" if v == "end" => {
                    let _ = app_handle.emit(
                        "mux-progress",
                        MuxProgressPayload {
                            percentage: 100.0,
                            out_time_secs: total_duration_secs,
                            total_duration_secs,
                            speed: current_speed.clone(),
                            frame: current_frame,
                        },
                    );
                }
                _ => {}
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed waiting for ffmpeg: {}", e))?;
    is_running.store(false, Ordering::Relaxed);

    // Clear PID
    {
        let mut pid_guard = state.current_pid.lock().unwrap();
        *pid_guard = None;
    }

    let captured_stderr = stderr_handle.join().unwrap_or_default();

    if state.is_cancelled.load(Ordering::SeqCst) {
        // Clean up partial output file on cancel
        let _ = fs::remove_file(&request.output_path);
        return Err("Muxing was cancelled by user.".to_string());
    }

    if !status.success() {
        return Err(format!(
            "ffmpeg exited with status code {}:\n\n{}",
            status.code().unwrap_or(-1),
            captured_stderr
        ));
    }

    // Check resulting output file size
    let output_size_bytes = fs::metadata(&request.output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // Final completion event
    let _ = app_handle.emit(
        "mux-progress",
        MuxProgressPayload {
            percentage: 100.0,
            out_time_secs: total_duration_secs,
            total_duration_secs,
            speed: current_speed,
            frame: current_frame,
        },
    );

    Ok(MuxResult {
        output_path: request.output_path.clone(),
        output_size_bytes,
    })
}

/// Runs ffmpeg burn-in with real-time progress parsing and cancellation
pub fn run_burn(app_handle: &AppHandle, request: &BurnRequest) -> Result<MuxResult, String> {
    let ffmpeg_path = find_binary("ffmpeg").ok_or_else(|| {
        "ffmpeg binary not found. Please install ffmpeg via Homebrew: brew install ffmpeg"
            .to_string()
    })?;

    // Probe duration for percentage calculation
    let total_duration_secs = match probe_video(&request.video_path) {
        Ok(info) => info.duration_secs,
        Err(_) => 0.0,
    };

    let base_args = build_burn_command(request);

    // Prepare arguments with progress pipe
    let mut cmd_args = vec![
        "-y".to_string(),
        "-progress".to_string(),
        "pipe:1".to_string(),
        "-nostats".to_string(),
    ];

    for arg in base_args.iter().skip(1) {
        cmd_args.push(arg.clone());
    }

    let mut child = Command::new(&ffmpeg_path)
        .args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let child_pid = child.id();
    let state = app_handle.state::<ActiveMuxState>();
    state.is_cancelled.store(false, Ordering::SeqCst);
    {
        let mut pid_guard = state.current_pid.lock().unwrap();
        *pid_guard = Some(child_pid);
    }

    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to capture ffmpeg stdout")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("Failed to capture ffmpeg stderr")?;

    let is_running = Arc::new(AtomicBool::new(true));
    let is_running_clone = is_running.clone();

    let stderr_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let mut full_stderr = String::new();
        for line in reader.lines() {
            if let Ok(l) = line {
                full_stderr.push_str(&l);
                full_stderr.push('\n');
            }
            if !is_running_clone.load(Ordering::Relaxed) {
                break;
            }
        }
        full_stderr
    });

    let stdout_reader = BufReader::new(stdout);
    let mut current_speed: Option<String> = None;
    let mut current_frame: Option<u64> = None;

    for line in stdout_reader.lines() {
        let line_str = match line {
            Ok(l) => l,
            Err(_) => break,
        };

        let trimmed = line_str.trim();
        if let Some((k, v)) = trimmed.split_once('=') {
            match k {
                "frame" => {
                    if let Ok(f) = v.parse::<u64>() {
                        current_frame = Some(f);
                    }
                }
                "speed" => {
                    current_speed = Some(v.to_string());
                }
                "out_time" => {
                    if let Some(out_secs) = parse_time_str(v) {
                        let percentage = if total_duration_secs > 0.0 {
                            ((out_secs / total_duration_secs) * 100.0).clamp(0.0, 99.9)
                        } else {
                            0.0
                        };

                        let _ = app_handle.emit(
                            "mux-progress",
                            MuxProgressPayload {
                                percentage,
                                out_time_secs: out_secs,
                                total_duration_secs,
                                speed: current_speed.clone(),
                                frame: current_frame,
                            },
                        );
                    }
                }
                "out_time_us" | "out_time_ms" => {
                    if let Ok(us) = v.parse::<f64>() {
                        let out_secs = us / 1_000_000.0;
                        let percentage = if total_duration_secs > 0.0 {
                            ((out_secs / total_duration_secs) * 100.0).clamp(0.0, 99.9)
                        } else {
                            0.0
                        };

                        let _ = app_handle.emit(
                            "mux-progress",
                            MuxProgressPayload {
                                percentage,
                                out_time_secs: out_secs,
                                total_duration_secs,
                                speed: current_speed.clone(),
                                frame: current_frame,
                            },
                        );
                    }
                }
                "progress" if v == "end" => {
                    let _ = app_handle.emit(
                        "mux-progress",
                        MuxProgressPayload {
                            percentage: 100.0,
                            out_time_secs: total_duration_secs,
                            total_duration_secs,
                            speed: current_speed.clone(),
                            frame: current_frame,
                        },
                    );
                }
                _ => {}
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed waiting for ffmpeg: {}", e))?;
    is_running.store(false, Ordering::Relaxed);

    {
        let mut pid_guard = state.current_pid.lock().unwrap();
        *pid_guard = None;
    }

    let captured_stderr = stderr_handle.join().unwrap_or_default();

    if state.is_cancelled.load(Ordering::SeqCst) {
        let _ = fs::remove_file(&request.output_path);
        return Err("Subtitle burn-in was cancelled by user.".to_string());
    }

    if !status.success() {
        return Err(format!(
            "ffmpeg burn-in failed with status code {}:\n\n{}",
            status.code().unwrap_or(-1),
            captured_stderr
        ));
    }

    let output_size_bytes = fs::metadata(&request.output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let _ = app_handle.emit(
        "mux-progress",
        MuxProgressPayload {
            percentage: 100.0,
            out_time_secs: total_duration_secs,
            total_duration_secs,
            speed: current_speed,
            frame: current_frame,
        },
    );

    Ok(MuxResult {
        output_path: request.output_path.clone(),
        output_size_bytes,
    })
}
