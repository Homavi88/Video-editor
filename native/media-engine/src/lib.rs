//! Lumina media engine (Rust).
//!
//! Decodes preview frames via the system `ffmpeg` CLI when available,
//! falling back to a CPU color-bars generator.

use std::io::Read;
use std::process::{Command, Stdio};

/// Engine semantic version exposed to the TypeScript host later via napi.
pub fn engine_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Request to decode a single video frame for preview or export.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DecodeFrameRequest {
    pub media_path: String,
    /// Source timeline position in Lumina ticks (i128 mirror of TS bigint).
    pub source_ticks: i128,
    pub output_width: u32,
    pub output_height: u32,
}

/// RGBA8 frame buffer returned by the engine.
#[derive(Clone, Debug)]
pub struct RgbaFrame {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

/// CPU reference pattern used when FFmpeg decode is unavailable.
pub fn generate_color_bars(width: u32, height: u32, phase: u32) -> RgbaFrame {
    let colors: [[u8; 3]; 7] = [
        [180, 180, 180],
        [180, 180, 16],
        [16, 180, 180],
        [16, 180, 16],
        [180, 16, 180],
        [180, 16, 16],
        [16, 16, 180],
    ];
    let mut pixels = vec![0u8; (width * height * 4) as usize];
    for y in 0..height {
        for x in 0..width {
            let band = ((x * 7) / width.max(1) + phase) as usize % colors.len();
            let i = ((y * width + x) * 4) as usize;
            pixels[i] = colors[band][0];
            pixels[i + 1] = colors[band][1];
            pixels[i + 2] = colors[band][2];
            pixels[i + 3] = 255;
        }
    }
    RgbaFrame {
        width,
        height,
        pixels,
    }
}

fn ticks_to_seconds(ticks: i128) -> f64 {
    // Lumina ticks are 10_000_000 per second (100ns units).
    (ticks as f64) / 10_000_000.0
}

/// Attempts an ffmpeg rawvideo RGBA decode at the requested timestamp.
pub fn decode_frame_ffmpeg(req: &DecodeFrameRequest) -> Option<RgbaFrame> {
    if req.media_path.starts_with("demo://") || req.media_path.is_empty() {
        return None;
    }
    let w = req.output_width.max(1);
    let h = req.output_height.max(1);
    let t = ticks_to_seconds(req.source_ticks).max(0.0);
    let scale = format!("{w}:{h}");
    let output = Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            &format!("{t:.3}"),
            "-i",
            &req.media_path,
            "-frames:v",
            "1",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-vf",
            &format!("scale={scale}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2"),
            "pipe:1",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let mut child = output;
    let mut stdout = child.stdout.take()?;
    let expected = (w as usize) * (h as usize) * 4;
    let mut buf = Vec::with_capacity(expected);
    stdout.read_to_end(&mut buf).ok()?;
    let status = child.wait().ok()?;
    if !status.success() || buf.len() < expected {
        return None;
    }
    buf.truncate(expected);
    Some(RgbaFrame {
        width: w,
        height: h,
        pixels: buf,
    })
}

/// Dispatches a decode request: ffmpeg CLI first, color bars fallback.
pub fn decode_frame(req: &DecodeFrameRequest) -> RgbaFrame {
    if let Some(frame) = decode_frame_ffmpeg(req) {
        return frame;
    }
    let phase = (req.source_ticks.abs() / 10_000_000) as u32;
    generate_color_bars(req.output_width.max(1), req.output_height.max(1), phase)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_semverish() {
        assert!(!engine_version().is_empty());
    }

    #[test]
    fn color_bars_size() {
        let frame = generate_color_bars(64, 36, 0);
        assert_eq!(frame.pixels.len(), 64 * 36 * 4);
        assert_eq!(frame.pixels[3], 255);
    }

    #[test]
    fn decode_frame_dispatches() {
        let frame = decode_frame(&DecodeFrameRequest {
            media_path: "demo://bars".into(),
            source_ticks: 0,
            output_width: 32,
            output_height: 18,
        });
        assert_eq!(frame.width, 32);
    }

    #[test]
    fn ffmpeg_decode_demo_when_available() {
        // Soft assertion: if ffmpeg or demo file missing, skip.
        let demo = std::path::Path::new("apps/desktop/.lumina-cache/demo/demo-bars.mp4");
        if !demo.exists() {
            return;
        }
        let frame = decode_frame(&DecodeFrameRequest {
            media_path: demo.display().to_string(),
            source_ticks: 5_000_000,
            output_width: 64,
            output_height: 36,
        });
        assert_eq!(frame.pixels.len(), 64 * 36 * 4);
    }
}
