use serde::{Deserialize, Serialize};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Emitter};

use crate::ffmpeg::{check_environment, EnvironmentStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub stage: String, // "init" | "ffmpeg" | "ffprobe" | "extract" | "permissions" | "done"
    pub percentage: u32,
    pub message: String,
}

pub fn download_and_install_ffmpeg(app: &AppHandle) -> Result<EnvironmentStatus, String> {
    let home = std::env::var("HOME").map_err(|_| "Could not find HOME directory".to_string())?;
    let bin_dir = PathBuf::from(&home).join("Library/Application Support/SubMux/bin");

    fs::create_dir_all(&bin_dir)
        .map_err(|e| format!("Failed to create bin directory at {:?}: {}", bin_dir, e))?;

    let temp_dir = std::env::temp_dir().join("submux_ffmpeg_setup");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp download directory: {}", e))?;

    let ffmpeg_zip = temp_dir.join("ffmpeg.zip");
    let ffprobe_zip = temp_dir.join("ffprobe.zip");

    // 1. Download FFmpeg
    let _ = app.emit(
        "ffmpeg-download-progress",
        DownloadProgressPayload {
            stage: "ffmpeg".to_string(),
            percentage: 15,
            message: "Downloading FFmpeg engine from official mirror...".to_string(),
        },
    );

    let curl_ffmpeg = Command::new("/usr/bin/curl")
        .args([
            "-L",
            "-f",
            "-s",
            "--connect-timeout",
            "15",
            "--retry",
            "2",
            "-o",
            ffmpeg_zip.to_str().unwrap(),
            "https://evermeet.cx/ffmpeg/getrelease/zip",
        ])
        .output()
        .map_err(|e| format!("Failed to execute curl for ffmpeg: {}", e))?;

    if !curl_ffmpeg.status.success() {
        return Err(format!(
            "Failed to download FFmpeg: {}",
            String::from_utf8_lossy(&curl_ffmpeg.stderr)
        ));
    }

    // 2. Download FFprobe
    let _ = app.emit(
        "ffmpeg-download-progress",
        DownloadProgressPayload {
            stage: "ffprobe".to_string(),
            percentage: 55,
            message: "Downloading FFprobe utility...".to_string(),
        },
    );

    let curl_ffprobe = Command::new("/usr/bin/curl")
        .args([
            "-L",
            "-f",
            "-s",
            "--connect-timeout",
            "15",
            "--retry",
            "2",
            "-o",
            ffprobe_zip.to_str().unwrap(),
            "https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip",
        ])
        .output()
        .map_err(|e| format!("Failed to execute curl for ffprobe: {}", e))?;

    if !curl_ffprobe.status.success() {
        return Err(format!(
            "Failed to download FFprobe: {}",
            String::from_utf8_lossy(&curl_ffprobe.stderr)
        ));
    }

    // 3. Extract archives into bin directory
    let _ = app.emit(
        "ffmpeg-download-progress",
        DownloadProgressPayload {
            stage: "extract".to_string(),
            percentage: 80,
            message: "Extracting binaries into SubMux application folder...".to_string(),
        },
    );

    let unzip_ffmpeg = Command::new("/usr/bin/unzip")
        .args([
            "-o",
            "-q",
            ffmpeg_zip.to_str().unwrap(),
            "-d",
            bin_dir.to_str().unwrap(),
        ])
        .output()
        .map_err(|e| format!("Failed to extract ffmpeg.zip: {}", e))?;

    if !unzip_ffmpeg.status.success() {
        return Err(format!(
            "Failed to extract ffmpeg archive: {}",
            String::from_utf8_lossy(&unzip_ffmpeg.stderr)
        ));
    }

    let unzip_ffprobe = Command::new("/usr/bin/unzip")
        .args([
            "-o",
            "-q",
            ffprobe_zip.to_str().unwrap(),
            "-d",
            bin_dir.to_str().unwrap(),
        ])
        .output()
        .map_err(|e| format!("Failed to extract ffprobe.zip: {}", e))?;

    if !unzip_ffprobe.status.success() {
        return Err(format!(
            "Failed to extract ffprobe archive: {}",
            String::from_utf8_lossy(&unzip_ffprobe.stderr)
        ));
    }

    // 4. Set executable permissions and clear macOS Gatekeeper quarantine
    let _ = app.emit(
        "ffmpeg-download-progress",
        DownloadProgressPayload {
            stage: "permissions".to_string(),
            percentage: 95,
            message: "Setting permissions and verifying installation...".to_string(),
        },
    );

    let ffmpeg_dest = bin_dir.join("ffmpeg");
    let ffprobe_dest = bin_dir.join("ffprobe");

    if ffmpeg_dest.exists() {
        let _ = fs::set_permissions(&ffmpeg_dest, fs::Permissions::from_mode(0o755));
        let _ = Command::new("/usr/bin/xattr")
            .args(["-d", "com.apple.quarantine", ffmpeg_dest.to_str().unwrap()])
            .output();
    }

    if ffprobe_dest.exists() {
        let _ = fs::set_permissions(&ffprobe_dest, fs::Permissions::from_mode(0o755));
        let _ = Command::new("/usr/bin/xattr")
            .args(["-d", "com.apple.quarantine", ffprobe_dest.to_str().unwrap()])
            .output();
    }

    // Cleanup temp zip files
    let _ = fs::remove_dir_all(&temp_dir);

    // 5. Final environment check
    let final_status = check_environment();

    let _ = app.emit(
        "ffmpeg-download-progress",
        DownloadProgressPayload {
            stage: "done".to_string(),
            percentage: 100,
            message: "FFmpeg engine successfully installed!".to_string(),
        },
    );

    Ok(final_status)
}
