# Lumina

Multi-track non-linear video editor (NLE) — desktop-first, Premiere / Resolve / Final Cut class roadmap.

> Stage **0** complete: architecture, domain model, project format, render-graph contracts.  
> See [ARCHITECTURE.md](./ARCHITECTURE.md) and [PROMPT.md](./PROMPT.md).

## Stack

- **UI:** Electron + React + TypeScript + Zustand + TailwindCSS  
- **Core:** `@lumina/core` (pure TypeScript)  
- **Engine (planned):** Rust (napi-rs) + FFmpeg + WebGL2 preview  

## Quick start (Stage 0)

```bash
npm install
npm test
npm run typecheck
```

## Workspace layout

| Path | Role |
| --- | --- |
| `packages/core` | Domain model, commands, project I/O, render graph |
| `apps/desktop` | Electron application (Stage 1+) |
| `native/media-engine` | Rust media engine (Stage 2+) |
| `docs/` | ADRs / decisions |

## License

Application code: MIT.  
FFmpeg will be shipped as an LGPL build unless GPL features are explicitly enabled — see Architecture § Licensing.
