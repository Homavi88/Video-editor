# Changelog

All notable changes to Lumina are documented in this file.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Real ffmpeg media pipeline in Vite: `/api/probe`, `/api/frame`, `/api/demo/ensure`, `/api/export`.
- Program/Source monitors pull PNG frames for file-backed clips (fallback color bars).
- Sequence export via ffmpeg filter_complex + dry-run; EDL / FCPXML / OTIO interchange.
- Advanced edit commands: ripple trim, roll, slip, slide, speed, link, markers.
- Mask model, CPU scopes (waveform/parade/histogram/vectorscope), audio DSP (EQ/comp/reverb).
- Autosave snapshots + hotkey presets (Lumina/Premiere/FCP/Resolve).
- `scripts/e2e-smoke.mjs` against running Vite server.
- Path allowlist for media API; HW encoder detection; multi-track overlay export.
- Proxy generation, filmstrip, peaks API; timeline waveforms; mask inspector preview.
- Whisper CLI integration with demo fallback; electron-builder config + `package:desktop`.
- Auto-place demo media on V1/A1; Insert/double-click from Media Pool; filmstrip thumbs on clips.
- Soft mask feather/expansion applied in Program monitor; proxy path attached to media items.
- Frame cache + prefetch for Program playback; ripple/roll/slip/slide gestures; Cross Dissolve → ffmpeg xfade.
- Export queue actually runs jobs with progress; SlideEdit trims neighbors.
- Continuous WebCodecs/HTMLVideo preview via `/api/stream`; Web Audio mixer with real VU/solo/fader.
- GPU blend + mask shaders; clickable transition presets; Media Pool search/tags/auto-proxy 4K.
- Nested sequence command; title overlay on Program; crash journal; electron-builder packaging scripts.

#### Stage 0 — Architecture
- Product name **Lumina**, stack Variant A documented in `ARCHITECTURE.md`.
- `@lumina/core` domain model, command history, project.json, render-graph planner.

#### Stage 1 — App shell & media pool
- Electron + Vite + React + Tailwind desktop app (`apps/desktop`) with Edit/Color/Audio/Effects/Export workspaces.
- Zustand editor store wired to `HistoryStack` / commands; RU/EN i18n; dark/light themes.
- Media Pool with drag-drop onto timeline, demo media, Electron file dialog import.

#### Stage 2 — Preview pipeline
- `@lumina/effects` WebGL2 preview renderer (color bars, blit, vignette, LGG, blur/crossfade shaders).
- `@lumina/media-client` ffprobe probe, proxy args, peaks, poster frames.
- Rust `native/media-engine` decode request types + CPU color-bars generator.

#### Stage 3 — Timeline
- Multi-track timeline UI: zoom, snap, razor/select tools, playhead, drag move, drop, split/lift/extract.
- Additional commands: move/trim/extract/import/track flags + snap helpers.

#### Stage 4–5 — Compositing & transitions
- Effect/transform param model; blend modes on clips.
- Transition preset catalog + GLSL crossfade/wipe shaders (gl-transitions oriented).

#### Stage 6 — Titles & captions
- Title documents, animation presets, lower-thirds helper.
- SRT/VTT parse/serialize; demo Whisper transcription via `@lumina/ai`.

#### Stage 7 — Color
- Lift/Gamma/Gain, exposure, saturation math; `.cube` LUT parse/sample/serialize.
- Color workspace panel with live RGB preview.

#### Stage 8 — Audio
- Volume automation helpers, ducking, silence detection, mixer panel with mute/VU.

#### Stage 9 — Export
- Export preset catalog (YouTube/Reels/TikTok/AV1/ProRes/WAV), patent acknowledgement gate, ffmpeg arg builder, export queue UI.

#### Stage 10 — AI & plugins
- `@lumina/ai` transcription jobs, scene detect, auto-reframe 9:16.
- `@lumina/plugin-sdk` manifest validation + registry; example plugin under `plugins/example-glow`.

#### Stage 11 — Tests & packaging
- Expanded unit tests across packages; `scripts/pack-linux.mjs` renderer pack helper.
- Root scripts: `build`, `test`, `typecheck`, `dev`, `native:test`, `pack:linux`.
