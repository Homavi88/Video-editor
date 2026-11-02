# Stage 0 decisions (no blocking questions)

The product brief allowed up to five clarifying questions. Per autonomous execution, the following defaults are locked for Stage 0–1. Change via ADR if needed.

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Product name | **Lumina** (repo remains `Video-editor`) |
| 2 | Primary target | Desktop Electron first; web shell deferred |
| 3 | State library | Zustand for UI; Commands for document mutations |
| 4 | Project extension | `.lumina` directory package + `project.json` |
| 5 | Default sequence | 1920×1080, 25 fps, Rec.709, 48 kHz stereo |
| 6 | FFmpeg | LGPL shared build; GPL/patent warnings at export |
| 7 | AI features | Optional module from Stage 10 only |
| 8 | UI language | i18n from Stage 1 with RU + EN |
| 9 | Plugin SDK | Designed in architecture; implemented Stage 10 |
| 10 | Autodesk/Adobe parity | Scope is Premiere-class feature set over stages 1–11, not day-one feature complete |
