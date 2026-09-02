use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SanitizeResult {
    pub sanitized_path: String,
    pub original_format: String,   // "srt" | "vtt" | "ass" | "unknown"
    pub detected_encoding: String, // "UTF-8" | "UTF-8-BOM" | "UTF-16LE" | "UTF-16BE" | "Windows-1252"
    pub was_converted: bool,
    pub cues_count: usize,
}

/// Detects encoding from byte buffer and converts to clean UTF-8 string
pub fn decode_bytes_to_utf8(bytes: &[u8]) -> (String, String) {
    // 1. UTF-8 BOM: EF BB BF
    if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        if let Ok(s) = std::str::from_utf8(&bytes[3..]) {
            return (s.to_string(), "UTF-8-BOM".to_string());
        }
    }

    // 2. UTF-16 LE BOM: FF FE
    if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        let u16_slice: Vec<u16> = bytes[2..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|&[b0, b1]| u16::from_le_bytes([b0, b1]))
            .collect();
        if let Ok(s) = String::from_utf16(&u16_slice) {
            return (s, "UTF-16LE".to_string());
        }
    }

    // 3. UTF-16 BE BOM: FE FF
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let u16_slice: Vec<u16> = bytes[2..]
            .as_chunks::<2>()
            .0
            .iter()
            .map(|&[b0, b1]| u16::from_be_bytes([b0, b1]))
            .collect();
        if let Ok(s) = String::from_utf16(&u16_slice) {
            return (s, "UTF-16BE".to_string());
        }
    }

    // 4. Standard UTF-8 check
    if let Ok(s) = std::str::from_utf8(bytes) {
        return (s.to_string(), "UTF-8".to_string());
    }

    // 5. Fallback: Windows-1252 / ISO-8859-1 decoding (1 byte -> 1 unicode char)
    let s: String = bytes.iter().map(|&b| b as char).collect();
    (s, "Windows-1252".to_string())
}

/// Normalizes WebVTT time format (e.g. 00:01:23.456 or 01:23.456) to SRT (00:01:23,456)
pub fn vtt_time_to_srt_time(vtt_time: &str) -> String {
    let clean = vtt_time.trim().replace('.', ",");
    let parts: Vec<&str> = clean.split(':').collect();
    if parts.len() == 2 {
        format!("00:{}:{}", parts[0], parts[1])
    } else {
        clean
    }
}

/// Converts WebVTT (.vtt) text content into standard SubRip (.srt) format
pub fn convert_vtt_to_srt(vtt_content: &str) -> (String, usize) {
    let lines: Vec<&str> = vtt_content.lines().collect();
    let mut srt_output = String::new();
    let mut cue_idx: usize = 1;
    let mut i = 0;

    // Skip WebVTT header / metadata lines
    while i < lines.len() {
        let line = lines[i].trim();
        if line.starts_with("WEBVTT")
            || line.starts_with("NOTE")
            || line.starts_with("STYLE")
            || line.starts_with("REGION")
        {
            i += 1;
            while i < lines.len() && !lines[i].trim().is_empty() {
                i += 1;
            }
        } else if line.contains("-->") {
            break;
        } else if i + 1 < lines.len() && lines[i + 1].contains("-->") {
            // Optional cue identifier before time line
            break;
        } else {
            i += 1;
        }
    }

    while i < lines.len() {
        let line = lines[i].trim();
        if line.is_empty() {
            i += 1;
            continue;
        }

        // Check if next line contains the arrow (current line was cue ID)
        if !line.contains("-->") && i + 1 < lines.len() && lines[i + 1].contains("-->") {
            i += 1;
        }

        let time_line = lines[i].trim();
        if time_line.contains("-->") {
            let parts: Vec<&str> = time_line.split("-->").collect();
            if parts.len() == 2 {
                // Strip position / alignment settings like "position:50% line:0"
                let start_part = parts[0].trim();
                let end_part = parts[1]
                    .split_whitespace()
                    .next()
                    .unwrap_or(parts[1].trim());

                let start_srt = vtt_time_to_srt_time(start_part);
                let end_srt = vtt_time_to_srt_time(end_part);

                srt_output.push_str(&format!("{}\n{} --> {}\n", cue_idx, start_srt, end_srt));
                cue_idx += 1;

                i += 1;
                // Collect cue text lines until empty line
                while i < lines.len() && !lines[i].trim().is_empty() {
                    let text = lines[i].trim();
                    // Strip HTML/VTT formatting tags like <v Voice>, <c.color>, <b>, </i>
                    let stripped = strip_vtt_tags(text);
                    if !stripped.is_empty() {
                        srt_output.push_str(&format!("{}\n", stripped));
                    }
                    i += 1;
                }
                srt_output.push('\n');
            } else {
                i += 1;
            }
        } else {
            i += 1;
        }
    }

    (srt_output.trim().to_string(), cue_idx.saturating_sub(1))
}

fn strip_vtt_tags(text: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for c in text.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
        }
    }
    result
}

