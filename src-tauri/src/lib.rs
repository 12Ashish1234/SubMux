pub mod burner;
pub mod ffmpeg;
pub mod muxer;

use burner::{build_burn_command, BurnRequest};
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
fn mux_subtitles(app: AppHandle, request: MuxRequest) -> Result<MuxResult, String> {
    run_mux(&app, &request)
}

#[tauri::command]
fn burn_subtitles(app: AppHandle, request: BurnRequest) -> Result<MuxResult, String> {
    run_burn(&app, &request)
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
            cancel_mux,
            start_window_drag
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
