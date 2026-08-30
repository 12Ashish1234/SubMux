pub mod batch;
pub mod burner;
pub mod extractor;
pub mod ffmpeg;
pub mod muxer;

use batch::{match_videos_and_subtitles, BatchItem};
use burner::{build_burn_command, BurnRequest};
use extractor::extract_subtitle_track;
use ffmpeg::{
    cancel_mux_process, check_environment, probe_video, run_burn, run_mux, ActiveMuxState,
    EnvironmentStatus, VideoInfo,
};
use muxer::{build_mux_command, MuxRequest, MuxResult};
use tauri::{AppHandle, State};

#[tauri::command]
fn check_ffmpeg_env() -> EnvironmentStatus {
    check_environment()
}

#[tauri::command]
fn probe_video_file(video_path: String) -> Result<VideoInfo, String> {
    probe_video(&video_path)
}

#[tauri::command]
fn preview_command(request: MuxRequest) -> Vec<String> {
    let mut cmd = vec!["ffmpeg".to_string()];
    cmd.extend(build_mux_command(&request));
    cmd
}

#[tauri::command]
fn preview_burn_command(request: BurnRequest) -> Vec<String> {
    let mut cmd = vec!["ffmpeg".to_string()];
    cmd.extend(build_burn_command(&request));
    cmd
}

#[tauri::command]
async fn mux_subtitles(app: AppHandle, request: MuxRequest) -> Result<MuxResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_mux(&app, &request))
        .await
        .map_err(|e| format!("Async task execution failed: {}", e))?
}

#[tauri::command]
async fn burn_subtitles(app: AppHandle, request: BurnRequest) -> Result<MuxResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_burn(&app, &request))
        .await
        .map_err(|e| format!("Async task execution failed: {}", e))?
}

#[tauri::command]
async fn extract_subtitle(
    video_path: String,
    stream_index: usize,
    output_path: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        extract_subtitle_track(&video_path, stream_index, &output_path)
    })
    .await
    .map_err(|e| format!("Async task execution failed: {}", e))?
}

#[tauri::command]
fn match_batch_files(
    video_paths: Vec<String>,
    subtitle_paths: Vec<String>,
    default_format: String,
) -> Vec<BatchItem> {
    match_videos_and_subtitles(&video_paths, &subtitle_paths, &default_format)
}

#[tauri::command]
fn cancel_mux(state: State<ActiveMuxState>) {
    cancel_mux_process(&state);
}

#[tauri::command]
fn start_window_drag(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ActiveMuxState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg_env,
            probe_video_file,
            preview_command,
            preview_burn_command,
            mux_subtitles,
            burn_subtitles,
            extract_subtitle,
            match_batch_files,
            cancel_mux,
            start_window_drag
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