/// Converts ASS/SSA (.ass/.ssa) text content into standard SubRip (.srt) format
pub fn convert_ass_to_srt(ass_content: &str) -> (String, usize) {
    let mut srt_output = String::new();
    let mut cue_idx: usize = 1;

    for line in ass_content.lines() {
        let trimmed = line.trim();
        if let Some(dialogue_payload) = trimmed.strip_prefix("Dialogue:") {
            let parts: Vec<&str> = dialogue_payload.splitn(10, ',').collect();
            if parts.len() == 10 {
                let start_ass = parts[1].trim(); // e.g. "0:01:23.45"
                let end_ass = parts[2].trim();
                let text_raw = parts[9].trim();

                let start_srt = ass_time_to_srt_time(start_ass);
                let end_srt = ass_time_to_srt_time(end_ass);

                // Strip ASS override tags like {\an8}, {\c&H00FFFF&} and replace \N with \n
                let clean_text = strip_ass_tags(text_raw)
                    .replace("\\N", "\n")
                    .replace("\\n", "\n");

                if !clean_text.trim().is_empty() {
                    srt_output.push_str(&format!(
                        "{}\n{} --> {}\n{}\n\n",
                        cue_idx,
                        start_srt,
                        end_srt,
                        clean_text.trim()
                    ));
                    cue_idx += 1;
                }
            }
        }
    }

    (srt_output.trim().to_string(), cue_idx.saturating_sub(1))
}

fn ass_time_to_srt_time(ass_time: &str) -> String {
    // ASS format: "0:01:23.45" (1 hr digit, 2 ms digits) -> SRT: "00:01:23,450"
    let parts: Vec<&str> = ass_time.split(':').collect();
    if parts.len() == 3 {
        let hr = parts[0].parse::<u32>().unwrap_or(0);
        let min = parts[1];
        let sec_parts: Vec<&str> = parts[2].split('.').collect();
        let sec = sec_parts[0];
        let cs = if sec_parts.len() > 1 {
            sec_parts[1]
        } else {
            "00"
        };
        let ms = format!("{:0<3}", cs); // "45" -> "450"
        format!("{:02}:{}:{},{}", hr, min, sec, &ms[..3])
    } else {
        ass_time.replace('.', ",")
    }
}

fn strip_ass_tags(text: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for c in text.chars() {
        if c == '{' {
            in_tag = true;
        } else if c == '}' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
        }
    }
    result
}

/// Sanitizes any subtitle file (VTT, ASS, or legacy encoding SRT) to clean UTF-8 SRT
pub fn sanitize_subtitle_file(input_path: &str) -> Result<SanitizeResult, String> {
    let path = Path::new(input_path);
    if !path.exists() {
        return Err(format!("Subtitle file not found: {}", input_path));
    }

    let bytes = fs::read(path).map_err(|e| format!("Failed to read subtitle file: {}", e))?;
    let (decoded_content, detected_encoding) = decode_bytes_to_utf8(&bytes);

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let (srt_content, original_format, cues_count, was_converted) = match ext.as_str() {
        "vtt" => {
            let (converted, count) = convert_vtt_to_srt(&decoded_content);
            (converted, "vtt".to_string(), count, true)
        }
        "ass" | "ssa" => {
            let (converted, count) = convert_ass_to_srt(&decoded_content);
            (converted, "ass".to_string(), count, true)
        }
        "srt" => {
            let cues = decoded_content.matches("-->").count();
            let needs_resave = detected_encoding != "UTF-8";
            (decoded_content, "srt".to_string(), cues, needs_resave)
        }
        _ => {
            let cues = decoded_content.matches("-->").count();
            (decoded_content, "unknown".to_string(), cues, true)
        }
    };

    let sanitized_path = if was_converted {
        // Create sanitized file in cache / temp folder
        let temp_dir = std::env::temp_dir();
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("subtitle");
        let out_filename = format!("{}_utf8_sanitized.srt", stem);
        let out_path: PathBuf = temp_dir.join(out_filename);
        let out_str = out_path.to_string_lossy().to_string();

        fs::write(&out_path, srt_content.as_bytes())
            .map_err(|e| format!("Failed to write sanitized subtitle: {}", e))?;

        out_str
    } else {
        input_path.to_string()
    };

    Ok(SanitizeResult {
        sanitized_path,
        original_format,
        detected_encoding,
        was_converted,
        cues_count,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_utf8_bom_decoding() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice(b"1\n00:00:01,000 --> 00:00:02,000\nHello World\n");
        let (content, enc) = decode_bytes_to_utf8(&bytes);
        assert_eq!(enc, "UTF-8-BOM");
        assert_eq!(content, "1\n00:00:01,000 --> 00:00:02,000\nHello World\n");
    }

    #[test]
    fn test_windows1252_decoding() {
        // "Café" in Windows-1252: 'é' is 0xE9
        let bytes = vec![b'C', b'a', b'f', 0xE9];
        let (content, enc) = decode_bytes_to_utf8(&bytes);
        assert_eq!(enc, "Windows-1252");
        assert_eq!(content, "Café");
    }

    #[test]
    fn test_vtt_to_srt_conversion() {
        let vtt = r#"WEBVTT - Sample WebVTT File

00:01.000 --> 00:04.000 position:50% line:0
<v Roger>Never drink liquid nitrogen.</v>

2
00:05.000 --> 00:09.000
<b>It will</b> <i>hurt</i>.
"#;
        let (srt, count) = convert_vtt_to_srt(vtt);
        assert_eq!(count, 2);
        assert!(srt.contains("1\n00:00:01,000 --> 00:00:04,000\nNever drink liquid nitrogen."));
        assert!(srt.contains("2\n00:00:05,000 --> 00:00:09,000\nIt will hurt."));
    }

    #[test]
    fn test_ass_to_srt_conversion() {
        let ass = r#"[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:01:05.20,0:01:08.50,Default,,0,0,0,,{\an8}Top subtitle line\NSecond line!
"#;
        let (srt, count) = convert_ass_to_srt(ass);
        assert_eq!(count, 1);
        assert!(srt.contains("1\n00:01:05,200 --> 00:01:08,500\nTop subtitle line\nSecond line!"));
    }
}
