# SubMux 🎬

SubMux is a fast, lossless macOS desktop application built with **Tauri v2 + React + TypeScript + Tailwind CSS** that attaches subtitle tracks (`.srt`, `.vtt`, `.ass`) to video files (`.mp4`, `.mkv`, `.mov`, `.m4v`) without re-encoding video or audio streams.

---

## ✨ Features

- ⚡ **Lossless Stream Copy**: Uses `-c copy` so muxing completes in seconds with zero degradation in video or audio quality.
- 🎯 **Toggleable Subtitle Tracks**: Embedded tracks stay fully selectable and switchable in QuickTime, Apple TV, VLC, IINA, and web players.
- 🌐 **Track Configuration**: Customize language code (e.g. `eng`, `hin`, `spa`), track label (e.g. `Director Commentary`, `English [SDH]`), and set the default track.
- 📦 **Multi-Container Support**:
  - **MP4 / M4V / MOV**: Automatically converted to standard `mov_text` (tx3g) timed text for full Apple Silicon & iOS compatibility.
  - **MKV**: Losslessly packaged with native SubRip (SRT) format.
- 📊 **Real-time Determinate Progress**: Parses FFmpeg progress stdout in real-time (`-progress pipe:1`) against probed duration for a precise 0–100% progress bar.
- 🔍 **macOS GUI Path Resolver**: Automatically resolves FFmpeg and FFprobe binary locations (`/opt/homebrew/bin`, `/usr/local/bin`, etc.) even when launched from Finder or Dock.
- 🚨 **Transparent Error Handling**: Live FFmpeg command preview and full stderr capture with copy-to-clipboard on errors.

---

## 🛠️ Development & Building

### Prerequisites

1. **Node.js & npm** (v18+)
2. **Rust & Cargo** (v1.75+)
3. **FFmpeg & FFprobe**:
   ```bash
   brew install ffmpeg
   ```

### Run in Development

```bash
# Install dependencies
npm install

# Start Tauri desktop app in dev mode
npm run tauri dev
```

### Build for Production (macOS Application)

```bash
npm run tauri build
```
The resulting `.app` and `.dmg` bundles will be located in `src-tauri/target/release/bundle/`.

---

## 🧪 Testing

Run backend unit tests and end-to-end FFmpeg integration tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```
