//! Lumina media engine (Rust).
//!
//! Stage 0–2: compile-checked crate with decode request types and a CPU
//! reference color-bars generator used by tests until FFmpeg/napi land.

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

/// Dispatches a decode request. Stage 2 returns color bars; Stage 2.x swaps in FFmpeg.
pub fn decode_frame(req: &DecodeFrameRequest) -> RgbaFrame {
    let phase = (req.source_ticks.abs() / 10_000_000) as u32;
    let _ = &req.media_path;
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
}
