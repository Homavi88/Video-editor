# Changelog

All notable changes to Lumina are documented in this file.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Stage 0 architecture: product name **Lumina**, stack Variant A (Electron + React + TS + Zustand + Tailwind + Rust/napi-rs + FFmpeg + WebGL2).
- Monorepo scaffold with npm workspaces.
- `@lumina/core` domain package:
  - Tick-based timebase and frame-rate helpers.
  - Project → Sequence → Track → Clip → Effect → Keyframe model.
  - Media pool types (items, bins, metadata, proxy).
  - Command pattern + `HistoryStack` with place / split / lift / rename commands.
  - `project.json` serialize/parse with Zod validation and migration framework.
  - Render-graph planner (`buildRenderGraph`, `topoSort`) and cache invalidation index.
- Documentation: `ARCHITECTURE.md`, `docs/DECISIONS.md`.
- Native crate placeholder `native/media-engine` (Rust) for Stage 2.
- Unit tests (Vitest) for time, keyframes, timeline commands, project round-trip, render graph.
