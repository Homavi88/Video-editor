# Lumina

Multi-track non-linear video editor (NLE) — desktop-first (Electron), Premiere / Resolve / Final Cut class roadmap.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [PROMPT.md](./PROMPT.md), [CHANGELOG.md](./CHANGELOG.md).

## Quick start

```bash
npm install
npm run build
npm test
npm run native:test
npm run dev          # Vite UI at http://127.0.0.1:5173
# optional Electron shell:
npm run dev:electron -w @lumina/desktop
```

## Packages

| Package | Role |
| --- | --- |
| `@lumina/core` | Domain model, commands, project I/O, effects/transitions/export catalogs |
| `@lumina/media-client` | ffprobe / ffmpeg helpers (probe, proxy, peaks, thumbs) |
| `@lumina/effects` | WebGL2 shaders + preview renderer |
| `@lumina/i18n` | RU / EN strings |
| `@lumina/plugin-sdk` | Third-party plugin contracts |
| `@lumina/ai` | STT / scene / reframe helpers |
| `@lumina/desktop` | Electron + React UI |
| `native/media-engine` | Rust decode engine skeleton |

## Shortcuts (Edit)

| Key | Action |
| --- | --- |
| Space | Play / pause |
| V / B | Select / Razor |
| C | Split at playhead |
| J / K / L | −1s / stop / +1s |
| Del / Shift+Del | Lift / Extract |
| Ctrl/Cmd+Z / Y | Undo / Redo |

## License

MIT for application code. FFmpeg is expected as an LGPL build; H.264/H.265 export shows an MPEG-LA patent warning.
