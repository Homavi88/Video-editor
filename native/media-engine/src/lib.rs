//! Lumina media engine (Rust).
//!
//! Stage 0 ships a compile-checked crate skeleton. Stage 2 wires:
//! - FFmpeg demux/decode (LGPL)
//! - Proxy transcoder
//! - Audio peak pyramid extraction
//! - napi-rs exports consumed by `packages/media-client`

/// Engine semantic version exposed to the TypeScript host later via napi.
pub fn engine_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_semverish() {
        assert!(!engine_version().is_empty());
    }
}
