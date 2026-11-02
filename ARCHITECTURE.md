# Lumina — Architecture (Stage 0)

**Product name:** Lumina  
**Repo:** `Homavi88/Video-editor`  
**Stage:** 0 — architecture, data model, repository structure, stack choice

---

## 1. Stack decision (Variant A)

| Layer | Choice | Why |
| --- | --- | --- |
| Shell | **Electron** | Cross-platform desktop (Win/macOS/Linux), mature media-app ecosystem, Node access for FFmpeg IPC |
| UI | **React 19 + TypeScript (strict) + TailwindCSS** | Fast panel layout iteration; strict TS matches NLE model complexity |
| Client state | **Zustand** | Lightweight, fits panel/workspace state; domain mutations go through Command history, not the store |
| Media core | **Rust via napi-rs** | Safe concurrency for decode/encode workers; FFI to FFmpeg without GC pauses on hot paths |
| Decode / encode | **FFmpeg (libav*) LGPL build** | Industry standard; see [Licensing](#8-licensing-notes) |
| Preview decode (renderer) | **WebCodecs** where available, native decode fallback | Low-latency scrubbing in Chromium |
| Preview compose | **WebGL2** (primary), **wgpu** in native worker later | Shader transitions (gl-transitions compatible); OpenGL fallback via ANGLE |
| Audio graph | **Tone.js** (UI metering / light FX prototyping) → native mixer in Stage 8 | Rapid UX first; replace hot path with Rust/WASAPI/CoreAudio/ALSA |
| Waveforms | **Custom peak pyramids** in SQLite cache (not wavesurfer for timeline) | NLE needs multi-resolution peaks synced to tick timebase |
| Project storage | **`.lumina` package** = directory/zip with `project.json` + `cache.sqlite` | Human-inspectable JSON + fast binary indexes |
| Monorepo | **npm workspaces** | Simple; Turborepo optional later |
| Tests | **Vitest** (`@lumina/core`), Playwright e2e from Stage 11 | |

**Rejected for v1:** Variant B (web-only) as primary — 4K@60 realtime + hardware encoders need native access. Variant C (Qt) — slower UI iteration for panel UX. Web remains a future optional target reusing `@lumina/core` + WebCodecs.

---

## 2. Repository structure

```
lumina/
├── ARCHITECTURE.md          ← this file
├── CHANGELOG.md
├── PROMPT.md                ← product brief
├── README.md
├── package.json             ← npm workspaces root
├── apps/
│   └── desktop/             ← Electron + React shell (Stage 1+)
├── packages/
│   ├── core/                ← domain model, commands, project I/O, render-graph contracts
│   ├── ui/                  ← shared panels/components (Stage 1+)
│   ├── i18n/                ← RU/EN dictionaries (Stage 1+)
│   └── media-client/        ← TS façade over native napi addon (Stage 2+)
├── native/
│   └── media-engine/        ← Rust crate (napi-rs): decode, proxy, peaks, export
└── docs/
    └── DECISIONS.md         ← Stage 0 assumptions / ADRs
```

**Separation rule:** `@lumina/core` has zero Electron/DOM/FFmpeg dependencies. UI and native engine both consume core types. This keeps the model unit-testable and allows a future web shell.

---

## 3. Data model

```
Project
  ├── MediaBin[] / MediaItem[]     (media pool)
  └── Sequence[]
        ├── Track[] (video | audio | subtitle | adjustment)
        │     └── Clip[]
        │           ├── source (media | sequence | generated)
        │           ├── timing (start, duration, in, out, speed)
        │           └── EffectInstance[] → Keyframe curves
        └── Marker[]
```

### Timebase

All timeline positions use **`TimeTicks = bigint`** with  
`TICKS_PER_SECOND = 254_016_000_000` (divisible by 24/25/30/50/60 and 1001-based rates).  
UI displays timecode via `ticks ↔ frames` helpers; never store floats on disk.

### TypeScript interfaces

Implemented in `packages/core/src/model/*` and exported from `@lumina/core`:

- `Project`, `ProjectSettings`
- `Sequence`, `Marker`
- `Track`, `Clip`
- `EffectInstance`, `EffectParamState`, `Keyframe`
- `MediaItem`, `MediaBin`, `MediaMetadata`

### Rust mirror (Stage 2+)

```rust
// native/media-engine — conceptual mirror (TS remains source of truth for project JSON)
pub struct TimelinePoint { pub ticks: i128 }
pub struct ClipId(pub String);
// Decode requests use clip_id + source_ticks + output size; composition stays in TS graph planner.
```

---

## 4. Render graph

Per preview/export frame, `@lumina/core` builds a **DAG**:

```
SourceDecode → Effect* → Transform → TrackComposite* → SequenceOutput
```

- Planner: `buildRenderGraph(sequence, time)` (pure TS).
- Executor: native/WebGL consumes topo-sorted nodes (`topoSort`).
- Cache: `RenderCacheIndex` — content-addressable keys; invalidate node → cascade to dependents.
- Transitions (Stage 5): insert `transitionMix` between overlapping clip outputs with `progress ∈ [0,1]`.
- Adjustment tracks: effect-only nodes whose input is the composite below them.

**Invalidation triggers:** clip edit, effect param change, media offline/proxy switch, sequence size/fps change, LUT reload.

**Realtime path:** decode (GPU-accelerated when possible) → texture → shader effect chain → present. Heavy filters fall back to background cache renders (smart cache).

---

## 5. Command pattern (undo/redo)

```ts
interface Command {
  readonly type: string;
  readonly label: string;
  execute(project: Project): Project;
  undo(project: Project): Project;
}
```

`HistoryStack` holds undo/redo arrays (limit 200). Domain store in the UI always reads `history.current`.  

Stage 0 commands: `PlaceClipCommand`, `SplitClipCommand`, `LiftClipCommand`, `RenameSequenceCommand`.  
Later stages add ripple/roll/slip/slide, effect edits, media import, etc. — all as commands.

Crash recovery journal (Stage 1+): append-only command log beside autosave.

---

## 6. Project file format

**Package:** `MyFilm.lumina/` (directory; optional zip for sharing)

```
MyFilm.lumina/
  project.json       # canonical document (formatVersion)
  media/             # optional managed copies / proxies
  cache.sqlite       # thumbnails, audio peaks, render-cache index (disposable)
  versions/          # autosave snapshots
  lumina.lock        # single-writer lock
```

**Migration strategy:** `formatVersion` integer on `project.json`.  
`migrateProjectDocument()` applies ordered `MIGRATIONS[fromVersion]` until current.  
Never mutate shipped migrations; bump `PROJECT_FORMAT_VERSION` and append.  
Opening a newer file than the app supports fails loudly.

**Interchange (Stage 9):** FCPXML / EDL / AAF / OTIO exporters map from the same domain model.

---

## 7. Application layout (Stage 1 target)

Classic NLE chrome:

| Region | Panel |
| --- | --- |
| Left | Media Pool (bins, search, tags) |
| Center-top | Source Monitor \| Program Monitor |
| Center-bottom | Timeline |
| Right | Inspector / Effects |
| Bottom drawer | Audio Mixer (workspace-dependent) |

Workspaces: Edit, Color, Audio, Effects, Export — saved dock layouts in user config.

---

## 8. Licensing notes

- **FFmpeg:** ship **LGPL** shared-library build by default. Enabling GPL encoders (e.g. x264) requires GPL compliance for distribution — document in installer.
- **H.264 / H.265:** patent royalties may apply for commercial redistribution (MPEG-LA / Via Licensing). Lumina will warn in export UI and prefer royalty-free presets (VP9/AV1) where acceptable.
- **ProRes:** encoding via FFmpeg is available but distribution rights depend on platform; prefer macOS VideoToolbox where applicable.
- App code: **MIT** (unless changed by owner).

---

## 9. Stage map

| Stage | Focus |
| --- | --- |
| **0** | Architecture, `@lumina/core`, project format ← **current** |
| 1 | Electron shell, panels, media pool import UX |
| 2 | Decode engine + WebGL preview |
| 3 | Timeline tools + full undo |
| 4 | Compositing / keyframes / masks |
| 5 | GPU transitions |
| 6 | Titles / subtitles / STT |
| 7 | Effects / color / scopes / LUT |
| 8 | Audio mixer |
| 9 | Export / transcoder |
| 10 | AI module + plugin SDK |
| 11 | Tests, installers, docs |

---

## 10. How to verify Stage 0

```bash
npm install
npm test
npm run typecheck
```

Expected: all `@lumina/core` unit tests pass; `tsc --noEmit` clean.
