# @lumina/desktop

Lumina NLE shell — Electron main process + Vite/React renderer.

```bash
npm run dev            # renderer only
npm run dev:electron   # Electron + Vite
npm run build
npm test
```

Workspaces: Edit, Color, Audio, Effects, Export. State lives in `src/store/editor-store.ts` on top of `@lumina/core` commands.
